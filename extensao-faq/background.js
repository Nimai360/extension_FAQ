/* Service worker de background: integra diretamente com Supabase RPC (sem backend próprio)
   Configuração padrão definida abaixo e pode ser sobrescrita via chrome.storage.sync:
     - supabase_rpc_base   -> ex: "https://<project>.supabase.co/rest/v1/rpc"
     - supabase_token      -> ex: "<ANON_OR_SERVICE_ROLE_JWT>"
     - supabase_function   -> ex: "update_user"
*/
self.addEventListener("install", () => {
  /* noop */
});
self.addEventListener("activate", () => {
  /* noop */
});

const SUPABASE_DEFAULTS = {
  rpcBase: "https://xlqydebyujtwafrqjajl.supabase.co/rest/v1/rpc",
  token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhscXlkZWJ5dWp0d2FmcnFqYWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMzU4NzMsImV4cCI6MjA2NDYxMTg3M30.j0R0hggjMQCmNcfoIIcinEXuktqdzcQzyvEYBUq8YqU",
  functionName: "update_user",
};

function trimSlash(u) {
  return String(u || "").replace(/\/$/, "");
}
function buildRpcUrl(base, fn) {
  return `${trimSlash(base)}/${String(fn || "").trim()}`;
}

function normalizePhone(phone) {
  const s = String(phone || "").trim();
  if (!s) return "";
  const cleaned = s.replace(/[^+\d]/g, "");
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return cleaned;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal, cache: "no-store", mode: "cors" });
  } finally {
    clearTimeout(t);
  }
}

async function loadSupabaseConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage?.sync?.get(["supabase_rpc_base", "supabase_token", "supabase_function"], (items) => {
        resolve({
          rpcBase: trimSlash(items?.supabase_rpc_base || SUPABASE_DEFAULTS.rpcBase),
          token: String(items?.supabase_token || SUPABASE_DEFAULTS.token),
          functionName: String(items?.supabase_function || SUPABASE_DEFAULTS.functionName),
        });
      });
    } catch (_) {
      resolve({ ...SUPABASE_DEFAULTS });
    }
  });
}

async function supabaseCall(fnName, body, { timeoutMs = 6000, prefer } = {}) {
  const cfg = await loadSupabaseConfig();
  if (!cfg.rpcBase || !cfg.token || !cfg.functionName) {
    const err = new Error("MISSING_SUPABASE_CONFIG");
    err.code = "MISSING_SUPABASE_CONFIG";
    err.config = cfg;
    throw err;
  }
  const url = buildRpcUrl(cfg.rpcBase, fnName || cfg.functionName);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    apikey: cfg.token,
    Authorization: `Bearer ${cfg.token}`,
  };
  if (prefer) headers["Prefer"] = String(prefer);
  const res = await fetchWithTimeout(url, { method: "POST", headers, body: JSON.stringify(body || {}) }, timeoutMs);
  let json = null;
  try {
    json = await res.json();
  } catch (_) {}
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = json;
    err.url = url;
    throw err;
  }
  return json;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || (message.type !== "atlas_health" && message.type !== "atlas_save_user")) return;

  (async () => {
    try {
      if (message.type === "atlas_health") {
        try {
          // Tenta uma chamada safe à função com rollback e retorno mínimo
          await supabaseCall(
            undefined,
            { do_nothing: true },
            { timeoutMs: 4000, prefer: "tx=rollback,return=minimal" }
          );
          sendResponse({ ok: true });
        } catch (e) {
          // Mesmo erro 400 (parâmetro inválido) ainda indica conectividade; só falha em 401/403/5xx/network
          if (e && typeof e.status === "number") {
            const status = e.status;
            const reachable = status >= 400 && status < 500 && status !== 401 && status !== 403;
            sendResponse({ ok: reachable, error: e.message, detail: e.body || null, status });
          } else {
            sendResponse({ ok: false, error: e?.message || String(e) });
          }
        }
        return;
      }

      // atlas_save_user -> envia para a função RPC definida (update_user) com { name, phone }
      const { name, phone } = message.payload || {};
      const nm = String(name || "").trim();
      let ph = normalizePhone(phone);
      const phoneRaw = String(phone || "").trim();
      // Valida telefone quando fornecido direto: rejeita se tiver letras ou não atingir 10 dígitos
      if (ph && phoneRaw) {
        const hasLettersProvided = /[A-Za-zÀ-ÿ]/.test(phoneRaw);
        const onlyAllowedCharsProvided = /^[\s()+\-.\d]+$/.test(phoneRaw);
        const digitCountProvided = (phoneRaw.match(/\d/g) || []).length;
        const numericLenProvided = ph.replace(/^\+/, "").length;
        if (
          hasLettersProvided ||
          !onlyAllowedCharsProvided ||
          digitCountProvided < 10 ||
          numericLenProvided < 10 ||
          numericLenProvided > 15
        ) {
          ph = "";
        }
      }
      if (!ph && nm) {
        // Deriva telefone do nome APENAS se o nome parecer um número puro (sem letras)
        // Critérios:
        //  - não conter letras (inclui acentos)
        //  - conter apenas dígitos e separadores comuns (espaço, +, -, ., parênteses)
        //  - ter ao menos 10 dígitos
        const nmRaw = String(name || "").trim();
        const hasLetters = /[A-Za-zÀ-ÿ]/.test(nmRaw);
        const onlyAllowedChars = /^[\s()+\-.\d]+$/.test(nmRaw);
        const digitCount = (nmRaw.match(/\d/g) || []).length;
        if (!hasLetters && onlyAllowedChars && digitCount >= 10) {
          const asPhone = normalizePhone(nmRaw);
          const numeric = asPhone.replace(/^\+/, "");
          if (numeric.length >= 10 && numeric.length <= 15) {
            ph = asPhone;
          }
        }
      }
      if (!nm && !ph) {
        sendResponse({ ok: true, skipped: true });
        return;
      }

      try {
        const result = await supabaseCall(undefined, { nome: nm, telefone: ph }, { timeoutMs: 8000 });
        sendResponse({ ok: true, result });
      } catch (e) {
        sendResponse({ ok: false, error: e?.message || String(e), detail: e?.body || null, status: e?.status || null });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || String(e) });
    }
  })();

  return true; // manter canal aberto para sendResponse async
});
