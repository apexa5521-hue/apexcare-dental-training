'use strict';
const {randomUUID}=require('node:crypto');
const {prepareAttemptQuestions}=require('./exam-presentation');
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status})};
const done=data=>({handled:true,data});
async function event(c,a,userId,kind,reason){await c.query('insert into qib.attempt_events(attempt_id,event_key,kind,actor_id,reason) values($1,$2,$3,$4,$5)',[a.id,randomUUID(),kind,userId,reason||null])}
function active(a){if(a.status!=='active'||new Date(a.deadline_at)<=new Date()||Date.now()-new Date(a.heartbeat_at).getTime()>45000)fail('ATTEMPT_NOT_ACTIVE')}
function view(a){return {attemptId:a.id,attemptNumber:a.attempt_number,status:a.status,deadlineAt:a.deadline_at,serverNow:new Date().toISOString(),timingMode:a.timing_mode,secondsPerQuestion:a.seconds_per_question,flags:a.flags,questionClocks:a.question_clocks,questions:a.status==='active'?a.question_snapshot.map(({id,prompt_en,options_en,media_asset_id})=>({id,prompt_en,options_en,media_asset_id})):[],answers:a.status==='active'?a.answers:{}}}
module.exports=async({req,url,body,c,userId,centerId,role,mustUUID,deny})=>{
 const route=url.pathname;
 if(!['/api/exams/timing','/api/exams/retake','/api/exams/start','/api/exams/flag','/api/exams/open-question','/api/exams/answer'].includes(route)||req.method!=='POST')return {handled:false};
 if(route==='/api/exams/timing'){
  if(role.role!=='admin')deny();const id=mustUUID(body.assessmentId),mode=body.timingMode,seconds=body.secondsPerQuestion,minutes=body.minutes;
  if(!['total','per_question'].includes(mode)||!Number.isInteger(seconds)||seconds<10||seconds>3600||!Number.isInteger(minutes)||minutes<1||minutes>240)fail('INVALID_TIMING',400);
  const a=await c.query('select id from qib.assessments where id=$1 and center_id=$2 for update',[id,centerId]);if(!a.rowCount)deny();
  if((await c.query('select 1 from qib.attempts where assessment_id=$1 limit 1',[id])).rowCount)fail('TIMING_LOCKED_AFTER_ATTEMPT');
  await c.query('update qib.assessments set timing_mode=$2,seconds_per_question=$3,minutes=$4 where id=$1',[id,mode,seconds,minutes]);
  await c.query('insert into qib.assessment_reviews(assessment_id,reviewer_id,note) values($1,$2,$3)',[id,userId,'Timing settings: '+JSON.stringify({mode,seconds,minutes})]);return done({saved:true});
 }
 if(route==='/api/exams/retake'){
  if(!['admin','supervisor'].includes(role.role))deny();const id=mustUUID(body.previousAttemptId),reason=String(body.reason||'').trim();if(reason.length<12||reason.length>2000)fail('RETAKE_REASON_REQUIRED',400);
  const found=await c.query('select a.* from qib.attempts a where a.id=$1 and a.center_id=$2 for update',[id,centerId]);if(!found.rowCount)deny();const previous=found.rows[0];if(previous.user_id===userId)deny();
  if(!['submitted','void'].includes(previous.status))fail('FINISHED_ATTEMPT_REQUIRED');
  const latest=await c.query('select id from qib.attempts where assessment_id=$1 and user_id=$2 order by attempt_number desc limit 1',[previous.assessment_id,previous.user_id]);if(latest.rows[0].id!==id)fail('LATEST_ATTEMPT_REQUIRED');
  const available=new Date(body.availableAt||Date.now()),expires=new Date(body.expiresAt||Date.now()+7*86400000);if(!Number.isFinite(+available)||!Number.isFinite(+expires)||+expires<=+available||+expires<=Date.now())fail('INVALID_RETAKE_WINDOW',400);
  const grant=await c.query('insert into qib.retake_grants(assessment_id,center_id,user_id,previous_attempt_id,approved_by,reason,available_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(previous_attempt_id) do nothing returning id',[previous.assessment_id,centerId,previous.user_id,id,userId,reason,available.toISOString(),expires.toISOString()]);if(!grant.rowCount)fail('RETAKE_ALREADY_GRANTED');
  await event(c,previous,userId,'retake_approved',reason);return done({approved:true,grantId:grant.rows[0].id});
 }
 if(route==='/api/exams/start'){
  const assessmentId=mustUUID(body.assessmentId);
  const found=await c.query("select * from qib.assessments where id=$1 and center_id=$2 and status='published' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now()) for update",[assessmentId,centerId]);if(!found.rowCount)deny();const assessment=found.rows[0];
  if(assessment.specialty_id&&!(await c.query('select 1 from qib.assignments where user_id=$1 and center_id=$2 and specialty_id=$3',[userId,centerId,assessment.specialty_id])).rowCount)deny();
  const history=await c.query('select * from qib.attempts where assessment_id=$1 and user_id=$2 order by attempt_number desc limit 1 for update',[assessmentId,userId]);let a=history.rows[0];
  if(a&&['active','paused_review'].includes(a.status)){
   if(a.status==='active'&&(new Date(a.deadline_at)<=new Date()||Date.now()-new Date(a.heartbeat_at).getTime()>45000)){await c.query("update qib.attempts set status='paused_review' where id=$1",[a.id]);await event(c,a,userId,'connection_interrupted');a.status='paused_review'}return done(view(a));
  }
  let grant;if(a){grant=(await c.query('select * from qib.retake_grants where previous_attempt_id=$1 and user_id=$2 and center_id=$3 and used_by_attempt_id is null and available_at<=now() and expires_at>now() for update',[a.id,userId,centerId])).rows[0];if(!grant)return done(view(a))}
  const questions=await c.query("select id,prompt_en,options_en,answer_index,provenance->>'mediaAssetId' as media_asset_id from qib.questions where assessment_id=$1",[assessmentId]);if(!questions.rowCount)fail('NO_QUESTIONS');
  const inserted=await c.query("insert into qib.attempts(assessment_id,center_id,user_id,deadline_at,question_snapshot,attempt_number,timing_mode,seconds_per_question) values($1,$2,$3,least(now()+($4||' minutes')::interval,coalesce($5::timestamptz,now()+($4||' minutes')::interval)),$6,$7,$8,$9) returning *",[assessmentId,centerId,userId,assessment.minutes,assessment.ends_at,JSON.stringify(prepareAttemptQuestions(questions.rows,a?.question_snapshot||[])),a?a.attempt_number+1:1,assessment.timing_mode,assessment.seconds_per_question]);a=inserted.rows[0];if(grant)await c.query('update qib.retake_grants set used_by_attempt_id=$2 where id=$1',[grant.id,a.id]);await event(c,a,userId,'attempt_started');return done(view(a));
 }
 const id=mustUUID(body.attemptId),qid=mustUUID(body.questionId),found=await c.query('select * from qib.attempts where id=$1 and center_id=$2 and user_id=$3 for update',[id,centerId,userId]);if(!found.rowCount)deny();const a=found.rows[0];active(a);
 const q=a.question_snapshot.find(q=>q.id===qid);if(!q)fail('INVALID_QUESTION',400);
 if(route==='/api/exams/flag'){
  if(typeof body.flagged!=='boolean')fail('INVALID_FLAG',400);const flags={...a.flags};if(body.flagged)flags[qid]=true;else delete flags[qid];await c.query('update qib.attempts set flags=$2 where id=$1',[id,JSON.stringify(flags)]);return done({flags});
 }
 if(route==='/api/exams/open-question'){
  const clocks={...a.question_clocks};if(a.timing_mode==='per_question'&&!clocks[qid]){clocks[qid]=new Date(Math.min(Date.now()+a.seconds_per_question*1000,+new Date(a.deadline_at))).toISOString();await c.query('update qib.attempts set question_clocks=$2 where id=$1',[id,JSON.stringify(clocks)]);await event(c,a,userId,'question_opened',qid)}return done({deadlineAt:clocks[qid]||null,serverNow:new Date().toISOString()});
 }
 if(a.timing_mode==='per_question'&&(!a.question_clocks[qid]||new Date(a.question_clocks[qid])<=new Date()))fail('QUESTION_TIME_EXPIRED');
 if(!Number.isInteger(body.choice)||body.choice<0||body.choice>=q.options_en.length)fail('BAD_CHOICE',400);
 await c.query('update qib.attempts set answers=$2,heartbeat_at=now() where id=$1',[id,JSON.stringify({...a.answers,[qid]:body.choice})]);return done({saved:true});
};
