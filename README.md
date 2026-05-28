# Faraday Tools

Internal demo site for Faraday Construction & Solar — a suite of client-facing tools that convert homeowners into qualified leads.

## Tools

| Route | Tool | Description |
|---|---|---|
| `/hail` | Hail Lead Generator | Address lookup → hail history → risk score → inspection CTA |
| `/solar` | Solar Savings Estimator | Address + bill → savings chart → quote CTA |
| `/quote` | Smart Quote Request | 3-step guided form for all service types |
| `/map` | Colorado Hail Map | Interactive Leaflet map of recent hail events |
| `/admin` | Lead Dashboard | Mock dashboard showing captured leads |

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts · Leaflet · react-leaflet

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in API keys (both optional — tools fall back to realistic mock data)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```
TOMORROW_IO_API_KEY   # tomorrow.io free tier — hail event data
NREL_API_KEY          # developer.nrel.gov free — solar irradiance
```

Both are optional. Without them, the tools use location-aware mock data that looks identical for demo purposes.

## Deploy

```bash
vercel
```

Set `TOMORROW_IO_API_KEY` and `NREL_API_KEY` in Vercel dashboard for live data.

## Status

**Demo-ready** — all 6 routes build and respond cleanly.
