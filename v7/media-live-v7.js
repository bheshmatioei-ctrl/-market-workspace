/* V7 Live / Media extension: Bloomberg HT + YouTube */
(() => {
  const mediaNav = NAV.find(item => item[0] === 'youtube');
  if (mediaNav) {
    mediaNav[1] = '◉';
    mediaNav[2] = 'Live / Media';
  }

  TABS.youtube = ['Bloomberg HT Live', 'YouTube', 'Recent'];
  if (!S.tabs.youtube || S.tabs.youtube === 'Player') S.tabs.youtube = 'Bloomberg HT Live';
  save();

  const BLOOMBERG_HT_LIVE = 'https://www.bloomberght.com/tv/';

  const oldYoutubeBody = youtubeBody;
  youtubeBody = function mediaBody() {
    const tab = activeTab('youtube');

    if (tab === 'Bloomberg HT Live') {
      return `
        <div class="mediaHub">
          <div class="mediaToolbar">
            <div>
              <div class="liveEyebrow"><span class="liveDot"></span> OFFICIAL LIVE SOURCE</div>
              <h2 class="mediaTitle">Bloomberg HT · Canlı Yayın</h2>
              <div class="small">Financial television / Turkey · source: bloomberght.com</div>
            </div>
            <div class="splitPicker mediaActions">
              <button class="btn primary" data-open="${BLOOMBERG_HT_LIVE}">Open official live</button>
              <button class="btn" id="reloadBloomberg">↻ Reload</button>
              <button class="btn" id="mediaCapture">⌗ Capture</button>
            </div>
          </div>

          <div class="liveStage">
            <iframe
              id="bloombergHtFrame"
              class="liveFrame"
              src="${BLOOMBERG_HT_LIVE}"
              title="Bloomberg HT live television"
              loading="eager"
              allow="autoplay; fullscreen; picture-in-picture"
              allowfullscreen
              referrerpolicy="strict-origin-when-cross-origin"></iframe>
          </div>

          <div class="mediaNotice">
            <div><b>Provider-aware mode</b><br><span class="small">The workspace first attempts to show the official Bloomberg HT live page here. If Bloomberg HT blocks third-party framing in this browser, use “Open official live”; the workspace does not bypass publisher security or streaming restrictions.</span></div>
            <button class="btn" data-open="https://www.bloomberght.com/tv/programlar">Program schedule</button>
          </div>
        </div>`;
    }

    if (tab === 'YouTube') {
      return `<div class="ytWrap"><div class="ytControls"><input id="ytInput" placeholder="YouTube URL or video ID"><button class="btn" id="ytLoad">Load</button><button class="btn" id="ytPip">PiP</button></div><iframe class="ytFrame" src="https://www.youtube-nocookie.com/embed/${S.youtubeId}?playsinline=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }

    return `
      <div class="grid">
        <div class="card span6 mediaRecentCard" data-open="${BLOOMBERG_HT_LIVE}">
          <div class="liveEyebrow"><span class="liveDot"></span> LIVE SOURCE</div>
          <h3>Bloomberg HT</h3>
          <p class="small">Official live television and program schedule.</p>
          <button class="btn">Open live</button>
        </div>
        <div class="card span6">
          <div class="liveEyebrow">VIDEO</div>
          <h3>YouTube</h3>
          <p class="small">Last loaded video ID: ${esc(S.youtubeId)}</p>
          <button class="btn" id="goYouTubePlayer">Open YouTube player</button>
        </div>
      </div>`;
  };

  const originalBindAll = bindAll;
  bindAll = function bindAllWithMedia() {
    originalBindAll();

    const reload = document.getElementById('reloadBloomberg');
    if (reload) reload.onclick = () => {
      const frame = document.getElementById('bloombergHtFrame');
      if (frame) {
        frame.src = 'about:blank';
        requestAnimationFrame(() => { frame.src = BLOOMBERG_HT_LIVE; });
        toast('Bloomberg HT live reloaded');
      }
    };

    const cap = document.getElementById('mediaCapture');
    if (cap) cap.onclick = startCapture;

    const goYT = document.getElementById('goYouTubePlayer');
    if (goYT) goYT.onclick = () => {
      S.tabs.youtube = 'YouTube';
      save();
      renderWorkspace();
    };
  };

  render();
})();
