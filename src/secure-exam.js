"use strict";
// Pilot state machine: dependency-injected atomic store; NOT wired to Google Sheets or production.
// The store.transaction implementation MUST guarantee atomicity and unique (assessmentId,userId).
const STATUS=Object.freeze({ACTIVE:"active",PAUSED:"paused_review",SUBMITTED:"submitted",VOID:"void"});
class ExamError extends Error{constructor(code){super(code);this.code=code;}}
const requireThat=(ok,code)=>{if(!ok)throw new ExamError(code);};
class SecureExam{
 constructor(store,now=()=>Date.now()){this.store=store;this.now=now;}
 async start(user,assessment){
  requireThat(user?.id&&user.authenticated,"AUTH_REQUIRED");
  requireThat(assessment?.id&&assessment.questions?.length&&assessment.deadline,"BAD_ASSESSMENT");
  return this.store.transaction(async tx=>{
   let r=await tx.findByKey(assessment.id+":"+user.id);
   if(!r){
    r={id:tx.newId(),key:assessment.id+":"+user.id,assessmentId:assessment.id,userId:user.id,
      questions:structuredClone(assessment.questions),answers:{},status:STATUS.ACTIVE,
      startedAt:this.now(),deadline:assessment.deadline,lastHeartbeatAt:this.now(),events:[],version:1,result:null};
    await tx.insert(r);
   }
   return this.publicState(r);
  });
 }
 publicState(r){return {id:r.id,status:r.status,deadline:r.deadline,
  questions:r.status===STATUS.ACTIVE?r.questions.map(q=>({id:q.id,prompt:q.prompt,options:q.options})):[],
  result:r.status===STATUS.SUBMITTED?r.result:null};}
 owner(r,user){requireThat(r,"NOT_FOUND");requireThat(user?.authenticated&&r.userId===user.id,"FORBIDDEN");}
 active(r){requireThat(r.status===STATUS.ACTIVE,"NOT_ACTIVE");requireThat(this.now()<=r.deadline,"EXPIRED");}
 async signal(user,id,eventId,type){
  requireThat(eventId&&typeof eventId==="string"&&eventId.length<129,"BAD_EVENT_ID");
  requireThat(["visibility_hidden","pagehide","window_blur","heartbeat_expired","multi_session"].includes(type),"BAD_EVENT_TYPE");
  return this.store.transaction(async tx=>{
   const r=await tx.get(id);this.owner(r,user);
   if(r.events.some(e=>e.id===eventId))return {status:r.status,duplicate:true};
   r.events.push({id:eventId,type,serverAt:this.now()});
   if(r.status===STATUS.ACTIVE)r.status=STATUS.PAUSED;
   r.version++;await tx.put(r);return {status:r.status,duplicate:false};
  });
 }
 async saveAnswer(user,id,questionId,choice){
  return this.store.transaction(async tx=>{
   const r=await tx.get(id);this.owner(r,user);this.active(r);
   const q=r.questions.find(q=>q.id===questionId);
   requireThat(q&&Number.isInteger(choice)&&choice>=0&&choice<q.options.length,"BAD_ANSWER");
   r.answers[questionId]=choice;r.version++;await tx.put(r);return {saved:true};
  });
 }
 async submit(user,id){
  return this.store.transaction(async tx=>{
   const r=await tx.get(id);this.owner(r,user);
   if(r.status===STATUS.SUBMITTED)return {status:r.status,result:r.result,duplicate:true};
   this.active(r);
   const total=r.questions.length,correct=r.questions.filter(q=>r.answers[q.id]===q.answerIndex).length;
   r.result={total,correct,score:Math.round(100*correct/total),submittedAt:this.now()};
   r.status=STATUS.SUBMITTED;r.version++;await tx.put(r);return {status:r.status,result:r.result,duplicate:false};
  });
 }
 async review(reviewer,id,decision,reason){
  requireThat(reviewer?.authenticated&&reviewer.roles?.some(role=>["supervisor","admin"].includes(role)),"REVIEWER_REQUIRED");
  requireThat(["resume","void"].includes(decision),"BAD_DECISION");
  requireThat(typeof reason==="string"&&reason.trim().length>=5,"REASON_REQUIRED");
  return this.store.transaction(async tx=>{
   const r=await tx.get(id);requireThat(r,"NOT_FOUND");
   requireThat(r.status===STATUS.PAUSED,"NOT_PAUSED");
   if(decision==="resume"){requireThat(this.now()<=r.deadline,"EXPIRED");r.status=STATUS.ACTIVE;}
   else r.status=STATUS.VOID;
   r.events.push({id:tx.newId(),type:"review_"+decision,actor:reviewer.id,reason:reason.trim(),serverAt:this.now()});
   r.version++;await tx.put(r);return {status:r.status};
  });
 }
}
module.exports={SecureExam,STATUS,ExamError};
