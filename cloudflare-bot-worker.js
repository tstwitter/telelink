/**
 * Worker instantaneo da Central de Links.
 * Bindings necessarios:
 * - DESTINOS_KV (KV)
 * - DB (D1 telelink-metrics)
 * Variaveis/secrets existentes:
 * - TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_ID, TELEGRAM_CHANNEL_ID
 */

const PUBLIC_BASE_URL = "https://tstwitter.github.io/telelink/";
const DAY_MS = 86_400_000;
const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;

const DEFAULT_DESTINOS = {
  hubTS: "https://t.me/+-AOwidivoqJjN2Zh",
  sinfuldolls: "https://t.me/+H-YYmpwMutJmMDMx",
  Centraldoll_: "https://t.me/+H-YYmpwMutJmMDMx",
  Radartrans: "https://t.me/+H-YYmpwMutJmMDMx",
  anatrans_fc: "https://t.me/+H-YYmpwMutJmMDMx",
  transpopts: "https://t.me/+H-YYmpwMutJmMDMx",
  Feedcherry: "https://t.me/+H-YYmpwMutJmMDMx",
  ts_profana: "https://t.me/+H-YYmpwMutJmMDMx",
  noticiapink: "https://t.me/+H-YYmpwMutJmMDMx",
  MidiasTS: "https://t.me/+H-YYmpwMutJmMDMx",
  transpicybr: "https://t.me/+H-YYmpwMutJmMDMx",
  latinatgfever: "https://t.me/+H-YYmpwMutJmMDMx",
  Trannylatinas: "https://t.me/+H-YYmpwMutJmMDMx",
  brdolllust: "https://t.me/+H-YYmpwMutJmMDMx",
  latinastranny: "https://t.me/+H-YYmpwMutJmMDMx",
  latinasTSx: "https://t.me/+H-YYmpwMutJmMDMx",
  hottbrazilians: "https://t.me/+H-YYmpwMutJmMDMx",
  brtgirlsecrets: "https://t.me/+H-YYmpwMutJmMDMx",
  transyula: "https://t.me/+H-YYmpwMutJmMDMx",
  fofocasreservadas: "https://t.me/+H-YYmpwMutJmMDMx"
};

const DEFAULT_GRUPOS = {
  Trans: [
    "sinfuldolls", "Centraldoll_", "Radartrans", "anatrans_fc", "transpopts",
    "Feedcherry", "ts_profana", "noticiapink", "MidiasTS", "transpicybr",
    "latinatgfever", "Trannylatinas", "brdolllust", "latinastranny",
    "latinasTSx", "hottbrazilians", "brtgirlsecrets", "transyula",
    "fofocasreservadas"
  ]
};

const HELP = `⚡ Central de links (instantânea)

/listar — ver links e pastas
/pastas — ver as pastas
/pasta Trans — abrir uma pasta
/link hubTS — copiar o link fixo
/criar nome https://t.me/SeuBot — criar um link
/criarpasta Trans nome https://t.me/SeuBot — criar em uma pasta
/destino hubTS https://t.me/NovoDestino — trocar um destino
/destinopasta Trans https://t.me/NovoDestino — trocar toda a pasta
/trafego nome hoje — acessos de um link
/ranking Trans 7d — ranking da pasta
/relatorioagora — enviar o relatório diário ao canal

Períodos: hoje, 7d ou 30d.`;

function validDestination(value) {
  try {
    const url = new URL(value);
    return value.length <= 2048 && url.protocol === "https:" &&
      url.hostname === "t.me" && url.pathname !== "/" && !value.includes("\\");
  } catch { return false; }
}

async function getConfig(env) {
  const savedDestinos = await env.DESTINOS_KV.get("config_destinos", { type: "json" });
  const savedGrupos = await env.DESTINOS_KV.get("config_grupos", { type: "json" });
  return {
    destinos: { ...DEFAULT_DESTINOS, ...(savedDestinos || {}) },
    grupos: { ...DEFAULT_GRUPOS, ...(savedGrupos || {}) }
  };
}

async function saveConfig(env, config) {
  await Promise.all([
    env.DESTINOS_KV.put("config_destinos", JSON.stringify(config.destinos)),
    env.DESTINOS_KV.put("config_grupos", JSON.stringify(config.grupos))
  ]);
}

const MAIN_MENU = {
  keyboard: [
    [
      { text: "📁 Links Trans" },
      { text: "📂 Pastas" }
    ],
    [
      { text: "📊 Hoje" },
      { text: "📈 7 dias" },
      { text: "🗓 30 dias" }
    ],
    [
      { text: "🔗 Link do Hub" },
      { text: "⚙️ Ajuda" }
    ],
    [{ text: "🔄 Atualizar menu" }]
  ],
  resize_keyboard: true
};

const MENU_ACTIONS = {
  "📁 Links Trans": "/pasta Trans",
  "📂 Pastas": "/pastas",
  "📊 Hoje": "/ranking Trans hoje",
  "📈 7 dias": "/ranking Trans 7d",
  "🗓 30 dias": "/ranking Trans 30d",
  "🔗 Link do Hub": "/link hubTS",
  "⚙️ Ajuda": "/ajuda",
  "🔄 Atualizar menu": "/menu"
};

async function sendTelegram(env, chatId, text, replyMarkup = null) {
  for (let start = 0; start < text.length; start += 3500) {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(start, start + 3500),
        disable_web_page_preview: true,
        ...(replyMarkup && start === 0 ? { reply_markup: replyMarkup } : {})
      })
    });
    if (!response.ok) {
      console.error("telegram_send_failed", response.status, await response.text());
      if (replyMarkup && start === 0) {
        const fallback = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: text.slice(start, start + 3500), disable_web_page_preview: true })
        });
        if (fallback.ok) continue;
      }
      throw new Error("telegram_send_failed");
    }
  }
}

async function answerCallback(env, callbackId) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId })
  });
}

async function showMenu(env, chatId, intro = "Escolha o que deseja gerenciar:") {
  await sendTelegram(env, chatId, `⚡ Central de links\n\n${intro}`, MAIN_MENU);
}

function saoPauloDayStart(now = Date.now()) {
  const local = new Date(now - 3 * 60 * 60 * 1000);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3);
}

function rangeFor(period) {
  const end = Date.now();
  const today = saoPauloDayStart(end);
  if (period === "hoje" || period === "today") return { start: today, end, label: "hoje" };
  if (period === "7d") return { start: today - 6 * DAY_MS, end, label: "últimos 7 dias" };
  if (period === "30d") return { start: today - 29 * DAY_MS, end, label: "últimos 30 dias" };
  return null;
}

async function readCounts(env, range) {
  const result = await env.DB.prepare(
    "SELECT bot, COUNT(*) AS clicks FROM click_events WHERE occurred_at >= ?1 AND occurred_at < ?2 GROUP BY bot ORDER BY clicks DESC"
  ).bind(range.start, range.end).all();
  return Object.fromEntries((result.results || []).map(row => [String(row.bot), Number(row.clicks)]));
}

function formatNumber(value) { return new Intl.NumberFormat("pt-BR").format(value); }

async function trafficReply(env, config, cmd, parts) {
  if (parts.length < 2 || parts.length > 3) return "Use: /trafego nome hoje\nou: /ranking pasta 7d";
  const target = parts[1];
  const range = rangeFor((parts[2] || "hoje").toLowerCase());
  if (!range) return "Período inválido. Use hoje, 7d ou 30d.";
  let members;
  let title;
  if (Array.isArray(config.grupos[target])) {
    members = config.grupos[target].filter(key => config.destinos[key]);
    title = `Pasta ${target} — ${range.label}`;
  } else if (cmd === "/trafego" && config.destinos[target]) {
    members = [target];
    title = `${target} — ${range.label}`;
  } else return "Link ou pasta não cadastrado. Use /listar ou /pastas.";
  const counts = await readCounts(env, range);
  const rows = members.map(key => [key, counts[key] || 0]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  if (rows.length === 1) return `${title}\n\nVocê teve ${formatNumber(total)} acessos 🤩🎉`;
  return `${title}\n\n${rows.map((row, index) => `${index + 1}. ${row[0]}: ${formatNumber(row[1])} acessos`).join("\n")}\n\nTotal: ${formatNumber(total)} acessos 🤩🎉`;
}

async function dailyReport(env) {
  const config = await getConfig(env);
  const range = rangeFor("hoje");
  const counts = await readCounts(env, range);
  const members = config.grupos.Trans || [];
  const rows = members.map(key => [key, counts[key] || 0]).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, row) => sum + row[1], 0);
  const ranking = rows.filter(row => row[1] > 0).slice(0, 10)
    .map((row, index) => `${index + 1}. ${row[0]}: ${formatNumber(row[1])} acessos`).join("\n");
  const text = total
    ? `Relatório diário — Pasta Trans 🎉\n\nVocê teve ${formatNumber(total)} acessos hoje 🤩\n\n${ranking}\n\nTotal: ${formatNumber(total)} acessos`
    : "Relatório diário — Pasta Trans\n\nHoje não houve acessos registrados.";
  await sendTelegram(env, env.TELEGRAM_CHANNEL_ID, text);
}

async function handleCommand(env, message) {
  const senderId = String(message.from?.id || "");
  if (senderId !== String(env.TELEGRAM_ADMIN_ID || "").trim()) return;
  const input = message.text.trim();
  const parts = (MENU_ACTIONS[input] || input).split(/\s+/);
  const cmd = parts[0].toLowerCase().split("@")[0];
  const config = await getConfig(env);
  let reply;
  let changed = false;
  if (["/start", "/menu"].includes(cmd)) {
    await showMenu(env, senderId);
    return;
  } else if (["/ajuda", "/help"].includes(cmd)) reply = HELP;
  else if (cmd === "/pastas") {
    const rows = Object.entries(config.grupos).map(([name, members]) => `${name} (${members.filter(key => config.destinos[key]).length} links)`);
    reply = rows.length ? `Pastas:\n${rows.join("\n")}` : "Nenhuma pasta cadastrada.";
  } else if (cmd === "/pasta" && parts.length === 2) {
    const members = config.grupos[parts[1]];
    reply = Array.isArray(members)
      ? `Pasta ${parts[1]} (${members.length} links):\n\n${members.filter(key => config.destinos[key]).map(key => `${key}\n${PUBLIC_BASE_URL}?bot=${key}`).join("\n\n")}`
      : "Pasta não cadastrada. Use /pastas.";
  } else if (cmd === "/listar") {
    const grouped = new Set(Object.values(config.grupos).flat());
    const loose = Object.keys(config.destinos).filter(key => !grouped.has(key)).sort();
    reply = `${loose.length ? `Links sem pasta:\n\n${loose.map(key => `${key}\n${PUBLIC_BASE_URL}?bot=${key}`).join("\n\n")}\n\n` : ""}Pastas:\n${Object.entries(config.grupos).map(([name, members]) => `${name} (${members.length} links)`).join("\n")}\n\nUse /pasta NOME para abrir.`;
  } else if (cmd === "/link" && parts.length === 2) {
    reply = config.destinos[parts[1]] ? `${PUBLIC_BASE_URL}?bot=${parts[1]}` : "Nome não encontrado. Use /listar.";
  } else if (cmd === "/relatorioagora") {
    await dailyReport(env);
    reply = "✅ Relatório de teste enviado ao canal.";
  } else if (["/trafego", "/ranking"].includes(cmd)) {
    reply = await trafficReply(env, config, cmd, parts);
  } else if (cmd === "/destinopasta" && parts.length === 3) {
    const members = config.grupos[parts[1]];
    if (!Array.isArray(members)) reply = "Pasta não cadastrada. Use /pastas.";
    else if (!validDestination(parts[2])) reply = "Destino inválido. Use um link https://t.me/... válido.";
    else {
      members.filter(key => config.destinos[key]).forEach(key => { config.destinos[key] = parts[2]; });
      changed = true;
      reply = `✅ Destino atualizado para os ${members.length} links da pasta ${parts[1]}.\nA alteração já está valendo.`;
    }
  } else if (cmd === "/criarpasta" && parts.length === 4) {
    const [, folder, key, destination] = parts;
    if (!NAME_RE.test(folder) || !NAME_RE.test(key)) reply = "Nome inválido. Use letras sem acento, números, - ou _.";
    else if (!validDestination(destination)) reply = "Destino inválido. Use um link https://t.me/... válido.";
    else if (config.destinos[key]) reply = "Esse nome já existe. Para alterar, use /destino.";
    else {
      config.destinos[key] = destination;
      (config.grupos[folder] ||= []).push(key);
      changed = true;
      reply = `✅ Link criado na pasta ${folder}.\n${PUBLIC_BASE_URL}?bot=${key}`;
    }
  } else if (["/criar", "/destino"].includes(cmd) && parts.length === 3) {
    const key = parts[1], destination = parts[2];
    if (!NAME_RE.test(key)) reply = "Nome inválido. Use letras sem acento, números, - ou _.";
    else if (!validDestination(destination)) reply = "Destino inválido. Use um link https://t.me/... válido.";
    else if (cmd === "/criar" && config.destinos[key]) reply = "Esse nome já existe. Para alterar, use /destino.";
    else if (cmd === "/destino" && !config.destinos[key]) reply = "Esse nome não existe. Para cadastrar, use /criar.";
    else {
      config.destinos[key] = destination;
      changed = true;
      reply = `✅ Configuração salva para ${key}.\n${PUBLIC_BASE_URL}?bot=${key}\nA alteração já está valendo.`;
    }
  } else reply = "Comando não reconhecido.\n\n" + HELP;
  if (changed) await saveConfig(env, config);
  await sendTelegram(env, senderId, reply);
  if (changed && env.TELEGRAM_CHANNEL_ID) await sendTelegram(env, env.TELEGRAM_CHANNEL_ID, `🔄 Central de links atualizada pelo bot.\n${reply}`);
}

async function handleCallback(env, query) {
  const senderId = String(query.from?.id || "");
  if (senderId !== String(env.TELEGRAM_ADMIN_ID || "").trim()) {
    await answerCallback(env, query.id);
    return;
  }
  await answerCallback(env, query.id);
  const data = String(query.data || "");
  if (data === "cmd:pastas") return handleCommand(env, { from: query.from, text: "/pastas" });
  if (data.startsWith("cmd:pasta:")) return handleCommand(env, { from: query.from, text: `/pasta ${data.slice(10)}` });
  if (data.startsWith("cmd:link:")) return handleCommand(env, { from: query.from, text: `/link ${data.slice(9)}` });
  if (data.startsWith("rank:")) {
    const [, folder, period] = data.split(":");
    return handleCommand(env, { from: query.from, text: `/ranking ${folder} ${period}` });
  }
  if (data.startsWith("help:destino:")) {
    const folder = data.slice(13);
    return sendTelegram(env, senderId,
      `Para trocar todos os links da pasta ${folder}, envie:\n\n/destinopasta ${folder} https://t.me/NOVO_DESTINO\n\nSubstitua o final pelo novo link do Telegram.`, MAIN_MENU);
  }
  if (data === "help:criar") {
    return sendTelegram(env, senderId,
      "Para criar um link na pasta Trans, envie:\n\n/criarpasta Trans nome https://t.me/DESTINO\n\nTroque “nome” pelo username da conta.", MAIN_MENU);
  }
  return showMenu(env, senderId);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json", "Cache-Control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/go") {
      const key = url.searchParams.get("bot") || "";
      const source = url.searchParams.get("src") || "";
      if (!NAME_RE.test(key)) return new Response("Link inválido", { status: 400 });
      const config = await getConfig(env);
      const destination = config.destinos[key];
      if (!validDestination(destination)) return new Response("Link não encontrado", { status: 404 });
      // A métrica é gravada depois da resposta e nunca segura o visitante.
      if (env.DB) {
        ctx.waitUntil(env.DB.prepare(
          "INSERT INTO click_events (bot, src, occurred_at) VALUES (?1, ?2, ?3)"
        ).bind(key, NAME_RE.test(source) ? source : null, Date.now()).run().catch(console.error));
      }
      return new Response(null, {
        status: 302,
        headers: { "Location": destination, "Cache-Control": "no-store" }
      });
    }
    if (url.pathname === "/" || url.pathname === "/config") {
      const config = await getConfig(env);
      return new Response(JSON.stringify({ destinos: config.destinos, grupos: config.grupos, enviarOrigemAoBot: false }), { headers: cors });
    }
    if (url.pathname === "/setup-webhook") {
      const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.origin + "/webhook",
          allowed_updates: ["message", "callback_query"],
          drop_pending_updates: true
        })
      });
      return new Response(await response.text(), { headers: cors });
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      const update = await request.json();
      if (update.callback_query) ctx.waitUntil(handleCallback(env, update.callback_query).catch(console.error));
      else if (update.message?.text) ctx.waitUntil(handleCommand(env, update.message).catch(console.error));
      return new Response("OK");
    }
    return new Response("Not Found", { status: 404 });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(dailyReport(env));
  }
};
