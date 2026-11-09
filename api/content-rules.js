'use strict';
// Content-bound question drafting without any AI provider.
// Every candidate is derived from one documented catalog fact (tool use, procedure checklist,
// IPC step order) and carries that fact as its source quote. Candidates enter the existing
// independent clinical review queue; nothing is published automatically.
const crypto = require('node:crypto');
const { parseArray } = require('./build-specialty-exam.js');
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const ascii = s => s && !/[؀-ۿ]/.test(s);
const shuffle = xs => { const out = xs.slice(); for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; } return out; };
const CATEGORIES = ['instrument_name', 'instrument_use', 'procedure_preparation', 'sequence'];

function mcq({ prompt, correct, wrong, category, difficulty = 'foundation', rationale, quote, reference }) {
  correct = clean(correct);
  const pool = [...new Set(wrong.map(clean).filter(x => x && x.toLowerCase() !== correct.toLowerCase() && ascii(x)))];
  if (!ascii(prompt) || !ascii(correct) || pool.length < 3) return null;
  const options = shuffle([correct, ...shuffle(pool).slice(0, 3)]);
  if (new Set(options.map(x => x.toLowerCase())).size !== options.length || options.some(x => x.length > 1000)) return null;
  return { prompt_en: prompt, options_en: options, answer_index: options.indexOf(correct), rationale_en: rationale, category, difficulty, source_quote: quote.slice(0, 2000), reference };
}

function buildRuleCandidates({ tools = [], procedures = [], ipcModules = [], ipcSteps = [], specialtyCode, categories = CATEGORIES }) {
  const want = new Set(categories), out = [], seen = new Set();
  const add = q => { if (q && want.has(q.category) && !seen.has(q.prompt_en)) { seen.add(q.prompt_en); out.push(q); } };
  const subset = tools.filter(t => String(t.specialtyId) === String(specialtyCode) && clean(t.nameEn));
  const names = [...new Set(subset.map(t => clean(t.nameEn)))];
  for (const t of subset) {
    const name = clean(t.nameEn), use = clean(t.useEn);
    if (!use) continue;
    const quote = `${name}: ${use}`, reference = 'Tools:' + t.id;
    const otherUses = subset.filter(x => clean(x.nameEn) !== name).map(x => clean(x.useEn)).filter(u => u && u !== use);
    add(mcq({ prompt: 'Which instrument or supply is used for this purpose? ' + use, correct: name, wrong: names.filter(n => n !== name), category: 'instrument_name', rationale: `The catalog documents "${name}" for: ${use}`, quote, reference }));
    add(mcq({ prompt: `What is the documented purpose of ${name}?`, correct: use, wrong: otherUses, category: 'instrument_use', rationale: `The catalog documents the purpose of ${name} as: ${use}`, quote, reference }));
  }
  const byId = new Map(subset.map(t => [String(t.id), t]));
  for (const p of procedures.filter(x => String(x.specialtyId) === String(specialtyCode))) {
    const pname = clean(p.nameEn); if (!pname) continue;
    const ids = [...parseArray(p.toolIds), ...parseArray(p.consumableIds)].map(String);
    const listed = [...new Set(ids.map(id => byId.get(id)).filter(Boolean).map(t => clean(t.nameEn)))];
    if (!listed.length) continue;
    const notListed = names.filter(n => !listed.includes(n));
    const quote = `${pname} checklist: ${listed.join(', ')}`, reference = 'Procedures:' + p.id;
    for (const item of shuffle(listed).slice(0, 2)) add(mcq({ prompt: `Which item is included in the documented preparation checklist for ${pname}?`, correct: item, wrong: notListed, category: 'procedure_preparation', rationale: `${item} is listed in the ${pname} preparation checklist.`, quote, reference }));
    if (listed.length >= 3) {
      const outside = shuffle(notListed)[0];
      if (outside) add(mcq({ prompt: `Which item is NOT part of the documented preparation checklist for ${pname}?`, correct: outside, wrong: listed, category: 'procedure_preparation', difficulty: 'intermediate', rationale: `The ${pname} checklist lists ${listed.join(', ')}; ${outside} is not listed.`, quote, reference }));
    }
  }
  for (const m of ipcModules) {
    const title = clean(m.nameEn || m.titleEn); if (!title) continue;
    const steps = ipcSteps.filter(s => String(s.moduleId) === String(m.id)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0)).map(s => clean(s.textEn)).filter(Boolean);
    if (steps.length < 4 || new Set(steps).size !== steps.length) continue;
    const quote = `${title} steps: ` + steps.map((s, i) => `${i + 1}. ${s}`).join(' ');
    for (let i = 0; i < steps.length - 1; i++) add(mcq({ prompt: `In "${title}", which step comes immediately after: "${steps[i]}"?`, correct: steps[i + 1], wrong: steps.filter((_, k) => k !== i && k !== i + 1), category: 'sequence', difficulty: 'intermediate', rationale: `In the documented ${title} sequence, step ${i + 2} follows step ${i + 1}.`, quote, reference: 'IPC_Modules:' + m.id }));
    add(mcq({ prompt: `In "${title}", which step comes first?`, correct: steps[0], wrong: steps.slice(1), category: 'sequence', rationale: `The documented ${title} sequence starts with: ${steps[0]}`, quote, reference: 'IPC_Modules:' + m.id }));
  }
  return out;
}

// Round-robin across categories so one large category does not crowd out the others.
function balance(candidates, count) {
  const groups = new Map();
  for (const q of shuffle(candidates)) { if (!groups.has(q.category)) groups.set(q.category, []); groups.get(q.category).push(q); }
  const picked = [];
  while (picked.length < count && [...groups.values()].some(g => g.length)) for (const g of groups.values()) if (g.length && picked.length < count) picked.push(g.pop());
  return picked;
}

module.exports = async ({ req, url, body, c, userId, centerId, role, mustUUID, deny }) => {
  if (url.pathname !== '/api/content/rule-candidates' || req.method !== 'POST') return { handled: false };
  if (role.role !== 'admin') deny();
  const sid = mustUUID(body.specialtyId), count = body.count;
  if (!Number.isInteger(count) || count < 1 || count > 50) fail('INVALID_COUNT');
  const categories = Array.isArray(body.categories) && body.categories.length ? body.categories : CATEGORIES;
  if (categories.some(x => !CATEGORIES.includes(x))) fail('INVALID_CATEGORY');
  const spec = (await c.query('select id,code from qib.specialties where id=$1', [sid])).rows[0];
  if (!spec) fail('INVALID_SPECIALTY');
  const rows = await c.query("select source_name,payload from qib.legacy_catalog l where source_name=any($1::text[]) and not exists(select 1 from qib.migration_issues i where i.source_name=l.source_name and i.legacy_id=l.legacy_id and i.resolved_at is null)", [['Tools', 'Procedures', 'IPC_Modules', 'IPC_Steps']]);
  const get = n => rows.rows.filter(x => x.source_name === n).map(x => x.payload);
  const all = buildRuleCandidates({ tools: get('Tools'), procedures: get('Procedures'), ipcModules: get('IPC_Modules'), ipcSteps: get('IPC_Steps'), specialtyCode: spec.code, categories });
  const existing = new Set((await c.query("select question->>'prompt_en' as p from qib.question_candidates where center_id=$1 and specialty_id=$2 and status<>'rejected'", [centerId, sid])).rows.map(r => r.p));
  const fresh = all.filter(q => !existing.has(q.prompt_en)), chosen = balance(fresh, count);
  for (const q of chosen) {
    const question = { mediaAssetId: null, prompt_en: q.prompt_en, options_en: q.options_en, answer_index: q.answer_index, rationale_en: q.rationale_en, sourceReference: q.reference };
    await c.query("insert into qib.question_candidates(center_id,specialty_id,source_quote,category,difficulty,question,origin,created_by) values($1,$2,$3,$4,$5,$6,'catalog_rule_draft',$7)", [centerId, sid, q.source_quote, q.category, q.difficulty, JSON.stringify(question), userId]);
  }
  const byCategory = {}; for (const q of chosen) byCategory[q.category] = (byCategory[q.category] || 0) + 1;
  return { handled: true, data: { created: chosen.length, available: fresh.length, byCategory, status: 'draft', clinicalReviewRequired: true, aiUsed: false } };
};
module.exports.buildRuleCandidates = buildRuleCandidates;
module.exports.balance = balance;
module.exports.CATEGORIES = CATEGORIES;
