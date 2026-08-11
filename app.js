'use strict';
/* ============================== état ============================== */
const vp = document.getElementById('vp');
const stage = document.getElementById('stage');
const view = { x: 0, y: 0, s: 1 };
let items = [];            // img:{id,type,x,y,w,ar,rot,flip,filters,blob,url,el} | stroke:{..,pts,natW,natH,color,size} | text:{..,text,color,size,serif}
let selected = null;
let locked = false;
let gesture = null;
let ready = false;         // bloque la sauvegarde tant que la restauration n'est pas finie
let library = null;        // {v, current, boards:[{id, name, created, updated, count}]}
let tool = null;           // null = sélection, 'draw' = crayon
let editingText = null;    // item texte en cours d'édition
let editingTodo = null;    // {it, idx, span} ligne de checklist en cours d'édition
let presenting = false;    // mode présentation : UI masquée, navigation seule
let calScope = 'board';    // 'board' | 'all' — vue du calendrier
let libTab = 'boards';     // 'boards' | 'notes' — onglet de la librairie
const pointers = new Map(); // pointerId -> {x, y}
const MIN_W = 12, MAX_W = 100000, MIN_S = 0.02, MAX_S = 40, MAX_DIM = 2560;

const SWATCHES = [
  ['Charbon', '#1b1b1d'], ['Graphite', '#2e2e30'], ['Nuit', '#1e2740'],
  ['Sauge', '#8fa183'], ['Papier', '#f5f2ea'], ['Blanc', '#ffffff'],
];
const DEFAULT_BG = SWATCHES[0][1];
let bg = DEFAULT_BG;

const PEN_COLORS = ['#f5f2ea', '#161616', '#2b4ee6', '#c0563b', '#8fa183'];
const pen = { color: null, size: 5 };
try {
  const p = JSON.parse(localStorage.getItem('refy-pen') || 'null');
  if (p && PEN_COLORS.includes(p.color)) pen.color = p.color;
  if (p && p.size >= 2 && p.size <= 24) pen.size = p.size;
} catch (_) {}

/* ============================== langue ============================== */
const lang = (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
const LOCALE = lang === 'fr' ? 'fr-FR' : 'en-GB';
const I18N_FR = {
  saveFull: 'Sauvegarde impossible (stockage plein ?)', imgFull: 'Image non sauvegardée (stockage plein ?)',
  badFormat: 'Format non pris en charge : ', cantImport: 'Impossible d\'importer ',
  pdfReading: 'Lecture du PDF…', pdfOffline: 'Import PDF impossible (connexion nécessaire la première fois)',
  pdfPartial: (n, t) => `${n} premières pages importées (sur ${t})`, pdfDone: n => `PDF importé (${n} page${n > 1 ? 's' : ''})`,
  edgeFail: 'Extraction de contours impossible sur cette image',
  bwLabel: 'Noir & blanc', edgeLabel: 'Contours', contrastLabel: 'Contraste', opacityLabel: 'Opacité',
  resetLabel: 'Réinitialiser', extractLabel: 'Extraire la palette',
  palWorking: 'Extraction de la palette…', palNone: 'Pas de couleurs exploitables',
  palDone: 'Palette extraite — tape une couleur pour copier son code', palFail: 'Extraction impossible sur cette image',
  copied: h => h + ' copié',
  pngWorking: 'Rendu du board…', pngDone: 'PNG exporté', pngFail: 'Échec de l\'export PNG', boardEmpty: 'Board vide',
  presToast: 'Présentation — l\'œil en bas à droite pour sortir',
  lockToast: 'Verrouillé — maintiens le cadenas pour déverrouiller', unlockToast: 'Déverrouillé',
  renameTitle: 'Renommer', deleteTitle: 'Supprimer', linkTitle: 'Poser un lien sur le board actuel',
  linkPosed: n => `Lien vers « ${n} » posé — double-tape pour l'ouvrir`,
  namePrompt: 'Nom du board', delConfirm: n => `Supprimer « ${n} » et tout son contenu ?`,
  newBoardToast: 'Nouveau board', boardN: n => 'Board ' + n,
  countLabel: n => `${n} élément${n > 1 ? 's' : ''}`,
  loading: 'Chargement…', notesEmpty: 'Aucune note pour l\'instant. Pose du texte (T) ou une checklist (menu ···) sur un board.',
  emptyNote: '(vide)', allDone: 'Tout est fait', doneCount: (d, t) => `${d}/${t} fait`, todoAdd: 'Ajouter',
  linkDead: 'Ce board n\'existe plus', calNone: 'Rien de prévu.', calSaveFail: 'Calendrier non sauvegardé',
  nothingExport: 'Rien à sauvegarder', backupWorking: 'Préparation du backup…', backupDone: 'Backup exporté : ',
  exportFail: 'Échec de l\'export', fileBad: 'Fichier illisible', notBackup: 'Ce n\'est pas un backup Refy',
  importing: 'Import…', backupBad: 'Backup illisible',
  importDone: (n, c) => `« ${n} » importé (${c} élément${c > 1 ? 's' : ''})`,
  noStorage: 'Stockage indisponible : les boards ne seront pas conservés',
  clearConfirm: 'Supprimer tout le contenu de ce board ?',
  swatches: ['Charbon', 'Graphite', 'Nuit', 'Sauge', 'Papier', 'Blanc'],
  week: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
};
const I18N_EN = {
  saveFull: 'Could not save (storage full?)', imgFull: 'Image not saved (storage full?)',
  badFormat: 'Unsupported format: ', cantImport: 'Could not import ',
  pdfReading: 'Reading PDF…', pdfOffline: 'PDF import unavailable (needs a connection the first time)',
  pdfPartial: (n, t) => `First ${n} pages imported (of ${t})`, pdfDone: n => `PDF imported (${n} page${n > 1 ? 's' : ''})`,
  edgeFail: 'Could not extract edges from this image',
  bwLabel: 'Black & white', edgeLabel: 'Edges', contrastLabel: 'Contrast', opacityLabel: 'Opacity',
  resetLabel: 'Reset', extractLabel: 'Extract palette',
  palWorking: 'Extracting palette…', palNone: 'No usable colors',
  palDone: 'Palette extracted — tap a color to copy its code', palFail: 'Could not extract from this image',
  copied: h => h + ' copied',
  pngWorking: 'Rendering board…', pngDone: 'PNG exported', pngFail: 'PNG export failed', boardEmpty: 'Empty board',
  presToast: 'Presentation — tap the eye bottom right to exit',
  lockToast: 'Locked — hold the padlock to unlock', unlockToast: 'Unlocked',
  renameTitle: 'Rename', deleteTitle: 'Delete', linkTitle: 'Drop a link on the current board',
  linkPosed: n => `Link to “${n}” added — double-tap to open it`,
  namePrompt: 'Board name', delConfirm: n => `Delete “${n}” and all its content?`,
  newBoardToast: 'New board', boardN: n => 'Board ' + n,
  countLabel: n => `${n} item${n > 1 ? 's' : ''}`,
  loading: 'Loading…', notesEmpty: 'No notes yet. Drop some text (T) or a checklist (··· menu) on a board.',
  emptyNote: '(empty)', allDone: 'All done', doneCount: (d, t) => `${d}/${t} done`, todoAdd: 'Add',
  linkDead: 'This board no longer exists', calNone: 'Nothing planned.', calSaveFail: 'Calendar not saved',
  nothingExport: 'Nothing to save', backupWorking: 'Preparing backup…', backupDone: 'Backup exported: ',
  exportFail: 'Export failed', fileBad: 'Unreadable file', notBackup: 'This is not a Refy backup',
  importing: 'Importing…', backupBad: 'Unreadable backup',
  importDone: (n, c) => `“${n}” imported (${c} item${c > 1 ? 's' : ''})`,
  noStorage: 'Storage unavailable: boards will not be kept',
  clearConfirm: 'Delete everything on this board?',
  swatches: ['Charcoal', 'Graphite', 'Night', 'Sage', 'Paper', 'White'],
  week: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
  /* — textes statiques du DOM — */
  tbBoards: 'My boards', tbAdd: 'Add images', tbDraw: 'Pencil', tbText: 'Text', tbRot: 'Rotate 90°',
  tbFlip: 'Mirror horizontally', tbAdj: 'Adjustments', tbDel: 'Delete', tbFit: 'Fit everything',
  tbLock: 'Lock for tracing', tbMore: 'More', tbUndo: 'Undo last stroke', tbUnlock: 'Hold to unlock',
  tbPresQuit: 'Exit presentation', tbBg: 'Background color',
  mTodo: 'Checklist', mCal: 'Calendar', mBg: 'Board background', mPres: 'Presentation',
  mDoc: 'Import a document', mPng: 'Export as PNG', mExport: 'Export board', mImport: 'Import a backup', mHelp: 'Help',
  segNotes: 'Notes', segBoard: 'This board', segAll: 'All', calTitle: 'Calendar', libNew: 'New board',
  evPlaceholder: 'New event', dropHere: 'Drop your files here', clearBtn: 'Empty this board',
  helpTag: 'reference boards',
  hintSub: 'Add images with the + button, by dropping them here, or by pasting (Ctrl+V).<br>One finger: move · two fingers: size and rotation · padlock: freeze for tracing.<br>Your boards are saved automatically in this browser.',
  htAdd: 'Add', htPen: 'Pencil & text', htManip: 'Manipulate', htTrace: 'Trace', htTodo: 'Checklists & notes',
  htCal: 'Calendar', htPal: 'Palette & links', htPres: 'Presentation & export', htBackup: 'Backup', htKeys: 'Keyboard',
  hpBoards: 'The icon at the left of the bar opens your library: create, rename, delete and switch boards. Everything is saved automatically in the browser.',
  hpAdd: '+ button (photos), drag & drop, paste (<kbd>Ctrl/Cmd V</kbd> — images or text), and “Import a document” in the ··· menu for PDFs and text notes.',
  hpPen: 'The pencil draws freehand (color, weight, undo in the palette); two fingers navigate while drawing. T drops a text block: double-tap to edit it, handles to resize.',
  hpManip: 'One finger: move. Two fingers on an element: size + rotation (snaps to 0/90/180/270°). Corner handles: size. Top handle: rotation.',
  hpTrace: 'An image\'s adjustments (sliders icon) offer black & white, contrast, opacity and <b>edge extraction</b>. The padlock freezes the whole screen and keeps it awake — <b>hold it one second</b> to unlock.',
  hpTodo: 'Checklist in the ··· menu (<kbd>L</kbd>): tap to check, double-tap a line to edit it, Enter adds the next one. The <b>Notes</b> tab of the library gathers text and checklists from every board — tap to jump there.',
  hpCal: '··· menu or <kbd>C</kbd>: a local agenda, no sync. Each event belongs to the current board; the <b>All</b> view shows every board\'s agenda. Events travel with the board in backups.',
  hpPal: '“Extract palette” in an image\'s adjustments drops a swatch card of its colors (tap a color to copy its code). From the library, the chain icon drops a link card to another board — double-tap to open it.',
  hpPres: 'Presentation mode (<kbd>P</kbd>) hides the whole interface, navigation only. “Export as PNG” flattens the board into an image.',
  hpBackup: 'Export/Import in the ··· menu: the board becomes a file on your device; importing creates a new board.',
  hpKeys: '<kbd>B</kbd> boards · <kbd>D</kbd> pencil · <kbd>T</kbd> text · <kbd>L</kbd> checklist · <kbd>C</kbd> calendar · <kbd>P</kbd> presentation · <kbd>R</kbd> rotate · <kbd>M</kbd> mirror · <kbd>F</kbd> fit all · <kbd>Del</kbd> delete · <kbd>Esc</kbd> close',
};
const tr = k => (lang === 'fr' ? I18N_FR : I18N_EN)[k];
function applyI18n() {
  document.documentElement.lang = lang;
  if (lang === 'fr') return;
  for (const el of document.querySelectorAll('[data-i18n]')) { const v = I18N_EN[el.dataset.i18n]; if (v) el.textContent = v; }
  for (const el of document.querySelectorAll('[data-i18n-html]')) { const v = I18N_EN[el.dataset.i18nHtml]; if (v) el.innerHTML = v; }
  for (const el of document.querySelectorAll('[data-i18n-title]')) { const v = I18N_EN[el.dataset.i18nTitle]; if (v) el.title = v; }
  for (const el of document.querySelectorAll('[data-i18n-ph]')) { const v = I18N_EN[el.dataset.i18nPh]; if (v) el.placeholder = v; }
  const week = $('cal-week');
  if (week) [...week.children].forEach((s, i) => { s.textContent = I18N_EN.week[i]; });
}

const $ = id => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const toWorld = (sx, sy) => ({ x: (sx - view.x) / view.s, y: (sy - view.y) / view.s });
const MEASURED = { text: 1, todo: 1, palette: 1, link: 1 }; // hauteur mesurée dans le DOM
const itemH = it => MEASURED[it.type] ? (it.el ? it.el.offsetHeight : it.w / 2) : it.w / it.ar;
const itemCenter = it => ({ x: it.x + it.w / 2, y: it.y + itemH(it) / 2 });
const HALF_PI = Math.PI / 2;
function snapAngle(a) {
  const q = Math.round(a / HALF_PI) * HALF_PI;
  return Math.abs(a - q) < 0.06 ? q : a;
}
function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

function applyView() {
  stage.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  stage.style.setProperty('--vs', view.s);
}
function applyBg() {
  document.body.style.setProperty('--bg', bg);
  const c = parseInt(bg.slice(1), 16);
  const lum = (0.299 * (c >> 16) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
  document.body.classList.toggle('light', lum > 0.55);
  document.body.style.setProperty('--fg-dim', lum > 0.55 ? 'rgba(20,20,20,.5)' : 'rgba(255,255,255,.42)');
  for (const el of document.querySelectorAll('#swatches .chip')) el.classList.toggle('active', el.dataset.c === bg);
}
function updateHint() { $('hint').classList.toggle('hidden', items.length > 0); }
function toast(msg, ms = 2400) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden', 'pop');
  void t.offsetWidth;
  t.classList.add('pop');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.add('hidden'), ms);
}

/* animation douce de la vue */
let viewAnim = null;
function cancelViewAnim() { if (viewAnim) { cancelAnimationFrame(viewAnim); viewAnim = null; } }
function animateViewTo(tx, ty, ts) {
  cancelViewAnim();
  const f = { x: view.x, y: view.y, s: view.s };
  let start = null;
  const dur = 400, ease = t => 1 - Math.pow(1 - t, 3);
  function step(now) {
    if (start === null) start = now;
    const t = Math.min(1, (now - start) / dur), e = ease(t);
    view.x = f.x + (tx - f.x) * e;
    view.y = f.y + (ty - f.y) * e;
    view.s = f.s + (ts - f.s) * e;
    applyView();
    if (t < 1) viewAnim = requestAnimationFrame(step);
    else { viewAnim = null; scheduleSave(); }
  }
  viewAnim = requestAnimationFrame(step);
}

/* ============================== IndexedDB ============================== */
let db = null;
function openDB() {
  return new Promise(res => {
    if (!('indexedDB' in window)) return res(null);
    let rq;
    try { rq = indexedDB.open('refy', 1); } catch (e) { return res(null); }
    rq.onupgradeneeded = () => {
      rq.result.createObjectStore('images');
      rq.result.createObjectStore('meta');
    };
    rq.onsuccess = () => {
      const d = rq.result;
      d.onclose = () => { if (db === d) db = null; };       // Safari ferme la connexion en arrière-plan
      d.onversionchange = () => { d.close(); if (db === d) db = null; };
      res(d);
    };
    rq.onerror = () => res(null);
    rq.onblocked = () => res(null);
  });
}
async function idb(store, mode, fn) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (!db) db = await openDB();
    if (!db) return undefined;
    try {
      return await new Promise((res, rej) => {
        let tx;
        try { tx = db.transaction(store, mode); } catch (e) { return rej(e); }
        const rq = fn(tx.objectStore(store));
        tx.oncomplete = () => res(rq && rq.result);
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    } catch (e) {
      if (attempt === 0) { db = null; continue; }           // reconnexion puis nouvel essai
      throw e;
    }
  }
}
const dbPutImage = (id, blob) => idb('images', 'readwrite', s => s.put(blob, id));
const dbDelImage = id => idb('images', 'readwrite', s => s.delete(id));
const dbGetImage = id => idb('images', 'readonly', s => s.get(id));
const dbGetMeta = k => idb('meta', 'readonly', s => s.get(k));
const dbPutMeta = (k, v) => idb('meta', 'readwrite', s => s.put(v, k));
const dbDelMeta = k => idb('meta', 'readwrite', s => s.delete(k));

let saveTm = null;
function scheduleSave() {
  clearTimeout(saveTm);
  saveTm = setTimeout(() => { saveTm = null; saveState(); }, 400);
}
function flushSave() {
  commitTextEdit();                              // une édition en cours part avec la sauvegarde
  commitTodoEdit();
  if (saveTm) { clearTimeout(saveTm); saveTm = null; saveState(); }
}
addEventListener('pagehide', flushSave);

function serializeItem(it) {
  const base = { id: it.id, type: it.type, x: it.x, y: it.y, w: it.w, rot: it.rot };
  if (it.type === 'img') return { ...base, ar: it.ar, flip: it.flip, filters: it.filters };
  if (it.type === 'stroke') return { ...base, ar: it.ar, natW: it.natW, natH: it.natH, color: it.color, size: it.size, hit: it.hit, pts: it.pts };
  if (it.type === 'text') return { ...base, text: it.text, color: it.color, size: it.size, serif: !!it.serif };
  if (it.type === 'todo') return { ...base, size: it.size, entries: it.entries.map(e => ({ t: e.t, done: !!e.done })) };
  if (it.type === 'palette') return { ...base, colors: it.colors };
  if (it.type === 'link') return { ...base, target: it.target, name: it.name };
  return base;
}
function saveState() {
  if (!ready || !library) return;
  const state = {
    v: 4, view: { x: view.x, y: view.y, s: view.s }, locked, bg,
    items: items.map(serializeItem),
  };
  const b = library.boards.find(x => x.id === library.current);
  if (b) { b.updated = Date.now(); b.count = items.length; }
  Promise.all([dbPutMeta('state-' + library.current, state), dbPutMeta('library', library)])
    .catch(() => toast(tr('saveFull')));
}

/* ============================== construction des items ============================== */
function addHandles(el) {
  for (const c of ['nw', 'ne', 'sw', 'se', 'rot']) {
    const h = document.createElement('div');
    h.className = 'handle h-' + c;
    h.dataset.c = c;
    el.appendChild(h);
  }
}
function strokePath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
  }
  const l = pts[pts.length - 1];
  d += `L${l[0]} ${l[1]}`;
  return d;
}
function makeItemEl(it) {
  const el = document.createElement('div');
  el.className = 'item ' + it.type;
  el.dataset.id = it.id;
  if (it.type === 'img') {
    const img = document.createElement('img');
    img.src = it.url;
    img.alt = '';
    el.appendChild(img);
  } else if (it.type === 'stroke') {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'stroke-svg');
    svg.setAttribute('viewBox', `0 0 ${it.natW} ${it.natH}`);
    const d = strokePath(it.pts);
    for (const [cls, w] of [['hit', it.hit || it.size * 3], ['ink', it.size]]) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke-width', w);
      p.setAttribute('stroke-linecap', 'round');
      p.setAttribute('stroke-linejoin', 'round');
      p.setAttribute('class', cls);
      if (cls === 'ink') p.setAttribute('stroke', it.color);
      svg.appendChild(p);
    }
    el.appendChild(svg);
  } else if (it.type === 'text') {
    const tx = document.createElement('div');
    tx.className = 'tx' + (it.serif ? ' serif' : '');
    tx.textContent = it.text;
    el.appendChild(tx);
  } else if (it.type === 'todo') {
    const box = document.createElement('div');
    box.className = 'tbox';
    el.appendChild(box);
  } else if (it.type === 'palette') {
    for (const c of it.colors) {
      const cell = document.createElement('div');
      cell.className = 'pcell';
      const pc = document.createElement('div');
      pc.className = 'pc';
      pc.style.background = c;
      const hex = document.createElement('div');
      hex.className = 'phex';
      hex.textContent = c;
      cell.append(pc, hex);
      el.appendChild(cell);
    }
  } else if (it.type === 'link') {
    el.innerHTML = '<svg class="ic lic" viewBox="0 0 24 24"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M20 9v9a2 2 0 0 1-2 2H9"/></svg>'
      + '<span class="lname"></span>'
      + '<svg class="ic larrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  }
  addHandles(el);
  if (it.type === 'todo') updateTodoDOM(it, el);
  if (it.type === 'link') updateLinkDOM(it, el);
  return el;
}

function updateTodoDOM(it, el) {
  const box = (el || it.el).querySelector('.tbox');
  box.innerHTML = '';
  it.entries.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'trow';
    row.dataset.i = i;
    const check = document.createElement('button');
    check.className = 'todo-check' + (entry.done ? ' done' : '');
    const label = document.createElement('span');
    label.className = 'tlabel' + (entry.done ? ' done' : '');
    label.textContent = entry.t;
    row.append(check, label);
    box.appendChild(row);
  });
  const add = document.createElement('div');
  add.className = 'trow tadd';
  add.innerHTML = '<button class="todo-plus"></button><span class="tlabel">' + tr('todoAdd') + '</span>';
  box.appendChild(add);
}
function updateLinkDOM(it, el) {
  const b = library && boardMeta(it.target);
  if (b) it.name = b.name;
  const root = el || it.el;
  root.querySelector('.lname').textContent = it.name || 'Board';
  root.classList.toggle('dead', !b);
}
function renderItem(it) {
  it.el.style.transform = `translate(${it.x}px, ${it.y}px) rotate(${it.rot}rad)`;
  it.el.style.width = it.w + 'px';
  if (it.type === 'img') {
    it.el.firstChild.style.transform = it.flip ? 'scaleX(-1)' : '';
    applyFilters(it);
  } else if (it.type === 'text') {
    const tx = it.el.firstChild;
    tx.style.fontSize = it.size + 'px';
    tx.style.color = it.color;
    tx.classList.toggle('serif', !!it.serif);
  } else if (it.type === 'todo' || it.type === 'palette' || it.type === 'link') {
    it.el.style.fontSize = (it.size || it.w / 14) + 'px';
  }
}
function addItem(it) {
  it.rot = it.rot || 0;
  if (it.type === 'img') { it.flip = !!it.flip; it.filters = it.filters || {}; }
  it.el = makeItemEl(it);
  stage.appendChild(it.el);
  renderItem(it);
  it.el.classList.add('born');
  it.el.addEventListener('animationend', () => it.el.classList.remove('born'), { once: true });
  items.push(it);
  updateHint();
}
function bringToFront(it) {
  if (items[items.length - 1] !== it) {
    items.splice(items.indexOf(it), 1);
    items.push(it);
    stage.appendChild(it.el);
  }
}
function select(it) {
  if (selected === it) return;
  if (selected) selected.el.classList.remove('selected');
  selected = it;
  if (it) it.el.classList.add('selected');
  document.body.classList.toggle('has-selection', !!it);
  document.body.classList.toggle('sel-img', !!it && it.type === 'img');
  document.body.classList.toggle('sel-text', !!it && it.type === 'text');
  $('adjust').classList.remove('open');
}
function removeItem(it, instant) {
  if (editingText === it) commitTextEdit();
  if (editingTodo && editingTodo.it === it) commitTodoEdit();
  if (selected === it) select(null);
  const el = it.el, url = it.url;
  if (instant) {
    el.remove();
    if (url) URL.revokeObjectURL(url);
  } else {
    el.classList.add('dying');
    el.style.pointerEvents = 'none';
    setTimeout(() => { el.remove(); if (url) URL.revokeObjectURL(url); }, 220);
  }
  if (it._edgeUrl) { URL.revokeObjectURL(it._edgeUrl); it._edgeUrl = null; }
  items.splice(items.indexOf(it), 1);
  if (it.type === 'img') dbDelImage(it.id).catch(() => {});
  updateHint();
  scheduleSave();
}

function loadBlobAsImage(blob) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => res({ url, img, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('image illisible')); };
    img.src = url;
  });
}

/* Réduit les photos énormes (12 Mpx iPad…) pour éviter de saturer la mémoire. */
async function normalizeImage(blob) {
  if (blob.type === 'image/svg+xml' || blob.type === 'image/gif') return blob;
  const info = await loadBlobAsImage(blob);
  try {
    if (Math.max(info.w, info.h) <= MAX_DIM || !info.w || !info.h) return blob;
    const f = MAX_DIM / Math.max(info.w, info.h);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(info.w * f);
    canvas.height = Math.round(info.h * f);
    canvas.getContext('2d').drawImage(info.img, 0, 0, canvas.width, canvas.height);
    const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const out = await new Promise(r => canvas.toBlob(r, type, 0.88));
    return out || blob;
  } finally {
    URL.revokeObjectURL(info.url);
  }
}

async function addImageBlob(blob, opts) {
  const norm = await normalizeImage(blob);
  const info = await loadBlobAsImage(norm);
  const id = uid();
  const ar = info.w / info.h || 1;
  const at = (opts && opts.at) || toWorld(innerWidth / 2, innerHeight / 2);
  const w = (opts && opts.w) || (0.45 * Math.min(innerWidth, innerHeight)) / view.s;
  const it = {
    id, type: 'img', ar, w,
    x: at.x - w / 2, y: at.y - w / ar / 2,
    rot: 0, flip: false, filters: {}, blob: norm, url: info.url,
  };
  addItem(it);
  dbPutImage(id, norm).catch(() => toast(tr('imgFull')));
  return it;
}

function addTodoItem() {
  const at = toWorld(innerWidth / 2, innerHeight / 2);
  const w = 300 / view.s;
  const it = {
    id: uid(), type: 'todo',
    x: at.x - w / 2, y: at.y - w / 4, w,
    rot: 0, size: 15 / view.s,
    entries: [],
  };
  addItem(it);
  return it;
}
function addPaletteItem(colors, at, w) {
  const it = {
    id: uid(), type: 'palette',
    x: at.x, y: at.y, w,
    rot: 0, colors,
  };
  addItem(it);
  return it;
}
function addLinkItem(board) {
  const at = toWorld(innerWidth / 2, innerHeight / 2);
  const w = 230 / view.s;
  const it = {
    id: uid(), type: 'link',
    x: at.x - w / 2, y: at.y, w,
    rot: 0, target: board.id, name: board.name,
  };
  addItem(it);
  return it;
}
function addTextItem(text, opts) {
  const at = (opts && opts.at) || toWorld(innerWidth / 2, innerHeight / 2);
  const size = (opts && opts.size) || 22 / view.s;
  const w = (opts && opts.w) || 280 / view.s;
  const it = {
    id: uid(), type: 'text',
    x: at.x - w / 2, y: at.y - size, w,
    rot: 0, text: text || '', size,
    color: document.body.classList.contains('light') ? '#161616' : '#f5f2ea',
    serif: false,
  };
  addItem(it);
  return it;
}

/* ============================== import de fichiers ============================== */
const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|avif|heic|heif|svg)$/i;
async function importFiles(files, atScreen) {
  const list = [...files];
  let n = 0;
  for (const file of list) {
    const at = atScreen ? toWorld(atScreen.x + n * 24, atScreen.y + n * 24) : null;
    try {
      if (file.type.startsWith('image/') || IMG_RE.test(file.name)) {
        const it = await addImageBlob(file, at ? { at } : undefined);
        if (!at) { it.x += n * 24 / view.s; it.y += n * 24 / view.s; renderItem(it); }
        select(it);
        n++;
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        await importPdf(file, at);
        n++;
      } else if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
        if (file.size > 2_000_000) { toast(tr('cantImport') + file.name); continue; }
        const text = (await file.text()).slice(0, 20000);
        if (!text.trim()) continue;
        const it = addTextItem(text.trim(), { at: at || undefined, size: 15 / view.s, w: 420 / view.s });
        select(it);
        n++;
      } else {
        toast(tr('badFormat') + file.name);
      }
    } catch (e) {
      toast(tr('cantImport') + file.name);
    }
  }
  if (n) scheduleSave();
}

/* PDF : rendu des pages en images via pdf.js, chargé à la demande. */
const PDFJS_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
let pdfjsReady = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (pdfjsReady) return pdfjsReady;
  pdfjsReady = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS_BASE + 'pdf.min.js';
    s.onload = () => {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_BASE + 'pdf.worker.min.js';
        res();
      } catch (e) { rej(e); }
    };
    s.onerror = () => { pdfjsReady = null; rej(new Error('pdfjs')); };
    document.head.appendChild(s);
  });
  return pdfjsReady;
}
async function importPdf(file, at) {
  toast(tr('pdfReading'));
  try { await loadPdfJs(); } catch (e) { toast(tr('pdfOffline'), 3500); return; }
  const doc = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const total = doc.numPages, n = Math.min(total, 20);
  const base = at || toWorld(innerWidth / 2, innerHeight / 2);
  const w = (0.4 * Math.min(innerWidth, innerHeight)) / view.s;
  let ok = 0;
  for (let p = 1; p <= n; p++) {
    try {
      const page = await doc.getPage(p);
      let vpt = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, 1600 / vpt.width, 2600 / vpt.height); // borne aussi la hauteur (limite canvas Safari)
      vpt = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(vpt.width);
      canvas.height = Math.round(vpt.height);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vpt }).promise;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) continue;
      const col = (p - 1) % 4, row = Math.floor((p - 1) / 4);
      const it = await addImageBlob(blob, { at: { x: base.x + col * w * 1.06, y: base.y + row * w * 1.35 }, w });
      select(it);
      ok++;
      scheduleSave(); // les pages déjà importées sont sauvées même si la suite échoue
    } catch (e) { /* page illisible : on passe à la suivante */ }
  }
  toast(total > n ? tr('pdfPartial')(ok, total) : tr('pdfDone')(ok));
  scheduleSave();
}

/* ============================== filtres image (décalque) ============================== */
function applyFilters(it) {
  if (it.type !== 'img') return;
  const f = it.filters || {};
  const img = it.el.firstChild;
  img.style.filter = `grayscale(${f.bw ? 1 : 0}) contrast(${f.contrast || 1})`;
  it.el.style.opacity = f.opacity != null ? f.opacity : 1;
  if (f.edge) {
    if (it._edgeUrl) { img.src = it._edgeUrl; }
    else {
      if (!it._edgePromise) it._edgePromise = generateEdges(it); // une seule passe Sobel par image
      it._edgePromise.then(url => {
        it._edgeUrl = url;
        if (it.filters.edge && it.el) it.el.firstChild.src = url;
      }).catch(() => { it._edgePromise = null; it.filters.edge = 0; toast(tr('edgeFail')); });
    }
  } else if (img.src !== it.url) {
    img.src = it.url;
  }
}
/* Sobel : lignes noires sur fond blanc, idéal pour décalquer. */
async function generateEdges(it) {
  const info = await loadBlobAsImage(it.blob);
  try {
    const max = 1600;
    const f = Math.min(1, max / Math.max(info.w, info.h));
    const w = Math.max(2, Math.round(info.w * f)), h = Math.max(2, Math.round(info.h * f));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(info.img, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h);
    const g = new Float32Array(w * h);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) {
      g[i] = 0.299 * src.data[j] + 0.587 * src.data[j + 1] + 0.114 * src.data[j + 2];
    }
    const out = ctx.createImageData(w, h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
        const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
        const mag = Math.sqrt(gx * gx + gy * gy);
        const v = 255 - Math.min(255, mag * 1.4);
        const j = i * 4;
        out.data[j] = out.data[j + 1] = out.data[j + 2] = v;
        out.data[j + 3] = 255;
      }
    }
    // bords du cadre en blanc
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const j = (y * w + x) * 4; out.data[j] = out.data[j+1] = out.data[j+2] = out.data[j+3] = 255; }
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const j = (y * w + x) * 4; out.data[j] = out.data[j+1] = out.data[j+2] = out.data[j+3] = 255; }
    ctx.putImageData(out, 0, 0);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('toBlob');
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(info.url);
  }
}

/* panneau de réglages contextuel */
function buildAdjust() {
  const it = selected;
  const box = $('adjust');
  box.innerHTML = '';
  if (!it) return;
  if (it.type === 'img') {
    const f = it.filters;
    const toggles = document.createElement('div');
    toggles.className = 'atoggles';
    for (const [key, label] of [['bw', tr('bwLabel')], ['edge', tr('edgeLabel')]]) {
      const b = document.createElement('button');
      b.className = 'tgl' + (f[key] ? ' on' : '');
      b.textContent = label;
      b.addEventListener('click', () => {
        f[key] = f[key] ? 0 : 1;
        b.classList.toggle('on', !!f[key]);
        applyFilters(it);
        scheduleSave();
      });
      toggles.appendChild(b);
    }
    box.appendChild(toggles);
    for (const [key, label, min, max, step, def] of [
      ['contrast', tr('contrastLabel'), 0.5, 2.5, 0.05, 1],
      ['opacity', tr('opacityLabel'), 0.15, 1, 0.05, 1],
    ]) {
      const row = document.createElement('div');
      row.className = 'arow';
      const lab = document.createElement('label');
      lab.textContent = label;
      const r = document.createElement('input');
      r.type = 'range'; r.min = min; r.max = max; r.step = step;
      r.value = f[key] != null ? f[key] : def;
      r.addEventListener('input', () => { f[key] = +r.value; applyFilters(it); scheduleSave(); });
      row.append(lab, r);
      box.appendChild(row);
    }
    const pal = document.createElement('button');
    pal.className = 'tgl';
    pal.textContent = tr('extractLabel');
    pal.addEventListener('click', () => { closePopovers(); extractPalette(it); });
    box.appendChild(pal);
    const reset = document.createElement('button');
    reset.className = 'areset';
    reset.textContent = tr('resetLabel');
    reset.addEventListener('click', () => { it.filters = {}; applyFilters(it); buildAdjust(); scheduleSave(); });
    box.appendChild(reset);
  } else if (it.type === 'text') {
    const colors = document.createElement('div');
    colors.style.display = 'flex';
    colors.style.gap = '8px';
    for (const c of PEN_COLORS) {
      const chip = document.createElement('button');
      chip.className = 'chip' + (it.color === c ? ' active' : '');
      chip.style.background = c;
      chip.style.width = chip.style.height = '26px';
      chip.style.borderRadius = '50%';
      chip.addEventListener('click', () => {
        it.color = c;
        renderItem(it);
        for (const el of colors.children) el.classList.toggle('active', el === chip);
        scheduleSave();
      });
      colors.appendChild(chip);
    }
    box.appendChild(colors);
    const fam = document.createElement('div');
    fam.className = 'atoggles';
    for (const [serif, label] of [[false, 'Sans'], [true, 'Serif']]) {
      const b = document.createElement('button');
      b.className = 'tgl' + (!!it.serif === serif ? ' on' : '');
      b.textContent = label;
      b.style.fontFamily = serif ? '"Bodoni 72", Didot, Georgia, serif' : '';
      b.addEventListener('click', () => {
        it.serif = serif;
        renderItem(it);
        for (const el of fam.children) el.classList.remove('on');
        b.classList.add('on');
        scheduleSave();
      });
      fam.appendChild(b);
    }
    box.appendChild(fam);
  }
}

/* ============================== palette de couleurs ============================== */
async function extractPalette(it) {
  toast(tr('palWorking'));
  try {
    const info = await loadBlobAsImage(it.blob);
    const S = 64;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(info.img, 0, 0, S, S);
    URL.revokeObjectURL(info.url);
    const d = ctx.getImageData(0, 0, S, S).data;
    const buckets = new Map(); // clé quantifiée -> {n, r, g, b}
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const key = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | (d[i + 2] >> 5);
      let b = buckets.get(key);
      if (!b) { b = { n: 0, r: 0, g: 0, b: 0 }; buckets.set(key, b); }
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
    }
    const sorted = [...buckets.values()].sort((a, b) => b.n - a.n)
      .map(b => [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)]);
    const picked = [];
    for (const c of sorted) {
      if (picked.every(p => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) > 55)) picked.push(c);
      if (picked.length === 5) break;
    }
    if (!picked.length) { toast(tr('palNone')); return; }
    const hex = picked.map(([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join(''));
    const pal = addPaletteItem(hex, { x: it.x, y: it.y + itemH(it) + 18 / view.s }, it.w);
    pal.rot = it.rot;
    renderItem(pal);
    select(pal);
    scheduleSave();
    toast(tr('palDone'));
  } catch (e) {
    toast(tr('palFail'));
  }
}

/* ============================== export PNG à plat ============================== */
function contentBBox() {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const it of items) {
    const h = itemH(it), c = itemCenter(it);
    const cos = Math.cos(it.rot), sin = Math.sin(it.rot);
    for (const [dx, dy] of [[-it.w/2,-h/2],[it.w/2,-h/2],[it.w/2,h/2],[-it.w/2,h/2]]) {
      const X = c.x + dx * cos - dy * sin, Y = c.y + dx * sin + dy * cos;
      x1 = Math.min(x1, X); y1 = Math.min(y1, Y);
      x2 = Math.max(x2, X); y2 = Math.max(y2, Y);
    }
  }
  return { x1, y1, x2, y2 };
}
function loadUrlAsImage(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('img'));
    img.src = url;
  });
}
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxW || !line) line = test;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}
async function exportPng() {
  if (!items.length) { toast(tr('boardEmpty')); return; }
  toast(tr('pngWorking'));
  try {
    const bb = contentBBox();
    const pad = 60;
    const bw = bb.x2 - bb.x1 + pad * 2, bh = bb.y2 - bb.y1 + pad * 2;
    const scale = Math.min(2, 4096 / Math.max(bw, bh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bw * scale);
    canvas.height = Math.round(bh * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const paper = '#f5f2ea', ink = '#161616';
    const sans = '-apple-system, "Helvetica Neue", Roboto, sans-serif';
    const serif = '"Bodoni 72", Didot, Georgia, serif';
    for (const it of items) {
      const h = itemH(it), c = itemCenter(it);
      ctx.save();
      ctx.translate((c.x - bb.x1 + pad) * scale, (c.y - bb.y1 + pad) * scale);
      ctx.scale(scale, scale);
      ctx.rotate(it.rot);
      try {
        if (it.type === 'img') {
          const f = it.filters || {};
          let src = it.url;
          if (f.edge) {
            if (!it._edgeUrl) it._edgeUrl = await generateEdges(it);
            src = it._edgeUrl;
          }
          let img = await loadUrlAsImage(src);
          if (!f.edge && (f.bw || (f.contrast && f.contrast !== 1))) {
            const t = document.createElement('canvas');
            const tw = Math.min(img.naturalWidth, 2048);
            const th = Math.round(tw * img.naturalHeight / img.naturalWidth);
            t.width = tw; t.height = th;
            const tc = t.getContext('2d', { willReadFrequently: true });
            tc.drawImage(img, 0, 0, tw, th);
            const id = tc.getImageData(0, 0, tw, th);
            const k = f.contrast || 1;
            for (let i = 0; i < id.data.length; i += 4) {
              let r = id.data[i], g = id.data[i + 1], b = id.data[i + 2];
              if (f.bw) r = g = b = 0.299 * r + 0.587 * g + 0.114 * b;
              id.data[i] = (r - 128) * k + 128;
              id.data[i + 1] = (g - 128) * k + 128;
              id.data[i + 2] = (b - 128) * k + 128;
            }
            tc.putImageData(id, 0, 0);
            img = t;
          }
          ctx.globalAlpha = f.opacity != null ? f.opacity : 1;
          if (it.flip) ctx.scale(-1, 1);
          ctx.drawImage(img, -it.w / 2, -h / 2, it.w, h);
        } else if (it.type === 'stroke') {
          const k = it.w / it.natW;
          ctx.translate(-it.w / 2, -h / 2);
          ctx.scale(k, k);
          ctx.strokeStyle = it.color;
          ctx.lineWidth = it.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.stroke(new Path2D(strokePath(it.pts)));
        } else if (it.type === 'text') {
          ctx.translate(-it.w / 2, -h / 2);
          ctx.font = `${it.serif ? 'italic ' : ''}${it.size}px ${it.serif ? serif : sans}`;
          ctx.fillStyle = it.color;
          ctx.textBaseline = 'top';
          const padX = it.size * 0.3, lh = it.size * 1.4;
          wrapLines(ctx, it.text, it.w - padX * 2).forEach((line, i) => {
            ctx.fillText(line, padX, it.size * 0.18 + i * lh);
          });
        } else if (it.type === 'todo') {
          ctx.translate(-it.w / 2, -h / 2);
          const s = it.size;
          rounded(ctx, 0, 0, it.w, h, s * 0.6);
          ctx.fillStyle = paper;
          ctx.fill();
          ctx.font = `${s}px ${sans}`;
          ctx.textBaseline = 'top';
          let y = s * 0.55 + s * 0.22;
          for (const en of it.entries) {
            const bx = s * 0.7, box = s * 1.05;
            ctx.strokeStyle = ink;
            ctx.lineWidth = s * 0.09;
            rounded(ctx, bx, y + s * 0.14, box, box, s * 0.25);
            if (en.done) { ctx.fillStyle = ink; ctx.fill(); } else ctx.stroke();
            ctx.fillStyle = en.done ? 'rgba(22,22,22,.55)' : ink;
            const tx = bx + box + s * 0.55;
            const lines = wrapLines(ctx, en.t, it.w - tx - s * 0.7);
            lines.forEach((line, i) => {
              ctx.fillText(line, tx, y + i * s * 1.45);
              if (en.done) {
                const lw = ctx.measureText(line).width;
                ctx.fillRect(tx, y + i * s * 1.45 + s * 0.45, lw, s * 0.07);
              }
            });
            y += lines.length * s * 1.45 + s * 0.44;
          }
        } else if (it.type === 'palette') {
          ctx.translate(-it.w / 2, -h / 2);
          const n = it.colors.length;
          const cw = it.w / n, chh = cw * 1.15;
          it.colors.forEach((col, i) => {
            ctx.fillStyle = col;
            ctx.fillRect(i * cw, 0, cw + 0.5, chh);
            ctx.fillStyle = paper;
            ctx.fillRect(i * cw, chh, cw + 0.5, h - chh);
            ctx.fillStyle = ink;
            ctx.font = `${cw * 0.13}px ui-monospace, Menlo, monospace`;
            ctx.textBaseline = 'middle';
            const tw = ctx.measureText(col).width;
            ctx.fillText(col, i * cw + (cw - tw) / 2, chh + (h - chh) / 2);
          });
        } else if (it.type === 'link') {
          ctx.translate(-it.w / 2, -h / 2);
          const s = it.w / 14;
          rounded(ctx, 0, 0, it.w, h, s * 0.6);
          ctx.fillStyle = paper;
          ctx.fill();
          ctx.fillStyle = ink;
          ctx.font = `italic ${s * 1.15}px ${serif}`;
          ctx.textBaseline = 'middle';
          ctx.fillText(it.name || 'Board', s * 0.9, h / 2, it.w - s * 2);
        }
      } catch (_) { /* élément non rendu : on continue */ }
      ctx.restore();
    }
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('toBlob');
    const b = boardMeta(library.current);
    const d = new Date();
    const p2 = n => String(n).padStart(2, '0');
    const slug = ((b && b.name) || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'board';
    await deliverFile(blob, `refy-${slug}-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}.png`);
    toast(tr('pngDone'));
  } catch (e) {
    toast(tr('pngFail'));
  }
}
function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ============================== édition de texte ============================== */
function setEditable(el) {
  try { el.contentEditable = 'plaintext-only'; } catch (_) {}
  if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
}
function editText(it) {
  if (locked || it.type !== 'text') return;
  commitTextEdit();
  commitTodoEdit();
  editingText = it;
  const tx = it.el.firstChild;
  it.el.classList.add('editing');
  setEditable(tx);
  tx.focus();
  const range = document.createRange();
  range.selectNodeContents(tx);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  tx.addEventListener('blur', () => { if (editingText === it) commitTextEdit(); }, { once: true });
}
function commitTextEdit() {
  if (!editingText) return;
  const it = editingText;
  editingText = null;
  const tx = it.el.firstChild;
  tx.removeAttribute('contenteditable');
  it.el.classList.remove('editing');
  it.text = tx.innerText.replace(/ /g, ' ').trimEnd();
  tx.textContent = it.text;
  if (!it.text.trim()) { removeItem(it, true); return; }
  scheduleSave();
}

/* ============================== checklist : édition de ligne ============================== */
function editTodoRow(it, idx) {
  if (locked) return;
  commitTextEdit();
  commitTodoEdit();
  const row = it.el.querySelector(`.trow[data-i="${idx}"]`);
  if (!row) return;
  const span = row.querySelector('.tlabel');
  editingTodo = { it, idx, span };
  setEditable(span);
  span.focus();
  const range = document.createRange();
  range.selectNodeContents(span);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  span.addEventListener('blur', () => { if (editingTodo && editingTodo.span === span) commitTodoEdit(); }, { once: true });
  span.addEventListener('keydown', todoRowKeydown);
}
function todoRowKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!editingTodo) return;
    const { it, idx } = editingTodo;
    commitTodoEdit();
    if (it.entries[idx] && it.entries[idx].t.trim()) {
      it.entries.splice(idx + 1, 0, { t: '', done: false });
      updateTodoDOM(it);
      renderItem(it);
      editTodoRow(it, idx + 1);
    }
  } else if (e.key === 'Escape') {
    e.target.blur();
  }
}
function commitTodoEdit() {
  if (!editingTodo) return;
  const { it, idx, span } = editingTodo;
  editingTodo = null;
  span.removeEventListener('keydown', todoRowKeydown);
  span.removeAttribute('contenteditable');
  const t = span.innerText.replace(/\n/g, ' ').trim();
  if (it.entries[idx]) {
    if (t) it.entries[idx].t = t;
    else it.entries.splice(idx, 1);
  }
  updateTodoDOM(it);
  renderItem(it);
  scheduleSave();
}
function toggleTodo(it, idx) {
  if (!it.entries[idx]) return;
  it.entries[idx].done = !it.entries[idx].done;
  updateTodoDOM(it);
  scheduleSave();
}
function openLinkTarget(it) {
  const b = boardMeta(it.target);
  if (!b) { toast(tr('linkDead')); return; }
  switchBoard(it.target);
}

/* ============================== gestes ============================== */
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
function angleOf(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }
function centroid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function twoPointers() { return [...pointers.values()].slice(0, 2); }

function startPinch() {
  const [p1, p2] = twoPointers();
  const c = centroid(p1, p2);
  if (gesture && (gesture.type === 'move' || gesture.type === 'pinch-item')) {
    const it = gesture.it;
    gesture = {
      type: 'pinch-item', it,
      start: { d: dist(p1, p2), a: angleOf(p1, p2), cw: toWorld(c.x, c.y), ctr: itemCenter(it), w: it.w, rot: it.rot, size: it.size },
    };
  } else {
    gesture = { type: 'pinch-view', start: { d: dist(p1, p2), cw: toWorld(c.x, c.y), s: view.s } };
  }
}
function rebaseSingle(pid) {
  const p = pointers.get(pid);
  if (!gesture || !p) return;
  if (gesture.type === 'pinch-item' || gesture.type === 'move') {
    const it = gesture.it;
    gesture = { type: 'move', it, pid, moved: true, start: { px: p.x, py: p.y, x: it.x, y: it.y } };
  } else if (gesture.type === 'pinch-view' || gesture.type === 'pan') {
    gesture = { type: 'pan', pid, start: { px: p.x, py: p.y, x: view.x, y: view.y } };
  } else if ((gesture.type === 'resize' || gesture.type === 'rotate') && gesture.pid !== pid) {
    // le doigt qui redimensionnait est parti : le doigt restant reprend en déplacement
    const it = gesture.it;
    gesture = { type: 'move', it, pid, moved: true, start: { px: p.x, py: p.y, x: it.x, y: it.y } };
  }
}

/* dessin en cours */
function drawBBox(pts, pad) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const [x, y] of pts) {
    x1 = Math.min(x1, x); y1 = Math.min(y1, y);
    x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  return { x: x1 - pad, y: y1 - pad, w: Math.max(x2 - x1 + pad * 2, pad * 2), h: Math.max(y2 - y1 + pad * 2, pad * 2) };
}
function updateDrawPreview(g) {
  const size = pen.size / g.viewS;
  const bb = drawBBox(g.pts, size);
  const local = g.pts.map(([x, y]) => [+(x - bb.x).toFixed(3), +(y - bb.y).toFixed(3)]);
  g.el.style.transform = `translate(${bb.x}px, ${bb.y}px)`;
  g.el.style.width = bb.w + 'px';
  const svg = g.el.firstChild;
  svg.setAttribute('viewBox', `0 0 ${bb.w} ${bb.h}`);
  const d = strokePath(local);
  svg.querySelector('.ink').setAttribute('d', d);
  svg.querySelector('.hit').setAttribute('d', d);
  g.bb = bb;
  g.local = local;
}
function finishDraw(g) {
  if (!g.el) return;
  if (g.pts.length < 2) {
    // un point : petit trait rond
    const p = g.pts[0] || [0, 0];
    g.pts = [p, [p[0] + 0.01, p[1] + 0.01]];
  }
  updateDrawPreview(g);
  const size = pen.size / g.viewS;
  const it = {
    id: uid(), type: 'stroke',
    x: g.bb.x, y: g.bb.y, w: g.bb.w,
    natW: +g.bb.w.toFixed(1), natH: +g.bb.h.toFixed(1),
    ar: g.bb.w / g.bb.h,
    rot: 0, color: pen.color, size: +size.toFixed(2),
    hit: +Math.max(size * 3, 12 / g.viewS).toFixed(2), // zone de tap figée au zoom du dessin
    pts: g.local,
  };
  g.el.remove();
  addItem(it);
  scheduleSave();
}
function cancelDraw(g) {
  if (g && g.el) g.el.remove();
}

vp.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { pointers.clear(); if (gesture && gesture.type === 'draw') cancelDraw(gesture); gesture = null; });

vp.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;                    // clic droit / molette : rien
  if (editingText) {
    if (e.target.closest('.item') === editingText.el) return; // laisse l'édition native
    commitTextEdit();
  }
  if (editingTodo) {
    if (e.target.closest('.tlabel') === editingTodo.span) return;
    commitTodoEdit();
  }
  e.preventDefault();
  cancelViewAnim();
  try { vp.setPointerCapture(e.pointerId); } catch (_) {}
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (locked) return;

  /* --- mode crayon --- */
  if (tool === 'draw') {
    if (pointers.size === 1) {
      const p = toWorld(e.clientX, e.clientY);
      const el = document.createElement('div');
      el.className = 'item stroke';
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('class', 'stroke-svg');
      for (const cls of ['hit', 'ink']) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('class', cls);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        if (cls === 'ink') {
          path.setAttribute('stroke', pen.color);
          path.setAttribute('stroke-width', pen.size / view.s);
        } else {
          path.setAttribute('stroke-width', 0);
        }
        svg.appendChild(path);
      }
      el.appendChild(svg);
      stage.appendChild(el);
      gesture = { type: 'draw', pid: e.pointerId, pts: [[p.x, p.y]], el, viewS: view.s, lastX: e.clientX, lastY: e.clientY };
      updateDrawPreview(gesture);
    } else if (pointers.size === 2) {
      if (gesture && gesture.type === 'draw') {
        // deux doigts : on navigue, le trait entamé est annulé
        cancelDraw(gesture);
        gesture = null;
      }
      startPinch();
    }
    return;
  }

  /* --- mode présentation : navigation seule --- */
  if (presenting) {
    if (pointers.size === 1) {
      gesture = { type: 'pan', pid: e.pointerId, start: { px: e.clientX, py: e.clientY, x: view.x, y: view.y } };
    } else if (pointers.size === 2) {
      startPinch();
    }
    return;
  }

  /* --- mode sélection --- */
  if (pointers.size === 1) {
    const handleEl = e.target.closest('.handle');
    const itemEl = e.target.closest('.item');
    if (handleEl && itemEl) {
      const it = items.find(i => i.id === itemEl.dataset.id);
      if (!it) return;
      select(it);
      bringToFront(it);
      const ctr = itemCenter(it);
      const pw = toWorld(e.clientX, e.clientY);
      if (handleEl.dataset.c === 'rot') {
        gesture = { type: 'rotate', it, pid: e.pointerId, start: { ctr, a: Math.atan2(pw.y - ctr.y, pw.x - ctr.x), rot: it.rot } };
      } else {
        gesture = { type: 'resize', it, pid: e.pointerId, start: { ctr, d: Math.hypot(pw.x - ctr.x, pw.y - ctr.y) || 1, w: it.w, size: it.size } };
      }
    } else if (itemEl) {
      const it = items.find(i => i.id === itemEl.dataset.id);
      if (!it) return;
      // double-tap : édition texte / ligne de checklist / ouverture de lien
      const now = performance.now();
      if (it._lastTap && now - it._lastTap < 350) {
        it._lastTap = 0;
        if (it.type === 'text') { select(it); editText(it); return; }
        if (it.type === 'link') { openLinkTarget(it); return; }
        if (it.type === 'todo') {
          const row = e.target.closest('.trow:not(.tadd)');
          if (row) { select(it); editTodoRow(it, +row.dataset.i); return; }
        }
      }
      it._lastTap = now;
      select(it);
      bringToFront(it);
      // actions au relâchement (tap sans déplacement) : cocher, ajouter une ligne, copier une couleur
      let tap = null;
      if (it.type === 'todo') {
        const check = e.target.closest('.todo-check');
        const add = e.target.closest('.trow.tadd');
        if (check) { const i = +check.closest('.trow').dataset.i; tap = () => toggleTodo(it, i); }
        else if (add) tap = () => { it.entries.push({ t: '', done: false }); updateTodoDOM(it); renderItem(it); editTodoRow(it, it.entries.length - 1); scheduleSave(); };
      } else if (it.type === 'palette') {
        const cell = e.target.closest('.pcell');
        if (cell) {
          const hex = cell.querySelector('.phex').textContent;
          tap = () => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(hex).then(() => toast(tr('copied')(hex))).catch(() => toast(hex));
            } else toast(hex);
          };
        }
      }
      gesture = { type: 'move', it, pid: e.pointerId, moved: false, tap, start: { px: e.clientX, py: e.clientY, x: it.x, y: it.y } };
    } else {
      select(null);
      gesture = { type: 'pan', pid: e.pointerId, start: { px: e.clientX, py: e.clientY, x: view.x, y: view.y } };
    }
  } else if (pointers.size === 2 && gesture && gesture.type !== 'resize' && gesture.type !== 'rotate') {
    startPinch();
  }
});

vp.addEventListener('pointermove', e => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (!gesture || locked) return;
  const g = gesture;

  if (g.type === 'draw') {
    if (e.pointerId !== g.pid) return;
    if (Math.hypot(e.clientX - g.lastX, e.clientY - g.lastY) < 1.5) return;
    g.lastX = e.clientX; g.lastY = e.clientY;
    if (g.pts.length < 1200) {
      const p = toWorld(e.clientX, e.clientY);
      g.pts.push([p.x, p.y]);
      updateDrawPreview(g);
    }
  } else if (g.type === 'move') {
    if (e.pointerId !== g.pid) return;
    if (!g.moved && Math.hypot(e.clientX - g.start.px, e.clientY - g.start.py) > 4) g.moved = true;
    if (!g.moved) return;
    g.it.x = g.start.x + (e.clientX - g.start.px) / view.s;
    g.it.y = g.start.y + (e.clientY - g.start.py) / view.s;
    renderItem(g.it);
  } else if (g.type === 'pan') {
    if (e.pointerId !== g.pid) return;
    view.x = g.start.x + (e.clientX - g.start.px);
    view.y = g.start.y + (e.clientY - g.start.py);
    applyView();
  } else if (g.type === 'pinch-item') {
    if (pointers.size < 2) return;
    const [p1, p2] = twoPointers();
    const c = centroid(p1, p2);
    const cw = toWorld(c.x, c.y);
    const it = g.it;
    const nw = clamp(g.start.w * dist(p1, p2) / g.start.d, MIN_W, MAX_W);
    const f = nw / g.start.w;
    const rot = snapAngle(normAngle(g.start.rot + angleOf(p1, p2) - g.start.a));
    const da = rot - g.start.rot;
    const h0 = it.type === 'text' ? itemH(it) : g.start.w / it.ar;
    const vx = (g.start.ctr.x - g.start.cw.x) * f, vy = (g.start.ctr.y - g.start.cw.y) * f;
    const cos = Math.cos(da), sin = Math.sin(da);
    const ncx = cw.x + vx * cos - vy * sin;
    const ncy = cw.y + vx * sin + vy * cos;
    it.w = nw;
    it.rot = rot;
    if ((it.type === 'text' || it.type === 'todo') && g.start.size) it.size = g.start.size * f;
    renderItem(it);
    it.x = ncx - nw / 2;
    it.y = ncy - itemH(it) / 2;
    renderItem(it);
  } else if (g.type === 'pinch-view') {
    if (pointers.size < 2) return;
    const [p1, p2] = twoPointers();
    const c = centroid(p1, p2);
    const s = clamp(g.start.s * dist(p1, p2) / g.start.d, MIN_S, MAX_S);
    view.s = s;
    view.x = c.x - g.start.cw.x * s;
    view.y = c.y - g.start.cw.y * s;
    applyView();
  } else if (g.type === 'resize') {
    if (e.pointerId !== g.pid) return;
    const it = g.it;
    const pw = toWorld(e.clientX, e.clientY);
    const d = Math.hypot(pw.x - g.start.ctr.x, pw.y - g.start.ctr.y);
    const f = clamp(g.start.w * d / g.start.d, MIN_W, MAX_W) / g.start.w;
    it.w = g.start.w * f;
    if ((it.type === 'text' || it.type === 'todo') && g.start.size) it.size = g.start.size * f;
    renderItem(it);
    it.x = g.start.ctr.x - it.w / 2;
    it.y = g.start.ctr.y - itemH(it) / 2;
    renderItem(it);
  } else if (g.type === 'rotate') {
    if (e.pointerId !== g.pid) return;
    const it = g.it;
    const pw = toWorld(e.clientX, e.clientY);
    const a = Math.atan2(pw.y - g.start.ctr.y, pw.x - g.start.ctr.x);
    it.rot = snapAngle(normAngle(g.start.rot + a - g.start.a));
    renderItem(it);
  }
});

function endPointer(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (!gesture) return;
  if (gesture.type === 'draw') {
    if (e.pointerId === gesture.pid) {
      if (e.type === 'pointercancel') cancelDraw(gesture); else finishDraw(gesture);
      gesture = null;
    }
    return;
  }
  if (pointers.size >= 2 && (gesture.type === 'pinch-item' || gesture.type === 'pinch-view')) {
    startPinch(); // recadre le pincement sur les doigts restants
  } else if (pointers.size === 1) {
    rebaseSingle([...pointers.keys()][0]);
  } else if (pointers.size === 0) {
    const g = gesture;
    gesture = null;
    if (g.type === 'move' && !g.moved && g.tap && e.type === 'pointerup') g.tap();
    scheduleSave();
  }
}
vp.addEventListener('pointerup', endPointer);
vp.addEventListener('pointercancel', endPointer);

vp.addEventListener('wheel', e => {
  e.preventDefault();
  if (locked || pointers.size) return;           // pas de zoom molette en plein geste
  cancelViewAnim();
  const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
  const s = clamp(view.s * f, MIN_S, MAX_S);
  const w = toWorld(e.clientX, e.clientY);
  view.s = s;
  view.x = e.clientX - w.x * s;
  view.y = e.clientY - w.y * s;
  applyView();
  scheduleSave();
}, { passive: false });

// Safari iOS : bloque le zoom / double-tap de la page
for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(t, e => e.preventDefault());
}
document.addEventListener('dblclick', e => e.preventDefault());

/* ============================== vue ============================== */
function fitView() {
  if (gesture && gesture.type === 'draw') return; // pas de saut de vue en plein trait
  if (!items.length) { animateViewTo(0, 0, 1); return; }
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const it of items) {
    const h = itemH(it), c = itemCenter(it);
    const cos = Math.cos(it.rot), sin = Math.sin(it.rot);
    for (const [dx, dy] of [[-it.w/2,-h/2],[it.w/2,-h/2],[it.w/2,h/2],[-it.w/2,h/2]]) {
      const X = c.x + dx * cos - dy * sin, Y = c.y + dx * sin + dy * cos;
      x1 = Math.min(x1, X); y1 = Math.min(y1, Y);
      x2 = Math.max(x2, X); y2 = Math.max(y2, Y);
    }
  }
  const m = 70;
  const s = clamp(Math.min((innerWidth - m) / (x2 - x1), (innerHeight - m) / (y2 - y1)), MIN_S, 4);
  animateViewTo(innerWidth / 2 - (x1 + x2) / 2 * s, innerHeight / 2 - (y1 + y2) / 2 * s, s);
}

function rotateSelected(delta) {
  if (!selected) return;
  selected.rot = normAngle(Math.round((selected.rot + delta) / HALF_PI) * HALF_PI);
  renderItem(selected);
  scheduleSave();
}
function flipSelected() {
  if (!selected || selected.type !== 'img') return;
  selected.flip = !selected.flip;
  renderItem(selected);
  scheduleSave();
}

/* ============================== crayon (mode) ============================== */
function setTool(t) {
  if (locked) return;
  tool = t;
  document.body.classList.toggle('drawing', t === 'draw');
  $('btn-draw').classList.toggle('tb-active', t === 'draw');
  if (t === 'draw') {
    select(null);
    if (!pen.color) pen.color = document.body.classList.contains('light') ? '#161616' : '#f5f2ea';
    syncPenbar();
    openPopover('penbar');
  } else {
  }
}
function syncPenbar() {
  for (const el of $('pen-colors').children) el.classList.toggle('active', el.dataset.c === pen.color);
  $('pen-size').value = pen.size;
}
function savePen() {
  try { localStorage.setItem('refy-pen', JSON.stringify(pen)); } catch (_) {}
}
{
  const wrap = $('pen-colors');
  for (const c of PEN_COLORS) {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.c = c;
    chip.style.background = c;
    chip.addEventListener('click', () => { pen.color = c; syncPenbar(); savePen(); });
    wrap.appendChild(chip);
  }
  $('pen-size').addEventListener('input', () => { pen.size = +$('pen-size').value; savePen(); });
  $('pen-undo').addEventListener('click', () => {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].type === 'stroke') { removeItem(items[i]); return; }
    }
  });
}
$('btn-draw').addEventListener('click', () => setTool(tool === 'draw' ? null : 'draw'));
$('btn-text').addEventListener('click', () => {
  if (locked) return;
  setTool(null);
  const it = addTextItem('');
  select(it);
  scheduleSave();
  editText(it);
});

/* ============================== popovers ============================== */
const POPOVERS = ['more', 'swatches', 'penbar', 'adjust'];
function openPopover(id) {
  for (const p of POPOVERS) $(p).classList.toggle('open', p === id);
}
function closePopovers(except) {
  for (const p of POPOVERS) { if (p !== except) $(p).classList.remove('open'); }
}
document.addEventListener('pointerdown', e => {
  if (e.target.closest('.popover') || e.target.closest('#toolbar')) return;
  if (tool === 'draw') { closePopovers('penbar'); return; }  // la palette du crayon reste ouverte en mode dessin
  closePopovers();
}, true);

$('btn-more').addEventListener('click', () => {
  const m = $('more');
  const wasOpen = m.classList.contains('open');
  closePopovers();
  if (!wasOpen) m.classList.add('open');
});
$('more').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  closePopovers();
  const act = b.dataset.act;
  if (act === 'bg') openPopover('swatches');
  else if (act === 'cal') openCalendar();
  else if (act === 'doc') $('file-doc').click();
  else if (act === 'export') exportBoard();
  else if (act === 'import') $('file-board').click();
  else if (act === 'png') exportPng();
  else if (act === 'present') setPresenting(true);
  else if (act === 'todo') {
    setTool(null);
    const it = addTodoItem();
    select(it);
    scheduleSave();
    it.entries.push({ t: '', done: false });
    updateTodoDOM(it);
    renderItem(it);
    editTodoRow(it, 0);
  }
  else if (act === 'help') $('help').classList.remove('hidden');
});
$('btn-adj').addEventListener('click', () => {
  const a = $('adjust');
  if (a.classList.contains('open')) { a.classList.remove('open'); return; }
  buildAdjust();
  openPopover('adjust');
});

/* ============================== verrouillage ============================== */
let wakeLock = null;
async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { wakeLock = null; }
}
function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (locked && document.visibilityState === 'visible') acquireWakeLock();
  if (document.visibilityState === 'hidden') flushSave();
});
function setLocked(v, silent) {
  if (v) { commitTextEdit(); commitTodoEdit(); setTool(null); }
  locked = v;
  document.body.classList.toggle('locked', v);
  select(null);
  if (gesture && gesture.type === 'draw') cancelDraw(gesture); // pas de trait fantôme
  gesture = null;
  closePopovers();
  document.body.classList.remove('lib-open', 'cal-open');
  if (v) { acquireWakeLock(); if (!silent) toast(tr('lockToast')); }
  else { releaseWakeLock(); if (!silent) toast(tr('unlockToast')); }
  scheduleSave();
}
$('btn-lock').addEventListener('click', () => setLocked(true));

/* mode présentation */
function setPresenting(v) {
  if (v) { commitTextEdit(); commitTodoEdit(); setTool(null); select(null); closePopovers(); document.body.classList.remove('lib-open', 'cal-open'); }
  presenting = v;
  if (gesture && gesture.type === 'draw') cancelDraw(gesture);
  gesture = null;
  document.body.classList.toggle('presenting', v);
  if (v) toast(tr('presToast'));
}
$('presbtn').addEventListener('click', () => setPresenting(false));

const lockbtn = $('lockbtn');
let unlockTm = null;
function startUnlockHold(e) {
  if (e.button !== 0) return;
  e.preventDefault();
  clearTimeout(unlockTm);                        // pas de fuite de timer si double appui
  lockbtn.classList.add('holding');
  unlockTm = setTimeout(() => { unlockTm = null; lockbtn.classList.remove('holding'); setLocked(false); }, 900);
}
function cancelUnlockHold() {
  clearTimeout(unlockTm);
  unlockTm = null;
  lockbtn.classList.remove('holding');
}
lockbtn.addEventListener('pointerdown', startUnlockHold);
lockbtn.addEventListener('pointerup', cancelUnlockHold);
lockbtn.addEventListener('pointercancel', cancelUnlockHold);
lockbtn.addEventListener('pointerleave', cancelUnlockHold);

/* ============================== librairie de boards ============================== */
function boardMeta(id) { return library.boards.find(b => b.id === id); }
function fmtWhen(t) {
  const d = new Date(t);
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) + ' · ' +
         d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}
const ICONS = {
  pencil: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 20l1.2-4.2L16.5 4.5a2.12 2.12 0 0 1 3 3L8.2 18.8 4 20z"/><path d="M14.5 6.5l3 3"/></svg>',
  trash: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 7h14M10 4h4M8 7l.8 13h6.4L16 7"/></svg>',
  link: '<svg class="ic" viewBox="0 0 24 24"><path d="M10.5 13.5a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1.2 1.2"/><path d="M13.5 10.5a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1.2-1.2"/></svg>',
  text: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 6V4h14v2M12 4v16M9.5 20h5"/></svg>',
  todo: '<svg class="ic" viewBox="0 0 24 24"><rect x="4" y="5" width="5" height="5" rx="1.2"/><path d="M5.2 7.5l1.2 1.2 2-2.4" stroke-width="1.4"/><path d="M12.5 7.5H20M12.5 16.5H20"/><rect x="4" y="14" width="5" height="5" rx="1.2"/></svg>',
};
function renderLibrary() {
  if (!library) return;
  $('lib-new').style.display = libTab === 'boards' ? '' : 'none';
  for (const btn of $('lib-seg').children) btn.classList.toggle('on', btn.dataset.tab === libTab);
  if (libTab === 'notes') { renderNotes(); return; }
  const list = $('lib-list');
  list.innerHTML = '';
  for (const b of library.boards) {
    const row = document.createElement('div');
    row.className = 'brow' + (b.id === library.current ? ' active' : '');
    const main = document.createElement('button');
    main.className = 'bmain';
    const name = document.createElement('div');
    name.className = 'bname';
    name.textContent = b.name;
    const meta = document.createElement('div');
    meta.className = 'bmeta';
    const n = b.count || 0;
    meta.textContent = tr('countLabel')(n) + ' · ' + fmtWhen(b.updated);
    main.append(name, meta);
    main.addEventListener('click', () => { switchBoard(b.id); });
    const ren = document.createElement('button');
    ren.className = 'bact';
    ren.title = tr('renameTitle');
    ren.innerHTML = ICONS.pencil;
    ren.addEventListener('click', () => {
      const v = prompt(tr('namePrompt'), b.name);
      if (v && v.trim()) {
        b.name = v.trim().slice(0, 48);
        dbPutMeta('library', library).catch(() => {});
        renderLibrary();
        for (const it of items) if (it.type === 'link') updateLinkDOM(it);
      }
    });
    const del = document.createElement('button');
    del.className = 'bact';
    del.title = tr('deleteTitle');
    del.innerHTML = ICONS.trash;
    del.addEventListener('click', () => deleteBoard(b.id));
    if (b.id !== library.current) {
      const lnk = document.createElement('button');
      lnk.className = 'bact';
      lnk.title = tr('linkTitle');
      lnk.innerHTML = ICONS.link;
      lnk.addEventListener('click', () => {
        const it = addLinkItem(b);
        select(it);
        scheduleSave();
        closeLibrary();
        toast(tr('linkPosed')(b.name));
      });
      row.append(main, lnk, ren, del);
    } else {
      row.append(main, ren, del);
    }
    list.appendChild(row);
  }
}

/* master des notes : textes + checklists de tous les boards */
async function renderNotes() {
  const list = $('lib-list');
  list.innerHTML = '<div class="lib-empty">' + tr('loading') + '</div>';
  const groups = [];
  for (const b of library.boards) {
    let entries;
    if (b.id === library.current) {
      entries = items.map(serializeItem);
    } else {
      let st = null;
      try { st = await dbGetMeta('state-' + b.id); } catch (_) {}
      entries = (st && st.items) || [];
    }
    const notes = entries.filter(e => e.type === 'text' || e.type === 'todo');
    if (notes.length) groups.push({ board: b, notes });
  }
  if (libTab !== 'notes') return; // l'utilisateur a changé d'onglet pendant la lecture
  list.innerHTML = '';
  if (!groups.length) {
    list.innerHTML = '<div class="lib-empty">' + tr('notesEmpty') + '</div>';
    return;
  }
  for (const g of groups) {
    const head = document.createElement('div');
    head.className = 'nb-head';
    head.textContent = g.board.name;
    list.appendChild(head);
    for (const n of g.notes) {
      const row = document.createElement('button');
      row.className = 'nrow';
      const ic = document.createElement('span');
      ic.className = 'nic';
      ic.innerHTML = n.type === 'todo' ? ICONS.todo : ICONS.text;
      const body = document.createElement('span');
      body.style.flex = '1';
      body.style.minWidth = '0';
      const txt = document.createElement('div');
      txt.className = 'ntxt';
      if (n.type === 'text') {
        txt.textContent = (n.text || '').slice(0, 140) || tr('emptyNote');
      } else {
        const open = (n.entries || []).filter(e => !e.done);
        txt.textContent = open.length ? open.map(e => e.t).join(' · ').slice(0, 140) : tr('allDone');
      }
      body.appendChild(txt);
      if (n.type === 'todo') {
        const done = (n.entries || []).filter(e => e.done).length;
        const meta = document.createElement('div');
        meta.className = 'ndone';
        meta.textContent = tr('doneCount')(done, (n.entries || []).length);
        body.appendChild(meta);
      }
      row.append(ic, body);
      row.addEventListener('click', () => jumpToNote(g.board.id, n.id));
      list.appendChild(row);
    }
  }
}
async function jumpToNote(boardId, itemId) {
  closeLibrary();
  if (boardId !== library.current) await switchBoard(boardId);
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  select(it);
  const c = itemCenter(it), h = itemH(it);
  const s = clamp(0.55 * Math.min(innerWidth, innerHeight) / Math.max(it.w, h), MIN_S, 2.5);
  animateViewTo(innerWidth / 2 - c.x * s, innerHeight / 2 - c.y * s, s);
}
$('lib-seg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  libTab = b.dataset.tab;
  renderLibrary();
});

function openLibrary() { renderLibrary(); document.body.classList.add('lib-open'); document.body.classList.remove('cal-open'); }
function closeLibrary() { document.body.classList.remove('lib-open'); }

function clearBoardDOM() {
  commitTextEdit();
  commitTodoEdit();
  select(null);
  for (const it of items) {
    it.el.remove();
    if (it.url) URL.revokeObjectURL(it.url);
    if (it._edgeUrl) URL.revokeObjectURL(it._edgeUrl);
  }
  items = [];
  updateHint();
}

/* Restaure un state de board (ou un board vide si state absent). */
async function loadBoardState(state) {
  setLocked(!!(state && state.locked), true);
  if (state && Array.isArray(state.items)) {
    for (const raw of state.items) {
      const type = raw.type || 'img';
      try {
        if (type === 'img') {
          let blob;
          try { blob = await dbGetImage(raw.id); } catch (_) { blob = null; }
          if (!blob) continue;
          const info = await loadBlobAsImage(blob);
          addItem({
            id: raw.id, type: 'img', x: raw.x, y: raw.y, w: raw.w,
            ar: raw.ar || (info.w / info.h || 1),
            rot: isFinite(+raw.rot) ? +raw.rot : 0, flip: !!raw.flip,
            filters: raw.filters || {},
            blob, url: info.url,
          });
        } else if (type === 'stroke' && Array.isArray(raw.pts)) {
          addItem({
            id: raw.id || uid(), type: 'stroke', x: raw.x, y: raw.y, w: raw.w,
            natW: +raw.natW || 10, natH: +raw.natH || 10,
            ar: +raw.ar > 0 ? +raw.ar : 1,
            rot: isFinite(+raw.rot) ? +raw.rot : 0,
            color: raw.color || '#f5f2ea', size: +raw.size || 4, hit: +raw.hit || 0, pts: raw.pts,
          });
        } else if (type === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
          addItem({
            id: raw.id || uid(), type: 'text', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0,
            text: raw.text, color: raw.color || '#f5f2ea', size: +raw.size || 20, serif: !!raw.serif,
          });
        } else if (type === 'todo' && Array.isArray(raw.entries)) {
          addItem({
            id: raw.id || uid(), type: 'todo', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0, size: +raw.size || 15,
            entries: raw.entries.filter(e => e && typeof e.t === 'string').map(e => ({ t: e.t, done: !!e.done })),
          });
        } else if (type === 'palette' && Array.isArray(raw.colors) && raw.colors.length) {
          addItem({
            id: raw.id || uid(), type: 'palette', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0,
            colors: raw.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8),
          });
        } else if (type === 'link' && raw.target) {
          addItem({
            id: raw.id || uid(), type: 'link', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0,
            target: String(raw.target), name: String(raw.name || 'Board').slice(0, 48),
          });
        }
      } catch (_) {}
    }
  }
  if (state && state.view && isFinite(state.view.s) && state.view.s > 0) {
    view.x = +state.view.x || 0; view.y = +state.view.y || 0; view.s = clamp(+state.view.s, MIN_S, MAX_S);
  } else {
    view.x = 0; view.y = 0; view.s = 1;
  }
  bg = (state && typeof state.bg === 'string' && /^#[0-9a-f]{6}$/i.test(state.bg)) ? state.bg : bg;
  applyView();
  applyBg();
  updateHint();
}

async function switchBoard(id) {
  if (!library || id === library.current) { closeLibrary(); return; }
  flushSave();
  ready = false;
  clearBoardDOM();
  library.current = id;
  let st = null;
  try { st = await dbGetMeta('state-' + id); } catch (_) {}
  await loadBoardState(st);
  ready = true;
  dbPutMeta('library', library).catch(() => {});
  renderLibrary();
  closeLibrary();
  const b = boardMeta(id);
  if (b) toast(b.name);
}

function createBoard(name) {
  flushSave();
  const id = uid();
  library.boards.unshift({ id, name: name || tr('boardN')(library.boards.length + 1), created: Date.now(), updated: Date.now(), count: 0 });
  library.current = id;
  clearBoardDOM();
  setLocked(false, true);
  view.x = 0; view.y = 0; view.s = 1;
  applyView();
  saveState();
  renderLibrary();
  return id;
}

async function deleteBoard(id) {
  const b = boardMeta(id);
  if (!b) return;
  if (!confirm(tr('delConfirm')(b.name))) return;
  let entries;
  if (id === library.current) {
    entries = items;
  } else {
    let st = null;
    try { st = await dbGetMeta('state-' + id); } catch (_) {}
    entries = (st && st.items) || [];
  }
  for (const it of entries) {
    if ((it.type || 'img') === 'img') dbDelImage(it.id).catch(() => {});
  }
  dbDelMeta('state-' + id).catch(() => {});
  library.boards = library.boards.filter(x => x.id !== id);
  if (calendar.events.some(e => e.boardId === id)) {
    calendar.events = calendar.events.filter(e => e.boardId !== id);
    saveCalendar();
  }
  for (const it of items) if (it.type === 'link') updateLinkDOM(it);
  if (id === library.current) {
    ready = false;
    clearBoardDOM();
    if (library.boards.length) {
      library.current = library.boards[0].id;
      let st = null;
      try { st = await dbGetMeta('state-' + library.current); } catch (_) {}
      await loadBoardState(st);
      ready = true;
      dbPutMeta('library', library).catch(() => {});
    } else {
      library.current = null;
      ready = true;
      createBoard('Board 1');
    }
  } else {
    dbPutMeta('library', library).catch(() => {});
  }
  renderLibrary();
}

$('btn-lib').addEventListener('click', () => {
  if (document.body.classList.contains('lib-open')) closeLibrary(); else openLibrary();
});
$('lib-scrim').addEventListener('pointerdown', () => { closeLibrary(); closeCalendar(); });
$('lib-new').addEventListener('click', () => { createBoard(); toast(tr('newBoardToast')); });
document.querySelectorAll('.panel-close').forEach(b => {
  b.addEventListener('click', () => {
    if (b.dataset.close === 'library') closeLibrary(); else closeCalendar();
  });
});

/* ============================== calendrier ============================== */
let calendar = { v: 2, events: [] }; // events: {id, boardId, date, time, title}
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
let calCursor = new Date();
calCursor.setDate(1);
let calSel = today();

function saveCalendar() { dbPutMeta('calendar', calendar).catch(() => toast(tr('calSaveFail'))); }
function dkey(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function scopedEvents() {
  return calScope === 'all' ? calendar.events : calendar.events.filter(e => e.boardId === library.current);
}
function eventsOn(key) { return scopedEvents().filter(e => e.date === key); }

function renderCalendar() {
  const y = calCursor.getFullYear(), m = calCursor.getMonth();
  $('cal-title').textContent = calCursor.toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
  const grid = $('cal-grid');
  grid.innerHTML = '';
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = 0
  const start = new Date(y, m, 1 - startOffset);
  const todayKey = today();
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = dkey(d);
    const cell = document.createElement('button');
    cell.className = 'cday'
      + (d.getMonth() !== m ? ' out' : '')
      + (key === todayKey ? ' today' : '')
      + (key === calSel ? ' sel' : '')
      + (eventsOn(key).length ? ' has' : '');
    cell.textContent = d.getDate();
    cell.addEventListener('click', () => {
      calSel = key;
      if (d.getMonth() !== m) { calCursor = new Date(d.getFullYear(), d.getMonth(), 1); }
      renderCalendar();
    });
    grid.appendChild(cell);
  }
  const selDate = new Date(calSel + 'T12:00:00');
  $('cal-day-title').textContent = selDate.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  const evBox = $('cal-events');
  evBox.innerHTML = '';
  const evs = eventsOn(calSel).sort((a, b) => (a.time || '99') < (b.time || '99') ? -1 : 1);
  if (!evs.length) {
    const empty = document.createElement('div');
    empty.className = 'ev-empty';
    empty.textContent = tr('calNone');
    evBox.appendChild(empty);
  }
  for (const ev of evs) {
    const row = document.createElement('div');
    row.className = 'ev';
    const t = document.createElement('time');
    t.textContent = ev.time || '·';
    const txt = document.createElement('div');
    txt.className = 'evt';
    txt.textContent = ev.title;
    const del = document.createElement('button');
    del.innerHTML = ICONS.trash;
    del.title = tr('deleteTitle');
    del.addEventListener('click', () => {
      calendar.events = calendar.events.filter(x => x.id !== ev.id);
      saveCalendar();
      renderCalendar();
    });
    row.append(t, txt);
    if (calScope === 'all') {
      const b = boardMeta(ev.boardId);
      const chip = document.createElement('span');
      chip.className = 'evb';
      chip.textContent = b ? b.name : '?';
      row.append(chip);
    }
    row.append(del);
    evBox.appendChild(row);
  }
}
$('cal-prev').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() - 1); renderCalendar(); });
$('cal-next').addEventListener('click', () => { calCursor.setMonth(calCursor.getMonth() + 1); renderCalendar(); });
$('cal-title').addEventListener('click', () => { calCursor = new Date(); calCursor.setDate(1); calSel = today(); renderCalendar(); });
$('cal-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('cal-text').value.trim();
  if (!title) return;
  calendar.events.push({ id: uid(), boardId: library.current, date: calSel, time: $('cal-time').value || '', title });
  $('cal-text').value = '';
  $('cal-time').value = '';
  saveCalendar();
  renderCalendar();
});
$('cal-seg').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  calScope = b.dataset.scope;
  for (const btn of $('cal-seg').children) btn.classList.toggle('on', btn === b);
  renderCalendar();
});
function openCalendar() { renderCalendar(); document.body.classList.add('cal-open'); document.body.classList.remove('lib-open'); }
function closeCalendar() { document.body.classList.remove('cal-open'); }

/* ============================== import / export ============================== */
function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
async function deliverFile(blob, name) {
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  if (standalone && navigator.canShare) {
    try {
      const file = new File([blob], name, { type: blob.type || 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // annulé par l'utilisateur
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
async function exportBoard() {
  if (!items.length) { toast(tr('nothingExport')); return; }
  toast(tr('backupWorking'));
  try {
    const b = boardMeta(library.current);
    const events = calendar.events.filter(e => e.boardId === library.current)
      .map(e => ({ date: e.date, time: e.time, title: e.title }));
    // JSON assemblé par morceaux pour ne pas exploser la mémoire sur iPad
    const parts = ['{"app":"refy","v":4,"name":' + JSON.stringify((b && b.name) || 'Board') +
                   ',"view":' + JSON.stringify({ x: view.x, y: view.y, s: view.s }) +
                   ',"bg":' + JSON.stringify(bg) +
                   ',"events":' + JSON.stringify(events) + ',"items":['];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const entry = serializeItem(it);
      delete entry.id;
      if (it.type === 'img') entry.data = await blobToDataURL(it.blob);
      parts.push((i ? ',' : '') + JSON.stringify(entry));
    }
    parts.push(']}');
    const blob = new Blob(parts, { type: 'application/json' });
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const slug = ((b && b.name) || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'board';
    const name = `refy-${slug}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.refy.json`;
    await deliverFile(blob, name);
    toast(tr('backupDone') + name, 3500);
  } catch (e) {
    toast(tr('exportFail'));
  }
}
async function importBoard(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast(tr('fileBad')); return; }
  if (!data || data.app !== 'refy' || !Array.isArray(data.items)) { toast(tr('notBackup')); return; }
  toast(tr('importing'));
  // On décode tout AVANT de créer le board : un backup corrompu ne casse rien.
  const decoded = [];
  for (const raw of data.items) {
    const type = raw.type || 'img';
    try {
      if (type === 'img') {
        const blob = await (await fetch(raw.data)).blob();
        const info = await loadBlobAsImage(blob);
        decoded.push({ type, raw, blob, info });
      } else {
        decoded.push({ type, raw });
      }
    } catch (e) { /* élément corrompu : on passe */ }
  }
  if (data.items.length && !decoded.length) { toast(tr('backupBad')); return; }
  const name = (typeof data.name === 'string' && data.name.trim())
    ? data.name.trim().slice(0, 48)
    : (file.name.replace(/\.refy\.json$|\.json$/i, '').replace(/^refy-/, '').slice(0, 48) || 'Import');
  createBoard(name);
  ready = false;
  for (const d of decoded) {
    const raw = d.raw;
    const common = {
      id: uid(),
      x: +raw.x || 0, y: +raw.y || 0,
      w: clamp(+raw.w || 300, MIN_W, MAX_W),
      rot: isFinite(+raw.rot) ? normAngle(+raw.rot) : 0,
    };
    if (d.type === 'img') {
      addItem({
        ...common, type: 'img',
        ar: +raw.ar > 0 ? +raw.ar : (d.info.w / d.info.h || 1),
        flip: !!raw.flip, filters: raw.filters || {},
        blob: d.blob, url: d.info.url,
      });
      dbPutImage(common.id, d.blob).catch(() => {});
    } else if (d.type === 'stroke' && Array.isArray(raw.pts)) {
      addItem({
        ...common, type: 'stroke',
        natW: +raw.natW || 10, natH: +raw.natH || 10,
        ar: +raw.ar > 0 ? +raw.ar : 1,
        color: raw.color || '#f5f2ea', size: +raw.size || 4, hit: +raw.hit || 0, pts: raw.pts,
      });
    } else if (d.type === 'text' && typeof raw.text === 'string' && raw.text.trim()) {
      addItem({
        ...common, type: 'text',
        text: raw.text, color: raw.color || '#f5f2ea', size: +raw.size || 20, serif: !!raw.serif,
      });
    } else if (d.type === 'todo' && Array.isArray(raw.entries)) {
      addItem({
        ...common, type: 'todo', size: +raw.size || 15,
        entries: raw.entries.filter(x => x && typeof x.t === 'string').map(x => ({ t: x.t, done: !!x.done })),
      });
    } else if (d.type === 'palette' && Array.isArray(raw.colors)) {
      const cols = raw.colors.filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8);
      if (cols.length) addItem({ ...common, type: 'palette', colors: cols });
    } else if (d.type === 'link' && raw.target) {
      addItem({ ...common, type: 'link', target: String(raw.target), name: String(raw.name || 'Board').slice(0, 48) });
    }
  }
  if (Array.isArray(data.events)) {
    let added = 0;
    for (const ev of data.events) {
      if (ev && /^\d{4}-\d{2}-\d{2}$/.test(ev.date) && typeof ev.title === 'string' && ev.title.trim()) {
        calendar.events.push({ id: uid(), boardId: library.current, date: ev.date, time: String(ev.time || '').slice(0, 5), title: ev.title.slice(0, 90) });
        added++;
      }
    }
    if (added) saveCalendar();
  }
  if (typeof data.bg === 'string' && /^#[0-9a-f]{6}$/i.test(data.bg)) { bg = data.bg; applyBg(); }
  ready = true;
  if (data.view && isFinite(data.view.s) && data.view.s > 0) {
    view.x = +data.view.x || 0; view.y = +data.view.y || 0; view.s = clamp(+data.view.s, MIN_S, MAX_S);
    applyView();
    scheduleSave();
  } else {
    fitView();
  }
  saveState();
  renderLibrary();
  toast(tr('importDone')(name, items.length));
}

/* ============================== toolbar & clavier ============================== */
$('btn-add').addEventListener('click', () => $('file-images').click());
$('file-images').addEventListener('change', e => { importFiles(e.target.files); e.target.value = ''; });
$('file-doc').addEventListener('change', e => { importFiles(e.target.files); e.target.value = ''; });
$('file-board').addEventListener('change', e => { if (e.target.files[0]) importBoard(e.target.files[0]); e.target.value = ''; });
$('btn-fit').addEventListener('click', fitView);
$('btn-del').addEventListener('click', () => { if (selected) removeItem(selected); });
$('btn-rot').addEventListener('click', () => rotateSelected(HALF_PI));
$('btn-flip').addEventListener('click', flipSelected);
$('help').addEventListener('click', e => { if (e.target === $('help')) $('help').classList.add('hidden'); });
$('btn-clear').addEventListener('click', () => {
  if (!confirm(tr('clearConfirm'))) return;
  for (const it of [...items]) removeItem(it, true);
  $('help').classList.add('hidden');
  view.x = 0; view.y = 0; view.s = 1;
  applyView();
  saveState();
});

// nuancier de fonds
{
  const swWrap = $('swatches');
  SWATCHES.forEach(([name, c], si) => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.dataset.c = c;
    chip.title = tr('swatches')[si] || name;
    chip.style.background = c;
    chip.addEventListener('click', () => {
      bg = c;
      applyBg();
      swWrap.classList.remove('open');
      scheduleSave();
    });
    swWrap.appendChild(chip);
  });
}

function isTyping(e) {
  return e.target.matches('input, textarea') || e.target.isContentEditable;
}
document.addEventListener('keydown', e => {
  if (isTyping(e)) {
    if (e.key === 'Escape' && (editingText || editingTodo)) e.target.blur();
    return;
  }
  if (locked) return;
  if (presenting) { if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPresenting(false); return; }
  // panneau ouvert : seules les touches de navigation des panneaux restent actives
  if (document.body.classList.contains('lib-open') || document.body.classList.contains('cal-open')) {
    if (['Escape', 'b', 'B', 'c', 'C'].includes(e.key)) {
      if (e.key === 'Escape') { closeLibrary(); closeCalendar(); }
      else if (e.key === 'b' || e.key === 'B') { if (document.body.classList.contains('lib-open')) closeLibrary(); else openLibrary(); }
      else { if (document.body.classList.contains('cal-open')) closeCalendar(); else openCalendar(); }
    }
    return;
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); removeItem(selected); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && tool === 'draw') { e.preventDefault(); $('pen-undo').click(); }
  else if (e.metaKey || e.ctrlKey) { /* laisse les raccourcis navigateur */ }
  else if (e.key === 'f' || e.key === 'F') fitView();
  else if (e.key === 'r') rotateSelected(HALF_PI);
  else if (e.key === 'R') rotateSelected(-HALF_PI);
  else if (e.key === 'm' || e.key === 'M') flipSelected();
  else if (e.key === 'd' || e.key === 'D') setTool(tool === 'draw' ? null : 'draw');
  else if (e.key === 't' || e.key === 'T') $('btn-text').click();
  else if (e.key === 'b' || e.key === 'B') { if (document.body.classList.contains('lib-open')) closeLibrary(); else openLibrary(); }
  else if (e.key === 'c' || e.key === 'C') { if (document.body.classList.contains('cal-open')) closeCalendar(); else openCalendar(); }
  else if (e.key === 'p' || e.key === 'P') setPresenting(true);
  else if (e.key === 'l' || e.key === 'L') document.querySelector('#more button[data-act="todo"]').click();
  else if (e.key === 'Escape') {
    if (tool === 'draw') setTool(null);
    select(null);
    $('help').classList.add('hidden');
    closePopovers();
    closeLibrary();
    closeCalendar();
  }
});

document.addEventListener('paste', e => {
  if (locked || isTyping(e)) return;
  const files = [...(e.clipboardData?.items || [])]
    .filter(i => i.kind === 'file')
    .map(i => i.getAsFile())
    .filter(Boolean);
  if (files.length) { e.preventDefault(); importFiles(files); return; }
  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  if (text && text.trim()) {
    e.preventDefault();
    const it = addTextItem(text.trim().slice(0, 20000), { size: 16 / view.s, w: 340 / view.s });
    select(it);
    scheduleSave();
  }
});

let dragDepth = 0;
document.addEventListener('dragenter', e => { e.preventDefault(); if (!locked) { dragDepth++; document.body.classList.add('dropping'); } });
document.addEventListener('dragleave', e => { e.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dropping'); } });
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dropping');
  if (locked || !e.dataTransfer.files.length) return;
  importFiles(e.dataTransfer.files, { x: e.clientX, y: e.clientY });
});

/* ============================== démarrage ============================== */
async function boot() {
  applyI18n();
  db = await openDB();
  if (!db) toast(tr('noStorage'), 4000);
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  applyView();
  applyBg();
  try {
    library = await dbGetMeta('library');
    if (!library || !Array.isArray(library.boards)) {
      // première ouverture, ou migration depuis l'ancienne version mono-board
      let legacy = null;
      try { legacy = await dbGetMeta('state'); } catch (_) {}
      const id = uid();
      library = {
        v: 1, current: id,
        boards: [{ id, name: 'Board 1', created: Date.now(), updated: Date.now(), count: (legacy && legacy.items && legacy.items.length) || 0 }],
      };
      if (legacy) { await dbPutMeta('state-' + id, legacy); dbDelMeta('state').catch(() => {}); }
      await dbPutMeta('library', library);
    }
    if (!library.boards.length) {
      const id = uid();
      library.boards = [{ id, name: 'Board 1', created: Date.now(), updated: Date.now(), count: 0 }];
      library.current = id;
    }
    if (!boardMeta(library.current)) library.current = library.boards[0].id;
    try {
      const cal = await dbGetMeta('calendar');
      if (cal && Array.isArray(cal.events)) {
        calendar = cal;
        if (cal.v !== 2) {
          // migration : les anciens événements globaux rejoignent le board courant
          calendar.v = 2;
          for (const ev of calendar.events) if (!ev.boardId) ev.boardId = library.current;
          saveCalendar();
        }
      }
    } catch (_) {}
    let st = null;
    try { st = await dbGetMeta('state-' + library.current); } catch (_) {}
    await loadBoardState(st);
  } catch (_) {
    if (!library) {
      const id = uid();
      library = { v: 1, current: id, boards: [{ id, name: 'Board 1', created: Date.now(), updated: Date.now(), count: 0 }] };
    }
  }
  renderLibrary();
  updateHint();
  ready = true;
}
boot();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
