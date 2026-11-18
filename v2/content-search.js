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
#nseSearch .lucy-log{display:flex;flex-direction:column;gap:14px;margin-block:18px}
#nseSearch .lucy-message{padding:14px 16px;border-radius:18px 4px 18px 18px;background:var(--nse-soft);max-width:94%;align-self:flex-start;overflow-wrap:anywhere}
#nseSearch .lucy-question{align-self:flex-end;border-radius:4px 18px 18px 18px;border:1px solid var(--nse-line);padding:12px 16px;max-width:90%;white-space:pre-wrap}
#nseSearch .lucy-language{margin-inline-start:auto;min-height:44px;max-width:100%;font:inherit}
#nseSearch .lucy-online{font-size:.85rem;color:var(--nse-muted)}
#nseSearch .lucy-header{display:flex;align-items:center;gap:18px;margin-bottom:18px}
#nseSearch .lucy-avatar{width:100px;height:110px;object-fit:cover;object-position:center;border-radius:24px;flex-shrink:0}
#nseSearch .lucy-header h3{margin:0 0 8px}
#nseSearch .lucy-header p{margin:0;max-width:58ch}
#nseSearch .lucy-prompts{display:flex;flex-wrap:wrap;gap:8px;margin-block:14px}
#nseSearch button,#nseSearch input{min-height:44px}
#nseSearch .hit>div{min-width:0;overflow-wrap:anywhere}
#nseSearch .lucy-source{color:var(--nse-muted,#637589);font-size:.85rem;margin-top:10px}
#nseSearch[aria-busy=true] .notice:before{content:'•••';display:inline-block;letter-spacing:3px;margin-inline-end:8px}
@media(max-width:480px){#nseSearch .lucy-avatar{width:72px;height:88px}#nseSearch input{font-size:16px}#nseSearch .lucy-log{display:flex;flex-direction:column;gap:14px;margin-block:18px}
#nseSearch .lucy-message{padding:14px 16px;border-radius:18px 4px 18px 18px;background:var(--nse-soft);max-width:94%;align-self:flex-start;overflow-wrap:anywhere}
#nseSearch .lucy-question{align-self:flex-end;border-radius:4px 18px 18px 18px;border:1px solid var(--nse-line);padding:12px 16px;max-width:90%;white-space:pre-wrap}
#nseSearch .lucy-language{margin-inline-start:auto;min-height:44px;max-width:100%;font:inherit}
#nseSearch .lucy-online{font-size:.85rem;color:var(--nse-muted)}
#nseSearch .lucy-header{gap:12px}}
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
  const L = { ar: { title: 'Nurse Lucy · اسألي لوسي', hint: 'ابحث عن أداة أو إجراء أو خطوة مكافحة عدوى أو درس. النتائج من محتوى المنصة فقط.', go: 'بحث', tools: 'الأدوات والمستهلكات', procs: 'الإجراءات', ipc: 'مكافحة العدوى', lessons: 'الدروس', none: 'ما فيه نتائج في محتوى المنصة. جرّب كلمة ثانية أو اسم الأداة بالإنجليزي.', usedIn: 'يُستخدم في:', needs: 'يحتاج:', missing: 'الترجمة غير متوفرة — معروض بالإنجليزية', open: 'افتح الدرس', unresolved: 'عناصر بدون ربط موثق' },
    en: { title: 'Nurse Lucy · Ask Lucy', hint: 'Search an instrument, procedure, infection-prevention step or lesson. Results come only from NSE content.', go: 'Search', tools: 'Instruments & supplies', procs: 'Procedures', ipc: 'Infection prevention', lessons: 'Lessons', none: 'No results in NSE content. Try another word or the English instrument name.', usedIn: 'Used in:', needs: 'Needs:', missing: 'Translation not available — shown in English', open: 'Open lesson', unresolved: 'items without a verified link' } };
  let chosenLanguage = null;
  const lang = () => chosenLanguage || language() || 'en', t = k => (L[lang()] || L.en)[k] || L.en[k];
  const text = names => { const l = lang(); return names[l] ? { value: names[l], fallback: false } : { value: names.en || names.ar || '', fallback: l !== 'en' }; };
  const label = names => { const r = text(names), span = el('span', r.value); if (r.fallback) { span.lang = 'en'; span.dir = 'ltr'; } return [span, r.fallback]; };

  const card = el('section', undefined, 'card section'); card.id = 'nseSearch';
  const head = el('h3', t('title')), hint = el('p', t('hint'), 'muted');
  const form = el('form'), input = el('input', undefined, 'input'), btn = el('button', t('go'), 'btn');
  input.type = 'search'; input.placeholder = 'مرآة · Mouth mirror · Five Moments'; input.setAttribute('aria-label', t('title')); input.maxLength = 80;
  form.append(input, btn);
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite');
  const log = el('div', undefined, 'lucy-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  const greeting = el('div', undefined, 'lucy-message'); log.append(greeting);
  let hits = el('div', undefined, 'hits');
  const header = el('div', undefined, 'lucy-header'), avatar = el('img');
  avatar.src = 'assets/nurse-lucy.jpg'; avatar.alt = 'Nurse Lucy'; avatar.className = 'lucy-avatar';
  const intro = el('div'), presence = el('p', '', 'lucy-online'); intro.append(head, presence); header.append(avatar, intro);
  const picker = el('select', undefined, 'input lucy-language');
  [['ar','العربية'],['en','English']].forEach(([value,name]) => {const o=el('option',name);o.value=value;picker.append(o)});
  header.append(picker);
  const prompts = el('div', undefined, 'lucy-prompts');
  const renderPrompts = () => {
    prompts.replaceChildren();
    const examples = lang() === 'ar' ? ['مرآة', 'Five Moments', 'رحلة المريض'] : ['Mouth mirror', 'Five Moments', 'Patient journey'];
    examples.forEach(q => { const b = el('button', q, 'btn sub'); b.type = 'button'; b.disabled = form.dataset.assessmentLocked === 'true'; b.onclick = () => { input.value = q; form.requestSubmit(); }; prompts.append(b); });
  };
  const boundary = el('p', lang() === 'ar' ? 'بحث في محتوى NSE فقط · غير متاحة أثناء الاختبار أو انتظار مراجعة المحاولة' : 'NSE content search only · Unavailable during assessments or attempt review', 'lucy-source');
  card.append(header, log, prompts, form, msg, boundary);
  const refreshLanguage = () => {
    card.lang = lang(); card.dir = lang() === 'ar' ? 'rtl' : 'ltr'; picker.value = lang();
    picker.setAttribute('aria-label', lang() === 'ar' ? 'لغة المحادثة' : 'Conversation language');
    head.textContent = t('title'); hint.textContent = t('hint'); btn.textContent = lang() === 'ar' ? 'إرسال' : 'Send';
    input.placeholder = lang() === 'ar' ? 'اكتبي اسم أداة أو إجراء…' : 'Type an instrument or procedure…'; input.setAttribute('aria-label',t('title'));
    presence.textContent = lang() === 'ar' ? 'متصلة · مساعدة تعليمية' : 'Online · Learning assistant';
    greeting.textContent = lang() === 'ar' ? 'هلا فيك، أنا لوسي. وش تخصصك وأي إجراء أو أداة ودك نراجعها اليوم؟' : "Hello, I’m Lucy. What is your specialty, and which procedure or instrument would you like to review today?";
    boundary.textContent = lang() === 'ar' ? 'من محتوى NSE فقط · غير متاحة أثناء الاختبارات أو مراجعة المحاولة' : 'NSE content only · Unavailable during assessments or attempt review';
    renderPrompts();
    if (form.dataset.assessmentLocked === 'true' && window.nseLockLucy) window.nseLockLucy();
  };
  picker.onchange = () => { chosenLanguage = picker.value; refreshLanguage(); };
  const pageLanguage = document.getElementById('language');
  if (window.nseLucyLanguageCleanup) window.nseLucyLanguageCleanup();
  const followPage = () => { chosenLanguage = null; refreshLanguage(); };
  pageLanguage?.addEventListener('change', followPage);
  window.nseLucyLanguageCleanup = () => pageLanguage?.removeEventListener('change', followPage);
  refreshLanguage();
  const anchor = host.querySelector('.hero');
  anchor ? anchor.after(card) : host.prepend(card);

  const row = (titleNodes, lines, img, extra, sourceId) => {
    const box = el('article', undefined, 'hit');
    if (img) { const i = el('img'); i.src = img; i.loading = 'lazy'; i.alt = titleNodes[0].textContent; box.append(i); } else box.append(el('div', '•', 'noimg'));
    const body = el('div'), h = el('h4'); h.append(titleNodes[0]); body.append(h);
    if (titleNodes[1]) body.append(el('p', t('missing'), 'missing'));
    lines.filter(Boolean).forEach(x => body.append(typeof x === 'string' ? el('p', x, 'small') : x));
    if (extra) body.append(extra);
    body.append(el('p', (lang() === 'ar' ? 'المصدر: محتوى NSE · معرّف السجل: ' : 'Source: NSE content · record ID: ') + String(sourceId || '—'), 'lucy-source'));
    box.append(body); return box;
  };
  const chips = (prefix, items) => { if (!items.length) return null; const w = el('div', undefined, 'chips'); w.append(el('span', prefix, 'small')); items.forEach(n => w.append(el('span', text(n).value, 'pill'))); return w; };

  let ticket = 0;
  window.nseLockLucy = () => {
    ++ticket;
    log.replaceChildren();
    form.dataset.assessmentLocked = 'true';
    input.disabled = true; btn.disabled = true;
    prompts.querySelectorAll('button').forEach(b => b.disabled = true);
    picker.disabled = false;
    card.setAttribute('aria-busy', 'false');
    presence.textContent = lang() === 'ar' ? 'متوقفة أثناء التقييم' : 'Unavailable during assessment';
    msg.textContent = lang() === 'ar' ? 'لوسي غير متاحة أثناء الاختبار أو انتظار مراجعة المحاولة.' : 'Lucy is unavailable during assessments or attempt review.';
  };
  form.onsubmit = async e => {
    e.preventDefault();
    const q = input.value.trim(); if (q.length < 2 || btn.disabled || form.dataset.assessmentLocked === 'true') return;
    const question = el('div',q,'lucy-question');question.dir='auto';log.append(question);
    hits = el('div',undefined,'hits lucy-message');hits.lang=lang();hits.dir=card.dir;log.append(hits);input.value='';
    const mine = ++ticket; picker.disabled = true; btn.disabled = true; card.setAttribute('aria-busy', 'true'); msg.textContent = lang() === 'ar' ? 'لوسي تبحث في محتوى المنصة…' : 'Lucy is searching NSE content…'; hits.replaceChildren();
    try {
      const r = await request('/api/search?centerId=' + encodeURIComponent(center()) + '&q=' + encodeURIComponent(q));
      if (mine !== ticket) return;
      msg.textContent = '';
      const add = (name, list, render) => { if (!list.length) return; hits.append(el('p', t(name), 'group')); list.forEach(x => hits.append(render(x))); };
      add('tools', r.tools, x => row(label(x.names), [text(x.uses).value], x.imageUrl, chips(t('usedIn'), x.procedures.map(p => p.names)), x.id));
      add('procs', r.procedures, x => row(label(x.names), [x.unresolvedItems ? x.unresolvedItems + ' ' + t('unresolved') : ''], null, chips(t('needs'), x.tools.map(i => i.names)), x.id));
      add('ipc', r.infectionPrevention, x => { const ol = el('ol'); x.steps.forEach(s => ol.append(el('li', text(s).value))); return row(label(x.names), [], null, ol, x.id); });
      add('lessons', r.lessons, x => { const b = el('button', t('open'), 'btn sub'); b.type = 'button'; b.onclick = () => openLesson(x.id); return row(label(x.titles), [x.snippet], null, b, x.id); });
      if (!hits.children.length) { msg.textContent = t('none'); hits.textContent = t('none'); }
    } catch (err) {
      if (mine === ticket) {
        const locked = String(err.message).includes('NURSE_LUCY_UNAVAILABLE_DURING_ASSESSMENT');
        msg.textContent = locked ? (lang() === 'ar' ? 'لوسي غير متاحة أثناء الاختبار أو انتظار مراجعة المحاولة. أكملي إجراءات المحاولة أولاً.' : 'Lucy is unavailable during an assessment or while an attempt awaits review.') : (lang() === 'ar' ? 'تعذر الوصول إلى المحتوى. حاولي مرة أخرى.' : 'Content could not be loaded. Please try again.');
        if (locked) window.nseLockLucy();
      }
    } finally { if (mine === ticket) { picker.disabled = false; btn.disabled = form.dataset.assessmentLocked === 'true'; card.setAttribute('aria-busy', 'false'); } }
  };
};
