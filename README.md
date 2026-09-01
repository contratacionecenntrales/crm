# CRM — Labs Command Center 360

A CRM feature for tracking lab test orders end-to-end: order intake,
status (pending → in progress → completed/cancelled), priority, and
recorded results per contact.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [Prisma](https://www.prisma.io) ORM with PostgreSQL

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and point `DATABASE_URL` at a Postgres
   database:

   ```bash
   cp .env.example .env
   ```

3. Apply migrations and seed sample data:

   ```bash
   npx prisma migrate dev
   npx prisma db seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Visit [http://localhost:3000/labs](http://localhost:3000/labs) for the
   Labs Command Center dashboard.

## Data model

- `Contact` — a CRM contact/patient.
- `LabOrder` — a lab test order for a contact, with `status`
  (`PENDING` / `IN_PROGRESS` / `COMPLETED` / `CANCELLED`) and `priority`
  (`ROUTINE` / `URGENT` / `STAT`).
- `LabResult` — the result recorded against a completed order, with a
  `flag` (`NORMAL` / `ABNORMAL` / `CRITICAL`).

## Features

- **Dashboard** (`/labs`) — order counts by status, plus a searchable,
  filterable table of all lab orders.
- **Order detail** (`/labs/[id]`) — view order and contact details,
  update the order's status, and record/update its result. Saving a
  result automatically marks the order as completed.
- **API routes** — `GET/PATCH /api/orders`, `/api/orders/[id]`, and
  `POST /api/orders/[id]/result` back the UI and can be used
  independently.
