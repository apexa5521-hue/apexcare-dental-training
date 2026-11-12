'use strict';
// Supervisor dashboard: real per-nurse indicators for the current center only.
// Status rules (shown to the supervisor in the UI):
//  card  = holds an active competency card
//  help  = latest practical observation is "needs_support", or latest submitted score < 60
//  wait  = has a submitted assessment but no "competent" observation yet
//  ok    = otherwise
module.exports = async ({ req, url, c, centerId, role, deny }) => {
  if (req.method !== 'GET' || url.pathname !== '/api/supervisor/overview') return { handled: false };
  if (!['supervisor', 'admin'].includes(role.role)) deny();
  const nurses = (await c.query("select user_id,display_name from qib.memberships where center_id=$1 and role='nurse' order by display_name", [centerId])).rows;
  const ids = nurses.map(n => n.user_id);
  const q = (sql, extra = []) => c.query(sql, [centerId, ids, ...extra]).then(r => r.rows);
  const [visible, done, attempts, obs, certs, trays, drills, paused, recentModules, missed] = await Promise.all([
    q("select a.user_id,count(distinct m.id)::int as n from qib.assignments a join qib.modules m on m.status='published' and (m.center_id=$1 or m.center_id is null) and (m.specialty_id is null or m.specialty_id=a.specialty_id) where a.center_id=$1 and a.user_id=any($2::uuid[]) group by a.user_id"),
    q("select p.user_id,count(*)::int as n from qib.module_progress p join qib.modules m on m.id=p.module_id and m.status='published' where p.center_id=$1 and p.user_id=any($2::uuid[]) group by p.user_id"),
    q("select distinct on (user_id) user_id,score,finished_at as submitted_at from qib.attempts where center_id=$1 and user_id=any($2::uuid[]) and status='submitted' order by user_id,finished_at desc nulls last"),
    q("select distinct on (user_id) user_id,status,observed_at from qib.skill_observations where center_id=$1 and user_id=any($2::uuid[]) order by user_id,observed_at desc"),
    q("select user_id,count(*)::int as n from qib.certificates where center_id=$1 and user_id=any($2::uuid[]) and kind='competency' and revoked_at is null and (expires_at is null or expires_at>now()) group by user_id"),
    q("select user_id,round(avg((result->>'score')::numeric))::int as avg,count(*)::int as n,max(submitted_at) as last from qib.tray_rounds where center_id=$1 and user_id=any($2::uuid[]) and submitted_at>now()-interval '30 days' group by user_id"),
    q("select user_id,max(completed_at) as last from qib.daily_drills where center_id=$1 and user_id=any($2::uuid[]) and completed_at is not null group by user_id"),
    q("select count(*)::int as n from qib.attempts where center_id=$1 and status='paused_review' and ($2::uuid[] is not null)"),
    q("select user_id,max(completed_at) as last from qib.module_progress where center_id=$1 and user_id=any($2::uuid[]) group by user_id"),
    q("select x.id,count(*)::int as n from qib.tray_rounds t, jsonb_array_elements_text(t.expected) x(id) where t.center_id=$1 and t.user_id=any($2::uuid[]) and t.submitted_at>now()-interval '30 days' and not (t.selected ? x.id) group by x.id order by n desc limit 5")
  ]);
  const by = (rows, k = 'user_id') => new Map(rows.map(r => [r[k], r]));
  const V = by(visible), D = by(done), A = by(attempts), O = by(obs), C = by(certs), T = by(trays), DR = by(drills), RM = by(recentModules);
  const week = Date.now() - 7 * 864e5, recent = d => d && new Date(d).getTime() >= week;
  const rows = nurses.map(n => {
    const total = V.get(n.user_id)?.n || 0, completed = D.get(n.user_id)?.n || 0, a = A.get(n.user_id), o = O.get(n.user_id);
    const status = C.get(n.user_id) ? 'card' : (o?.status === 'needs_support' || (a && Number(a.score) < 60)) ? 'help' : (a && o?.status !== 'competent') ? 'wait' : 'ok';
    return { userId: n.user_id, name: n.display_name, completion: total ? Math.round(100 * Math.min(completed, total) / total) : null, lessonsDone: completed, lessonsTotal: total, latestScore: a ? Number(a.score) : null, trayAverage: T.get(n.user_id)?.avg ?? null, trayRounds: T.get(n.user_id)?.n || 0, latestObservation: o?.status || null, status, activeThisWeek: [T.get(n.user_id)?.last, DR.get(n.user_id)?.last, RM.get(n.user_id)?.last, a?.submitted_at].some(recent) };
  });
  let missedItems = [];
  if (missed.length) {
    const names = new Map((await c.query("select legacy_id,payload->>'nameEn' as name from qib.legacy_catalog where source_name='Tools' and legacy_id=any($1::text[])", [missed.map(m => m.id)])).rows.map(r => [r.legacy_id, r.name]));
    missedItems = missed.map(m => ({ id: m.id, name: names.get(m.id) || m.id, misses: m.n }));
  }
  const withCompletion = rows.filter(r => r.completion !== null);
  return { handled: true, data: {
    nurses: rows,
    summary: { nurses: rows.length, activeThisWeek: rows.filter(r => r.activeThisWeek).length, averageCompletion: withCompletion.length ? Math.round(withCompletion.reduce((s, r) => s + r.completion, 0) / withCompletion.length) : null, awaitingPractical: rows.filter(r => r.status === 'wait').length, needsSupport: rows.filter(r => r.status === 'help').length, pausedAttempts: paused[0]?.n || 0 },
    missedTrayItems: missedItems
  } };
};
