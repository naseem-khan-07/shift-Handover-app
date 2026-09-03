# ShiftFlow — Shift Handover Management System

Demo-ready full-stack React + Express application for grounded shift handovers.

## Run

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:4000/api/health

## MySQL setup

1. Create the schema: `mysql -u root -p < schema.sql`
2. Copy `.env.example` to `.env` and set your MySQL credentials.
3. Install dependencies: `npm install`
4. Load the existing demo records: `npm run db:seed`
5. Start the app: `npm run dev`

The API keeps the existing `/api/users`, `/api/teams`, `/api/events`, and `/api/handover` flow, but reads the data from MySQL tables.

## Demo accounts

- Manager: Rohan Mehta
- Team Lead: Arun Kumar (Team Alpha)
- Worker: Karthik Rao (Team Alpha)
- Worker: Divya Nair (quiet shift / no blockers or watch-list)
- Worker: Sanjay Menon (blocker scenario)

## Grounding pipeline

`source events → timestamp filter → invalid timestamp handling → group by source + record_id → collapse updates → deterministic final state → exactly four handover sections → next-shift priorities → PDF`

The API owns handover generation. The frontend is a presentation layer over real seeded shift-event records. No LLM is required.
