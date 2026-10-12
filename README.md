# คอนโด 4 ห้อง — Condo Rental & Loan Management App

🔗 **ใช้งานจริง:** https://condo-rental-app.supasiao.workers.dev

แอปติดตามค่าเช่าและยอดผ่อนธนาคารสำหรับคอนโดให้เช่า 4 ห้อง — Local-first (ข้อมูลเก็บใน IndexedDB
ของเบราว์เซอร์ ไม่มี server/backend ของตัวเอง) ติดตั้งเป็น PWA บนมือถือได้ ใช้งาน offline ได้

## Tech Stack
Vite + ES Modules · IndexedDB (Local-First) · Firebase Auth & Firestore (Real-Time Cloud Sync) · Tailwind CSS · Lucide Icons · Chart.js — ดีไซน์ตามสไตล์ **"Tactile Neumorphism UI"** ของ Supasit.A Studio

## Local Development
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # รัน Vitest
npm run build    # build production ไปที่ dist/
```

## Deploy
Auto-deploy ขึ้น Cloudflare Workers ผ่าน GitHub Actions ทุกครั้งที่ push เข้า `main`
(ดู `.github/workflows/deploy.yml` + `wrangler.jsonc`)

---
*A-Class WebCraft · Code • Share • Inspire · by Supasit.A*
