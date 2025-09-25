(function () {
  "use strict";

  // Configuração: URL do JSON unificado (logo, faq.individual, faq.turma, etc.)
  const JSON_URL = "https://atlas2.com.br/extension/faq.json";

  const modeSelect = document.getElementById("modeSelect");
  const statusEl = document.getElementById("status");
  const cardsEl = document.getElementById("cards");
  const searchInput = document.getElementById("searchInput");
  const logoEl = document.getElementById("logo");
  const headerTitleEl = document.getElementById("header-title");
  const headerSubtitleEl = document.getElementById("header-subtitle");
  const themeToggle = document.getElementById("themeToggle");

  let cacheData = null;
  let currentMode = "";
  let currentList = [];

  const STORAGE_KEY_MODE = "faq_atlas_mode";
  const STORAGE_KEY_THEME = "faq_atlas_theme";

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const initialTheme = loadTheme();
    applyTheme(initialTheme);
    if (themeToggle) {
      themeToggle.checked = initialTheme === "dark";
      themeToggle.addEventListener("change", onThemeToggle);
    }
    fetchAndInit();
    modeSelect.addEventListener("change", onModeChange);
    searchInput.addEventListener("input", onSearch);
  }

  function onModeChange() {
    const mode = modeSelect.value;
    currentMode = mode;
    saveMode(mode);
    renderFromCacheOrFetch();
  }

  function setSelect(mode) {
    const list = Array.isArray(cacheData?.faq) ? cacheData.faq : [];
    if (!mode || !list.some(item => item?.categoria === mode)) {
      mode = list[0]?.categoria || "";
    }
    modeSelect.value = mode;
  }

  function saveMode(mode) {
    try { localStorage.setItem(STORAGE_KEY_MODE, mode); } catch (_) {}
  }
  function loadMode() {
    try { return localStorage.getItem(STORAGE_KEY_MODE) || ""; } catch (_) { return ""; }
  }

  function onThemeToggle() {
    const theme = themeToggle && themeToggle.checked ? "dark" : "light";
    applyTheme(theme);
    saveTheme(theme);
  }
  function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
  }
  function saveTheme(theme) {
    try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch (_) {}
  }
  function loadTheme() {
    try { return localStorage.getItem(STORAGE_KEY_THEME) || "light"; } catch (_) { return "light"; }
  }

  async function fetchAndInit() {
    clearUI();
    setStatus("Carregando...");
    try {
      cacheData = await fetchJson(JSON_URL);
      applyHeader(cacheData);
      populateModes(cacheData);
      const saved = loadMode();
      const list = Array.isArray(cacheData?.faq) ? cacheData.faq : [];
      currentMode = (saved && list.some(it => it?.categoria === saved)) ? saved : (list[0]?.categoria || "");
      setSelect(currentMode);
      renderMode(cacheData, currentMode);
      setStatus("");
    } catch (err) {
      console.error("Falha ao carregar dados:", err);
      setStatus("Não foi possível carregar os dados. Verifique sua conexão e tente novamente.");
    }
  }

  function renderFromCacheOrFetch() {
    if (cacheData) {
      renderMode(cacheData, currentMode);
    } else {
      fetchAndInit();
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function clearUI() {
    cardsEl.innerHTML = "";
  }

  function renderMode(data, mode) {
    clearUI();
    const arr = Array.isArray(data?.faq) ? data.faq : [];
    const sectionObj = arr.find(it => it?.categoria === mode);
    const section = sectionObj?.data;
    if (!section) {
      setStatus("Seção não encontrada no JSON.");
      return;
    }

    headerTitleEl.textContent = section.title || "Roteiro de Atendimento";
    headerSubtitleEl.textContent = section.subtitle || "";

    const list = Array.isArray(section.mensagens) ? section.mensagens : [];
    currentList = list;

    const filtered = filterList(list, searchInput.value);
    if (filtered.length === 0) {
      setStatus("Nenhum resultado para o filtro aplicado.");
      return;
    }

    setStatus("");
    for (const item of filtered) {
      cardsEl.appendChild(renderCard(item));
    }
  }

  function renderCard(item) {
    const { title, subtitle, pergunta, resposta } = normalizeItem(item);
    const box = createEl("section", { class: "message-box" });

    // Cabeçalho colapsável
    const header = createEl("div", { class: "collapse-header" });
    const titleEl = createEl("h3", { class: "collapse-title", text: title || "Mensagem" });
    const iconEl = createEl("span", { class: "collapse-icon", text: "▾" });
    header.appendChild(titleEl);
    header.appendChild(iconEl);

    const content = createEl("div", { class: "collapse-content" });

    if (subtitle) content.appendChild(createEl("p", { text: subtitle }));
    if (pergunta) {
      content.appendChild(createEl("p", { html: `<strong>Pergunta:</strong> ${escapeHtml(pergunta)}` }));
      content.appendChild(createEl("div", { class: "hr" }));
      content.appendChild(createEl("p", { html: `<strong>Sua resposta:</strong>` }));
    }
    if (resposta) content.appendChild(createEl("p", { text: resposta }));

    const btn = createEl("button", {
      class: "copy-button",
      text: "Copiar",
      attrs: { "aria-label": "Copiar resposta" },
    });
    btn.addEventListener("click", async () => {
      await copyText(resposta || "");
      btn.classList.add("copied");
      const original = btn.textContent;
      btn.textContent = "Copiado!";
      setTimeout(() => {
        btn.textContent = original;
        btn.classList.remove("copied");
      }, 2000);
    });
    const row = createEl("div", { class: "copy-row" });
    row.appendChild(btn);
    content.appendChild(row);

    // Toggle
    let open = true;
    header.addEventListener("click", () => {
      open = !open;
      content.style.display = open ? "block" : "none";
      iconEl.textContent = open ? "▾" : "▸";
    });

    box.appendChild(header);
    box.appendChild(content);
    return box;
  }

  function normalizeItem(item) {
    return {
      title: safeText(item.title),
      subtitle: safeText(item.subtitle),
      pergunta: safeText(item.pergunta),
      resposta: safeText(item.resposta),
    };
  }

  function filterList(list, term) {
    const q = (term || "").trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) =>
      [it.title, it.subtitle, it.pergunta, it.resposta]
        .filter(Boolean)
        .some((txt) => String(txt).toLowerCase().includes(q))
    );
  }
  function onSearch() {
    renderFromCacheOrFetch();
  }

  function populateModes(data) {
    const list = Array.isArray(data?.faq) ? data.faq : [];
    modeSelect.innerHTML = "";
    for (const item of list) {
      const key = String(item?.categoria || "").trim();
      if (!key) continue;
      const label = key;
      const opt = createEl("option", { text: label, attrs: { value: key } });
      modeSelect.appendChild(opt);
    }
  }

  function applyHeader(data) {
    try {
      if (data.logo) logoEl.src = String(data.logo);
    } catch (_) {}
  }

  function createEl(tag, { class: cls, text, html, attrs } = {}) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (html != null) el.innerHTML = html;
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v != null) el.setAttribute(k, v);
      }
    }
    return el;
  }

  function safeText(value) {
    if (value == null) return "";
    return String(value);
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        legacyCopy(text);
      }
      showToast("Mensagem copiada para a área de transferência!");
    } catch (err) {
      console.error("Erro ao copiar:", err);
      try {
        legacyCopy(text);
        showToast("Mensagem copiada!");
      } catch (_) {
        showToast("Falha ao copiar a mensagem.");
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

  function showToast(msg) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 200);
    }, 1800);
  }

  function setStatus(message) {
    statusEl.textContent = message || "";
  }
})();
