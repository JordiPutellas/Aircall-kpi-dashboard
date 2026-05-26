# PROYECTO: Aircall KPIs Dashboard — Contexto completo

Eres un asistente técnico ayudándome a continuar un proyecto personal que ya
está parcialmente construido y funcionando en producción. Lee este documento
entero antes de proponer nada. No reinventes lo que ya está hecho. Pregunta
si algo no está claro en lugar de asumir.

---

## 1. Objetivo del proyecto

Construir un dashboard analítico **alternativo a Aircall Analytics+** (módulo
de pago) que permita obtener métricas de agentes y llamadas de un call center
montado sobre Aircall. La motivación es replicar las funcionalidades de
Monitoring+ sin pagar el add-on.

**Datos que el sistema debe poder responder:**

- Estados de agente (available, unavailable, after_call_work) por hora/jornada
- Desglose de pausas por motivo (on_a_break, out_for_lunch, doing_back_office, in_training, other)
- Login/logout y duración de jornada efectiva
- Llamadas perdidas (volumen, motivo, hora)
- AHT (Average Handle Time), ocupación, tasa de atención
- Timeline detallada por agente

**Lo que NO necesita el sistema (por ahora):**

- Tiempo real puro (hay ~10s de latencia esperada)
- Datos históricos previos al despliegue del webhook
- Métricas pre-agregadas estilo Aircall (las computamos nosotros)

---

## 2. Arquitectura desplegada

```
Aircall webhooks ──► Cloudflare Worker ──► Neon Postgres
                          │                     │
                          │                     ├─ events_raw (datos crudos)
                     Cron 10min                 ├─ agent_status_intervals
                          │                     └─ calls
                          ▼
                  Aircall Public API
                  (GET /v1/users/availabilities)
                  para reconciliación
```

**Stack:**

- **Cloudflare Workers** (TypeScript) — ingesta de webhooks + cron de reconciliación + transformación
- **Neon Postgres** (free tier, pooled connection en eu-central-1) — almacenamiento
- **GitHub** — repo: nombre `aircall-kpis-dashboard`
- **Vercel + Next.js** — el dashboard (esto es lo que toca construir AHORA, no existe aún)

**URLs y endpoints:**

- Worker desplegado: `https://aircall-kpis-worker.aircall-kpis.workers.dev`
- Endpoint del webhook: `https://aircall-kpis-worker.aircall-kpis.workers.dev/aircall/webhook`
- Webhook configurado en Aircall Dashboard con todos los eventos `user.*` (V1 y V2) y `call.*` activos.

**Secrets en Cloudflare Workers (configurados con `wrangler secret put`):**

- `DATABASE_URL` — connection string pooled de Neon (host `*-pooler.*`)
- `AIRCALL_WEBHOOK_TOKEN` — token único generado por Aircall al crear el webhook
- `AIRCALL_API_ID` — id de la Public API de Aircall
- `AIRCALL_API_TOKEN` — token de la Public API de Aircall (Basic Auth)

---

## 3. Estado actual: qué está hecho y funcionando

### Fase 1 — Ingesta de webhooks ✅

- Worker recibe POST de Aircall en `/aircall/webhook`
- Valida `body.token` contra `AIRCALL_WEBHOOK_TOKEN` con comparación en tiempo constante
- Usa `ctx.waitUntil()` (importante: sin esto las Promises se mueren en Workers)
- Inserta el payload crudo en `events_raw` (estructura abajo)

### Fase 2.1 — Cron de reconciliación ✅

- Cron Trigger cada 10 min (`*/10 * * * *`)
- Llama a `GET /v1/users/availabilities` de Aircall paginando
- Compara estado actual de cada usuario contra el último estado conocido en BBDD
- Inserta evento sintético `reconciliation.status_drift` si detecta divergencias
- **Importante**: las vocabularias son distintas y se normalizan antes de comparar:
  - Webhooks user.\* usan `availability_status`: "available" / "unavailable"
  - Endpoint usa `availability`: "available" / "offline" / "do_not_disturb" / "in_call" / "after_call_work"
  - Normalización: solo `available` → `available`, todo lo demás → `unavailable`

### Fase 2.2 — Tablas derivadas ✅

- `transform_events()` (función PL/pgSQL en Neon) se ejecuta también desde el cron tras la reconciliación
- Materializa `agent_status_intervals` desde eventos `user.*` y `reconciliation.*`
- Materializa `calls` desde eventos `call.*`
- Idempotente vía `ON CONFLICT DO NOTHING` + UPDATE para cerrar intervalos abiertos
- Usa `MIN(...) OVER (... GROUPS BETWEEN 1 FOLLOWING ...)` para manejar eventos en el mismo segundo

### Fase 2.3a — Queryset analítico validado ✅

- Archivo `queries/analytics.sql` con 10 queries documentadas
- View `v_users` que resuelve user_id → name desde el payload de eventos
- Queries validadas contra datos reales: hay datos coherentes para estados, pausas, llamadas perdidas, etc.

---

## 4. Fase 2.3b — Dashboard en Next.js + Vercel (CONSTRUIDO)

**Decisión tomada:** dashboard custom en Next.js desplegado en Vercel (free tier).
Razones: cero coste, control total sobre la UX, oportunidad de aprender Next/React,
y porque las queries SQL ya están listas para consumirse desde la app.

**Estado actual (ya construido y en producción):**

- App Next.js en `dashboard/` (App Router, Next 16, React 19, Tailwind v4, Recharts)
- Conexión server-side a Neon vía `@neondatabase/serverless` en `dashboard/lib/db.ts`
- Auth básica por contraseña (middleware + cookie de sesión)
- Páginas: Wallboard (`/`), Overview, Pausas, Timeline, Login
- Desplegado en Vercel conectado al repo

**Requisitos para el dashboard:**

- Conexión segura a Neon desde server-side (no exponer `DATABASE_URL` al cliente)
- Páginas/secciones para las queries clave del `analytics.sql`
- Visualizaciones: tablas, gráficos de barras, timelines, donuts para breakdown
- Filtros por fecha/agente
- Refresco automático razonable (cada minuto está bien, no necesitamos polling en vivo)
- Diseño limpio, mobile-friendly opcional pero deseable
- Auth básica para no exponerlo público (puede ser un middleware con un password sencillo o magic link via email)

**Recomendaciones técnicas:**

- Next.js 14+ con App Router
- Conexión a Neon vía `@neondatabase/serverless` (mismo driver que el Worker)
- Server Components / Server Actions para queries a BBDD
- TailwindCSS para estilos
- Recharts o Tremor para gráficos (Tremor da componentes ya pensados para dashboards)
- Deploy en Vercel conectado al repo de GitHub

---

## 5. Esquema de la BBDD (referencia)

### `events_raw` (fuente de verdad, inmutable)

```sql
id            BIGSERIAL PRIMARY KEY
event_type    TEXT NOT NULL
user_id       BIGINT
occurred_at   TIMESTAMPTZ NOT NULL
payload       JSONB NOT NULL
received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
```

Índices: `user_id` (parcial WHERE NOT NULL), `occurred_at DESC`, `event_type`.

### `agent_status_intervals` (derivada)

```sql
id            BIGSERIAL PRIMARY KEY
user_id       BIGINT NOT NULL
status        TEXT NOT NULL          -- 'available' | 'unavailable' | 'after_call_work'
substatus     TEXT                   -- 'on_a_break', 'out_for_lunch', 'doing_back_office',
                                     --   'in_training', 'other', 'always_opened',
                                     --   'always_closed', null
started_at    TIMESTAMPTZ NOT NULL
ended_at      TIMESTAMPTZ            -- null = intervalo abierto (estado actual)
duration_s    INTEGER GENERATED ALWAYS AS
                (EXTRACT(EPOCH FROM (ended_at - started_at))::integer) STORED
UNIQUE (user_id, started_at)
```

Índices: `user_id`, `started_at DESC`, `(user_id, started_at DESC)`.

### `calls` (derivada)

```sql
id            BIGSERIAL PRIMARY KEY
call_id       BIGINT UNIQUE NOT NULL
agent_id      BIGINT
direction     TEXT                   -- 'inbound' | 'outbound'
started_at    TIMESTAMPTZ
answered_at   TIMESTAMPTZ
ended_at      TIMESTAMPTZ
duration_s    INTEGER
missed_reason TEXT                   -- 'short_abandoned', 'agents_did_not_answer',
                                     --   'out_of_opening_hours', 'no_available_agent',
                                     --   'abandoned_in_classic', 'abandoned_in_ivr', null
number_id     BIGINT
raw_payload   JSONB
```

Índices: `agent_id`, `started_at DESC`, `missed_reason` (parcial WHERE NOT NULL).

### View `v_users` (helper para nombres)

```sql
CREATE OR REPLACE VIEW v_users AS
SELECT DISTINCT ON (user_id)
  user_id,
  payload->'data'->>'name'  AS name,
  payload->'data'->>'email' AS email
FROM events_raw
WHERE event_type LIKE 'user.%' AND user_id IS NOT NULL
ORDER BY user_id, occurred_at DESC;
```

---

## 6. Estructura del repo actual

```
aircall-kpis-dashboard/
├── README.md
├── DEPLOY.md
├── .gitignore                # incluye .dev.vars, .env*, node_modules
├── worker/                   # Cloudflare Worker
│   ├── src/index.ts          # ingesta + cron + transform
│   ├── wrangler.toml         # config CF + cron triggers
│   ├── package.json
│   ├── tsconfig.json
│   ├── .dev.vars             # secrets locales (NO en git)
│   └── .dev.vars.example     # plantilla
├── migrations/
│   ├── 001_create_events_raw.sql
│   ├── 002_derived_tables.sql
│   └── 003_transform_function.sql
├── queries/
│   └── analytics.sql         # queryset analítico (10 queries + view)
└── scripts/
    ├── test-webhook.sh       # smoke test ingesta
    └── test-cron.sh          # dispara el scheduled handler en dev
```

**Lo nuevo que hay que crear** para la fase 2.3b:

```
└── dashboard/                # Next.js app (a crear)
    ├── app/
    ├── components/
    ├── lib/db.ts             # conexión Neon
    ├── package.json
    └── ...
```

---

## 7. Queries clave (ya escritas en `queries/analytics.sql`)

Las 10 queries cubren:

1. Estado actual de cada agente (intervalos abiertos)
2. Tiempo por estado por agente — hoy (con clipping de ventana)
3. Desglose de pausas por motivo — hoy
4. Jornada efectiva (primer login, último logout)
5. Llamadas perdidas por hora — hoy
6. Llamadas perdidas por motivo — últimos 7 días
7. Ocupación por agente — hoy
8. AHT por agente — últimos 7 días
9. Top de pausas más largas — últimos 7 días
10. Timeline detallada de un agente (parametrizable)

**Patrón típico para clipping de ventana** (importante para agregaciones por día/hora):

```sql
LEAST(COALESCE(i.ended_at, now()), v.fin)
- GREATEST(i.started_at, v.inicio)
```

**Filtro para "pausas reales"** (excluye estados por defecto):

```sql
WHERE status = 'unavailable'
  AND substatus NOT IN ('always_opened', 'always_closed')
```

---

## 8. Decisiones de producto pendientes para el dashboard

Cosas que cuando estemos construyendo el dashboard hay que decidir conmigo:

1. **¿Auth?** ¿Solo tú, o también para compañeros del equipo? Opciones: middleware con password, magic link via Resend, OAuth con Google.
2. **¿Quiero filtros por equipo de agentes o solo por agente individual?** Aircall tiene concepto de "team" pero no lo estamos capturando todavía.
3. **¿Vista por defecto al entrar?** Wallboard tiempo real vs. resumen del día vs. tabla agentes con KPIs.
4. **¿Soporte mobile?** Para mirarlo desde el móvil cuando no estoy en el ordenador.
5. **¿Filtrar la cuenta "Preventa Team"?** Es una cuenta compartida del equipo, no un agente individual, y distorsiona algunas métricas.

---

## 9. Aspectos operativos / detalles que importan

- **Latencia**: hay 2-3s entre el evento real en Aircall y el INSERT en `events_raw`. La transformación corre cada 10 min, así que las tablas derivadas tienen ese desfase máximo. Para el dashboard es aceptable.
- **Rate limiting**: Aircall Public API permite 120 req/min. El cron usa muy poco (1 req cada 10 min en general, hasta varias páginas si hay >50 usuarios).
- **Backfill**: las llamadas anteriores al despliegue del webhook tienen huecos (sin `started_at`). No hay forma de recuperar histórico.
- **Eventos perdidos**: si el Worker o Neon caen, el cron de reconciliación detectará drift y corregirá. Pero los eventos transitorios intermedios se pierden.
- **Idempotencia**: `transform_events()` se puede ejecutar las veces que sea sin duplicar datos. Si necesitas regenerar todo: `TRUNCATE agent_status_intervals, calls RESTART IDENTITY;` + `SELECT transform_events();`.
- **Conexión a Neon desde Vercel**: usar siempre la URL **pooled** (con `-pooler` en el host). La no-pooled puede dar timeouts en serverless functions.

---

## 10. Lecciones aprendidas / gotchas del proyecto

Cosas que me costaron tiempo y conviene no repetir:

- **Cloudflare Workers mata las Promises huérfanas**: hay que usar `ctx.waitUntil()` explícitamente, no fabricar un ctx falso.
- **Aircall webhooks user.\* tienen el `id` en `data.id`** (no `data.user_id`), porque `data` ES el objeto User. En cambio, en eventos `call.\*` el user está anidado en `data.user.id`.
- **Vocabularios distintos entre webhook y endpoint** (ver punto 3, Fase 2.1).
- **Eventos en el mismo segundo**: `LEAD(occurred_at)` devuelve el mismo timestamp si hay empate. Usar `MIN(...) OVER (... GROUPS BETWEEN 1 FOLLOWING ...)`.
- **`missed_call_reason`** es el campo en payload, no `missed_reason` (este último es solo el nombre de columna en `calls`).
- **Sustatuses por defecto**: `always_opened` y `always_closed` son los "default" cuando el agente no eligió motivo concreto. Filtrarlos en las queries de pausas reales.

---

## 11. Próximos pasos sugeridos para el dashboard

Orden recomendado para construir Next.js + Vercel:

1. **Setup base**: `npx create-next-app@latest dashboard --typescript --tailwind --app`
2. **Conexión a Neon**: instalar `@neondatabase/serverless`, crear `lib/db.ts` con función helper.
3. **Variable de entorno**: `DATABASE_URL` en `.env.local` y en Vercel project settings.
4. **Auth mínima**: middleware con password en cookie (o NextAuth con magic link si quiero compartir).
5. **Primera página**: la "Estado actual de agentes" (Query 1B enhanced). Tabla con columnas nombre, estado, substatus, tiempo en estado. Refresco cada 60s.
6. **Iterar**: ir añadiendo páginas/secciones siguiendo las queries del `analytics.sql`.
7. **Deploy**: conectar Vercel al repo, configurar variables de entorno, primer deploy.

**Layout sugerido del dashboard:**

- Sidebar con navegación: Overview | Agentes | Llamadas | Pausas | Timeline
- Cada sección consume 1-2 queries específicas
- Filtro de fecha global (hoy / ayer / últimos 7 días / custom)

---

## 12. Cómo trabajamos

- Soy desarrollador pero no experto en Next.js / React. Explica decisiones técnicas con un poco de contexto.
- Voy paso a paso, valido cada parte antes de seguir.
- Si propones código, asegúrate de que es completo y ejecutable. No me dejes con "esto es un ejemplo, complétalo tú".
- Lanzo los comandos en una terminal Git Bash en Windows. Si necesitas que instale algo, dame el comando exacto.
- Mi editor es VSCode y tengo Claude Code disponible para tareas grandes de generación de archivos en el repo local.
- Si me das SQL para pegar en Neon, dame las sentencias una a una porque el SQL Editor a veces no maneja bien múltiples sentencias.

---

## 13. Estado actual confirmado (snapshot al traspasar)

- Sistema en producción capturando eventos reales desde hace varias horas.
- ~19 agentes detectados, ~13 con histórico de estado capturado.
- 152 llamadas perdidas registradas en los últimos 7 días con motivos desglosados.
- 0 intervalos rotos tras el último fix.
- Cron corriendo cada 10 min sin errores.
- Dashboard Next.js **construido y desplegado** en Vercel (Wallboard, Overview, Pausas, Timeline, Login).
- Deuda pendiente: las vistas `v_perdidas_reales`, `v_pausas_operativas` y `v_pausas_anomalias`
  que consume el dashboard **solo existen en Neon**; falta versionarlas en `migrations/`.

Si necesitas verificar algo de la BBDD, pídeme que ejecute la query en Neon y te paso el resultado. Si necesitas verificar algo del Worker, puedo lanzar `npx wrangler tail` y reportarte logs.

---

**Empieza preguntándome solo las decisiones de producto del punto 8 que necesites para arrancar. No me hagas un cuestionario largo. Una o dos preguntas por turno como máximo. Y luego empezamos a generar el proyecto Next.js.**
