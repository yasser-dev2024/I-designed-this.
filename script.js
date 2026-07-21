const titleEl = document.getElementById('poemTitle');
const textEl = document.getElementById('poemText');
const pageEl = document.getElementById('poemPage');
const indexListEl = document.getElementById('indexList');
const pageCounterEl = document.getElementById('pageCounter');

const menuBtn = document.getElementById('menuBtn');
const sidebar = document.getElementById('sidebar');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const copyPanelBtn = document.getElementById('copyPanelBtn');
const copyFooterBtn = document.getElementById('copyFooterBtn');
const shareBtn = document.getElementById('shareBtn');
const readBtn = document.getElementById('readBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const incFontBtn = document.getElementById('incFontBtn');
const decFontBtn = document.getElementById('decFontBtn');

const searchInput = document.getElementById('searchInput');
const tabAllBtn = document.getElementById('tabAll');
const tabFavBtn = document.getElementById('tabFav');
const favBtn = document.getElementById('favBtn');

let pages = [];
let currentPage = 0;
let currentTab = 'all';
let searchQuery = '';
let speaking = false;

const FAV_KEY = 'zamzami_favorites';
const FONT_KEY = 'zamzami_font_step';
const FONT_STEPS = [16, 18, 20, 22, 24];
let fontStep = Number(localStorage.getItem(FONT_KEY));
if (!Number.isInteger(fontStep) || fontStep < 0 || fontStep >= FONT_STEPS.length) fontStep = 1;

function loadFavorites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

let favorites = loadFavorites();

function saveFavorites() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favorites]));
}

function logDev(msg, err) {
  if (err) console.error('[Divan]', msg, err);
  else console.log('[Divan]', msg);
}

function makeTextBlock(page) {
  if (Array.isArray(page.verses)) return page.verses.join('\n');
  const candidate = page.text || page.content || page.body || page.description || '';
  if (Array.isArray(candidate)) return candidate.join('\n').trim();
  return typeof candidate === 'string' ? candidate.trim() : '';
}

function firstTextLine(text) {
  if (!text) return '';
  return String(text).split('\n').find(line => line.trim())?.trim() || '';
}

function normalizePage(raw, index) {
  if (!raw || typeof raw !== 'object') {
    return { pageNumber: index + 1, title: `الصفحة ${index + 1}`, text: '', image: null };
  }

  const pageNumber = raw.pageNumber || raw.page || raw.pageNo || raw.number || index + 1;
  let text = makeTextBlock(raw);
  const rawTitle = raw.title || raw.heading || raw.name || '';
  const title = rawTitle.trim() || firstTextLine(text) || `الصفحة ${pageNumber}`;

  return { pageNumber, title, text, image: raw.image || null };
}

function parsePagesJson(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizePage);
  if (Array.isArray(data.pages)) return data.pages.map(normalizePage);
  if (Array.isArray(data.items)) return data.items.map(normalizePage);
  return [];
}

function loadDataFile(filename) {
  return fetch(filename, { cache: 'no-store' })
    .then(r => {
      if (!r.ok) throw new Error(`${filename} ${r.status}`);
      return r.json();
    })
    .then(data => {
      const result = parsePagesJson(data);
      if (!result.length) throw new Error(`no pages in ${filename}`);
      logDev(`Loaded ${result.length} pages from ${filename}`);
      return result;
    });
}

function loadData() {
  loadDataFile('pages.json')
    .catch(error => {
      logDev('pages.json failed, trying poems.json', error);
      return loadDataFile('poems.json');
    })
    .then(loaded => {
      pages = loaded;
      renderIndexList();
      if (!pages.length) return;
      const match = /page=(\d+)/.exec(location.hash);
      const wanted = match ? pages.findIndex(p => p.pageNumber === Number(match[1])) : -1;
      showPage(wanted >= 0 ? wanted : 0);
    })
    .catch(error => {
      logDev('Failed to load pages', error);
      textEl.innerHTML = '<p class="error-msg">تعذّر تحميل الديوان.</p>';
    });
}

/* ---------- Verse rendering (two-column سدر/عجز) ---------- */

function renderPoemBody(container, page) {
  container.innerHTML = '';
  const body = page.text || '';
  if (!body.trim()) {
    container.innerHTML = '<p class="error-msg">لا يوجد نص لهذه الصفحة.</p>';
    return;
  }

  const lines = body.split('\n');
  let start = 0;
  const titleTrim = (page.title || '').trim();
  while (start < lines.length && (lines[start].trim() === '' || lines[start].trim() === titleTrim)) {
    start++;
  }

  const contentLines = lines.slice(start);
  const frag = document.createDocumentFragment();
  let pendingBreak = false;

  contentLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) {
      pendingBreak = true;
      return;
    }

    if (pendingBreak && frag.childNodes.length) {
      const gap = document.createElement('div');
      gap.className = 'stanza-break';
      frag.appendChild(gap);
    }
    pendingBreak = false;

    const parts = trimmed.split(/\s{2,}/);
    if (parts.length === 2 && parts[0].trim() && parts[1].trim()) {
      const row = document.createElement('div');
      row.className = 'verse-row';
      const sadr = document.createElement('span');
      sadr.textContent = parts[0].trim();
      const ajuz = document.createElement('span');
      ajuz.textContent = parts[1].trim();
      row.appendChild(sadr);
      row.appendChild(ajuz);
      frag.appendChild(row);
    } else {
      const p = document.createElement('div');
      p.className = 'prose-line';
      p.textContent = trimmed;
      frag.appendChild(p);
    }
  });

  container.appendChild(frag);
}

function plainTextOf(page) {
  return (page.text || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

/* ---------- Index list ---------- */

function getFilteredPages() {
  let list = pages.map((p, idx) => ({ ...p, idx }));
  if (currentTab === 'fav') list = list.filter(p => favorites.has(p.pageNumber));
  const q = searchQuery.trim();
  if (q) list = list.filter(p => p.title.includes(q) || String(p.pageNumber).includes(q));
  return list;
}

function renderIndexList() {
  const list = getFilteredPages();
  indexListEl.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'index-empty';
    empty.textContent = currentTab === 'fav' ? 'لا توجد قصائد في المفضلة بعد.' : 'لا توجد نتائج مطابقة.';
    indexListEl.appendChild(empty);
    return;
  }

  list.forEach(page => {
    const item = document.createElement('div');
    item.className = 'index-item' + (page.idx === currentPage ? ' active' : '');

    const num = document.createElement('span');
    num.className = 'idx-num';
    num.textContent = page.pageNumber;

    const title = document.createElement('span');
    title.className = 'idx-title';
    title.textContent = page.title;

    item.appendChild(num);
    item.appendChild(title);

    if (favorites.has(page.pageNumber)) {
      const star = document.createElement('span');
      star.className = 'idx-star';
      star.textContent = '★';
      item.appendChild(star);
    }

    item.addEventListener('click', () => {
      showPage(page.idx);
      if (isMobileLayout()) closeSidebar();
    });

    indexListEl.appendChild(item);

    if (page.idx === currentPage) {
      requestAnimationFrame(() => item.scrollIntoView({ block: 'center' }));
    }
  });
}

/* ---------- Page display ---------- */

function updateFavButton() {
  const page = pages[currentPage];
  const isFav = page && favorites.has(page.pageNumber);
  favBtn.setAttribute('aria-pressed', String(!!isFav));
}

function showPage(index) {
  if (index < 0 || index >= pages.length) return;

  if (speaking) stopReading();

  currentPage = index;
  const page = pages[index];

  titleEl.textContent = page.title || `الصفحة ${page.pageNumber}`;
  pageEl.textContent = `الصفحة ${page.pageNumber} من ${pages.length}`;
  pageCounterEl.textContent = `${page.pageNumber} من ${pages.length}`;
  renderPoemBody(textEl, page);
  updateFavButton();
  renderIndexList();
}

/* ---------- Sidebar (mobile drawer) ---------- */

function isMobileLayout() {
  return window.matchMedia('(max-width: 860px)').matches;
}

function isSidebarVisible() {
  if (isMobileLayout()) return sidebar.classList.contains('force-open');
  return !sidebar.classList.contains('force-closed');
}

function openSidebar() {
  sidebar.classList.add('force-open');
  sidebar.classList.remove('force-closed');
  if (isMobileLayout()) sidebarBackdrop.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('force-open');
  sidebar.classList.add('force-closed');
  sidebarBackdrop.classList.remove('active');
}

function toggleSidebar() {
  if (isSidebarVisible()) closeSidebar();
  else openSidebar();
}

/* ---------- Font size ---------- */

function applyFontSize() {
  document.documentElement.style.setProperty('--poem-font-size', `${FONT_STEPS[fontStep]}px`);
  localStorage.setItem(FONT_KEY, String(fontStep));
}

/* ---------- Text-to-speech ---------- */

function stopReading() {
  window.speechSynthesis.cancel();
  speaking = false;
  readBtn.classList.remove('active');
}

function toggleReading() {
  if (!('speechSynthesis' in window)) {
    alert('المتصفح لا يدعم خاصية القراءة الصوتية.');
    return;
  }
  if (speaking) {
    stopReading();
    return;
  }
  const utter = new SpeechSynthesisUtterance(plainTextOf(pages[currentPage]));
  utter.lang = 'ar-SA';
  utter.rate = 0.9;
  utter.onend = () => { speaking = false; readBtn.classList.remove('active'); };
  utter.onerror = () => { speaking = false; readBtn.classList.remove('active'); };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  speaking = true;
  readBtn.classList.add('active');
}

/* ---------- Copy / Share ---------- */

function copyCurrentText() {
  const text = plainTextOf(pages[currentPage]);
  navigator.clipboard.writeText(text)
    .then(() => alert('تم نسخ النص'))
    .catch(() => alert('تعذّر النسخ'));
}

function shareCurrentText() {
  const page = pages[currentPage];
  const text = plainTextOf(page);
  if (navigator.share) {
    navigator.share({ title: page.title, text }).catch(() => {});
  } else {
    copyCurrentText();
  }
}

/* ---------- Fullscreen ---------- */

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
}

/* ---------- Events ---------- */

prevBtn.addEventListener('click', () => currentPage > 0 && showPage(currentPage - 1));
nextBtn.addEventListener('click', () => currentPage < pages.length - 1 && showPage(currentPage + 1));

menuBtn.addEventListener('click', toggleSidebar);
closeSidebarBtn.addEventListener('click', closeSidebar);
sidebarBackdrop.addEventListener('click', closeSidebar);

copyPanelBtn.addEventListener('click', copyCurrentText);
copyFooterBtn.addEventListener('click', copyCurrentText);
shareBtn.addEventListener('click', shareCurrentText);
readBtn.addEventListener('click', toggleReading);
fullscreenBtn.addEventListener('click', toggleFullscreen);

incFontBtn.addEventListener('click', () => {
  fontStep = Math.min(fontStep + 1, FONT_STEPS.length - 1);
  applyFontSize();
});
decFontBtn.addEventListener('click', () => {
  fontStep = Math.max(fontStep - 1, 0);
  applyFontSize();
});

searchInput.addEventListener('input', e => {
  searchQuery = e.target.value;
  renderIndexList();
});

tabAllBtn.addEventListener('click', () => {
  currentTab = 'all';
  tabAllBtn.classList.add('active');
  tabFavBtn.classList.remove('active');
  renderIndexList();
});

tabFavBtn.addEventListener('click', () => {
  currentTab = 'fav';
  tabFavBtn.classList.add('active');
  tabAllBtn.classList.remove('active');
  renderIndexList();
});

favBtn.addEventListener('click', () => {
  const page = pages[currentPage];
  if (!page) return;
  if (favorites.has(page.pageNumber)) favorites.delete(page.pageNumber);
  else favorites.add(page.pageNumber);
  saveFavorites();
  updateFavButton();
  renderIndexList();
});

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' && currentPage > 0) showPage(currentPage - 1);
  if (e.key === 'ArrowLeft' && currentPage < pages.length - 1) showPage(currentPage + 1);
  if (e.key === 'Escape') closeSidebar();
});

window.addEventListener('DOMContentLoaded', () => {
  applyFontSize();
  loadData();
});
