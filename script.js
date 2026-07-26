const titleEl = document.getElementById('poemTitle');
const textEl = document.getElementById('poemText');
const pageEl = document.getElementById('poemPage');
const indexListEl = document.getElementById('indexList');
const currentPageNumberEl = document.getElementById('currentPageNumber');
const totalPageNumberEl = document.getElementById('totalPageNumber');
const searchStatusEl = document.getElementById('searchStatus');
const searchClearBtn = document.getElementById('searchClearBtn');
const pageJumpForm = document.getElementById('pageJumpForm');
const pageJumpInput = document.getElementById('pageJumpInput');
const pageJumpError = document.getElementById('pageJumpError');
const sourceImageViewer = document.getElementById('sourceImageViewer');
const sourceImageViewerImage = document.getElementById('sourceImageViewerImage');
const sourceImageViewerCaption = document.getElementById('sourceImageViewerCaption');
const sourceImageViewerClose = document.getElementById('sourceImageViewerClose');

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
const poemCardWrapEl = document.querySelector('.poem-card-wrap');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SECTION_MARKER = /^(أولاً|ثانياً|ثالثاً|رابعاً|خامساً)\s*:/;
const ORIGINAL_IMAGE_PAGES = new Set([1, 2, 4, 191, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202, 208]);
const HANDWRITTEN_IMAGE_PAGES = new Set([4, 192, 193, 194, 195, 196, 197, 198, 199, 200, 201, 202]);
const PRINTED_INDEX_PAGES = new Set([203, 204, 205, 206, 207]);
const IMAGE_ONLY_READER_PAGES = new Set(ORIGINAL_IMAGE_PAGES);

let pages = [];
let totalPageNumber = 0;
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
  const numericPageNumber = Number(pageNumber);
  const originalImage = ORIGINAL_IMAGE_PAGES.has(numericPageNumber)
    ? `page_images/page_${String(numericPageNumber).padStart(3, '0')}.png`
    : null;
  const image = raw.image || originalImage;
  const imageKind = raw.imageKind || (HANDWRITTEN_IMAGE_PAGES.has(numericPageNumber) ? 'handwritten' : 'source');

  return { pageNumber, title, text, image, imageKind };
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
      pages = loaded.filter(page => !PRINTED_INDEX_PAGES.has(Number(page.pageNumber)));
      totalPageNumber = Math.max(...pages.map(page => Number(page.pageNumber) || 0));
      computeSectionLabels(pages);
      pageJumpInput.max = String(totalPageNumber);
      renderIndexList({ scrollActive: false });
      if (!pages.length) return;
      const match = /page=(\d+)/.exec(location.hash);
      const wanted = match ? findReaderPageIndex(Number(match[1])) : 0;
      showPage(wanted);
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

function sourceImageLabel(page) {
  return page.imageKind === 'handwritten'
    ? 'الصورة الأصلية بخط الشاعر'
    : 'الصورة الأصلية من الديوان';
}

function renderSourceImage(container, page) {
  if (!page.image) return false;

  const label = sourceImageLabel(page);
  const figure = document.createElement('figure');
  figure.className = `source-image-card ${page.imageKind === 'handwritten' ? 'handwritten-source' : ''}`.trim();

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'source-image-open';
  openButton.dataset.sourceImage = page.image;
  openButton.dataset.sourceAlt = `${label} — ${page.title}`;
  openButton.dataset.sourceCaption = `${label} — الصفحة ${page.pageNumber}`;
  openButton.setAttribute('aria-label', `تكبير ${label} للصفحة ${page.pageNumber}`);

  const imageFrame = document.createElement('span');
  imageFrame.className = 'source-image-frame';

  const image = document.createElement('img');
  image.className = 'source-page-image';
  image.src = page.image;
  image.alt = `${label}: ${page.title}`;
  image.loading = 'eager';
  image.decoding = 'async';

  image.addEventListener('error', () => {
    figure.classList.add('source-image-error');
    openButton.disabled = true;
    openButton.setAttribute('aria-label', 'تعذّر تحميل الصورة الأصلية');
  });

  const mediaInfo = document.createElement('span');
  mediaInfo.className = 'source-image-info';

  const mediaLabel = document.createElement('span');
  mediaLabel.className = 'source-image-label';
  mediaLabel.textContent = label;

  const zoomHint = document.createElement('span');
  zoomHint.className = 'source-image-zoom-hint';
  zoomHint.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg><span>عرض بالحجم الكامل</span>';

  imageFrame.appendChild(image);
  mediaInfo.appendChild(mediaLabel);
  mediaInfo.appendChild(zoomHint);
  openButton.appendChild(imageFrame);
  openButton.appendChild(mediaInfo);
  figure.appendChild(openButton);
  container.appendChild(figure);
  return true;
}

function renderPoemBody(container, page, mode) {
  container.innerHTML = '';
  const hasSourceImage = renderSourceImage(container, page);
  container.classList.toggle('has-source-image', hasSourceImage);
  if (hasSourceImage && IMAGE_ONLY_READER_PAGES.has(Number(page.pageNumber))) {
    return;
  }
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
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSearchMatch(page, query) {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery) return null;

  const terms = normalizedQuery.split(' ').filter(Boolean);
  const normalizedTitle = normalizeArabic(page.title);
  const lines = (page.text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const normalizedBody = normalizeArabic(lines.join(' '));
  const searchablePage = `${normalizedTitle} ${normalizedBody}`;
  const titleMatch = terms.every(term => normalizedTitle.includes(term));
  const textMatch = terms.every(term => searchablePage.includes(term));
  const matchedLines = lines.filter(line => {
    const normalizedLine = normalizeArabic(line);
    return terms.some(term => normalizedLine.includes(term));
  });

  const numberMatch = /^\d+$/.test(normalizedQuery) && String(page.pageNumber).includes(normalizedQuery);
  if (!titleMatch && !textMatch && !numberMatch) return null;

  const snippets = matchedLines
    .filter(line => normalizeArabic(line) !== normalizedTitle)
    .slice(0, 2);

  return { titleMatch, textMatch, numberMatch, snippets, matchCount: matchedLines.length };
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
      .filter(p => p.searchMatch)
      .sort((a, b) => Number(b.searchMatch.titleMatch) - Number(a.searchMatch.titleMatch) || a.idx - b.idx);
  }
  return list;
}

function renderIndexList({ scrollActive = false, resetScroll = false } = {}) {
  const list = getFilteredPages();
  indexListEl.innerHTML = '';
  const q = searchQuery.trim();

  if (searchStatusEl) {
    if (q) {
      searchStatusEl.textContent = list.length === 1 ? 'نتيجة واحدة' : `${list.length} نتيجة`;
    } else if (currentTab === 'fav') {
      searchStatusEl.textContent = list.length === 1 ? 'صفحة مفضلة واحدة' : `${list.length} صفحة مفضلة`;
    } else {
      searchStatusEl.textContent = `${list.length} صفحة`;
    }
  }
  searchClearBtn.classList.toggle('visible', !!q);

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'index-empty';
    const emptyTitle = document.createElement('strong');
    emptyTitle.textContent = currentTab === 'fav' && !q ? 'المفضلة فارغة' : 'لا توجد نتائج مطابقة';
    const emptyHint = document.createElement('span');
    emptyHint.textContent = currentTab === 'fav' && !q
      ? 'أضف الصفحات إلى المفضلة لتظهر هنا.'
      : 'جرّب كلمة أخرى أو امسح البحث.';
    empty.appendChild(emptyTitle);
    empty.appendChild(emptyHint);
    indexListEl.appendChild(empty);
    if (resetScroll) indexListEl.scrollTop = 0;
    return;
  }

  list.forEach(page => {
    const item = document.createElement('a');
    item.href = `#page=${page.pageNumber}`;
    item.className = 'index-item' + (page.idx === currentPage ? ' active' : '') + (page.searchMatch?.snippets.length ? ' has-snippet' : '');
    item.dataset.pageIndex = String(page.idx);
    item.setAttribute('aria-label', `الانتقال إلى ${page.title}، الصفحة ${page.pageNumber}`);
    if (page.idx === currentPage) item.setAttribute('aria-current', 'page');

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

    if (page.image) {
      const mediaBadge = document.createElement('span');
      mediaBadge.className = 'idx-media';
      mediaBadge.title = page.imageKind === 'handwritten' ? 'تتضمن صورة بخط الشاعر' : 'تتضمن صورة أصلية';
      mediaBadge.setAttribute('aria-hidden', 'true');
      mediaBadge.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5 17 4.5-4 3.2 2.7 2.3-2 4 3.3"/></svg>';
      item.appendChild(mediaBadge);
    }

    const openIcon = document.createElement('span');
    openIcon.className = 'idx-open';
    openIcon.setAttribute('aria-hidden', 'true');
    openIcon.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6"/></svg>';
    item.appendChild(openIcon);

    item.addEventListener('click', event => {
      event.preventDefault();
      navigateToPage(page.idx, { fromIndex: true });
    });

    indexListEl.appendChild(item);

    if (scrollActive && page.idx === currentPage) {
      requestAnimationFrame(() => item.scrollIntoView({ block: 'center' }));
    }
  });

  if (resetScroll) indexListEl.scrollTop = 0;
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
  pageEl.textContent = `الصفحة ${page.pageNumber} من ${totalPageNumber}`;
  currentPageNumberEl.textContent = page.pageNumber;
  totalPageNumberEl.textContent = totalPageNumber;
  poemPanelEl.classList.toggle('visual-page', !!page.image);
  poemCardWrapEl.classList.toggle('visual-page', !!page.image);
  textEl.classList.toggle('prose-mode', mode === 'prose');
  renderPoemBody(textEl, page, mode);
  updateFavButton();
  updateNavigationButtons();
  renderIndexList();
}

function showPage(index, updateHash = true, historyMode = 'replace') {
  if (index < 0 || index >= pages.length) return;

  if (sourceImageViewer.classList.contains('open')) {
    closeSourceImageViewer({ restoreFocus: false });
  }

  if (speaking) stopReading();

  currentPage = index;
  const page = pages[index];
  applyPageContent(page);
  textEl.scrollTop = 0;

  if (updateHash && location.hash !== `#page=${page.pageNumber}`) {
    history[historyMode === 'push' ? 'pushState' : 'replaceState'](null, '', `#page=${page.pageNumber}`);
  }

  if (!prefersReducedMotion && poemPanelEl.animate) {
    poemPanelEl.animate(
      [{ opacity: 0.72 }, { opacity: 1 }],
      { duration: 180, easing: 'ease-out' }
    );
  }
}

function navigateToPage(index, { fromIndex = false } = {}) {
  if (index < 0 || index >= pages.length) return;

  if (index !== currentPage) {
    showPage(index, true, 'push');
  }

  pageJumpError.textContent = '';
  pageJumpInput.value = '';

  if (fromIndex && isMobileLayout()) {
    closeSidebar();
    requestAnimationFrame(() => {
      poemPanelEl.scrollIntoView({
        block: 'start',
        behavior: prefersReducedMotion ? 'auto' : 'smooth'
      });
    });
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
  menuBtn.setAttribute('aria-expanded', 'true');
  sidebar.setAttribute('aria-hidden', 'false');
  renderIndexList({ scrollActive: !searchQuery.trim() });
}

function closeSidebar() {
  sidebar.classList.remove('force-open');
  sidebar.classList.add('force-closed');
  sidebarBackdrop.classList.remove('active');
  menuBtn.setAttribute('aria-expanded', 'false');
  sidebar.setAttribute('aria-hidden', 'true');
}

function toggleSidebar() {
  if (isSidebarVisible()) closeSidebar();
  else openSidebar();
}

function syncSidebarAccessibility() {
  const visible = isSidebarVisible();
  menuBtn.setAttribute('aria-expanded', String(visible));
  sidebar.setAttribute('aria-hidden', String(!visible));
  if (!isMobileLayout()) sidebarBackdrop.classList.remove('active');
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

/* ---------- Original page images ---------- */

let sourceImageViewerLastFocus = null;

function openSourceImageViewer(button) {
  const source = button.dataset.sourceImage;
  if (!source) return;

  sourceImageViewerLastFocus = document.activeElement;
  sourceImageViewerImage.src = source;
  sourceImageViewerImage.alt = button.dataset.sourceAlt || 'الصورة الأصلية من الديوان';
  sourceImageViewerCaption.textContent = button.dataset.sourceCaption || 'الصورة الأصلية من الديوان';
  sourceImageViewer.classList.add('open');
  sourceImageViewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('source-image-viewer-open');
  sourceImageViewer.scrollTop = 0;
  sourceImageViewerClose.focus({ preventScroll: true });
}

function closeSourceImageViewer({ restoreFocus = true } = {}) {
  if (!sourceImageViewer.classList.contains('open')) return;

  sourceImageViewer.classList.remove('open');
  sourceImageViewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('source-image-viewer-open');

  if (restoreFocus && sourceImageViewerLastFocus?.isConnected) {
    sourceImageViewerLastFocus.focus({ preventScroll: true });
  }
  sourceImageViewerLastFocus = null;
}

/* ---------- Index interaction ---------- */

function clearSearch({ focus = false } = {}) {
  searchQuery = '';
  searchInput.value = '';
  renderIndexList({ scrollActive: true });
  if (focus) searchInput.focus({ preventScroll: true });
}

function focusIndexEdge(edge = 'first') {
  const items = [...indexListEl.querySelectorAll('.index-item')];
  if (!items.length) return;
  items[edge === 'last' ? items.length - 1 : 0].focus();
}

function focusAdjacentIndexItem(currentItem, direction) {
  const items = [...indexListEl.querySelectorAll('.index-item')];
  const currentIndex = items.indexOf(currentItem);
  if (currentIndex < 0 || !items.length) return;
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  items[nextIndex].focus();
}

function setCurrentTab(tab) {
  currentTab = tab;
  const allActive = tab === 'all';
  tabAllBtn.classList.toggle('active', allActive);
  tabFavBtn.classList.toggle('active', !allActive);
  tabAllBtn.setAttribute('aria-pressed', String(allActive));
  tabFavBtn.setAttribute('aria-pressed', String(!allActive));
  renderIndexList({ scrollActive: !searchQuery.trim(), resetScroll: !!searchQuery.trim() });
}

function parsePageNumber(value) {
  const normalizedDigits = String(value || '')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\s+/g, '');
  return /^\d+$/.test(normalizedDigits) ? Number(normalizedDigits) : NaN;
}

function findReaderPageIndex(pageNumber) {
  const exact = pages.findIndex(page => Number(page.pageNumber) === pageNumber);
  if (exact >= 0) return exact;

  const next = pages.findIndex(page => Number(page.pageNumber) > pageNumber);
  return next >= 0 ? next : Math.max(0, pages.length - 1);
}

function syncPageFromHash() {
  const match = /page=(\d+)/.exec(location.hash);
  if (!match || !pages.length) return;
  const requestedPage = Number(match[1]);
  const index = findReaderPageIndex(requestedPage);
  const isExactPage = Number(pages[index]?.pageNumber) === requestedPage;

  if (!isExactPage) {
    showPage(index, true, 'replace');
  } else if (index !== currentPage) {
    showPage(index, false);
  }
}

/* ---------- Events ---------- */

prevBtn.addEventListener('click', () => currentPage > 0 && navigateToPage(currentPage - 1));
nextBtn.addEventListener('click', () => currentPage < pages.length - 1 && navigateToPage(currentPage + 1));

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

textEl.addEventListener('click', event => {
  const openButton = event.target.closest('.source-image-open');
  if (openButton) openSourceImageViewer(openButton);
});

sourceImageViewerClose.addEventListener('click', () => closeSourceImageViewer());
sourceImageViewer.addEventListener('click', event => {
  if (event.target === sourceImageViewer) closeSourceImageViewer();
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
  renderIndexList({ scrollActive: false, resetScroll: true });
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusIndexEdge('first');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusIndexEdge('last');
  } else if (e.key === 'Enter') {
    const firstResult = indexListEl.querySelector('.index-item');
    if (firstResult) {
      e.preventDefault();
      firstResult.click();
    }
  } else if (e.key === 'Escape' && searchQuery) {
    e.preventDefault();
    e.stopPropagation();
    clearSearch({ focus: true });
  }
});

searchClearBtn.addEventListener('click', () => clearSearch({ focus: true }));

indexListEl.addEventListener('keydown', e => {
  const item = e.target.closest('.index-item');
  if (!item) return;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusAdjacentIndexItem(item, 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusAdjacentIndexItem(item, -1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    focusIndexEdge('first');
  } else if (e.key === 'End') {
    e.preventDefault();
    focusIndexEdge('last');
  }
});

tabAllBtn.addEventListener('click', () => setCurrentTab('all'));
tabFavBtn.addEventListener('click', () => setCurrentTab('fav'));

pageJumpInput.addEventListener('input', () => {
  pageJumpError.textContent = '';
});

pageJumpForm.addEventListener('submit', event => {
  event.preventDefault();
  const pageNumber = parsePageNumber(pageJumpInput.value);
  const index = pages.findIndex(page => Number(page.pageNumber) === pageNumber);

  if (index < 0) {
    pageJumpError.textContent = 'أدخل رقم صفحة موجودًا في الديوان.';
    pageJumpInput.focus();
    return;
  }

  navigateToPage(index, { fromIndex: true });
});

favBtn.addEventListener('click', () => {
  const page = pages[currentPage];
  if (!page) return;
  if (favorites.has(page.pageNumber)) favorites.delete(page.pageNumber);
  else favorites.add(page.pageNumber);
  saveFavorites();
  updateFavButton();
  renderIndexList({ scrollActive: false });
});

document.addEventListener('keydown', e => {
  if (sourceImageViewer.classList.contains('open')) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSourceImageViewer();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      sourceImageViewerClose.focus({ preventScroll: true });
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openSidebar();
    searchInput.focus({ preventScroll: true });
    searchInput.select();
    return;
  }

  if (e.key === 'Escape') {
    if (isSidebarVisible()) {
      closeSidebar();
      menuBtn.focus({ preventScroll: true });
    }
    return;
  }

  if (e.target.matches('input, textarea, [contenteditable="true"]')) return;
  if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    openSidebar();
    searchInput.focus({ preventScroll: true });
    return;
  }
  if (e.key === 'ArrowRight' && currentPage > 0) navigateToPage(currentPage - 1);
  if (e.key === 'ArrowLeft' && currentPage < pages.length - 1) navigateToPage(currentPage + 1);
});

window.addEventListener('hashchange', syncPageFromHash);
window.addEventListener('popstate', syncPageFromHash);
window.addEventListener('resize', syncSidebarAccessibility);

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
  tabAllBtn.setAttribute('aria-pressed', 'true');
  tabFavBtn.setAttribute('aria-pressed', 'false');
  syncSidebarAccessibility();
  loadData();
  setTimeout(dismissSplash, prefersReducedMotion ? 1800 : 4800);
});
