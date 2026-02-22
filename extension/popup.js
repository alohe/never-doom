const tokenInput = document.getElementById('token');
const repoInput = document.getElementById('repo');
const saveBtn = document.getElementById('save');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');

function setStatus(state, msg) {
  statusEl.className = `status status-${state}`;
  statusText.textContent = msg;
}

chrome.storage.local.get(['gh_token', 'gh_repo'], (data) => {
  if (data.gh_token) tokenInput.value = data.gh_token;
  repoInput.value = data.gh_repo || 'alohe/never-doom';

  if (data.gh_token) {
    verifyToken(data.gh_token, data.gh_repo || 'alohe/never-doom');
  }
});

saveBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  const repo = repoInput.value.trim();

  if (!token) {
    setStatus('err', 'Token is required');
    return;
  }
  if (!repo || !repo.includes('/')) {
    setStatus('err', 'Repo must be owner/name');
    return;
  }

  saveBtn.textContent = 'Verifying...';
  saveBtn.disabled = true;

  const ok = await verifyToken(token, repo);

  if (ok) {
    chrome.storage.local.set({ gh_token: token, gh_repo: repo });
  }

  saveBtn.textContent = 'Save & Verify';
  saveBtn.disabled = false;
});

async function verifyToken(token, repo) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const data = await res.json();
      if (data.permissions?.push) {
        setStatus('ok', `Connected to ${repo}`);
        return true;
      } else {
        setStatus('err', 'Token lacks push access');
        return false;
      }
    } else if (res.status === 401) {
      setStatus('err', 'Invalid token');
      return false;
    } else if (res.status === 404) {
      setStatus('err', 'Repo not found');
      return false;
    } else {
      setStatus('err', `GitHub returned ${res.status}`);
      return false;
    }
  } catch (e) {
    setStatus('err', 'Network error');
    return false;
  }
}
