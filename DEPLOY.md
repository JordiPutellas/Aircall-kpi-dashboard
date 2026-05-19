# Despliegue — Fase 1: ingesta de webhooks

## Prerrequisitos

| Herramienta | Versión mínima |
|-------------|---------------|
| Node.js     | 20            |
| Wrangler    | 3.x (`npm i -g wrangler`) |
| psql / cliente SQL | cualquiera |

Cuentas necesarias:
- **Cloudflare** — cuenta gratuita con Workers habilitados
- **Neon** — proyecto Postgres creado en [neon.tech](https://neon.tech)
- **Aircall** — acceso de administrador para crear webhooks

---

## 1. Crear la base de datos en Neon

1. Entra en la consola de Neon → selecciona tu proyecto → copia el **Connection string**.  
   Tiene este formato:
   ```
   postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```

2. Ejecuta la migración:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_create_events_raw.sql
   ```

3. Verifica:
   ```sql
   \d events_raw
   ```

---

## 2. Instalar dependencias del Worker

```bash
cd worker
npm install
```

---

## 3. Configurar los secretos en Cloudflare

Ejecuta cada comando y pega el valor cuando lo pida (los valores **nunca** deben estar en el repo):

```bash
cd worker

wrangler secret put DATABASE_URL
# pega: postgresql://user:pass@host/db?sslmode=require

wrangler secret put AIRCALL_WEBHOOK_TOKEN
# pega: el token que configurarás en el paso 5

wrangler secret put AIRCALL_API_ID
# pega: tu API ID de Aircall (para la fase 2)

wrangler secret put AIRCALL_API_TOKEN
# pega: tu API Token de Aircall (para la fase 2)
```

Confirma que están guardados:
```bash
wrangler secret list
```

---

## 4. Desplegar el Worker

```bash
cd worker
npm run deploy
```

La URL del Worker será algo como:
```
https://aircall-kpis-worker.<tu-subdominio>.workers.dev
```

> Para usar un dominio propio, añade una ruta en el dashboard de Cloudflare:  
> Workers & Pages → tu Worker → Settings → Triggers → Routes.

---

## 5. Crear el webhook en Aircall

1. Aircall Dashboard → **Integrations** → **Webhooks** → **Create webhook**.
2. URL: `https://aircall-kpis-worker.<tu-subdominio>.workers.dev/aircall/webhook`
3. Copia el **Token** que genera Aircall y úsalo como valor de `AIRCALL_WEBHOOK_TOKEN` (paso 3).  
   Si ya desplegaste con un token provisional, actualízalo:
   ```bash
   wrangler secret put AIRCALL_WEBHOOK_TOKEN
   ```
4. Suscribe los eventos:
   - `user.connected.v2`, `user.disconnected.v2`
   - `user.opened.v2`, `user.closed.v2`
   - `user.wut_start.v2`, `user.wut_end.v2`
   - `call.created`, `call.ringing_on_agent`, `call.answered`
   - `call.hungup`, `call.ended`, `call.voicemail_left`, `call.agent_declined`

---

## 6. Prueba local con wrangler dev

El modo dev no usa los secretos de Cloudflare; créalos en un fichero local (no lo commits):

```bash
# worker/.dev.vars
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
AIRCALL_WEBHOOK_TOKEN=test-token-local
```

```bash
cd worker
npm run dev
```

En otro terminal:
```bash
bash scripts/test-webhook.sh
```

Comprueba la tabla:
```bash
psql "$DATABASE_URL" -c \
  "SELECT id, event_type, user_id, occurred_at FROM events_raw ORDER BY id DESC LIMIT 5;"
```

---

## 7. Monitorización

- **Logs en tiempo real**: `wrangler tail` (en producción)
- **Logs de dev**: se imprimen directamente en la terminal de `wrangler dev`
- Los errores de inserción en BD quedan en `console.error` → visibles en Cloudflare Dashboard → Workers → Logs

---

## Notas de seguridad

- El token se compara en tiempo constante (función `timingSafeEqual` en el Worker) para evitar timing attacks.
- El Worker responde **200 OK** inmediatamente incluso si la inserción falla, para que Aircall no reintente infinitamente. Los fallos quedan en los logs.
- `DATABASE_URL` incluye `?sslmode=require` — nunca uses una conexión sin TLS.
- El fichero `.dev.vars` está en `.gitignore` — no lo commits.
