"use strict";
const assert=require("node:assert/strict");
const {test}=require("node:test");
const {SecureExam,STATUS}=require("../src/secure-exam.js");
class MemoryStore{
 constructor(){this.items=new Map();this.keys=new Map();this.seq=0;this.queue=Promise.resolve();}
 newId(){return "id-"+(++this.seq);}
 async transaction(fn){
  const previous=this.queue;let unlock;this.queue=new Promise(r=>unlock=r);await previous;
  try{
   const tx={newId:()=>this.newId(),get:async id=>structuredClone(this.items.get(id)),
   findByKey:async k=>structuredClone(this.items.get(this.keys.get(k))),
   insert:async r=>{assert(!this.keys.has(r.key));this.items.set(r.id,structuredClone(r));this.keys.set(r.key,r.id);},
   put:async r=>{this.items.set(r.id,structuredClone(r));}};
   return await fn(tx);
  }finally{unlock();}
 }
}
const user={id:"n1",authenticated:true},supervisor={id:"s1",authenticated:true,roles:["supervisor"]};
const assessment={id:"a1",deadline:99999,questions:[{id:"q1",prompt:"Instrument?",options:["A","B"],answerIndex:1}]};
const fresh=()=>{const db=new MemoryStore();return {db,exam:new SecureExam(db,()=>1000)};};
test("start redacts answers and prevents second attempt",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment),b=await exam.start(user,assessment);
 assert.equal(a.id,b.id);assert.equal(JSON.stringify(a).includes("answerIndex"),false);
});
test("client cannot provide its own score",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 await exam.saveAnswer(user,a.id,"q1",0);const s=await exam.submit(user,a.id);
 assert.equal(s.result.score,0);assert.equal((await exam.submit(user,a.id)).duplicate,true);
});
test("pause blocks answering and submitting",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 await exam.signal(user,a.id,"ev1","visibility_hidden");
 await assert.rejects(()=>exam.saveAnswer(user,a.id,"q1",1),{code:"NOT_ACTIVE"});
 await assert.rejects(()=>exam.submit(user,a.id),{code:"NOT_ACTIVE"});
});
test("event replay is idempotent",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 await exam.signal(user,a.id,"ev1","pagehide");assert.equal((await exam.signal(user,a.id,"ev1","pagehide")).duplicate,true);
});
test("only supervisor can resume and must provide reason",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 await exam.signal(user,a.id,"ev1","window_blur");
 await assert.rejects(()=>exam.review(user,a.id,"resume","valid reason"),{code:"REVIEWER_REQUIRED"});
 await assert.rejects(()=>exam.review(supervisor,a.id,"resume","x"),{code:"REASON_REQUIRED"});
 assert.equal((await exam.review(supervisor,a.id,"resume","device notification")).status,STATUS.ACTIVE);
});
test("foreign user cannot answer or pause",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 const other={id:"n2",authenticated:true};
 await assert.rejects(()=>exam.saveAnswer(other,a.id,"q1",1),{code:"FORBIDDEN"});
 await assert.rejects(()=>exam.signal(other,a.id,"x","pagehide"),{code:"FORBIDDEN"});
});
test("correct score calculated only from stored answers",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);await exam.saveAnswer(user,a.id,"q1",1);
 assert.equal((await exam.submit(user,a.id)).result.score,100);
});
test("cannot resume past deadline",async()=>{
 const db=new MemoryStore(),exam=new SecureExam(db,()=>2000);
 const a=await exam.start(user,{...assessment,deadline:1500});
 await exam.signal(user,a.id,"e1","pagehide");
 await assert.rejects(()=>exam.review(supervisor,a.id,"resume","device interruption"),{code:"EXPIRED"});
});
test("concurrent starts create only one attempt",async()=>{
 const {exam}=fresh();
 const [a,b]=await Promise.all([exam.start(user,assessment),exam.start(user,assessment)]);
 assert.equal(a.id,b.id);
});
test("void attempt cannot be submitted",async()=>{
 const {exam}=fresh();const a=await exam.start(user,assessment);
 await exam.signal(user,a.id,"e2","pagehide");await exam.review(supervisor,a.id,"void","policy reviewed");
 await assert.rejects(()=>exam.submit(user,a.id),{code:"NOT_ACTIVE"});
});
