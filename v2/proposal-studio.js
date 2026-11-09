'use strict';
// AI edit/translation proposals: generate a draft suggestion, compare it line by line,
// accept or reject each change. Accepted text returns the lesson to draft for review.
window.nseMountProposals = ({ root, request, post, el, ctx, modules, aiConfigured, refresh }) => {
  if (!document.getElementById('nseProposalStyle')) {
    const style = document.createElement('style');
    style.id = 'nseProposalStyle';
    style.textContent = `
.nse-diff{display:grid;gap:6px;margin:10px 0;font-size:.95rem}
.nse-diff .same{color:var(--nse-muted,#637589);white-space:pre-wrap;padding:2px 10px}
.nse-diff .chg{border:1px solid var(--nse-line,#e4eaf1);border-radius:12px;overflow:hidden}
.nse-diff .chg header{display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--nse-soft,#eaf7f3);font-weight:600}
.nse-diff .cols{display:grid;grid-template-columns:1fr 1fr}
.nse-diff .old,.nse-diff .new{white-space:pre-wrap;padding:8px 10px;min-height:1.5em;overflow-wrap:anywhere}
.nse-diff .old{background:color-mix(in srgb,#d64545 12%,transparent)}
.nse-diff .old .txt{text-decoration:line-through;text-decoration-color:color-mix(in srgb,#d64545 60%,transparent)}
.nse-diff .new{background:color-mix(in srgb,var(--nse-green,#127b69) 14%,transparent)}
.nse-diff .chg.off .new{opacity:.45}
.nse-diff .chg.off .old .txt{text-decoration:none}
#proposalStudio .notice:empty{display:none}
.nse-diff .label{font-size:.75rem;color:var(--nse-muted,#637589);display:block;margin-bottom:2px}
@media (max-width:640px){.nse-diff .cols{grid-template-columns:1fr}}
.nse-proposal-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}`;
    document.head.append(style);
  }
  const LANGS = [['ar', 'العربية'], ['en', 'English'], ['ur', 'اردو'], ['id', 'Bahasa Indonesia']];
  const langName = code => (LANGS.find(l => l[0] === code) || [code, code])[1];
  const field = (form, title, input) => { const label = el('label', undefined, 'field'); label.append(el('span', title), input); form.append(label); return input; };
  const select = items => { const node = el('select'); items.forEach(([id, title]) => { const o = el('option', title); o.value = id; node.append(o); }); return node; };
  const editable = modules.filter(m => m.status === 'draft' || m.status === 'review');

  const box = el('section', undefined, 'stack section');
  box.id = 'proposalStudio';
  box.append(
    el('h3', 'اقتراح تعديل أو ترجمة بالذكاء الاصطناعي · AI edit & translation proposals'),
    el('p', 'الاقتراح لا يغيّر الدرس. تقارن كل تغيير وتقبله أو ترفضه، والنص المقبول يرجع الدرس مسودة تحتاج مراجعة سريرية ولغوية قبل النشر.', 'muted')
  );
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite'); box.append(msg);
  if (!editable.length) { box.append(el('p', 'لا توجد دروس مسودة أو قيد المراجعة. لتعديل درس منشور أنشئ نسخة مسودة منه أولًا.', 'small')); root.append(box); return; }

  const form = el('form', undefined, 'stack');
  const lesson = field(form, 'الدرس · Lesson', select(editable.map(m => [m.id, (m.translations?.en?.title || m.translations?.ar?.title || m.slug) + ' · ' + m.status + ' · v' + m.version])));
  const mode = field(form, 'نوع الاقتراح · Proposal type', select([['revise', 'تحسين النص · Revise text'], ['translate', 'ترجمة مسودة · Draft translation']]));
  const target = field(form, 'لغة النص المقترح · Target language', select(LANGS));
  const source = field(form, 'الترجمة من · Translate from', select(LANGS));
  source.value = 'en'; target.value = 'ar';
  if (editable.some(m => m.id === window.nseProposalLesson)) lesson.value = window.nseProposalLesson;
  const sourceLabel = source.parentElement;
  const instruction = field(form, 'المطلوب من الاقتراح · What should change', el('textarea'));
  instruction.placeholder = 'مثال: بسّط الخطوات بجمل قصيرة وأضف تذكيرًا بلحظات نظافة اليدين الخمس دون إضافة معلومات سريرية جديدة';
  const confirmLabel = el('label', undefined, 'field');
  const confirm = el('input'); confirm.type = 'checkbox';
  confirmLabel.append(confirm, el('span', ' النص تعليمي ولا يحتوي بيانات مرضى أو موظفين · Educational text only, no patient or staff data'));
  form.append(confirmLabel);
  const go = el('button', 'إنشاء اقتراح · Generate proposal', 'btn');
  go.disabled = !aiConfigured;
  form.append(go);
  if (!aiConfigured) form.append(el('p', 'الذكاء الاصطناعي غير مهيأ على الخادم بعد (OPENAI_API_KEY و OPENAI_MODEL). المقارنة والقبول تعمل عند توفر الاقتراحات.', 'small'));
  const syncMode = () => { sourceLabel.style.display = mode.value === 'translate' ? '' : 'none'; };
  mode.onchange = syncMode; syncMode();
  box.append(form);

  const list = el('div', undefined, 'stack section');
  box.append(list);
  root.append(box);

  const busy = async (button, fn) => { if (button) button.disabled = true; msg.textContent = ''; try { await fn(); } catch (e) { msg.textContent = e.message; } finally { if (button) button.disabled = button === go ? !aiConfigured : false; } };

  function renderProposal(p) {
    const card = el('article', undefined, 'card section');
    const kind = p.mode === 'translate' ? 'ترجمة ' + langName(p.sourceLanguage) + ' ← ' + langName(p.language) : 'تحسين · ' + langName(p.language);
    card.append(el('span', kind + ' · ' + p.status + ' · v' + p.baseVersion, 'pill'));
    if (p.instruction) card.append(el('p', p.instruction, 'muted'));
    if (p.changes.length) { const ul = el('ul'); p.changes.forEach(s => ul.append(el('li', s))); card.append(ul); }
    if (p.reviewNotes) card.append(el('p', 'ملاحظات للمراجع · Reviewer notes: ' + p.reviewNotes, 'small'));
    const pending = p.status === 'pending';
    if (pending && p.stale) card.append(el('p', 'تغيّر الدرس بعد إنشاء هذا الاقتراح، لذا لا يمكن تطبيقه. ارفضه وأنشئ اقتراحًا جديدًا.', 'notice'));
    const dir = ['ar', 'ur'].includes(p.language) ? 'rtl' : 'ltr';
    const diffBox = el('div', undefined, 'nse-diff'); diffBox.dir = dir;
    const checks = [];
    const block = (headerText, before, after, key) => {
      const wrap = el('div', undefined, 'chg');
      const head = el('header');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = true; cb.disabled = !pending || p.stale;
      cb.onchange = () => wrap.classList.toggle('off', !cb.checked);
      head.append(cb, el('span', headerText));
      const cols = el('div', undefined, 'cols');
      const o = el('div', undefined, 'old'), n = el('div', undefined, 'new');
      o.append(el('span', 'الحالي · Current', 'label'), el('span', before || '—', 'txt'));
      n.append(el('span', 'المقترح · Proposed', 'label'), el('span', after || '—', 'txt'));
      cols.append(o, n); wrap.append(head, cols); diffBox.append(wrap);
      checks.push({ key, cb });
    };
    if (p.title.changed) block('العنوان · Title', p.title.before, p.title.after, 'title');
    let n = 0;
    p.segments.forEach(s => {
      if (s.kind === 'same') {
        const shown = s.lines.length > 4 ? [...s.lines.slice(0, 2), '⋯', ...s.lines.slice(-2)] : s.lines;
        diffBox.append(el('div', shown.join('\n'), 'same'));
      } else block('تغيير ' + (++n) + ' · Change ' + n, s.removed.join('\n'), s.added.join('\n'), s.id);
    });
    if (!checks.length) diffBox.append(el('p', 'لا توجد فروق عن النص الحالي.', 'small'));
    card.append(diffBox);
    if (pending) {
      const note = el('input'); note.placeholder = 'ملاحظة القرار (اختيارية) · Decision note';
      const actions = el('div', undefined, 'nse-proposal-actions');
      const all = el('button', 'تحديد الكل', 'btn sub'), none = el('button', 'إلغاء التحديد', 'btn sub');
      all.type = none.type = 'button';
      all.onclick = () => checks.forEach(c => { c.cb.checked = true; c.cb.onchange(); });
      none.onclick = () => checks.forEach(c => { c.cb.checked = false; c.cb.onchange(); });
      const accept = el('button', 'تطبيق التغييرات المحددة · Apply selected', 'btn');
      const reject = el('button', 'رفض الاقتراح · Reject', 'btn sub');
      accept.disabled = p.stale || !checks.length; all.disabled = none.disabled = p.stale;
      accept.onclick = () => busy(accept, async () => {
        const chosen = checks.filter(c => c.cb.checked);
        if (!chosen.length) { msg.textContent = 'لم تحدد أي تغيير. استخدم الرفض إذا لا تريد شيئًا من الاقتراح.'; return; }
        const r = await post('/api/proposals/decide', { proposalId: p.id, acceptTitle: chosen.some(c => c.key === 'title'), acceptChangeIds: chosen.filter(c => c.key !== 'title').map(c => c.key), note: note.value });
        msg.textContent = 'طُبّقت التغييرات (' + r.status + '). الدرس الآن مسودة الإصدار ' + r.version + ' ويحتاج مراجعة قبل النشر.';
        await refresh();
      });
      reject.onclick = () => busy(reject, async () => {
        await post('/api/proposals/decide', { proposalId: p.id, acceptTitle: false, acceptChangeIds: [], note: note.value });
        msg.textContent = 'رُفض الاقتراح ولم يتغيّر الدرس.';
        await load();
      });
      actions.append(all, none, accept, reject);
      card.append(note, actions);
    } else if (p.decisionNote) card.append(el('p', 'ملاحظة القرار: ' + p.decisionNote, 'small'));
    return card;
  }

  async function load() {
    const id = lesson.value;
    list.replaceChildren(el('p', 'جارٍ تحميل الاقتراحات…', 'small'));
    const data = await request('/api/proposals?centerId=' + encodeURIComponent(ctx.center) + '&moduleId=' + encodeURIComponent(id));
    if (lesson.value !== id) return;
    list.replaceChildren(el('h3', 'اقتراحات هذا الدرس · Proposals for this lesson'));
    if (!data.proposals.length) list.append(el('p', 'لا توجد اقتراحات بعد.', 'small'));
    data.proposals.forEach(p => list.append(renderProposal(p)));
  }
  lesson.onchange = () => { window.nseProposalLesson = lesson.value; load().catch(e => { msg.textContent = e.message; }); };

  form.onsubmit = e => {
    e.preventDefault();
    busy(go, async () => {
      if (!confirm.checked) { msg.textContent = 'أكّد أن النص تعليمي ولا يحتوي بيانات مرضى أو موظفين.'; return; }
      msg.textContent = 'جارٍ إنشاء الاقتراح، قد يستغرق دقيقة…';
      await post('/api/proposals/generate', { moduleId: lesson.value, mode: mode.value, language: target.value, sourceLanguage: mode.value === 'translate' ? source.value : undefined, instruction: instruction.value, confirmEducationalOnly: true });
      msg.textContent = 'أُنشئ الاقتراح. راجع كل تغيير قبل تطبيقه.';
      await load();
    });
  };
  return load().catch(e => { msg.textContent = e.message; });
};
