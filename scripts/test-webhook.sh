#!/usr/bin/env bash
# Simula un webhook de Aircall contra el worker local (wrangler dev).
# Uso: bash scripts/test-webhook.sh [TOKEN] [URL]
#
# Argumentos opcionales:
#   TOKEN  — valor de AIRCALL_WEBHOOK_TOKEN (default: test-token-local)
#   URL    — endpoint del worker         (default: http://localhost:8787/aircall/webhook)

TOKEN="placeholder123"
URL="https://aircall-kpis-worker.aircall-kpis.workers.dev/aircall/webhook"
TIMESTAMP=$(date +%s)

echo "→ Enviando webhook a $URL"
echo "  token: $TOKEN"
echo "  timestamp: $TIMESTAMP"
echo ""

# ── user.connected.v2 ──────────────────────────────────────────────────────────
echo "--- user.connected.v2 ---"
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"event\": \"user.connected.v2\",
    \"timestamp\": $TIMESTAMP,
    \"data\": {
      \"user_id\": 12345,
      \"user\": {
        \"id\": 12345,
        \"name\": \"Ana García\",
        \"email\": \"ana@example.com\"
      }
    }
  }"

echo ""
sleep 0.5

# ── call.answered ──────────────────────────────────────────────────────────────
echo "--- call.answered ---"
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"$TOKEN\",
    \"event\": \"call.answered\",
    \"timestamp\": $((TIMESTAMP + 30)),
    \"data\": {
      \"user_id\": 12345,
      \"call_id\": 99001,
      \"direction\": \"inbound\",
      \"number\": \"+34912345678\"
    }
  }"

echo ""
sleep 0.5

# ── Token incorrecto (debe ser ignorado silenciosamente) ───────────────────────
echo "--- token incorrecto (debe devolver 200 pero no guardar) ---"
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"token\": \"token-malo\",
    \"event\": \"user.disconnected.v2\",
    \"timestamp\": $TIMESTAMP,
    \"data\": { \"user_id\": 99999 }
  }"

echo ""
echo ""
echo "✓ Hecho. Comprueba los logs de wrangler dev y la tabla events_raw:"
echo "  psql \"\$DATABASE_URL\" -c 'SELECT id, event_type, user_id, occurred_at FROM events_raw ORDER BY id DESC LIMIT 5;'"
