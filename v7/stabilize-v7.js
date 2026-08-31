/* V7 stabilization layer: practical research workflow, no fake AI */
(() => {
  const aiNav = NAV.find(item => item[0] === 'ai');
  if (aiNav) {
    aiNav[1] = '◈';
    aiNav[2] = 'Research Assistant';
  }

  TABS.ai = ['Context', 'Prompt', 'Captures', 'Notes'];
  if (!TABS.ai.includes(S.tabs.ai)) S.tabs.ai = 'Context';

  const aiBtn = document.getElementById('aiPanelBtn');
  if (aiBtn) aiBtn.querySelector('span').textContent = 'Research';

  function captureSummary() {
    const c = S.context.activeCapture || (S.captures && S.captures.length ? S.captures[S.captures.length - 1] : null);
    if (!c) return '<div class="researchEmpty">No capture attached yet.</div>';
    return `<div class="researchCapture"><b>${esc(c.ticker || S.context.activeTicker)}</b><span>${esc(c.section || 'workspace')}</span><span>${esc(c.time || '')}</span></div>`;
  }

  function contextPrompt() {
    const t = S.context.activeTicker;
    const c = S.context.activeCompany;
    const source = S.context.activeSource || 'Workspace';
    const note = (S.notes || '').trim();
    const cap = S.context.activeCapture || null;
    let out = `Market research context\nTicker: ${t}\nCompany: ${c}\nSource: ${source}\nSection: ${S.context.activeSection}\nDate range: ${S.context.activeDateRange || 'n/a'}\n\nTask:\nAnalyze the current context using verified current sources. Separate FACT, INTERPRETATION, UNCERTAINTY and FORECAST.`;
    if (note) out += `\n\nNotebook context:\n${note.slice(0, 2500)}`;
    if (cap) out += `\n\nCapture metadata:\n${JSON.stringify(cap)}`;
    return out;
  }

  aiBody = function researchPanelBody() {
    const tab = activeTab('ai');
    const t = S.context.activeTicker;
    const company = S.context.activeCompany;

    if (tab === 'Prompt') {
      return `<div class="researchPanel">
        <div class="researchHero"><div><div class="researchKicker">PREPARED RESEARCH CONTEXT</div><h2>${esc(t)} · ${esc(company)}</h2></div><span class="sourceBadge">LOCAL ONLY</span></div>
        <textarea id="researchPrompt" class="noteArea researchPrompt">${esc(contextPrompt())}</textarea>
        <div class="researchActions"><button class="btn primary" id="copyResearchPrompt">Copy prompt</button><button class="btn" data-go="notebook">Open Notebook</button><button class="btn" id="researchCaptureBtn">Capture</button></div>
        <p class="small researchFoot">This panel prepares context only. It does not claim to be connected to the OpenAI API.</p>
      </div>`;
    }

    if (tab === 'Captures') {
      const items = (S.captures || []).slice().reverse();
      return `<div class="researchPanel"><div class="researchHero"><div><div class="researchKicker">CAPTURE HISTORY</div><h2>${items.length} saved capture${items.length === 1 ? '' : 's'}</h2></div><button class="btn primary" id="researchCaptureBtn">New capture</button></div>${items.length ? `<div class="researchList">${items.map(c => `<div class="researchItem"><b>${esc(c.ticker || '')}</b><span>${esc(c.section || '')}</span><span>${esc(c.time || '')}</span></div>`).join('')}</div>` : '<div class="researchEmpty">No captures saved yet.</div>'}</div>`;
    }

    if (tab === 'Notes') {
      return `<div class="researchPanel"><div class="researchHero"><div><div class="researchKicker">WORKING NOTE</div><h2>${esc(t)} research note</h2></div><span class="sourceBadge">AUTO-SAVED LOCAL</span></div><textarea id="researchNoteArea" class="noteArea researchPrompt" placeholder="Write research notes…">${esc(S.notes || '')}</textarea><div class="researchActions"><button class="btn" data-go="notebook">Open full Notebook</button><button class="btn primary" id="copyNoteBtn">Copy note</button></div></div>`;
    }

    return `<div class="researchPanel">
      <div class="researchHero"><div><div class="researchKicker">ACTIVE RESEARCH CONTEXT</div><h2>${esc(t)} · ${esc(company)}</h2></div><span class="sourceBadge">${esc(S.context.activeSection).toUpperCase()}</span></div>
      <div class="researchContextGrid">
        <div class="researchMetric"><span>Ticker</span><b>${esc(t)}</b></div>
        <div class="researchMetric"><span>Source</span><b>${esc(S.context.activeSource || 'Workspace')}</b></div>
        <div class="researchMetric"><span>Range</span><b>${esc(S.context.activeDateRange || '—')}</b></div>
        <div class="researchMetric"><span>Captures</span><b>${(S.captures || []).length}</b></div>
      </div>
      <div class="researchBlock"><div class="researchBlockHead"><b>Latest capture</b><button class="btn" id="researchCaptureBtn">Capture</button></div>${captureSummary()}</div>
      <div class="researchBlock"><div class="researchBlockHead"><b>Quick workflow</b></div><div class="researchActions"><button class="btn" data-go="market">Market</button><button class="btn" data-go="news">News</button><button class="btn" data-go="notebook">Notebook</button><button class="btn primary" id="goPromptTab">Prepare prompt</button></div></div>
      <div class="researchBlock"><div class="researchBlockHead"><b>Notebook</b><span class="small">${(S.notes || '').trim() ? 'Research note available' : 'No note yet'}</span></div><div class="researchNotePreview">${esc((S.notes || '').trim().slice(0, 420) || 'Write a note in Notebook or the Notes tab.')}</div></div>
    </div>`;
  };

  const baseBindAll = bindAll;
  bindAll = function bindAllStabilized() {
    baseBindAll();
    const note = document.getElementById('researchNoteArea');
    if (note) note.oninput = () => { S.notes = note.value; save(); };
    const cap = document.getElementById('researchCaptureBtn');
    if (cap) cap.onclick = startCapture;
    const goPrompt = document.getElementById('goPromptTab');
    if (goPrompt) goPrompt.onclick = () => { S.tabs.ai = 'Prompt'; save(); renderWorkspace(); };
    const copyPrompt = document.getElementById('copyResearchPrompt');
    if (copyPrompt) copyPrompt.onclick = () => copyText(document.getElementById('researchPrompt').value).then(() => toast('Research prompt copied'));
    const copyNote = document.getElementById('copyNoteBtn');
    if (copyNote) copyNote.onclick = () => copyText(S.notes || '').then(() => toast('Note copied'));
  };

  const baseRender = render;
  render = function renderStabilized() {
    baseRender();
    const btn = document.getElementById('aiPanelBtn');
    if (btn) {
      const open = !!S.split && S.splitSecondary === 'ai' && window.innerWidth > 820;
      btn.querySelector('span').textContent = open ? 'Close Research' : 'Research';
    }
  };

  save();
  render();
})();
