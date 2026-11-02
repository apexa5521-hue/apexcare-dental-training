"use strict";
const http=require("node:http"),fs=require("node:fs"),path=require("node:path"),{randomUUID}=require("node:crypto");
const {Pool}=require("pg");
const required=["DATABASE_URL","SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY"];
if(require.main===module){for(const key of required)if(!process.env[key]){console.error("Missing "+key);process.exit(1)}}
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DB_SSL==="disable"?false:{rejectUnauthorized:true},max:10});
const cors=process.env.CORS_ORIGIN||"";
function send(res,status,body){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8",...(cors?{"Access-Control-Allow-Origin":cors,"Vary":"Origin"}:{})});res.end(JSON.stringify(body))}
function deny(code=403){const e=Error(code===401?"UNAUTHENTICATED":"FORBIDDEN");e.status=code;throw e}
function parseBody(req){return new Promise((resolve,reject)=>{let data="";req.on("data",c=>{data+=c;if(data.length>100000){reject(Object.assign(Error("BODY_TOO_LARGE"),{status:413}));req.destroy()}});req.on("end",()=>{try{resolve(JSON.parse(data||"{}"))}catch{reject(Object.assign(Error("INVALID_JSON"),{status:400}))}});req.on("error",reject)})}
async function verifiedUser(req){
 const token=(req.headers.authorization||"").match(/^Bearer (.+)$/)?.[1];if(!token)deny(401);
 const resp=await fetch(process.env.SUPABASE_URL.replace(/\/$/,"")+"/auth/v1/user",{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY,authorization:"Bearer "+token}});
 if(!resp.ok)deny(401);const u=await resp.json();if(!u.id)deny(401);return u.id;
}
async function member(client,userId,centerId,roles){
 if(!/^[0-9a-f-]{36}$/i.test(String(centerId)))deny();
 const r=await client.query("select role,display_name from qib.memberships where user_id=$1 and center_id=$2",[userId,centerId]);
 if(!r.rows.length)deny();if(roles&&!roles.includes(r.rows[0].role))deny();return r.rows[0];
}
async function transaction(fn){const c=await pool.connect();try{await c.query("begin");const r=await fn(c);await c.query("commit");return r}catch(e){await c.query("rollback");throw e}finally{c.release()}}
const mustUUID=v=>{if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)))throw Object.assign(Error("INVALID_ID"),{status:400});return v};
async function handler(req,res){
 if(req.method==="OPTIONS"){res.writeHead(204,{"Access-Control-Allow-Origin":cors||"null","Access-Control-Allow-Headers":"Authorization,Content-Type","Access-Control-Allow-Methods":"GET,POST,OPTIONS"});return res.end()}
 const url=new URL(req.url,"http://localhost");
 if(req.method==="GET"&&["/","/learning-achievements.js","/api-bridge.js"].includes(url.pathname)){const fp=url.pathname==="/"?path.join(__dirname,"../v2/index.html"):path.join(__dirname,"../v2",url.pathname.slice(1));return fs.readFile(fp,(err,bytes)=>{if(err)return send(res,404,{error:"NOT_FOUND"});res.writeHead(200,{"Content-Type":url.pathname.endsWith(".js")?"application/javascript; charset=utf-8":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});res.end(bytes)})}
 if(url.pathname==="/health")return send(res,200,{ok:true,service:"QIB",status:"ready"});
 if(url.pathname==="/api/config"&&req.method==="GET")return send(res,200,{supabaseUrl:process.env.SUPABASE_URL,publishableKey:process.env.SUPABASE_PUBLISHABLE_KEY});
 if(!["GET","POST"].includes(req.method))return send(res,405,{error:"METHOD_NOT_ALLOWED"});
 const userId=await verifiedUser(req),body=req.method==="POST"?await parseBody(req):{},centerId=body.centerId||url.searchParams.get("centerId");
 if(req.method==="GET"&&url.pathname==="/api/my-centers"){const c=await pool.query("select c.id,c.name,m.role from qib.memberships m join qib.centers c on c.id=m.center_id where m.user_id=$1 order by c.name",[userId]);return send(res,200,{centers:c.rows})}
 if(!centerId)throw Object.assign(Error("CENTER_REQUIRED"),{status:400});
 const result=await transaction(async c=>{
  const role=await member(c,userId,centerId);
  if(req.method==="GET"&&url.pathname==="/api/bootstrap"){
   const [specialties,modules,assignments,notifications]=await Promise.all([
    c.query("select id,code,label from qib.specialties order by label"),
    c.query("select id,specialty_id,slug,translations,version from qib.modules where status='published' and (center_id=$1 or center_id is null)",[centerId]),
    c.query("select a.specialty_id,s.label from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2",[userId,centerId]),
    c.query("select id,kind,body,read_at,created_at from qib.notifications where user_id=$1 and center_id=$2 order by created_at desc limit 25",[userId,centerId])]);
   return {userId,role:role.role,centerId,specialties:specialties.rows,modules:modules.rows,assignments:assignments.rows,notifications:notifications.rows};
  }
  if(req.method==="GET"&&url.pathname==="/api/learners"){
   if(!["supervisor","admin"].includes(role.role))deny();
   const r=await c.query("select m.user_id,m.display_name,m.role,a.specialty_id from qib.memberships m left join qib.assignments a on a.center_id=m.center_id and a.user_id=m.user_id where m.center_id=$1 order by display_name",[centerId]);return {learners:r.rows};
  }
  if(req.method==="POST"&&url.pathname==="/api/assign"){
   if(role.role!=="admin")deny();
   const target=mustUUID(body.userId),specialty=mustUUID(body.specialtyId);
   const exists=await c.query("select 1 from qib.memberships where user_id=$1 and center_id=$2",[target,centerId]);if(!exists.rowCount)deny();
   await c.query("insert into qib.assignments(user_id,center_id,specialty_id) values($1,$2,$3) on conflict do nothing",[target,centerId,specialty]);return {ok:true};
  }
  if(req.method==="GET"&&url.pathname==="/api/exams"){
   const r=await c.query("select a.id,a.title,a.minutes,a.starts_at,a.ends_at,a.specialty_id from qib.assessments a where a.center_id=$1 and a.status='published' and (a.starts_at is null or a.starts_at<=now()) and (a.ends_at is null or a.ends_at>=now()) and (a.specialty_id is null or exists(select 1 from qib.assignments s where s.center_id=$1 and s.user_id=$2 and s.specialty_id=a.specialty_id)) order by a.starts_at nulls first",[centerId,userId]);return {assessments:r.rows};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/heartbeat"){
   const id=mustUUID(body.attemptId);
   const r=await c.query("select id,status,deadline_at,heartbeat_at from qib.attempts where id=$1 and center_id=$2 and user_id=$3 for update",[id,centerId,userId]);if(!r.rowCount)deny();const a=r.rows[0];
   if(a.status!=="active")return {status:a.status};
   if(new Date(a.deadline_at)<=new Date() || Date.now()-new Date(a.heartbeat_at).getTime()>45000){await c.query("update qib.attempts set status='paused_review' where id=$1",[id]);await c.query("insert into qib.attempt_events(attempt_id,event_key,kind,actor_id) values($1,$2,'connection_interrupted',$3)",[id,randomUUID(),userId]);return {status:'paused_review'}}
   await c.query("update qib.attempts set heartbeat_at=now() where id=$1",[id]);return {status:'active'};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/start"){
   const assessmentId=mustUUID(body.assessmentId);
   const a=await c.query("select * from qib.assessments where id=$1 and center_id=$2 and status='published' and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>=now())",[assessmentId,centerId]);if(!a.rowCount)deny();
   if(a.rows[0].specialty_id){const assign=await c.query("select 1 from qib.assignments where center_id=$1 and user_id=$2 and specialty_id=$3",[centerId,userId,a.rows[0].specialty_id]);if(!assign.rowCount)deny()}
   const q=await c.query("select id,prompt_en,options_en,answer_index from qib.questions where assessment_id=$1",[assessmentId]);if(!q.rowCount)throw Object.assign(Error("NO_QUESTIONS"),{status:409});
   await c.query("insert into qib.attempts(assessment_id,center_id,user_id,deadline_at,question_snapshot) values($1,$2,$3,least(now()+($4||' minutes')::interval,coalesce($5::timestamptz,now()+($4||' minutes')::interval)),$6) on conflict(assessment_id,user_id) do nothing",[assessmentId,centerId,userId,a.rows[0].minutes,a.rows[0].ends_at,JSON.stringify(q.rows)]);
   const r=await c.query("select id,status,deadline_at,question_snapshot,answers from qib.attempts where assessment_id=$1 and user_id=$2 for update",[assessmentId,userId]);const attempt=r.rows[0];if(attempt.status==="active"&&(new Date(attempt.deadline_at)<=new Date()||Date.now()-new Date(attempt.heartbeat_at).getTime()>45000)){await c.query("update qib.attempts set status='paused_review' where id=$1",[attempt.id]);attempt.status="paused_review"}
   return {attemptId:attempt.id,status:attempt.status,deadlineAt:attempt.deadline_at,questions:attempt.status==="active"?attempt.question_snapshot.map(({id,prompt_en,options_en})=>({id,prompt_en,options_en})):[],answers:attempt.status==="active"?attempt.answers:{}};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/event"){
   const attemptId=mustUUID(body.attemptId),eventKey=String(body.eventKey||"");if(!eventKey||eventKey.length>100)throw Object.assign(Error("BAD_EVENT_KEY"),{status:400});
   const allowed=["visibility_hidden","pagehide","window_blur","connection_interrupted"];if(!allowed.includes(body.kind))throw Object.assign(Error("BAD_EVENT"),{status:400});
   const r=await c.query("select id,status from qib.attempts where id=$1 and center_id=$2 and user_id=$3 for update",[attemptId,centerId,userId]);if(!r.rowCount)deny();
   await c.query("insert into qib.attempt_events(attempt_id,event_key,kind,actor_id) values($1,$2,$3,$4) on conflict do nothing",[attemptId,eventKey,body.kind,userId]);
   if(r.rows[0].status==="active")await c.query("update qib.attempts set status='paused_review' where id=$1",[attemptId]);
   return {status:r.rows[0].status==="active"?"paused_review":r.rows[0].status};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/answer"){
   const id=mustUUID(body.attemptId),qid=mustUUID(body.questionId),choice=body.choice;
   if(!Number.isInteger(choice)||choice<0)throw Object.assign(Error("BAD_CHOICE"),{status:400});
   const r=await c.query("select * from qib.attempts where id=$1 and center_id=$2 and user_id=$3 for update",[id,centerId,userId]);if(!r.rowCount)deny();const a=r.rows[0];
   if(a.status!=="active"||new Date(a.deadline_at)<=new Date())throw Object.assign(Error("ATTEMPT_NOT_ACTIVE"),{status:409});
   const q=a.question_snapshot.find(q=>q.id===qid);if(!q||choice>=q.options_en.length)throw Object.assign(Error("BAD_CHOICE"),{status:400});
   const answers={...a.answers,[qid]:choice};await c.query("update qib.attempts set answers=$2,heartbeat_at=now() where id=$1",[id,JSON.stringify(answers)]);return {saved:true};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/submit"){
   const id=mustUUID(body.attemptId);
   const r=await c.query("select * from qib.attempts where id=$1 and center_id=$2 and user_id=$3 for update",[id,centerId,userId]);if(!r.rowCount)deny();const a=r.rows[0];
   if(a.status==="submitted")return {status:"submitted",score:a.score};
   if(a.status!=="active"||new Date(a.deadline_at)<=new Date())throw Object.assign(Error("ATTEMPT_NOT_ACTIVE"),{status:409});
   const correct=a.question_snapshot.filter(q=>a.answers[q.id]===q.answer_index).length,score=Math.round(correct/a.question_snapshot.length*100);
   await c.query("update qib.attempts set status='submitted',score=$2,finished_at=now() where id=$1",[id,score]);return {status:"submitted",score};
  }
  if(req.method==="POST"&&url.pathname==="/api/exams/review"){
   if(!["supervisor","admin"].includes(role.role))deny();
   const id=mustUUID(body.attemptId),decision=body.decision,reason=String(body.reason||"").trim();if(!["resume","void"].includes(decision)||reason.length<8)throw Object.assign(Error("REVIEW_REASON_REQUIRED"),{status:400});
   const r=await c.query("select * from qib.attempts where id=$1 and center_id=$2 for update",[id,centerId]);if(!r.rowCount)deny();
   if(r.rows[0].status!=="paused_review")throw Object.assign(Error("NOT_PAUSED"),{status:409});
   if(decision==="resume"&&new Date(r.rows[0].deadline_at)<=new Date())throw Object.assign(Error("DEADLINE_EXPIRED"),{status:409});
   await c.query("update qib.attempts set status=$2 where id=$1",[id,decision==="resume"?"active":"void"]);
   await c.query("insert into qib.attempt_events(attempt_id,event_key,kind,actor_id,reason) values($1,$2,$3,$4,$5)",[id,randomUUID(),"review_"+decision,userId,reason]);return {status:decision==="resume"?"active":"void"};
  }
  if(req.method==="GET"&&url.pathname==="/api/achievements"){
   const [results,observed]=await Promise.all([c.query("select a.id,a.score,t.specialty_id from qib.attempts a join qib.assessments t on t.id=a.assessment_id where a.center_id=$1 and a.user_id=$2 and a.status='submitted'",[centerId,userId]),c.query("select id,skill_id,status from qib.skill_observations where center_id=$1 and user_id=$2",[centerId,userId])]);
   return {assessments:results.rows,observations:observed.rows,certificatesNotAutomaticallyIssued:true};
  }
  if(req.method==="POST"&&url.pathname==="/api/observations"){
   if(!["supervisor","admin"].includes(role.role))deny();const target=mustUUID(body.userId),skillId=mustUUID(body.skillId);
   if(!["needs_support","supervised","competent"].includes(body.status))throw Object.assign(Error("BAD_STATUS"),{status:400});
   const m=await c.query("select 1 from qib.memberships where center_id=$1 and user_id=$2",[centerId,target]);if(!m.rowCount)deny();
   const x=await c.query("insert into qib.skill_observations(center_id,user_id,skill_id,observer_id,status,notes) values($1,$2,$3,$4,$5,$6) returning id",[centerId,target,skillId,userId,body.status,String(body.notes||"").slice(0,2000)]);return {id:x.rows[0].id};
  }
  throw Object.assign(Error("NOT_FOUND"),{status:404});
 });
 send(res,200,result);
}
const server=http.createServer((req,res)=>handler(req,res).catch(e=>{console.error(e.message);if(!res.headersSent)send(res,e.status||500,{error:e.status?e.message:"SERVER_ERROR"})}));
if(require.main===module){server.listen(process.env.PORT||10000,()=>console.log("QIB API ready"))}
module.exports={server,handler};
