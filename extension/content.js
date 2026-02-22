(() => {
  if (window.__ndInitialized) return;
  window.__ndInitialized = true;

  const selectedPins = new Map();
  let selectMode = false;

  // ── Shadow DOM host for style isolation from Pinterest ──

  const host = document.createElement('div');
  host.id = 'neverdoom-host';
  host.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .nd-bar {
      all: initial;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 10px 16px;
      background: rgba(10, 10, 10, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      box-sizing: border-box;
    }
    .nd-bar.nd-visible { transform: translateY(0); }
    .nd-bar * { box-sizing: border-box; }

    .nd-btn {
      all: initial;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.08);
      color: #ccc;
      font-size: 13px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      line-height: 1;
    }
    .nd-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    .nd-btn:active { transform: scale(0.97); }

    .nd-btn-primary {
      background: rgba(255, 68, 68, 0.25);
      border-color: rgba(255, 68, 68, 0.4);
      color: #ff6b6b;
    }
    .nd-btn-primary:hover {
      background: rgba(255, 68, 68, 0.4);
      color: #ff9999;
      border-color: rgba(255, 68, 68, 0.6);
    }
    .nd-btn-primary:disabled {
      opacity: 0.35;
      cursor: not-allowed;
      transform: none;
    }

    .nd-status {
      color: #888;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .nd-progress-wrap {
      width: 120px;
      height: 4px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
      display: none;
    }
    .nd-progress-wrap.nd-active { display: block; }
    .nd-progress-bar {
      height: 100%;
      border-radius: 2px;
      background: #ff4444;
      width: 0%;
      transition: width 0.3s ease;
    }
  `;
  shadow.appendChild(style);

  const bar = document.createElement('div');
  bar.className = 'nd-bar';
  bar.innerHTML = `
    <button class="nd-btn" id="nd-toggle">Select Pins</button>
    <span class="nd-status" id="nd-count">0 selected</span>
    <div class="nd-progress-wrap" id="nd-progress-wrap">
      <div class="nd-progress-bar" id="nd-progress-bar"></div>
    </div>
    <button class="nd-btn nd-btn-primary" id="nd-push" disabled>
      Push to NeverDoom
    </button>
  `;
  shadow.appendChild(bar);
  document.documentElement.appendChild(host);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => bar.classList.add('nd-visible'));
  });

  const toggleBtn = shadow.querySelector('#nd-toggle');
  const pushBtn = shadow.querySelector('#nd-push');
  const countEl = shadow.querySelector('#nd-count');
  const progressWrap = shadow.querySelector('#nd-progress-wrap');
  const progressBar = shadow.querySelector('#nd-progress-bar');

  // ── Toast (also in shadow DOM) ──

  function showToast(msg, type = '') {
    const t = document.createElement('div');
    t.style.cssText = `
      all: initial;
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      padding: 12px 20px;
      border-radius: 10px;
      background: rgba(10, 10, 10, 0.95);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid ${type === 'error' ? 'rgba(255,68,68,0.3)' : 'rgba(68,255,68,0.3)'};
      color: ${type === 'error' ? '#ff6b6b' : '#6f6'};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      font-weight: 500;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    `;
    t.textContent = msg;
    shadow.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = '1';
      t.style.transform = 'translateY(0)';
    });
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateY(-10px)';
      setTimeout(() => t.remove(), 300);
    }, 3500);
  }

  // ── Selection Mode ──

  function updateCount() {
    const n = selectedPins.size;
    countEl.textContent = `${n} selected`;
    pushBtn.disabled = n === 0;
  }

  function toggleSelectMode() {
    selectMode = !selectMode;
    toggleBtn.textContent = selectMode ? 'Cancel Selection' : 'Select Pins';
    if (!selectMode) {
      clearSelections();
    }
  }

  function clearSelections() {
    document.querySelectorAll('.nd-pin-overlay').forEach(el => el.remove());
    selectedPins.clear();
    updateCount();
  }

  // ── Pin Detection ──

  function findPinContainer(el) {
    let node = el;
    for (let i = 0; i < 20; i++) {
      if (!node || node === document.body || node === document.documentElement) return null;
      const testId = node.dataset?.testId || node.getAttribute?.('data-test-id') || '';
      if (testId === 'pin' || testId === 'pinWrapper' || testId === 'pin-visual-wrapper') return node;
      if (node.getAttribute?.('role') === 'listitem') return node;
      if (node.classList?.contains('pinWrapper')) return node;
      const img = node.querySelector?.('img[src*="pinimg.com"]');
      if (img && node.offsetHeight > 50 && node.offsetWidth > 50) {
        const parent = node.parentElement;
        if (parent?.getAttribute?.('role') === 'listitem') return parent;
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function getImageFromPin(container) {
    const imgs = container.querySelectorAll('img[src*="pinimg.com"]');
    let best = null;
    for (const img of imgs) {
      if (!best || img.naturalWidth > best.naturalWidth) best = img;
    }
    if (!best) return null;
    return {
      src: upgradeImageUrl(best.src),
      alt: best.alt || ''
    };
  }

  function upgradeImageUrl(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const sizeIdx = parts.findIndex(p =>
        /^\d+x\d*$/.test(p) || /^\d+x$/.test(p) || p === 'originals'
      );
      if (sizeIdx !== -1) {
        parts[sizeIdx] = 'originals';
      }
      u.pathname = parts.join('/');
      return u.toString();
    } catch {
      return url;
    }
  }

  function addOverlay(container) {
    let overlay = container.querySelector('.nd-pin-overlay');
    if (overlay) return overlay;

    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    overlay = document.createElement('div');
    overlay.className = 'nd-pin-overlay';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: inherit;
      transition: all 0.15s ease;
      pointer-events: none;
    `;
    overlay.innerHTML = `
      <div class="nd-check" style="
        width: 36px; height: 36px; border-radius: 50%;
        background: #ff4444; display: flex; align-items: center;
        justify-content: center; opacity: 0; transform: scale(0.5);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
    `;
    container.appendChild(overlay);
    return overlay;
  }

  function markSelected(overlay, selected) {
    if (selected) {
      overlay.style.background = 'rgba(255, 68, 68, 0.18)';
      overlay.style.boxShadow = 'inset 0 0 0 3px rgba(255, 68, 68, 0.8)';
      const check = overlay.querySelector('.nd-check');
      if (check) { check.style.opacity = '1'; check.style.transform = 'scale(1)'; }
    } else {
      overlay.style.background = 'transparent';
      overlay.style.boxShadow = 'none';
      const check = overlay.querySelector('.nd-check');
      if (check) { check.style.opacity = '0'; check.style.transform = 'scale(0.5)'; }
    }
  }

  // ── Click Handler ──

  document.addEventListener('click', (e) => {
    if (!selectMode) return;
    if (host.contains(e.target)) return;

    const container = findPinContainer(e.target);
    if (!container) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const imgData = getImageFromPin(container);
    if (!imgData) return;

    const key = imgData.src;
    const overlay = addOverlay(container);

    if (selectedPins.has(key)) {
      selectedPins.delete(key);
      markSelected(overlay, false);
    } else {
      selectedPins.set(key, imgData);
      markSelected(overlay, true);
    }

    updateCount();
  }, true);

  // ── Push Handler ──

  async function handlePush() {
    if (selectedPins.size === 0) return;

    const pins = Array.from(selectedPins.values());
    pushBtn.disabled = true;
    pushBtn.textContent = 'Pushing...';
    progressWrap.classList.add('nd-active');
    progressBar.style.width = '0%';

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: 'PUSH_PINS', pins },
          (resp) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (resp?.error) {
              reject(new Error(resp.error));
            } else {
              resolve(resp);
            }
          }
        );
      });

      showToast(`Pushed ${pins.length} pin${pins.length > 1 ? 's' : ''} to NeverDoom!`, 'success');
      toggleSelectMode();
    } catch (err) {
      showToast(`Failed: ${err.message}`, 'error');
      pushBtn.disabled = false;
    } finally {
      pushBtn.textContent = 'Push to NeverDoom';
      progressWrap.classList.remove('nd-active');
    }
  }

  // ── Progress Listener ──

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PUSH_PROGRESS') {
      progressBar.style.width = `${msg.percent}%`;
    }
  });

  // ── Event Bindings ──

  toggleBtn.addEventListener('click', toggleSelectMode);
  pushBtn.addEventListener('click', handlePush);
})();
