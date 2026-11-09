'use strict';
// Content-bound assistant: searches only the platform's own catalog and published lessons,
// in Arabic, English, Urdu and Indonesian. No AI provider, no external calls.
const fail = (message, status = 400) => { throw Object.assign(Error(message), { status }); };
const LANGS = ['ar', 'en', 'ur', 'id'], CAP = { ar: 'Ar', en: 'En', ur: 'Ur', id: 'Id' };

// Lowercase, drop Arabic diacritics/tatweel, unify alef/ya/taa-marbuta forms and Latin accents.
function norm(text) {
  return String(text || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ی/g, 'ي').replace(/ة/g, 'ه').replace(/ک/g, 'ك')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
const parse = v => { if (Array.isArray(v)) return v; try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : []; } catch { return []; } };
const pick = (row, field) => Object.fromEntries(LANGS.map(l => [l, String(row[field + CAP[l]] || '').trim()]));

// Higher is better: whole-name match, name prefix, every term in name, every term anywhere.
function score(names, extra, terms, phrase) {
  const n = names.map(norm).filter(Boolean), all = n.join(' ') + ' ' + extra.map(norm).join(' ');
  if (n.some(x => x === phrase)) return 100;
  if (n.some(x => x.startsWith(phrase))) return 80;
  if (terms.every(t => n.some(x => x.includes(t)))) return 60;
  if (terms.every(t => all.includes(t))) return 30;
  return 0;
}
const top = (items, limit) => items.filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _, ...rest }) => rest);

function snippet(body, terms) {
  const text = String(body || '').replace(/\s+/g, ' ').trim(), lower = norm(text);
  const at = Math.max(0, ...terms.map(t => lower.indexOf(t)).filter(i => i >= 0).slice(0, 1));
  const start = Math.max(0, at - 60);
  return (start ? '…' : '') + text.slice(start, start + 220) + (text.length > start + 220 ? '…' : '');
}

function search({ q, tools, procedures, ipcModules, ipcSteps, lessons }) {
  const phrase = norm(q), terms = phrase.split(' ').filter(Boolean);
  if (phrase.length < 2 || terms.length > 8) fail('INVALID_SEARCH');
  const toolById = new Map(tools.map(t => [String(t.id), t]));
  const toolHits = top(tools.map(t => {
    const names = pick(t, 'name'), uses = pick(t, 'use');
    return { score: score(Object.values(names), Object.values(uses), terms, phrase), id: String(t.id), specialtyId: String(t.specialtyId || ''), names, uses, imageUrl: /^https:\/\//i.test(t.imageUrl || '') ? t.imageUrl : null, t };
  }), 8).map(({ t, ...hit }) => ({
    ...hit,
    procedures: procedures.filter(p => [...parse(p.toolIds), ...parse(p.consumableIds)].map(String).includes(hit.id)).slice(0, 6).map(p => ({ id: String(p.id), names: pick(p, 'name') }))
  }));
  const procHits = top(procedures.map(p => {
    const names = pick(p, 'name'), ids = [...parse(p.toolIds), ...parse(p.consumableIds)].map(String);
    const linked = ids.map(id => toolById.get(id)).filter(Boolean);
    return { score: score(Object.values(names), linked.map(t => t.nameEn), terms, phrase), id: String(p.id), specialtyId: String(p.specialtyId || ''), names, tools: linked.slice(0, 15).map(t => ({ id: String(t.id), names: pick(t, 'name') })), unresolvedItems: ids.length - linked.length };
  }), 6);
  const ipcHits = top(ipcModules.map(m => {
    const names = Object.fromEntries(LANGS.map(l => [l, String(m['name' + CAP[l]] || m['title' + CAP[l]] || '').trim()]));
    const steps = ipcSteps.filter(s => String(s.moduleId) === String(m.id)).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    return { score: score(Object.values(names), steps.flatMap(s => LANGS.map(l => s['text' + CAP[l]])), terms, phrase), id: String(m.id), names, steps: steps.slice(0, 12).map(s => pick(s, 'text')) };
  }), 4);
  const lessonHits = top(lessons.map(m => {
    const t = m.translations || {}, titles = Object.fromEntries(LANGS.map(l => [l, String(t[l]?.title || '')]));
    const bodyLang = LANGS.find(l => terms.every(x => norm(t[l]?.body).includes(x))) || 'en';
    return { score: score(Object.values(titles), LANGS.map(l => t[l]?.body), terms, phrase), id: m.id, titles, snippet: snippet(t[bodyLang]?.body, terms), snippetLanguage: bodyLang };
  }), 6);
  return { query: q, tools: toolHits, procedures: procHits, infectionPrevention: ipcHits, lessons: lessonHits, sourceBound: true, aiUsed: false };
}

module.exports = async ({ req, url, c, userId, centerId, role }) => {
  if (req.method !== 'GET' || url.pathname !== '/api/search') return { handled: false };
  const q = String(url.searchParams.get('q') || '').slice(0, 80);
  const [catalog, modules] = await Promise.all([
    c.query("select source_name,payload from qib.legacy_catalog where source_name=any($1::text[])", [['Tools', 'Procedures', 'IPC_Modules', 'IPC_Steps']]),
    c.query("select id,specialty_id,translations from qib.modules where status='published' and (center_id=$1 or center_id is null)", [centerId])
  ]);
  const get = n => catalog.rows.filter(x => x.source_name === n).map(x => x.payload);
  let tools = get('Tools'), procedures = get('Procedures'), lessons = modules.rows;
  if (role.role === 'nurse') {
    const assigned = await c.query('select s.id,s.code from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2', [userId, centerId]);
    const codes = new Set(assigned.rows.map(x => String(x.code))), ids = new Set(assigned.rows.map(x => x.id));
    tools = tools.filter(t => codes.has(String(t.specialtyId)));
    procedures = procedures.filter(p => codes.has(String(p.specialtyId)));
    lessons = lessons.filter(m => !m.specialty_id || ids.has(m.specialty_id));
  }
  return { handled: true, data: search({ q, tools, procedures, ipcModules: get('IPC_Modules'), ipcSteps: get('IPC_Steps'), lessons }) };
};
module.exports.search = search;
module.exports.norm = norm;
