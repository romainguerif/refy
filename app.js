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
  gGrid: 'Grille', gList: 'Liste', gCopy: 'Copier le texte', gCopied: 'Texte copie',
  gIn: 'dans', gLast: 'derniere section', gBar: 'mesure', gClose: 'Fermer',
  gBadPlan: 'Ce fichier n\'est pas une grille de morceau',
  gAdded: n => `Grille « ${n} » posee — double-tape pour l\'ouvrir`,
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
  arranged: 'Board rangé', cropLabel: 'Recadrer', cropFail: 'Recadrage impossible sur cette image',
  pinTitle: 'Aller à l\'élément épinglé', pinnedGone: 'Élément introuvable',
  selCount: n => `${n} sélectionné${n > 1 ? 's' : ''}`,
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
  gGrid: 'Grid', gList: 'List', gCopy: 'Copy as text', gCopied: 'Text copied',
  gIn: 'in', gLast: 'last section', gBar: 'bar', gClose: 'Close',
  gBadPlan: 'This file is not a song plan',
  gAdded: n => `Plan “${n}” dropped — double-tap to open it`,
  mGrille: 'Song plan',
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
  arranged: 'Board tidied', cropLabel: 'Crop', cropFail: 'Could not crop this image',
  pinTitle: 'Go to pinned element', pinnedGone: 'Element not found',
  mArrange: 'Tidy the board', tbDup: 'Duplicate', cropCancel: 'Cancel', cropOk: 'Crop',
  selCount: n => `${n} selected`,
  /* — textes statiques du DOM — */
  tbBoards: 'My boards', tbAdd: 'Add images', tbDraw: 'Pencil', tbText: 'Text', tbRot: 'Rotate 90°',
  tbFlip: 'Mirror horizontally', tbAdj: 'Adjustments', tbDel: 'Delete', tbFit: 'Fit everything',
  tbLock: 'Lock for tracing', tbMore: 'More', tbUndo: 'Undo last stroke', tbUnlock: 'Hold to unlock',
  tbPresQuit: 'Exit presentation', tbBg: 'Background color', tbClose: 'Close',
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
  hpManip: 'One finger: move. Two fingers on an element: size + rotation (snaps to 0/90/180/270°). Corner handles: size. Top handle: rotation. Duplicate: copy button, <kbd>Cmd/Ctrl D</kbd> or Alt+drag. “Tidy the board” (<kbd>G</kbd>) packs everything into a grid — annotations resting on an element follow it. Multi-select: <kbd>Shift</kbd>+click or <b>long-press</b>, <kbd>Shift</kbd>+drag the background for a rectangle, <kbd>Cmd/Ctrl A</kbd> for everything.',
  hpTrace: 'An image\'s adjustments (sliders icon) offer black & white, contrast, opacity, <b>edge extraction</b> and <b>cropping</b>. The padlock freezes the whole screen and keeps it awake — <b>hold it one second</b> to unlock.',
  hpTodo: 'Checklist in the ··· menu (<kbd>L</kbd>): tap to check, double-tap a line to edit it, Enter adds the next one. The <b>Notes</b> tab of the library gathers text and checklists from every board — tap to jump there.',
  hpCal: '··· menu or <kbd>C</kbd>: a local agenda, no sync. Each event belongs to the current board; the <b>All</b> view shows every board\'s agenda. An element selected when adding is <b>pinned</b> to the event — the pin jumps back to it. Events travel with the board in backups.',
  hpPal: '“Extract palette” in an image\'s adjustments drops a swatch card of its colors (tap a color to copy its code). From the library, the chain icon drops a link card to another board — double-tap to open it.',
  hpPres: 'Presentation mode (<kbd>P</kbd>) hides the whole interface, navigation only. “Export as PNG” flattens the board into an image.',
  hpBackup: 'Export/Import in the ··· menu: the board becomes a file on your device; importing creates a new board.',
  hpKeys: '<kbd>B</kbd> boards · <kbd>D</kbd> pencil · <kbd>T</kbd> text · <kbd>L</kbd> checklist · <kbd>C</kbd> calendar · <kbd>P</kbd> presentation · <kbd>R</kbd> rotate · <kbd>M</kbd> mirror · <kbd>F</kbd> fit all · <kbd>G</kbd> tidy · <kbd>Cmd/Ctrl D</kbd> duplicate · <kbd>Del</kbd> delete · <kbd>Esc</kbd> close',
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
const MEASURED = { text: 1, todo: 1, palette: 1, link: 1, grille: 1, pomo: 1, shape: 1, album: 1 }; // hauteur mesurée dans le DOM
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
  if (it.type === 'pomo') return { ...base, size: it.size,
    pomo: { dur: it.pomo.dur, left: Math.round(pomoLeft(it.pomo)), done: it.pomo.done, running: it.pomo.running, endAt: it.pomo.endAt } };
  if (it.type === 'shape') return { ...base, size: it.size, form: it.form, color: it.color, fill: it.fill, text: it.text };
  if (it.type === 'album') return { ...base, size: it.size, name: it.name,
    tracks: it.tracks.map(t => ({ board: t.board, ref: t.ref, title: t.title, bpm: t.bpm,
                                  bars: t.bars, meter: t.meter, state: t.state, peak: t.peak })) };
  if (it.type === 'grille') return { ...base, size: it.size, plan: it.plan };
  return base;
}
function saveState() {
  if (!ready || !library) return;
  const state = {
    v: 4, view: { x: view.x, y: view.y, s: view.s }, locked, bg,
    items: items.map(serializeItem),
    arrows: arrows.map(a => ({ id: a.id, from: a.from, to: a.to, color: a.color })),
  };
  const b = library.boards.find(x => x.id === library.current);
  if (b) { b.updated = Date.now(); b.count = items.length; }
  Promise.all([dbPutMeta('state-' + library.current, state), dbPutMeta('library', library)])
    .catch(() => toast(tr('saveFull')));
  if (typeof dbxTouch === 'function') dbxTouch();
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
  } else if (it.type === 'grille') {
    el.innerHTML = '<span class="gname"></span><span class="gmeta"></span>'
      + '<span class="gstrip"></span><span class="gspark"></span>';
  } else if (it.type === 'pomo') {
    el.innerHTML = pomoMarkup();
  } else if (it.type === 'shape') {
    el.innerHTML = '<span class="tx"></span>';
  } else if (it.type === 'album') {
    el.innerHTML = '<span class="alname"></span><span class="almeta"></span>'
      + '<span class="alarc"></span><span class="allines"></span>'
      + '<button class="aladd" data-al="add"></button>';
  }
  addHandles(el);
  if (it.type === 'todo') updateTodoDOM(it, el);
  if (it.type === 'link') updateLinkDOM(it, el);
  if (it.type === 'grille') updateGrilleDOM(it, el);
  if (it.type === 'pomo') setTimeout(() => { updatePomoDOM(it); pomoSync(); }, 0);
  if (it.type === 'shape') updateShapeDOM(it, el);
  if (it.type === 'album') updateAlbumDOM(it, el);
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
  queueArrows();
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
  } else if (it.type === 'todo' || it.type === 'palette' || it.type === 'link' || it.type === 'grille' || it.type === 'pomo' || it.type === 'shape' || it.type === 'album') {
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
const multi = new Set(); // sélection multiple ; `selected` reste l'élément principal (poignées)
function refreshSelClasses() {
  document.body.classList.toggle('has-selection', multi.size > 0);
  const single = multi.size === 1 ? selected : null;
  document.body.classList.toggle('sel-img', !!single && single.type === 'img');
  document.body.classList.toggle('sel-text', !!single && single.type === 'text');
  document.body.classList.toggle('multi-sel', multi.size > 1);
}
function select(it) {
  if (typeof syncShapeBar === 'function') setTimeout(() => syncShapeBar(it), 0);
  for (const m of multi) m.el.classList.remove('selected');
  multi.clear();
  selected = it || null;
  if (it) { multi.add(it); it.el.classList.add('selected'); }
  refreshSelClasses();
  $('adjust').classList.remove('open');
}
function toggleSelect(it) {
  if (multi.has(it)) {
    multi.delete(it);
    it.el.classList.remove('selected');
    if (selected === it) selected = multi.size ? [...multi][multi.size - 1] : null;
  } else {
    multi.add(it);
    it.el.classList.add('selected');
    selected = it;
  }
  refreshSelClasses();
  $('adjust').classList.remove('open');
}
function selectAll() {
  select(null);
  items.forEach(it => { multi.add(it); it.el.classList.add('selected'); });
  selected = items.length ? items[items.length - 1] : null;
  refreshSelClasses();
}
function removeItem(it, instant) {
  removeArrowsOf(it.id);
  if (editingText === it) commitTextEdit();
  if (editingTodo && editingTodo.it === it) commitTodoEdit();
  if (multi.has(it)) {
    multi.delete(it);
    it.el.classList.remove('selected');
    if (selected === it) selected = multi.size ? [...multi][multi.size - 1] : null;
    refreshSelClasses();
  }
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
    const type = blob.type === 'image/jpeg' || blob.type === 'image/heic' || blob.type === 'image/heif'
      ? 'image/jpeg' : 'image/png';         // PNG par défaut : préserve la transparence (webp, etc.)
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
    const actions = document.createElement('div');
    actions.className = 'atoggles';
    const cropBtn = document.createElement('button');
    cropBtn.className = 'tgl';
    cropBtn.textContent = tr('cropLabel');
    cropBtn.addEventListener('click', () => openCrop(it));
    const pal = document.createElement('button');
    pal.className = 'tgl';
    pal.textContent = tr('extractLabel');
    pal.addEventListener('click', () => { closePopovers(); extractPalette(it); });
    actions.append(cropBtn, pal);
    box.appendChild(actions);
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

/* ============================== dupliquer / ranger ============================== */
function duplicateItem(src, noOffset) {
  if (!src) return null;
  const off = noOffset ? 0 : 24 / view.s;
  const base = { id: uid(), type: src.type, x: src.x + off, y: src.y + off, w: src.w, rot: src.rot };
  let it = null;
  if (src.type === 'img') {
    it = { ...base, ar: src.ar, flip: src.flip, filters: { ...src.filters }, blob: src.blob, url: URL.createObjectURL(src.blob) };
    dbPutImage(it.id, src.blob).catch(() => {});
  } else if (src.type === 'stroke') {
    it = { ...base, ar: src.ar, natW: src.natW, natH: src.natH, color: src.color, size: src.size, hit: src.hit, pts: src.pts.map(p => [p[0], p[1]]) };
  } else if (src.type === 'text') {
    it = { ...base, text: src.text, color: src.color, size: src.size, serif: src.serif };
  } else if (src.type === 'todo') {
    it = { ...base, size: src.size, entries: src.entries.map(e => ({ t: e.t, done: e.done })) };
  } else if (src.type === 'palette') {
    it = { ...base, colors: [...src.colors] };
  } else if (src.type === 'link') {
    it = { ...base, target: src.target, name: src.name };
  }
  if (!it) return null;
  addItem(it);
  select(it);
  scheduleSave();
  return it;
}

function itemBBox(it) {
  const h = itemH(it), c = itemCenter(it);
  const cos = Math.abs(Math.cos(it.rot)), sin = Math.abs(Math.sin(it.rot));
  const bw = it.w * cos + h * sin, bh = it.w * sin + h * cos;
  return { x1: c.x - bw / 2, y1: c.y - bh / 2, x2: c.x + bw / 2, y2: c.y + bh / 2, bw, bh };
}
/* Regroupe les traits qui se touchent presque : deux traits dont les boites,
   dilatees d'une marge, se recouvrent appartiennent au meme dessin. */
function clusterStrokes(list) {
  if (list.length < 2) return list.length ? [list] : [];
  const bb = list.map(itemBBox);
  const sizes = list.map((_, i) => Math.max(bb[i].bw, bb[i].bh)).sort((a, b) => a - b);
  const med = sizes[Math.floor(sizes.length / 2)] || 1;
  const m = Math.max(med * 0.7, 8);
  const parent = list.map((_, i) => i);
  const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = bb[i], b = bb[j];
      const near = a.x1 - m < b.x2 && b.x1 - m < a.x2 && a.y1 - m < b.y2 && b.y1 - m < a.y2;
      if (near) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  list.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });
  return [...groups.values()];
}

function arrangeBoard() {
  if (items.length < 2) return;
  commitTextEdit();
  commitTodoEdit();
  // Les annotations (traits, textes) qui recouvrent un élément suivent cet élément.
  const SOLID = { img: 1, todo: 1, palette: 1, link: 1, grille: 1, pomo: 1, shape: 1, album: 1 };
  const hosts = items.filter(i => SOLID[i.type]);
  const attached = new Map(); // annotation -> hôte
  for (const it of items) {
    if (SOLID[it.type]) continue;
    const bb = itemBBox(it);
    const area = bb.bw * bb.bh || 1;
    let best = null, bestCover = 0;
    for (const h of hosts) {
      const hb = itemBBox(h);
      const ix = Math.max(0, Math.min(bb.x2, hb.x2) - Math.max(bb.x1, hb.x1));
      const iy = Math.max(0, Math.min(bb.y2, hb.y2) - Math.max(bb.y1, hb.y1));
      const cover = ix * iy / area;
      if (cover > bestCover) { bestCover = cover; best = h; }
    }
    if (best && bestCover >= 0.45) attached.set(it, best);
  }
  /* Une ecriture a la main, c'est vingt traits separes : ranges un par un ils
     partiraient en morceaux. On regroupe donc les traits voisins en un seul bloc. */
  const loose = items.filter(i => !attached.has(i) && i.type === 'stroke');
  const clusters = clusterStrokes(loose);
  const inCluster = new Map();
  for (const c of clusters) for (const it of c) inCluster.set(it, c);

  const packed = [];
  const seen = new Set();
  for (const it of items) {
    if (attached.has(it)) continue;
    const c = inCluster.get(it);
    if (!c) { packed.push([it]); continue; }
    if (seen.has(c)) continue;
    seen.add(c); packed.push(c);
  }
  const boxes = packed.map(group => {
    const bs = group.map(itemBBox);
    const x1 = Math.min(...bs.map(b => b.x1)), y1 = Math.min(...bs.map(b => b.y1));
    const x2 = Math.max(...bs.map(b => b.x2)), y2 = Math.max(...bs.map(b => b.y2));
    return { group, it: group[0], bw: x2 - x1, bh: y2 - y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 };
  });
  const gap = 0.06 * boxes.reduce((s, b) => s + b.bw, 0) / boxes.length;
  const area = boxes.reduce((s, b) => s + (b.bw + gap) * (b.bh + gap), 0);
  const targetW = Math.max(Math.sqrt(area * 1.4), ...boxes.map(b => b.bw));
  const sorted = [...boxes].sort((a, b) => b.bh - a.bh);
  let x = 0, y = 0, rowH = 0;
  for (const b of sorted) {
    if (x > 0 && x + b.bw > targetW) { x = 0; y += rowH + gap; rowH = 0; }
    b.nx = x + b.bw / 2;
    b.ny = y + b.bh / 2;
    x += b.bw + gap;
    rowH = Math.max(rowH, b.bh);
  }
  const deltas = new Map();
  for (const b of sorted) {
    const dx = b.nx - b.cx, dy = b.ny - b.cy;
    for (const it of b.group) {
      deltas.set(it, [dx, dy]);
      it.x += dx;
      it.y += dy;
      it.el.classList.add('arranging');
      renderItem(it);
    }
  }
  for (const [it, host] of attached) {
    const d = deltas.get(host) || [0, 0];
    it.x += d[0];
    it.y += d[1];
    it.el.classList.add('arranging');
    renderItem(it);
  }
  setTimeout(() => { for (const it of items) it.el.classList.remove('arranging'); }, 600);
  scheduleSave();
  requestAnimationFrame(fitView);
  toast(tr('arranged'));
}

/* ============================== recadrage ============================== */
const cropState = { it: null, rect: null, g: null };
function openCrop(it) {
  if (!it || it.type !== 'img') return;
  closePopovers();
  cropState.it = it;
  const img = $('crop-img');
  const ready = () => {
    cropState.rect = { x: 0, y: 0, w: img.clientWidth, h: img.clientHeight };
    renderCropRect();
  };
  img.onload = ready;
  $('crop').classList.remove('hidden'); // visible d'abord, pour que clientWidth soit mesurable
  img.src = it.url;
  if (img.complete && img.clientWidth) ready();
}
function renderCropRect() {
  const r = $('crop-rect'), c = cropState.rect;
  r.style.left = c.x + 'px';
  r.style.top = c.y + 'px';
  r.style.width = c.w + 'px';
  r.style.height = c.h + 'px';
}
function closeCrop() {
  $('crop').classList.add('hidden');
  $('crop-img').removeAttribute('src');
  cropState.it = null;
  cropState.g = null;
}
{
  const crop = $('crop'), img = $('crop-img');
  const MINC = 28;
  crop.addEventListener('pointerdown', e => {
    if (e.target.closest('#crop-actions')) return;
    e.preventDefault();
    const handle = e.target.closest('.cch');
    const onRect = e.target.closest('#crop-rect');
    if (!handle && !onRect) return;
    try { crop.setPointerCapture(e.pointerId); } catch (_) {}
    const c = cropState.rect;
    cropState.g = {
      pid: e.pointerId, px: e.clientX, py: e.clientY,
      start: { ...c },
      corner: handle ? handle.className.match(/c-(\w+)/)[1] : null,
    };
  });
  crop.addEventListener('pointermove', e => {
    const g = cropState.g;
    if (!g || e.pointerId !== g.pid) return;
    const W = img.clientWidth, H = img.clientHeight;
    const dx = e.clientX - g.px, dy = e.clientY - g.py;
    const s = g.start, c = cropState.rect;
    if (!g.corner) {
      c.x = clamp(s.x + dx, 0, W - s.w);
      c.y = clamp(s.y + dy, 0, H - s.h);
    } else {
      let x1 = s.x, y1 = s.y, x2 = s.x + s.w, y2 = s.y + s.h;
      if (g.corner.includes('w')) x1 = clamp(s.x + dx, 0, x2 - MINC);
      if (g.corner.includes('e')) x2 = clamp(s.x + s.w + dx, x1 + MINC, W);
      if (g.corner.includes('n')) y1 = clamp(s.y + dy, 0, y2 - MINC);
      if (g.corner.includes('s')) y2 = clamp(s.y + s.h + dy, y1 + MINC, H);
      c.x = x1; c.y = y1; c.w = x2 - x1; c.h = y2 - y1;
    }
    renderCropRect();
  });
  const end = e => { if (cropState.g && e.pointerId === cropState.g.pid) cropState.g = null; };
  crop.addEventListener('pointerup', end);
  crop.addEventListener('pointercancel', end);
  // rotation de l'écran / redimensionnement : l'image affichée change d'échelle, on repart plein cadre
  addEventListener('resize', () => {
    if ($('crop').classList.contains('hidden') || !cropState.it) return;
    cropState.g = null;
    cropState.rect = { x: 0, y: 0, w: img.clientWidth, h: img.clientHeight };
    renderCropRect();
  });
  $('crop-cancel').addEventListener('click', closeCrop);
  $('crop-ok').addEventListener('click', async () => {
    const it = cropState.it, c = cropState.rect;
    if (!it || !c) { closeCrop(); return; }
    try {
      const info = await loadBlobAsImage(it.blob);
      const fx = c.x / img.clientWidth, fy = c.y / img.clientHeight;
      const fw = c.w / img.clientWidth, fh = c.h / img.clientHeight;
      let sx = Math.round(fx * info.w), sy = Math.round(fy * info.h);
      let sw = Math.max(2, Math.round(fw * info.w)), sh = Math.max(2, Math.round(fh * info.h));
      sx = clamp(sx, 0, info.w - 2); sy = clamp(sy, 0, info.h - 2);
      sw = clamp(sw, 2, info.w - sx); sh = clamp(sh, 2, info.h - sy);
      const canvas = document.createElement('canvas');
      canvas.width = sw; canvas.height = sh;
      canvas.getContext('2d').drawImage(info.img, sx, sy, sw, sh, 0, 0, sw, sh);
      URL.revokeObjectURL(info.url);
      // JPEG seulement si la source l'était déjà : le PNG préserve la transparence
      const type = it.blob.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const blob = await new Promise(r => canvas.toBlob(r, type, 0.92));
      if (!blob) throw new Error('toBlob');
      const old = it.url;
      it.blob = blob;
      it.url = URL.createObjectURL(blob);
      // la zone gardée reste exactement là où elle était sur le board (rotation et miroir compris)
      const oldW = it.w, oldH = it.w / it.ar;
      const ocx = it.x + oldW / 2, ocy = it.y + oldH / 2;
      let dx = (fx + fw / 2 - 0.5) * oldW;
      const dy = (fy + fh / 2 - 0.5) * oldH;
      if (it.flip) dx = -dx;
      const cos = Math.cos(it.rot), sin = Math.sin(it.rot);
      const ncx = ocx + dx * cos - dy * sin, ncy = ocy + dx * sin + dy * cos;
      it.ar = sw / sh;
      it.w = oldW * fw;
      it.x = ncx - it.w / 2;
      it.y = ncy - it.w / it.ar / 2;
      if (it._edgeUrl) { URL.revokeObjectURL(it._edgeUrl); it._edgeUrl = null; }
      it._edgePromise = null;
      it.el.firstChild.src = it.url;
      URL.revokeObjectURL(old);
      renderItem(it);
      dbPutImage(it.id, blob).catch(() => toast(tr('imgFull')));
      scheduleSave();
      closeCrop();
    } catch (e) {
      closeCrop();
      toast(tr('cropFail'));
    }
  });
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
  if (locked || (it.type !== 'text' && it.type !== 'shape')) return;
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
  if (!it.text.trim() && it.type === 'text') { removeItem(it, true); return; }
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
  } else if (gesture.type === 'move-group') {
    gesture = {
      type: 'move-group', pid, moved: true,
      start: { px: p.x, py: p.y },
      members: gesture.members.map(s => ({ m: s.m, x: s.m.x, y: s.m.y })),
    };
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
      // Maj+clic : ajoute/retire de la sélection multiple
      if (e.shiftKey) { toggleSelect(it); return; }
      // double-tap : édition texte / ligne de checklist / ouverture de lien
      const now = performance.now();
      if (!e.altKey && it._lastTap && now - it._lastTap < 350) {
        it._lastTap = 0;
        if (it.type === 'text') { select(it); editText(it); return; }
        if (it.type === 'link') { openLinkTarget(it); return; }
        if (it.type === 'grille') { select(it); openGrille(it); return; }
        /* le double-tape ne renomme que sur le titre : sinon deux appuis rapides
           sur deux pastilles d'etat declencheraient un renommage */
        if (it.type === 'album') {
          if (e.target.closest('.alname')) { select(it); editAlbumName(it); }
          return;
        }
        if (it.type === 'todo') {
          const row = e.target.closest('.trow:not(.tadd)');
          if (row) { select(it); editTodoRow(it, +row.dataset.i); return; }
        }
      }
      if (!e.altKey) it._lastTap = now;
      // membre d'une sélection multiple : on déplace tout le groupe
      if (multi.size > 1 && multi.has(it)) {
        gesture = {
          type: 'move-group', pid: e.pointerId, moved: false,
          start: { px: e.clientX, py: e.clientY },
          members: [...multi].map(m => ({ m, x: m.x, y: m.y })),
        };
        gesture.lp = setTimeout(() => { // appui long : retire l'élément du groupe
          if (gesture && gesture.lp && !gesture.moved) {
            toggleSelect(it);
            toast(tr('selCount')(multi.size));
            gesture = null;
          }
        }, 500);
        return;
      }
      // s'il existe déjà une sélection ailleurs, on attend de savoir si c'est un tap
      // (remplace), un glisser (remplace) ou un appui long (ajoute au groupe)
      if (linkFrom && linkFrom !== it) {
        addArrow(linkFrom, it);
        linkFrom = null;
        toast(ST.linked);
        select(it);
        return;
      }
      const deferSelect = multi.size >= 1 && !multi.has(it) ? it : null;
      if (!deferSelect) { select(it); bringToFront(it); }
      // Alt+glisser : la copie n'est créée qu'au début du vrai glisser (pas au simple clic)
      const target = it;
      // actions au relâchement (tap sans déplacement) : cocher, ajouter une ligne, copier une couleur
      let tap = null;
      if (it.type === 'todo') {
        const check = e.target.closest('.todo-check');
        const add = e.target.closest('.trow.tadd');
        if (check) { const i = +check.closest('.trow').dataset.i; tap = () => toggleTodo(it, i); }
        else if (add) tap = () => { it.entries.push({ t: '', done: false }); updateTodoDOM(it); renderItem(it); editTodoRow(it, it.entries.length - 1); scheduleSave(); };
      } else if (it.type === 'pomo') {
        const b = e.target.closest('[data-p]');
        if (b) { const a = b.dataset.p; tap = () => pomoAction(it, a); }
      } else if (it.type === 'album') {
        const b = e.target.closest('[data-al]');
        if (b) { const a = b.dataset.al, i = +b.dataset.i; tap = () => albumAction(it, a, i); }
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
      gesture = { type: 'move', it: target, pid: e.pointerId, moved: false, tap, deferSelect, alt: e.altKey && !deferSelect, start: { px: e.clientX, py: e.clientY, x: target.x, y: target.y } };
      const g = gesture;
      g.lp = setTimeout(() => { // appui long : ajoute à la sélection existante
        if (gesture === g && !g.moved && g.deferSelect) {
          toggleSelect(g.deferSelect);
          toast(tr('selCount')(multi.size));
          gesture = null;
        }
      }, 500);
    } else {
      if (e.shiftKey) { // Maj+glisser sur le fond : rectangle de sélection
        const band = document.createElement('div');
        band.id = 'band';
        document.body.appendChild(band);
        gesture = { type: 'band', pid: e.pointerId, el: band, start: { px: e.clientX, py: e.clientY } };
        return;
      }
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

  if (g.type === 'move-group') {
    if (e.pointerId !== g.pid) return;
    if (!g.moved && Math.hypot(e.clientX - g.start.px, e.clientY - g.start.py) > 4) {
      g.moved = true;
      if (g.lp) { clearTimeout(g.lp); g.lp = null; }
    }
    if (!g.moved) return;
    const dx = (e.clientX - g.start.px) / view.s, dy = (e.clientY - g.start.py) / view.s;
    for (const s of g.members) { s.m.x = s.x + dx; s.m.y = s.y + dy; renderItem(s.m); }
    return;
  }
  if (g.type === 'band') {
    if (e.pointerId !== g.pid) return;
    const x = Math.min(e.clientX, g.start.px), y = Math.min(e.clientY, g.start.py);
    g.el.style.left = x + 'px';
    g.el.style.top = y + 'px';
    g.el.style.width = Math.abs(e.clientX - g.start.px) + 'px';
    g.el.style.height = Math.abs(e.clientY - g.start.py) + 'px';
    g.cur = { x: e.clientX, y: e.clientY };
    return;
  }
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
    if (!g.moved && Math.hypot(e.clientX - g.start.px, e.clientY - g.start.py) > 4) {
      g.moved = true;
      if (g.lp) { clearTimeout(g.lp); g.lp = null; }
      if (g.deferSelect) { select(g.deferSelect); bringToFront(g.deferSelect); g.deferSelect = null; }
      if (g.alt) { g.alt = false; const copy = duplicateItem(g.it, true); if (copy) g.it = copy; }
    }
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
  if (gesture.lp) { clearTimeout(gesture.lp); gesture.lp = null; }
  if (gesture.type === 'draw') {
    if (e.pointerId === gesture.pid) {
      if (e.type === 'pointercancel') cancelDraw(gesture); else finishDraw(gesture);
      gesture = null;
    }
    return;
  }
  if (gesture.type === 'band') {
    if (e.pointerId !== gesture.pid) return;
    const g = gesture;
    gesture = null;
    g.el.remove();
    if (e.type === 'pointerup' && g.cur) {
      const a = toWorld(Math.min(g.start.px, g.cur.x), Math.min(g.start.py, g.cur.y));
      const b = toWorld(Math.max(g.start.px, g.cur.x), Math.max(g.start.py, g.cur.y));
      select(null);
      for (const it of items) {
        const bb = itemBBox(it);
        if (bb.x1 < b.x && bb.x2 > a.x && bb.y1 < b.y && bb.y2 > a.y) toggleSelect(it);
      }
      if (multi.size) toast(tr('selCount')(multi.size));
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
    if (g.type === 'move' && !g.moved && e.type === 'pointerup') {
      if (g.deferSelect) { select(g.deferSelect); bringToFront(g.deferSelect); }
      else if (g.tap) g.tap();
    }
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
  if (!multi.size) return;
  for (const it of multi) {
    it.rot = normAngle(Math.round((it.rot + delta) / HALF_PI) * HALF_PI);
    renderItem(it);
  }
  scheduleSave();
}
function flipSelected() {
  let n = 0;
  for (const it of multi) {
    if (it.type !== 'img') continue;
    it.flip = !it.flip;
    renderItem(it);
    n++;
  }
  if (n) scheduleSave();
}
function removeSelected() {
  for (const it of [...multi]) removeItem(it);
}
function duplicateSelection() {
  if (!multi.size) return;
  const sources = [...multi];
  const copies = [];
  for (const src of sources) {
    const c = duplicateItem(src);
    if (c) copies.push(c);
  }
  select(null);
  copies.forEach((c, i) => { if (i === 0) select(c); else toggleSelect(c); });
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
const POPOVERS = ['more', 'swatches', 'penbar', 'adjust', 'shapebar', 'dbx', 'albumpick'];
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
  else if (act === 'arrange') arrangeBoard();
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
  else if (act === 'album') { const it = addAlbumItem(); select(it); scheduleSave(); openAlbumPick(it); }
  else if (act === 'dbx') dbxPanel();
  else if (act === 'shape') { const it = addShapeItem(); select(it); syncShapeBar(it); scheduleSave(); }
  else if (act === 'pomo') { const it = addPomoItem(); select(it); scheduleSave(); }
  else if (act === 'grille') {
    const it = addGrilleItem(newPlan());
    select(it); scheduleSave();
    openGrille(it);
    gview.edit = true; renderGrille();
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
  closeCalendar();
  if (boardId !== library.current) await switchBoard(boardId);
  const it = items.find(i => i.id === itemId);
  if (!it) { toast(tr('pinnedGone')); return; }
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
  arrows = []; selectedArrow = null; linkFrom = null;
  if (document.getElementById('arrows')) document.getElementById('arrows').innerHTML = '';
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
        } else if (type === 'pomo') {
          addItem({
            id: raw.id || uid(), type: 'pomo', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0, size: +raw.size || 15,
            pomo: normPomo(raw.pomo),
          });
        } else if (type === 'album') {
          addItem({
            id: raw.id || uid(), type: 'album', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0, size: +raw.size || 15,
            ...normAlbum(raw),
          });
        } else if (type === 'shape') {
          addItem({
            id: raw.id || uid(), type: 'shape', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0, size: +raw.size || 16,
            ...normShape(raw),
          });
        } else if (type === 'grille' && isPlan(raw.plan)) {
          addItem({
            id: raw.id || uid(), type: 'grille', x: raw.x, y: raw.y, w: raw.w,
            rot: isFinite(+raw.rot) ? +raw.rot : 0, size: +raw.size || 18,
            plan: normPlan(raw.plan),
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
  arrows = [];
  if (state && Array.isArray(state.arrows)) {
    const ids = new Set(items.map(i => i.id));
    arrows = state.arrows
      .filter(a => a && ids.has(a.from) && ids.has(a.to) && a.from !== a.to)
      .map(a => ({ id: a.id || uid(), from: a.from, to: a.to, color: SHAPE_KEYS.includes(a.color) ? a.color : 'graphite' }));
  }
  selectedArrow = null; linkFrom = null;
  drawArrows();
  for (const it of items) if (it.type === 'album') albumRefresh(it);
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

function createBoard(name, forceId) {
  flushSave();
  const id = forceId || uid();
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
    if (ev.itemId) {
      const pin = document.createElement('button');
      pin.className = 'evpin';
      pin.title = tr('pinTitle');
      pin.innerHTML = '<svg class="ic" viewBox="0 0 24 24" style="width:14px;height:14px"><path d="M12 21s-6-5.1-6-10a6 6 0 0 1 12 0c0 4.9-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/></svg>';
      pin.addEventListener('click', () => { closeCalendar(); jumpToNote(ev.boardId, ev.itemId); });
      row.append(pin);
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
  calendar.events.push({
    id: uid(), boardId: library.current, date: calSel, time: $('cal-time').value || '', title,
    itemId: selected ? selected.id : '',      // épinglé à l'élément sélectionné au moment de l'ajout
  });
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
/* Fabrique le fichier de sauvegarde du board courant. Le même sert au
   téléchargement local et à l'envoi Dropbox : un seul format à maintenir. */
async function boardBackup() {
  const b = boardMeta(library.current);
  const events = calendar.events.filter(e => e.boardId === library.current)
    .map(e => ({ date: e.date, time: e.time, title: e.title }));
  const parts = ['{"app":"refy","v":4,"name":' + JSON.stringify((b && b.name) || 'Board') +
                 ',"view":' + JSON.stringify({ x: view.x, y: view.y, s: view.s }) +
                 ',"bg":' + JSON.stringify(bg) +
                 ',"arrows":' + JSON.stringify(arrows.map(a => ({ from: a.from, to: a.to, color: a.color }))) +
                 ',"events":' + JSON.stringify(events) + ',"items":['];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const entry = serializeItem(it);
    if (it.type === 'img') entry.data = await blobToDataURL(it.blob);
    parts.push((i ? ',' : '') + JSON.stringify(entry));
  }
  parts.push(']}');
  const slug = ((b && b.name) || 'board').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || 'board';
  return { blob: new Blob(parts, { type: 'application/json' }), name: `refy-${slug}.refy.json`, slug };
}

async function exportBoard() {
  if (!items.length) { toast(tr('nothingExport')); return; }
  toast(tr('backupWorking'));
  try {
    const { blob, slug } = await boardBackup();
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
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
  const savedArrows = Array.isArray(data.arrows) ? data.arrows : [];
  const name = (typeof data.name === 'string' && data.name.trim())
    ? data.name.trim().slice(0, 48)
    : (file.name.replace(/\.refy\.json$|\.json$/i, '').replace(/^refy-/, '').slice(0, 48) || 'Import');
  createBoard(name);
  ready = false;
  for (const d of decoded) {
    const raw = d.raw;
    const common = {
      id: raw.id || uid(),
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
    } else if (d.type === 'album') {
      addItem({ ...common, type: 'album', size: +raw.size || 15, ...normAlbum(raw) });
    } else if (d.type === 'shape') {
      addItem({ ...common, type: 'shape', size: +raw.size || 16, ...normShape(raw) });
    } else if (d.type === 'pomo') {
      addItem({ ...common, type: 'pomo', size: +raw.size || 15, pomo: normPomo(raw.pomo) });
    } else if (d.type === 'grille' && isPlan(raw.plan)) {
      addItem({ ...common, type: 'grille', size: +raw.size || 18, plan: normPlan(raw.plan) });
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
$('btn-del').addEventListener('click', removeSelected);
$('btn-dup').addEventListener('click', duplicateSelection);
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
  // modale de recadrage : Échap annule, Entrée valide, tout le reste est neutralisé
  if (!$('crop').classList.contains('hidden')) {
    if (e.key === 'Escape') closeCrop();
    else if (e.key === 'Enter') $('crop-ok').click();
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && multi.size) { e.preventDefault(); removeSelected(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'z' && tool === 'draw') { e.preventDefault(); $('pen-undo').click(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'd' && multi.size) { e.preventDefault(); duplicateSelection(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'a') { e.preventDefault(); selectAll(); }
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
  else if (e.key === 'g' || e.key === 'G') arrangeBoard();
  else if (e.key === 'l' || e.key === 'L') document.querySelector('#more button[data-act="todo"]').click();
  else if (e.key === 'Escape') {
    if (tool === 'draw') setTool(null);
    select(null);
    $('help').classList.add('hidden');
    if (!$('grille').classList.contains('hidden')) closeGrille();
    closePopovers();
    closeLibrary();
    closeCalendar();
  }
});

document.addEventListener('paste', e => {
  if (locked || isTyping(e) || !$('crop').classList.contains('hidden')) return;
  const files = [...(e.clipboardData?.items || [])]
    .filter(i => i.kind === 'file')
    .map(i => i.getAsFile())
    .filter(Boolean);
  if (files.length) { e.preventDefault(); importFiles(files); return; }
  const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
  if (text && text.trim()) {
    e.preventDefault();
    if (text.trim()[0] === '{') {
      let data = null;
      try { data = JSON.parse(text); } catch (_) {}
      if (isPlan(data)) {
        const g = addGrilleItem(data);
        select(g);
        scheduleSave();
        toast(tr('gAdded')(g.plan.title));
        return;
      }
    }
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

/* ============================== grille de morceau ==============================
   Un plan d'arrangement posé sur le board. Tout est écrit en mesures :
   les timecodes se déduisent du BPM, donc changer le tempo met la grille à jour.
   La carte reste compacte ; le détail vit en plein écran (double-tape). */

const GT = lang === 'fr' ? {
  title: 'Titre', bpm: 'BPM', bars: 'Mesures', phrase: 'Phrase', notes: 'Notes',
  sections: 'Sections', lanes: 'Pistes', marks: 'Repères', zones: 'Zones', energy: 'Énergie',
  addSec: 'Ajouter une section', addLane: 'Ajouter une piste', addClip: 'clip',
  import: 'Importer', addMark: 'Ajouter un repère', addZone: 'Ajouter une zone', addPt: 'Ajouter un point',
  name: 'nom', label: 'libellé', from: 'de', to: 'à', bar: 'mesure', level: 'niveau',
  none: 'plein', fin: 'entrée', fout: 'sortie', fboth: 'entrée + sortie', fgrow: 'croissant',
  accent: 'accent', del: 'Supprimer', edit: 'Éditer', done: 'Terminé',
  perBar: n => `1 mesure = ${n} s`, empty: 'Rien pour l\u2019instant',
} : {
  title: 'Title', bpm: 'BPM', bars: 'Bars', phrase: 'Phrase', notes: 'Notes',
  sections: 'Sections', lanes: 'Lanes', marks: 'Markers', zones: 'Zones', energy: 'Energy',
  addSec: 'Add a section', addLane: 'Add a lane', addClip: 'clip',
  import: 'Import', addMark: 'Add a marker', addZone: 'Add a zone', addPt: 'Add a point',
  name: 'name', label: 'label', from: 'from', to: 'to', bar: 'bar', level: 'level',
  none: 'full', fin: 'fade in', fout: 'fade out', fboth: 'in + out', fgrow: 'grow',
  accent: 'accent', del: 'Delete', edit: 'Edit', done: 'Done',
  perBar: n => `1 bar = ${n} s`, empty: 'Nothing yet',
};

/* une grille vierge : de quoi commencer a taper tout de suite */
function newPlan() {
  return {
    title: lang === 'fr' ? 'Nouveau morceau' : 'New track',
    bpm: 120, meter: [4, 4], bars: 64, phrase: 16,
    sections: [{ bar: 1, name: 'Intro' }],
    lanes: [], energy: [{ bar: 1, v: .2 }, { bar: 64, v: .8 }],
    markers: [], zones: [], history: [],
  };
}

function isPlan(o) {
  return !!o && typeof o === 'object' && !Array.isArray(o)
    && typeof o.title === 'string' && typeof o.bpm === 'number' && typeof o.bars === 'number'
    && o.bpm > 0 && o.bars > 0;
}
function normPlan(raw) {
  const p = { ...raw };
  p.title = String(p.title || 'Sans titre');
  p.bpm = clamp(+p.bpm || 120, 20, 400);
  p.bars = clamp(Math.round(+p.bars) || 16, 1, 9999);
  p.meter = Array.isArray(p.meter) && p.meter.length ? p.meter : [4, 4];
  p.phrase = clamp(Math.round(+p.phrase) || 16, 1, 64);
  p.sections = (p.sections || []).map(s => ({ ...s, bar: clamp(Math.round(+s.bar) || 1, 1, p.bars), name: String(s.name || '') }));
  p.lanes = (p.lanes || []).map(l => ({
    name: String(l.name || ''),
    clips: (l.clips || []).map(c => {
      const from = clamp(Math.round(+c.from) || 1, 1, p.bars);
      return { ...c, from, to: clamp(Math.round(+c.to) || from, from, p.bars) };
    }),
  }));
  p.energy = (p.energy || []).map(e => ({ bar: clamp(Math.round(+e.bar) || 1, 1, p.bars), v: clamp(+e.v || 0, 0, 1) }));
  p.markers = (p.markers || []).map(m => ({ bar: clamp(Math.round(+m.bar) || 1, 1, p.bars), label: String(m.label || '') }));
  p.zones = (p.zones || []).map(z => {
    const from = clamp(Math.round(+z.from) || 1, 1, p.bars);
    return { from, to: clamp(Math.round(+z.to) || from, from, p.bars), label: String(z.label || '') };
  });
  p.history = p.history || [];
  return p;
}
const planBarSec = p => (60 / p.bpm) * (p.meter[0] || 4);
const planLen = p => p.bars * planBarSec(p);
const planBarTime = (p, bar) => (bar - 1) * planBarSec(p);
const planBarAt = (p, sec) => clamp(Math.floor(sec / planBarSec(p)) + 1, 1, p.bars);
const planPct = (p, bar) => ((bar - 1) / p.bars) * 100;
const planSpan = (p, a, b) => ((b - a + 1) / p.bars) * 100;
function planTime(sec) {
  sec = Math.max(0, Math.round(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
/* le tri se fait à l'affichage : l'ordre de saisie n'a donc pas d'importance */
function planSections(p) {
  const s = p.sections.slice().sort((a, b) => a.bar - b.bar);
  return s.map((x, i) => ({ ...x, from: x.bar, to: i + 1 < s.length ? s[i + 1].bar - 1 : p.bars }));
}
function planEnergyAt(p, bar) {
  const e = p.energy.slice().sort((a, b) => a.bar - b.bar);
  if (!e.length) return .5;
  if (bar <= e[0].bar) return e[0].v;
  for (let i = 1; i < e.length; i++) {
    if (bar <= e[i].bar) {
      const a = e[i - 1], b = e[i];
      return a.v + (b.v - a.v) * ((bar - a.bar) / ((b.bar - a.bar) || 1));
    }
  }
  return e[e.length - 1].v;
}
/* une section n'a pas de couleur : elle a une valeur, celle de son énergie moyenne */
function planLevel(p, s) {
  const step = Math.max(1, Math.round((s.to - s.from) / 8));
  let sum = 0, n = 0;
  for (let b = s.from; b <= s.to; b += step) { sum += planEnergyAt(p, b); n++; }
  return clamp(n ? sum / n : .5, 0, 1);
}
const grayPaper = v => { const l = Math.round(206 - v * 158); return `rgb(${l},${l},${l})`; };
const grayDark = v => { const l = Math.round(24 + v * 52); return `rgb(${l},${l},${l})`; };

/* ce qui entre, ce qui tient, ce qui sort, section par section */
function planLaneStates(p, s) {
  const inn = [], keep = [], out = [], notes = [];
  for (const l of p.lanes) {
    const cl = l.clips.filter(c => c.to >= s.from && c.from <= s.to);
    if (!cl.length) continue;
    for (const c of cl) if (c.label) notes.push(c.label);
    if (cl.some(c => c.from >= s.from && c.from <= s.to)) inn.push(l.name);
    else if (cl.some(c => c.to >= s.from && c.to <= s.to && c.to < p.bars)) out.push(l.name);
    else keep.push(l.name);
  }
  for (const m of p.markers) if (m.bar >= s.from && m.bar <= s.to) notes.push(m.label + ' — ' + GT.bar + ' ' + m.bar);
  return { inn, keep, out, notes };
}
function planText(p) {
  const L = [`${p.title.toUpperCase()} — ${p.bpm} BPM — ${p.bars} ${GT.bars.toLowerCase()} — ${planTime(planLen(p))}`, ''];
  for (const s of planSections(p)) {
    const st = planLaneStates(p, s);
    L.push(`${planTime(planBarTime(p, s.from)).padStart(5)}  ${String(s.from).padStart(3)} → ${String(s.to).padStart(3)}  ${s.name}`);
    const parts = [...st.inn.map(x => '+ ' + x), ...st.keep, ...st.out.map(x => '− ' + x)];
    if (parts.length) L.push('              ' + parts.join(', '));
    for (const n of st.notes) L.push('              (' + n + ')');
  }
  return L.join('\n');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- la carte sur le board ---------- */
function addGrilleItem(plan, at) {
  const p = normPlan(plan);
  const pos = at || toWorld(innerWidth / 2, innerHeight / 2);
  const w = 340 / view.s;
  const it = { id: uid(), type: 'grille', x: pos.x - w / 2, y: pos.y - w / 5, w, rot: 0, size: w / 19, plan: p };
  addItem(it);
  return it;
}
function grilleSpark(p) {
  if (p.energy.length < 2) return '';
  const e = p.energy.slice().sort((a, b) => a.bar - b.bar);
  const pts = e.map(x => `${(((x.bar - 1) / p.bars) * 100).toFixed(1)},${(24 - clamp(x.v, 0, 1) * 22).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 100 24" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`;
}
function updateGrilleDOM(it, el) {
  const p = it.plan, root = el || it.el;
  if (!root) return;
  root.querySelector('.gname').textContent = p.title;
  root.querySelector('.gmeta').textContent =
    `${p.bpm} BPM · ${p.bars} ${GT.bars.toLowerCase()} · ${planTime(planLen(p))}`;
  root.querySelector('.gstrip').innerHTML = planSections(p)
    .map(s => `<i style="width:${planSpan(p, s.from, s.to)}%;background:${grayPaper(planLevel(p, s))}"></i>`).join('');
  root.querySelector('.gspark').innerHTML = grilleSpark(p);
}

/* ---------- le plein écran ---------- */
const gview = { it: null, mode: 'liste', zoom: 1, edit: false, playing: false, t0: 0, elapsed: 0, bar: -1, key: '' };
let gRaf = null;

function grilleTimeline(p) {
  const secs = planSections(p);
  const row = (name, inner, cls) =>
    `<div class="grow ${cls || ''}"><span class="gn">${esc(name)}</span><span class="gt">${inner}</span></div>`;

  const sections = secs.map((s, i) =>
    `<b class="gsec" data-si="${i}" style="left:${planPct(p, s.from)}%;width:${planSpan(p, s.from, s.to)}%;background:${grayDark(planLevel(p, s))}"><em>${esc(s.name)}</em></b>`).join('');

  const ruler = secs.map(s =>
    `<b class="gtick" style="left:${planPct(p, s.from)}%">${planTime(planBarTime(p, s.from))}</b>`).join('');

  const e = p.energy.slice().sort((a, b) => a.bar - b.bar);
  const energy = e.length > 1
    ? `<svg viewBox="0 0 1000 100" preserveAspectRatio="none"><polyline vector-effect="non-scaling-stroke" points="${
        e.map(x => `${(((x.bar - 1) / p.bars) * 1000).toFixed(1)},${(100 - clamp(x.v, 0, 1) * 92).toFixed(1)}`).join(' ')}"/></svg>`
    : '';

  const lanes = p.lanes.map(l => row(l.name, `<b class="glane"></b>` + l.clips.map(c => {
    const fade = c.fade === 'grow' ? 'g' : c.fade === 'in' ? 'i' : c.fade === 'out' ? 'o' : c.fade === 'both' ? 'b' : '';
    const lab = c.label ? `<b class="gclab" style="left:${planPct(p, c.from) + planSpan(p, c.from, c.to) / 2}%">${esc(c.label)}</b>` : '';
    return `<b class="gclip ${c.accent ? 'acc' : ''} ${fade ? 'f' + fade : ''}" style="left:${planPct(p, c.from)}%;width:${planSpan(p, c.from, c.to)}%"></b>` + lab;
  }).join(''))).join('');

  const zones = p.zones.map(z => row('', `<b class="gzone" style="left:${planPct(p, z.from)}%;width:${planSpan(p, z.from, z.to)}%"></b>`
    + `<b class="gzlab" style="left:${planPct(p, z.from) + planSpan(p, z.from, z.to) / 2}%">${esc(z.label)}</b>`, 'gz2')).join('');

  const marks = p.markers.map(m => `<b class="gmark" style="left:${planPct(p, m.bar)}%"><em>${esc(m.label)} — ${m.bar}</em></b>`).join('');

  return `<div class="gscroll"><div class="ginner" style="--pw:${(100 * p.phrase / p.bars).toFixed(4)}%">
    ${row('', sections, 'gs')}
    ${row('', ruler, 'gr')}
    ${energy ? row(GT.energy, energy, 'ge') : ''}
    ${lanes}${zones}
    <span class="gover">${marks}<b class="ghead"></b></span>
    <span class="gtap"></span>
  </div></div>`;
}

function grilleList(p) {
  return planSections(p).map((s, i) => {
    const st = planLaneStates(p, s);
    const parts = [...st.inn.map(x => `<b>+ ${esc(x)}</b>`), ...st.keep.map(esc), ...st.out.map(x => `<s>− ${esc(x)}</s>`)];
    return `<button class="gli" data-si="${i}">
      <span class="glh"><span class="glt">${planTime(planBarTime(p, s.from))}</span>
        <span class="gln">${esc(s.name)}</span><span class="glb">${s.from} → ${s.to}</span></span>
      ${parts.length ? `<span class="gli-in">${parts.join(', ')}</span>` : ''}
      ${st.notes.map(n => `<span class="gli-note">${esc(n)}</span>`).join('')}
    </button>`;
  }).join('');
}

/* ---------- l'édition ---------- */
const gnum = (kind, i, f, v, ph, l) =>
  `<input class="gin gnum" type="number" inputmode="numeric" data-kind="${kind}" data-i="${i}"${l === undefined ? '' : ` data-l="${l}"`} data-f="${f}" value="${v}" placeholder="${esc(ph || '')}" aria-label="${esc(ph || f)}">`;
const gtxt = (kind, i, f, v, ph, l) =>
  `<input class="gin" type="text" data-kind="${kind}" data-i="${i}"${l === undefined ? '' : ` data-l="${l}"`} data-f="${f}" value="${esc(v)}" placeholder="${esc(ph || '')}" aria-label="${esc(ph || f)}">`;
const gdel = (what, i, l) => `<button class="gx" data-del="${what}" data-i="${i}"${l === undefined ? '' : ` data-l="${l}"`} title="${GT.del}">×</button>`;

function grilleEditor(p) {
  const fades = [['', GT.none], ['in', GT.fin], ['out', GT.fout], ['both', GT.fboth], ['grow', GT.fgrow]];

  const secs = p.sections.map((s, i) => `<div class="ger">
    ${gnum('sec', i, 'bar', s.bar, GT.bar)}
    ${gtxt('sec', i, 'name', s.name, GT.name)}
    ${gdel('sec', i)}
  </div>`).join('');

  const lanes = p.lanes.map((l, i) => `<div class="gelane">
    <div class="ger">
      ${gtxt('lane', i, 'name', l.name, GT.name)}
      ${gdel('lane', i)}
    </div>
    ${l.clips.map((c, j) => `<div class="ger gclipr">
      ${gnum('clip', j, 'from', c.from, GT.from, i)}
      ${gnum('clip', j, 'to', c.to, GT.to, i)}
      <select class="gin gsel" data-kind="clip" data-i="${j}" data-l="${i}" data-f="fade" aria-label="fade">
        ${fades.map(f => `<option value="${f[0]}"${(c.fade || '') === f[0] ? ' selected' : ''}>${f[1]}</option>`).join('')}
      </select>
      ${gtxt('clip', j, 'label', c.label || '', GT.label, i)}
      <label class="gck"><input type="checkbox" data-kind="clip" data-i="${j}" data-l="${i}" data-f="accent"${c.accent ? ' checked' : ''}><span>${GT.accent}</span></label>
      ${gdel('clip', j, i)}
    </div>`).join('')}
    <button class="gadd gsub" data-add="clip" data-l="${i}">+ ${GT.addClip}</button>
  </div>`).join('');

  const marks = p.markers.map((m, i) => `<div class="ger">
    ${gnum('mk', i, 'bar', m.bar, GT.bar)}${gtxt('mk', i, 'label', m.label, GT.label)}${gdel('mk', i)}
  </div>`).join('');

  const zones = p.zones.map((z, i) => `<div class="ger">
    ${gnum('zn', i, 'from', z.from, GT.from)}${gnum('zn', i, 'to', z.to, GT.to)}${gtxt('zn', i, 'label', z.label, GT.label)}${gdel('zn', i)}
  </div>`).join('');

  const energy = p.energy.map((e, i) => `<div class="ger">
    ${gnum('en', i, 'bar', e.bar, GT.bar)}
    <input class="gin grange" type="range" min="0" max="1" step="0.01" data-kind="en" data-i="${i}" data-f="v" value="${e.v}" aria-label="${GT.level}">
    <span class="gval">${Math.round(e.v * 100)}</span>${gdel('en', i)}
  </div>`).join('');

  return `<div class="ged">
    <div class="ger gtop">${gtxt('top', 0, 'title', p.title, GT.title)}</div>
    <div class="ger gtop3">
      <label>${GT.bpm}${gnum('top', 0, 'bpm', p.bpm, GT.bpm)}</label>
      <label>${GT.bars}${gnum('top', 0, 'bars', p.bars, GT.bars)}</label>
      <label>${GT.phrase}${gnum('top', 0, 'phrase', p.phrase, GT.phrase)}</label>
    </div>
    <p class="gdur">${planTime(planLen(p))} · ${GT.perBar(String(Math.round(planBarSec(p) * 100) / 100).replace('.', lang === 'fr' ? ',' : '.'))}</p>
    <textarea class="gin gta" data-kind="top" data-i="0" data-f="notes" placeholder="${GT.notes}">${esc(p.notes || '')}</textarea>

    <h4>${GT.sections}</h4>${secs || `<p class="ghint">${GT.empty}</p>`}
    <button class="gadd" data-add="sec">+ ${GT.addSec}</button>

    <h4>${GT.lanes}</h4>${lanes || `<p class="ghint">${GT.empty}</p>`}
    <button class="gadd" data-add="lane">+ ${GT.addLane}</button>

    <h4>${GT.marks}</h4>${marks}
    <button class="gadd" data-add="mk">+ ${GT.addMark}</button>

    <h4>${GT.zones}</h4>${zones}
    <button class="gadd" data-add="zn">+ ${GT.addZone}</button>

    <h4>${GT.energy}</h4>${energy}
    <button class="gadd" data-add="en">+ ${GT.addPt}</button>
  </div>`;
}

function renderGrille() {
  const p = gview.it.plan;
  const hist = gview.edit ? '' : p.history.map(h => `<h4>${esc(h.title || 'Version')}${h.bars ? ' — ' + h.bars + ' ' + GT.bars.toLowerCase() : ''}</h4>`
    + (h.note ? `<p class="ghint">${esc(h.note)}</p>` : '')
    + (h.sections || []).map(s => `<div class="ghl"><span>${s.from} → ${s.to}</span><span>${planTime(planBarTime(p, s.from))}</span><span>${esc(s.name)}</span></div>`).join('')).join('');

  $('grille').innerHTML = `
    <div class="ghead-bar">
      <button class="gclose" title="${tr('gClose')}"><svg class="ic" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <span class="gtitle">${esc(p.title)}</span>
      <span class="gsub">${p.bpm} BPM · ${p.bars} ${GT.bars.toLowerCase()} · ${planTime(planLen(p))}</span>
    </div>
    <div class="gbar2">
      ${gview.edit ? '' : `<span class="gseg">
        <button data-mode="grille" class="${gview.mode === 'grille' ? 'on' : ''}">${tr('gGrid')}</button>
        <button data-mode="liste" class="${gview.mode === 'liste' ? 'on' : ''}">${tr('gList')}</button>
      </span>`}
      ${!gview.edit && gview.mode === 'grille' ? [1, 2, 4].map(z => `<button class="gz${gview.zoom === z ? ' on' : ''}" data-zoom="${z}">×${z}</button>`).join('') : ''}
      ${gview.edit ? `<span class="gspacer"></span><button class="gz gimport">${GT.import}</button>`
                   : `<button class="gz gcopy">${tr('gCopy')}</button>`}
      <button class="gz gedit${gview.edit ? ' on' : ''}" data-edit="1">${gview.edit ? GT.done : GT.edit}</button>
    </div>
    <div class="gbody">
      ${gview.edit ? grilleEditor(p) : (gview.mode === 'grille' ? grilleTimeline(p) : '') + `<div class="glist">${grilleList(p)}</div>`
        + (p.notes ? `<p class="gnotes">${esc(p.notes)}</p>` : '')
        + (hist ? `<div class="ghist">${hist}</div>` : '')}
    </div>
    ${gview.edit ? '' : `<div class="gtrans">
      <button class="gplay">${gview.playing ? '❚❚' : '▶'}</button>
      <span class="ginfo"><b class="gnow"></b><i class="gnext"></i></span>
      <span class="gclock"></span>
    </div>`}`;
  $('grille').style.setProperty('--gzoom', gview.zoom);
  if (!gview.edit) paintGrille(true);
}

function paintGrille(full) {
  const p = gview.it.plan, secs = planSections(p);
  const bar = planBarAt(p, gview.elapsed);
  const cur = secs.findIndex(s => bar >= s.from && bar <= s.to);
  const nx = secs.find(s => s.from > bar);
  const g = $('grille');
  const head = g.querySelector('.ghead');
  if (head) {
    head.style.left = (clamp(gview.elapsed / planLen(p), 0, 1) * 100) + '%';
    head.classList.toggle('on', gview.elapsed > 0 || gview.playing);
  }
  const nextEl = g.querySelector('.gnext');
  if (nextEl) nextEl.textContent = nx
    ? `${nx.name} ${tr('gIn')} ${planTime(planBarTime(p, nx.from) - gview.elapsed)}`
    : tr('gLast');
  const clock = g.querySelector('.gclock');
  if (clock) clock.innerHTML = `${planTime(gview.elapsed)}<i>/ ${planTime(planLen(p))}</i><em>${tr('gBar')} ${bar}</em>`;
  if (!full) return;
  const nowEl = g.querySelector('.gnow');
  if (nowEl) nowEl.textContent = cur >= 0 ? secs[cur].name : '—';
  for (const el of g.querySelectorAll('[data-si]')) el.classList.toggle('now', +el.dataset.si === cur);
}

function grilleTick() {
  if (!gview.playing) return;
  const p = gview.it.plan;
  gview.elapsed = (performance.now() - gview.t0) / 1000;
  if (gview.elapsed >= planLen(p)) { gview.elapsed = planLen(p); stopGrille(); return; }
  const bar = planBarAt(p, gview.elapsed);
  const key = bar + '|' + Math.floor(gview.elapsed);
  if (key !== gview.key) { paintGrille(bar !== gview.bar); gview.bar = bar; gview.key = key; }
  else paintGrille(false);
  autoScrollGrille();
  gRaf = requestAnimationFrame(grilleTick);
}
function autoScrollGrille() {
  if (gview.zoom === 1) return;
  const sc = $('grille').querySelector('.gscroll');
  if (!sc) return;
  const inner = sc.firstElementChild;
  const x = inner.clientWidth * (gview.elapsed / planLen(gview.it.plan));
  const target = x - sc.clientWidth / 2;
  if (Math.abs(sc.scrollLeft - target) > 8) sc.scrollLeft = target;
}
async function playGrille() {
  gview.playing = true;
  gview.t0 = performance.now() - gview.elapsed * 1000;
  gview.bar = -1; gview.key = '';
  const b = $('grille').querySelector('.gplay');
  if (b) { b.textContent = '❚❚'; b.classList.add('on'); }
  await acquireWakeLock();
  gRaf = requestAnimationFrame(grilleTick);
}
function stopGrille() {
  gview.playing = false;
  if (gRaf) cancelAnimationFrame(gRaf);
  gRaf = null;
  const b = $('grille').querySelector('.gplay');
  if (b) { b.textContent = '▶'; b.classList.remove('on'); }
  if (!locked) releaseWakeLock();
  if (!gview.edit) paintGrille(true);
}
function seekGrille(sec) {
  const p = gview.it.plan;
  gview.elapsed = clamp(sec, 0, planLen(p));
  if (gview.playing) gview.t0 = performance.now() - gview.elapsed * 1000;
  gview.bar = -1; gview.key = '';
  paintGrille(true);
}
function openGrille(it) {
  gview.it = it;
  gview.elapsed = 0; gview.zoom = 1; gview.edit = false;
  gview.mode = innerWidth >= 760 ? 'grille' : 'liste';
  renderGrille();
  $('grille').classList.remove('hidden');
}
function closeGrille() {
  stopGrille();
  $('grille').classList.add('hidden');
  gview.it = null;
}

/* la cible d'un champ de saisie */
function grilleTarget(p, el) {
  const k = el.dataset.kind, i = +el.dataset.i;
  if (k === 'sec') return p.sections[i];
  if (k === 'lane') return p.lanes[i];
  if (k === 'clip') return (p.lanes[+el.dataset.l] || { clips: [] }).clips[i];
  if (k === 'mk') return p.markers[i];
  if (k === 'zn') return p.zones[i];
  if (k === 'en') return p.energy[i];
  if (k === 'top') return p;
  return null;
}
const GNUM = { bar: 1, bars: 1, bpm: 1, phrase: 1, from: 1, to: 1 };

function grilleEdited(structural) {
  const it = gview.it;
  updateGrilleDOM(it);
  scheduleSave();
  if (structural) renderGrille();
  else {
    const g = $('grille'), p = it.plan;
    const sub = g.querySelector('.gsub'), ttl = g.querySelector('.gtitle'), dur = g.querySelector('.gdur');
    if (ttl) ttl.textContent = p.title;
    if (sub) sub.textContent = `${p.bpm} BPM · ${p.bars} ${GT.bars.toLowerCase()} · ${planTime(planLen(p))}`;
    if (dur) dur.textContent = `${planTime(planLen(p))} · ${GT.perBar(String(Math.round(planBarSec(p) * 100) / 100).replace('.', lang === 'fr' ? ',' : '.'))}`;
  }
}

$('grille').addEventListener('input', e => {
  const el = e.target;
  if (!gview.it || !el.dataset.kind) return;
  const p = gview.it.plan;
  const o = grilleTarget(p, el);
  if (!o) return;
  const f = el.dataset.f;
  if (f === 'accent') o.accent = el.checked;
  else if (f === 'v') {
    o.v = clamp(parseFloat(el.value) || 0, 0, 1);
    const out = el.parentElement.querySelector('.gval');
    if (out) out.textContent = Math.round(o.v * 100);
  } else if (f === 'fade') { if (el.value) o.fade = el.value; else delete o.fade; }
  else if (GNUM[f]) {
    const n = parseInt(el.value, 10);
    if (!isFinite(n)) return;
    o[f] = Math.max(1, n);
  } else o[f] = el.value;
  grilleEdited(false);
});

/* au relâchement d'un champ : on borne et on renumérote proprement */
$('grille').addEventListener('change', e => {
  if (!gview.it || !e.target.dataset.kind) return;
  if (e.target.dataset.f === 'accent' || e.target.dataset.f === 'v') return;
  gview.it.plan = normPlan(gview.it.plan);
  grilleEdited(true);
});

$('grille').addEventListener('click', e => {
  if (!gview.it) return;
  const p = gview.it.plan;
  if (e.target.closest('.gclose')) { closeGrille(); return; }
  if (e.target.closest('.gplay')) { gview.playing ? stopGrille() : playGrille(); return; }
  if (e.target.closest('.gimport')) { $('file-plan').click(); return; }
  if (e.target.closest('.gcopy')) {
    navigator.clipboard.writeText(planText(p)).then(() => toast(tr('gCopied'))).catch(() => {});
    return;
  }
  if (e.target.closest('[data-edit]')) {
    gview.edit = !gview.edit;
    if (gview.edit) stopGrille();
    else gview.it.plan = normPlan(p);
    renderGrille();
    scheduleSave();
    return;
  }
  const add = e.target.closest('[data-add]');
  if (add) {
    const k = add.dataset.add;
    const last = p.sections.reduce((m, s) => Math.max(m, s.bar), 0);
    if (k === 'sec') p.sections.push({ bar: clamp(last + p.phrase, 1, p.bars), name: '' });
    if (k === 'lane') p.lanes.push({ name: '', clips: [] });
    if (k === 'clip') p.lanes[+add.dataset.l].clips.push({ from: 1, to: Math.min(p.phrase, p.bars) });
    if (k === 'mk') p.markers.push({ bar: 1, label: '' });
    if (k === 'zn') p.zones.push({ from: 1, to: p.bars, label: '' });
    if (k === 'en') p.energy.push({ bar: 1, v: .5 });
    grilleEdited(true);
    return;
  }
  const del = e.target.closest('[data-del]');
  if (del) {
    const k = del.dataset.del, i = +del.dataset.i;
    if (k === 'sec') p.sections.splice(i, 1);
    if (k === 'lane') p.lanes.splice(i, 1);
    if (k === 'clip') p.lanes[+del.dataset.l].clips.splice(i, 1);
    if (k === 'mk') p.markers.splice(i, 1);
    if (k === 'zn') p.zones.splice(i, 1);
    if (k === 'en') p.energy.splice(i, 1);
    grilleEdited(true);
    return;
  }
  if (gview.edit) return;
  const mode = e.target.closest('[data-mode]');
  if (mode) { gview.mode = mode.dataset.mode; renderGrille(); return; }
  const z = e.target.closest('[data-zoom]');
  if (z) { gview.zoom = +z.dataset.zoom; renderGrille(); return; }
  const si = e.target.closest('[data-si]');
  if (si) { seekGrille(planBarTime(p, planSections(p)[+si.dataset.si].from)); return; }
  const tap = e.target.closest('.gtap');
  if (tap) {
    const r = tap.getBoundingClientRect();
    seekGrille(((e.clientX - r.left) / r.width) * planLen(p));
  }
});

$('file-plan').addEventListener('change', e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  f.text().then(txt => {
    let data = null;
    try { data = JSON.parse(txt); } catch (_) {}
    if (!isPlan(data)) { toast(tr('gBadPlan')); return; }
    if (gview.it && !$('grille').classList.contains('hidden')) {
      gview.it.plan = normPlan(data);      /* on remplace la grille ouverte */
      updateGrilleDOM(gview.it);
      renderGrille();
      scheduleSave();
      return;
    }
    const it = addGrilleItem(data);
    select(it);
    scheduleSave();
    openGrille(it);
  });
});

/* ============================== pomodoro ==============================
   Un minuteur posé sur le board. L'anneau montre le temps qui reste ;
   la pastille en tête recule le long du cercle. On tape le cadran pour
   lancer ou suspendre, les pastilles du bas changent la durée. */

const PT = lang === 'fr'
  ? { focus: 'focus', pause: 'suspendu', over: 'terminé', ready: 'prêt', add: '+5' }
  : { focus: 'focus', pause: 'paused', over: 'done', ready: 'ready', add: '+5' };

const POMO_DURS = [5, 15, 25, 50];
const PR = 44;                      /* rayon de l'anneau */
const PC = 2 * Math.PI * PR;        /* sa circonférence */

function normPomo(raw) {
  const p = raw && typeof raw === 'object' ? { ...raw } : {};
  p.dur = clamp(Math.round(+p.dur) || 25 * 60, 10, 24 * 3600);
  p.left = clamp(Math.round(+p.left) || p.dur, 0, p.dur);
  p.done = clamp(Math.round(+p.done) || 0, 0, 99);
  p.endAt = +p.endAt || 0;
  p.running = !!p.running;
  if (p.running) {                  /* on reprend là où l'horloge en est vraiment */
    const left = Math.round((p.endAt - Date.now()) / 1000);
    if (left > 0) p.left = Math.min(left, p.dur);
    else { p.running = false; p.left = 0; }
  }
  return p;
}
function pomoTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
const pomoLeft = p => p.running ? Math.max(0, (p.endAt - Date.now()) / 1000) : p.left;

function addPomoItem(at) {
  const pos = at || toWorld(innerWidth / 2, innerHeight / 2);
  const w = 210 / view.s;
  const it = { id: uid(), type: 'pomo', x: pos.x - w / 2, y: pos.y - w / 2, w, rot: 0, size: w / 14, pomo: normPomo({}) };
  addItem(it);
  return it;
}

function pomoMarkup() {
  return `<span class="pdial" data-p="toggle">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ptrack" cx="50" cy="50" r="${PR}"></circle>
        <circle class="parc" cx="50" cy="50" r="${PR}" transform="rotate(-90 50 50)"
          stroke-dasharray="${PC.toFixed(2)}" stroke-dashoffset="0"></circle>
        <circle class="phead" cx="50" cy="6" r="3.6"></circle>
      </svg>
      <span class="ptime">0:00</span>
      <span class="plab">${PT.ready}</span>
    </span>
    <span class="pchips">${POMO_DURS.map(m => `<b data-p="${m}">${m}</b>`).join('')}<b data-p="add">${PT.add}</b></span>
    <span class="pdots" data-p="dots"></span>`;
}

/* redessine une carte ; frame=true pendant l'animation (on évite alors le superflu) */
function updatePomoDOM(it, frame) {
  const el = it.el; if (!el) return;
  const p = it.pomo;
  const left = pomoLeft(p);
  const frac = clamp(p.dur ? left / p.dur : 0, 0, 1);

  const arc = el.querySelector('.parc');
  if (arc) arc.setAttribute('stroke-dashoffset', (PC * (1 - frac)).toFixed(2));
  const head = el.querySelector('.phead');
  if (head) {
    const a = 2 * Math.PI * frac;
    head.setAttribute('cx', (50 + PR * Math.sin(a)).toFixed(2));
    head.setAttribute('cy', (50 - PR * Math.cos(a)).toFixed(2));
    head.style.opacity = p.running || p.left < p.dur ? 1 : 0;
  }
  const t = el.querySelector('.ptime');
  if (t) {
    const txt = pomoTime(left);
    if (t.textContent !== txt) t.textContent = txt;
  }
  el.classList.toggle('running', p.running);
  el.classList.toggle('over', !p.running && left <= 0);
  el.classList.toggle('last', p.running && left <= 10);
  if (frame) return;

  const lab = el.querySelector('.plab');
  if (lab) lab.textContent = p.running ? PT.focus : (left <= 0 ? PT.over : (p.left < p.dur ? PT.pause : PT.ready));
  for (const c of el.querySelectorAll('.pchips b')) {
    const v = c.dataset.p;
    c.classList.toggle('on', v !== 'add' && +v * 60 === p.dur);
  }
  const dots = el.querySelector('.pdots');
  if (dots) dots.innerHTML = p.done ? Array.from({ length: Math.min(p.done, 8) }, () => '<i></i>').join('')
    + (p.done > 8 ? `<em>${p.done}</em>` : '') : '';
}

/* ---------- la boucle ---------- */
let pomoRaf = null;
function pomoLoop() {
  let any = false;
  for (const it of items) {
    if (it.type !== 'pomo') continue;
    if (it.pomo.running) {
      any = true;
      if (pomoLeft(it.pomo) <= 0) pomoFinish(it);
      else updatePomoDOM(it, true);
    }
  }
  pomoRaf = any ? requestAnimationFrame(pomoLoop) : null;
}
function pomoSync() {
  const any = items.some(i => i.type === 'pomo' && i.pomo.running);
  if (any && !pomoRaf) pomoRaf = requestAnimationFrame(pomoLoop);
  if (any) acquireWakeLock();
  else if (!locked && !(typeof gview !== 'undefined' && gview.playing)) releaseWakeLock();
}
function pomoFinish(it) {
  const p = it.pomo;
  p.running = false; p.left = 0; p.endAt = 0; p.done++;
  updatePomoDOM(it);
  pomoChime();
  pomoSync();
  scheduleSave();
}

/* trois notes douces, fabriquées à la volée : aucun fichier son à charger */
let pomoAC = null;
function pomoChime() {
  try {
    pomoAC = pomoAC || new (window.AudioContext || window.webkitAudioContext)();
    const t0 = pomoAC.currentTime;
    [880, 1174.7, 1318.5].forEach((f, i) => {
      const o = pomoAC.createOscillator(), g = pomoAC.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t = t0 + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g); g.connect(pomoAC.destination);
      o.start(t); o.stop(t + 1);
    });
  } catch (_) {}
}

function pomoAction(it, act) {
  const p = it.pomo;
  if (act === 'toggle') {
    if (p.running) {                       /* suspendre */
      p.left = Math.max(0, Math.round(pomoLeft(p)));
      p.running = false; p.endAt = 0;
    } else {                               /* lancer, ou relancer si terminé */
      if (p.left <= 0) p.left = p.dur;
      p.running = true;
      p.endAt = Date.now() + p.left * 1000;
      try { pomoAC = pomoAC || new (window.AudioContext || window.webkitAudioContext)(); pomoAC.resume(); } catch (_) {}
    }
  } else if (act === 'dots') {
    p.done = 0;
  } else if (act === 'add') {
    p.dur = clamp(p.dur + 300, 10, 24 * 3600);
    if (p.running) { p.endAt += 300000; } else p.left = Math.min(p.left + 300, p.dur);
  } else {
    const m = +act;
    if (!isFinite(m)) return;
    p.dur = m * 60; p.left = p.dur; p.running = false; p.endAt = 0;
  }
  updatePomoDOM(it);
  pomoSync();
  scheduleSave();
}

/* une carte terminée pendant que l'onglet dormait : on remet les pendules à l'heure */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  for (const it of items) {
    if (it.type === 'pomo' && it.pomo.running && pomoLeft(it.pomo) <= 0) pomoFinish(it);
    else if (it.type === 'pomo') updatePomoDOM(it);
  }
  pomoSync();
});

/* ============================== formes et flèches ==============================
   Des boîtes avec du texte dedans, reliées par des flèches qui se recalculent
   quand on déplace une boîte. Les réglages n'apparaissent que sur sélection. */

const ST = lang === 'fr'
  ? { link: 'Relier', pickTarget: 'Tape la boîte d\u2019arrivée', linked: 'Reliée', cancel: 'Liaison annulée',
      solid: 'Plein', shape: 'Forme' }
  : { link: 'Link', pickTarget: 'Tap the target box', linked: 'Linked', cancel: 'Link cancelled',
      solid: 'Solid', shape: 'Shape' };

const SHAPE_FORMS = ['rect', 'pill', 'ellipse', 'diamond'];
/* une palette courte et tenue : huit encres, pas un nuancier */
/* chaque teinte a deux valeurs : un pastel pour le fond, une encre pour
   le trait et le texte. Le contraste reste lisible dans les deux modes. */
const SHAPE_COLORS = {
  graphite: { t: '#DEDCD5', i: '#4A4945' },
  bleu:     { t: '#CBD9E6', i: '#42607E' },
  sauge:    { t: '#CFDCCE', i: '#4C6552' },
  paille:   { t: '#EDE4C6', i: '#7C6935' },
  abricot:  { t: '#F0D8C6', i: '#8C5E43' },
  rose:     { t: '#F0D5D7', i: '#8B515A' },
  lilas:    { t: '#DBD5E6', i: '#5F557A' },
  sable:    { t: '#E7E1D4', i: '#706755' },
};
const SHAPE_KEYS = Object.keys(SHAPE_COLORS);

function normShape(raw) {
  const s = {};
  s.form = SHAPE_FORMS.includes(raw && raw.form) ? raw.form : 'rect';
  s.color = SHAPE_KEYS.includes(raw && raw.color) ? raw.color : 'graphite';
  s.fill = !!(raw && raw.fill);
  s.text = String((raw && raw.text) || '');
  return s;
}
function addShapeItem(at, opts) {
  const pos = at || toWorld(innerWidth / 2, innerHeight / 2);
  const w = 200 / view.s;
  const s = normShape(opts || {});
  const it = {
    id: uid(), type: 'shape', x: pos.x - w / 2, y: pos.y - w / 5, w, rot: 0, size: w / 12,
    form: s.form, color: s.color, fill: s.fill, text: s.text,
  };
  addItem(it);
  return it;
}
function updateShapeDOM(it, el) {
  const root = el || it.el; if (!root) return;
  root.dataset.form = it.form;
  root.dataset.c = it.color;
  root.classList.toggle('filled', !!it.fill);
  const tx = root.firstChild;
  if (tx && tx.textContent !== it.text) tx.textContent = it.text;
}

/* ---------- les flèches ---------- */
let arrows = [];          /* { id, from, to, color } — hors de items : rien à ranger, rien à déplacer */
let linkFrom = null;
let arrowRaf = null;
let selectedArrow = null;

function arrowLayer() {
  let svg = document.getElementById('arrows');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'arrows';
    svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    svg.style.overflow = 'visible';
    const stage = $('stage');
    stage.insertBefore(svg, stage.firstChild);
  }
  return svg;
}
function addArrow(from, to) {
  if (!from || !to || from === to) return null;
  if (arrows.some(a => a.from === from.id && a.to === to.id)) return null;
  const a = { id: uid(), from: from.id, to: to.id, color: from.type === 'shape' ? from.color : 'graphite' };
  arrows.push(a);
  drawArrows();
  scheduleSave();
  return a;
}
function removeArrowsOf(id) {
  const n = arrows.length;
  arrows = arrows.filter(a => a.from !== id && a.to !== id);
  if (arrows.length !== n) { drawArrows(); scheduleSave(); }
}
function queueArrows() {
  if (arrowRaf || !arrows.length) return;
  arrowRaf = requestAnimationFrame(() => { arrowRaf = null; drawArrows(); });
}

/* point où le segment centre→centre sort de la boîte */
function edgePoint(bb, tx, ty) {
  const cx = (bb.x1 + bb.x2) / 2, cy = (bb.y1 + bb.y2) / 2;
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const hw = (bb.x2 - bb.x1) / 2, hh = (bb.y2 - bb.y1) / 2;
  const sx = dx ? hw / Math.abs(dx) : Infinity;
  const sy = dy ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}
function drawArrows() {
  const svg = arrowLayer();
  const byId = new Map(items.map(i => [i.id, i]));
  arrows = arrows.filter(a => byId.has(a.from) && byId.has(a.to));
  let out = '';
  for (const a of arrows) {
    const A = itemBBox(byId.get(a.from)), B = itemBBox(byId.get(a.to));
    const ac = { x: (A.x1 + A.x2) / 2, y: (A.y1 + A.y2) / 2 };
    const bc = { x: (B.x1 + B.x2) / 2, y: (B.y1 + B.y2) / 2 };
    const p1 = edgePoint(A, bc.x, bc.y);
    const p2 = edgePoint(B, ac.x, ac.y);
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len < 6) continue;
    const h = clamp(len * 0.14, 9, 18);          /* pointe proportionnée, jamais énorme */
    const bx = p2.x - Math.cos(ang) * h, by = p2.y - Math.sin(ang) * h;
    const nx = -Math.sin(ang) * h * 0.42, ny = Math.cos(ang) * h * 0.42;
    const col = (SHAPE_COLORS[a.color] || SHAPE_COLORS.graphite).i;
    const sel = a.id === selectedArrow ? ' sel' : '';
    out += `<g class="arw${sel}" data-a="${a.id}" style="--ac:${col}">
      <line class="ahit" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"></line>
      <line class="aline" x1="${p1.x}" y1="${p1.y}" x2="${bx}" y2="${by}"></line>
      <path class="ahead" d="M${p2.x} ${p2.y} L${bx + nx} ${by + ny} L${bx - nx} ${by - ny} Z"></path>
    </g>`;
    if (sel) {
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      out += `<g class="axk" data-ax="${a.id}"><circle cx="${mx}" cy="${my}" r="11"></circle>
        <path d="M${mx - 4} ${my - 4} L${mx + 4} ${my + 4} M${mx + 4} ${my - 4} L${mx - 4} ${my + 4}"></path></g>`;
    }
  }
  svg.innerHTML = out;
}

/* ---------- la barre de réglages, visible seulement sur sélection ---------- */
function shapeBarMarkup() {
  const forms = SHAPE_FORMS.map(f => `<button data-sf="${f}" title="${ST.shape}"><i class="sfi sf-${f}"></i></button>`).join('');
  const cols = SHAPE_KEYS.map(k => `<button data-sc="${k}" title="${k}"><i class="sci" style="background:${SHAPE_COLORS[k].t};border-color:${SHAPE_COLORS[k].i}"></i></button>`).join('');
  return `<span class="sgrp">${forms}</span><span class="sgrp">${cols}</span>
    <span class="sgrp"><button data-sfill="1" class="stog">${ST.solid}</button>
    <button data-slink="1" class="stog">${ST.link} →</button></span>`;
}
function syncShapeBar(it) {
  const bar = $('shapebar');
  if (!it || it.type !== 'shape' || locked) { bar.classList.remove('open'); return; }
  if (!bar.dataset.built) { bar.innerHTML = shapeBarMarkup(); bar.dataset.built = '1'; }
  for (const b of bar.querySelectorAll('[data-sf]')) b.classList.toggle('on', b.dataset.sf === it.form);
  for (const b of bar.querySelectorAll('[data-sc]')) b.classList.toggle('on', b.dataset.sc === it.color);
  bar.querySelector('[data-sfill]').classList.toggle('on', !!it.fill);
  bar.querySelector('[data-slink]').classList.toggle('on', linkFrom === it);
  closePopovers('shapebar');
  bar.classList.add('open');
}
$('shapebar').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const it = selected;
  if (!it || it.type !== 'shape') return;
  if (b.dataset.sf) it.form = b.dataset.sf;
  else if (b.dataset.sc) {
    it.color = b.dataset.sc;
    for (const a of arrows) if (a.from === it.id) a.color = it.color;
    drawArrows();
  } else if (b.dataset.sfill) it.fill = !it.fill;
  else if (b.dataset.slink) {
    linkFrom = linkFrom === it ? null : it;
    toast(linkFrom ? ST.pickTarget : ST.cancel);
  }
  updateShapeDOM(it);
  syncShapeBar(it);
  scheduleSave();
});

/* clic sur une flèche : elle se met en avant et propose sa croix */
$('vp').addEventListener('click', e => {
  const kill = e.target.closest('[data-ax]');
  if (kill) {
    arrows = arrows.filter(a => a.id !== kill.dataset.ax);
    selectedArrow = null; drawArrows(); scheduleSave();
    return;
  }
  const g = e.target.closest('[data-a]');
  const next = g ? g.dataset.a : null;
  if (next !== selectedArrow) { selectedArrow = next; drawArrows(); }
});


/* ============================== Dropbox ==============================
   Synchro transparente : une fois connecté, l'utilisateur n'a plus rien à faire.
   La structure d'un board (quelques Ko) part à chaque changement ; les images
   partent une seule fois, nommées par l'empreinte de leur contenu. */

const DBX_KEY = 'vrteolr7ryzkul7';
const DBX_LS = 'refy.dbx';
const DBX_META = 'refy.dbx.meta';
const DBX_DELAY = 6000;            /* on laisse retomber la poussière avant d'envoyer */

const DT = lang === 'fr' ? {
  connect: 'Connecter Dropbox', off: 'Déconnecter', now: 'Synchroniser maintenant',
  on: 'Synchro active', syncing: 'Synchro…', ok: 'À jour', fail: 'Synchro en échec',
  offline: 'Hors ligne — reprise au retour du réseau', bye: 'Dropbox déconnecté',
  conflict: 'Deux versions : la plus récente est gardée, l\u2019autre est copiée dans Dropbox',
} : {
  connect: 'Connect Dropbox', off: 'Disconnect', now: 'Sync now',
  on: 'Sync on', syncing: 'Syncing…', ok: 'Up to date', fail: 'Sync failed',
  offline: 'Offline — will resume', bye: 'Dropbox disconnected',
  conflict: 'Two versions: newest kept, the other copied to Dropbox',
};

const dbxRedirect = () => location.origin + location.pathname.replace(/index\.html$/, '');
function dbxLoad() { try { return JSON.parse(localStorage.getItem(DBX_LS) || 'null'); } catch (_) { return null; } }
function dbxSave(t) { try { localStorage.setItem(DBX_LS, JSON.stringify(t)); } catch (_) {} }
function dbxForget() { try { localStorage.removeItem(DBX_LS); localStorage.removeItem(DBX_META); } catch (_) {} }
const dbxOn = () => !!(dbxLoad() || {}).refresh;
function dbxMeta() { try { return JSON.parse(localStorage.getItem(DBX_META) || '{}'); } catch (_) { return {}; } }
function dbxSetMeta(m) { try { localStorage.setItem(DBX_META, JSON.stringify(m)); } catch (_) {} }

function dbxRand(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map(x => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[x % 66]).join('');
}
const dbxB64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function dbxConnect() {
  const verifier = dbxRand(64);
  try { sessionStorage.setItem('refy.dbxv', verifier); } catch (_) {}
  const challenge = dbxB64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const u = new URL('https://www.dropbox.com/oauth2/authorize');
  u.searchParams.set('client_id', DBX_KEY);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('redirect_uri', dbxRedirect());
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 'S256');
  u.searchParams.set('token_access_type', 'offline');
  location.href = u.toString();
}
async function dbxToken(body) {
  const r = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: DBX_KEY, ...body }).toString(),
  });
  if (!r.ok) throw new Error('token');
  const j = await r.json();
  const cur = dbxLoad() || {};
  dbxSave({ access: j.access_token, refresh: j.refresh_token || cur.refresh,
            exp: Date.now() + (j.expires_in || 14000) * 1000 - 60000 });
}
async function dbxReturn() {
  const code = new URLSearchParams(location.search).get('code');
  if (!code) return false;
  let verifier = '';
  try { verifier = sessionStorage.getItem('refy.dbxv') || ''; } catch (_) {}
  history.replaceState(null, '', dbxRedirect());
  if (!verifier) return false;
  try {
    await dbxToken({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: dbxRedirect() });
    try { sessionStorage.removeItem('refy.dbxv'); } catch (_) {}
    return true;
  } catch (_) { return false; }
}
async function dbxAuth() {
  const t = dbxLoad();
  if (!t) throw new Error('off');
  if (t.access && Date.now() < t.exp) return t.access;
  await dbxToken({ grant_type: 'refresh_token', refresh_token: t.refresh });
  return dbxLoad().access;
}
async function dbxRpc(path, arg) {
  const r = await fetch('https://api.dropboxapi.com/2/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await dbxAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}
async function dbxUp(path, blob, mode) {
  const r = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + await dbxAuth(),
      'Dropbox-API-Arg': JSON.stringify({ path, mode: mode || 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });
  if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
  return r.json();
}
async function dbxDown(path) {
  const r = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await dbxAuth(), 'Dropbox-API-Arg': JSON.stringify({ path }) },
  });
  if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
  return r.blob();
}
async function dbxDownJson(path) { try { return JSON.parse(await (await dbxDown(path)).text()); } catch (_) { return null; } }

/* empreinte du contenu : une image identique n'est jamais renvoyée deux fois */
async function dbxHash(blob) {
  const buf = await blob.arrayBuffer();
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- structure d'un board, sans les images ---------- */
async function boardStruct() {
  const b = boardMeta(library.current);
  const events = calendar.events.filter(e => e.boardId === library.current)
    .map(e => ({ date: e.date, time: e.time, title: e.title }));
  const out = [];
  for (const it of items) {
    const entry = serializeItem(it);
    if (it.type === 'img') {
      if (!it.hash && it.blob) it.hash = await dbxHash(it.blob);
      entry.hash = it.hash;
      delete entry.data;
    }
    out.push(entry);
  }
  return {
    app: 'refy', v: 5, id: library.current, name: (b && b.name) || 'Board',
    updated: (b && b.updated) || Date.now(),
    view: { x: view.x, y: view.y, s: view.s }, bg,
    arrows: arrows.map(a => ({ from: a.from, to: a.to, color: a.color })),
    events, items: out,
  };
}

/* ---------- envoi ---------- */
let dbxBusy = false, dbxTimer = null, dbxDirty = new Set();

async function dbxPushCurrent() {
  const id = library.current;
  const st = await boardStruct();
  const meta = dbxMeta();
  const known = meta[id] || {};

  /* les images d'abord : une seule fois chacune */
  const sent = new Set(known.imgs || []);
  for (const it of items) {
    if (it.type !== 'img' || !it.hash || sent.has(it.hash)) continue;
    try {
      await dbxUp('/img/' + it.hash, it.blob);
      sent.add(it.hash);
    } catch (_) { /* on réessaiera au prochain tour */ }
  }

  const blob = new Blob([JSON.stringify(st)], { type: 'application/json' });
  let res;
  try {
    res = await dbxUp('/boards/' + id + '.json', blob,
      known.rev ? { '.tag': 'update', update: known.rev } : 'add');
  } catch (e) {
    /* quelqu'un d'autre a écrit entre-temps : on garde le plus récent, on copie l'autre */
    const remote = await dbxDownJson('/boards/' + id + '.json');
    if (remote && remote.updated > st.updated) { await dbxPullBoard(id, remote); return; }
    if (remote) {
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      await dbxUp('/conflits/' + id + '-' + stamp + '.json',
        new Blob([JSON.stringify(remote)], { type: 'application/json' }));
      toast(DT.conflict, 4000);
    }
    res = await dbxUp('/boards/' + id + '.json', blob);
  }
  meta[id] = { rev: res.rev, imgs: [...sent], pushed: st.updated };
  dbxSetMeta(meta);
  await dbxPushLibrary();
}
async function dbxPushLibrary() {
  const list = library.boards.map(b => ({ id: b.id, name: b.name, updated: b.updated || 0 }));
  await dbxUp('/library.json', new Blob([JSON.stringify({ v: 1, boards: list })], { type: 'application/json' }));
}

/* ---------- réception ---------- */
async function dbxPullBoard(id, data) {
  const st = data || await dbxDownJson('/boards/' + id + '.json');
  if (!st || !Array.isArray(st.items)) return;
  const target = boardMeta(id);
  if (!target) createBoard(st.name || 'Board', id);
  if (library.current !== id) await switchBoard(id);

  for (const raw of st.items) {          /* les images manquantes, et elles seules */
    if (raw.type !== 'img' || !raw.hash) continue;
    try {
      if (await dbGetImage(raw.id)) continue;
    } catch (_) {}
    try { await dbPutImage(raw.id, await dbxDown('/img/' + raw.hash)); } catch (_) {}
  }
  clearBoardDOM();
  await loadBoardState({ v: 4, items: st.items, arrows: st.arrows, view: st.view, bg: st.bg });
  const b = boardMeta(id);
  if (b) { b.name = st.name || b.name; b.updated = st.updated || Date.now(); }
  const meta = dbxMeta();
  meta[id] = { ...(meta[id] || {}), pushed: st.updated };
  dbxSetMeta(meta);
  flushSave();
}

/* ---------- le chef d'orchestre ---------- */
function dbxStatus(k) {
  const dot = $('dbx-dot');
  if (!dot) return;
  dot.className = 'dbx-dot ' + (k || '');
  dot.title = k === 'sync' ? DT.syncing : k === 'bad' ? DT.fail : DT.ok;
}
async function dbxSync(full) {
  if (!dbxOn() || dbxBusy || !library) return;
  if (!navigator.onLine) { dbxStatus('bad'); return; }
  dbxBusy = true; dbxStatus('sync');
  try {
    if (full) {
      const lib = await dbxDownJson('/library.json');
      if (lib && Array.isArray(lib.boards)) {
        for (const rb of lib.boards) {
          const local = boardMeta(rb.id);
          if (!local || (rb.updated || 0) > (local.updated || 0)) await dbxPullBoard(rb.id);
        }
      }
    }
    if (dbxDirty.size || full) { await dbxPushCurrent(); dbxDirty.clear(); }
    dbxStatus('');
  } catch (e) {
    dbxStatus('bad');
  } finally { dbxBusy = false; }
}
/* appelé après chaque enregistrement local */
function dbxTouch() {
  if (!dbxOn() || !library) return;
  dbxDirty.add(library.current);
  clearTimeout(dbxTimer);
  dbxTimer = setTimeout(() => dbxSync(false), DBX_DELAY);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) dbxSync(true); });
window.addEventListener('online', () => dbxSync(true));

/* ---------- le panneau : trois lignes, pas plus ---------- */
function dbxPanel() {
  const bar = $('dbx');
  bar.innerHTML = dbxOn()
    ? `<span class="dhint">${DT.on}</span>
       <button class="dbtn" data-db="now">${DT.now}</button>
       <button class="dbtn quiet" data-db="off">${DT.off}</button>`
    : `<button class="dbtn primary" data-db="on">${DT.connect}</button>`;
  closePopovers('dbx');
  bar.classList.add('open');
}
$('dbx').addEventListener('click', e => {
  const b = e.target.closest('[data-db]'); if (!b) return;
  const a = b.dataset.db;
  if (a === 'on') dbxConnect();
  else if (a === 'off') { dbxForget(); dbxPanel(); dbxStatus(''); toast(DT.bye); }
  else if (a === 'now') { closePopovers(); dbxSync(true); }
});

(async () => {
  const fresh = await dbxReturn();
  if (dbxOn()) setTimeout(() => dbxSync(true), fresh ? 400 : 1500);
})();


/* ============================== album ==============================
   Rassemble les grilles de morceau de tous les boards et sert à monter
   des suites qui tiennent ensemble. Tout tient sur la carte : pas de
   plein écran, les commandes n'apparaissent que sur sélection. */

const AL_STATES = ['idee', 'build', 'done'];
const AT = lang === 'fr' ? {
  untitled: 'Nouvel album', tracks: 'titres', track: 'titre', empty: 'Aucun morceau',
  add: '+ ajouter un morceau', none: 'Aucune grille dans tes boards', search: 'Chercher…',
  copied: 'Tracklist copiée', gone: 'grille supprimée',
  idee: 'idée, boucle', build: 'construction — 95 %', done: 'mix et master faits',
} : {
  untitled: 'New album', tracks: 'tracks', track: 'track', empty: 'No tracks',
  add: '+ add a track', none: 'No song plan in your boards', search: 'Search…',
  copied: 'Tracklist copied', gone: 'plan deleted',
  idee: 'idea, loop', build: 'building — 95%', done: 'mixed and mastered',
};

const trackLen = t => t.bars * (60 / t.bpm) * (t.meter || 4);
const albumPeak = e => (e && e.length) ? Math.max(...e.map(p => +p.v || 0)) : .5;

function normAlbum(raw) {
  return {
    name: String((raw && raw.name) || AT.untitled).slice(0, 60),
    tracks: ((raw && raw.tracks) || []).filter(t => t && t.title).map(t => ({
      board: String(t.board || ''), ref: String(t.ref || ''),
      title: String(t.title), bpm: +t.bpm || 120, bars: +t.bars || 0, meter: +t.meter || 4,
      state: clamp(Math.round(+t.state) || 0, 0, 2), peak: +t.peak || .5,
    })),
  };
}
function addAlbumItem(at) {
  const pos = at || toWorld(innerWidth / 2, innerHeight / 2);
  const w = 300 / view.s;
  const it = { id: uid(), type: 'album', x: pos.x - w / 2, y: pos.y - w / 6, w, rot: 0, size: w / 19,
               name: AT.untitled, tracks: [] };
  addItem(it);
  return it;
}

/* ---------- le catalogue : toutes les grilles, board par board ---------- */
async function albumCatalogue() {
  const out = [];
  for (const b of (library ? library.boards : [])) {
    let list = [];
    if (b.id === library.current) {
      list = items.filter(i => i.type === 'grille').map(i => ({ id: i.id, plan: i.plan }));
    } else {
      let st = null;
      try { st = await dbGetMeta('state-' + b.id); } catch (_) {}
      list = ((st && st.items) || []).filter(r => r.type === 'grille' && r.plan).map(r => ({ id: r.id, plan: r.plan }));
    }
    if (!list.length) continue;
    out.push({
      board: b.name, boardId: b.id,
      songs: list.map(x => ({
        board: b.id, ref: x.id, title: x.plan.title,
        bpm: +x.plan.bpm || 120, bars: +x.plan.bars || 0,
        meter: (x.plan.meter && x.plan.meter[0]) || 4, energy: x.plan.energy || [],
      })),
    });
  }
  return out;
}
/* les infos suivent les grilles réelles : un tempo modifié se répercute */
async function albumRefresh(it) {
  const cat = await albumCatalogue();
  const map = new Map();
  for (const g of cat) for (const s of g.songs) map.set(s.board + '|' + s.ref, s);
  let changed = false;
  for (const t of it.tracks) {
    const s = map.get(t.board + '|' + t.ref);
    if (s) {
      if (t.title !== s.title || t.bpm !== s.bpm || t.bars !== s.bars) changed = true;
      t.title = s.title; t.bpm = s.bpm; t.bars = s.bars; t.meter = s.meter; t.peak = albumPeak(s.energy);
    } else if (t.bars) { t.bars = 0; changed = true; }
  }
  if (changed) { updateAlbumDOM(it); scheduleSave(); }
  return cat;
}

/* ---------- la carte ---------- */
function updateAlbumDOM(it, el) {
  const root = el || it.el; if (!root) return;
  const tot = it.tracks.reduce((s, t) => s + trackLen(t), 0);
  root.querySelector('.alname').textContent = it.name;
  root.querySelector('.almeta').textContent =
    `${it.tracks.length} ${it.tracks.length > 1 ? AT.tracks : AT.track} · ${planTime(tot)}`;

  const arc = root.querySelector('.alarc');
  const peaks = it.tracks.map(t => t.peak == null ? .5 : t.peak);
  arc.innerHTML = peaks.length > 1
    ? peaks.map((v, i) => `<b style="left:${(i / peaks.length) * 100}%;width:calc(${100 / peaks.length}% - 2px);height:${Math.round(16 + v * 84)}%"></b>`).join('')
    : '';

  root.querySelector('.allines').innerHTML = it.tracks.length ? it.tracks.map((t, i) => {
    const prev = it.tracks[i - 1];
    const d = prev ? t.bpm - prev.bpm : 0;
    const jump = prev && Math.abs(d) > 6;
    return `<span class="alrow">
      <b class="aldot s${t.state}" data-al="state" data-i="${i}" title="${AT[AL_STATES[t.state]]}"></b>
      <b class="alno">${i + 1}</b>
      <b class="altitle">${esc(t.title)}${t.bars ? '' : ` <i>${AT.gone}</i>`}</b>
      <b class="albpm${jump ? ' jump' : ''}">${t.bpm}${prev ? `<i>${d > 0 ? '+' : ''}${d || '='}</i>` : ''}</b>
      <b class="allen">${t.bars ? planTime(trackLen(t)) : '—'}</b>
      <b class="alacts"><i data-al="up" data-i="${i}">▲</i><i data-al="down" data-i="${i}">▼</i><i data-al="del" data-i="${i}">×</i></b>
    </span>`;
  }).join('') : `<span class="alempty">${AT.empty}</span>`;
  root.querySelector('.aladd').textContent = AT.add;
}

/* ---------- le choix d'un morceau : un popover, pas un plein écran ---------- */
let alPick = { it: null, cat: null, q: '' };
function albumPickHtml() {
  const q = alPick.q.toLowerCase();
  const body = (alPick.cat || []).map(g => {
    const songs = g.songs.filter(s => !q || s.title.toLowerCase().includes(q) || g.board.toLowerCase().includes(q));
    if (!songs.length) return '';
    return `<h4>${esc(g.board)}</h4>` + songs.map(s =>
      `<button class="alpick" data-b="${esc(s.board)}" data-r="${esc(s.ref)}">
        <span>${esc(s.title)}</span><em>${s.bpm} · ${planTime(trackLen(s))}</em></button>`).join('');
  }).join('');
  return `<input class="alq" type="text" placeholder="${AT.search}" value="${esc(alPick.q)}">`
    + (body || `<p class="alnone">${AT.none}</p>`);
}
async function openAlbumPick(it) {
  alPick = { it, cat: await albumCatalogue(), q: '' };
  const bar = $('albumpick');
  bar.innerHTML = albumPickHtml();
  closePopovers('albumpick');
  bar.classList.add('open');
}
$('albumpick').addEventListener('input', e => {
  if (!e.target.classList.contains('alq')) return;
  alPick.q = e.target.value;
  const bar = $('albumpick');
  const pos = e.target.selectionStart;
  bar.innerHTML = albumPickHtml();
  const q = bar.querySelector('.alq');
  q.focus(); q.setSelectionRange(pos, pos);
});
$('albumpick').addEventListener('click', e => {
  const b = e.target.closest('.alpick'); if (!b || !alPick.it) return;
  const s = (alPick.cat || []).flatMap(g => g.songs).find(x => x.board === b.dataset.b && x.ref === b.dataset.r);
  if (!s) return;
  alPick.it.tracks.push({ board: s.board, ref: s.ref, title: s.title, bpm: s.bpm, bars: s.bars,
                          meter: s.meter, state: 0, peak: albumPeak(s.energy) });
  updateAlbumDOM(alPick.it);
  renderItem(alPick.it);
  scheduleSave();
});

/* ---------- les gestes sur la carte ---------- */
function albumAction(it, a, i) {
  if (a === 'add') { openAlbumPick(it); return; }
  if (a === 'state') it.tracks[i].state = (it.tracks[i].state + 1) % 3;
  else if (a === 'up' && i > 0) [it.tracks[i - 1], it.tracks[i]] = [it.tracks[i], it.tracks[i - 1]];
  else if (a === 'down' && i < it.tracks.length - 1) [it.tracks[i + 1], it.tracks[i]] = [it.tracks[i], it.tracks[i + 1]];
  else if (a === 'del') it.tracks.splice(i, 1);
  else return;
  updateAlbumDOM(it);
  renderItem(it);
  scheduleSave();
}
function albumText(it) {
  const mark = ['·', '~', '✓'];
  const L = [it.name.toUpperCase(), ''];
  it.tracks.forEach((t, i) => L.push(
    `${mark[t.state]} ${String(i + 1).padStart(2)}. ${t.title.padEnd(26)} ${String(t.bpm).padStart(3)} BPM  ${t.bars ? planTime(trackLen(t)) : '—'}`));
  L.push('', `${it.tracks.length} ${AT.tracks} — ${planTime(it.tracks.reduce((s, t) => s + trackLen(t), 0))}`);
  return L.join('\n');
}
/* double-tape sur le titre : on le renomme sur place */
function editAlbumName(it) {
  if (locked) return;
  commitTextEdit(); commitTodoEdit();
  const el = it.el.querySelector('.alname');
  setEditable(el);
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
  el.addEventListener('blur', () => {
    el.removeAttribute('contenteditable');
    it.name = (el.innerText || '').replace(/\u00a0/g, ' ').trim().slice(0, 60) || AT.untitled;
    updateAlbumDOM(it);
    scheduleSave();
  }, { once: true });
}
