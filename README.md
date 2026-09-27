# Andon Monitoring System

Sistem monitoring andon (indikator kondisi mesin) berbasis monorepo.

## Struktur

```
.
├── backend/          # Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/       # schema & seed
│   └── src/
│       ├── config/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       └── utils/
├── frontend/         # Vue 3 + Vite + Tailwind CSS + Pinia + Vue Router
│   └── src/
│       ├── components/
│       ├── layouts/
│       ├── router/
│       ├── services/
│       ├── stores/
│       └── views/
└── docker-compose.yml  # PostgreSQL
```

## Setup Awal

```bash
# 1. Clone repositori & masuk ke folder
git clone <repo-url>
cd andon-monitoring-system

# 2. Siapkan koneksi DB (NeonDB / PostgreSQL lain) di backend/.env
#    - DATABASE_URL: pooled connection
#    - DIRECT_URL: direct connection (untuk prisma migrate)

# 3. Install & setup backend
cd backend
npm install
npx prisma migrate dev --name init
npm run seed

# 4. Install & setup frontend
cd ../frontend
npm install
```

## Menjalankan

```bash
# Terminal 1 - Backend (http://localhost:3000)
cd backend
npm run dev

# Terminal 2 - Frontend (http://localhost:5173)
cd frontend
npm run dev
```

## Endpoint API

Semua endpoint di bawah `/api/...` kecuali `/api/auth/login` memerlukan header `Authorization: Bearer <token>`.

| Method | Endpoint                        | Akses | Deskripsi                    |
| ------ | ------------------------------- | ----- | ---------------------------- |
| POST   | /api/auth/login                 | Public | Login, mengembalikan JWT    |
| GET    | /api/auth/me                    | Auth  | Profil user saat ini         |
| GET    | /api/roles, /api/users, /api/shifts, /api/items, /api/machines, /api/abnormalities, /api/production-setups, /api/defects | Admin, Supervisor | List masterdata (read) |
| GET    | /api/{resource}/:id             | Admin, Supervisor | Detail masterdata    |
| POST   | /api/{resource}                 | Admin | Buat masterdata             |
| PUT    | /api/{resource}/:id             | Admin | Update masterdata           |
| DELETE | /api/{resource}/:id             | Admin | Hapus masterdata            |
| GET    | /api/work-orders                | Admin, Supervisor | List WO (`?type=` / `?approvalStatus=`) |
| POST   | /api/work-orders                | Admin | Buat WorkOrder             |
| PUT    | /api/work-orders/:id            | Admin | Update WorkOrder           |
| DELETE | /api/work-orders/:id            | Admin | Hapus WorkOrder            |
| GET    | /api/analytics/summary          | Admin, Supervisor | Ringkasan analitik produksi (OK/NG, Pareto defect, downtime, OEE) per hari & per shift |
| GET    | /api/production-logs            | Admin, Supervisor | Log produksi mentah untuk drill-down angka di halaman Production Analytics |
| GET    | /api/health                     | Public | Cek status API             |

### GET /api/analytics/summary

Mengagregasi `production_logs` (dijavascript ulang lewat WorkOrder) menjadi ringkasan per hari dan per shift.

| Parameter     | Tipe   | Default            | Keterangan                                       |
| ------------- | ------ | ------------------ | ------------------------------------------------ |
| `from`        | String | 6 hari lalu (00:00) | `YYYY-MM-DD` atau ISO-8601                       |
| `to`          | String | sekarang           | Inklusif; `YYYY-MM-DD`/artinya sampai akhir hari |
| `shiftId`     | Int    | -                  | Filter shift                                     |
| `machineId`   | Int    | -                  | Filter mesin                                     |
| `itemId`      | Int    | -                  | Filter item                                      |
| `workOrderId` | Int    | -                  | Filter work order                                |
| `timezone`    | String | `Asia/Jakarta`     | Zona waktu pengelompokan "per hari"              |

Rentang maksimal 366 hari. Waktu yang dikelompokkan mengikuti zona waktu laporan, bukan UTC.

Isi respons:

| Field                                     | Isi                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `range`, `filters`                        | Rentang & filter yang dipakai                                                                     |
| `plannedDailyMinutes`                     | Waktu rencana per hari = total durasi shift dalam cakupan filter                                 |
| `totals`                                  | Total OK/NG/REJECT, jumlah event per result, downtime, target, dan OEE keseluruhan               |
| `byDay`                                   | Deret harian (zero-fill), masing-masing dengan total, downtime per kategori, Pareto 5 teratas, OEE |
| `byShift`                                 | Deret per shift dengan metrik yang sama                                                          |
| `defectPareto`                            | `{ totalQty, list }` - Pareto defect dengan persentase, persentase kumulatif, dan `isVitalFew`    |
| `downtimeByCategory`                      | Total downtime per kategori + persentasenya                                                      |

Perhitungan:

- **Total OK/NG** - `SUM(goodQty)` dan `SUM(ngQty)`; `resultCounts` menghitung jumlah event per nilai
  enum `result`. Unit `REJECT` dihitung 1 per event.
- **Pareto Defect** - defect diambil dari `note` ProductionLog (format `Defect: <nama> (<kode>)`, sama seperti
  yang ditulis `services/ingest.js`), lalu di-`LEFT JOIN` ke master `defects` untuk nama & item. Baris dengan
  kode defect sama digabung lebih dulu agar tidak terpecah per hari/shift. `isVitalFew` menandai defect yang
  dibutuhkan untuk mencapai 80% kumulatif.
- **Downtime per kategori** - `SUM(downtimeMinutes)` dikelompokkan `downtimeCategory`, dengan persentase
  terhadap total downtime.
- **OEE** - `Availability` = (waktu rencana - downtime) / waktu rencana; `Performance` =
  (cycle time ideal × total qty) / waktu operasi, memakai cycle time tercepat yang tercatat
  (`MIN(cycleTimeSeconds)`), atau `targetQuantity` bila data cycle time belum ada (`performanceBasis`);
  `Quality` = OK / (OK + NG + REJECT); `OEE` = A × P × Q. Shift yang melewati tengah malam (mis. 23:00-07:00)
  dihitung 8 jam. Nilai komponen yang tidak bisa dihitung dikembalikan `null`.

### GET /api/production-logs

Menyediakan log `production_logs` apa adanya (beserta relasi machine, item, dan shift dari work order) untuk
drill-down dari angka pada halaman Production Analytics. Semua parameter `from`, `to`, `shiftId`, `machineId`,
`itemId`, `workOrderId`, dan `timezone` mengikuti aturan yang sama dengan `/api/analytics/summary`.

| Parameter          | Tipe   | Default | Keterangan                                                     |
| ------------------ | ------ | ------- | -------------------------------------------------------------- |
| `date`             | String | -       | Satu hari spesifik (`YYYY-MM-DD`), dipakai drill-down grafik Productivity per hari |
| `result`           | String | -       | Filter multi nilai, dipisah koma, mis. `NG,REJECT`              |
| `downtimeCategory` | String | -       | Kategori downtime spesifik                                      |
| `defectCode`       | String | -       | Kode defect hasil parse dari `note` (`Defect: <nama> (<kode>)`)   |
| `hasDowntime`      | Bool   | -       | `true` = hanya log dengan `downtimeMinutes > 0`                 |
| `hasCycleTime`     | Bool   | -       | `true` = hanya log dengan `cycleTimeSeconds` terisi              |
| `page`             | Int    | 1       | Halaman, mulai dari 1                                           |
| `limit`            | Int    | 50      | Baris per halaman, maksimum 500                                 |

Respons `{ data, meta: { page, limit, total, totalPages } }`, dengan `data` sudah dilengkapi `defectCode` dan
`defectName` dari `note`. Dispatch drill-down di frontend:

| Angka/komponen di UI       | Filter drill-down                                     |
| -------------------------- | ----------------------------------------------------- |
| OEE                        | tanpa filter tambahan                                 |
| Availability               | `hasDowntime=true`                                     |
| Performance                | `hasCycleTime=true`                                    |
| Quality                    | `result=NG,REJECT`                                     |
| Bentuk Productivity per hari | `date=YYYY-MM-DD`                                   |
| Bentuk Productivity per shift | `shiftId=<id>`                                     |
| Batang Pareto Defect       | `defectCode=<kode>`                                    |
| Baris Downtime per Kategori | `downtimeCategory=<kategori>&hasDowntime=true`      |

### RBAC

| Role       | Akses                                    |
| ---------- | ---------------------------------------- |
| Admin      | Read + Write pada semua masterdata       |
| Supervisor | Read-only (GET)                          |
| Operator   | Diblokir (403)                           |

Akun default: `admin / admin123` (dibuat oleh `npm run seed`).