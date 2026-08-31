/* V7 AI side panel quick toggle */
(() => {
  const btn = document.getElementById('aiPanelBtn');
  if (!btn) return;

  function syncButton() {
    const open = !!S.split && S.splitSecondary === 'ai' && window.innerWidth > 820;
    btn.classList.toggle('primary', open);
    btn.setAttribute('aria-pressed', open ? 'true' : 'false');
    btn.querySelector('span').textContent = open ? 'Close AI' : 'ChatGPT';
  }

  btn.onclick = () => {
    const isOpen = !!S.split && S.splitSecondary === 'ai';
    S.split = !isOpen;
    S.splitSecondary = 'ai';
    save();
    renderWorkspace();
    syncButton();
    toast(S.split ? 'AI panel opened on the right' : 'AI panel closed');
  };

  const oldRender = render;
  render = function renderWithAISidePanel() {
    oldRender();
    syncButton();
  };

  const oldRenderWorkspace = renderWorkspace;
  renderWorkspace = function renderWorkspaceWithAISidePanel() {
    oldRenderWorkspace();
    syncButton();
  };

  window.addEventListener('resize', syncButton);
  syncButton();
})();
