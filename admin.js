(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const siteBase = new URL('../', location.href);
  const serviceSlots = [
    ['roofing-waterproofing', 'Roofing & Waterproofing'],
    ['windows-frames', 'Windows & Frames'],
    ['flooring-solutions', 'Flooring Solutions'],
    ['curtains-blinds', 'Curtains & Blinds'],
    ['plumbing-water', 'Plumbing & Water'],
    ['electrical-systems', 'Electrical Services'],
    ['doors-security', 'Doors & Security'],
    ['walls-surfaces', 'Walls & Surfaces'],
    ['carpentry-structures', 'Carpentry'],
    ['outdoor-grounds', 'Outdoor & Grounds'],
    ['deep-cleaning', 'Deep Cleaning'],
    ['inspections-audits', 'Inspections'],
    ['solar-energy', 'Solar Energy'],
    ['maintenance-plans', 'Maintenance Plans']
  ];
  const positions = [
    ['logo', 'Company logo'], ['hero', 'Home page hero image'],
    ...Array.from({length: 6}, (_, i) => [`gallery-${i + 1}`, `Gallery photo ${i + 1}`]),
    ...serviceSlots.map(([id, label]) => [`service-${id}`, `Service: ${label}`])
  ];
  const validSlots = new Set(positions.map(([id]) => id));
  positions.forEach(([value, label]) => $('#slot').add(new Option(label, value)));

  // Credentials are kept only in JS memory; never in the Git repository or web storage.
  let token = '', owner = '', repo = '', branch = '', records = [], busy = false;
  let temporaryPreview = '';
  const setStatus = (message, kind = '') => {
    $('#status').textContent = message;
    $('#status').className = kind;
  };
  const busyState = (value) => {
    busy = value;
    ['#connect', '#save', '#remove', '#import-legacy', '#disconnect', '#slot', '#alt', '#file'].forEach(id => {
      $(id).disabled = value;
    });
  };
  const repoPath = (path = '') => `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${path}`;
  const contentPath = path => '/contents/' + path.split('/').map(encodeURIComponent).join('/');

  async function github(url, options = {}, allowMissing = false) {
    const response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...options.headers
      },
      cache: 'no-store'
    });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) {
      let detail = '';
      try { detail = (await response.json()).message || ''; } catch (_) { /* ignore */ }
      const err = Error(`GitHub ${response.status}: ${detail || response.statusText}`);
      err.httpStatus = response.status;
      throw err;
    }
    return response.json();
  }
  const utf8ToBase64 = (text) => {
    const bytes = new TextEncoder().encode(text);
    let result = '';
    for (let i = 0; i < bytes.length; i += 16384) {
      result += String.fromCharCode(...bytes.subarray(i, i + 16384));
    }
    return btoa(result);
  };
  const base64ToUtf8 = (base64) => {
    const raw = atob(base64.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
  };
  const validatedRecords = data => {
    if (!Array.isArray(data)) throw Error('Repository image manifest must contain a JSON array.');
    return data.filter(m => m && validSlots.has(m.slot) &&
      typeof m.path === 'string' && /^assets\/uploads\/[a-z0-9-]+\.webp$/.test(m.path));
  };
  async function getContents(path) {
    return github(repoPath(contentPath(path)) + `?ref=${encodeURIComponent(branch)}`, {}, true);
  }
  async function readManifest() {
    const file = await getContents('assets/media.json');
    if (!file) throw Error('assets/media.json is missing. Upload the complete project folder to the repository first.');
    if (file.encoding !== 'base64') throw Error('Unexpected GitHub file encoding for assets/media.json.');
    let data;
    try { data = JSON.parse(base64ToUtf8(file.content)); }
    catch (_) { throw Error('assets/media.json contains invalid JSON.'); }
    return {sha: file.sha, records: validatedRecords(data)};
  }
  async function putFile(path, encodedContent, commitMessage, sha = null) {
    return github(repoPath(contentPath(path)), {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({message: commitMessage, content: encodedContent, branch, ...(sha ? {sha} : {})})
    });
  }
  async function modifyManifest(change) {
    // Refresh immediately before writing, and retry if another admin changed it.
    for (let tries = 0; tries < 3; tries++) {
      const current = await readManifest();
      const next = change(current.records);
      try {
        await putFile('assets/media.json', utf8ToBase64(JSON.stringify(next, null, 2) + '\n'),
          'HandyHive: update published website images', current.sha);
        records = next;
        return;
      } catch (err) {
        if (err.httpStatus !== 409 || tries === 2) throw err;
      }
    }
  }
  function selectedRecord() {
    return records.find(m => m.slot === $('#slot').value);
  }
  function refresh() {
    const item = selectedRecord();
    $('#alt').value = item?.alt || '';
    $('#preview').replaceChildren();
    if (!item) {
      const span = document.createElement('span');
      span.textContent = 'No replacement uploaded for this position.';
      $('#preview').append(span);
      return;
    }
    const img = new Image();
    img.alt = item.alt || item.slot;
    img.src = temporaryPreview || new URL(item.path, siteBase).href + '?v=' + encodeURIComponent(item.updatedAt || '1');
    img.onerror = () => {
      $('#preview').textContent = 'Image is committed. Preview will appear after GitHub Pages publishes the update.';
    };
    $('#preview').append(img);
  }
  $('#slot').addEventListener('change', () => { temporaryPreview = ''; refresh(); });
  function inferRepository() {
    // GitHub Pages project: OWNER.github.io/REPO/admin/ ; user site: OWNER.github.io/admin/
    const host = location.hostname.toLowerCase();
    if (!host.endsWith('.github.io')) return;
    $('#owner').value = host.slice(0, -'.github.io'.length);
    const pathname = location.pathname.split('/').filter(Boolean);
    $('#repo').value = pathname.length > 1 && pathname[0] !== 'admin' ? pathname[0] : $('#owner').value + '.github.io';
  }
  inferRepository();

  $('#connect-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    busyState(true);
    owner = $('#owner').value.trim();
    repo = $('#repo').value.trim();
    token = $('#token').value.trim();
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
      setStatus('Check the GitHub owner and repository name.', 'error');
      busyState(false);
      return;
    }
    setStatus('Connecting to GitHub…');
    try {
      const info = await github(repoPath());
      branch = info.default_branch;
      if (!branch) throw Error('The repository has no default branch.');
      const manifest = await readManifest();
      records = manifest.records;
      $('#token').value = '';
      $('#repo-label').textContent = `${owner}/${repo}`;
      $('#branch-label').textContent = `Publishing to ${branch}`;
      $('#connect-card').hidden = true;
      $('#editor-card').hidden = false;
      refresh();
      setStatus('Connected. Select a position to upload or remove an image.', 'success');
    } catch (err) {
      token = '';
      setStatus('Connection failed: ' + err.message, 'error');
    } finally { busyState(false); }
  });
  $('#disconnect').addEventListener('click', () => {
    token = ''; owner = ''; repo = ''; branch = ''; records = []; temporaryPreview = '';
    $('#token').value = '';
    $('#connect-card').hidden = false;
    $('#editor-card').hidden = true;
    setStatus('Disconnected. The access token has been cleared from this page.', 'success');
  });

  async function convertImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      !file.size || file.size > 5 * 1024 * 1024) {
      throw Error('Choose a valid JPG, PNG or WebP image no larger than 5 MB.');
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(Error('Cannot open the selected image.'));
        img.src = url;
      });
      if (!img.naturalWidth || !img.naturalHeight) throw Error('Image is empty.');
      const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/webp', .85);
      if (!data.startsWith('data:image/webp;base64,')) throw Error('This browser cannot produce WebP images.');
      return data;
    } finally { URL.revokeObjectURL(url); }
  }
  async function publish(slot, alt, dataURL) {
    if (!validSlots.has(slot)) throw Error('Invalid image position.');
    if (!/^data:image\/webp;base64,[a-zA-Z0-9+/=]+$/.test(dataURL)) throw Error('Image conversion failed.');
    const path = `assets/uploads/${slot}.webp`;
    const previous = await getContents(path);
    await putFile(path, dataURL.split(',')[1], `HandyHive: publish ${slot} image`, previous?.sha);
    // A manifest commit is required so public browsers read the latest image version.
    await modifyManifest(list => [
      ...list.filter(m => m.slot !== slot),
      {slot, alt: alt.slice(0, 180), path, updatedAt: new Date().toISOString()}
    ]);
  }
  $('#save').addEventListener('click', async () => {
    if (busy || !token) return;
    const file = $('#file').files[0];
    if (!file) { setStatus('Select an image first.', 'error'); return; }
    busyState(true);
    setStatus('Preparing and uploading the image to GitHub…');
    try {
      const slot = $('#slot').value;
      const alt = $('#alt').value.trim();
      const data = await convertImage(file);
      await publish(slot, alt, data);
      temporaryPreview = data;
      $('#file').value = '';
      refresh();
      setStatus('Image committed to GitHub. The change will be visible to all visitors after GitHub Pages publishes the new version (usually within a few minutes).', 'success');
    } catch (err) {
      setStatus('Could not publish image: ' + err.message + '\nIf the image was uploaded but the manifest update failed, retry the upload.', 'error');
    } finally { busyState(false); }
  });
  $('#remove').addEventListener('click', async () => {
    if (busy || !token) return;
    const slot = $('#slot').value;
    if (!selectedRecord()) { setStatus('No replacement image exists for this position.'); return; }
    busyState(true);
    setStatus('Removing the image from the public manifest…');
    try {
      await modifyManifest(list => list.filter(m => m.slot !== slot));
      temporaryPreview = '';
      refresh();
      setStatus('Replacement removed. GitHub Pages will show the original image, or no gallery image, after publishing. The old file remains in Git history.', 'success');
    } catch (err) { setStatus('Could not remove image: ' + err.message, 'error'); }
    finally { busyState(false); }
  });

  async function readLegacyImages() {
    if (!('indexedDB' in window)) return [];
    const name = 'handyhive:' + siteBase.pathname;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('settings')) request.result.createObjectStore('settings');
      };
      request.onerror = () => reject(request.error || Error('Unable to read previous browser images.'));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', 'readonly');
        const get = tx.objectStore('settings').get('media');
        get.onsuccess = () => { resolve(Array.isArray(get.result) ? get.result : []); db.close(); };
        get.onerror = () => { reject(get.error); db.close(); };
      };
    });
  }
  $('#import-legacy').addEventListener('click', async () => {
    if (busy || !token) return;
    busyState(true);
    try {
      const old = (await readLegacyImages()).filter(m => m && validSlots.has(m.slot) &&
        typeof m.data === 'string' && /^data:image\/webp;base64,/.test(m.data));
      if (!old.length) { setStatus('No previous browser-only images were found at this website address.'); return; }
      if (!window.confirm(`Publish ${old.length} previously saved image(s) from this browser to GitHub? This will replace the matching public image positions.`)) return;
      let count = 0;
      for (const entry of old) {
        setStatus(`Importing browser images: ${count + 1} of ${old.length}…`);
        await publish(entry.slot, entry.alt || '', entry.data);
        count++;
      }
      temporaryPreview = '';
      refresh();
      setStatus(`${count} previous image(s) committed to GitHub. They will become publicly visible after GitHub Pages publishes.`, 'success');
    } catch (err) { setStatus('Import interrupted: ' + err.message + '. Successfully committed earlier images are preserved.', 'error'); }
    finally { busyState(false); }
  });
})();
