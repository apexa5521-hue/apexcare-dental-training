'use strict';
// Approved invite form (round 1 · screen 5): short choice lists shown as tappable chips.
// The original <select> stays in the form (visually hidden) and remains the value the form
// submits; chips only set it and fire "change". Options filled later are picked up automatically.
(() => {
  const TARGETS = ['inviteRole', 'inviteSpecialty', 'assignSpecialty'];
  const style = document.createElement('style');
  style.textContent = `
.nse-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.nse-chip{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--nse-line);background:var(--nse-surface);color:var(--nse-ink);font:inherit;font-size:14px;font-weight:600;cursor:pointer}
.nse-chip::before{content:"";width:16px;height:16px;border-radius:50%;border:2px solid var(--nse-line);box-sizing:border-box;flex:0 0 16px}
.nse-chip[aria-checked="true"]{border:2px solid var(--nse-green);background:var(--nse-soft);color:var(--nse-ink);padding:0 15px}
.nse-chip[aria-checked="true"]::before{border:5px solid var(--nse-green)}
.nse-chip:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.nse-chip-select{position:absolute!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
@media(max-width:480px){.nse-chips{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.nse-chip{justify-content:flex-start;font-size:13.5px;padding:0 12px}.nse-chip[aria-checked="true"]{padding:0 11px}}`;
  document.head.append(style);

  function enhance(select) {
    if (!select || select.dataset.nseChips) return;
    select.dataset.nseChips = '1';
    const label = select.closest('label');
    const group = document.createElement('div');
    group.className = 'nse-chips'; group.setAttribute('role', 'radiogroup');
    const name = label ? [...label.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() : select.id;
    group.setAttribute('aria-label', name);
    select.classList.add('nse-chip-select'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
    // Keep the chips outside the <label> so clicks do not re-target the hidden select.
    (label || select).after(group);
    if (label) { label.style.marginBottom = '0'; }
    const paint = () => {
      const opts = [...select.options];
      if (group.childElementCount !== opts.length || opts.some((o, i) => group.children[i]?.dataset.value !== o.value || group.children[i]?.textContent !== o.textContent)) {
        group.replaceChildren(...opts.map(o => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'nse-chip'; b.setAttribute('role', 'radio');
          b.dataset.value = o.value; b.textContent = o.textContent;
          b.onclick = () => { select.value = o.value; select.dispatchEvent(new Event('change', { bubbles: true })); sync(); };
          return b;
        }));
      }
      sync();
    };
    const sync = () => [...group.children].forEach(b => { const on = b.dataset.value === select.value; b.setAttribute('aria-checked', String(on)); b.tabIndex = on || (!select.value && b === group.firstElementChild) ? 0 : -1; });
    group.addEventListener('keydown', e => {
      const items = [...group.children], i = items.indexOf(document.activeElement);
      if (i < 0) return;
      const rtl = getComputedStyle(group).direction === 'rtl';
      const step = { ArrowDown: 1, ArrowUp: -1, ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
      if (!step) return; e.preventDefault();
      const next = items[(i + step + items.length) % items.length]; next.click(); next.focus();
    });
    select.addEventListener('change', sync);
    new MutationObserver(paint).observe(select, { childList: true, subtree: true, characterData: true });
    paint();
  }
  const start = () => TARGETS.forEach(id => enhance(document.getElementById(id)));
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.nseChoiceChips = { enhance };
})();

// Show catalog size next to specialty names so empty specialties are visible when assigning.
window.nseAnnotateSpecialties = specialties => {
  const byId = new Map((specialties || []).map(s => [s.id, s]));
  ['assignSpecialty', 'inviteSpecialty', 'moduleSpecialty', 'draftExamSpecialty'].forEach(id => {
    const sel = document.getElementById(id); if (!sel) return;
    [...sel.options].forEach(o => {
      const s = byId.get(o.value); if (!s) return;
      const base = o.dataset.base || o.textContent; o.dataset.base = base;
      const text = base + ' — ' + s.tools + ' tools' + (s.practiceReady ? '' : ' (not practice-ready)');
      if (o.textContent !== text) o.textContent = text;
    });
  });
};
