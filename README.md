# Reformapp — Monorepo coste 0€

Marketplace clientes ↔ técnicos de reformas. Rebuild desde cero (legacy preservado en `legacy/` como referencia, NO se replica tal cual — ver `legacy/docs/ai-context.md §6`).

## Estructura

```
apps/api        Hono + Drizzle + Postgres (Neon Free) + R2 presigned. Sin Redis.
apps/mobile     Expo SDK 53 + expo-router + NativeWind + Zustand(auth) + TanStack Query + RHF+zod (Paso 2)
packages/shared Role + schemas zod signIn/signUp + tipos User (fuente única)
```

## Requisitos

Node 20+, pnpm 9+, cuenta Neon Free + R2 Free (solo prod/dev real; tests usan memoria).

## Instalación

```bash
pnpm install
cp .env.example .env            # raíz (referencia)
cp apps/api/.env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Edita EXPO_PUBLIC_API_URL con tu túnel o dominio (nunca IP hardcodeada en código)
```

## DB (Neon Free)

```bash
# 1. Crea proyecto en Neon, pega DATABASE_URL en apps/api/.env
pnpm --filter @reformapp/api db:migrate   # aplica drizzle/*.sql
pnpm --filter @reformapp/api db:seed      # crea 1 client + 1 tech
```

Cuentas demo:

| email | password | rol |
|---|---|---|
| `client@reformapp.dev` | `Client123!` | CLIENT |
| `tech@reformapp.dev` | `Tech123!` | TECH |

## Dev

```bash
pnpm --filter @reformapp/api dev        # API :3000
pnpm --filter reformapp-mobile start    # Expo tunnel (Paso 2)
```

## Verificación

```bash
pnpm -r typecheck && pnpm -r lint && pnpm -r test
```

Sin URLs hardcodeadas en mobile:

```bash
grep -r "192.168\|localhost:3000" apps/mobile || echo "OK: sin hardcode"
```

## Contratos API

- `GET /health` → `{ok:true}`
- `POST /auth/signUp {email,password,username,firstName,lastName,phone,province,locality,address}` → `201 {user}` (rol siempre CLIENT server-side)
- `POST /auth/signIn {email,password}` + `X-Client-Type: mobile` → `201 {accessToken 15min, refreshToken 30d}`
- `POST /auth/refresh {refreshToken}` → `200` par nuevo (rotativo, viejo invalidado)
- `POST /auth/logout {refreshToken}` → `200`
- `GET /users/me` Bearer → `200 {user}`

## Qué queda (Fase 3+)

Paso 2 mobile (api client + refresh queue, auth store, guard, sign-in/sign-up, tabs, perfil) y Fase 3 solicitudes con fotos WebP 1280px + R2 presigned.
