"use strict";
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
module.exports=async({req,url,body,c,userId,centerId,role,mustUUID,deny})=>{
 const route=url.pathname,admin=role.role==='admin';
 if(req.method==='POST'&&route==='/api/modules/request-review'){
  if(!admin)deny();const r=await c.query("update qib.modules set status='review',updated_at=now() where id=$1 and center_id=$2 and status='draft' returning id,version",[mustUUID(body.moduleId),centerId]);if(!r.rowCount)fail('DRAFT_REQUIRED',409);return {handled:true,data:{module:r.rows[0],status:'review'}};
 }
 if(req.method==='POST'&&route==='/api/modules/publish'){
  if(!admin)deny();const note=String(body.reviewerNote||'').trim();if(note.length<12||note.length>2000)fail('CLINICAL_REVIEW_NOTE_REQUIRED');
  const r=await c.query('select * from qib.modules where id=$1 and center_id=$2 for update',[mustUUID(body.moduleId),centerId]);if(!r.rowCount)deny();const m=r.rows[0];if(m.status!=='review')fail('CONTENT_REVIEW_REQUIRED',409);
  const missing=['ar','en','ur','id'].filter(l=>typeof m.translations?.[l]?.title!=='string'||!m.translations[l].title.trim()||typeof m.translations[l].body!=='string'||!m.translations[l].body.trim());if(missing.length)fail('TRANSLATIONS_REQUIRED_'+missing.join('_'),409);
  await c.query('insert into qib.content_revisions(module_id,editor_id,version,snapshot) values($1,$2,$3,$4)',[m.id,userId,m.version,JSON.stringify({action:'clinical_publish_review',reviewerNote:note,reviewedAt:new Date().toISOString(),module:m})]);await c.query("update qib.modules set status='published',updated_at=now() where id=$1",[m.id]);return {handled:true,data:{published:true,id:m.id}};
 }
 if(req.method==='POST'&&route==='/api/modules/import-ipc'){
  if(!admin)deny();const owner=await c.query('select 1 from qib.platform_owners where user_id=$1',[userId]);if(!owner.rowCount)deny();
  const rows=await c.query("select source_name,payload from qib.legacy_catalog where source_name in ('IPC_Modules','IPC_Steps') order by legacy_id");let created=0,existing=0;
  for(const row of rows.rows.filter(x=>x.source_name==='IPC_Modules')){const m=row.payload,id=String(m.id),slug='legacy-ipc-'+Buffer.from(id).toString('hex').slice(0,48),translations={};const steps=rows.rows.filter(x=>x.source_name==='IPC_Steps'&&String(x.payload.moduleId)===id).map(x=>x.payload).sort((a,b)=>Number(a.order||0)-Number(b.order||0));
   for(const lang of ['en','ar','ur','id']){const cap=lang[0].toUpperCase()+lang.slice(1),title=m['name'+cap]||m['title'+cap]||'',texts=steps.map(s=>s['text'+cap]||'');translations[lang]={title:String(title),body:texts.every(x=>String(x).trim())?texts.map(String).join('\n\n'):''}}
   if(!translations.en.title)continue;const r=await c.query("insert into qib.modules(center_id,slug,translations,status) values($1,$2,$3,'draft') on conflict(center_id,slug) do nothing returning id",[centerId,slug,JSON.stringify(translations)]);if(r.rowCount)created++;else existing++;
  }return {handled:true,data:{created,existing,status:'draft',requiresTranslationAndClinicalReview:true}};
 }
 if(req.method==='POST'&&route==='/api/exams/schedule'){
  if(!admin)deny();const id=mustUUID(body.assessmentId),note=String(body.reason||'').trim(),start=body.startsAt?new Date(body.startsAt):null,end=body.endsAt?new Date(body.endsAt):null;
  if(note.length<12||note.length>2000||(!start&&!end)||(start&&!Number.isFinite(+start))||(end&&!Number.isFinite(+end))||(start&&end&&+end<=+start))fail('INVALID_SCHEDULE');
  const exam=await c.query('select id from qib.assessments where id=$1 and center_id=$2 for update',[id,centerId]);if(!exam.rowCount)deny();
  const attempts=await c.query('select 1 from qib.attempts where assessment_id=$1 limit 1',[id]);if(attempts.rowCount)fail('SCHEDULE_LOCKED_AFTER_ATTEMPT',409);
  await c.query('update qib.assessments set starts_at=$2,ends_at=$3 where id=$1',[id,start?.toISOString()||null,end?.toISOString()||null]);await c.query('insert into qib.assessment_reviews(assessment_id,reviewer_id,note) values($1,$2,$3)',[id,userId,'Schedule updated: '+JSON.stringify({startsAt:start,endsAt:end,reason:note})]);return {handled:true,data:{scheduled:true}};
 }
 if(req.method==='GET'&&route==='/api/onboarding/status'){
  if(!admin)deny();const [members,legacy]=await Promise.all([c.query('select role,count(*)::int as count from qib.memberships where center_id=$1 group by role',[centerId]),c.query("select count(*)::int as count from qib.legacy_history_archive where source_name='Users'")]);return {handled:true,data:{members:members.rows,archivedUsers:legacy.rows[0].count,invitationsConfigured:!!process.env.SUPABASE_SECRET_KEY,legacyPasswordsMigrated:false,identityVerificationRequired:true}};
 }
 return {handled:false};
};
