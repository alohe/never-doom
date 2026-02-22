(() => {
  if (window.__ndInitialized) return;
  window.__ndInitialized = true;

  const selectedPins = new Map();
  let selectMode = false;

  // ── UI Creation ──

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
  document.body.appendChild(bar);
  requestAnimationFrame(() => bar.classList.add('nd-visible'));

  const toggleBtn = bar.querySelector('#nd-toggle');
  const pushBtn = bar.querySelector('#nd-push');
  const countEl = bar.querySelector('#nd-count');
  const progressWrap = bar.querySelector('#nd-progress-wrap');
  const progressBar = bar.querySelector('#nd-progress-bar');

  // ── Toast ──

  function showToast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `nd-toast ${type ? 'nd-toast-' + type : ''}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('nd-toast-visible'));
    setTimeout(() => {
      t.classList.remove('nd-toast-visible');
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
    document.body.classList.toggle('nd-select-mode', selectMode);
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
    for (let i = 0; i < 15; i++) {
      if (!node) return null;
      if (node.dataset?.testId === 'pin' || node.dataset?.testId === 'pinWrapper') return node;
      if (node.getAttribute?.('role') === 'listitem') return node;
      if (node.classList?.contains('pinWrapper')) return node;
      node = node.parentElement;
    }
    return null;
  }

  function getImageFromPin(container) {
    const img = container.querySelector('img[src*="pinimg.com"]');
    if (!img) return null;
    return {
      src: upgradeImageUrl(img.src),
      alt: img.alt || ''
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
    if (container.querySelector('.nd-pin-overlay')) return container.querySelector('.nd-pin-overlay');
    const el = container.querySelector('[data-test-id="PinImage"]')?.parentElement
      || container.querySelector('img[src*="pinimg.com"]')?.parentElement
      || container;

    if (getComputedStyle(el).position === 'static') {
      el.style.position = 'relative';
    }

    const overlay = document.createElement('div');
    overlay.className = 'nd-pin-overlay';
    overlay.innerHTML = `<div class="nd-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>`;
    el.appendChild(overlay);
    return overlay;
  }

  // ── Click Handler ──

  document.addEventListener('click', (e) => {
    if (!selectMode) return;

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
      overlay.classList.remove('nd-selected');
    } else {
      selectedPins.set(key, imgData);
      overlay.classList.add('nd-selected');
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
