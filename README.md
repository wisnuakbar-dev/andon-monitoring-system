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
# Terminal 1 - Backend (http://localhost:3000, WebSocket di /socket.io)
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
| GET    | /api/realtime/kpi               | Auth | Snapshot KPI terbaru dengan payload yang sama seperti yang di-push via WebSocket |
| GET    | /api/realtime/status            | Auth | Jumlah klien WebSocket terhubung & scope KPI aktif |
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

### Realtime KPI (WebSocket / Socket.IO)

Server Express menjalankan Socket.IO pada path `/socket.io` (bisa diubah lewat `SOCKET_PATH`). Alur push-nya:

```
MQTT broker ──> services/ingest.js ──> prisma.productionLog.create() (sukses)
                                            │
                                            ├─> emit "production:log" (langsung, tanpa scope)
                                            │
                                            └─> notifyKpiChanged(trigger)
                                                   │  (debounce KPI_BROADCAST_DEBOUNCE_MS)
                                                   ▼
                                    getKpiSnapshot() ──> emit "kpi:update" ke room scope
                                                         + "andon:update" ke semua klien
```

### Konfigurasi broker MQTT (penting)

Broker dan topik **harus sama** antara backend (subscribe) dan Operator Playground (publish), kalau tidak event mendarat di broker yang tidak ada pendengarnya dan papan Andon tetap `0 pcs`.

Backend adalah sumber kebenaran. `GET /api/realtime/ingest-config` mengembalikan broker aktif (beserta versi WebSocket-nya), topik yang di-subscribe, dan daftar nama event; halaman Operator Playground memanggil endpoint ini saat mount dan mengisi formnya sendiri. Nilai hanya ditimpa kalau user mengetik sendiri (manual override).

| Variabel         | Default                                                                  | Keterangan                                                                     |
| ---------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `MQTT_BROKER_URL` | `mqtt://test.mosquitto.org:1883`                                          | Broker utama. Dipakai backend **dan** diturunkan ke URL WebSocket untuk browser |
| `MQTT_BROKERS`    | `mqtt://test.mosquitto.org:1883,mqtt://broker.hivemq.com:1883`            | Daftar broker cadangan; dicoba berurutan, pindah otomatis saat koneksi tutup     |
| `MQTT_TOPIC`      | `andon/simulator`                                                          | Topik subscribe (bisa beberapa, pisah koma). Wildcard `andon/#` juga bisa, tapi pada broker publik ikut menangkap trafik aplikasi lain |

- Broadcast hanya dihitung ulang untuk **scope yang sedang punya klien terhubung**; kalau tidak ada pendengar, tidak ada query yang dijalankan.
- Burst pesan MQTT (mis. 5 event sekaligus) dipadatkan jadi **satu** perhitungan KPI dan satu emit, dengan `trigger.count` berisi jumlah event yang digabung.
- Setiap scope punya snapshot sementara dengan TTL 10 detik, dipakai untuk klien yang baru subscribe supaya tidak perlu query ulang.
- Perhitungan KPI memakai fungsi OEE yang sama dengan `/api/analytics/summary` (`services/analytics.service.js`), sehingga angka yang di-push identik dengan angka saat halaman di-refresh.

Handshake socket wajib memakai JWT yang valid (`auth.token`, atau `?token=` di query string); koneksi tanpa token ditolak. Parameter scope yang sama dengan `/api/realtime/kpi` menentukan isi payload per klien (tiap scope punya room sendiri).

| Event server      | Kapan                                 | Payload                                                       |
| ----------------- | ------------------------------------- | ------------------------------------------------------------- |
| `kpi:snapshot`    | Balasan `kpi:subscribe` / `kpi:refresh` | `{ scope, snapshot }` - KPI terkini saat klien subscribe      |
| `kpi:update`      | Ada data baru dari MQTT Ingest         | `{ trigger, snapshot }` - `trigger` berisi sumber & data yang memicu |
| `kpi:error`       | Parameter tidak valid / query gagal    | `{ message }`                                                  |
| `production:log`  | Log produksi baru tersimpan di DB      | `{ event, productionLogId, workOrderId, machineId, result, goodQty, ngQty, downtimeCategory, downtimeMinutes, loggedAt }` |
| `andon:update`    | Snapshot KPI selesai dihitung ulang    | `{ trigger, snapshot }` - sama dengan `kpi:update`, tapi dikirim ke **semua** klien tanpa filter scope |

`production:log` dikirim seketika setelah `prisma.productionLog.create()` sukses, sebelum perhitungan KPI selesai. Layar Andon memakainya sebagai pemicu untuk menarik ulang snapshot (dengan jeda pendek 250 ms), sehingga angka output naik pada(event berikutnya tanpa menunggu debounce `kpi:update`.

| Event klien      | Payload                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| `kpi:subscribe`  | `{ rangeDays?, timezone?, from?, to?, shiftId?, machineId?, itemId?, workOrderId? }` (default `rangeDays` = `KPI_RANGE_DAYS`) |
| `kpi:refresh`    | tanpa payload - hitung ulang & kirim `kpi:snapshot` ke socket itu saja                                             |

Isi `snapshot`:

| Field               | Isi                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generatedAt`       | Waktu snapshot dibuat                                                                                                                                    |
| `range`             | `{ from, to, timezone, days }`                                                                                                                            |
| `filters`           | Filter yang dipakai                                                                                                                                       |
| `totals`            | `logCount`, OK/NG/REJECT, `totalQty`, `resultCounts`, downtime, `targetQuantity`, `achievementPercentage`, ideal cycle time, dan `oee` (`plannedMinutes`, `downtimeMinutes`, `operatingMinutes`, `availability`, `performance`, `performanceBasis`, `quality`, `oee`) |
| `downtimeByCategory`| Total downtime per kategori + persentasenya                                                                                                              |
| `topDefects`        | 5 Pareto defect teratas (`isVitalFew` = mencapai 80% kumulatif)                                                                                           |
| `byMachine`         | KPI (termasuk OEE) per mesin                                                                                                                              |
| `byShift`           | KPI (termasuk OEE) per shift                                                                                                                              |
| `recentLogs`        | `KPI_RECENT_LOGS` log produksi terakhir lengkap dengan mesin/item/shift dan `defectCode` hasil parse dari `note`                                          |

Contoh pemakaian di frontend:

```js
import { io } from 'socket.io-client'

const socket = io('http://localhost:3000', { auth: { token: authStore.token } })

socket.on('connect', () => {
  // scope = filter halaman yang sedang dibuka
  socket.emit('kpi:subscribe', { rangeDays: 7, machineId: 1 })
})

socket.on('kpi:snapshot', ({ snapshot }) => applyKpi(snapshot))
socket.on('kpi:update', ({ snapshot, trigger }) => applyKpi(snapshot, trigger))
```

#### Initial load di frontend

`stores/realtime.js` tidak bergantung penuh pada WebSocket:

- Snapshot pertama diambil lewat `GET /api/realtime/kpi` dengan scope yang sama, paralel dengan handshake socket. Siapa pun yang lebih dulu sampai, papan andon langsung tampil.
- Socket tetap menangani pembaruan berikutnya. Kalau socket tidak tersambung (backend sedang restart, CORS, dsb), halaman tetap berisi data dan state `loading` sudah `false`; hanya perubahan filter/refresh yang memakai jalur REST.
- State `loading` hanya `true` selama belum ada satu pun snapshot, jadi layar "Menyiapkan data realtime..." tidak akan menggantung ketika REST maupun socket sama-sama gagal - yang muncul adalah pesan error beserta tombol "Coba lagi".
- Respons REST yang sudah basi (scope diganti lagi sebelum respons tiba) dibuang lewat penomoran request, jadi tidak menimpa data yang lebih baru.

### RBAC

| Role       | Akses                                    |
| ---------- | ---------------------------------------- |
| Admin      | Read + Write pada semua masterdata       |
| Supervisor | Read-only (GET)                          |
| Operator   | Diblokir (403)                           |

Kecuali `/api/realtime/kpi` dan `/api/realtime/status` (serta WebSocket KPI), yang terbuka untuk semua role yang
sudah login karena isinya dipakai untuk monitoring dashboard andon.

Akun default: `admin / admin123` (dibuat oleh `npm run seed`).