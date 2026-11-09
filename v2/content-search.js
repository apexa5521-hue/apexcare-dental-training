'use strict';
// Content-bound search card ("ask the platform"): results come only from the NSE catalog and
// published lessons. Missing translations are labelled, never filled with invented text.
window.nseMountSearch = ({ host, request, el, center, language, openLesson }) => {
  if (!host) return;
  document.getElementById('nseSearch')?.remove();
  if (!document.getElementById('nseSearchStyle')) {
    const style = document.createElement('style');
    style.id = 'nseSearchStyle';
    style.textContent = `
#nseSearch form{display:flex;gap:8px;flex-wrap:wrap}
#nseSearch input[type=search]{flex:1 1 220px;min-width:0}
#nseSearch .hits{display:grid;gap:10px;margin-top:12px}
#nseSearch .hit{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;border:1px solid var(--nse-line,#e4eaf1);border-radius:14px;padding:12px}
#nseSearch .hit img{width:64px;height:64px;object-fit:cover;border-radius:10px;background:var(--nse-soft,#eaf7f3)}
#nseSearch .hit .noimg{width:64px;height:64px;border-radius:10px;background:var(--nse-soft,#eaf7f3);display:grid;place-items:center;font-size:1.4rem}
#nseSearch .hit h4{margin:0 0 4px}
#nseSearch .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
#nseSearch .missing{font-size:.75rem;color:var(--nse-muted,#637589)}
#nseSearch .group{font-weight:700;margin:14px 0 2px}
#nseSearch .notice:empty{display:none}`;
    document.head.append(style);
  }
  const L = { ar: { title: 'اسأل المنصة', hint: 'ابحث عن أداة أو إجراء أو خطوة مكافحة عدوى أو درس. النتائج من محتوى المنصة فقط.', go: 'بحث', tools: 'الأدوات والمستهلكات', procs: 'الإجراءات', ipc: 'مكافحة العدوى', lessons: 'الدروس', none: 'ما فيه نتائج في محتوى المنصة. جرّب كلمة ثانية أو اسم الأداة بالإنجليزي.', usedIn: 'يُستخدم في:', needs: 'يحتاج:', missing: 'الترجمة غير متوفرة — معروض بالإنجليزية', open: 'افتح الدرس', unresolved: 'عناصر بدون ربط موثق' },
    en: { title: 'Ask the platform', hint: 'Search an instrument, procedure, infection-prevention step or lesson. Results come only from NSE content.', go: 'Search', tools: 'Instruments & supplies', procs: 'Procedures', ipc: 'Infection prevention', lessons: 'Lessons', none: 'No results in NSE content. Try another word or the English instrument name.', usedIn: 'Used in:', needs: 'Needs:', missing: 'Translation not available — shown in English', open: 'Open lesson', unresolved: 'items without a verified link' } };
  const lang = () => language() || 'en', t = k => (L[lang()] || L.en)[k] || L.en[k];
  const text = names => { const l = lang(); return names[l] ? { value: names[l], fallback: false } : { value: names.en || names.ar || '', fallback: l !== 'en' }; };
  const label = names => { const r = text(names), span = el('span', r.value); if (r.fallback) { span.lang = 'en'; span.dir = 'ltr'; } return [span, r.fallback]; };

  const card = el('section', undefined, 'card section'); card.id = 'nseSearch';
  const head = el('h3', t('title')), hint = el('p', t('hint'), 'muted');
  const form = el('form'), input = el('input', undefined, 'input'), btn = el('button', t('go'), 'btn');
  input.type = 'search'; input.placeholder = 'مرآة · Mouth mirror · Five Moments'; input.setAttribute('aria-label', t('title')); input.maxLength = 80;
  form.append(input, btn);
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite');
  const hits = el('div', undefined, 'hits');
  card.append(head, hint, form, msg, hits);
  const anchor = host.querySelector('.hero');
  anchor ? anchor.after(card) : host.prepend(card);

  const row = (titleNodes, lines, img, extra) => {
    const box = el('article', undefined, 'hit');
    if (img) { const i = el('img'); i.src = img; i.loading = 'lazy'; i.alt = titleNodes[0].textContent; box.append(i); } else box.append(el('div', '•', 'noimg'));
    const body = el('div'), h = el('h4'); h.append(titleNodes[0]); body.append(h);
    if (titleNodes[1]) body.append(el('p', t('missing'), 'missing'));
    lines.filter(Boolean).forEach(x => body.append(typeof x === 'string' ? el('p', x, 'small') : x));
    if (extra) body.append(extra);
    box.append(body); return box;
  };
  const chips = (prefix, items) => { if (!items.length) return null; const w = el('div', undefined, 'chips'); w.append(el('span', prefix, 'small')); items.forEach(n => w.append(el('span', text(n).value, 'pill'))); return w; };

  let ticket = 0;
  form.onsubmit = async e => {
    e.preventDefault();
    const q = input.value.trim(); if (q.length < 2) return;
    const mine = ++ticket; btn.disabled = true; msg.textContent = ''; hits.replaceChildren();
    try {
      const r = await request('/api/search?centerId=' + encodeURIComponent(center()) + '&q=' + encodeURIComponent(q));
      if (mine !== ticket) return;
      const add = (name, list, render) => { if (!list.length) return; hits.append(el('p', t(name), 'group')); list.forEach(x => hits.append(render(x))); };
      add('tools', r.tools, x => row(label(x.names), [text(x.uses).value], x.imageUrl, chips(t('usedIn'), x.procedures.map(p => p.names))));
      add('procs', r.procedures, x => row(label(x.names), [x.unresolvedItems ? x.unresolvedItems + ' ' + t('unresolved') : ''], null, chips(t('needs'), x.tools.map(i => i.names))));
      add('ipc', r.infectionPrevention, x => { const ol = el('ol'); x.steps.forEach(s => ol.append(el('li', text(s).value))); return row(label(x.names), [], null, ol); });
      add('lessons', r.lessons, x => { const b = el('button', t('open'), 'btn sub'); b.type = 'button'; b.onclick = () => openLesson(x.id); return row(label(x.titles), [x.snippet], null, b); });
      if (!hits.children.length) msg.textContent = t('none');
    } catch (err) { if (mine === ticket) msg.textContent = err.message; } finally { if (mine === ticket) btn.disabled = false; }
  };
};
