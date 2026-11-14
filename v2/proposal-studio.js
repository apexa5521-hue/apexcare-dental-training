'use strict';
// Fill a specialty <select> with item counts from the catalog, richest first, empty ones marked.
window.nseFillSpecialties = (select, specialties, catalogue, el) => {
  const cat = catalogue || { tools: [], procedures: [] };
  const count = code => ({ tools: (cat.tools || []).filter(t => String(t.specialtyId) === String(code)).length, procedures: (cat.procedures || []).filter(p => String(p.specialtyId) === String(code)).length });
  const rows = specialties.map(s => ({ s, n: count(s.code) })).sort((a, b) => (b.n.tools + b.n.procedures) - (a.n.tools + a.n.procedures) || a.s.label.localeCompare(b.s.label));
  select.replaceChildren(...rows.map(({ s, n }) => { const o = el('option', s.label + (n.tools || n.procedures ? ' — ' + n.tools + ' tools, ' + n.procedures + ' procedures' : ' — empty (no catalog content)')); o.value = s.id; return o; }));
  if (rows.length) select.value = rows[0].s.id;
};
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

// Free, content-bound question drafting from the imported catalog (no AI provider).
window.nseMountRuleDrafts = ({ before, post, el, ctx, refresh, catalogue }) => {
  const box = el('form', undefined, 'stack section');
  box.append(el('h3', 'توليد أسئلة من الكتالوج بدون ذكاء اصطناعي · Catalog question drafts (no AI)'),
    el('p', 'كل سؤال مبني على معلومة موثقة في الكتالوج: فائدة الأداة، قائمة تجهيز الإجراء، أو ترتيب خطوات مكافحة العدوى. تدخل قائمة المراجعة كمسودات، ولا تُعتمد إلا بمراجع مستقل.', 'muted'));
  const lab = (title, node) => { const l = el('label', undefined, 'field'); l.append(el('span', title), node); box.append(l); return node; };
  const spec = lab('التخصص · Specialty', el('select'));
  window.nseFillSpecialties(spec, ctx.specialties, catalogue, el);
  const count = lab('عدد الأسئلة · Number of drafts', el('input')); count.type = 'number'; count.min = 1; count.max = 50; count.value = 20;
  const cats = [['instrument_name', 'الفائدة ← اسم الأداة · Purpose → name'], ['instrument_use', 'الأداة ← فائدتها · Name → purpose'], ['procedure_preparation', 'تجهيز الإجراء · Procedure preparation'], ['sequence', 'ترتيب الخطوات · Step order']];
  const checks = cats.map(([id, title]) => { const l = el('label', undefined, 'field'), c = el('input'); c.type = 'checkbox'; c.checked = true; c.value = id; l.append(c, el('span', ' ' + title)); box.append(l); return c; });
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite');
  const go = el('button', 'توليد المسودات · Create drafts', 'btn');
  box.append(go, msg);
  box.onsubmit = async e => {
    e.preventDefault(); go.disabled = true; msg.textContent = '';
    try {
      const chosen = checks.filter(c => c.checked).map(c => c.value);
      if (!chosen.length) { msg.textContent = 'اختر نوعًا واحدًا على الأقل.'; return; }
      const r = await post('/api/content/rule-candidates', { specialtyId: spec.value, count: Number(count.value), categories: chosen });
      msg.textContent = r.created ? 'أُضيفت ' + r.created + ' مسودة لقائمة المراجعة.' : 'لا توجد أسئلة جديدة لهذا التخصص من الكتالوج الحالي (المتاح غير المكرر: ' + r.available + ').';
      if (r.created) await refresh();
    } catch (err) { msg.textContent = err.message; } finally { go.disabled = false; }
  };
  before.before(box);
};

// Claude-on-your-subscription bridge: build a prompt from catalog records, paste Claude's JSON reply back.
window.nseMountBridge = ({ root, post, el, ctx, catalogue, refresh }) => {
  const box = el('section', undefined, 'stack section'); box.id = 'claudeBridge';
  box.append(el('h3', 'Claude على اشتراكك · Draft with Claude (no API key)'),
    el('p', '١) اختاري التخصص وحتى ١٠ أدوات أو إجراءات. ٢) انسخي الطلب والصقيه في Claude. ٣) انسخي رد Claude والصقيه هنا. كل شي يدخل كمسودة تحتاج مراجعة سريرية ولغوية، وكل سؤال يُرفض إذا اقتباسه مو موجود حرفيًا في سجل الكتالوج.', 'muted'));
  const lab = (title, node) => { const l = el('label', undefined, 'field'); l.append(el('span', title), node); box.append(l); return node; };
  const spec = lab('التخصص · Specialty', el('select'));
  window.nseFillSpecialties(spec, ctx.specialties, catalogue, el);
  const kind = lab('المصدر · Source', el('select'));
  [['tool', 'أدوات ومستهلكات · Instruments & supplies'], ['procedure', 'إجراءات · Procedures']].forEach(([v, t]) => { const o = el('option', t); o.value = v; kind.append(o); });
  const want = lab('المطلوب · Draft', el('select'));
  [['both', 'دروس وأسئلة · Lessons and questions'], ['lessons', 'دروس فقط · Lessons only'], ['questions', 'أسئلة فقط · Questions only']].forEach(([v, t]) => { const o = el('option', t); o.value = v; want.append(o); });
  const filter = lab('بحث في الكتالوج · Filter', el('input')); filter.placeholder = 'mirror, probe, examination…';
  const list = el('div', undefined, 'bridge-list'); list.style.cssText = 'max-height:260px;overflow:auto;border:1px solid var(--nse-line);border-radius:12px;padding:6px 10px';
  const counter = el('p', '', 'small'); box.append(list, counter);
  const chosen = new Set();
  const paintList = () => {
    const code = ctx.specialties.find(s => s.id === spec.value)?.code, f = filter.value.trim().toLowerCase();
    const items = (kind.value === 'tool' ? catalogue.tools : catalogue.procedures).filter(x => String(x.specialtyId) === String(code) && (!f || String(x.nameEn || '').toLowerCase().includes(f) || String(x.nameAr || '').includes(filter.value.trim()))).slice(0, 150);
    list.replaceChildren(...(items.length ? items.map(x => { const l = el('label', undefined, 'field'); l.style.cssText = 'display:flex;gap:8px;align-items:center;margin:4px 0;font-weight:500'; const c = el('input'); c.type = 'checkbox'; c.checked = chosen.has(String(x.id)); c.onchange = () => { if (c.checked && chosen.size >= 10) { c.checked = false; counter.textContent = 'الحد الأقصى ١٠ عناصر في الطلب الواحد.'; return; } c.checked ? chosen.add(String(x.id)) : chosen.delete(String(x.id)); counter.textContent = chosen.size + ' / 10'; }; const n = el('span', (x.nameEn || '') + (x.nameAr ? ' · ' + x.nameAr : '')); l.append(c, n); return l; }) : [el('p', 'ما فيه عناصر مطابقة في هذا التخصص.', 'small')]));
    counter.textContent = chosen.size + ' / 10';
  };
  spec.onchange = kind.onchange = () => { chosen.clear(); paintList(); };
  filter.oninput = paintList;
  const msg = el('p', '', 'notice'); msg.setAttribute('aria-live', 'polite');
  const make = el('button', 'إنشاء الطلب ونسخه · Build & copy prompt', 'btn'); make.type = 'button';
  const promptBox = el('textarea'); promptBox.readOnly = true; promptBox.rows = 6; promptBox.hidden = true; promptBox.setAttribute('aria-label', 'Prompt for Claude'); promptBox.dir = 'ltr';
  make.onclick = async () => {
    if (!chosen.size) { msg.textContent = 'اختاري عنصرًا واحدًا على الأقل.'; return; }
    make.disabled = true;
    try {
      const r = await post('/api/bridge/prompt', { specialtyId: spec.value, kind: kind.value, want: want.value, sourceIds: [...chosen] });
      promptBox.value = r.prompt; promptBox.hidden = false;
      try { await navigator.clipboard.writeText(r.prompt); msg.textContent = 'نُسخ الطلب. افتحي Claude والصقيه، ثم انسخي الرد كاملًا.'; } catch { promptBox.select(); msg.textContent = 'انسخي الطلب من المربع (تحديد الكل ثم نسخ)، والصقيه في Claude.'; }
    } catch (e) { msg.textContent = e.message; } finally { make.disabled = false; }
  };
  const replyLabel = el('label', undefined, 'field'), reply = el('textarea'); replyLabel.append(el('span', 'الصقي رد Claude هنا · Paste Claude’s reply'), reply); reply.rows = 6; reply.dir = 'ltr'; reply.placeholder = '{ "lessons": [...], "questions": [...] }';
  const imp = el('button', 'استيراد كمسودات · Import as drafts', 'btn sub'); imp.type = 'button';
  imp.onclick = async () => {
    imp.disabled = true;
    try {
      const r = await post('/api/bridge/import', { specialtyId: spec.value, reply: reply.value });
      const reasons = r.rejected.length ? ' · مرفوض ' + r.rejected.length + ': ' + [...new Set(r.rejected.map(x => x.reason))].join(', ') : '';
      msg.textContent = 'أُضيفت ' + r.lessonsCreated + ' مسودة درس و' + r.questionsCreated + ' مسودة سؤال للمراجعة' + reasons;
      if (r.lessonsCreated || r.questionsCreated) { reply.value = ''; await refresh(); }
    } catch (e) { msg.textContent = e.message === 'REPLY_IS_NOT_JSON' ? 'الرد مو بصيغة JSON. اطلبي من Claude: «أعد الرد بصيغة JSON فقط».' : e.message; } finally { imp.disabled = false; }
  };
  const row = el('div'); row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap'; row.append(make);
  box.append(row, promptBox, replyLabel);
  const row2 = el('div'); row2.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap'; row2.append(imp);
  box.append(row2, msg);
  root.append(box); paintList();
};

// Catalog readiness by specialty: shows which specialties actually have tools/procedures.
window.nseMountCoverage = async ({ root, after, request, el, ctx }) => {
  const box = el('article', undefined, 'notice section'); box.id = 'catalogCoverage';
  box.append(el('h3', 'جاهزية الكتالوج لكل تخصص · Catalog readiness by specialty'));
  (after || root.firstChild)?.after ? (after || root.firstChild).after(box) : root.append(box);
  try {
    const r = await request('/api/catalog/coverage?centerId=' + encodeURIComponent(ctx.center));
    window.nseAnnotateSpecialties?.(r.specialties);
    const table = el('table'); table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13.5px';
    const head = el('tr'); ['التخصص · Specialty', 'أدوات', 'بفائدة موثقة', 'بصورة', 'إجراءات', 'جاهز للتدريب'].forEach(h => { const th = el('th', h); th.style.cssText = 'text-align:start;padding:6px 8px;border-bottom:1px solid var(--nse-line);font-size:12px'; head.append(th); });
    table.append(head);
    r.specialties.forEach(s => {
      const tr = el('tr'), cell = (t, bold) => { const td = el('td', String(t)); td.style.cssText = 'padding:6px 8px;border-bottom:1px solid var(--nse-line)' + (bold ? ';font-weight:700' : ''); return td; };
      tr.append(cell(s.label + (s.assignedToMe ? ' ← مسند لك' : ''), s.assignedToMe), cell(s.tools), cell(s.toolsWithUse), cell(s.toolsWithImage), cell(s.procedures), cell(s.practiceReady ? '✓ نعم' : '✗ لا — بدون محتوى كافٍ'));
      table.append(tr);
    });
    const wrap = el('div'); wrap.style.cssText = 'overflow-x:auto'; wrap.append(table); box.append(wrap);
    const empty = r.specialties.filter(s => !s.practiceReady && s.assignedToMe);
    if (empty.length) box.append(el('p', 'أنتِ مسندة لتخصص بدون أدوات كافية (' + empty.map(s => s.label).join('، ') + '). من «فريق التمريض ← إسناد تخصص» اختاري تخصصًا جاهزًا للتدريب، أو أضيفي محتوى لهذا التخصص.', 'small'));
    box.append(el('p', 'التدريب اليومي والتري يحتاجان ٤ أدوات على الأقل بفائدة موثقة في التخصص المسند.', 'small'));
  } catch (e) { box.append(el('p', e.message, 'small')); }
};
