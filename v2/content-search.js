'use strict';
// Content-bound search card ("ask the platform"): results come only from the NSE catalog and
// published lessons. Missing translations are labelled, never filled with invented text.
window.nseMountSearch = ({ host, request, el, center, language, openLesson, displayName = () => '' }) => {
  if (!host) return;
  window.nseUnmountLucy?.();
  document.getElementById('nseSearch')?.remove();
  if (!document.getElementById('nseSearchStyle')) {
    const style = document.createElement('style');
    style.id = 'nseSearchStyle';
    style.textContent = `
#nseLucyWidget{position:fixed;inset-inline-end:22px;bottom:22px;z-index:100;display:flex;flex-direction:column;align-items:flex-end;gap:12px;max-width:calc(100vw - 24px);color:var(--nse-ink)}
#nseLucyWidget[hidden],#nseLucyWidget #nseSearch[hidden],body:has(#login:not([hidden])) #nseLucyWidget{display:none!important}
#nseLucyWidget .lucy-launcher{display:flex;align-items:center;gap:12px;padding:6px 10px;min-height:56px;border:1px solid var(--nse-line);border-radius:999px;background:var(--nse-surface);color:var(--nse-ink);box-shadow:0 6px 22px #142b4b30;text-align:start}
#nseLucyWidget .lucy-portrait{position:relative;width:48px;height:48px;flex:none;border:2px solid var(--nse-green);border-radius:50%}
#nseLucyWidget .lucy-portrait::after{content:"";position:absolute;inset:-5px;border:2px solid var(--nse-bright);border-radius:50%;pointer-events:none}
#nseLucyWidget .lucy-portrait img{width:100%;height:100%;object-fit:cover;object-position:center 30%;border-radius:50%;display:block}
#nseLucyWidget .lucy-launcher-label{display:grid;gap:2px;line-height:1.25;font-size:13px}
#nseLucyWidget .lucy-launcher-status{color:var(--nse-muted);font-size:12px}
#nseLucyWidget .lucy-launcher-status::before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--nse-green);margin-inline-end:5px}
@media(prefers-reduced-motion:no-preference){#nseLucyWidget .lucy-portrait::after{animation:lucy-ring 2.6s ease-out 3}@keyframes lucy-ring{0%{transform:scale(.92);opacity:.9}80%,100%{transform:scale(1.18);opacity:.25}}}
#nseLucyWidget #nseSearch{width:420px;max-width:calc(100vw - 24px);height:min(610px,calc(100dvh - 112px));display:flex;flex-direction:column;padding:0!important;margin:0!important;background:var(--nse-surface);border:1px solid var(--nse-line);border-radius:22px!important;box-shadow:0 14px 50px #10243f30;overflow:hidden}
#nseLucyWidget .lucy-header{display:flex;align-items:center;gap:10px;padding:14px;background:var(--nse-surface);border-bottom:1px solid var(--nse-line);flex-wrap:wrap}
#nseLucyWidget .lucy-avatar{width:44px;height:44px;border-radius:50%;object-fit:cover;object-position:center 30%}
#nseLucyWidget .lucy-header h3{font-size:15px;margin:0;line-height:1.5}
#nseLucyWidget .lucy-header p{margin:0;font-size:12px;color:var(--nse-muted)}
#nseLucyWidget .lucy-language{width:92px;min-height:44px;margin-inline-start:auto;font-size:14px}
#nseLucyWidget .lucy-window-control{width:44px;min-height:44px;padding:0;font-size:20px;background:var(--nse-surface);color:var(--nse-ink);border:1px solid var(--nse-line);border-radius:12px}
#nseLucyWidget .lucy-log{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--nse-bg)}
#nseLucyWidget .lucy-message{align-self:flex-start;background:var(--nse-soft);padding:12px;border-radius:16px 4px 16px 16px;max-width:96%;overflow-wrap:anywhere}
#nseLucyWidget .lucy-question{align-self:flex-end;border:1px solid var(--nse-line);background:var(--nse-surface);padding:10px 14px;border-radius:4px 16px 16px 16px;max-width:88%;overflow-wrap:anywhere}
#nseLucyWidget .lucy-prompts{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px}
#nseLucyWidget .lucy-prompts button{font-size:12px;min-height:44px;padding:6px 10px}
#nseLucyWidget form{display:flex;flex-wrap:nowrap;gap:8px;padding:10px 12px;border-top:1px solid var(--nse-line)}
#nseLucyWidget input[type=search]{min-width:0;flex:1;font-size:16px;min-height:44px}
#nseLucyWidget form button{min-height:44px;padding:8px 14px}
#nseLucyWidget .lucy-source,#nseLucyWidget .notice{font-size:12px;color:var(--nse-muted);margin:0;padding:6px 12px}
#nseLucyWidget .notice:empty{display:none}
#nseLucyWidget .hits{display:grid;gap:10px;margin:0}
#nseLucyWidget .hit{display:block;border:0;border-top:1px solid var(--nse-line);padding:10px 0;background:transparent}
#nseLucyWidget .hit img,#nseLucyWidget .noimg{width:66px;height:66px;object-fit:contain;float:inline-start;margin-inline-end:10px;border-radius:8px}
#nseLucyWidget .noimg{display:none}
#nseLucyWidget .hit h4{font-size:14px;margin:0 0 6px}
#nseLucyWidget .hit p,#nseLucyWidget .hit li{font-size:13px;line-height:1.7;white-space:pre-wrap}
#nseLucyWidget .group{font-size:13px;font-weight:600;margin:4px 0}
#nseLucyWidget .chips{display:flex;gap:5px;flex-wrap:wrap}
#nseLucyWidget :focus-visible{outline:3px solid var(--nse-bright);outline-offset:3px}
@media(max-width:760px){#nseLucyWidget{bottom:calc(88px + env(safe-area-inset-bottom));inset-inline-end:12px}#nseLucyWidget #nseSearch{height:min(560px,calc(100dvh - 180px))}#nseLucyWidget .lucy-portrait{width:42px;height:42px}}
@media(prefers-reduced-motion:no-preference){#nseLucyWidget #nseSearch{animation:lucy-open .18s ease-out}@keyframes lucy-open{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}}`;
    document.head.append(style);
  }
  const L = { ar: { title: 'Nurse Lucy · اسألي لوسي', hint: 'ابحث عن أداة أو إجراء أو خطوة مكافحة عدوى أو درس. النتائج من محتوى المنصة فقط.', go: 'بحث', tools: 'الأدوات والمستهلكات', procs: 'الإجراءات', ipc: 'مكافحة العدوى', lessons: 'الدروس', none: 'ما فيه نتائج في محتوى المنصة. جرّب كلمة ثانية أو اسم الأداة بالإنجليزي.', usedIn: 'يُستخدم في:', needs: 'يحتاج:', missing: 'الترجمة غير متوفرة — معروض بالإنجليزية', open: 'افتح الدرس', unresolved: 'عناصر بدون ربط موثق' },
    en: { title: 'Nurse Lucy · Ask Lucy', hint: 'Search an instrument, procedure, infection-prevention step or lesson. Results come only from NSE content.', go: 'Search', tools: 'Instruments & supplies', procs: 'Procedures', ipc: 'Infection prevention', lessons: 'Lessons', none: 'No results in NSE content. Try another word or the English instrument name.', usedIn: 'Used in:', needs: 'Needs:', missing: 'Translation not available — shown in English', open: 'Open lesson', unresolved: 'items without a verified link' } };
  let chosenLanguage = null;
  const lang = () => chosenLanguage || language() || 'en', t = k => (L[lang()] || L.en)[k] || L.en[k];
  const text = names => { const l = lang(); return names[l] ? { value: names[l], fallback: false } : { value: names.en || names.ar || '', fallback: l !== 'en' }; };
  const label = names => { const r = text(names), span = el('span', r.value); if (r.fallback) { span.lang = 'en'; span.dir = 'ltr'; } return [span, r.fallback]; };

  const widget=el('div');widget.id='nseLucyWidget';
  const card = el('section'); card.id = 'nseSearch';card.hidden=true;card.dataset.lucyPortal='true';card.setAttribute('role','dialog');card.setAttribute('aria-labelledby','nseLucyTitle');
  const launcher=el('button',undefined,'lucy-launcher');launcher.type='button';launcher.setAttribute('aria-controls','nseSearch');launcher.setAttribute('aria-expanded','false');
  const launcherImage=el('img');launcherImage.src='/assets/nurse-lucy.jpg';launcherImage.alt='';
  const portrait=el('span',undefined,'lucy-portrait');portrait.append(launcherImage);
  const launcherLabel=el('span',undefined,'lucy-launcher-label');
  const launcherName=el('strong'),launcherStatus=el('span',undefined,'lucy-launcher-status');
  launcherLabel.append(launcherName,launcherStatus);launcher.append(portrait,launcherLabel);
  const close=el('button','×','lucy-window-control');close.type='button';
  const minimize=el('button','−','lucy-window-control');minimize.type='button';
  const setOpen = open => {card.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open){input.focus();log.scrollTop=log.scrollHeight}else launcher.focus()};
  launcher.onclick=()=>{if(form.dataset.assessmentLocked!=='true')setOpen(card.hidden)};close.onclick=minimize.onclick=()=>setOpen(false);
  const head = el('h3', t('title')), hint = el('p', t('hint'), 'muted');
  const form = el('form'), input = el('input', undefined, 'input'), btn = el('button', t('go'), 'btn');
  head.id='nseLucyTitle';
  input.type = 'search'; input.placeholder = 'مرآة · Mouth mirror · Five Moments'; input.setAttribute('aria-label', t('title')); input.maxLength = 80;
  form.append(input, btn);
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite');
  const log = el('div', undefined, 'lucy-log'); log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  const greeting = el('div', undefined, 'lucy-message'); log.append(greeting);
  let hits = el('div', undefined, 'hits');
  const header = el('div', undefined, 'lucy-header'), avatar = el('img');
  avatar.src = '/assets/nurse-lucy.jpg'; avatar.alt = 'Nurse Lucy'; avatar.className = 'lucy-avatar';
  const intro = el('div'), presence = el('p', '', 'lucy-online'); intro.append(head, presence); header.append(avatar, intro);
  const picker = el('select', undefined, 'input lucy-language');
  [['ar','العربية'],['en','English']].forEach(([value,name]) => {const o=el('option',name);o.value=value;picker.append(o)});
  header.append(picker,minimize,close);
  const prompts = el('div', undefined, 'lucy-prompts');
  const renderPrompts = () => {
    prompts.replaceChildren();
    const examples = lang() === 'ar' ? ['مرآة', 'Five Moments', 'رحلة المريض'] : ['Mouth mirror', 'Five Moments', 'Patient journey'];
    examples.forEach(q => { const b = el('button', q, 'btn sub'); b.type = 'button'; b.disabled = form.dataset.assessmentLocked === 'true'; b.onclick = () => { input.value = q; form.requestSubmit(); }; prompts.append(b); });
  };
  const boundary = el('p', lang() === 'ar' ? 'بحث في محتوى NSE فقط · غير متاحة أثناء الاختبار أو انتظار مراجعة المحاولة' : 'NSE content search only · Unavailable during assessments or attempt review', 'lucy-source');
  card.append(header, log, prompts, form, msg, boundary);
  const refreshLanguage = () => {
    widget.dir=lang()==='ar'?'rtl':'ltr';
    card.lang = lang(); card.dir = lang() === 'ar' ? 'rtl' : 'ltr'; picker.value = lang();
    picker.setAttribute('aria-label', lang() === 'ar' ? 'لغة المحادثة' : 'Conversation language');
    launcherName.textContent=lang()==='ar'?'لوسي · مساعد التمريض':'Lucy · Nursing assistant';
    launcherStatus.textContent=lang()==='ar'?'متصلة':'Online';
    head.textContent = 'Nurse Lucy';launcher.setAttribute('aria-label',lang()==='ar'?'افتحي محادثة لوسي':'Open Nurse Lucy chat');close.setAttribute('aria-label',lang()==='ar'?'إغلاق المحادثة':'Close chat');minimize.setAttribute('aria-label',lang()==='ar'?'تصغير المحادثة':'Minimize chat'); hint.textContent = t('hint'); btn.textContent = lang() === 'ar' ? 'إرسال' : 'Send';
    input.placeholder = lang() === 'ar' ? 'اكتبي اسم أداة أو إجراء…' : 'Type an instrument or procedure…'; input.setAttribute('aria-label',t('title'));
    presence.textContent = lang() === 'ar' ? 'متصلة · مساعدة تعليمية' : 'Online · Learning assistant';
    const name=String(displayName()||'').trim().slice(0,80);
    greeting.textContent = lang() === 'ar' ? 'هلا'+(name?' '+name:'')+'، أنا لوسي 👋 وش ودك نتعلم اليوم؟ اكتبي سؤالك عن أداة أو إجراء أو مكافحة العدوى.' : 'Hello'+(name?' '+name:'')+', I’m Lucy 👋 What would you like to learn today? Ask about an instrument, procedure or infection prevention.';
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
  widget.append(card,launcher);document.body.append(widget);

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
    log.replaceChildren();widget.hidden=true;launcher.disabled=true;close.disabled=minimize.disabled=true;
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
    const mine = ++ticket; picker.disabled = true; btn.disabled = true; card.setAttribute('aria-busy', 'true'); presence.textContent=lang()==='ar'?'تكتب…':'Typing…'; msg.textContent = lang() === 'ar' ? 'لوسي تبحث في محتوى المنصة…' : 'Lucy is searching NSE content…'; hits.replaceChildren();
    try {
      const r = await request('/api/search?centerId=' + encodeURIComponent(center()) + '&q=' + encodeURIComponent(q));
      if (mine !== ticket) return;
      msg.textContent = '';
      if(r.clarification==='surgery'){
        hits.textContent=lang()==='ar'
          ? 'أي إجراء جراحي تقصدين؟ اكتبي اسمه مثل خلع ضرس العقل أو زراعة الأسنان عشان أبحث لك عن الإجراء وأدواته.'
          : 'Which surgical procedure do you mean? Enter its name, such as wisdom tooth extraction or dental implant placement, so I can look up the procedure and its instruments.';
        return;
      }
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
    } finally { if (mine === ticket) { picker.disabled = false; presence.textContent=lang()==='ar'?'متصلة · مساعدة تعليمية':'Online · Learning assistant'; log.scrollTop=log.scrollHeight; btn.disabled = form.dataset.assessmentLocked === 'true'; card.setAttribute('aria-busy', 'false'); } }
  };
  const escape = e => {if(e.key==='Escape'&&!card.hidden){e.preventDefault();setOpen(false)}};
  document.addEventListener('keydown',escape);
  window.nseUnmountLucy = () => {++ticket;window.nseLucyLanguageCleanup?.();document.removeEventListener('keydown',escape);widget.remove();window.nseLockLucy=undefined;};
};
