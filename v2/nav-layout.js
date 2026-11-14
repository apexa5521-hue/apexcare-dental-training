'use strict';
// Approved navigation (round 1 · screens 1–2):
// - Side menu: learner pages first, then an "Administration" group for team/studio/reports.
// - Phones: a fixed bottom bar with four main destinations plus "More" (a sheet with the rest).
// The bottom bar never navigates on its own: it clicks the matching side-menu button, so role
// checks, translations and the leave-assessment confirmation all keep working unchanged.
(() => {
  const ADMIN = ['team', 'studio', 'reports'];
  const PRIMARY = ['home', 'learning', 'catalog', 'assessments'];
  const lang = () => document.getElementById('language')?.value || 'en';
  const T = { admin: { ar: 'الإدارة', en: 'Administration', ur: 'انتظامیہ', id: 'Administrasi' }, more: { ar: 'المزيد', en: 'More', ur: 'مزید', id: 'Lainnya' }, menu: { ar: 'القائمة', en: 'Menu', ur: 'مینو', id: 'Menu' }, close: { ar: 'إغلاق', en: 'Close', ur: 'بند کریں', id: 'Tutup' } };
  const t = k => T[k][lang()] || T[k].en;
  const SHORT = { home: { ar: 'الرئيسية', en: 'Home', ur: 'ہوم', id: 'Beranda' }, learning: { ar: 'التعلّم', en: 'Learn', ur: 'سیکھیں', id: 'Belajar' }, catalog: { ar: 'المهارات', en: 'Skills', ur: 'مہارتیں', id: 'Keterampilan' }, assessments: { ar: 'الاختبارات', en: 'Exams', ur: 'امتحانات', id: 'Ujian' } };
  const DOTS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>';

  const style = document.createElement('style');
  style.textContent = `
.nav .nse-nav-group{display:block;margin:14px 10px 4px;padding-top:14px;border-top:1px solid var(--nse-line);font-size:11px;font-weight:700;letter-spacing:.4px;color:var(--nse-muted)}
.nse-bottom{display:none}
.nse-sheet{position:fixed;z-index:310;inset:auto 0 0 0;max-height:80dvh;overflow-y:auto;background:var(--nse-surface);color:var(--nse-ink);border-radius:22px 22px 0 0;border-top:1px solid var(--nse-line);box-shadow:0 -18px 40px #0b231a29;padding:10px 14px calc(18px + env(safe-area-inset-bottom))}
.nse-sheet[hidden]{display:none}
.nse-sheet .grab{width:44px;height:5px;border-radius:99px;background:var(--nse-line);margin:4px auto 12px}
.nse-sheet h2{margin:0 6px 8px;font-size:17px}
.nse-sheet .nse-sheet-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.nse-sheet .nse-sheet-grid button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:84px;padding:10px 6px;border-radius:16px;border:1px solid var(--nse-line);background:var(--nse-surface);color:var(--nse-ink);font:inherit;font-size:12.5px;font-weight:600;text-align:center;cursor:pointer}
.nse-sheet .nse-sheet-grid button svg{width:22px;height:22px}
.nse-sheet .nse-sheet-grid button[aria-current=page]{border-color:var(--nse-green);background:var(--nse-soft);color:var(--nse-green)}
.nse-sheet .sub{margin:14px 6px 8px;font-size:12px;font-weight:700;color:var(--nse-muted)}
.nse-scrim{position:fixed;z-index:305;inset:0;background:#0b231a59}
.nse-scrim[hidden]{display:none}
@media(max-width:760px){
 :root[data-theme] .side .nav{display:none!important}
 .nse-bottom{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;z-index:300;inset:auto 0 0 0;background:var(--nse-surface);border-top:1px solid var(--nse-line);padding:6px 4px calc(8px + env(safe-area-inset-bottom));box-shadow:0 -6px 18px #0b231a12}
 .nse-bottom button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:52px;border:0;background:none;color:var(--nse-muted);font:inherit;font-size:11px;font-weight:600;cursor:pointer;border-radius:12px;padding:4px 2px}
 .nse-bottom button svg{width:22px;height:22px}
 .nse-bottom button span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .nse-bottom button[aria-current=page]{color:var(--nse-green);font-weight:700}
 .nse-bottom button[aria-current=page] svg{stroke-width:2.2}
 .nse-bottom button:focus-visible{outline:2px solid var(--nse-green);outline-offset:-2px}
 body.nse-has-bottom .main{padding-bottom:96px!important}
 body.nse-has-bottom .nse-toasts{top:12px}
}`;
  document.head.append(style);

  const nav = () => document.getElementById('nav');
  const buttons = () => [...(nav()?.querySelectorAll(':scope > button') || [])];
  const label = b => [...b.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() || b.textContent.trim();
  const iconOf = b => b.querySelector('svg')?.outerHTML || '';
  const current = () => buttons().find(b => b.classList.contains('selected'))?.dataset.page;

  let bar, sheet, scrim, busy = false;
  function groupSideMenu() {
    const n = nav(); if (!n) return;
    n.querySelectorAll('.nse-nav-group').forEach(x => x.remove());
    const firstAdmin = buttons().find(b => ADMIN.includes(b.dataset.page));
    if (firstAdmin) { const h = document.createElement('span'); h.className = 'nse-nav-group'; h.setAttribute('role', 'presentation'); h.textContent = t('admin'); firstAdmin.before(h); }
  }
  const go = page => { closeSheet(); buttons().find(b => b.dataset.page === page)?.click(); };
  function makeBtn(b, short) {
    const x = document.createElement('button'); x.type = 'button';
    x.innerHTML = iconOf(b); const s = document.createElement('span'); const sh = short && SHORT[b.dataset.page]; s.textContent = sh ? (sh[lang()] || sh.en) : label(b); x.append(s);
    if (sh) x.setAttribute('aria-label', label(b));
    x.dataset.page = b.dataset.page; x.onclick = () => go(b.dataset.page); return x;
  }
  function renderBar() {
    const all = buttons(); if (!all.length) { bar?.remove(); bar = null; document.body.classList.remove('nse-has-bottom'); return; }
    if (!bar) { bar = document.createElement('nav'); bar.className = 'nse-bottom'; document.body.append(bar); }
    bar.setAttribute('aria-label', t('menu'));
    const primary = PRIMARY.map(p => all.find(b => b.dataset.page === p)).filter(Boolean).slice(0, 4);
    const items = primary.map(b => makeBtn(b, true));
    const more = document.createElement('button'); more.type = 'button'; more.className = 'nse-more';
    more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-expanded', 'false');
    more.innerHTML = DOTS; const ms = document.createElement('span'); ms.textContent = t('more'); more.append(ms);
    more.onclick = openSheet; items.push(more);
    bar.replaceChildren(...items); document.body.classList.add('nse-has-bottom');
    markCurrent();
  }
  function markCurrent() {
    const cur = current(), primaryIds = [...(bar?.querySelectorAll('button[data-page]') || [])].map(b => b.dataset.page);
    bar?.querySelectorAll('button').forEach(b => {
      const on = b.dataset.page ? b.dataset.page === cur : !!cur && !primaryIds.includes(cur);
      on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current');
    });
    sheet?.querySelectorAll('.nse-sheet-grid button').forEach(b => b.dataset.page === cur ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  }
  function openSheet() {
    if (!sheet) {
      scrim = document.createElement('div'); scrim.className = 'nse-scrim'; scrim.hidden = true; scrim.onclick = closeSheet;
      sheet = document.createElement('section'); sheet.className = 'nse-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
      document.body.append(scrim, sheet);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
    }
    const all = buttons(), rest = all.filter(b => !PRIMARY.includes(b.dataset.page));
    const learner = rest.filter(b => !ADMIN.includes(b.dataset.page)), admin = rest.filter(b => ADMIN.includes(b.dataset.page));
    const head = document.createElement('h2'); head.textContent = t('more'); sheet.setAttribute('aria-label', t('more'));
    const grab = document.createElement('div'); grab.className = 'grab';
    const nodes = [grab, head];
    const grid = list => { const g = document.createElement('div'); g.className = 'nse-sheet-grid'; list.forEach(b => g.append(makeBtn(b))); return g; };
    if (learner.length) nodes.push(grid(learner));
    if (admin.length) { const s = document.createElement('p'); s.className = 'sub'; s.textContent = t('admin'); nodes.push(s, grid(admin)); }
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn sub'; close.style.cssText = 'width:100%;margin-top:14px'; close.textContent = t('close'); close.onclick = closeSheet;
    nodes.push(close);
    sheet.replaceChildren(...nodes); markCurrent();
    sheet.hidden = false; scrim.hidden = false; bar?.querySelector('.nse-more')?.setAttribute('aria-expanded', 'true');
    sheet.querySelector('.nse-sheet-grid button')?.focus();
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true; scrim.hidden = true;
    const m = bar?.querySelector('.nse-more'); m?.setAttribute('aria-expanded', 'false'); m?.focus();
  }
  function sync() {
    if (busy) return; busy = true;
    try { groupSideMenu(); renderBar(); } finally { busy = false; }
  }
  function start() {
    const n = nav(); if (!n) return;
    let queued = false;
    new MutationObserver(muts => {
      if (busy) return;
      const structural = muts.some(m => m.type === 'childList' && [...m.addedNodes, ...m.removedNodes].some(x => x.nodeType === 1 && !x.classList?.contains('nse-nav-group')));
      if (structural) { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; sync(); }); } }
      else markCurrent();
    }).observe(n, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    sync();
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.nseNavLayout = { sync };
})();
