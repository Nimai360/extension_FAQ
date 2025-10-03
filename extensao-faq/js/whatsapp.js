(function () {
  "use strict";
  async function startContactWatcher(cfg) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return "NO_TAB";
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: (config) => {
        try {
          if (window.__atlasContactWatcherV2Started) return "ALREADY_STARTED";
          window.__atlasContactWatcherV2Started = true;
          const NAME_XPATH = config?.name_xpath || "//*[@id='main']/header/div[2]/div/div/div/div/span";
          const PHONE_XPATH =
            config?.phone_xpath ||
            "//*[@id='app']/div[1]/div[3]/div/div[5]/span/div/span/div/div/section/div[1]/div[2]/div[2]/span/div";
          const INTERVAL = Number(config?.watcher_interval_ms) || 500;

          function byXPath(xpath) {
            try {
              return (
                document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue ||
                null
              );
            } catch (_) {
              return null;
            }
          }
          function extractText(node) {
            if (!node) return "";
            try {
              const t0 = (typeof node.getAttribute === "function" ? node.getAttribute("title") || "" : "").trim();
              const t1 = (typeof node.innerText === "string" ? node.innerText : "").trim();
              const t2 = (node.textContent || "").trim();
              return t0 || t1 || t2;
            } catch (_) {
              return "";
            }
          }
          function canAlert() {
            try {
              return (
                document.visibilityState === "visible" &&
                (typeof document.hasFocus !== "function" || document.hasFocus())
              );
            } catch (_) {
              return true;
            }
          }
          function ensureBannerStyle() {
            if (document.getElementById("__atlas_notify_style")) return;
            const st = document.createElement("style");
            st.id = "__atlas_notify_style";
            st.textContent =
              ".atlas-notify{position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#202124;color:#fff;padding:10px 12px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,.3);font:14px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:360px;opacity:.95}";
            document.documentElement.appendChild(st);
          }
          function showBanner(text) {
            try {
              ensureBannerStyle();
              const el = document.createElement("div");
              el.className = "atlas-notify";
              el.textContent = text;
              document.documentElement.appendChild(el);
              setTimeout(() => {
                try {
                  el.remove();
                } catch (_) {}
              }, 4000);
            } catch (_) {}
          }
          function notify(text) {
            try {
              showBanner(text);
            } catch (_) {}
          }

          async function testMongoAndToast() {
            try {
              if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
                const resp = await new Promise((resolve) => {
                  try {
                    chrome.runtime.sendMessage({ type: "atlas_health" }, (r) => resolve(r));
                  } catch (_) {
                    resolve(null);
                  }
                });
                if (resp && resp.ok) {
                  // notify("Supabase: OK");
                } else {
                  const detail = resp?.error ? ` (${resp.error})` : "";
                  notify("Erro ao atualizar os dados no db: FALHA" + detail);
                }
              } else {
                notify("Banco de dados não localizado");
              }
            } catch (_) {}
          }

          const state = {
            namePresent: false,
            phonePresent: false,
            lastName: "",
            lastPhone: "",
            lastSentName: "",
            lastSentPhone: "",
          };

          function sendToBackground(name, phone) {
            try {
              if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
                chrome.runtime.sendMessage({
                  type: "atlas_save_user",
                  payload: { name: name || "", phone: phone || "" },
                });
              }
            } catch (_) {}
          }
          function maybeSend() {
            const name = state.lastName || "";
            const phone = state.lastPhone || "";
            if (name !== state.lastSentName || phone !== state.lastSentPhone) {
              state.lastSentName = name;
              state.lastSentPhone = phone;
              if (name || phone) sendToBackground(name, phone);
            }
          }

          function scan() {
            state.lastPhone = "";
            try {
              const n = byXPath(NAME_XPATH);
              if (n) {
                const nameText = extractText(n);
                if (!state.namePresent) {
                  state.namePresent = true;
                  // notify("Nome: " + (nameText || "(vazio)"));
                  testMongoAndToast();
                } else if (nameText !== state.lastName) {
                  // notify("Nome: " + (nameText || "(vazio)"));
                  testMongoAndToast();
                }
                state.lastName = nameText;
                maybeSend();
              }
              const p = byXPath(PHONE_XPATH);
              if (p) {
                const phoneText = extractText(p);
                if (!state.phonePresent) {
                  state.phonePresent = true;
                  // notify("Telefone: " + (phoneText || "(vazio)"));
                } else if (phoneText !== state.lastPhone) {
                  // notify("Telefone: " + (phoneText || "(vazio)"));
                }

                state.lastPhone = phoneText;
                maybeSend();
              }
            } catch (_) {}
          }
          scan();
          setInterval(scan, INTERVAL);
          return "STARTED";
        } catch (e) {
          return "ERROR";
        }
      },
      args: [cfg],
    });
    return results?.[0]?.result || "NO_RESULT";
  }

  async function sendToWhatsApp(message, { pasteOnly = false } = {}, cfg) {
    if (!message) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("No active tab");

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (msg, justPaste, cfgInner) => {
        const INPUT_XPATH =
          (cfgInner && cfgInner.input_xpath) || '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[3]/div[1]/p';
        const SEND_XPATH =
          (cfgInner && cfgInner.send_xpath) || '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[4]/button';
        function byXPath(xpath) {
          try {
            const node = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue;
            return node || null;
          } catch (_) {
            return null;
          }
        }
        function getEditable() {
          const p = byXPath(INPUT_XPATH);
          if (p) {
            const root = p.closest('[contenteditable="true"]');
            if (root) return root;
          }
          const selectors = [
            '[contenteditable="true"][data-tab="10"]',
            '[contenteditable="true"][data-tab="6"]',
            '[contenteditable="true"][role="textbox"]',
            '[data-testid="conversation-compose-box-input"]',
            '#main footer div[contenteditable="true"]',
            'div[contenteditable="true"]',
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.isContentEditable) return el;
          }
          return null;
        }
        function normalizeText(str) {
          return String(str || "")
            .replace(/\r/g, "")
            .replace(/\u00A0/g, " ")
            .replace(/[ \t]+\n/g, "\n")
            .replace(/\n+$/g, "")
            .trim();
        }
        function getInputText(ed) {
          const node = byXPath(INPUT_XPATH);
          const source = node || ed;
          return String(source?.innerText || source?.textContent || "").replace(/\r/g, "");
        }

        const editable = getEditable();
        if (!editable) return "NO_INPUT";

        // limpar e inserir usando execCommand
        editable.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editable);
        sel.removeAllRanges();
        sel.addRange(range);
        document.execCommand("delete");

        // Normaliza \n literais para quebras reais
        const prepared = String(msg).replace(/\\n/g, "\n");
        const lines = prepared.split("\n");
        for (let i = 0; i < lines.length; i++) {
          document.execCommand("insertText", false, lines[i]);
          if (i < lines.length - 1) {
            if (!document.execCommand("insertLineBreak")) {
              document.execCommand("insertHTML", false, "<br>");
            }
          }
        }
        editable.dispatchEvent(new InputEvent("input", { bubbles: true }));

        if (justPaste) return "PASTED";

        // Espera ativa
        const expected = normalizeText(prepared);
        const maxWaitMs = cfgInner && Number(cfgInner.max_wait_ms) ? Number(cfgInner.max_wait_ms) : 4000;
        const intervalMs = 100;
        let waited = 0;
        while (waited <= maxWaitMs) {
          const got = normalizeText(getInputText(getEditable() || editable));
          if (got === expected) break;
          await new Promise((r) => setTimeout(r, intervalMs));
          waited += intervalMs;
        }

        // Enviar
        const sendBtn =
          byXPath(SEND_XPATH) ||
          document.querySelector('[data-testid="compose-btn-send"]') ||
          document.querySelector('[aria-label="Send"]') ||
          document.querySelector('span[data-icon="send"]')?.closest("button");
        if (sendBtn) {
          sendBtn.click();
          return "SENT";
        }

        const ed2 = getEditable() || editable;
        ed2?.focus();
        ed2?.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
        );
        ed2?.dispatchEvent(
          new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true })
        );
        return "SENT_KEY";
      },
      args: [message, pasteOnly, cfg],
    });

    const result = results && results[0] && results[0].result;
    if (result === "NO_INPUT") throw new Error("WhatsApp input not found");
    return result;
  }
  window.App = window.App || {};
  window.App.WhatsApp = { sendToWhatsApp, startContactWatcher };
})();
