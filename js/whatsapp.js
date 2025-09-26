(function () {
  'use strict';
  async function sendToWhatsApp(message, { pasteOnly = false } = {}, cfg) {
    if (!message) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab');

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (msg, justPaste, cfgInner) => {
        const INPUT_XPATH = (cfgInner && cfgInner.input_xpath) || '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[3]/div[1]/p';
        const SEND_XPATH = (cfgInner && cfgInner.send_xpath) || '//*[@id="main"]/footer/div[1]/div/span/div/div[2]/div/div[4]/button';
        function byXPath(xpath) {
          try {
            const node = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            return node || null;
          } catch (_) { return null; }
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
            'div[contenteditable="true"]'
          ];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.isContentEditable) return el;
          }
          return null;
        }
        function normalizeText(str) {
          return String(str || '')
            .replace(/\r/g, '')
            .replace(/\u00A0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n+$/g, '')
            .trim();
        }
        function getInputText(ed) {
          const node = byXPath(INPUT_XPATH);
          const source = node || ed;
          return String(source?.innerText || source?.textContent || '').replace(/\r/g, '');
        }

        const editable = getEditable();
        if (!editable) return 'NO_INPUT';

        // limpar e inserir usando execCommand
        editable.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editable);
        sel.removeAllRanges(); sel.addRange(range);
        document.execCommand('delete');

        // Normaliza \n literais para quebras reais
        const prepared = String(msg).replace(/\\n/g, '\n');
        const lines = prepared.split('\n');
        for (let i = 0; i < lines.length; i++) {
          document.execCommand('insertText', false, lines[i]);
          if (i < lines.length - 1) {
            if (!document.execCommand('insertLineBreak')) {
              document.execCommand('insertHTML', false, '<br>');
            }
          }
        }
        editable.dispatchEvent(new InputEvent('input', { bubbles: true }));

        if (justPaste) return 'PASTED';

        // Espera ativa
        const expected = normalizeText(prepared);
        const maxWaitMs = (cfgInner && Number(cfgInner.max_wait_ms)) ? Number(cfgInner.max_wait_ms) : 4000;
        const intervalMs = 100; let waited = 0;
        while (waited <= maxWaitMs) {
          const got = normalizeText(getInputText(getEditable() || editable));
          if (got === expected) break;
          await new Promise(r => setTimeout(r, intervalMs));
          waited += intervalMs;
        }

        // Enviar
        const sendBtn = byXPath(SEND_XPATH) ||
          document.querySelector('[data-testid="compose-btn-send"]') ||
          document.querySelector('[aria-label="Send"]') ||
          document.querySelector('span[data-icon="send"]')?.closest('button');
        if (sendBtn) { sendBtn.click(); return 'SENT'; }

        const ed2 = getEditable() || editable;
        ed2?.focus();
        ed2?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        ed2?.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return 'SENT_KEY';
      },
      args: [message, pasteOnly, cfg],
    });

    const result = results && results[0] && results[0].result;
    if (result === 'NO_INPUT') throw new Error('WhatsApp input not found');
    return result;
  }
  window.App = window.App || {};
  window.App.WhatsApp = { sendToWhatsApp };
})();
