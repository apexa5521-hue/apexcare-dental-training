"use strict";
// Produces owner-only SQL batches for an isolated NSE database, never source writes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {normalizedRows}=require('./import-catalog');
const {prepareHistory}=require('./import-history');
function sqlJson(value){const text=JSON.stringify(value),tag='$nse_'+crypto.randomBytes(12).toString('hex')+'$';return tag+text+tag+'::jsonb'}
function build(raw){
 const catalog=normalizedRows(raw,{allowUnresolved:true}),history=prepareHistory(raw);
 const known=new Set([...Object.keys(catalog.counts),...Object.keys(history.counts),'counts','format','createdAt']);
 const unknown=Object.keys(raw).filter(k=>!known.has(k));if(unknown.length)throw Error('Unmapped source sheets: '+unknown.join(','));
 const setup=`begin;
alter table qib.legacy_catalog drop constraint if exists legacy_catalog_source_name_check;
alter table qib.legacy_catalog add constraint legacy_catalog_source_name_check check(source_name in ('Specialties','Tools','Procedures','IPC_Modules','IPC_Steps','Quizzes','AssessmentBank','AssessmentConfig','Doctors','DoctorPrefs'));
alter table qib.legacy_history_archive drop constraint if exists legacy_history_archive_source_name_check;
alter table qib.legacy_history_archive add constraint legacy_history_archive_source_name_check check(source_name in ('Users','AssessmentResults','NurseProgress','DrillProgress','Logs','Mastery'));
create table if not exists qib.migration_issues(source_name text not null,legacy_id text not null,field text not null,missing_id text not null,resolved_at timestamptz,primary key(source_name,legacy_id,field,missing_id));
alter table qib.migration_issues enable row level security;
revoke all on qib.migration_issues from public,anon,authenticated;
commit;`;
 const batches=[setup];
 for(let i=0;i<catalog.records.length;i+=400){
  const data=catalog.records.slice(i,i+400).map(x=>({source_name:x.source,legacy_id:x.id,specialty_legacy_id:x.specialtyId,payload:x.payload,content_hash:x.hash}));
  batches.push(`begin;insert into qib.legacy_catalog(source_name,legacy_id,specialty_legacy_id,payload,content_hash) select source_name,legacy_id,specialty_legacy_id,payload,content_hash from jsonb_to_recordset(${sqlJson(data)}) as x(source_name text,legacy_id text,specialty_legacy_id text,payload jsonb,content_hash text) on conflict(source_name,legacy_id) do update set specialty_legacy_id=excluded.specialty_legacy_id,payload=excluded.payload,content_hash=excluded.content_hash;commit;select count(*) as catalog_records from qib.legacy_catalog;`);
 }
 const historyBatches=[];let group=[],bytes=0;
 for(const row of history.rows){const size=Buffer.byteLength(JSON.stringify(row));if(bytes+size>350000&&group.length){historyBatches.push(group);group=[];bytes=0}group.push(row);bytes+=size;}if(group.length)historyBatches.push(group);
 for(const batch of historyBatches){
  const data=batch.map(x=>({source_name:x.name,legacy_key:x.key,payload:x.payload,content_hash:x.hash}));
  batches.push(`begin;insert into qib.legacy_history_archive(source_name,legacy_key,payload,content_hash) select source_name,legacy_key,payload,content_hash from jsonb_to_recordset(${sqlJson(data)}) as x(source_name text,legacy_key text,payload jsonb,content_hash text) on conflict(source_name,legacy_key) do update set payload=excluded.payload,content_hash=excluded.content_hash;commit;select count(*) as archived_records from qib.legacy_history_archive;`);
 }
 const issueRows=catalog.issues.map(x=>({source_name:x.source,legacy_id:x.legacyId,field:x.field,missing_id:x.missingId}));
 const counts={...catalog.counts,...history.counts};
 batches.push(`begin;
create unique index if not exists nse_legacy_identity_single_center on qib.legacy_identity_map(legacy_username);
update qib.legacy_catalog set specialty_legacy_id=payload->>'groupId' where source_name='Quizzes';
insert into qib.specialties(code,label) select legacy_id,coalesce(nullif(payload->>'nameEn',''),payload->>'nameAr',legacy_id) from qib.legacy_catalog where source_name='Specialties' on conflict(code) do update set label=excluded.label;
insert into qib.migration_issues(source_name,legacy_id,field,missing_id) select source_name,legacy_id,field,missing_id from jsonb_to_recordset(${sqlJson(issueRows)}) as x(source_name text,legacy_id text,field text,missing_id text) on conflict do nothing;
do $verify$ declare expected jsonb := ${sqlJson(counts)}; k text; n int; actual int; begin
for k,n in select key,value::int from jsonb_each_text(expected) loop
select count(*) into actual from (select source_name from qib.legacy_catalog union all select source_name from qib.legacy_history_archive) x where source_name=k;
if actual<>n then raise exception 'Count mismatch for %: % vs %',k,actual,n;end if;end loop;end $verify$;
insert into qib.migration_runs(source_fingerprint,source_counts,imported_counts,notes) values('${catalog.fingerprint}:${history.fingerprint}',${sqlJson(counts)},${sqlJson(counts)},'Read-only workbook export; legacy credentials excluded. Unresolved source links preserved in migration_issues; clinical acceptance pending.');
commit;
select source_name,count(*)::int as records from (select source_name from qib.legacy_catalog union all select source_name from qib.legacy_history_archive) x group by 1 order by 1;`);
 return {batches,counts,issues:catalog.issues};
}
if(require.main===module){const raw=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),out=process.argv[3],result=build(raw);fs.mkdirSync(out,{recursive:true,mode:0o700});result.batches.forEach((s,i)=>fs.writeFileSync(path.join(out,`batch-${String(i).padStart(2,'0')}.sql`),s,{mode:0o600}));console.log(JSON.stringify({batches:result.batches.length,counts:result.counts,sourceIntegrityIssues:result.issues.length}));}
module.exports={build};
