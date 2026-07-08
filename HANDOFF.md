# HANDOFF.md

Guía de arquitectura y contexto del proyecto **LogixZazu** para quien retome el trabajo (humano o agente).

## Comandos

```bash
npm run dev        # Dev server en puerto 3000
npm run build      # Build de producción (Vite)
npm run lint       # Type-check de TypeScript (tsc --noEmit)
npm run test       # Corre tests una vez (Vitest)
npm run test:watch # Tests en modo watch
```

## Stack

React 19 + TypeScript + Vite (SPA), `HashRouter`, Tailwind CSS v4, Supabase, Recharts.

## Arquitectura

### Estado global

Todo el estado de la aplicación vive en `src/store/AppContext.tsx` (708 líneas) vía React Context. Contiene: productos, ubicaciones, niveles de stock, transacciones, contactos, usuarios, órdenes de compra, ajustes de inventario, reservas, permisos por rol y logs de auditoría. Todas las páginas consumen este contexto — no hay Redux, Zustand ni otro store.

`src/store/mappers.ts` convierte filas crudas de Supabase a los tipos de TypeScript definidos en `src/types.ts`.

Las actualizaciones en tiempo real llegan por suscripciones Postgres LISTEN de Supabase (`supabase.channel('brand_' + activeBrand)`, una por tabla) más un polling silencioso de respaldo cada 5 segundos. Todos los datos están filtrados por la marca activa (`OVERSHARK | BRAVOS | BOX_PRIME`), guardada en el contexto y usada como filtro en cada consulta.

### Diseño multi-marca

Cada tabla de la BD tiene una columna `brand`. La marca activa se selecciona en el sidebar (`src/components/Layout.tsx`) y fluye por `AppContext` hacia todas las queries y escrituras. Cambiar de marca recarga los datos de esa marca.

### Permisos (`src/lib/permissions.ts`)

Control de acceso basado en roles. Cinco roles (`src/types.ts` → `Role`):

- `ADMIN_GENERAL`
- `CEO`
- `ADMINISTRADOR`
- `JEFE_ALMACEN`
- `DESPACHADOR`

`canView()` (usado en `visibleNav` de Layout) y `canEdit()` controlan el acceso a cada módulo, con tres niveles: `'none' | 'view' | 'full'`. Los permisos por rol están en `DEFAULT_ROLE_PERMISSIONS` y también se guardan en la tabla `role_permissions`, cargándose al contexto al iniciar sesión (pueden diferir de los defaults si se editaron desde el módulo Usuarios).

Módulos actualmente controlados por permiso (claves usadas como `id` de ruta/nav): `dashboard`, `analysis`, `inventory`, `locations`, `operations`, `adjustments`, `purchase-orders`, `history`, `contacts`, `reports`, `labels`, `warehouse-map`, `users`, `operation-history`, `reservations`, `odoo-stock`, `warehouse-sim`.

`DESPACHADOR` está restringido a solo crear requerimientos dentro de `purchase-orders` (ver commit `feat(despachador)`).

### Supabase

- **Auth**: basada en sesión. Los usuarios inactivos son expulsados por política RLS.
- **DB**: acceso directo a tablas vía JS SDK (`src/lib/supabase.ts`).
- **Edge Functions** (`supabase/functions/`):
  - `odoo-stock` — proxy XML-RPC hacia Odoo (evita CORS del navegador)
  - `send-email` — notificaciones de operaciones por correo
  - `update-user-auth` — crear/actualizar/eliminar usuarios de Supabase Auth
- **Migrations** (`supabase/migrations/`): schema base, RLS, RPCs, y migraciones incrementales (`migration_audit_log`, `migration_dispatch_requirement`, `migration_notifications`, `migration_reception_no_stock`, `migration_reservations`, `migration_rpcs`, `migration_schema_polish`, `migration_storage`).

### Escritura de transacciones

Las transacciones nuevas deben pasar por el RPC `execute_transaction` de Supabase — nunca insertar directamente en la tabla `transactions`. El RPC actualiza los niveles de stock de forma atómica. Cancelar usa el RPC `cancel_transaction` (revierte el stock). Un `UPDATE` directo sobre `transactions` solo es aceptable para campos de metadata: `reference`, `contact_id`, `date`.

### Integración con Odoo

`src/lib/odooService.ts` expone `fetchOdooAll()` y helpers por recurso. Llaman a la Edge Function de Supabase, que habla XML-RPC con `https://zazuexpress2.odoo.com`. Las credenciales (URL, DB, usuario, API key) viven en Supabase secrets — los valores hardcodeados como fallback en `supabase/functions/odoo-stock/index.ts` deberían moverse a secrets para producción.

`src/pages/OdooStock.tsx` es de solo lectura: carga datos de Odoo, construye un `attrMap` para lookup O(1) de atributos por variante, y clasifica atributos como color o talla vía regex. Los filtros usan comparaciones `.trim()` para evitar desalineces por espacios en blanco.

### Routing

React Router v7 con `HashRouter`. Las rutas están definidas en `src/App.tsx`. El sidebar en `src/components/Layout.tsx` (array `navItems`) controla orden y visibilidad de los módulos — el orden del array define el número de índice (`num`) mostrado junto al ícono, no el orden de declaración de rutas en `App.tsx`.

### Build

Vite con manual chunk splitting (`react-vendor`, `supabase`, `charts`, `icons`, `qr`, `utils`). El umbral de warning de tamaño de chunk es 700 KB. `supabase/functions/` está excluido de la compilación TypeScript principal — las Edge Functions corren bajo Deno y se type-checkean por separado.

## Convenciones críticas

### Manejo de fechas (timezone)

`Transaction.date` es `timestamptz`, almacenado en UTC por Supabase. La app corre en Perú (UTC-5). **Nunca usar `new Date('YYYY-MM-DD')` directamente** — se parsea como medianoche UTC y se renderiza como el día anterior en hora local. Siempre:

- **Parsear para mostrar**: `new Date('YYYY-MM-DD' + 'T00:00:00')` (fuerza medianoche local) o `date-fns/parseISO` + `addMinutes(offset)`.
- **Comparar contra valores de `<input type="date">`**: recortar el string ISO — `tx.date.slice(0, 10)` da `YYYY-MM-DD` en UTC, seguro para comparación de strings con inputs de fecha.
- **Guardar en BD**: usar `'YYYY-MM-DDT12:00:00Z'` (mediodía UTC) para que la fecha calendario sea correcta en cualquier zona horaria americana.

### Generación de PDF (Reports.tsx)

Reports usa `jsPDF` + `jspdf-autotable`. Hay dos flujos de PDF:

1. **Reportes estándar** — `exportPDF()` con `drawHeader()` / `drawFooter()`.
2. **PDF Entrega** (`exportPDFEntrega`) — modal separado (`showEntregaModal`) con su propio estado de rango de fechas (`entregaDateFrom`, `entregaDateTo`), independiente de los filtros globales del reporte (`dateFrom`, `dateTo`). La tabla pivote se construye a partir de transacciones `RECEPTION` filtradas, no de `inventoryRows`. Header/footer usan `drawEntregaHeader()` / `drawEntregaFooter()` sin rellenos de color (friendly para impresión).

Ruta del logo: `/Zazu/zazu-logo/zazu-dark mode.png` (ojo con el espacio en el nombre de archivo). Se obtiene como blob → base64 antes de `pdf.addImage()`.

### Orden de tallas de ropa

`src/pages/Reports.tsx` define `SIZE_ORDER` y `sizeRank()` para ordenar tallas (`XS → S → M → L → XL → XXL → XXXL → TALLA UNICA → S/T`). Usar esto siempre que se muestren columnas de talla en reportes o tablas.

## Módulos (páginas)

Todas en `src/pages/`. Mapeo id de permiso → archivo → ruta:

| id permiso | archivo | ruta |
|---|---|---|
| dashboard | Dashboard.tsx | /dashboard |
| analysis | Analysis.tsx | /analysis |
| inventory | Inventory.tsx | /inventory |
| locations | Locations.tsx | /locations |
| operations | Operations.tsx | /operations |
| history | History.tsx | /history |
| contacts | Contacts.tsx | /contacts |
| users | Users.tsx | /users |
| purchase-orders | PurchaseOrders.tsx | /purchase-orders |
| adjustments | Adjustments.tsx | /adjustments |
| reports | Reports.tsx | /reports |
| labels | Labels.tsx | /labels |
| warehouse-map | WarehouseMap.tsx | /warehouse-map |
| operation-history | OperationHistory.tsx | /operation-history |
| reservations | Reservations.tsx | /reservations |
| odoo-stock | OdooStock.tsx | /odoo-stock |
| warehouse-sim | WarehouseSim.tsx | /warehouse-sim |

`Login.tsx`, `PendingAccess.tsx` y `ResetPassword.tsx` no están sujetas a permisos (se muestran fuera del flujo autenticado normal de `AppShell`).

### WarehouseSim (`src/pages/WarehouseSim.tsx`) — nuevo, sin commitear

Módulo de **simulación visual** de flujo de almacén, autocontenido (no toca Supabase ni datos reales). Sirve para demo/entrenamiento del flujo operativo.

- Mapa SVG con 5 zonas: `supplier → reception → reserve → dispatch → client`, conectadas por 4 rutas de operación (`RECEPCION`, `A_RESERVAS`, `REQUERIMIENTO`, `DESPACHO`), cada una con su color.
- Genera "paquetes" (operaciones) aleatorios que viajan por curvas bezier entre zonas, con velocidad configurable (0.5×–3×).
- Cada ~2 min (`CONFIRM_INTERVAL`, ajustado por velocidad) se abre un modal de confirmación de lote con 30s de ventana (`CONFIRM_WINDOW`); si expira, el lote se rechaza automáticamente.
- KPIs: operaciones totales, en tránsito, confirmados, rechazados, eficiencia (%).
- Panel de alertas y log de operaciones (últimas 60 entradas).
- Motor de animación vía `requestAnimationFrame`, sin librerías externas de animación.

Integración ya cableada: ruta en `App.tsx`, ítem de nav "SIMULACIÓN" (ícono `Activity`) en `Layout.tsx`, y permiso `warehouse-sim` en los 5 roles (`full` para `ADMIN_GENERAL`/`CEO`, `none` para el resto). Pendiente de decidir: si `ADMINISTRADOR` debería tener `full` en vez de `none`, dado que tiene `full` en casi todo lo demás.

## Testing

Vitest + jsdom. Tests existentes: `src/lib/permissions.test.ts`, `src/store/mappers.test.ts`. No hay tests de componentes/UI todavía — solo lógica pura (permisos y mappers).

## Variables de entorno

Ver `.env.example` para las claves esperadas (Supabase URL/anon key, etc.). No commitear `.env` real.
