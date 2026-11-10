# POS Alternatif

Sistem POS multi-outlet untuk F&B/retail Indonesia.

## Struktur Monorepo

```
/backend      NestJS + Prisma + PostgreSQL
/dashboard    Next.js 15 + Tailwind + shadcn/ui
/pos-app      Flutter (Android-first, offline-first)
```

## Prasyarat

- Node.js ≥ 18
- PostgreSQL ≥ 15
- Redis ≥ 7
- Flutter ≥ 3.x (untuk pos-app)

## Setup Cepat

```bash
# 1. Copy env
cp .env.example .env
# edit DATABASE_URL, REDIS_URL, JWT_SECRET

# 2. Backend
cd backend
npm install
npx prisma migrate dev
npx prisma db seed
npm run start:dev

# 3. Dashboard
cd dashboard
npm install
npm run dev
```

## Fase Development

- **Fase 1** ✅ Fondasi: auth, outlet, produk, kasir dasar, shift
- **Fase 2** 🔲 Inventory, resep, GR (Google Sheets), waste, produksi
- **Fase 3** 🔲 Promo, diskon, membership
- **Fase 4** 🔲 Laporan lengkap, payment gateway, offline sync penuh
- **Fase 5** 🔲 KDS, integrasi agregator, webhook
