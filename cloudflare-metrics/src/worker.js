const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_MS = 86_400_000;

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

function saoPauloDayStart(nowMs) {
  const local = new Date(nowMs - 3 * 60 * 60 * 1000);
  return Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
    3, 0, 0, 0
  );
}

function rangeFor(period, nowMs = Date.now()) {
  const end = nowMs;
  const today = saoPauloDayStart(nowMs);
  if (period === "today") return { start: today, end, label: "hoje" };
  if (period === "7d") return { start: today - 6 * DAY_MS, end, label: "últimos 7 dias" };
  if (period === "30d") return { start: today - 29 * DAY_MS, end, label: "últimos 30 dias" };
  return null;
}

async function counts(env, range) {
  const query = env.DB.prepare(
    "SELECT bot, COUNT(*) AS clicks FROM click_events " +
    "WHERE occurred_at >= ?1 AND occurred_at < ?2 GROUP BY bot ORDER BY clicks DESC"
  ).bind(range.start, range.end);
  const result = await query.all();
  return result.results || [];
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  return !origin || origin === env.ALLOWED_ORIGIN;
}

async function record(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": env.ALLOWED_ORIGIN,
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400"
      }
    });
  }
  if (request.method !== "POST" || !allowedOrigin(request, env)) {
    return json({ ok: false }, 403);
  }
  let body;
  try {
    body = JSON.parse(await request.text());
  } catch {
    return json({ ok: false }, 400);
  }
  if (!NAME_RE.test(body.bot || "")) return json({ ok: false }, 400);
  const source = NAME_RE.test(body.src || "") ? body.src : null;
  await env.DB.prepare(
    "INSERT INTO click_events (bot, src, occurred_at) VALUES (?1, ?2, ?3)"
  ).bind(body.bot, source, Date.now()).run();
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": env.ALLOWED_ORIGIN,
      "cache-control": "no-store"
    }
  });
}

async function stats(request, env) {
  if (request.headers.get("authorization") !== `Bearer ${env.STATS_TOKEN}`) {
    return json({ ok: false }, 401, { "cache-control": "no-store" });
  }
  const period = new URL(request.url).searchParams.get("period") || "today";
  const range = rangeFor(period);
  if (!range) return json({ ok: false, error: "periodo_invalido" }, 400);
  return json(
    { ok: true, period, label: range.label, counts: await counts(env, range) },
    200,
    { "cache-control": "no-store" }
  );
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/event") return record(request, env);
    if (path === "/stats") return stats(request, env);
    return json({ ok: true, service: "telelink-metrics" });
  }
};

export { rangeFor };
