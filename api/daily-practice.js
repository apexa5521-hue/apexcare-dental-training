'use strict';
// Today's Drill (3 quick English questions with instant feedback) and Item of the Day.
// Both come only from documented catalog facts in the learner's assigned specialties.
// Practice only: never an official result or competency evidence.
const crypto = require('node:crypto');
const { buildRuleCandidates } = require('./content-rules.js');
const { parseArray } = require('./build-specialty-exam.js');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const LANGS = { ar: 'Ar', en: 'En', ur: 'Ur', id: 'Id' };
const names = (row, field) => Object.fromEntries(Object.entries(LANGS).map(([l, c]) => [l, String(row[field + c] || '').trim()]));
const riyadhDay = (now = new Date()) => now.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const seeded = (key, n) => crypto.createHash('sha256').update(key).digest().readUInt32BE(0) % n;
const DRILL_SIZE = 3;

function pickItem({ tools, procedures, specialtyCodes, day }) {
  const pool = tools.filter(t => specialtyCodes.includes(String(t.specialtyId)) && String(t.nameEn || '').trim() && String(t.useEn || '').trim())
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!pool.length) return null;
  const withImage = pool.filter(t => /^https:\/\//i.test(t.imageUrl || ''));
  const list = withImage.length ? withImage : pool, t = list[seeded(day + '|' + specialtyCodes.join(','), list.length)];
  const usedIn = procedures.filter(p => [...parseArray(p.toolIds), ...parseArray(p.consumableIds)].map(String).includes(String(t.id))).slice(0, 4).map(p => ({ id: String(p.id), names: names(p, 'name') }));
  return { id: String(t.id), specialtyCode: String(t.specialtyId), names: names(t, 'name'), uses: names(t, 'use'), imageUrl: /^https:\/\//i.test(t.imageUrl || '') ? t.imageUrl : null, procedures: usedIn };
}

function pickDrill(candidates, key) {
  const shuffled = candidates.map(q => ({ q, k: crypto.createHash('sha256').update(key + q.prompt_en).digest('hex') })).sort((a, b) => a.k.localeCompare(b.k)).map(x => x.q);
  const out = [], cats = new Set();
  for (const q of shuffled) if (out.length < DRILL_SIZE && !cats.has(q.category)) { out.push(q); cats.add(q.category); }
  for (const q of shuffled) if (out.length < DRILL_SIZE && !out.includes(q)) out.push(q);
  return out.length === DRILL_SIZE ? out : null;
}

const publicQuestion = (q, i) => ({ index: i, prompt_en: q.prompt_en, options_en: q.options_en, category: q.category });
const drillView = d => ({ drillId: d.id, day: d.day instanceof Date ? d.day.toISOString().slice(0, 10) : String(d.day).slice(0, 10), questions: d.questions.map(publicQuestion), answers: d.answers, completed: !!d.completed_at, practiceOnly: true });

async function context(c, userId, centerId, role) {
  const assigned = (await c.query('select s.code from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2 order by s.code', [userId, centerId])).rows.map(r => String(r.code));
  const rows = await c.query("select source_name,payload from qib.legacy_catalog l where source_name=any($1::text[]) and not exists(select 1 from qib.migration_issues i where i.source_name=l.source_name and i.legacy_id=l.legacy_id and i.resolved_at is null)", [['Tools', 'Procedures']]);
  const tools = rows.rows.filter(r => r.source_name === 'Tools').map(r => r.payload), procedures = rows.rows.filter(r => r.source_name === 'Procedures').map(r => r.payload);
  let codes = assigned;
  if (!codes.length && role.role !== 'nurse') codes = [...new Set(tools.map(t => String(t.specialtyId)))].sort();
  return { codes, tools, procedures };
}

async function streak(c, userId, centerId, today) {
  const days = (await c.query("select to_char(day,'YYYY-MM-DD') as d from qib.daily_drills where user_id=$1 and center_id=$2 and completed_at is not null order by day desc limit 60", [userId, centerId])).rows.map(r => r.d);
  const set = new Set(days); let n = 0; const cur = new Date(today + 'T12:00:00Z');
  if (!set.has(today)) cur.setUTCDate(cur.getUTCDate() - 1);
  while (set.has(cur.toISOString().slice(0, 10))) { n++; cur.setUTCDate(cur.getUTCDate() - 1); }
  return n;
}

module.exports = async ({ req, url, body, c, userId, centerId, role }) => {
  const route = url.pathname;
  if (!route.startsWith('/api/daily/')) return { handled: false };
  const done = data => ({ handled: true, data }), today = riyadhDay();

  if (req.method === 'GET' && route === '/api/daily/item') {
    const ctx = await context(c, userId, centerId, role);
    if (!ctx.codes.length) fail('NO_ASSIGNED_SPECIALTY', 409);
    return done({ day: today, item: pickItem({ ...ctx, specialtyCodes: ctx.codes, day: today }) });
  }

  if (req.method === 'GET' && route === '/api/daily/drill') {
    const d = (await c.query('select * from qib.daily_drills where user_id=$1 and center_id=$2 and day=$3', [userId, centerId, today])).rows[0];
    return done({ day: today, drill: d ? drillView(d) : null, streak: await streak(c, userId, centerId, today), size: DRILL_SIZE });
  }

  if (req.method === 'POST' && route === '/api/daily/drill/start') {
    const existing = (await c.query('select * from qib.daily_drills where user_id=$1 and center_id=$2 and day=$3', [userId, centerId, today])).rows[0];
    if (existing) return done({ ...drillView(existing), streak: await streak(c, userId, centerId, today) });
    const ctx = await context(c, userId, centerId, role);
    if (!ctx.codes.length) fail('NO_ASSIGNED_SPECIALTY', 409);
    for (const code of [...ctx.codes].sort((a, b) => seeded(today + userId + a, 1000) - seeded(today + userId + b, 1000))) {
      const pool = buildRuleCandidates({ tools: ctx.tools, procedures: ctx.procedures, specialtyCode: code, categories: ['instrument_name', 'instrument_use', 'procedure_preparation'] });
      const questions = pickDrill(pool, today + '|' + userId);
      if (!questions) continue;
      const row = (await c.query('insert into qib.daily_drills(user_id,center_id,day,specialty_code,questions) values($1,$2,$3,$4,$5) on conflict(user_id,center_id,day) do nothing returning *', [userId, centerId, today, code, JSON.stringify(questions)])).rows[0]
        || (await c.query('select * from qib.daily_drills where user_id=$1 and center_id=$2 and day=$3', [userId, centerId, today])).rows[0];
      return done({ ...drillView(row), streak: await streak(c, userId, centerId, today) });
    }
    fail('NOT_ENOUGH_CATALOG_CONTENT', 409);
  }

  if (req.method === 'POST' && route === '/api/daily/drill/answer') {
    const id = String(body.drillId || ''), index = body.index, choice = body.choice;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(index) || !Number.isInteger(choice)) fail('INVALID_ANSWER');
    const d = (await c.query('select * from qib.daily_drills where id=$1 and user_id=$2 and center_id=$3 for update', [id, userId, centerId])).rows[0];
    if (!d) fail('DRILL_NOT_FOUND', 404);
    const q = d.questions[index];
    if (!q || choice < 0 || choice >= q.options_en.length) fail('INVALID_ANSWER');
    if (d.answers.some(a => a.index === index)) fail('ALREADY_ANSWERED', 409);
    if (index !== d.answers.length) fail('ANSWER_IN_ORDER', 409);
    const correct = choice === q.answer_index, answers = [...d.answers, { index, choice, correct }];
    const complete = answers.length === d.questions.length;
    await c.query('update qib.daily_drills set answers=$2,completed_at=case when $3 then now() else completed_at end where id=$1', [d.id, JSON.stringify(answers), complete]);
    return done({ correct, correctIndex: q.answer_index, rationale_en: q.rationale_en, completed: complete, score: answers.filter(a => a.correct).length, total: d.questions.length, streak: complete ? await streak(c, userId, centerId, today) : undefined, practiceOnly: true });
  }
  return { handled: false };
};
module.exports.pickItem = pickItem;
module.exports.pickDrill = pickDrill;
module.exports.riyadhDay = riyadhDay;
