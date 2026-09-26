(function () {
  "use strict";

  function resolveDestination(config, search) {
    const params = new URLSearchParams(search);
    const key = params.get("bot");
    let selected = config && config.destino;
    if (config && config.destinos) {
      if (!key || !/^[A-Za-z0-9_-]{1,64}$/.test(key) ||
          !Object.prototype.hasOwnProperty.call(config.destinos, key)) {
        throw new Error("Link não cadastrado.");
      }
      selected = config.destinos[key];
    }
    if (typeof selected !== "string" || !selected.trim()) {
      throw new Error("Destino ainda não configurado.");
    }
    const destination = new URL(selected.trim());
    if (destination.protocol !== "https:" || destination.hostname !== "t.me" ||
        destination.port || destination.username || destination.password ||
        destination.pathname === "/") {
      throw new Error("Use um link completo https://t.me/ do bot ou canal.");
    }
    const source = params.get("src");
    // Opt-in: não altera convites, canais ou parâmetros start existentes.
    if (config.enviarOrigemAoBot === true && source &&
        /^[A-Za-z0-9_-]{1,64}$/.test(source) &&
        /^\/[A-Za-z0-9_]+bot\/?$/i.test(destination.pathname) &&
        !destination.searchParams.has("start")) {
      destination.searchParams.set("start", source);
    }
    return destination.href;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { resolveDestination };
  }
  if (typeof document === "undefined") return;

  const title = document.getElementById("titulo");
  const status = document.getElementById("status");
  const link = document.getElementById("continuar");
  const retry = document.getElementById("tentar");
  retry.addEventListener("click", () => window.location.reload());

  const API_URL = "https://throbbing-feather-954e.sablovisck.workers.dev/config";

  async function start() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      let configData = null;

      // 1. Tenta buscar em tempo real na API ultra-rápida (Cloudflare KV)
      try {
        const liveUrl = new URL(API_URL);
        liveUrl.searchParams.set("v", Date.now().toString());
        const apiRes = await fetch(liveUrl, { cache: "no-store", signal: controller.signal });
        if (apiRes.ok) {
          configData = await apiRes.json();
        }
      } catch (err) {
        // Fallback transparente se houver erro de rede
      }

      // 2. Se a API falhar, usa o config.json local como backup de segurança
      if (!configData) {
        const configUrl = new URL("config.json", window.location.href);
        configUrl.searchParams.set("v", Date.now().toString());
        const response = await fetch(configUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Configuração indisponível.");
        configData = await response.json();
      }

      const destination = resolveDestination(configData, window.location.search);
      link.href = destination;
      link.hidden = false;
      document.getElementById("nota").hidden = false;
      title.textContent = "Seu acesso está pronto.";
      status.textContent = "Você será encaminhado ao Telegram.";
      // O botão fica disponível mesmo se o navegador bloquear o redirecionamento
      setTimeout(() => {
        try { window.location.replace(destination); }
        catch { status.textContent = "Toque no botão para continuar ao Telegram."; }
      }, 0);
    } catch {
      title.textContent = "Acesso indisponível.";
      status.textContent = "Não foi possível carregar o link agora. Tente novamente em instantes.";
      retry.hidden = false;
    } finally {
      clearTimeout(timeout);
    }
  }
  start();
}());
