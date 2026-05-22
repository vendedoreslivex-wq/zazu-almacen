# LogixZazu — Auditoría Técnica
**Fecha:** 2026-05-21  
**Estado del proyecto:** En producción activa

---

## 1. Stack actual

| Capa | Tecnología | Versión | Estado |
|---|---|---|---|
| Frontend framework | React | 19.0.1 | Actual |
| Lenguaje | TypeScript | 5.8.2 | Actual |
| Build tool | Vite | 6.2.3 | Actual |
| Estilos | Tailwind CSS | 4.1.14 | Actual |
| Backend / DB | Supabase (PostgreSQL) | — | Managed |
| Auth | Supabase Auth | — | Managed |
| Server-side logic | Deno Edge Functions | std@0.168.0 | **Desactualizado** |
| Animaciones | motion/react | 12.23.24 | Sobredimensionado |
| Charts | recharts | 3.8.1 | Actual |
| Icons | lucide-react | 0.546.0 | Actual |
| QR generación | qrcode.react | 4.2.0 | Actual |
| QR scanner | html5-qrcode | 2.3.8 | **Sin mantenimiento** |
| Firmas | react-signature-canvas | 1.1.0-alpha.2 | **Alpha desde 2021** |
| CSV | papaparse | 5.5.3 | Actual |
| Email | nodemailer (Deno) | 6.9.13 | Funcional |

**No existe backend propio.** La app es un SPA que habla directo a Supabase. Las 2 Edge Functions son parches para operaciones que requieren service role key.

---

## 2. Archivos eliminados en esta auditoría

| Archivo / Carpeta | Motivo |
|---|---|
| `fix_appcontext.js` | Script de migración one-time, ya ejecutado |
| `fix_inventory.js` | Ídem |
| `metadata.json` | Artefacto de Google AI Studio, sin relación con el app |
| `README.md` | Instructivo de AI Studio con Gemini API — incorrecto para este proyecto |
| `img-icono/` (raíz) | Duplicado exacto de `public/img-icono/` |
| `.env.example` | Tenía keys de Gemini — corregido con keys de Supabase |

---

## 3. Dependencias eliminadas de `package.json`

| Paquete | Motivo |
|---|---|
| `@emailjs/browser` | No se importa en ningún archivo. Reemplazado por edge function |
| `@google/genai` | No se importa en ningún archivo. Quedó de un prototipo |
| `express` | Sin servidor. No existe `server.js` en el repo |
| `dotenv` | Vite maneja env vars con prefijo `VITE_`. No se necesita |
| `@types/express` | Consecuencia de `express` |
| `esbuild` | Sin servidor que bundlear |
| `tsx` | Sin servidor TypeScript que ejecutar |

---

## 4. Fallas de seguridad

### CRÍTICO — Edge function `update-user-auth` sin autenticación

Fue deployada con `--no-verify-jwt` porque la anon key (`sb_publishable_...`) no es un JWT válido. Consecuencia: **cualquier persona en internet** puede llamarla sin ningún token y modificar contraseña, rol o estado activo de cualquier usuario conociendo solo su UUID.

```bash
# Esto funciona ahora mismo sin ninguna credencial:
curl -X POST https://thywwhpwistpjxzhuodu.supabase.co/functions/v1/update-user-auth \
  -H "Content-Type: application/json" \
  -d '{"userId":"UUID-de-cualquier-usuario","role":"ADMIN_GENERAL","password":"nueva_clave"}'
```

**Solución real:** Dentro de la función, verificar que el caller tiene rol admin antes de ejecutar cualquier cambio. Extraer el JWT del header `Authorization`, decodificarlo con el Supabase JWT secret, y validar el rol del llamante.

---

### ALTA — RLS en base de datos es "authenticated = full access"

Las políticas en todas las tablas son equivalentes a:
```sql
USING (auth.role() = 'authenticated')
```

Cualquier usuario logueado puede leer, escribir y borrar datos de cualquier marca (`OVERSHARK`, `BRAVOS`, `BOX_PRIME`) y de cualquier otro usuario. Un `JEFE_ALMACEN` puede ver y modificar facturas, contactos, usuarios y stock de otras marcas haciendo requests directos a Supabase con su token.

**Solución real:** Políticas RLS que verifiquen `brand` y `role` a nivel de DB, no de frontend.

---

### ALTA — Control de roles solo en el frontend

`canEdit()` en `src/lib/permissions.ts` es código que corre en el navegador del usuario. Se puede deshabilitar en 5 segundos con DevTools. Un `JEFE_ALMACEN` puede acceder a todas las funciones de `ADMIN_GENERAL` modificando el estado de React en el browser.

---

### MEDIA — Contraseñas en texto plano en `seed.sql`

```sql
-- passwords visibles: 30092023, 945610, 191524623, 79846312
```

Si esas contraseñas se reutilizaron en otros servicios, representan un riesgo real. El archivo está en el repo.

---

### BAJA — URLs de edge functions hardcodeadas en `AppContext.tsx`

```typescript
'https://thywwhpwistpjxzhuodu.supabase.co/functions/v1/update-user-auth'
```

Deberían estar en `.env` como `VITE_SUPABASE_FUNCTIONS_URL`.

---

## 5. Fallas de código

### `AppContext.tsx` — 1309 líneas, dominio único

Un solo archivo maneja: autenticación, usuarios, productos, stock, operaciones, ajustes, contactos, órdenes de compra, permisos de roles, realtime subscriptions y envío de emails. Es la parte más frágil del proyecto: un error en cualquier función rompe todo el estado de la app, y cada cambio requiere entender el archivo completo.

### `Operations.tsx` — 1431 líneas

El archivo más largo es una página. Mezcla lógica de negocio, UI, validaciones y llamadas a DB en un solo componente.

### Sin router de URL

La navegación usa `window.dispatchEvent(new CustomEvent('navigate', ...))` — un sistema de eventos custom en lugar de React Router. Consecuencias directas:
- El botón Atrás del browser no funciona
- No se pueden compartir links a páginas específicas
- No se pueden hacer bookmarks de secciones
- Sin historial de navegación

### Sin Error Boundaries

Si cualquier componente lanza un error no capturado, toda la app muestra pantalla blanca. No hay ningún `<ErrorBoundary>` en el árbol de componentes.

### Sin tests

Cero pruebas. Unitarias, de integración, E2E — ninguna. Cambios en `AppContext.tsx` pueden romper silenciosamente cualquier página sin ninguna alerta.

---

## 6. Librerías problemáticas

### `react-signature-canvas@1.1.0-alpha.2`
Lleva **4 años en versión alpha**. No tiene release estable. El paquete `signature_pad` (en el que se basa internamente) sí tiene versiones estables y se mantiene activamente.  
**Reemplazar por:** `signature_pad` directo.

### `html5-qrcode@2.3.8`
Último commit en GitHub: **2022**. Issues abiertos sin respuesta. El ecosistema de escaneo QR en web evolucionó significativamente desde entonces.  
**Reemplazar por:** `@zxing/browser` (mantenido activamente, mejor soporte de cámaras).

### `deno.land/std@0.168.0` (edge functions)
Deno std está en v1.x. La `0.168.0` es de **2022**, con más de 2 años de desfase. Puede tener bugs corregidos en versiones posteriores.  
**Actualizar a:** `https://deno.land/std@0.224.0/http/server.ts` o migrar a `Deno.serve()` nativo.

### `motion@12.23.24`
Se usa en un solo archivo (`Layout.tsx`) para 2 animaciones de entrada. Es una librería de ~200KB para eso.  
**Considerar:** Reemplazar con transiciones CSS nativas o `@keyframes` de Tailwind.

---

## 7. Arquitectura — lo que está bien

- React 19, Vite 6, Tailwind 4, TypeScript 5.8, Supabase JS 2.106 — el core está al día
- Multi-marca con columna `brand` en todas las tablas — diseño correcto
- RPCs PL/pgSQL para operaciones atómicas de stock (`execute_transaction`, `execute_adjustment`) — evita race conditions
- Realtime subscriptions por marca — bien implementado
- Gmail SMTP a través de edge function con secrets en Supabase — las credenciales nunca tocan el frontend
- Service role key solo en secrets de Supabase, nunca en el repo

---

## 8. Prioridades de mejora

### Inmediato (seguridad activa)
1. Agregar verificación de rol dentro de `update-user-auth` — leer el JWT del header y validar que el llamante es admin antes de ejecutar

### Pronto (deuda técnica crítica)
2. Dividir `AppContext.tsx` en contextos separados por dominio (auth, inventory, operations, contacts)
3. Implementar RLS policies reales con filtros por `brand` y `role` en la DB
4. Reemplazar `html5-qrcode` por `@zxing/browser`
5. Reemplazar `react-signature-canvas` por `signature_pad`

### Cuando haya capacidad
6. Agregar React Router para navegación real con URLs
7. Agregar al menos 1 `<ErrorBoundary>` global
8. Mover URLs de edge functions a `.env`
9. Actualizar `deno.land/std` en edge functions
10. Evaluar si `motion` justifica su peso (200KB) para 2 animaciones
