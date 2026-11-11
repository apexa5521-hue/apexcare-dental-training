'use strict';
// Segmented tabs for long admin pages (inspired by the 21st.dev "Segmented Tabs" pattern,
// original vanilla implementation). Elements are never moved: each page's blocks stay where
// their own scripts render them, and the tabs only show the blocks of the active tab. This keeps
// working when a page re-renders its content, because classification re-runs on DOM changes.
(() => {
  const text = el => {
    if (!el) return '';
    if (el.matches('h2,h3,summary')) return el.textContent;
    return (el.querySelector(':scope > h2, :scope > h3, :scope > summary, :scope > details > summary, :scope > form > h3, :scope > div > h3') || el).textContent.slice(0, 200);
  };
  const has = (el, ...words) => { const t = text(el).toLowerCase(); return words.some(w => t.includes(w.toLowerCase())); };

  const PAGES = {
    team: {
      units: v => {
        const card = v.querySelector(':scope > .card:not(#developmentAdmin)');
        return [...(card ? [...card.children] : []), ...v.querySelectorAll(':scope > #developmentAdmin, :scope > section.card:not(:first-of-type)')];
      },
      always: el => el.matches('.card > h2:first-child') || el.matches('.card > h2:first-child + p'),
      tabs: [
        { id: 'members', label: 'الفريق · Team', icon: '👥', match: el => el.id === 'teamList' || has(el, 'onboarding', 'readiness', 'جاهزية') },
        { id: 'invite', label: 'دعوة · Invite', icon: '✉️', match: el => el.id === 'inviteArea' || has(el, 'invite') },
        { id: 'assign', label: 'إسناد تخصص · Assign', icon: '🏷️', match: el => el.id === 'assignmentForm' || has(el, 'assign specialty') },
        { id: 'history', label: 'السجل السابق · History', icon: '🗂️', match: el => el.id === 'legacyLinkArea' || has(el, 'historic', 'legacy') },
        { id: 'development', label: 'التطوير والتقييم · Development', icon: '📈', match: el => el.id === 'developmentAdmin' || has(el, 'development', 'practical') }
      ]
    },
    studio: {
      units: v => {
        const first = v.querySelector(':scope > .card:not(#contentIntake)'), intake = v.querySelector('#contentIntake');
        return [...(first ? [...first.children] : []), ...(intake ? [...intake.children] : [])];
      },
      always: el => el.matches('#contentIntake > p.notice'),
      hide: el => el.matches('#contentIntake > h2'),
      tabs: [
        { id: 'readiness', label: 'نظرة عامة · Overview', icon: '📊', match: el => has(el, 'readiness', 'جاهزية') },
        { id: 'lessons', label: 'الدروس · Lessons', icon: '📘', match: el => el.id === 'moduleForm' || el.id === 'manageModules' || has(el, 'content studio', 'drafts and published', 'ابدأ من أداة', 'إدارة المسودات') },
        { id: 'ai', label: 'اقتراحات التعديل · Edit proposals', icon: '✨', match: el => el.id === 'proposalStudio' },
        { id: 'questions', label: 'الأسئلة · Questions', icon: '❓', match: el => has(el, 'question', 'الأسئلة', 'catalog', 'الكتالوج') },
        { id: 'exams', label: 'الاختبارات · Exams', icon: '📝', match: el => has(el, 'assessment') },
        { id: 'media', label: 'الملفات · Media', icon: '🖼️', match: el => has(el, 'upload', 'sources & media', 'ارفع محتوى') }
      ]
    }
  };

  const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

  function setup(name, cfg) {
    const view = document.querySelector(`section.view[data-page="${name}"]`);
    if (!view || view.querySelector(':scope > .nse-tabs')) return;
    const bar = document.createElement('div');
    bar.className = 'nse-tabs'; bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', name);
    const glider = document.createElement('span'); glider.className = 'nse-tabs-glider'; glider.setAttribute('aria-hidden', 'true');
    bar.append(glider);
    let active = store.get('nse-tab-' + name);
    if (!cfg.tabs.some(t => t.id === active)) active = cfg.tabs[0].id;
    const buttons = cfg.tabs.map(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'nse-tab'; b.setAttribute('role', 'tab'); b.dataset.tab = t.id;
      const icon = document.createElement('span'); icon.className = 'nse-tab-icon'; icon.textContent = t.icon; icon.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span'); label.textContent = t.label;
      b.append(icon, label);
      b.onclick = () => { active = t.id; store.set('nse-tab-' + name, active); apply(); b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); };
      bar.append(b); return b;
    });
    bar.addEventListener('keydown', e => {
      const i = buttons.findIndex(b => b.dataset.tab === active), dir = getComputedStyle(bar).direction === 'rtl' ? -1 : 1;
      const step = e.key === 'ArrowRight' ? dir : e.key === 'ArrowLeft' ? -dir : 0;
      if (!step) return; e.preventDefault();
      const next = buttons[(i + step + buttons.length) % buttons.length]; next.click(); next.focus();
    });
    const nav = view.querySelector(':scope > .page-navigation');
    nav ? nav.after(bar) : view.prepend(bar);

    let busy = false;
    function apply() {
      if (busy) return; busy = true;
      try {
        let last = cfg.tabs[0].id;
        const units = new Set(cfg.units(view));
        const counts = Object.fromEntries(cfg.tabs.map(t => [t.id, 0]));
        for (const el of units) {
          if (cfg.hide?.(el)) { el.classList.add('nse-tab-off'); continue; }
          if (cfg.always?.(el)) { el.classList.remove('nse-tab-off'); continue; }
          const tab = cfg.tabs.find(t => t.match(el));
          const id = tab ? tab.id : last; last = id;
          if (el.matches('p.notice:empty, p.notice:not(:empty)') && !tab) { el.classList.remove('nse-tab-off'); continue; }
          counts[id]++;
          el.classList.toggle('nse-tab-off', id !== active);
          el.dataset.nseTab = id;
        }
        // Hide container cards that have nothing to show on this tab.
        view.querySelectorAll(':scope > .card, :scope > section.card').forEach(card => {
          if (units.has(card)) return;
          const kids = [...card.children].filter(k => !k.classList.contains('nse-tab-off') && !(k.matches('p.notice') && !k.textContent.trim()));
          card.classList.toggle('nse-tab-off', kids.length === 0);
        });
        buttons.forEach(b => {
          const on = b.dataset.tab === active;
          b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
          b.hidden = counts[b.dataset.tab] === 0 && !on;
        });
        const cur = buttons.find(b => b.dataset.tab === active);
        if (cur) { glider.style.width = cur.offsetWidth + 'px'; glider.style.transform = `translateX(${cur.offsetLeft}px)`; }
        view.querySelectorAll('form').forEach(f => { if (!f.closest('.nse-tray,.nse-drill,#nseSearch')) f.classList.add('nse-2col'); });
      } finally { busy = false; }
    }
    let queued = false;
    new MutationObserver(() => { if (queued || busy) return; queued = true; requestAnimationFrame(() => { queued = false; apply(); }); })
      .observe(view, { childList: true, subtree: true });
    if ('ResizeObserver' in window) new ResizeObserver(() => apply()).observe(bar);
    apply();
  }

  const style = document.createElement('style');
  style.textContent = `
.nse-tabs{position:relative;display:flex;gap:4px;padding:5px;margin:0 0 20px;background:color-mix(in srgb,var(--nse-ink,#182b3b) 6%,transparent);border-radius:16px;overflow-x:auto;scrollbar-width:none;isolation:isolate}
.nse-tabs::-webkit-scrollbar{display:none}
.nse-tab{position:relative;z-index:1;flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;border:0;background:none;color:var(--nse-muted,#637589);font:inherit;font-size:13.5px;font-weight:650;padding:10px 14px;border-radius:12px;cursor:pointer;white-space:nowrap;min-height:42px;transition:color .2s}
.nse-tab:hover{color:var(--nse-ink,#182b3b)}
.nse-tab[aria-selected=true]{color:var(--nse-ink,#182b3b)}
.nse-tab:focus-visible{outline:2px solid var(--nse-green,#127b69);outline-offset:2px}
.nse-tab-icon{font-size:15px;line-height:1}
.nse-tabs-glider{position:absolute;z-index:0;top:5px;bottom:5px;left:0;border-radius:12px;background:var(--nse-surface,#fff);box-shadow:0 1px 3px #0f2a3a1f,0 1px 1px #0f2a3a0f;transition:transform .28s cubic-bezier(.3,.7,.2,1),width .28s cubic-bezier(.3,.7,.2,1)}
@media (prefers-reduced-motion:reduce){.nse-tabs-glider{transition:none}}
.nse-tab-off{display:none!important}
.view p.notice:empty{display:none}
.view form.nse-2col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 16px;align-items:end}
.view form.nse-2col>*{grid-column:1/-1}
.view form.nse-2col>label.field:has(>input:not([type=checkbox]):not([type=file])),.view form.nse-2col>label.field:has(>select){grid-column:auto}
.view form.nse-2col>.btn,.view form.nse-2col>button{justify-self:start;width:auto!important;min-width:180px}
@media(max-width:760px){.view form.nse-2col{grid-template-columns:1fr}.nse-tab{font-size:13px;padding:9px 12px}}`;
  document.head.append(style);

  const start = () => Object.entries(PAGES).forEach(([n, c]) => setup(n, c));
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.nsePageTabs = { start };
})();
