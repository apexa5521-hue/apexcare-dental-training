'use strict';
// Supervisor dashboard (approved design, round 2 · screen 9) on the reports page.
// Shows real indicators from /api/supervisor/overview; no sample numbers.
window.nseMountSupervisor = async ({ host, request, el, center, language }) => {
  if (!host) return;
  document.getElementById('nseSupervisor')?.remove();
  if (!document.getElementById('nseSupStyle')) {
    const s = document.createElement('style'); s.id = 'nseSupStyle';
    s.textContent = `
#nseSupervisor{display:flex;flex-direction:column;gap:16px;margin-bottom:var(--nse-gap,20px)}
#nseSupervisor .kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
#nseSupervisor .kpi{background:var(--nse-surface);border:1px solid var(--nse-line);border-radius:16px;padding:14px 16px}
#nseSupervisor .kpi span{font-size:12px;color:var(--nse-muted)}
#nseSupervisor .kpi strong{display:block;font:700 26px Inter,sans-serif;color:var(--nse-ink)}
#nseSupervisor .kpi small{font-size:12px;color:var(--nse-muted)}
#nseSupervisor .kpi.warn strong{color:#a86200}#nseSupervisor .kpi.bad strong{color:#b23434}
:root[data-theme="dark"] #nseSupervisor .kpi.warn strong{color:#ffc14d}:root[data-theme="dark"] #nseSupervisor .kpi.bad strong{color:#ff8f8f}
#nseSupervisor .cols{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:16px;align-items:start}
#nseSupervisor .panel{background:var(--nse-surface);border:1px solid var(--nse-line);border-radius:18px;padding:18px}
#nseSupervisor .panel h3{margin:0 0 10px;font-size:16px}
#nseSupervisor .row{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1.6fr) 64px 104px;gap:10px;align-items:center;padding:10px 2px;border-top:1px solid var(--nse-line)}
#nseSupervisor .row.head{border-top:0;font-size:12px;font-weight:700;color:var(--nse-muted);padding-top:0}
#nseSupervisor .who{display:flex;align-items:center;gap:10px;min-width:0}
#nseSupervisor .who b{width:32px;height:32px;flex:0 0 32px;border-radius:50%;background:var(--nse-soft);color:var(--nse-green);display:grid;place-items:center;font-size:13px}
#nseSupervisor .who span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:14px}
#nseSupervisor .bar{display:flex;align-items:center;gap:8px}
#nseSupervisor .bar i{flex:1;height:8px;border-radius:99px;background:var(--nse-line);overflow:hidden;display:block}
#nseSupervisor .bar i b{display:block;height:100%;background:var(--nse-bright,var(--nse-green));border-radius:99px}
#nseSupervisor .bar em{font:600 12px Inter,sans-serif;font-style:normal;width:36px}
#nseSupervisor .num{font:600 13px Inter,sans-serif}
#nseSupervisor .st{justify-self:start;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px;white-space:nowrap}
#nseSupervisor .st.s-ok{background:#e3f6ee;color:#0b6a4a}#nseSupervisor .st.s-wait{background:#fff2d9;color:#8a5200}#nseSupervisor .st.s-help{background:#fde8e8;color:#a12a2a}#nseSupervisor .st.s-card{background:#e4eefc;color:#1d4f9a}
#nseSupervisor .miss{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}
#nseSupervisor .miss div{display:flex;justify-content:space-between;font-size:13px;gap:8px}
#nseSupervisor .miss i{display:block;height:8px;border-radius:99px;background:#fff2d9;overflow:hidden}
#nseSupervisor .miss i b{display:block;height:100%;background:#e39a10}
#nseSupervisor .rules{font-size:12px;color:var(--nse-muted);line-height:1.7;margin:8px 0 0}
#nseSupervisor .empty{color:var(--nse-muted);font-size:14px}
@media(max-width:900px){#nseSupervisor .cols{grid-template-columns:1fr}}
@media(max-width:600px){#nseSupervisor .kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}#nseSupervisor .kpi strong{font-size:22px}#nseSupervisor .row{grid-template-columns:minmax(0,1fr) 92px;row-gap:6px}#nseSupervisor .row.head{display:none}#nseSupervisor .row .bar{grid-column:1/-1;order:3}#nseSupervisor .row .num{display:none}#nseSupervisor .panel{padding:14px}}`;
    document.head.append(s);
  }
  const ar = () => (language?.() || 'en') === 'ar', L = (a, e) => ar() ? a : e;
  const box = el('section'); box.id = 'nseSupervisor';
  box.append(el('p', L('جارٍ تحميل لوحة المشرفة…', 'Loading supervisor dashboard…'), 'empty'));
  const nav = host.querySelector(':scope > .page-navigation'); nav ? nav.after(box) : host.prepend(box);
  let d;
  try { d = await request('/api/supervisor/overview?centerId=' + encodeURIComponent(center())); }
  catch (e) { box.replaceChildren(el('p', e.message === 'FORBIDDEN' ? L('اللوحة للمشرفات والإدارة فقط.', 'Supervisors and administrators only.') : e.message, 'empty')); return; }
  const s = d.summary;
  const kpi = (label, value, sub, cls) => { const k = el('div', undefined, 'kpi' + (cls ? ' ' + cls : '')); k.append(el('span', label), el('strong', value === null ? '—' : String(value))); if (sub) k.append(el('small', sub)); return k; };
  const kpis = el('div', undefined, 'kpis');
  kpis.append(
    kpi(L('نشطات هذا الأسبوع', 'Active this week'), s.activeThisWeek, L('من ', 'of ') + s.nurses),
    kpi(L('متوسط إكمال المسار', 'Average path completion'), s.averageCompletion === null ? null : s.averageCompletion + '%'),
    kpi(L('بانتظار تقييم عملي', 'Awaiting practical'), s.awaitingPractical, null, s.awaitingPractical ? 'warn' : ''),
    kpi(L('تحتاج دعم · محاولات متوقفة', 'Need support · paused'), s.needsSupport + ' · ' + s.pausedAttempts, null, s.needsSupport || s.pausedAttempts ? 'bad' : ''));
  const STAT = { ok: L('على المسار', 'On track'), wait: L('تقييم عملي', 'Practical due'), help: L('تحتاج دعم', 'Needs support'), card: L('بطاقة صادرة', 'Card issued') };
  const team = el('div', undefined, 'panel'); team.append(el('h3', L('تقدّم الفريق', 'Team progress')));
  if (!d.nurses.length) team.append(el('p', L('ما فيه ممرضات مسجلات في هذا المركز بعد.', 'No nurses are enrolled in this center yet.'), 'empty'));
  else {
    const head = el('div', undefined, 'row head'); head.append(el('span', L('الممرضة', 'Nurse')), el('span', L('إكمال المسار', 'Path')), el('span', L('التري', 'Tray')), el('span', L('الحالة', 'Status'))); team.append(head);
    d.nurses.forEach(n => {
      const r = el('div', undefined, 'row'), who = el('div', undefined, 'who'); who.append(el('b', (n.name || '?').trim().charAt(0)), el('span', n.name || '—'));
      const bar = el('div', undefined, 'bar'), track = el('i'), fill = el('b'); fill.style.width = (n.completion || 0) + '%'; track.append(fill);
      bar.append(track, el('em', n.completion === null ? '—' : n.completion + '%')); bar.title = n.lessonsDone + ' / ' + n.lessonsTotal;
      r.append(who, bar, el('span', n.trayAverage === null ? '—' : n.trayAverage + '%', 'num'), el('span', STAT[n.status], 'st s-' + n.status));
      team.append(r);
    });
  }
  const side = el('div', undefined, 'panel'); side.append(el('h3', L('أكثر أدوات التري نسيانًا (٣٠ يوم)', 'Most missed tray items (30 days)')));
  if (!d.missedTrayItems.length) side.append(el('p', L('ما فيه جولات تري كافية بعد.', 'Not enough tray rounds yet.'), 'empty'));
  else { const max = d.missedTrayItems[0].misses, m = el('div', undefined, 'miss'); d.missedTrayItems.forEach(x => { const row = el('div'); const name = el('span', x.name); name.lang = 'en'; row.append(name, el('strong', String(x.misses))); const bar = el('i'), b = el('b'); b.style.width = Math.round(100 * x.misses / max) + '%'; bar.append(b); m.append(row, bar); }); side.append(m); }
  side.append(el('p', L('الحالة: «تحتاج دعم» إذا آخر تقييم عملي يحتاج دعم أو آخر نتيجة اختبار أقل من ٦٠٪ · «تقييم عملي» إذا اجتازت اختبارًا وما فيه تقييم «كفؤة» · «بطاقة صادرة» إذا عندها بطاقة كفاءة سارية.', 'Status: "Needs support" when the latest practical observation needs support or the latest exam score is below 60% · "Practical due" after a submitted exam without a "competent" observation · "Card issued" with an active competency card.'), 'rules'));
  const cols = el('div', undefined, 'cols'); cols.append(team, side);
  box.replaceChildren(kpis, cols);
};
