chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PUSH_PINS') {
    handlePush(msg.pins, sender.tab?.id).then(sendResponse).catch(err =>
      sendResponse({ error: err.message })
    );
    return true; // keep channel open for async response
  }
});

async function handlePush(pins, tabId) {
  const { gh_token: token, gh_repo: repo } = await chrome.storage.local.get(['gh_token', 'gh_repo']);

  if (!token || !repo) {
    throw new Error('Not configured — open the extension popup first');
  }

  const [owner, repoName] = repo.split('/');
  const gh = makeGitHub(token, owner, repoName);
  const totalSteps = pins.length + 4;
  let step = 0;

  function progress() {
    step++;
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: 'PUSH_PROGRESS',
        percent: Math.round((step / totalSteps) * 100)
      });
    }
  }

  const ref = await gh.getRef('heads/main');
  const headSha = ref.object.sha;
  progress();

  const headCommit = await gh.getCommit(headSha);
  const baseTreeSha = headCommit.tree.sha;
  progress();

  const quotesFile = await gh.getContents('quotes.json');
  const existingQuotes = JSON.parse(atob(quotesFile.content.replace(/\n/g, '')));
  progress();

  const treeEntries = [];
  const newQuotes = [];

  for (const pin of pins) {
    const imageBytes = await fetchImageAsBase64(pin.src);
    const filename = makeFilename(pin.alt) + getExtension(pin.src);
    const path = `images/${filename}`;

    const blob = await gh.createBlob(imageBytes, 'base64');
    treeEntries.push({
      path,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });

    newQuotes.push({
      image: path,
      text: pin.alt || '',
      author: null,
      tags: []
    });

    progress();
  }

  const updatedQuotes = [...existingQuotes, ...newQuotes];
  const quotesBlob = await gh.createBlob(
    btoa(unescape(encodeURIComponent(JSON.stringify(updatedQuotes, null, 2) + '\n'))),
    'base64'
  );
  treeEntries.push({
    path: 'quotes.json',
    mode: '100644',
    type: 'blob',
    sha: quotesBlob.sha
  });

  const newTree = await gh.createTree(baseTreeSha, treeEntries);

  const commitMsg = `Add ${pins.length} quote${pins.length > 1 ? 's' : ''} from Pinterest`;
  const newCommit = await gh.createCommit(commitMsg, newTree.sha, headSha);

  await gh.updateRef('heads/main', newCommit.sha);
  progress();

  return { success: true, count: pins.length, commit: newCommit.sha };
}

// ── GitHub API wrapper ──

function makeGitHub(token, owner, repo) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  async function request(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `GitHub API ${res.status}`);
    }
    return res.json();
  }

  return {
    getRef: (ref) => request('GET', `/git/ref/${ref}`),
    getCommit: (sha) => request('GET', `/git/commits/${sha}`),
    getContents: (path) => request('GET', `/contents/${path}`),
    createBlob: (content, encoding) =>
      request('POST', '/git/blobs', { content, encoding }),
    createTree: (baseTree, tree) =>
      request('POST', '/git/trees', { base_tree: baseTree, tree }),
    createCommit: (message, tree, parent) =>
      request('POST', '/git/commits', { message, tree, parents: [parent] }),
    updateRef: (ref, sha) =>
      request('PATCH', `/git/refs/${ref}`, { sha })
  };
}

// ── Helpers ──

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function makeFilename(text) {
  if (!text || text.trim().length === 0) {
    return `pin-${Date.now()}`;
  }
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function getExtension(url) {
  try {
    const path = new URL(url).pathname;
    const ext = path.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return '.' + ext;
    }
  } catch {}
  return '.jpg';
}
