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
| GET    | /api/health                     | Public | Cek status API             |

### RBAC

| Role       | Akses                                    |
| ---------- | ---------------------------------------- |
| Admin      | Read + Write pada semua masterdata       |
| Supervisor | Read-only (GET)                          |
| Operator   | Diblokir (403)                           |

Akun default: `admin / admin123` (dibuat oleh `npm run seed`).