'use strict';
// Home cards: Today's Drill (3 quick English questions, instant feedback, daily streak)
// and Item of the Day (one catalog instrument with image, purpose and procedures).
window.nseMountDaily = ({ host, request, post, el, center, language }) => {
  if (!host) return;
  ['nseDrillCard', 'nseItemCard'].forEach(id => document.getElementById(id)?.remove());
  if (!document.getElementById('nseDailyStyle')) {
    const s = document.createElement('style'); s.id = 'nseDailyStyle';
    s.textContent = `
.nse-home-row{display:flex;align-items:center;gap:14px;cursor:pointer}
.nse-home-row .icon{width:42px;height:42px;flex:0 0 42px;display:grid;place-items:center;background:var(--nse-soft,#eaf7f3);border-radius:13px;font-size:22px}
.nse-home-row .grow{flex:1;min-width:0}
.nse-home-row h3{margin:0 0 2px}
.nse-home-row .dots{display:flex;gap:5px}
.nse-home-row .dots i{width:10px;height:10px;border-radius:50%;background:var(--nse-line,#e4eaf1)}
.nse-home-row .dots i.on{background:var(--nse-green,#127b69)}
#nseItemCard{display:flex;gap:16px;align-items:center}
#nseItemCard img,#nseItemCard .ph{width:96px;height:96px;flex:0 0 96px;border-radius:14px;object-fit:cover;background:var(--nse-soft,#eaf7f3);cursor:zoom-in}
#nseItemCard .ph{display:grid;place-items:center;font-size:34px;cursor:default}
#nseItemCard .grow{min-width:0}
#nseItemCard h3{margin:2px 0 4px}
#nseItemCard .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.nse-drill .opts{display:grid;gap:10px;margin:16px 0}
.nse-drill .opt{text-align:start;padding:14px 16px;border:2px solid var(--nse-line,#e4eaf1);border-radius:14px;background:var(--nse-surface,#fff);color:var(--nse-ink,#182b3b);font:inherit;font-size:15px;cursor:pointer;min-height:48px}
.nse-drill .opt:hover:not(:disabled){border-color:var(--nse-green,#127b69)}
.nse-drill .opt.ok{border-color:#1f9d6b;background:color-mix(in srgb,#1f9d6b 12%,var(--nse-surface,#fff))}
.nse-drill .opt.bad{border-color:#d64545;background:color-mix(in srgb,#d64545 12%,var(--nse-surface,#fff))}
.nse-drill .bar{height:8px;border-radius:99px;background:var(--nse-line,#e4eaf1);overflow:hidden;margin:10px 0 4px}
.nse-drill .bar i{display:block;height:100%;background:var(--nse-green,#127b69);transition:width .3s}
.nse-drill .fb{padding:12px 14px;border-radius:12px;margin:8px 0}
.nse-drill .fb.ok{background:color-mix(in srgb,#1f9d6b 12%,transparent)}
.nse-drill .fb.bad{background:color-mix(in srgb,#d64545 12%,transparent)}
.nse-drill .big{font-size:40px;text-align:center;margin:10px 0}
@media(max-width:480px){#nseItemCard img,#nseItemCard .ph{width:72px;height:72px;flex-basis:72px}}`;
    document.head.append(s);
  }
  const lang = () => language() || 'en', ar = () => lang() === 'ar';
  const local = n => (lang() !== 'en' && n[lang()]) ? n[lang()] : '';
  const q = () => '?centerId=' + encodeURIComponent(center());
  const enSpan = (text, cls) => { const s = el('span', text, cls); s.lang = 'en'; s.dir = 'ltr'; return s; };

  // ---- Today's Drill card
  const drillCard = el('section', undefined, 'card section nse-home-row'); drillCard.id = 'nseDrillCard'; drillCard.tabIndex = 0; drillCard.setAttribute('role', 'button');
  const drillText = el('p', ar() ? '3 أسئلة سريعة لمراجعة الأدوات' : '3 quick questions to review instruments', 'small');
  const dots = el('span', undefined, 'dots');
  const g1 = el('div', undefined, 'grow'); g1.append(el('h3', ar() ? 'تدريب اليوم' : "Today's Drill"), drillText);
  drillCard.append(el('span', '🎯', 'icon'), g1, dots);
  const paintDots = (answers = [], size = 3) => { dots.replaceChildren(...Array.from({ length: size }, (_, i) => el('i', undefined, i < answers.length ? 'on' : ''))); };
  paintDots();

  // ---- Item of the Day card
  const itemCard = el('section', undefined, 'card section'); itemCard.id = 'nseItemCard'; itemCard.hidden = true;

  const anchor = host.querySelector('.hero');
  if (anchor) { anchor.after(drillCard); drillCard.after(itemCard); } else host.prepend(drillCard, itemCard);

  const refreshDrill = () => request('/api/daily/drill' + q()).then(r => {
    const d = r.drill, done = d?.completed, score = d ? d.answers.filter(a => a.correct).length : 0;
    paintDots(d?.answers || [], r.size);
    const st = r.streak ? (ar() ? ' · 🔥 ' + r.streak + ' يوم متتالي' : ' · 🔥 ' + r.streak + '-day streak') : '';
    drillText.textContent = done ? (ar() ? 'خلّصتِ تدريب اليوم: ' + score + ' من ' + r.size : "Today's drill done: " + score + '/' + r.size) + st
      : d ? (ar() ? 'كمّلي من حيث وقفتِ' : 'Continue where you left off') + st
      : (ar() ? '3 أسئلة سريعة لمراجعة الأدوات' : '3 quick questions to review instruments') + st;
  }).catch(() => {});
  refreshDrill();

  request('/api/daily/item' + q()).then(r => {
    const it = r.item; if (!it) return;
    const media = it.imageUrl ? Object.assign(el('img'), { src: it.imageUrl, alt: it.names.en, loading: 'lazy' }) : el('span', '🦷', 'ph');
    const g = el('div', undefined, 'grow');
    g.append(el('span', ar() ? '☀️ أداة اليوم' : '☀️ ITEM OF THE DAY', 'over'));
    const h = el('h3'); h.append(enSpan(it.names.en)); g.append(h);
    if (local(it.names)) g.append(el('p', local(it.names), 'muted'));
    const use = local(it.uses) || it.uses.en; if (use) g.append(el('p', use, 'small'));
    if (lang() !== 'en' && !it.uses[lang()]) g.append(el('p', ar() ? 'الشرح معروض بالإنجليزية لعدم توفر الترجمة' : 'Shown in English — translation not available', 'small'));
    if (it.procedures.length) { const c = el('div', undefined, 'chips'); it.procedures.forEach(p => c.append(el('span', local(p.names) || p.names.en, 'pill'))); g.append(c); }
    itemCard.replaceChildren(media, g); itemCard.hidden = false;
    if (it.imageUrl) media.onclick = () => { const m = document.getElementById('modal'), b = document.getElementById('modalBody'); const big = Object.assign(el('img'), { src: it.imageUrl, alt: it.names.en }); big.style.cssText = 'max-width:100%;max-height:70vh;border-radius:16px'; b.replaceChildren(el('h2', it.names.en), big); m.showModal(); };
  }).catch(() => {});

  // ---- Drill dialog
  const modal = document.getElementById('modal'), body = document.getElementById('modalBody');
  async function openDrill() {
    body.replaceChildren(el('p', '…', 'small')); if (!modal.open) modal.showModal();
    let d;
    try { d = await post('/api/daily/drill/start', {}); }
    catch (e) { body.replaceChildren(el('p', e.message === 'NO_ASSIGNED_SPECIALTY' ? 'لا يوجد تخصص مسند لك بعد.' : e.message === 'NOT_ENOUGH_CATALOG_CONTENT' ? 'محتوى الكتالوج لتخصصك لا يكفي لتدريب اليوم بعد.' : e.message, 'notice')); return; }
    let score = d.answers.filter(a => a.correct).length;
    const show = i => {
      const box = el('div', undefined, 'nse-drill');
      box.append(el('span', ar() ? 'تدريب غير مقيّم · Practice only' : 'Practice only — not an official assessment', 'pill'));
      if (i >= d.questions.length) {
        box.append(el('div', score === d.questions.length ? '🎉' : score ? '👏' : '💪', 'big'), el('h2', (ar() ? 'النتيجة ' : 'Score ') + score + ' / ' + d.questions.length),
          el('p', ar() ? 'رجعي بكرة لتدريب جديد وحافظي على سلسلة الأيام.' : 'Come back tomorrow for a new drill and keep your streak.', 'muted'));
        const close = el('button', ar() ? 'تم' : 'Done', 'btn'); close.onclick = () => modal.close(); box.append(close);
        body.replaceChildren(box); refreshDrill(); return;
      }
      const qn = d.questions[i], bar = el('div', undefined, 'bar'), fill = el('i'); fill.style.width = (100 * i / d.questions.length) + '%'; bar.append(fill);
      box.append(bar, el('p', (i + 1) + ' / ' + d.questions.length, 'small'));
      const h = el('h2'); h.append(enSpan(qn.prompt_en)); h.style.fontSize = '19px'; box.append(h);
      const opts = el('div', undefined, 'opts'), fb = el('div');
      qn.options_en.forEach((o, k) => {
        const b = el('button', undefined, 'opt'); b.type = 'button'; b.append(enSpan(o));
        b.onclick = async () => {
          opts.querySelectorAll('button').forEach(x => { x.disabled = true; });
          try {
            const r = await post('/api/daily/drill/answer', { drillId: d.drillId, index: i, choice: k });
            if (r.correct) score++;
            b.classList.add(r.correct ? 'ok' : 'bad'); opts.children[r.correctIndex].classList.add('ok');
            fb.className = 'fb ' + (r.correct ? 'ok' : 'bad');
            fb.replaceChildren(el('strong', r.correct ? (ar() ? 'إجابة صحيحة ✓' : 'Correct ✓') : (ar() ? 'الإجابة الصحيحة موضحة بالأخضر' : 'The correct answer is shown in green')), el('br'), enSpan(r.rationale_en));
            fill.style.width = (100 * (i + 1) / d.questions.length) + '%';
            const next = el('button', i + 1 < d.questions.length ? (ar() ? 'التالي' : 'Next') : (ar() ? 'النتيجة' : 'See result'), 'btn'); next.onclick = () => show(i + 1); box.append(next); next.focus();
            paintDots(Array(i + 1).fill(0), d.questions.length);
          } catch (e) { fb.replaceChildren(el('p', e.message, 'notice')); }
        };
        opts.append(b);
      });
      box.append(opts, fb); body.replaceChildren(box);
    };
    show(d.answers.length);
  }
  drillCard.onclick = openDrill;
  drillCard.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrill(); } };
};
