/* V7 Live / Media extension: Bloomberg HT direct HLS + YouTube */
(() => {
  const mediaNav = NAV.find(item => item[0] === 'youtube');
  if (mediaNav) {
    mediaNav[1] = '◉';
    mediaNav[2] = 'Live / Media';
  }

  TABS.youtube = ['Bloomberg HT Live', 'YouTube', 'Recent'];
  if (!S.tabs.youtube || S.tabs.youtube === 'Player') S.tabs.youtube = 'Bloomberg HT Live';
  save();

  const BLOOMBERG_HT_PAGE = 'https://www.bloomberght.com/tv/';
  const BLOOMBERG_HT_SCHEDULE = 'https://www.bloomberght.com/tv/programlar';
  // Public HLS endpoints currently used for Bloomberg HT distribution.
  // These are tried without tokens, headers, proxies, DRM bypasses, or publisher restrictions.
  const BLOOMBERG_HT_STREAMS = [
    'https://bloomberght-live.daioncdn.net/bloomberght/bloomberght.m3u8',
    'https://ciner-live.daioncdn.net/bloomberght/bloomberght_720p.m3u8',
    'https://ciner.daioncdn.net/bloomberght/bloomberght_720p.m3u8'
  ];

  let liveHls = null;
  let liveAttempt = 0;

  youtubeBody = function mediaBody() {
    const tab = activeTab('youtube');

    if (tab === 'Bloomberg HT Live') {
      return `
        <div class="mediaHub">
          <div class="mediaToolbar">
            <div>
              <div class="liveEyebrow"><span class="liveDot"></span> LIVE TV</div>
              <h2 class="mediaTitle">Bloomberg HT · Canlı Yayın</h2>
              <div class="small">Direct in-workspace player · public HLS source</div>
            </div>
            <div class="splitPicker mediaActions">
              <button class="btn" id="reloadBloomberg">↻ Reload</button>
              <button class="btn" id="liveMute">Mute</button>
              <button class="btn" id="liveFullscreen">Fullscreen</button>
              <button class="btn" id="mediaCapture">⌗ Capture</button>
            </div>
          </div>

          <div class="liveStage directPlayerStage">
            <video
              id="bloombergHtVideo"
              class="liveVideo"
              controls
              autoplay
              playsinline
              preload="auto"
              title="Bloomberg HT live television"></video>
            <div id="liveStatus" class="liveStatus">Connecting to Bloomberg HT live…</div>
          </div>

          <div class="mediaNotice">
            <div>
              <b>Direct player mode</b><br>
              <span class="small">The workspace plays the public Bloomberg HT HLS feed directly when the browser/CDN permits it. No login, token, proxy, DRM bypass, or publisher restriction is circumvented. If the public feed is unavailable, the official live page remains available as fallback.</span>
            </div>
            <div class="splitPicker">
              <button class="btn" data-open="${BLOOMBERG_HT_PAGE}">Official live page</button>
              <button class="btn" data-open="${BLOOMBERG_HT_SCHEDULE}">Program schedule</button>
            </div>
          </div>
        </div>`;
    }

    if (tab === 'YouTube') {
      return `<div class="ytWrap"><div class="ytControls"><input id="ytInput" placeholder="YouTube URL or video ID"><button class="btn" id="ytLoad">Load</button><button class="btn" id="ytPip">PiP</button></div><iframe class="ytFrame" src="https://www.youtube-nocookie.com/embed/${S.youtubeId}?playsinline=1&rel=0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`;
    }

    return `
      <div class="grid">
        <div class="card span6 mediaRecentCard" id="goBloombergLive">
          <div class="liveEyebrow"><span class="liveDot"></span> LIVE TV</div>
          <h3>Bloomberg HT</h3>
          <p class="small">Open the direct in-workspace live player.</p>
          <button class="btn primary">Watch live here</button>
        </div>
        <div class="card span6">
          <div class="liveEyebrow">VIDEO</div>
          <h3>YouTube</h3>
          <p class="small">Last loaded video ID: ${esc(S.youtubeId)}</p>
          <button class="btn" id="goYouTubePlayer">Open YouTube player</button>
        </div>
      </div>`;
  };

  function setLiveStatus(text, state = '') {
    const el = document.getElementById('liveStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.state = state;
  }

  function destroyLivePlayer() {
    if (liveHls) {
      try { liveHls.destroy(); } catch (_) {}
      liveHls = null;
    }
  }

  function nextStream(video, reason) {
    liveAttempt += 1;
    if (liveAttempt >= BLOOMBERG_HT_STREAMS.length) {
      setLiveStatus('Direct stream unavailable in this browser/network. Use “Official live page” below.', 'error');
      return;
    }
    setLiveStatus(`Trying alternate Bloomberg HT feed… (${liveAttempt + 1}/${BLOOMBERG_HT_STREAMS.length})`, 'loading');
    attachLiveStream(video, liveAttempt, reason);
  }

  function attachLiveStream(video, index = 0) {
    if (!video) return;
    destroyLivePlayer();
    liveAttempt = index;
    const src = BLOOMBERG_HT_STREAMS[index];
    setLiveStatus('Connecting to Bloomberg HT live…', 'loading');

    const onPlaying = () => setLiveStatus('LIVE · Bloomberg HT', 'ok');
    video.onplaying = onPlaying;
    video.oncanplay = () => {
      setLiveStatus('LIVE · Ready', 'ok');
      video.play().catch(() => setLiveStatus('Ready · tap Play to start audio/video', 'ok'));
    };
    video.onerror = () => nextStream(video, 'native-error');

    // Safari/iPadOS/Chrome-on-iPad use WebKit native HLS.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.load();
      video.play().catch(() => {});
      return;
    }

    // Desktop Chrome/Edge use hls.js when available.
    if (window.Hls && Hls.isSupported()) {
      liveHls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 20
      });
      liveHls.loadSource(src);
      liveHls.attachMedia(video);
      liveHls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLiveStatus('LIVE · Ready', 'ok');
        video.play().catch(() => setLiveStatus('Ready · press Play', 'ok'));
      });
      liveHls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return;
        destroyLivePlayer();
        nextStream(video, data.type);
      });
      return;
    }

    setLiveStatus('This browser has no HLS playback support. Use the official live page.', 'error');
  }

  const originalBindAll = bindAll;
  bindAll = function bindAllWithMedia() {
    originalBindAll();

    const video = document.getElementById('bloombergHtVideo');
    if (video) attachLiveStream(video, 0);

    const reload = document.getElementById('reloadBloomberg');
    if (reload) reload.onclick = () => {
      const v = document.getElementById('bloombergHtVideo');
      liveAttempt = 0;
      attachLiveStream(v, 0);
      toast('Bloomberg HT live reloaded');
    };

    const mute = document.getElementById('liveMute');
    if (mute) mute.onclick = () => {
      const v = document.getElementById('bloombergHtVideo');
      if (!v) return;
      v.muted = !v.muted;
      mute.textContent = v.muted ? 'Unmute' : 'Mute';
    };

    const fs = document.getElementById('liveFullscreen');
    if (fs) fs.onclick = async () => {
      const v = document.getElementById('bloombergHtVideo');
      if (!v) return;
      try {
        if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
        else if (v.requestFullscreen) await v.requestFullscreen();
      } catch (_) { toast('Fullscreen is not available in this browser'); }
    };

    const cap = document.getElementById('mediaCapture');
    if (cap) cap.onclick = startCapture;

    const goLive = document.getElementById('goBloombergLive');
    if (goLive) goLive.onclick = () => {
      S.tabs.youtube = 'Bloomberg HT Live';
      save();
      renderWorkspace();
    };

    const goYT = document.getElementById('goYouTubePlayer');
    if (goYT) goYT.onclick = () => {
      S.tabs.youtube = 'YouTube';
      save();
      renderWorkspace();
    };
  };

  render();
})();
