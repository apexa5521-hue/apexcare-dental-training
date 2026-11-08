'use strict';
function insights({attempts=[],observations=[]}){
 const latest=new Map();for(const a of attempts){const key=a.assessment_id;if(!latest.has(key))latest.set(key,a)}
 const gaps=[];for(const a of latest.values())if(a.score<75){const categories=new Map();for(const q of a.question_snapshot||[])if(a.answers?.[q.id]!==q.answer_index){const key=q.category||'general';categories.set(key,(categories.get(key)||0)+1)}gaps.push({kind:'knowledge',specialtyId:a.specialty_id,reference:a.id,title:a.title,score:a.score,categories:[...categories].map(([category,missed])=>({category,missed}))})}
 const skills=new Set();for(const o of observations){if(skills.has(o.skill_id))continue;skills.add(o.skill_id);if(o.status!=='competent')gaps.push({kind:'practice',specialtyId:o.specialty_id,reference:o.id,title:o.name_en,status:o.status})}return gaps;
}
async function gapsFor(c,centerId,userId){const [a,o]=await Promise.all([c.query("select a.id,a.assessment_id,a.score,a.answers,a.question_snapshot,x.specialty_id,x.title from qib.attempts a join qib.assessments x on x.id=a.assessment_id where a.center_id=$1 and a.user_id=$2 and a.status='submitted' order by a.started_at desc,a.id",[centerId,userId]),c.query('select o.id,o.skill_id,o.status,s.specialty_id,s.name_en from qib.skill_observations o join qib.skill_definitions s on s.id=o.skill_id where o.center_id=$1 and o.user_id=$2 order by o.observed_at desc,o.id',[centerId,userId])]);return insights({attempts:a.rows,observations:o.rows})}
async function reminderSweep(c){
 // Internal inbox only; no email, push, penalties or claims about motivation/ability.
 const r=await c.query("select distinct p.center_id,p.user_id from qib.learning_plans p where p.status='active' and not exists(select 1 from qib.module_progress x where x.center_id=p.center_id and x.user_id=p.user_id and x.completed_at>now()-interval '3 days')");let created=0;
 for(const p of r.rows){const kind='training_reminder_'+new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});await c.query('select id from qib.centers where id=$1 for update',[p.center_id]);const previous=await c.query('select 1 from qib.notifications where center_id=$1 and user_id=$2 and kind=$3',[p.center_id,p.user_id,kind]);if(previous.rowCount)continue;await c.query('insert into qib.notifications(center_id,user_id,kind,body) values($1,$2,$3,$4)',[p.center_id,p.user_id,kind,'Your learning plan is ready whenever you can return. One short step is a good place to start.']);created++}return created;
}
module.exports=async({req,url,body,c,userId,centerId,role,mustUUID,deny})=>{
 const route=url.pathname,supervisor=['admin','supervisor'].includes(role.role),done=data=>({handled:true,data});
 if(route==='/api/growth'&&req.method==='GET'){
  const [gaps,days,plans]=await Promise.all([gapsFor(c,centerId,userId),c.query("select (completed_at at time zone 'Asia/Riyadh')::date::text as day,count(*)::int as lessons from qib.module_progress where center_id=$1 and user_id=$2 and completed_at>=now()-interval '14 days' group by 1 order by 1",[centerId,userId]),c.query("select count(*)::int as completed from qib.learning_plans where center_id=$1 and user_id=$2 and status='completed'",[centerId,userId])]);return done({gaps,days:days.rows,completedPlans:plans.rows[0].completed,timezone:'Asia/Riyadh',today:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'})});
 }
 if(route==='/api/growth/team'&&req.method==='GET'){
  if(!supervisor)deny();const members=await c.query("select user_id,display_name from qib.memberships where center_id=$1 and role='nurse' order by display_name",[centerId]);const team=[];for(const m of members.rows)team.push({...m,gaps:await gapsFor(c,centerId,m.user_id)});return done({team});
 }
 if(route==='/api/growth/plan'&&req.method==='POST'){
  if(!supervisor)deny();const target=mustUUID(body.userId),reference=mustUUID(body.reference);if(!(await c.query('select 1 from qib.memberships where user_id=$1 and center_id=$2',[target,centerId])).rowCount)deny();const gap=(await gapsFor(c,centerId,target)).find(g=>g.reference===reference);if(!gap)throw Object.assign(Error('CURRENT_SUPPORT_NEED_REQUIRED'),{status:409});if(!gap.specialtyId||!(await c.query('select 1 from qib.assignments where user_id=$1 and center_id=$2 and specialty_id=$3',[target,centerId,gap.specialtyId])).rowCount)deny();
  await c.query('select id from qib.centers where id=$1 for update',[centerId]);const old=await c.query("select id from qib.learning_plans where center_id=$1 and user_id=$2 and status='active' and steps @> $3::jsonb",[centerId,target,JSON.stringify([{sourceReference:reference}])]);if(old.rowCount)return done({id:old.rows[0].id,existing:true});
  const steps=[{title:'Review: '+gap.title,kind:'learning',done:false,sourceReference:reference},...(gap.categories||[]).map(x=>({title:'Targeted practice: '+x.category,kind:'practice',done:false,sourceReference:reference})),{title:gap.kind==='practice'?'Supervised practice: '+gap.title:'Discuss clinical reasoning with your supervisor',kind:'practice',done:false,sourceReference:reference},{title:'Independent supervisor review',kind:'supervisor_review',done:false,sourceReference:reference}];
  const plan=await c.query('insert into qib.learning_plans(center_id,user_id,specialty_id,steps) values($1,$2,$3,$4) returning id',[centerId,target,gap.specialtyId,JSON.stringify(steps)]);await c.query('insert into qib.notifications(center_id,user_id,kind,body) values($1,$2,$3,$4)',[centerId,target,'support_plan','Your supervisor has assigned a focused support plan. Progress at a manageable pace; practical competence is reviewed separately.']);return done({id:plan.rows[0].id,existing:false});
 }
 return {handled:false};
};
module.exports.insights=insights;module.exports.reminderSweep=reminderSweep;
