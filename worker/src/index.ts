import { neon } from "@neondatabase/serverless";

export interface Env {
  AIRCALL_WEBHOOK_TOKEN: string;
  AIRCALL_API_ID: string;
  AIRCALL_API_TOKEN: string;
  DATABASE_URL: string;
}

interface AircallWebhookPayload {
  token: string;
  event: string;
  timestamp: number;
  data: {
    id?: number; // en webhooks user.* `data` ES el objeto user
    call_id?: number;
    user?: { id?: number }; // en webhooks call.* el agente va aquí
    [key: string]: unknown;
  };
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/aircall/webhook") {
      return new Response("Not Found", { status: 404 });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Parseamos el body antes de responder para poder validar y encolar
    let body: AircallWebhookPayload;
    try {
      body = (await request.json()) as AircallWebhookPayload;
    } catch {
      console.error("invalid json body");
      return new Response("OK", { status: 200 });
    }

    // Validación del token en tiempo constante
    if (!timingSafeEqual(body.token ?? "", env.AIRCALL_WEBHOOK_TOKEN)) {
      console.warn("webhook token mismatch — request ignored");
      return new Response("OK", { status: 200 });
    }

    // ctx.waitUntil mantiene viva la promesa después de responder
    ctx.waitUntil(insertEvent(body, env));

    return new Response("OK", { status: 200 });
  },

  // Cron Trigger — reconciliación de disponibilidad cada 10 min.
  // Awaitamos directamente: el runtime mantiene viva la invocación
  // hasta que la promesa resuelve y propaga los errores a los logs.
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    // El transform es independiente de la reconciliación: aunque falle
    // la llamada a la API de Aircall, queremos materializar lo que ya
    // tengamos en events_raw.
    try {
      await reconcileAvailabilities(env);
    } catch (err) {
      console.error("reconciliation failed (transform will still run):", err);
    }
    await runTransform(env);
  },
} satisfies ExportedHandler<Env>;

async function insertEvent(
  body: AircallWebhookPayload,
  env: Env,
): Promise<void> {
  const eventType = body.event ?? "unknown";
  const userId = extractUserId(body);
  const occurredAt = new Date(body.timestamp * 1000).toISOString();

  try {
    const sql = neon(env.DATABASE_URL);
    await sql`
      INSERT INTO events_raw (event_type, user_id, occurred_at, payload)
      VALUES (
        ${eventType},
        ${userId},
        ${occurredAt},
        ${JSON.stringify(body)}::jsonb
      )
    `;
    console.log(
      `stored event=${eventType} user_id=${userId} at=${occurredAt}`,
    );
  } catch (err) {
    console.error("db insert failed:", err);
  }
}

// Los webhooks user.* traen el user_id en data.id (data ES el objeto user);
// el resto de eventos (call.*) lo traen en data.user.id.
function extractUserId(body: AircallWebhookPayload): number | null {
  const data = body.data;
  if (!data) return null;
  if ((body.event ?? "").startsWith("user.")) {
    return typeof data.id === "number" ? data.id : null;
  }
  const id = data.user?.id;
  return typeof id === "number" ? id : null;
}

// Comparación en tiempo constante. Iteramos siempre sobre la longitud del
// secreto (b) para no filtrar la longitud del token vía timing: una diferencia
// de longitud se refleja en `diff` sin provocar un return anticipado.
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    diff |= (i < a.length ? a.charCodeAt(i) : 0) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ── Fase 2.1: reconciliación de disponibilidad ─────────────────────────────────

interface AvailabilityUser {
  id: number;
  availabilityRaw: string; // valor granular tal cual lo devuelve el endpoint
}

interface AvailabilitiesResponse {
  meta?: { next_page_link?: string | null };
  users?: { id?: number; availability?: string }[];
}

const AIRCALL_AVAILABILITIES_URL =
  "https://api.aircall.io/v1/users/availabilities?per_page=50";

// Trae todas las páginas de /v1/users/availabilities siguiendo next_page_link.
async function fetchAllAvailabilities(env: Env): Promise<AvailabilityUser[]> {
  const auth =
    "Basic " + btoa(`${env.AIRCALL_API_ID}:${env.AIRCALL_API_TOKEN}`);
  const users: AvailabilityUser[] = [];

  let nextUrl: string | null = AIRCALL_AVAILABILITIES_URL;
  let pageGuard = 0;
  while (nextUrl && pageGuard < 100) {
    pageGuard++;
    // Timeout por request: sin esto, una llamada colgada consumiría el
    // límite de CPU del Worker (~30s) y tumbaría todo el ciclo del cron.
    const res = await fetch(nextUrl, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(
        `Aircall API ${res.status} on ${nextUrl}: ${await res.text()}`,
      );
    }
    const body = (await res.json()) as AvailabilitiesResponse;
    for (const u of body.users ?? []) {
      if (typeof u.id === "number" && typeof u.availability === "string") {
        users.push({ id: u.id, availabilityRaw: u.availability });
      }
    }
    nextUrl = body.meta?.next_page_link ?? null;
  }
  return users;
}

// El endpoint de availabilities devuelve estados granulares (available,
// offline, do_not_disturb, in_call, after_call_work); los webhooks user.*
// solo distinguen available/unavailable. Normalizamos para poder comparar.
function normalizeAvailability(value: string): "available" | "unavailable" {
  return value === "available" ? "available" : "unavailable";
}

async function reconcileAvailabilities(env: Env): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  const users = await fetchAllAvailabilities(env);

  if (users.length === 0) {
    console.log("reconciliation: checked 0 users, 0 drifts detected");
    return;
  }

  const userIds = users.map((u) => u.id);

  // Último estado conocido por usuario en una sola query (DISTINCT ON),
  // en lugar de N round-trips. Equivale a "el último evento user.* o
  // reconciliation.* por user_id, ordenado por occurred_at DESC".
  // Tanto los webhooks user.* (data ES el objeto user) como los eventos
  // sintéticos reconciliation.* tienen el estado en data.availability_status.
  const rows = (await sql`
    SELECT DISTINCT ON (user_id)
      user_id,
      payload->'data'->>'availability_status' AS status
    FROM events_raw
    WHERE user_id = ANY(${userIds}::bigint[])
      AND (event_type LIKE 'user.%' OR event_type LIKE 'reconciliation.%')
    ORDER BY user_id, occurred_at DESC
  `) as { user_id: number | string; status: string | null }[];

  const lastKnown = new Map<number, string | null>();
  for (const r of rows) lastKnown.set(Number(r.user_id), r.status);

  // Conteo de estados crudos del endpoint, para visibilidad en los logs.
  const rawCounts: Record<string, number> = {};
  for (const u of users) {
    rawCounts[u.availabilityRaw] = (rawCounts[u.availabilityRaw] ?? 0) + 1;
  }

  let drifts = 0;
  for (const u of users) {
    const known = lastKnown.get(u.id) ?? null;
    // Sin histórico no hay divergencia que detectar.
    if (known === null) continue;

    const normalized = normalizeAvailability(u.availabilityRaw);
    if (known === normalized) continue;

    drifts++;
    const nowIso = new Date().toISOString();
    const payload = {
      event: "reconciliation.status_drift",
      timestamp: Math.floor(Date.now() / 1000),
      source: "cron_reconciliation",
      data: {
        user_id: u.id,
        availability_status: normalized, // normalizado, para comparaciones futuras
        availability_raw: u.availabilityRaw, // valor granular original del endpoint
        last_known_status: known, // último estado en events_raw
      },
    };

    await sql`
      INSERT INTO events_raw (event_type, user_id, occurred_at, payload)
      VALUES (
        'reconciliation.status_drift',
        ${u.id},
        ${nowIso},
        ${JSON.stringify(payload)}::jsonb
      )
    `;
    console.warn(
      `drift user_id=${u.id} aircall=${normalized} (raw=${u.availabilityRaw}) last_known=${known}`,
    );
  }

  const rc = (k: string): number => rawCounts[k] ?? 0;
  console.log(
    `reconciliation: checked ${users.length} users, ${drifts} drifts detected ` +
      `(raw counts: available=${rc("available")}, offline=${rc("offline")}, ` +
      `do_not_disturb=${rc("do_not_disturb")}, in_call=${rc("in_call")}, ` +
      `after_call_work=${rc("after_call_work")})`,
  );
}

// ── Fase 2.2: transformación events_raw → tablas derivadas ─────────────────────

interface TransformResult {
  intervals_upserted: number;
  calls_upserted: number;
}

// Llama a la función SQL transform_events(), que materializa
// agent_status_intervals y calls a partir de events_raw.
async function runTransform(env: Env): Promise<void> {
  const sql = neon(env.DATABASE_URL);
  const rows = (await sql`SELECT * FROM transform_events()`) as TransformResult[];
  const r = rows[0];
  if (!r) {
    console.warn("transform: function returned no row");
    return;
  }
  console.log(
    `transform: ${r.intervals_upserted} intervals upserted, ${r.calls_upserted} calls upserted`,
  );
}