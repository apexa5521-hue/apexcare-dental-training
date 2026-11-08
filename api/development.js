"use strict";
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status})};
module.exports=async function development({req,url,body,c,userId,centerId,role,mustUUID,deny}){
 const supervisor=['admin','supervisor'].includes(role.role),route=url.pathname;
 const targetMember=async id=>{const r=await c.query('select 1 from qib.memberships where center_id=$1 and user_id=$2',[centerId,id]);if(!r.rowCount)deny()};
 const notify=async(id,kind,text)=>c.query('insert into qib.notifications(center_id,user_id,kind,body) values($1,$2,$3,$4)',[centerId,id,kind,text]);
 if(req.method==='GET'&&route==='/api/development'){
  const [plans,notifications,activity,skills]=await Promise.all([
   c.query("select id,specialty_id,steps,status from qib.learning_plans where center_id=$1 and user_id=$2 order by id",[centerId,userId]),
   c.query('select id,kind,body,read_at,created_at from qib.notifications where center_id=$1 and user_id=$2 order by created_at desc limit 50',[centerId,userId]),
   c.query("select (completed_at at time zone 'Asia/Riyadh')::date as day,count(*)::int as lessons from qib.module_progress where center_id=$1 and user_id=$2 and (completed_at at time zone 'Asia/Riyadh')>=date_trunc('week',now() at time zone 'Asia/Riyadh') group by 1 order by day",[centerId,userId]),
   c.query('select s.id,s.name_en,s.specialty_id,s.rubric from qib.skill_definitions s where exists(select 1 from qib.assignments a where a.center_id=$1 and a.user_id=$2 and a.specialty_id=s.specialty_id)',[centerId,userId])]);
  return {handled:true,data:{plans:plans.rows,notifications:notifications.rows,activity:activity.rows,skills:skills.rows}};
 }
 if(req.method==='POST'&&route==='/api/notifications/read'){
  const r=await c.query('update qib.notifications set read_at=coalesce(read_at,now()) where id=$1 and center_id=$2 and user_id=$3 returning id',[mustUUID(body.id),centerId,userId]);if(!r.rowCount)deny();return {handled:true,data:{read:true}};
 }
 if(req.method==='GET'&&route==='/api/development/team'){
  if(!supervisor)deny();const [plans,skills,paused,certificates,attempts]=await Promise.all([
   c.query('select p.id,p.user_id,p.steps,p.status,m.display_name from qib.learning_plans p join qib.memberships m on m.user_id=p.user_id and m.center_id=p.center_id where p.center_id=$1 order by m.display_name',[centerId]),
   c.query('select id,specialty_id,name_en,rubric from qib.skill_definitions where specialty_id in(select specialty_id from qib.assignments where center_id=$1) order by name_en',[centerId]),
   c.query("select a.id,a.user_id,t.title,a.deadline_at,m.display_name from qib.attempts a join qib.assessments t on t.id=a.assessment_id join qib.memberships m on m.user_id=a.user_id and m.center_id=a.center_id where a.center_id=$1 and a.status='paused_review' order by a.started_at",[centerId]),
   c.query('select c.id,c.kind,c.user_id,c.issued_at,c.revoked_at,m.display_name from qib.certificates c join qib.memberships m on m.user_id=c.user_id and m.center_id=c.center_id where c.center_id=$1 order by c.issued_at desc limit 100',[centerId]),c.query("select a.id,a.assessment_id,a.user_id,a.attempt_number,a.status,a.score,t.title,m.display_name,exists(select 1 from qib.retake_grants g where g.previous_attempt_id=a.id and g.used_by_attempt_id is null and g.expires_at>now()) as retake_granted from qib.attempts a join qib.assessments t on t.id=a.assessment_id join qib.memberships m on m.user_id=a.user_id and m.center_id=a.center_id where a.center_id=$1 and a.status in ('submitted','void') and not exists(select 1 from qib.attempts newer where newer.assessment_id=a.assessment_id and newer.user_id=a.user_id and newer.attempt_number>a.attempt_number) order by a.started_at desc limit 100",[centerId])]);return {handled:true,data:{plans:plans.rows,skills:skills.rows,paused:paused.rows,certificates:certificates.rows,attempts:attempts.rows}};
 }
 if(req.method==='POST'&&route==='/api/plans/create'){
  if(!supervisor)deny();const target=mustUUID(body.userId),spec=mustUUID(body.specialtyId);await targetMember(target);
  const assigned=await c.query('select 1 from qib.assignments where center_id=$1 and user_id=$2 and specialty_id=$3',[centerId,target,spec]);if(!assigned.rowCount)fail('SPECIALTY_ASSIGNMENT_REQUIRED',409);
  if(!Array.isArray(body.steps)||body.steps.length<1||body.steps.length>20)fail('INVALID_PLAN_STEPS');
  const steps=body.steps.map(x=>{const title=String(x.title||'').trim();if(title.length<3||title.length>200||!['learning','practice','supervisor_review'].includes(x.kind))fail('INVALID_PLAN_STEP');return {title,kind:x.kind,done:false}});
  const r=await c.query("insert into qib.learning_plans(center_id,user_id,specialty_id,steps) values($1,$2,$3,$4) returning id",[centerId,target,spec,JSON.stringify(steps)]);await notify(target,'learning_plan','A new personalized learning plan is ready.');return {handled:true,data:{id:r.rows[0].id}};
 }
 if(req.method==='POST'&&route==='/api/plans/step'){
  const id=mustUUID(body.planId),index=body.index;if(!Number.isInteger(index)||index<0)fail('INVALID_STEP');
  const r=await c.query('select user_id,steps,status from qib.learning_plans where id=$1 and center_id=$2 for update',[id,centerId]);if(!r.rowCount)deny();const plan=r.rows[0];if(plan.user_id!==userId&&!supervisor)deny();
  const step=plan.steps[index];if(!step)fail('INVALID_STEP');if(step.kind==='supervisor_review'&&(!supervisor||plan.user_id===userId))deny();
  if(!step.done){step.done=true;step.completedAt=new Date().toISOString();step.recordedBy=userId;await c.query('update qib.learning_plans set steps=$2,status=$3 where id=$1',[id,JSON.stringify(plan.steps),plan.steps.every(x=>x.done)?'completed':'active']);if(plan.steps.every(x=>x.done))await notify(plan.user_id,'plan_completed','Your learning plan steps are complete. This does not automatically award clinical competency.');}
  return {handled:true,data:{steps:plan.steps,status:plan.steps.every(x=>x.done)?'completed':'active'}};
 }
 if(req.method==='POST'&&route==='/api/skills/create'){
  if(role.role!=='admin')deny();const owner=await c.query('select 1 from qib.platform_owners where user_id=$1',[userId]);if(!owner.rowCount)deny();
  const name=String(body.name||'').trim(),criteria=body.criteria;if(name.length<4||name.length>150||!Array.isArray(criteria)||criteria.length<1||criteria.length>20||criteria.some(x=>typeof x!=='string'||x.trim().length<4||x.length>250))fail('INVALID_RUBRIC');
  const r=await c.query('insert into qib.skill_definitions(specialty_id,name_en,rubric) values($1,$2,$3) returning id',[mustUUID(body.specialtyId),name,JSON.stringify({criteria:criteria.map(x=>x.trim()),reviewedBy:userId})]);return {handled:true,data:{id:r.rows[0].id}};
 }
 if(req.method==='POST'&&route==='/api/certificates/revoke'){
  if(!supervisor)deny();const reason=String(body.reason||'').trim();if(reason.length<8||reason.length>1000)fail('REVOCATION_REASON_REQUIRED');
  const r=await c.query("update qib.certificates set revoked_at=coalesce(revoked_at,now()),evidence=evidence||$3::jsonb where id=$1 and center_id=$2 and revoked_at is null returning user_id",[mustUUID(body.id),centerId,JSON.stringify({revocationReason:reason,revokedBy:userId})]);if(!r.rowCount)fail('CERTIFICATE_NOT_ACTIVE',409);await notify(r.rows[0].user_id,'certificate_revoked','A learning card was revoked. Contact your supervisor for the documented review.');return {handled:true,data:{revoked:true}};
 }
 if(req.method==='GET'&&route==='/api/certificates/verify'){
  const r=await c.query('select id,user_id,kind,issued_at,revoked_at,expires_at,evidence from qib.certificates where id=$1 and center_id=$2',[mustUUID(url.searchParams.get('id')),centerId]);if(!r.rowCount)deny();const x=r.rows[0];if(x.user_id!==userId&&!supervisor)deny();return {handled:true,data:{certificate:x,valid:!x.revoked_at&&(!x.expires_at||new Date(x.expires_at)>new Date())}};
 }
 return {handled:false};
};
