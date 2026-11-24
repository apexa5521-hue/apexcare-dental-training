'use strict';
// Read-only inventory diagnostics. Never repairs links or claims clinical approval.
const clean = value => String(value || '').trim();
function auditCatalog({ tools = [], procedures = [], specialties = [] }) {
  const issues = [], counts = {};
  const add = (kind, source, row, detail) => {
    counts[kind] = (counts[kind] || 0) + 1;
    if (issues.length < 200) issues.push({ kind, source, id: clean(row.id), name: clean(row.nameAr || row.nameEn), specialtyId: clean(row.specialtyId), detail });
  };
  const specialtyIds = new Set(specialties.map(s => clean(s.id || s.code)));
  const toolIds = new Set(tools.map(t => clean(t.id)));
  for (const [source, rows] of [['Tools', tools], ['Procedures', procedures]]) {
    const seen = new Set();
    for (const row of rows) {
      if (!clean(row.id)) add('missing_id', source, row, 'id');
      else if (seen.has(clean(row.id))) add('duplicate_id', source, row, clean(row.id));
      seen.add(clean(row.id));
      if (!specialtyIds.has(clean(row.specialtyId))) add('unknown_specialty', source, row, clean(row.specialtyId));
      for (const lang of ['Ar', 'En', 'Ur', 'Id']) {
        if (!clean(row['name' + lang])) add('missing_name_' + lang.toLowerCase(), source, row, lang);
        if (source === 'Tools' && !clean(row['use' + lang])) add('missing_purpose_' + lang.toLowerCase(), source, row, lang);
      }
      if (source === 'Tools' && !/^https:\/\//i.test(clean(row.imageUrl))) add('missing_or_non_https_image', source, row, 'Image URL only; availability not checked');
      if (source === 'Procedures') for (const field of ['toolIds', 'consumableIds']) {
        let values;
        try { values = Array.isArray(row[field]) ? row[field] : JSON.parse(row[field] || '[]'); if (!Array.isArray(values)) throw Error(); }
        catch { add('invalid_association_list', source, row, field); continue; }
        for (const id of values) if (!toolIds.has(String(id))) add('missing_tool_link', source, row, field + ':' + String(id));
      }
    }
  }
  return { totals: { specialties: specialties.length, tools: tools.length, procedures: procedures.length }, counts, issues, totalIssues: Object.values(counts).reduce((a,b) => a+b,0), detailsTruncated: Object.values(counts).reduce((a,b) => a+b,0) > issues.length, readOnly: true, clinicalApproval: false, imagesAvailabilityChecked: false };
}
module.exports = { auditCatalog };
