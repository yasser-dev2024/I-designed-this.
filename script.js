const titleEl = document.getElementById('poemTitle');
const textEl = document.getElementById('poemText');
const pageEl = document.getElementById('poemPage');
const indexListEl = document.getElementById('indexList');
const pageCounterEl = document.getElementById('pageCounter');
const searchStatusEl = document.getElementById('searchStatus');

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

const splashEl = document.getElementById('splashScreen');
const splashSkipBtn = document.getElementById('splashSkipBtn');
const splashPhotoEl = document.querySelector('.splash-photo');
const sectionLabelEl = document.getElementById('sectionLabel');
const poemPanelEl = document.querySelector('.poem-panel');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SECTION_MARKER = /^(أولاً|ثانياً|ثالثاً|رابعاً|خامساً)\s*:/;

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

function loadEmbeddedData() {
  const result = parsePagesJson(window.DIWAN_PAGES);
  if (!result.length) throw new Error('no embedded pages');
  logDev(`Loaded ${result.length} pages from pages-data.js`);
  return result;
}

function loadData() {
  const dataPromise = window.DIWAN_PAGES
    ? Promise.resolve().then(loadEmbeddedData)
    : loadDataFile('pages.json')
      .catch(error => {
        logDev('pages.json failed, trying poems.json', error);
        return loadDataFile('poems.json');
      });

  dataPromise
    .then(loaded => {
      pages = loaded;
      computeSectionLabels(pages);
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

/* ---------- Page classification (structural, content-based — no guessing) ---------- */

function isVerseLine(line) {
  const parts = line.trim().split(/\s{2,}/);
  return parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== '';
}

function classifyPageMode(page) {
  const lines = (page.text || '').split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return 'prose';
  const verseLines = lines.filter(isVerseLine).length;
  return (verseLines >= 2 && verseLines / lines.length >= 0.5) ? 'verse' : 'prose';
}

/* Section name shown as a secondary label under poem titles, only when the
   source itself carries an explicit ordinal divider (e.g. "أولاً: ديوان
   (مواجع قلب)"). Never invented; left blank whenever none applies. */
function computeSectionLabels(pagesArr) {
  let current = '';
  pagesArr.forEach(p => {
    const title = (p.title || '').trim();
    if (SECTION_MARKER.test(title)) {
      current = title;
      p.sectionLabel = '';
    } else {
      p.sectionLabel = current;
    }
  });
}

/* ---------- Verse rendering (two-column سدر/عجز) ---------- */

function renderPoemBody(container, page, mode) {
  container.innerHTML = '';
  const body = page.text || '';
  if (!body.trim()) {
    return;
  }

  const lines = body.split('\n');
  let start = 0;
  const titleTrim = (page.title || '').trim();
  while (start < lines.length && (lines[start].trim() === '' || lines[start].trim() === titleTrim)) {
    start++;
  }

  const contentLines = lines.slice(start);

  if (mode === 'prose') {
    renderProseBody(container, contentLines);
    return;
  }

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

/* Groups content lines into paragraphs at blank-line boundaries only.
   Every original line, its exact text and order are preserved verbatim
   (white-space: pre-line in CSS keeps the original line breaks visible);
   this only adds visual paragraph spacing, never edits wording. */
function renderProseBody(container, contentLines) {
  const frag = document.createDocumentFragment();
  let currentGroup = [];

  const flushGroup = () => {
    if (!currentGroup.length) return;
    const p = document.createElement('p');
    p.className = 'prose-para';
    p.textContent = currentGroup.join('\n');
    frag.appendChild(p);
    currentGroup = [];
  };

  contentLines.forEach(line => {
    if (!line.trim()) {
      flushGroup();
      return;
    }
    currentGroup.push(line.trim());
  });
  flushGroup();

  container.appendChild(frag);
}

function plainTextOf(page) {
  return (page.text || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

function normalizeArabic(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchMatch(page, query) {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return null;

  const titleMatch = normalizeArabic(page.title).includes(normalizedQuery);
  const matchedLines = (page.text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => normalizeArabic(line).includes(normalizedQuery));

  const numberMatch = String(page.pageNumber).includes(query.trim());
  if (!titleMatch && !matchedLines.length && !numberMatch) return null;

  const titleKey = normalizeArabic(page.title);
  const snippets = matchedLines
    .filter(line => normalizeArabic(line) !== titleKey)
    .slice(0, 2);

  return { titleMatch, numberMatch, snippets, matchCount: matchedLines.length };
}

function getPageCopyText(page) {
  if (!page) return '';
  const title = (page.title || '').trim();
  const body = plainTextOf(page);
  if (!title) return body;
  if (!body) return title;
  const firstLine = body.split('\n')[0];
  return normalizeArabic(firstLine) === normalizeArabic(title)
    ? body
    : `${title}\n\n${body}`;
}

/* ---------- Index list ---------- */

function getFilteredPages() {
  let list = pages.map((p, idx) => ({ ...p, idx }));
  if (currentTab === 'fav') list = list.filter(p => favorites.has(p.pageNumber));
  const q = searchQuery.trim();
  if (q) {
    list = list
      .map(p => ({ ...p, searchMatch: getSearchMatch(p, q) }))
      .filter(p => p.searchMatch);
  }
  return list;
}

function renderIndexList() {
  const list = getFilteredPages();
  indexListEl.innerHTML = '';
  const q = searchQuery.trim();

  if (searchStatusEl) {
    searchStatusEl.textContent = q
      ? (list.length === 1 ? 'نتيجة واحدة' : `${list.length} نتيجة`)
      : '';
  }

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'index-empty';
    empty.textContent = currentTab === 'fav' ? 'لا توجد قصائد في المفضلة بعد.' : 'لا توجد نتائج مطابقة.';
    indexListEl.appendChild(empty);
    return;
  }

  list.forEach(page => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'index-item' + (page.idx === currentPage ? ' active' : '') + (page.searchMatch?.snippets.length ? ' has-snippet' : '');

    const num = document.createElement('span');
    num.className = 'idx-num';
    num.textContent = page.pageNumber;

    const copy = document.createElement('span');
    copy.className = 'idx-copy';

    const title = document.createElement('span');
    title.className = 'idx-title';
    title.textContent = page.title;

    item.appendChild(num);
    copy.appendChild(title);

    if (page.searchMatch?.snippets.length) {
      page.searchMatch.snippets.forEach(line => {
        const snippet = document.createElement('span');
        snippet.className = 'idx-snippet';
        snippet.textContent = line;
        copy.appendChild(snippet);
      });
      if (page.searchMatch.matchCount > page.searchMatch.snippets.length) {
        const more = document.createElement('span');
        more.className = 'idx-more';
        const remaining = page.searchMatch.matchCount - page.searchMatch.snippets.length;
        more.textContent = `+ ${remaining} مطابقة أخرى`;
        copy.appendChild(more);
      }
    }

    item.appendChild(copy);

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
  favBtn.setAttribute('aria-label', isFav ? 'إزالة الصفحة من المفضلة' : 'إضافة الصفحة إلى المفضلة');
  favBtn.title = isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة';
}

function updateNavigationButtons() {
  prevBtn.disabled = currentPage <= 0;
  nextBtn.disabled = currentPage >= pages.length - 1;
}

function applyPageContent(page) {
  const mode = classifyPageMode(page);

  titleEl.textContent = page.title || `الصفحة ${page.pageNumber}`;
  titleEl.classList.toggle('prose-title', mode === 'prose');
  sectionLabelEl.textContent = page.sectionLabel || '';
  pageEl.textContent = `الصفحة ${page.pageNumber} من ${pages.length}`;
  pageCounterEl.textContent = `${page.pageNumber} من ${pages.length}`;
  textEl.classList.toggle('prose-mode', mode === 'prose');
  renderPoemBody(textEl, page, mode);
  updateFavButton();
  updateNavigationButtons();
  renderIndexList();
}

function showPage(index, updateHash = true) {
  if (index < 0 || index >= pages.length) return;

  if (speaking) stopReading();

  currentPage = index;
  const page = pages[index];
  applyPageContent(page);

  if (updateHash && location.hash !== `#page=${page.pageNumber}`) {
    history.replaceState(null, '', `#page=${page.pageNumber}`);
  }

  if (!prefersReducedMotion && poemPanelEl.animate) {
    poemPanelEl.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: 180, easing: 'ease-out' }
    );
  }
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
  window.speechSynthesis?.cancel();
  speaking = false;
  readBtn.classList.remove('active');
  readBtn.setAttribute('aria-pressed', 'false');
  const label = readBtn.querySelector('span');
  if (label) label.textContent = 'قراءة القصيدة';
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
  const page = pages[currentPage];
  if (!page) return;
  const utter = new SpeechSynthesisUtterance(getPageCopyText(page));
  utter.lang = 'ar-SA';
  utter.rate = 0.9;
  utter.onend = stopReading;
  utter.onerror = stopReading;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
  speaking = true;
  readBtn.classList.add('active');
  readBtn.setAttribute('aria-pressed', 'true');
  const label = readBtn.querySelector('span');
  if (label) label.textContent = 'إيقاف القراءة';
}

/* ---------- Copy / Share ---------- */

let copyToastEl = null;

function showToast(message) {
  if (!copyToastEl) {
    copyToastEl = document.createElement('div');
    copyToastEl.className = 'copy-toast';
    document.body.appendChild(copyToastEl);
  }
  copyToastEl.textContent = message;
  copyToastEl.classList.remove('show');
  void copyToastEl.offsetWidth;
  copyToastEl.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => copyToastEl.classList.remove('show'), 1800);
}

async function writeTextToClipboard(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      logDev('Clipboard API failed, using fallback', error);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto -9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('copy command failed');
}

async function copyCurrentText() {
  const page = pages[currentPage];
  if (!page) return;
  const text = getPageCopyText(page);
  try {
    await writeTextToClipboard(text);
    showToast(`تم نسخ «${page.title}»`);
  } catch (error) {
    logDev('Copy failed', error);
    showToast('تعذّر النسخ في هذا المتصفح');
  }
}

async function shareCurrentText() {
  const page = pages[currentPage];
  if (!page) return;
  const text = getPageCopyText(page);
  if (navigator.share) {
    try {
      await navigator.share({ title: page.title, text, url: `${location.href.split('#')[0]}#page=${page.pageNumber}` });
    } catch (error) {
      if (error.name !== 'AbortError') showToast('تعذّرت المشاركة');
    }
  } else {
    await copyCurrentText();
  }
}

/* ---------- Fullscreen ---------- */

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => showToast('تعذّر ملء الشاشة'));
  } else {
    document.exitFullscreen?.().catch(() => showToast('تعذّر الخروج من ملء الشاشة'));
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
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn.setAttribute('aria-pressed', String(!!document.fullscreenElement));
});

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
  if (e.key === 'Escape') {
    closeSidebar();
    return;
  }
  if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
  if (e.key === 'ArrowRight' && currentPage > 0) showPage(currentPage - 1);
  if (e.key === 'ArrowLeft' && currentPage < pages.length - 1) showPage(currentPage + 1);
});

window.addEventListener('hashchange', () => {
  const match = /page=(\d+)/.exec(location.hash);
  if (!match || !pages.length) return;
  const index = pages.findIndex(page => page.pageNumber === Number(match[1]));
  if (index >= 0 && index !== currentPage) showPage(index, false);
});

/* ---------- Splash screen ----------
   Not a page: never touches location.hash or history, never counted in
   pagination/index, and shown only once per load — not on in-app navigation. */

let splashDismissed = false;

function dismissSplash() {
  if (splashDismissed) return;
  splashDismissed = true;
  splashEl.classList.add('hidden');
  splashEl.setAttribute('aria-hidden', 'true');
}

if (splashPhotoEl) {
  splashPhotoEl.addEventListener('error', () => logDev('splash photo failed to load'));
}

if (splashSkipBtn) {
  splashSkipBtn.addEventListener('click', dismissSplash);
}

if (new URLSearchParams(location.search).has('capture')) {
  dismissSplash();
}

window.addEventListener('DOMContentLoaded', () => {
  applyFontSize();
  loadData();
  setTimeout(dismissSplash, prefersReducedMotion ? 1800 : 4800);
});
