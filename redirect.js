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

  function recordAccess(config, search) {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return;
    if (!config || typeof config.metricasUrl !== "string" || !config.metricasUrl.trim()) return;
    const params = new URLSearchParams(search);
    const bot = params.get("bot");
    const source = params.get("src");
    if (!bot || !/^[A-Za-z0-9_-]{1,64}$/.test(bot)) return;
    try {
      const endpoint = new URL(config.metricasUrl.trim());
      if (endpoint.protocol !== "https:") return;
      const payload = JSON.stringify({
        bot,
        src: source && /^[A-Za-z0-9_-]{1,64}$/.test(source) ? source : null
      });
      navigator.sendBeacon(endpoint.href, new Blob([payload], { type: "text/plain" }));
    } catch {
      // Métricas nunca podem impedir o redirecionamento.
    }
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { resolveDestination, recordAccess };
  }
  if (typeof document === "undefined") return;

  const title = document.getElementById("titulo");
  const status = document.getElementById("status");
  const link = document.getElementById("continuar");
  const retry = document.getElementById("tentar");
  const panel = document.querySelector("main");
  retry.addEventListener("click", () => window.location.reload());

  const FAST_REDIRECT_URL = "https://telelink-bot.ghostlab.cfd/go";

  async function start() {
    try {
      const params = new URLSearchParams(window.location.search);
      const key = params.get("bot") || "";
      const source = params.get("src") || "";
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(key)) throw new Error("Link inválido");
      const destination = new URL(FAST_REDIRECT_URL);
      destination.searchParams.set("bot", key);
      if (/^[A-Za-z0-9_-]{1,64}$/.test(source)) destination.searchParams.set("src", source);
      link.href = destination.href;
      // Normalmente a navegação acontece antes de qualquer elemento aparecer.
      setTimeout(() => {
        link.hidden = false;
        document.getElementById("nota").hidden = false;
        panel.classList.add("visivel");
      }, 350);
      window.location.replace(destination.href);
    } catch {
      title.textContent = "Acesso indisponível.";
      status.textContent = "Tente novamente em instantes.";
      retry.hidden = false;
      panel.classList.add("visivel");
    }
  }
  start();
}());
