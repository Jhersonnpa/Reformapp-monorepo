# AGENTS.md — reformapp-monorepo

## Layout (don't reorganize)

- `apps/api` — Hono backend (entry `src/index.ts`, routes in `src/routes/`, `createApp(store)` in `src/app.ts`).
- `apps/mobile` — rebuild Expo Router SDK 57 (Fase 2 lista: api client con refresh single-flight, auth store, guard, sign-in/sign-up con `@reformapp/shared`, tabs Inicio/Solicitar/Trabajos/Perfil con iconos Ionicons). UI sin NativeWind (StyleSheet + tokens): `components/Toast.tsx` (avisos tras cada acción, host en `app/_layout.tsx`), `SelectSheet.tsx` (hoja inferior con buscador; la usa la categoría en Solicitar), `AutocompleteInput.tsx` + `FormAutocomplete.tsx` (sugerencias mientras escribes; provincia con las 52 de `lib/provinces.ts`, tolera tildes), `Feedback.tsx` (`ErrorBanner`, `EmptyState`, `SuggestionChips` de disponibilidad). Barra de estado explícita por pantalla (RN `StatusBar` opaca: clara sobre fondo claro, blanca sobre hero azul edge-to-edge en Inicio/Trabajos) — nunca automática/translúcida. Corre con `pnpm --filter reformapp-mobile start` (LAN; reiniciar Metro tras añadir dependencias). `.env` gitignored con `EXPO_PUBLIC_API_URL` (actual `http://192.168.0.11:3000`).
- `packages/shared` — zod schemas + `Role` + `User`. Source of truth for auth contracts; both sides import it.
- `legacy/` — old Expo app (SDK 57, own `package-lock.json`, reference + current LAN test vehicle). See `legacy/docs/ai-context.md §6` for what NOT to replicate. `legacy/README-LOCAL.md` is the 10-line LAN runbook.
- Sibling `Dev/clima-pro-backend/` and empty `Dev/Reformapp/` husk are NOT this repo. Don't touch.

## Package managers (never mix)

- Monorepo: **pnpm** (`packageManager pnpm@12.11.2`). After fresh clone, `pnpm install` fails on blocked build scripts → run `pnpm approve-builds esbuild` first.
- `legacy/`: **npm** only.

## Commands

```bash
pnpm install                                   # root; heals workspace links
pnpm --filter @reformapp/shared build          # emits dist/ — REQUIRED before api typecheck passes
pnpm --filter @reformapp/api typecheck | lint | test
pnpm --filter @reformapp/shared test
npm run build                                  # root turbo build (must pass); api build script needs --declarationMap false (base tsconfig sets declarationMap)
```

Verify in order: `typecheck → lint → test`. Single API test file: `apps/api/tests/auth.test.ts` (in-memory store, no DB needed).

## Backend + Neon (proyecto shy-block-06815329; local en rama `dev`, prod en `production`)

- Flujo branch-first: se prueba y desarrolla en `dev`; `production` no se toca. Cambiar: `neon checkout <rama>` (reescribe `.neon` + `.env.local`). Ramas nuevas no-default heredan de `neon.ts`: TTL 7d + compute barato (0.25–1 CU, suspend 5m).
- Diagnósticos read-only preferidos antes que SQL a mano: `neon inspect db <check>` (`table-sizes`, `unused-indexes`, …). Requieren extensiones algunas (`pg_stat_statements`, `neon`); preguntar antes de `CREATE EXTENSION`.
- Egress: `DrizzleStore.findUserById` selecciona columnas explícitas SIN `passwordHash` (la vía de login `findUserByEmail` sí lo trae para bcrypt). No añadir `SELECT *` ni endpoints de listado sin paginación.
- La primera conexión tras idle es lenta (scale-to-zero despierta el compute; puede tardar minutos). No confundir con un cuelgue.

- Env: `apps/api/src/env.ts` loads root `.env.local` (Neon-managed via `neon deploy`) > root `.env` > `apps/api/.env`, resolved from workspace root so `pnpm --filter` works. Real process env always wins.
- `DATABASE_URL` (pooled) = app traffic via `DrizzleStore`; `DATABASE_URL_UNPOOLED` (else fallback) = `db:migrate`/`db:seed`. No `DATABASE_URL` → `MemoryStore` (tests, offline dev).
- `neon deploy` needs browser auth when credentials are missing; it pulls vars into root `.env.local`, never prints secrets.
- Auth contract: signUp forces `CLIENT` server-side (body `role` ignored); access JWT 15m, refresh 30d rotating sha256; rate-limit is per **path+IP** (5/min signIn/signUp, 30/min refresh/logout — refresh/logout traffic must NOT share the signIn bucket). There is intentionally NO `GET /users` (unpaginated listing was removed as debt); debug probes use `GET /users/me`.
- Requests (Fase 3): `POST /requests` (zod `requestCreateSchema`, status forced `OPEN`), `GET /requests?limit&offset` (own only, newest first, `{requests, hasMore}` via limit+1 — no COUNT), `GET /requests/:id` (own, 404 otherwise), `POST /requests/:id/cancel` (OPEN→CANCELLED, else 409). Auth required; rate-limit 30/min on `/requests`, 60/min on `/requests/*`.
- Tech flow: statuses `OPEN→ACCEPTED→DONE` (+`CANCELLED` client-only while OPEN); `GET /requests/open?province=` (TECH/ADMIN, pool serializer WITHOUT address/userId, with `applicationCount`), `GET /requests/assigned` (mine), `GET /requests/open/:id` (pool view + `applied`), `GET /requests/assigned/:id` (full + `{client:{firstName,phone}}`), `POST /:id/apply` (TECH postulation, 409 OWN/NOT_OPEN/DUPLICATE), `GET /:id/applications` (owner: candidates `{techId,firstName,username,avg,count}` WITHOUT phone; tech: only `{applied,applicationCount}`), `POST /:id/choose {techId}` (owner picks an applicant → ACCEPTED), `POST /:id/accept` returns 410 for TECH (only ADMIN backoffice), `POST /:id/complete` (accepter or admin). Client detail includes `technician:{firstName,phone}` once assigned. Static tech paths are registered BEFORE `/:id`. Mobile tabs are role-based (`request` client-only, `jobs` tech-only, with in-screen `Redirect` guards too).
- Photos (R2 privado + presigned): tabla `request_photos` (FK cascade, `object_key` único); flujo presign→PUT directo→confirm (`POST /:id/photos/presign {contentType,count≤5}` → `PUT {url}` con el MISMO Content-Type firmado → `POST /:id/photos {keys}`). Máx 10 por solicitud; pool/listas solo `photoCount` (detalle con `photos[].url` GET 1h). Sin env R2 → presign 501. Env en `apps/api/.env` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) — nunca en `.env.local` (lo gestiona `neon deploy`).
- Coste cero R2 (auditado 2026-10-17, verificado sin bucles infinitos): presign valida `count` 1..5 y rechaza 409 si `existentes+count>10`; confirm valida 1..5 claves con regex de prefijo `requests/{id}/` y el mismo tope (doble barrera); `addRequestPhotos` usa `onConflictDoNothing` (re-confirmar no duplica); el móvil sube en un solo intento secuencial SIN reintentos automáticos (si un PUT falla, aborta con error visible); optimización en cliente (1280px máx, JPEG q0.7, convierte HEIC) recorta ~80-90% por foto; el PUT usa upload nativo `expo-file-system` (fetch+Blob truncaba el cuerpo); sin `setInterval`/polling en código propio (los únicos `Reintentar` son botones manuales de listas GET, sin escrituras R2); rate-limit por ruta+IP (60/min en `/requests/*`, 30/min en `/requests`); el token R2 debe vivir acotado a UN bucket con solo Object Read+Write (sin ListBuckets ni admin). Techo por solicitud: 10 objetos (~5 MB) → cuota gratis (10 GB, 1M clase A) da para ~2000 solicitudes/mes a tope.
- Valoraciones: tabla `ratings` (1 por `request_id` UNIQUE, score 1-5 CHECK); `POST /requests/:id/rating` (dueño, DONE con técnico, 409 duplicada/no-terminada), `GET /:id/rating` (dueño o técnico con acceso), `GET /users/me/rating-stats` (media redondeada a 1 decimal + conteo); detalle cliente y asignado incluyen `rating`.
- Push (coste cero vía Expo Push API, sin dependencias): `push_tokens` (1 por usuario, migración `0007`); `POST/DELETE /users/me/push-token`; avisos best-effort al postularse (cliente), al elegir (técnico) y al terminar (cliente, pide valorar). Se desactiva con `PUSH_ENABLED=0` (tests). Móvil: `services/push-service.ts` (permiso + canal Android + registro), alta al entrar, baja al salir, toast en primer plano y navegación al detalle al tocar. OJO: el push remoto NO funciona en Expo Go (SDK 53+, ni siquiera lo intenta: `isPushSupported()` mira `appOwnership`); para probarlo hace falta development build (`npx expo run:android` con Android SDK + USB).
- Chat del trabajo (migración `0008`, tabla `messages` máx 1000 caracteres): `GET /requests/:id/messages` (dueño o asignado, en ACCEPTED lee y escribe, en DONE solo lee; 409 en OPEN), `POST` igual pero solo ACCEPTED; push genérico a la otra parte. Móvil `components/ChatBox.tsx` (burbujas, pull-to-refresh, sin polling).
- Migrations are hand-written idempotent SQL (`drizzle/0001_init.sql` pattern: `IF NOT EXISTS`); `drizzle-kit generate` emits a full baseline that must NOT be applied as-is — delete it and hand-write the delta.
- Demo seed: `client@reformapp.dev` / `Client123!`, `tech@reformapp.dev` / `Tech123!`.

## LAN testing with Expo Go (legacy/)

- `legacy/.env` `EXPO_PUBLIC_API_URL` must be the **real LAN IP** (currently `http://192.168.0.11:3000`). `192.168.56.1` is VirtualBox host-only — unreachable from phones. Verify phone WiFi IP is same subnet (`192.168.0.x`).
- Env vars bake into the bundle: restart Metro after any `.env` change.
- Backend `serve` uses `hostname: "0.0.0.0"` — required for LAN. Windows needs inbound firewall TCP 3000+8081 (admin).
- `npm run check-local` (in `legacy/`, zero deps): prints IPs, fetches `${API_URL}/health`, exit 1 when backend down.
- Expo Go SDK must match project SDK (57). After dep changes run `npx expo-doctor` (21/21 expected) and `npx expo install --fix`; `@types/react` must satisfy RN's peer (`~19.1.0`).

## Windows / shell gotchas (PowerShell 5.1)

- `Invoke-RestMethod` has NO `-StatusCodeVariable`; for e2e HTTP flows write a temp Node script using global `fetch` (never print tokens/secrets).
- Start dev servers detached via `Start-Process` (`pnpm.cmd --filter @reformapp/api dev`, `npx.cmd expo start --lan`); check `:3000/health` and `:8081/status`.
- `Get-ChildItem -Recurse` over `node_modules` hits MAX_PATH/long-path errors and is slow — scope searches to source dirs and exclude `node_modules`.
- Never move/delete `node_modules` with `Move-Item`/`Remove-Item -Recurse`; use `npx rimraf`.
- Never hardcode IPs/`localhost` in mobile `.ts/.tsx` (only `.env` config). `no-console` is enforced (eslint) except CLI boot logs with disable comments.
