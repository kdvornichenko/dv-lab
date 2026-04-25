# Teacher English CRM

Private operational CRM for an English teacher: students, lessons, attendance, payments, and daily risk dashboard.

## Stack

- Turborepo + Yarn 4 workspaces through Corepack
- `apps/web`: Next.js 16, React 19, Tailwind CSS 4, shadcn-style local components
- `apps/api`: Hono on Node.js
- `packages/api-types`: shared Zod contracts
- `packages/db`: Drizzle schema and ledger helpers for Supabase Postgres
- `packages/rbac`: teacher CRM permission model

## Development

```bash
corepack enable
yarn install
yarn dev
```

Web runs on `http://localhost:3000`.
API runs on `http://localhost:4000`.

Install shadcn components from the web workspace:

```bash
cd apps/web
yarn dlx shadcn@latest add button
```

## Supabase

The project keeps the existing Supabase env contract:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `POSTGRES_URL` or `DATABASE_URL`

Do not expose service-role keys to browser code.
