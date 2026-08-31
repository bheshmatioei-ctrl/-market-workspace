/* V7 Capture -> Research workflow */
(() => {
  const originalSave = save;
  let knownCaptureCount = Array.isArray(S.captures) ? S.captures.length : 0;

  const sectionLabel = id => ({home:'Home',market:'Market',news:'News',calendar:'Economic Calendar',watchlist:'Watchlist',notebook:'Notebook',ai:'Research Assistant',youtube:'Live / Media',research:'Research / Filings',settings:'Settings'}[id] || id || 'Workspace');
  const sourceLabel = () => {
    const sec = S.context.activeSection;
    if (sec === 'youtube') {
      const tab = activeTab('youtube');
      if (tab === 'Bloomberg HT Live') return 'Bloomberg HT · Live HLS';
      if (tab === 'YouTube') return 'YouTube';
      return 'Live / Media';
    }
    if (sec === 'market') return activeTab('market') || S.context.activeSource || 'Market';
    if (sec === 'news') return activeTab('news') || 'News';
    if (sec === 'calendar') return activeTab('calendar') || 'Economic Calendar';
    if (sec === 'research') return activeTab('research') || 'Research / Filings';
    return S.context.activeSource || sectionLabel(sec);
  };

  function normalizeCapture(c, index) {
    if (!c) return c;
    if (!c.id) c.id = `cap-${Date.now()}-${index}-${Math.random().toString(36).slice(2,7)}`;
    if (!c.ticker) c.ticker = S.context.activeTicker;
    if (!c.company) c.company = S.context.activeCompany;
    if (!c.section || c.section === 'ai') c.section = sectionLabel(S.context.activeSection);
    if (!c.source) c.source = sourceLabel();
    if (!c.range) c.range = S.context.activeDateRange || '—';
    if (!c.createdAt) c.createdAt = new Date().toISOString();
    if (!c.note) c.note = '';
    return c;
  }

  (S.captures || []).forEach(normalizeCapture);

  save = function captureAwareSave() {
    if (!Array.isArray(S.captures)) S.captures = [];
    S.captures.forEach(normalizeCapture);
    if (S.captures.length > knownCaptureCount) {
      const newest = S.captures[S.captures.length - 1];
      normalizeCapture(newest, S.captures.length - 1);
      newest.section = sectionLabel(S.context.activeSection);
      newest.source = sourceLabel();
      newest.ticker = S.context.activeTicker;
      newest.company = S.context.activeCompany;
      newest.range = S.context.activeDateRange || '—';
      S.context.activeCapture = newest;
    }
    knownCaptureCount = S.captures.length;
    originalSave();
  };

  function captureById(id) {
    return (S.captures || []).find(c => c.id === id);
  }

  function captureCard(c, compact=false) {
    const active = S.context.activeCapture && S.context.activeCapture.id === c.id;
    return `<div class="captureResearchCard ${active?'active':''}" data-capture-id="${esc(c.id)}">
      <div class="captureResearchTop">
        <div><b>${esc(c.ticker || '')}</b> <span class="captureCompany">${esc(c.company || '')}</span></div>
        ${active?'<span class="captureActiveBadge">ACTIVE</span>':''}
      </div>
      <div class="captureMetaRow"><span>${esc(c.section || '')}</span><span>${esc(c.source || '')}</span><span>${esc(c.time || c.createdAt || '')}</span></div>
      ${compact?'':`<textarea class="captureNoteInput" data-cap-note="${esc(c.id)}" placeholder="Add a note for this capture…">${esc(c.note || '')}</textarea>`}
      <div class="captureActions">
        <button class="btn capUse" data-id="${esc(c.id)}">Use in Research</button>
        <button class="btn capToNote" data-id="${esc(c.id)}">Add to Note</button>
        <button class="btn capPrompt" data-id="${esc(c.id)}">Prepare Prompt</button>
        <button class="btn capDelete" data-id="${esc(c.id)}">Delete</button>
      </div>
    </div>`;
  }

  const previousAiBody = aiBody;
  aiBody = function captureResearchAiBody() {
    const tab = activeTab('ai');
    if (tab !== 'Captures') return previousAiBody();
    const items = (S.captures || []).slice().reverse();
    return `<div class="researchPanel">
      <div class="researchHero">
        <div><div class="researchKicker">CAPTURE → RESEARCH</div><h2>${items.length} saved capture${items.length===1?'':'s'}</h2><div class="small">Each capture keeps ticker, source, section and time context.</div></div>
        <button class="btn primary" id="researchCaptureBtn">New capture</button>
      </div>
      ${items.length ? `<div class="captureResearchList">${items.map(c=>captureCard(c)).join('')}</div>` : '<div class="researchEmpty">No captures saved yet. Use Capture from the top bar or this panel.</div>'}
    </div>`;
  };

  const previousNotebookBody = notebookBody;
  notebookBody = function captureNotebookBody() {
    if (activeTab('notebook') !== 'Captures') return previousNotebookBody();
    const items = (S.captures || []).slice().reverse();
    return `<div class="grid"><div class="card span12"><div class="captureNotebookHead"><div><h3>CAPTURES</h3><p class="small">Saved research context from across the workspace.</p></div><button class="btn primary" id="notebookNewCapture">New capture</button></div>${items.length?`<div class="captureResearchList">${items.map(c=>captureCard(c,true)).join('')}</div>`:'<div class="researchEmpty">No captures yet.</div>'}</div></div>`;
  };

  const previousBindAll = bindAll;
  bindAll = function captureWorkflowBindAll() {
    previousBindAll();
    const newCap = document.getElementById('notebookNewCapture');
    if (newCap) newCap.onclick = startCapture;

    document.querySelectorAll('[data-cap-note]').forEach(el => {
      el.oninput = () => {
        const c = captureById(el.dataset.capNote);
        if (!c) return;
        c.note = el.value;
        originalSave();
      };
    });

    document.querySelectorAll('.capUse').forEach(btn => btn.onclick = () => {
      const c = captureById(btn.dataset.id); if (!c) return;
      S.context.activeCapture = c; S.context.activeTicker = c.ticker || S.context.activeTicker; S.context.activeCompany = c.company || S.context.activeCompany;
      originalSave(); renderWorkspace(); toast('Capture attached to Research');
    });

    document.querySelectorAll('.capToNote').forEach(btn => btn.onclick = () => {
      const c = captureById(btn.dataset.id); if (!c) return;
      const line = `[Capture · ${c.ticker} · ${c.source} · ${c.section} · ${c.time || c.createdAt}]${c.note?`\n${c.note}`:''}`;
      S.notes = `${(S.notes||'').trim()}${(S.notes||'').trim()?'\n\n':''}${line}`;
      originalSave(); toast('Capture added to Notebook note');
    });

    document.querySelectorAll('.capPrompt').forEach(btn => btn.onclick = () => {
      const c = captureById(btn.dataset.id); if (!c) return;
      S.context.activeCapture = c; S.tabs.ai = 'Prompt'; S.split = true; S.splitSecondary = 'ai';
      originalSave(); renderWorkspace(); toast('Prompt prepared from capture');
    });

    document.querySelectorAll('.capDelete').forEach(btn => btn.onclick = () => {
      const id = btn.dataset.id;
      S.captures = (S.captures || []).filter(c => c.id !== id);
      if (S.context.activeCapture && S.context.activeCapture.id === id) S.context.activeCapture = null;
      knownCaptureCount = S.captures.length;
      originalSave(); renderWorkspace(); toast('Capture deleted');
    });
  };

  originalSave();
  render();
})();
