'use strict';
// Owner-only platform diagnostics: runs read-only checks and reports which one fails and why.
// Messages are database error texts (no data rows, no secrets); only platform owners can call it.
const CHECKS = [
  ['tables', "select string_agg(t, ', ') as missing from unnest(array['module_proposals','tray_rounds','daily_drills','question_candidates','notifications','content_assets','study_sessions']) t where to_regclass('qib.'||t) is null"],
  ['catalog_counts', "select source_name, count(*)::int as n from qib.legacy_catalog group by source_name order by source_name"],
  ['specialties', "select s.label, s.code, count(l.*) filter (where l.source_name='Tools')::int as tools, count(l.*) filter (where l.source_name='Procedures')::int as procedures from qib.specialties s left join qib.legacy_catalog l on l.specialty_legacy_id=s.code group by s.label,s.code order by tools desc"],
  ['tool_specialty_keys', "select payload->>'specialtyId' as specialty_id_in_payload, specialty_legacy_id, count(*)::int as n from qib.legacy_catalog where source_name='Tools' group by 1,2 order by n desc limit 12"],
  ['my_assignments', "select s.label, s.code from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2", 'user+center'],
  ['modules', "select status, count(*)::int as n from qib.modules where center_id=$1 group by status", 'center'],
  ['proposals_query', "select count(*)::int as n from qib.module_proposals where center_id=$1", 'center'],
  ['tray_query', "select count(*)::int as n from qib.tray_rounds where center_id=$1", 'center'],
  ['drill_query', "select count(*)::int as n from qib.daily_drills where center_id=$1", 'center'],
  ['coverage_query', "select s.id, count(*) filter (where l.source_name='Tools')::int as tools from qib.specialties s left join qib.legacy_catalog l on l.specialty_legacy_id=s.code and l.source_name in ('Tools','Procedures') group by s.id limit 1", 'none']
];
module.exports = async ({ req, url, c, userId, centerId, deny }) => {
  if (req.method !== 'GET' || url.pathname !== '/api/admin/selfcheck') return { handled: false };
  if (!(await c.query('select 1 from qib.platform_owners where user_id=$1', [userId])).rowCount) deny();
  const results = [];
  for (const [name, sql, mode = 'none'] of CHECKS) {
    await c.query('savepoint selfcheck');
    try {
      const params = mode === 'user+center' ? [userId, centerId] : mode === 'center' ? [centerId] : [];
      const r = await c.query(sql, params);
      results.push({ check: name, ok: true, rows: r.rows.slice(0, 20) });
      await c.query('release savepoint selfcheck');
    } catch (e) {
      await c.query('rollback to savepoint selfcheck');
      results.push({ check: name, ok: false, error: String(e.message).slice(0, 300) });
    }
  }
  return { handled: true, data: { results, at: new Date().toISOString() } };
};
