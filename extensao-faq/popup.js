(function () {
  "use strict";
  const { Config, State, UI, WhatsApp } = window.App;

  const modeSelect = document.getElementById("modeSelect");
  const statusEl = document.getElementById("status");
  const cardsEl = document.getElementById("cards");
  const searchInput = document.getElementById("searchInput");
  const logoEl = document.getElementById("logo");
  const headerTitleEl = document.getElementById("header-title");
  const headerSubtitleEl = document.getElementById("header-subtitle");
  const themeToggle = document.getElementById("themeToggle");
  const versionLabelEl = document.getElementById("versionLabel");

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const initialTheme = State.loadTheme();
    applyTheme(initialTheme);
    if (themeToggle) {
      themeToggle.checked = initialTheme === "dark";
      themeToggle.addEventListener("change", onThemeToggle);
    }
    if (versionLabelEl) versionLabelEl.textContent = `${Config.APP_VERSION}`;

    fetchAndInit();
    modeSelect.addEventListener("change", onModeChange);
    searchInput.addEventListener("input", onSearch);
  }

  function onThemeToggle() {
    const theme = themeToggle && themeToggle.checked ? "dark" : "light";
    applyTheme(theme);
    State.saveTheme(theme);
  }
  function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  }

  async function fetchAndInit() {
    UI.setStatus(statusEl, "Carregando...");
    try {
      const data = await fetchJson(Config.JSON_URL);
      State.setCacheData(data);
      const cfg = Config.buildConfig(data?.configs);
      State.setCurrentConfig(cfg);
      // Inicia watcher oficial de contato (detecção de XPaths e alertas)
      try { WhatsApp.startContactWatcher(cfg); } catch (_) {}

      UI.applyHeader(logoEl, data);
      UI.populateModes(modeSelect, data);

      const list = Array.isArray(data?.faq) ? data.faq : [];
      const saved = State.loadMode();
      const initialMode = saved && list.some((it) => it?.categoria === saved) ? saved : list[0]?.categoria || "";
      State.setCurrentMode(initialMode);
      setSelect(initialMode);

      render();
      UI.setStatus(statusEl, "");
    } catch (err) {
      console.error("Falha ao carregar dados:", err);
      UI.setStatus(statusEl, "Não foi possível carregar os dados. Verifique sua conexão e tente novamente.");
    }
  }

  function setSelect(mode) {
    modeSelect.value = mode || "";
  }

  function render() {
    const data = State.getCacheData();
    const mode = State.getCurrentMode();
    UI.renderMode(
      data,
      mode,
      searchInput.value,
      { cardsEl, headerTitleEl, headerSubtitleEl, statusEl },
      {
        onCopy: (text) => copyText(text),
        onPaste: (text) => WhatsApp.sendToWhatsApp(text, { pasteOnly: true }, State.getCurrentConfig()),
        onSend: (text) => WhatsApp.sendToWhatsApp(text, { pasteOnly: false }, State.getCurrentConfig()),
      }
    );
  }

  function onModeChange() {
    const mode = modeSelect.value;
    State.setCurrentMode(mode);
    render();
  }
  function onSearch() {
    render();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy(text);
      }
      UI.showToast("Mensagem copiada para a área de transferência!");
    } catch (err) {
      console.error("Erro ao copiar:", err);
      try {
        legacyCopy(text);
        UI.showToast("Mensagem copiada!");
      } catch (_) {
        UI.showToast("Falha ao copiar a mensagem.");
      }
    }
  }
  function legacyCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "-9999px";
    ta.setAttribute("readonly", "");
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
})();
