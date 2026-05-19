#!/usr/bin/env bash
# Dispara manualmente el handler `scheduled` (cron de reconciliación).
#
# Primero arranca el worker en modo test-scheduled en OTRO terminal:
#   cd worker && npx wrangler dev --test-scheduled
#
# wrangler expone entonces el endpoint http://localhost:8787/__scheduled
# que ejecuta el handler `scheduled` al recibir un GET.
#
# Uso: bash scripts/test-cron.sh [URL_BASE]
#   URL_BASE — base del worker local (default: http://localhost:8787)

BASE="${1:-http://localhost:8787}"
CRON="*/10 * * * *"

echo "→ Disparando cron '$CRON' en $BASE/__scheduled"
echo ""

# -G + --data-urlencode: GET con el cron correctamente codificado en la query
curl -s -G -w "\nHTTP %{http_code}\n" \
  "$BASE/__scheduled" \
  --data-urlencode "cron=$CRON"

echo ""
echo "✓ Hecho. Revisa los logs de 'wrangler dev':"
echo "    reconciliation: checked N users, M drifts detected"
echo ""
echo "  Y comprueba los eventos sintéticos en la BBDD:"
echo "    psql \"\$DATABASE_URL\" -c \"SELECT id, user_id, occurred_at, payload->'data' FROM events_raw WHERE event_type = 'reconciliation.status_drift' ORDER BY id DESC LIMIT 10;\""
