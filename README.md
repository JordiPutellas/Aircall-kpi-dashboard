# Aircall Agent Analytics

Custom dashboard alternativo a Aircall Analytics+. Captura eventos
de webhooks de Aircall en tiempo real y permite consultar estados
de agente, descansos, desconexiones y llamadas perdidas.

## Stack

- Cloudflare Workers (ingesta webhook + cron de reconciliación)
- Neon Postgres (almacenamiento)
- Metabase / Next.js (dashboard — fase 2)

## Arquitectura

1. Aircall envía POST a /aircall/webhook en el Worker
2. Worker valida el token y guarda payload bruto en events_raw
3. Cron (cada 10 min) hace GET /v1/users/availabilities para reconciliar
4. Job de transformación convierte events_raw → agent_status_intervals + calls

## Eventos suscritos

- user.connected.v2, user.disconnected.v2
- user.opened.v2, user.closed.v2
- user.wut_start.v2, user.wut_end.v2
- call.created, call.ringing_on_agent, call.answered
- call.hungup, call.ended, call.voicemail_left, call.agent_declined

## Esquema BBDD

- events_raw (id, event_type, user_id, occurred_at, payload jsonb, received_at)
- agent_status_intervals (user_id, status, substatus, started_at, ended_at, duration_s)
- calls (call_id, agent_id, started_at, answered_at, ended_at, direction, missed_reason, duration_s)

## Secretos (Cloudflare Workers secrets, NO en el repo)

- AIRCALL_API_ID
- AIRCALL_API_TOKEN
- AIRCALL_WEBHOOK_TOKEN (lo da Aircall al crear el webhook)
- DATABASE_URL (Neon connection string)
