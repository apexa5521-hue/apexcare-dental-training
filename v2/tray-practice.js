'use strict';
// Procedure-tray practice UI. Item names are shown in English (drills are English-only);
// after grading, the learner's language name and documented use are shown as feedback.
window.nseMountTray = ({ host, request, post, el, center, language }) => {
  if (!host) return;
  document.getElementById('nseTrayCard')?.remove();
  if (!document.getElementById('nseTrayStyle')) {
    const s = document.createElement('style'); s.id = 'nseTrayStyle';
    s.textContent = `
#nseTrayCard{display:flex;align-items:center;gap:14px;cursor:pointer}
#nseTrayCard .icon{font-size:30px;line-height:1}
#nseTrayCard .grow{flex:1;min-width:0}
#nseTrayCard h3{margin:0 0 2px}
.nse-tray .tray-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px;margin:14px 0}
@media(max-width:480px){.nse-tray .tray-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
.nse-tray .item{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:10px;border:2px solid var(--nse-line,#e4eaf1);border-radius:14px;background:var(--nse-surface,#fff);color:var(--nse-ink,#182b3b);font:inherit;cursor:pointer;min-height:44px}
.nse-tray .item img,.nse-tray .item .ph{width:100%;max-width:120px;aspect-ratio:1;object-fit:cover;border-radius:10px;background:var(--nse-soft,#eaf7f3)}
.nse-tray .item .nm{font-size:.9rem;line-height:1.3;overflow-wrap:anywhere}
.nse-tray .item .ph{display:grid;place-items:center;font-size:28px}
.nse-tray .item[aria-pressed=true]{border-color:var(--nse-green,#127b69);box-shadow:0 0 0 3px color-mix(in srgb,var(--nse-green,#127b69) 25%,transparent)}
.nse-tray .item .tick{font-weight:700;color:var(--nse-green,#127b69);min-height:1.2em}
.nse-tray .item.ok .tick{color:#1f9d6b}.nse-tray .item.miss .tick{color:#b07800}.nse-tray .item.bad .tick{color:#d64545}
.nse-tray .item.ok{border-color:#1f9d6b;background:color-mix(in srgb,#1f9d6b 10%,var(--nse-surface,#fff))}
.nse-tray .item.miss{border-color:#d99a1e;border-style:dashed;background:color-mix(in srgb,#d99a1e 10%,var(--nse-surface,#fff))}
.nse-tray .item.bad{border-color:#d64545;background:color-mix(in srgb,#d64545 10%,var(--nse-surface,#fff))}
.nse-tray .item.neutral{opacity:.55}
.nse-tray .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}
.nse-tray .summary div{border-radius:12px;padding:10px;text-align:center;font-weight:700}
.nse-tray .s-ok{background:color-mix(in srgb,#1f9d6b 14%,transparent)}
.nse-tray .s-miss{background:color-mix(in srgb,#d99a1e 16%,transparent)}
.nse-tray .s-bad{background:color-mix(in srgb,#d64545 14%,transparent)}
.nse-tray .fb{margin:6px 0;padding-inline-start:10px;border-inline-start:3px solid var(--nse-line,#e4eaf1)}
.nse-tray .actions{display:flex;flex-wrap:wrap;gap:8px;position:sticky;bottom:0;background:var(--nse-surface,#fff);padding:10px 0}`;
    document.head.append(s);
  }
  const lang = () => language() || 'en';
  const local = n => (lang() !== 'en' && n[lang()]) ? n[lang()] : '';

  const card = el('section', undefined, 'card section'); card.id = 'nseTrayCard'; card.tabIndex = 0; card.setAttribute('role', 'button');
  const stats = el('p', 'اختاري أدوات الإجراء من بين أدوات له وأدوات ليست له · Pick the right tools for a procedure', 'small');
  const grow = el('div', undefined, 'grow'); grow.append(el('h3', 'تجهيز التري · Procedure Tray'), stats);
  card.append(el('span', '🧺', 'icon'), grow, el('span', '›', 'pill'));
  const anchor = host.querySelector('#nseSearch') || host.querySelector('.hero');
  anchor ? anchor.after(card) : host.prepend(card);
  const refreshStats = () => request('/api/tray/history?centerId=' + encodeURIComponent(center())).then(h => {
    if (h.completed) stats.textContent = 'تدرّبتِ ' + h.completed + ' مرة · متوسط ' + h.averageScore + '% · كاملة ' + h.perfect + ' · Practice only';
  }).catch(() => {});
  refreshStats();

  const modal = document.getElementById('modal'), body = document.getElementById('modalBody');
  async function round() {
    body.replaceChildren(el('p', 'جارٍ تجهيز إجراء…', 'small'));
    if (!modal.open) modal.showModal();
    let r;
    try { r = await post('/api/tray/start', {}); } catch (e) { body.replaceChildren(el('p', e.message === 'NO_ASSIGNED_SPECIALTY' ? 'لا يوجد تخصص مسند لك بعد. اطلبي من المشرفة إسناد تخصص.' : e.message, 'notice')); return; }
    const box = el('div', undefined, 'nse-tray');
    const title = el('h2'); const en = el('span', r.procedure.names.en); en.lang = 'en'; en.dir = 'ltr'; title.append(en);
    box.append(el('span', 'تدريب غير مقيّم · Practice — not an official assessment', 'pill'), title);
    if (local(r.procedure.names)) box.append(el('p', local(r.procedure.names), 'muted'));
    box.append(el('p', 'اختاري كل الأدوات اللازمة لهذا الإجراء، وعددها ' + r.expectedCount + '.', 'small'));
    const hint = el('p', 'Select every item needed for this procedure (' + r.expectedCount + ' items).', 'small'); hint.lang = 'en'; hint.dir = 'ltr'; box.append(hint);
    if (r.partialList) box.append(el('p', 'This round shows part of a long checklist.', 'small'));
    const grid = el('div', undefined, 'tray-grid'), picked = new Set(), tiles = new Map();
    r.options.forEach(o => {
      const b = el('button', undefined, 'item'); b.type = 'button'; b.setAttribute('aria-pressed', 'false');
      if (o.imageUrl) { const i = el('img'); i.src = o.imageUrl; i.alt = ''; i.loading = 'lazy'; b.append(i); } else b.append(el('span', '🦷', 'ph'));
      const n = el('span', o.names.en, 'nm'); n.lang = 'en'; n.dir = 'ltr';
      const tick = el('span', '', 'tick');
      b.append(n, tick);
      b.onclick = () => { if (b.disabled) return; const on = !picked.has(o.id); on ? picked.add(o.id) : picked.delete(o.id); b.setAttribute('aria-pressed', String(on)); tick.textContent = on ? '✓' : ''; count.textContent = picked.size + ' / ' + r.expectedCount; };
      tiles.set(o.id, { b, tick }); grid.append(b);
    });
    const count = el('span', '0 / ' + r.expectedCount, 'pill');
    const submit = el('button', 'تصحيح · Check tray', 'btn'), skip = el('button', 'إجراء آخر · Another procedure', 'btn sub');
    const actions = el('div', undefined, 'actions'); actions.append(count, submit, skip);
    const result = el('div');
    box.append(grid, result, actions);
    body.replaceChildren(box);
    skip.onclick = round;
    submit.onclick = async () => {
      submit.disabled = true;
      try {
        const g = await post('/api/tray/submit', { roundId: r.roundId, selected: [...picked] });
        tiles.forEach(({ b }) => { b.disabled = true; b.classList.add('neutral'); });
        const mark = (list, cls, sign) => list.forEach(x => { const t = tiles.get(x.id); if (t) { t.b.classList.remove('neutral'); t.b.classList.add(cls); t.tick.textContent = sign; } });
        mark(g.correct, 'ok', '✓ صح'); mark(g.missed, 'miss', '! ناقصة'); mark(g.wrong, 'bad', '✗ غلط');
        const sum = el('div', undefined, 'summary');
        sum.append(el('div', '✓ ' + g.correct.length + ' صح', 's-ok'), el('div', '! ' + g.missed.length + ' ناقصة', 's-miss'), el('div', '✗ ' + g.wrong.length + ' غلط', 's-bad'));
        result.replaceChildren(el('h3', g.perfect ? 'ممتاز! التري كامل وصحيح 🎉' : 'النتيجة ' + g.score + '%'), sum);
        const explain = (heading, list) => { if (!list.length) return; result.append(el('h4', heading)); list.forEach(x => { const p = el('p', undefined, 'fb'); const n = el('strong', x.names.en); n.lang = 'en'; p.append(n); if (local(x.names)) p.append(document.createTextNode(' · ' + local(x.names))); const use = local(x.uses) || x.uses.en; if (use) p.append(el('br'), document.createTextNode(use)); result.append(p); }); };
        explain('أدوات ناقصة ما اخترتيها · Missed items', g.missed);
        explain('أدوات اخترتيها وهي مو من هذا الإجراء · Not part of this procedure', g.wrong);
        result.append(el('p', 'الدرجة = (الصح − الغلط) ÷ عدد أدوات الإجراء. تدريب فقط ولا يُحتسب كفاءة عملية.', 'small'));
        submit.hidden = true; skip.textContent = 'إجراء جديد · Next procedure';
        refreshStats();
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (e) { result.replaceChildren(el('p', e.message, 'notice')); submit.disabled = false; }
    };
  }
  card.onclick = round;
  card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); round(); } };
};
