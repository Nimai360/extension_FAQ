(function () {
  'use strict';
  function createEl(tag, { class: cls, text, html, attrs } = {}) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text != null) el.textContent = text;
    if (html != null) el.innerHTML = html;
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v);
    return el;
  }
  function safeText(value) { return value == null ? '' : String(value); }
  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 200);
    }, 1800);
  }
  function setStatus(statusEl, message) { if (statusEl) statusEl.textContent = message || ''; }
  function applyHeader(logoEl, data) { try { if (data.logo) logoEl.src = String(data.logo); } catch (_) {} }
  function populateModes(selectEl, data) {
    const list = Array.isArray(data?.faq) ? data.faq : [];
    selectEl.innerHTML = '';
    for (const item of list) {
      const key = String(item?.categoria || '').trim();
      if (!key) continue;
      const opt = createEl('option', { text: key, attrs: { value: key } });
      selectEl.appendChild(opt);
    }
  }
  function filterList(list, term) {
    const q = (term || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((it) => [it.title, it.subtitle, it.pergunta, it.resposta].filter(Boolean).some((t) => String(t).toLowerCase().includes(q)));
  }
  function normalizeItem(item) {
    return {
      title: safeText(item.title),
      subtitle: safeText(item.subtitle),
      pergunta: safeText(item.pergunta),
      resposta: safeText(item.resposta),
    };
  }
  function renderCard(item, handlers) {
    const { title, subtitle, pergunta, resposta } = normalizeItem(item);
    const box = createEl('section', { class: 'message-box' });

    const header = createEl('div', { class: 'collapse-header' });
    const titleEl = createEl('h3', { class: 'collapse-title', text: title || 'Mensagem' });
    const iconEl = createEl('span', { class: 'collapse-icon', text: '▾' });
    header.appendChild(titleEl); header.appendChild(iconEl);

    const content = createEl('div', { class: 'collapse-content' });
    if (subtitle) content.appendChild(createEl('p', { text: subtitle }));
    if (pergunta) {
      content.appendChild(createEl('p', { html: `<strong>Pergunta:</strong> ${escapeHtml(pergunta)}` }));
      content.appendChild(createEl('div', { class: 'hr' }));
      content.appendChild(createEl('p', { html: `<strong>Sua resposta:</strong>` }));
    }
    if (resposta) content.appendChild(createEl('p', { text: resposta }));

    const copyBtn = createEl('button', { class: 'copy-button', text: 'Copiar', attrs: { 'aria-label': 'Copiar resposta' } });
    copyBtn.addEventListener('click', async () => {
      try { await handlers.onCopy(resposta || ''); copyBtn.classList.add('copied'); const o = copyBtn.textContent; copyBtn.textContent = 'Copiado!'; setTimeout(()=>{ copyBtn.textContent=o; copyBtn.classList.remove('copied'); }, 2000); }
      catch (e) { showToast('Falha ao copiar a mensagem.'); }
    });

    const pasteBtn = createEl('button', { class: 'paste-button', text: 'Colar', attrs: { 'aria-label': 'Colar no WhatsApp' } });
    pasteBtn.addEventListener('click', async () => {
      try { await handlers.onPaste(resposta || ''); pasteBtn.classList.add('copied'); const o = pasteBtn.textContent; pasteBtn.textContent = 'Colado!'; setTimeout(()=>{ pasteBtn.textContent=o; pasteBtn.classList.remove('copied'); }, 2000); }
      catch (e) { console.error(e); showToast('Não foi possível colar. Abra uma conversa.'); }
    });

    const sendBtn = createEl('button', { class: 'send-button', text: 'Enviar', attrs: { 'aria-label': 'Enviar no WhatsApp' } });
    sendBtn.addEventListener('click', async () => {
      try { await handlers.onSend(resposta || ''); sendBtn.classList.add('copied'); const o = sendBtn.textContent; sendBtn.textContent = 'Enviado!'; setTimeout(()=>{ sendBtn.textContent=o; sendBtn.classList.remove('copied'); }, 2000); }
      catch (e) { console.error(e); showToast('Não foi possível enviar. Abra uma conversa no WhatsApp Web.'); }
    });

    const row = createEl('div', { class: 'copy-row' });
    row.appendChild(copyBtn); row.appendChild(pasteBtn); row.appendChild(sendBtn);
    content.appendChild(row);

    let open = true;
    header.addEventListener('click', () => { open = !open; content.style.display = open ? 'block' : 'none'; iconEl.textContent = open ? '▾' : '▸'; });

    box.appendChild(header);
    box.appendChild(content);
    return box;
  }
  function renderMode(data, mode, searchTerm, dom, handlers) {
    const cardsEl = dom.cardsEl; const headerTitleEl = dom.headerTitleEl; const headerSubtitleEl = dom.headerSubtitleEl; const statusEl = dom.statusEl;
    cardsEl.innerHTML = '';
    const arr = Array.isArray(data?.faq) ? data.faq : [];
    const sectionObj = arr.find((it) => it?.categoria === mode);
    const section = sectionObj?.data;
    if (!section) { setStatus(statusEl, 'Seção não encontrada no JSON.'); return; }

    headerTitleEl.textContent = section.title || 'Roteiro de Atendimento';
    headerSubtitleEl.textContent = section.subtitle || '';

    const list = Array.isArray(section.mensagens) ? section.mensagens : [];
    const filtered = filterList(list, searchTerm);
    if (filtered.length === 0) { setStatus(statusEl, 'Nenhum resultado para o filtro aplicado.'); return; }

    setStatus(statusEl, '');
    for (const item of filtered) { cardsEl.appendChild(renderCard(item, handlers)); }
  }

  const UI = { createEl, showToast, setStatus, applyHeader, populateModes, filterList, renderMode };
  window.App = window.App || {}; window.App.UI = UI;
})();
