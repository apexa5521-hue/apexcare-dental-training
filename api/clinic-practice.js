'use strict';
// Guided learning only. No examination scores, certificates or practical observations.
const pack=require('../content/nse-dental.json');
const SLUGS=pack.modules.map(m=>m.slug),VERSION=1;
const fail=(m,status=400)=>{throw Object.assign(Error(m),{status})};
const ids=v=>{if(Array.isArray(v))return v.map(String);try{return ids(JSON.parse(v||'[]'))}catch{return []}};
const keys=rows=>Object.fromEntries(rows.map(m=>[m.slug,{id:m.id,version:m.version}]));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
async function sources(c,centerId){return (await c.query("select id,slug,version,status,translations from qib.modules where center_id=$1 and slug=any($2::text[]) order by slug",[centerId,SLUGS])).rows}
async function authorized(c,userId,centerId,role,deny){if(role.role==='nurse'&&!(await c.query("select 1 from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.center_id=$1 and a.user_id=$2 and s.code in ('gp','dental')",[centerId,userId])).rowCount)deny()}
async function catalog(c){
 const rows=(await c.query("select source_name,legacy_id,payload from qib.legacy_catalog where source_name=any($1::text[]) order by legacy_id",[['Tools','Procedures']])).rows;
 const tools=rows.filter(r=>r.source_name==='Tools').map(r=>({...r.payload,id:r.legacy_id})).filter(t=>['gp','dental'].includes(t.specialtyId));const by=new Map(tools.map(t=>[t.id,t]));
 const broken=new Set((await c.query("select legacy_id from qib.migration_issues where source_name='Procedures' and resolved_at is null")).rows.map(r=>r.legacy_id));
 const procedures=rows.filter(r=>r.source_name==='Procedures'&&['gp','dental'].includes(r.payload.specialtyId)).map(r=>({...r.payload,id:r.legacy_id})).filter(p=>{const all=[...new Set([...ids(p.toolIds),...ids(p.consumableIds)])];return !broken.has(p.id)&&all.length>0&&all.length<=30&&all.every(id=>by.has(id))});return {tools,procedures};
}
function view(s){return {id:s.id,step:s.step,status:s.status,preview:s.preview,procedure:s.snapshot.procedure,tools:s.snapshot.tools,lessons:s.snapshot.lessons,scenarioVersion:s.snapshot.version,events:s.events,awardsCompetency:false}}
module.exports=async({req,url,body,c,userId,centerId,role,mustUUID,deny})=>{
 if(!url.pathname.startsWith('/api/clinic/'))return {handled:false};
 await authorized(c,userId,centerId,role,deny);
 if(req.method==='GET'&&url.pathname==='/api/clinic/setup'){
  const lessons=await sources(c,centerId),ready=lessons.length===SLUGS.length&&lessons.every(m=>m.status==='published'),review=(await c.query('select * from qib.clinic_reviews where center_id=$1',[centerId])).rows[0];
  const approved=ready&&review?.scenario_version===VERSION&&same(review.source_versions,keys(lessons));
  const cat=await catalog(c),sessions=(await c.query('select id,status,step,preview,procedure_id,updated_at from qib.clinic_practice_sessions where center_id=$1 and user_id=$2 order by updated_at desc limit 10',[centerId,userId])).rows;
  return {handled:true,data:{ready:!!approved,canPreview:role.role==='admin',canReview:role.role==='admin'&&ready,sourceCount:lessons.length,publishedCount:lessons.filter(m=>m.status==='published').length,requiredCount:SLUGS.length,procedures:cat.procedures.map(({id,nameAr,nameEn,nameUr,nameId})=>({id,nameAr,nameEn,nameUr,nameId})),sessions}};
 }
 if(req.method==='POST'&&url.pathname==='/api/clinic/review'){
  if(role.role!=='admin')deny();const note=String(body.note||'').trim();if(note.length<20||note.length>2000||body.confirmed!==true)fail('CLINIC_REVIEW_REQUIRED');const lessons=await sources(c,centerId);if(lessons.length!==SLUGS.length||lessons.some(m=>m.status!=='published'))fail('CLINIC_SOURCES_NOT_PUBLISHED',409);
  await c.query('insert into qib.clinic_reviews(center_id,scenario_version,source_versions,reviewed_by,review_note) values($1,$2,$3,$4,$5) on conflict(center_id) do update set scenario_version=excluded.scenario_version,source_versions=excluded.source_versions,reviewed_by=excluded.reviewed_by,review_note=excluded.review_note,reviewed_at=now()',[centerId,VERSION,JSON.stringify(keys(lessons)),userId,note]);return {handled:true,data:{reviewed:true}};
 }
 if(req.method==='POST'&&url.pathname==='/api/clinic/start'){
  if(body.mode&&body.mode!=='guided')fail('CLINIC_ASSESSMENT_NOT_AVAILABLE');
  let lessons=await sources(c,centerId);const review=(await c.query('select * from qib.clinic_reviews where center_id=$1',[centerId])).rows[0];const ready=lessons.length===SLUGS.length&&lessons.every(m=>m.status==='published')&&review?.scenario_version===VERSION&&same(review.source_versions,keys(lessons));const preview=body.preview===true;
  if(preview&&role.role!=='admin')deny();if(!preview&&!ready)fail('CLINIC_REVIEW_REQUIRED',409);
  if(preview)lessons=SLUGS.map(slug=>lessons.find(m=>m.slug===slug)||{slug,version:pack.version,status:'draft',translations:pack.modules.find(m=>m.slug===slug).translations});
  const cat=await catalog(c),p=cat.procedures.find(p=>p.id===body.procedureId);if(!p)fail('CLINIC_PROCEDURE_NOT_READY',409);
  const required=[...new Set([...ids(p.toolIds),...ids(p.consumableIds)])];const chosen=cat.tools.filter(t=>required.includes(t.id));const distractors=cat.tools.filter(t=>!required.includes(t.id)).slice(0,3);
  const safeTool=t=>Object.fromEntries(['id','nameAr','nameEn','nameUr','nameId','useAr','useEn','useUr','useId','imageUrl'].map(k=>[k,t[k]||'']));
  const snapshot={version:VERSION,procedure:{id:p.id,nameAr:p.nameAr,nameEn:p.nameEn,nameUr:p.nameUr,nameId:p.nameId},requiredTools:required,tools:[...chosen,...distractors].map(safeTool).sort((a,b)=>a.id.localeCompare(b.id)),lessons:SLUGS.map(slug=>lessons.find(m=>m.slug===slug))};
  const s=(await c.query('insert into qib.clinic_practice_sessions(center_id,user_id,procedure_id,snapshot,preview) values($1,$2,$3,$4,$5) returning *',[centerId,userId,p.id,JSON.stringify(snapshot),preview])).rows[0];return {handled:true,data:view(s)};
 }
 if(['/api/clinic/session','/api/clinic/act'].includes(url.pathname)){
  const id=mustUUID(body.sessionId||url.searchParams.get('sessionId'));const s=(await c.query('select * from qib.clinic_practice_sessions where id=$1 and center_id=$2 and user_id=$3 for update',[id,centerId,userId])).rows[0];if(!s)deny();if(s.preview&&role.role!=='admin')deny();
  if(!s.preview){const lessons=await sources(c,centerId),review=(await c.query('select * from qib.clinic_reviews where center_id=$1',[centerId])).rows[0];if(lessons.some(m=>m.status!=='published')||lessons.length!==SLUGS.length||!same(keys(lessons),keys(s.snapshot.lessons))||!same(review?.source_versions,keys(lessons))||review?.scenario_version!==VERSION)fail('CLINIC_SOURCE_CHANGED',409)}
  if(req.method==='GET'&&url.pathname==='/api/clinic/session')return {handled:true,data:view(s)};
  if(req.method==='POST'&&url.pathname==='/api/clinic/act'){
   if(body.step!==s.step||s.status!=='active')fail('CLINIC_STEP_CHANGED',409);if(s.events.length>=100)fail('CLINIC_RESTART_REQUIRED',409);
   let accepted=false;const action=body.action;
   if(s.step===2){const selected=body.tools;if(!Array.isArray(selected)||selected.length>40||selected.some(id=>typeof id!=='string'||!s.snapshot.tools.some(t=>t.id===id))||new Set(selected).size!==selected.length)fail('INVALID_CLINIC_TOOLS');accepted=same([...selected].sort(),[...s.snapshot.requiredTools].sort())}
   else accepted=action===['receive','prepare',null,'pause','handover'][s.step];
   const event={step:s.step,action:s.step===2?'tray':String(action||'').slice(0,30),accepted,at:new Date().toISOString(),...(s.step===2?{tools:body.tools}:{})};
   if(!accepted&&s.step!==2&&!['receive','prepare','pause','handover','rush','ignore'].includes(action))fail('INVALID_CLINIC_ACTION');
   const next=s.step+(accepted?1:0),events=[...s.events,event];const updated=(await c.query("update qib.clinic_practice_sessions set step=$1,status=$2,events=$3,updated_at=now() where id=$4 returning *",[next,next===5?'completed':'active',JSON.stringify(events),id])).rows[0];return {handled:true,data:{...view(updated),accepted,feedback:accepted?'STEP_RECORDED':'REVIEW_SOURCE_AND_RETRY'}};
  }
 }
 return {handled:false};
};
