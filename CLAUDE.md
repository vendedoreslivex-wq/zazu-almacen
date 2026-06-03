# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Dev server on port 3000
npm run build      # Production build (Vite)
npm run lint       # TypeScript type-check (tsc --noEmit)
npm run test       # Run tests once (Vitest)
npm run test:watch # Watch-mode testing
```

## Architecture

**Stack**: React 19 + TypeScript + Vite SPA, HashRouter, Tailwind CSS v4, Supabase, Recharts.

### State Management

All application state lives in `src/store/AppContext.tsx` via React Context. It holds products, locations, stock levels, transactions, contacts, users, purchase orders, inventory adjustments, reservations, role permissions, and audit logs. Every page consumes this context — there is no Redux, Zustand, or other store.

`src/store/mappers.ts` converts raw Supabase rows to TypeScript types defined in `src/types.ts`.

Real-time updates come from Supabase Postgres LISTEN subscriptions (one per table) plus a 5-second silent polling fallback. All data is scoped by the active brand (`OVERSHARK | BRAVOS | BOX_PRIME`) stored in context and used as a filter on every query.

### Multi-brand Design

Every DB table has a `brand` column. The active brand is set via the sidebar selector in `src/components/Layout.tsx` and flows through `AppContext` to all queries and writes. Switching brand reloads data for that brand.

### Permissions

`src/lib/permissions.ts` implements role-based access. Four roles: `ADMIN_GENERAL`, `CEO`, `ADMINISTRADOR`, `JEFE_ALMACEN`. The `canView()` helper (used in Layout's `visibleNav`) and `canEdit()` gate every module. Permissions per role are stored in the `role_permissions` table and loaded into context at startup.

### Supabase

- Auth: session-based. Inactive users are forced out by RLS policy.
- DB: direct table access via the JS SDK (`src/lib/supabase.ts`).
- Edge Functions (in `supabase/functions/`):
  - `odoo-stock` — XML-RPC proxy to Odoo (bypasses browser CORS)
  - `send-email` — operation email notifications
  - `update-user-auth` — create/update/delete Supabase Auth users

### Odoo Integration

`src/lib/odooService.ts` exposes `fetchOdooAll()` and per-resource helpers. These call the Supabase Edge Function which speaks XML-RPC to `https://zazuexpress2.odoo.com`. Credentials (URL, DB, user, API key) live in Supabase secrets — the fallback values hardcoded in `supabase/functions/odoo-stock/index.ts` should be moved to secrets for production.

`src/pages/OdooStock.tsx` is read-only: it loads Odoo data, builds an `attrMap` for O(1) attribute lookup per variant, and classifies attributes as color or talla via regex. Filters use `.trim()` comparisons to avoid whitespace mismatches.

### Routing

React Router v7 with `HashRouter`. Routes are defined in `src/App.tsx`. The sidebar in `src/components/Layout.tsx` (`navItems` array) controls order and visibility of modules.

### Build

Vite with manual chunk splitting (`react-vendor`, `supabase`, `charts`, `icons`, `qr`, `utils`). Chunk size warning threshold is 700 KB. `supabase/functions/` is excluded from the main TypeScript compilation — Edge Functions run under Deno and are type-checked separately.
