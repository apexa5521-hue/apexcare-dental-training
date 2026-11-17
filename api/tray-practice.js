'use strict';
// Procedure-tray practice: the learner picks the items for a documented procedure from a mix of
// listed and unlisted catalog items. Grading happens on the server: correct, missed and wrong
// picks. This is ungraded practice; it is not an official assessment or competency evidence.
const crypto = require('node:crypto');
const { parseArray } = require('./build-specialty-exam.js');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const shuffle = xs => { const out = xs.slice(); for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; };
const LANGS = { ar: 'Ar', en: 'En', ur: 'Ur', id: 'Id' };
const names = (row, field) => Object.fromEntries(Object.entries(LANGS).map(([l, c]) => [l, clean(row[field + c])]));
const MAX_OPTIONS = 16;

// Build one round from catalog rows. Returns null when no procedure has enough resolved items.
function buildRound({ tools, procedures, specialtyCode, avoid = [] }) {
  const pool = tools.filter(t => String(t.specialtyId) === String(specialtyCode) && clean(t.nameEn));
  const byId = new Map(pool.map(t => [String(t.id), t]));
  const usable = procedures.filter(p => String(p.specialtyId) === String(specialtyCode) && clean(p.nameEn)).map(p => {
    const ids = [...new Set([...parseArray(p.toolIds), ...parseArray(p.consumableIds)].map(String))].filter(id => byId.has(id));
    return { p, ids };
  }).filter(x => x.ids.length >= 2 && pool.length - x.ids.length >= 3);
  if (!usable.length) return null;
  const fresh = usable.filter(x => !avoid.includes(String(x.p.id)));
  const { p, ids } = shuffle(fresh.length ? fresh : usable)[0];
  const listed = ids.length > MAX_OPTIONS - 3 ? shuffle(ids).slice(0, MAX_OPTIONS - 3) : ids;
  const listedNames = new Set(listed.map(id => clean(byId.get(id).nameEn).toLowerCase()));
  const distractCount = Math.min(MAX_OPTIONS - listed.length, Math.max(3, Math.ceil(listed.length * 0.8)));
  const distractors = shuffle(pool.filter(t => !ids.includes(String(t.id)) && !listedNames.has(clean(t.nameEn).toLowerCase())))
    .filter((t, i, arr) => arr.findIndex(x => clean(x.nameEn).toLowerCase() === clean(t.nameEn).toLowerCase()) === i)
    .slice(0, distractCount).map(t => String(t.id));
  if (distractors.length < 3) return null;
  const option = id => { const t = byId.get(id); return { id, names: names(t, 'name'), uses: names(t, 'use'), imageUrl: /^https:\/\//i.test(t.imageUrl || '') ? t.imageUrl : null }; };
  return { procedure: { id: String(p.id), names: names(p, 'name') }, options: shuffle([...listed, ...distractors]).map(option), expected: listed, partialList: listed.length < ids.length };
}

function grade(expected, options, selected) {
  const valid = new Set(options.map(o => o.id)), picked = [...new Set(selected.map(String))];
  if (picked.some(id => !valid.has(id))) fail('INVALID_TRAY_SELECTION');
  const want = new Set(expected), byId = new Map(options.map(o => [o.id, o]));
  const correct = picked.filter(id => want.has(id)), wrong = picked.filter(id => !want.has(id)), missed = expected.filter(id => !picked.includes(id));
  const score = Math.max(0, Math.round(100 * (correct.length - wrong.length) / expected.length));
  const view = id => ({ id, names: byId.get(id).names, uses: byId.get(id).uses, imageUrl: byId.get(id).imageUrl });
  return { correct: correct.map(view), missed: missed.map(view), wrong: wrong.map(view), score, perfect: !missed.length && !wrong.length, expectedCount: expected.length };
}

module.exports = async ({ req, url, body, c, userId, centerId, role }) => {
  const route = url.pathname;
  if (!route.startsWith('/api/tray/')) return { handled: false };
  const done = data => ({ handled: true, data });

  if (req.method === 'POST' && route === '/api/tray/start') {
    let codes;
    const assigned = (await c.query('select s.code from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2', [userId, centerId])).rows.map(r => String(r.code));
    if (body.specialtyId) {
      const s = (await c.query('select code from qib.specialties where id=$1', [String(body.specialtyId)])).rows[0];
      if (!s) fail('INVALID_SPECIALTY');
      if (role.role === 'nurse' && !assigned.includes(String(s.code))) fail('SPECIALTY_NOT_ASSIGNED', 403);
      codes = [String(s.code)];
    } else codes = assigned.length ? assigned : role.role === 'nurse' ? [] : null;
    if (codes && !codes.length) fail('NO_ASSIGNED_SPECIALTY', 409);
    const rows = await c.query("select source_name,payload from qib.legacy_catalog l where source_name=any($1::text[]) and not exists(select 1 from qib.migration_issues i where i.source_name=l.source_name and i.legacy_id=l.legacy_id and i.resolved_at is null)", [['Tools', 'Procedures']]);
    const tools = rows.rows.filter(r => r.source_name === 'Tools').map(r => r.payload), procedures = rows.rows.filter(r => r.source_name === 'Procedures').map(r => r.payload);
    const recent = (await c.query('select procedure_id from qib.tray_rounds where user_id=$1 and center_id=$2 order by created_at desc limit 5', [userId, centerId])).rows.map(r => r.procedure_id);
    const candidates = shuffle(codes || [...new Set(procedures.map(p => String(p.specialtyId)))]);
    for (const code of candidates) {
      const round = buildRound({ tools, procedures, specialtyCode: code, avoid: recent });
      if (!round) continue;
      const row = (await c.query('insert into qib.tray_rounds(user_id,center_id,specialty_code,procedure_id,options,expected) values($1,$2,$3,$4,$5,$6) returning id', [userId, centerId, code, round.procedure.id, JSON.stringify(round.options), JSON.stringify(round.expected)])).rows[0];
      return done({ roundId: row.id, procedure: round.procedure, options: round.options.map(({ uses: _, ...o }) => o), expectedCount: round.expected.length, partialList: round.partialList, practiceOnly: true });
    }
    fail('NO_TRAY_PROCEDURES_AVAILABLE', 409);
  }

  if (req.method === 'POST' && route === '/api/tray/submit') {
    const id = String(body.roundId || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Array.isArray(body.selected) || body.selected.length > MAX_OPTIONS) fail('INVALID_TRAY_SELECTION');
    const r = (await c.query('select * from qib.tray_rounds where id=$1 and user_id=$2 and center_id=$3 for update', [id, userId, centerId])).rows[0];
    if (!r) fail('ROUND_NOT_FOUND', 404);
    if (r.submitted_at) fail('ROUND_ALREADY_SUBMITTED', 409);
    const result = grade(r.expected, r.options, body.selected);
    await c.query('update qib.tray_rounds set submitted_at=now(),selected=$2,result=$3 where id=$1', [r.id, JSON.stringify(body.selected.map(String)), JSON.stringify({ score: result.score, correct: result.correct.length, missed: result.missed.length, wrong: result.wrong.length })]);
    return done({ ...result, practiceOnly: true });
  }

  if (req.method === 'GET' && route === '/api/tray/history') {
    const rows = await c.query("select procedure_id,specialty_code,submitted_at,result from qib.tray_rounds where user_id=$1 and center_id=$2 and submitted_at is not null order by submitted_at desc limit 20", [userId, centerId]);
    const scores = rows.rows.map(r => r.result.score);
    return done({ rounds: rows.rows, completed: rows.rowCount, averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, perfect: rows.rows.filter(r => r.result.missed === 0 && r.result.wrong === 0).length });
  }
  return { handled: false };
};
module.exports.buildRound = buildRound;
module.exports.grade = grade;
