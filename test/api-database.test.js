"use strict";
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const apiRequire=createRequire(path.resolve(__dirname,'../api/package.json'));
const {PGlite}=apiRequire('@electric-sql/pglite');
const {server,pool}=require('../api/server');
const ids={center:'10000000-0000-0000-0000-000000000001',other:'10000000-0000-0000-0000-000000000002',nurse:'20000000-0000-0000-0000-000000000001',supervisor:'20000000-0000-0000-0000-000000000002',exam:'30000000-0000-0000-0000-000000000001',reviewExam:'30000000-0000-0000-0000-000000000002'};
const sessions={nurse:'40000000-0000-0000-0000-000000000001',supervisor:'40000000-0000-0000-0000-000000000002'};
const tokens=Object.fromEntries(Object.entries(sessions).map(([name,id])=>[name,'test.'+Buffer.from(JSON.stringify({session_id:id})).toString('base64url')+'.signature']));
let db,base,specialty,nativeFetch=global.fetch;
async function call(route,{token='nurse',body,center=ids.center}={}){
 const url=base+route+(body?'':(route.includes('?')?'&':'?')+'centerId='+center);
 const response=await nativeFetch(url,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+(tokens[token]||token)}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify({centerId:center,...body})}:{})});
 return {status:response.status,body:await response.json()};
}
before(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create schema auth;create table auth.sessions(id uuid primary key,user_id uuid not null);');
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[sessions.nurse,ids.nurse,sessions.supervisor,ids.supervisor]);
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/schema.sql'),'utf8').replace('create extension if not exists pgcrypto;',''));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/legacy-catalog.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/exam-workflows-upgrade.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/content-intake-upgrade.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/content-proposals-upgrade.sql'),'utf8'));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/clinic-practice-upgrade.sql'),'utf8'));
 const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0}};
 mock.method(pool,'query',query);
 mock.method(pool,'connect',async()=>({query,release(){}}));
 process.env.SUPABASE_URL='https://nse-auth.test';process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
 global.fetch=async(url,options)=>{
  if(String(url).startsWith('https://nse-auth.test/')){
   const token=options.headers.authorization;
   const id=token==='Bearer '+tokens.nurse?ids.nurse:token==='Bearer '+tokens.supervisor?ids.supervisor:null;
   return new Response(JSON.stringify(id?{id}:{}),{status:id?200:401});
  }
  return nativeFetch(url,options);
 };
 await db.query('insert into qib.centers(id,name) values($1,$2),($3,$4)',[ids.center,'Test center',ids.other,'Other center']);
 await db.query("insert into qib.memberships(user_id,center_id,role,display_name) values($1,$2,'nurse','Test nurse'),($3,$2,'supervisor','Test supervisor')",[ids.nurse,ids.center,ids.supervisor]);
 specialty=(await db.query("select id from qib.specialties where code='dental'")).rows[0].id;
 await db.query('insert into qib.assignments(user_id,center_id,specialty_id) values($1,$2,$3)',[ids.nurse,ids.center,specialty]);
 for(const exam of [ids.exam,ids.reviewExam]){
  await db.query("insert into qib.assessments(id,center_id,specialty_id,title,status) values($1,$2,$3,'Synthetic test assessment','published')",[exam,ids.center,specialty]);
  await db.query("insert into qib.questions(assessment_id,prompt_en,options_en,answer_index) values($1,'Synthetic test question?','[\"A\",\"B\"]',1)",[exam]);
 }
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{global.fetch=nativeFetch;await new Promise(resolve=>server.close(resolve));mock.restoreAll();await pool.end();await db.close();});
test('deployment schema executes and all private application tables have RLS',async()=>{
 const {rows}=await db.query("select count(*)::int as total,count(*) filter(where rowsecurity)::int as protected from pg_tables where schemaname='qib'");
 assert(rows[0].total>=24);assert.equal(rows[0].total,rows[0].protected);
 const privileges=await db.query("select has_schema_privilege('anon','qib','usage') as anon,has_schema_privilege('authenticated','qib','usage') as authenticated");
 assert.equal(privileges.rows[0].anon,false);assert.equal(privileges.rows[0].authenticated,false);
});
test('actual API rejects unauthenticated and cross-center access',async()=>{
 assert.equal((await call('/api/bootstrap',{token:null})).status,401);
 assert.equal((await call('/api/bootstrap',{center:ids.other})).status,403);
 assert.equal((await call('/api/reports')).status,403);
 assert.equal((await call('/api/reports',{token:'supervisor'})).status,200);
});
test('browser auth client and public config expose no server secret',async()=>{
 const script=await nativeFetch(base+'/supabase-client.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);assert((await script.text()).includes('createClient'));
 const config=await call('/api/config',{token:null});assert.deepEqual(Object.keys(config.body).sort(),['publishableKey','supabaseUrl']);
 const centers=await call('/api/my-centers');assert.equal(centers.body.platformOwner,false);assert.equal(centers.body.centers.length,1);
});
test('actual assessment routes redact answer keys and calculate score from stored answers',async()=>{
 const start=await call('/api/exams/start',{body:{assessmentId:ids.exam}});assert.equal(start.status,200);
 assert.equal(start.body.questions.length,1);assert.equal(start.body.questions[0].answer_index,undefined);
 assert.equal((await call('/api/exams/draft-questions?assessmentId='+ids.exam)).status,403);
 const attemptId=start.body.attemptId,questionId=start.body.questions[0].id;
 assert.equal((await call('/api/exams/answer',{center:ids.other,body:{attemptId,questionId,choice:1}})).status,403);
 assert.equal((await call('/api/exams/answer',{body:{attemptId,questionId,choice:start.body.questions[0].options_en.indexOf('B')}})).status,200);
 const result=await call('/api/exams/submit',{body:{attemptId,score:0}});assert.equal(result.body.score,100);
 assert.equal((await call('/api/exams/submit',{body:{attemptId,score:1}})).body.score,100);
});
test('stale connection cannot submit and supervisor resume resets heartbeat',async()=>{
 const start=await call('/api/exams/start',{body:{assessmentId:ids.reviewExam}}),attemptId=start.body.attemptId;
 await db.query("update qib.attempts set heartbeat_at=now()-interval '60 seconds' where id=$1",[attemptId]);
 assert.equal((await call('/api/exams/submit',{body:{attemptId}})).status,409);
 const restarted=await call('/api/exams/start',{body:{assessmentId:ids.reviewExam}});assert.equal(restarted.body.status,'paused_review');
 assert.deepEqual(restarted.body.questions,[]);
 assert.equal((await call('/api/exams/review',{body:{attemptId,decision:'resume',reason:'Reviewed test interruption'}})).status,403);
 assert.equal((await call('/api/exams/review',{token:'supervisor',body:{attemptId,decision:'resume',reason:'Reviewed test interruption'}})).body.status,'active');
 assert.equal((await call('/api/exams/heartbeat',{body:{attemptId}})).body.status,'active');
});
test('owner import executes with original IDs, extra source fields and quarantined broken links',async()=>{
 const {build}=require('../deploy/build-staging-import');
 const raw={Specialties:[{id:'gp',nameEn:'Synthetic specialty'}],Tools:[{id:'tool-original',specialtyId:'gp',nameEn:"Test $nse$ '; drop schema qib cascade; --"}],Procedures:[{id:'proc-original',specialtyId:'gp',toolIds:'["tool-original","missing-source-id"]',consumableIds:'[]',_sourceColumnsWithoutHeader:{'9':'Original source value'}}],Users:[{id:'legacy-user',username:'synthetic-user',password:'not-to-migrate'}],Mastery:[{'اسم المستخدم':'synthetic-user','النتيجة %':90}],Doctors:[{id:'doctor-original',specialtyId:'gp'}],DoctorPrefs:[{id:'pref-original',doctorId:'doctor-original',procedureId:'proc-original'}]};
 const prepared=build(raw);assert.equal(prepared.issues.length,1);
 assert(!prepared.batches.join('').includes('not-to-migrate'));
 for(const sql of prepared.batches)await db.exec(sql);
 const catalog=await db.query("select payload from qib.legacy_catalog where source_name='Procedures' and legacy_id='proc-original'");
 assert.deepEqual(catalog.rows[0].payload.toolIds,['tool-original','missing-source-id']);
 assert.equal(catalog.rows[0].payload._sourceColumnsWithoutHeader['9'],'Original source value');
 const history=await db.query("select source_name,payload from qib.legacy_history_archive order by source_name");
 assert.equal(history.rows.length,2);assert(history.rows.every(x=>x.payload.password===undefined));
 const receipt=await db.query('select source_counts,imported_counts from qib.migration_runs');assert.deepEqual(receipt.rows[0].source_counts,receipt.rows[0].imported_counts);
 const issue=await db.query('select missing_id from qib.migration_issues');assert.equal(issue.rows[0].missing_id,'missing-source-id');
});

test('personal plans persist, remain center scoped and require independent supervisor review',async()=>{
 assert.equal((await call('/api/plans/create',{body:{userId:ids.nurse,specialtyId:specialty,steps:[{title:'Review instrument preparation',kind:'learning'}]}})).status,403);
 const made=await call('/api/plans/create',{token:'supervisor',body:{userId:ids.nurse,specialtyId:specialty,steps:[{title:'Review instrument preparation',kind:'learning'},{title:'Observed practical review',kind:'supervisor_review'}]}});assert.equal(made.status,200);const planId=made.body.id;
 assert.equal((await call('/api/plans/step',{center:ids.other,body:{planId,index:0}})).status,403);
 assert.equal((await call('/api/plans/step',{body:{planId,index:0}})).body.steps[0].done,true);
 assert.equal((await call('/api/plans/step',{body:{planId,index:1}})).status,403);
 assert.equal((await call('/api/plans/step',{token:'supervisor',body:{planId,index:1}})).body.status,'completed');
 const own=await call('/api/development');assert.equal(own.body.plans.length,1);assert.equal(own.body.notifications.length,2);
 const notification=own.body.notifications[0];assert.equal((await call('/api/notifications/read',{token:'supervisor',body:{id:notification.id}})).status,403);assert.equal((await call('/api/notifications/read',{body:{id:notification.id}})).body.read,true);
 assert.equal((await call('/api/development/team')).status,403);
});
test('practical evidence requires another observer, assigned specialty and meaningful notes',async()=>{
 const skill=(await db.query("insert into qib.skill_definitions(specialty_id,name_en,rubric) values($1,'Synthetic practical skill','{}') returning id",[specialty])).rows[0].id;
 assert.equal((await call('/api/observations',{token:'supervisor',body:{userId:ids.supervisor,skillId:skill,status:'competent',notes:'Observed practical evidence'}})).body.error,'INDEPENDENT_OBSERVER_REQUIRED');
 assert.equal((await call('/api/observations',{token:'supervisor',body:{userId:ids.nurse,skillId:skill,status:'competent',notes:'short'}})).status,400);
 assert.equal((await call('/api/observations',{token:'supervisor',body:{userId:ids.nurse,skillId:skill,status:'supervised',notes:'Observed practical evidence in a supervised session'}})).status,200);
});
test('certificate verification and revocation enforce ownership and reason',async()=>{
 const id=(await db.query("insert into qib.certificates(center_id,user_id,specialty_id,kind,issued_by) values($1,$2,$3,'knowledge',$4) returning id",[ids.center,ids.nurse,specialty,ids.supervisor])).rows[0].id;
 assert.equal((await call('/api/certificates/verify?id='+id)).body.valid,true);
 assert.equal((await call('/api/certificates/revoke',{body:{id,reason:'Documented reason'}})).status,403);
 assert.equal((await call('/api/certificates/revoke',{token:'supervisor',body:{id,reason:'short'}})).status,400);
 assert.equal((await call('/api/certificates/revoke',{token:'supervisor',body:{id,reason:'Evidence needs a documented review'}})).body.revoked,true);
 assert.equal((await call('/api/certificates/verify?id='+id)).body.valid,false);
});

test('module publication requires review, four languages and an auditable rationale',async()=>{
 await db.query("update qib.memberships set role='admin' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center]);
 try{
 const id=(await db.query("insert into qib.modules(center_id,specialty_id,slug,translations) values($1,$2,'review-workflow-test',$3) returning id",[ids.center,specialty,JSON.stringify({en:{title:'Synthetic title',body:'Synthetic lesson'}})])).rows[0].id;
 assert.equal((await call('/api/modules/publish',{token:'supervisor',body:{moduleId:id,reviewerNote:'Reviewed synthetic content'}})).body.error,'CONTENT_REVIEW_REQUIRED');
 assert.equal((await call('/api/modules/request-review',{token:'supervisor',body:{moduleId:id}})).status,200);
 assert.match((await call('/api/modules/publish',{token:'supervisor',body:{moduleId:id,reviewerNote:'Reviewed synthetic content'}})).body.error,/TRANSLATIONS_REQUIRED/);
 const translations=Object.fromEntries(['ar','en','ur','id'].map(l=>[l,{title:'Synthetic title',body:'Synthetic lesson'}]));await db.query('update qib.modules set translations=$2 where id=$1',[id,JSON.stringify(translations)]);
 assert.equal((await call('/api/modules/publish',{token:'supervisor',body:{moduleId:id,reviewerNote:'Reviewed synthetic content and translations'}})).status,200);
 const audit=await db.query('select snapshot from qib.content_revisions where module_id=$1',[id]);assert.equal(audit.rows[0].snapshot.action,'clinical_publish_review');
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center])}
});
test('assessment scheduling validates dates and refuses changes after an attempt',async()=>{
 await db.query("update qib.memberships set role='admin' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center]);
 try{
 const id=(await db.query("insert into qib.assessments(center_id,title,status) values($1,'Synthetic scheduled test','draft') returning id",[ids.center])).rows[0].id;
 assert.equal((await call('/api/exams/schedule',{token:'supervisor',body:{assessmentId:id,startsAt:'invalid',reason:'Scheduling synthetic test'}})).status,400);
 assert.equal((await call('/api/exams/schedule',{token:'supervisor',body:{assessmentId:id,startsAt:'2030-01-01T10:00:00Z',endsAt:'2030-01-01T11:00:00Z',reason:'Scheduling synthetic test'}})).status,200);
 assert.equal((await call('/api/exams/schedule',{token:'supervisor',body:{assessmentId:ids.exam,startsAt:'2030-01-01T10:00:00Z',reason:'Scheduling synthetic test'}})).body.error,'SCHEDULE_LOCKED_AFTER_ATTEMPT');
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center])}
});

test('legacy IPC becomes idempotent drafts without overwriting source or inventing translations',async()=>{
 await db.query("update qib.memberships set role='admin' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center]);await db.query('insert into qib.platform_owners(user_id) values($1)',[ids.supervisor]);
 try{
 for(const [source,id,payload] of [['IPC_Modules','ipc-synthetic',{id:'ipc-synthetic',nameEn:'Synthetic IPC',nameAr:'Synthetic Arabic title'}],['IPC_Steps','ipc-step',{id:'ipc-step',moduleId:'ipc-synthetic',textEn:'Original synthetic step',textAr:'Original synthetic Arabic step',order:1}]])await db.query('insert into qib.legacy_catalog(source_name,legacy_id,payload,content_hash) values($1,$2,$3,$4)',[source,id,JSON.stringify(payload),'synthetic-test-hash']);
 const first=await call('/api/modules/import-ipc',{token:'supervisor',body:{}});assert.equal(first.body.created,1);assert.equal((await call('/api/modules/import-ipc',{token:'supervisor',body:{}})).body.created,0);
 const r=await db.query("select status,translations from qib.modules where slug like 'legacy-ipc-%'");assert.equal(r.rows[0].status,'draft');assert.equal(r.rows[0].translations.en.body,'Original synthetic step');assert.equal(r.rows[0].translations.ur.body,'');assert.equal(r.rows[0].translations.id.title,'');
 }finally{await db.query('delete from qib.platform_owners where user_id=$1',[ids.supervisor]);await db.query("update qib.memberships set role='supervisor' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center])}
});

test('nurse lesson lists expose only assigned specialties and center-wide published content',async()=>{
 const otherSpec=(await db.query("select id from qib.specialties where code='dermatology'")).rows[0].id;
 const row=(await db.query("insert into qib.modules(center_id,specialty_id,slug,translations,status) values($1,$2,'unassigned-specialty-test','{}','published') returning id",[ids.center,otherSpec])).rows[0];
 assert(!(await call('/api/modules')).body.modules.some(m=>m.id===row.id));assert(!(await call('/api/bootstrap')).body.modules.some(m=>m.id===row.id));
});

test('foundation curriculum prepares once as private drafts and does not publish answers to nurses',async()=>{
 assert.equal((await call('/api/modules/prepare-foundations',{body:{}})).status,403);
 await db.query("update qib.memberships set role='admin' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center]);await db.query('insert into qib.platform_owners(user_id) values($1)',[ids.supervisor]);
 try{const r=await call('/api/modules/prepare-foundations',{token:'supervisor',body:{}});assert.equal(r.status,200);assert.equal(r.body.created,6);assert.equal(r.body.questionDraftsCreated,6);const again=await call('/api/modules/prepare-foundations',{token:'supervisor',body:{}});assert.equal(again.body.created,0);assert.equal(again.body.questionDraftsCreated,0);
 const modules=await db.query("select translations,status from qib.modules where slug like 'nse-foundation-%'");assert.equal(modules.rows.length,6);assert(modules.rows.every(m=>m.status==='draft'&&Object.keys(m.translations).length===4));assert(modules.rows.every(m=>!JSON.stringify(m.translations).includes('answer_index')));assert.equal((await call('/api/exams/draft-questions?assessmentId='+r.body.assessmentId)).status,403);
 const dental=await call('/api/modules/prepare-foundations',{token:'supervisor',body:{pack:'dental'}});assert.equal(dental.status,200);assert.equal(dental.body.created,6);assert.equal(dental.body.questionDraftsCreated,13);assert.equal((await call('/api/modules/prepare-foundations',{token:'supervisor',body:{pack:'dental'}})).body.created,0);
 const dm=await db.query("select specialty_id,status,translations from qib.modules where slug like 'nse-dental-%'");assert.equal(dm.rows.length,6);assert(dm.rows.every(m=>m.specialty_id===specialty&&m.status==='draft'&&['ar','en','ur','id'].every(l=>m.translations[l].body.includes('Sources:'))));
 assert.equal((await db.query('select specialty_id from qib.assessments where id=$1',[dental.body.assessmentId])).rows[0].specialty_id,specialty);assert.equal((await db.query('select count(*)::int as n from qib.questions where assessment_id=$1 and rationale_en is not null',[dental.body.assessmentId])).rows[0].n,13);
 assert.equal((await call('/api/modules/prepare-foundations',{token:'supervisor',body:{pack:'../secret'}})).body.error,'UNKNOWN_CURRICULUM_PACK');
 const nurseView=await call('/api/modules');assert(!nurseView.body.modules.some(m=>m.slug.startsWith('nse-dental-')));
 }finally{await db.query('delete from qib.platform_owners where user_id=$1',[ids.supervisor]);await db.query("update qib.memberships set role='supervisor' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center])}
});

test('flags persist on resume and reject foreign centers, invalid questions and finished attempts',async()=>{
 const first=await call('/api/exams/start',{body:{assessmentId:ids.reviewExam}}),id=first.body.attemptId,qid=first.body.questions[0].id;
 assert.equal((await call('/api/exams/flag',{center:ids.other,body:{attemptId:id,questionId:qid,flagged:true}})).status,403);
 assert.equal((await call('/api/exams/flag',{body:{attemptId:id,questionId:ids.exam,flagged:true}})).status,400);
 assert.equal((await call('/api/exams/flag',{body:{attemptId:id,questionId:qid,flagged:true}})).body.flags[qid],true);
 const resume=await call('/api/exams/start',{body:{assessmentId:ids.reviewExam}});assert.equal(resume.body.flags[qid],true);assert.deepEqual(resume.body.questions,first.body.questions);
 assert.deepEqual((await call('/api/exams/flag',{body:{attemptId:id,questionId:qid,flagged:false}})).body.flags,{});
 const completed=(await db.query('select id,question_snapshot from qib.attempts where assessment_id=$1',[ids.exam])).rows[0];assert.equal((await call('/api/exams/flag',{body:{attemptId:completed.id,questionId:completed.question_snapshot[0].id,flagged:true}})).status,409);
});
test('retake requires independent supervisor grant, preserves history and consumes grant once',async()=>{
 const old=(await db.query('select * from qib.attempts where assessment_id=$1',[ids.exam])).rows[0];
 assert.equal((await call('/api/exams/start',{body:{assessmentId:ids.exam}})).body.attemptId,old.id);
 assert.equal((await call('/api/exams/retake',{body:{previousAttemptId:old.id,reason:'Reviewed learning support plan'}})).status,403);
 assert.equal((await call('/api/exams/retake',{token:'supervisor',center:ids.other,body:{previousAttemptId:old.id,reason:'Reviewed learning support plan'}})).status,403);
 assert.equal((await call('/api/exams/retake',{token:'supervisor',body:{previousAttemptId:old.id,reason:'Reviewed learning support plan'}})).body.approved,true);
 const retake=await call('/api/exams/start',{body:{assessmentId:ids.exam}});assert.equal(retake.body.attemptNumber,2);assert.notEqual(retake.body.attemptId,old.id);
 assert.equal((await call('/api/exams/start',{body:{assessmentId:ids.exam}})).body.attemptId,retake.body.attemptId);
 const saved=(await db.query('select status,score,answers from qib.attempts where id=$1',[old.id])).rows[0];assert.equal(saved.status,'submitted');assert.equal(saved.score,100);assert.deepEqual(saved.answers,old.answers);
 assert.equal((await db.query('select used_by_attempt_id from qib.retake_grants where previous_attempt_id=$1',[old.id])).rows[0].used_by_attempt_id,retake.body.attemptId);
 assert.equal((await call('/api/exams/retake',{token:'supervisor',body:{previousAttemptId:old.id,reason:'Reviewed additional support plan'}})).status,409);
});
test('per-question timing is server enforced, stable after revisit and cannot change after an attempt',async()=>{
 const exam=(await db.query("insert into qib.assessments(center_id,title,status) values($1,'Timed synthetic assessment','published') returning id",[ids.center])).rows[0].id;
 await db.query("insert into qib.questions(assessment_id,prompt_en,options_en,answer_index) values($1,'Timed synthetic question?','[\"A\",\"B\"]',0)",[exam]);
 await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 assert.equal((await call('/api/exams/timing',{body:{assessmentId:exam,timingMode:'per_question',secondsPerQuestion:10,minutes:30}})).status,403);
 assert.equal((await call('/api/exams/timing',{token:'supervisor',body:{assessmentId:exam,timingMode:'per_question',secondsPerQuestion:10,minutes:30}})).body.saved,true);
 const a=(await call('/api/exams/start',{body:{assessmentId:exam}})).body,q=a.questions[0].id;
 assert.equal((await call('/api/exams/answer',{body:{attemptId:a.attemptId,questionId:q,choice:0}})).status,409);
 const opened=(await call('/api/exams/open-question',{body:{attemptId:a.attemptId,questionId:q}})).body;assert.ok(opened.deadlineAt);
 assert.equal((await call('/api/exams/open-question',{body:{attemptId:a.attemptId,questionId:q}})).body.deadlineAt,opened.deadlineAt);
 assert.equal((await call('/api/exams/answer',{body:{attemptId:a.attemptId,questionId:q,choice:0}})).status,200);
 await db.query('update qib.attempts set question_clocks=$2 where id=$1',[a.attemptId,JSON.stringify({[q]:new Date(Date.now()-1000).toISOString()})]);
 assert.equal((await call('/api/exams/answer',{body:{attemptId:a.attemptId,questionId:q,choice:1}})).body.error,'QUESTION_TIME_EXPIRED');
 assert.equal((await call('/api/exams/flag',{body:{attemptId:a.attemptId,questionId:q,flagged:true}})).status,200);
 assert.equal((await call('/api/exams/timing',{token:'supervisor',body:{assessmentId:exam,timingMode:'total',secondsPerQuestion:10,minutes:30}})).status,409);
 await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor]);
});

test('exam upgrade runs repeatedly without changing attempt history or losing RLS',async()=>{
 const before=(await db.query('select id,status,score,answers,question_snapshot from qib.attempts order by id')).rows;
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/exam-workflows-upgrade.sql'),'utf8'));
 assert.deepEqual((await db.query('select id,status,score,answers,question_snapshot from qib.attempts order by id')).rows,before);
 assert.equal((await db.query("select rowsecurity from pg_tables where schemaname='qib' and tablename='retake_grants'")).rows[0].rowsecurity,true);
});

test('private content upload, source extraction and question drafts enforce center and role boundaries',async()=>{
 assert.equal((await call('/api/content/status')).status,403);
 await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 try{
 const text='Synthetic educational source for testing. The correct option is A.',file={fileName:'source.txt',mimeType:'text/plain',base64:Buffer.from(text).toString('base64')};
 assert.equal((await call('/api/content/upload',{body:file})).status,403);
 const uploaded=await call('/api/content/upload',{token:'supervisor',body:file});assert.equal(uploaded.status,200);const assetId=uploaded.body.asset.id;assert.equal(uploaded.body.sections[0].text,text);
 assert.equal((await call('/api/content/upload',{token:'supervisor',body:file})).body.asset.id,assetId);
 assert.equal((await call('/api/content/file?id='+assetId)).status,403);assert.equal((await call('/api/content/source?id='+assetId)).status,403);assert.equal((await call('/api/content/file?id='+assetId,{token:'supervisor',center:ids.other})).status,403);
 const q={specialtyId:specialty,sourceAssetId:assetId,source_section:1,source_quote:text,prompt_en:'Which option is specified in this synthetic source?',options_en:['A','B'],answer_index:0,rationale_en:'The synthetic source explicitly specifies option A.',category:'instrument_use',difficulty:'foundation'};
 assert.equal((await call('/api/content/candidate',{body:q})).status,403);
 assert.equal((await call('/api/content/candidate',{token:'supervisor',body:{...q,source_quote:'An invented supporting statement that is absent.'}})).body.error,'SOURCE_QUOTE_NOT_FOUND');
 const candidate=await call('/api/content/candidate',{token:'supervisor',body:q});assert.equal(candidate.status,200);assert.equal((await call('/api/content/candidates')).status,403);
 const exam=(await db.query("insert into qib.assessments(center_id,specialty_id,title,status) values($1,$2,'Content intake synthetic draft','draft') returning id",[ids.center,specialty])).rows[0].id;
 assert.equal((await call('/api/content/adopt',{token:'supervisor',body:{candidateId:candidate.body.id,assessmentId:exam,reviewerNote:'Reviewed synthetic source and answer integrity'}})).body.error,'INDEPENDENT_CLINICAL_REVIEW_REQUIRED');
 // Distinct verified reviewer in the same center. Synthetic test identity only.
 await db.query('update qib.question_candidates set created_by=$2 where id=$1',[candidate.body.id,ids.nurse]);
 assert.equal((await call('/api/content/adopt',{token:'supervisor',body:{candidateId:candidate.body.id,assessmentId:exam,reviewerNote:'Reviewed synthetic source and answer integrity'}})).body.adopted,true);
 assert.equal((await db.query('select status from qib.assessments where id=$1',[exam])).rows[0].status,'draft');
 assert.equal((await call('/api/content/generate',{token:'supervisor',body:{assetId,specialtyId:specialty,count:1,confirmEducationalOnly:true}})).body.error,'AI_GENERATION_NOT_CONFIGURED');
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});
test('step-based lessons persist per-user language bookmarks and restrict draft/unassigned modules and media',async()=>{
 const tr={en:{title:'Synthetic lesson',body:'Objective paragraph.\n\nExplanation paragraph.'},ar:{title:'درس تجريبي',body:'الهدف التجريبي.\n\nالشرح التجريبي.'}};
 const module=(await db.query("insert into qib.modules(center_id,specialty_id,slug,translations,status) values($1,$2,'synthetic-study-reader',$3,'published') returning id",[ids.center,specialty,JSON.stringify(tr)])).rows[0].id;
 const lesson=await call('/api/study/lesson?moduleId='+module+'&language=en');assert.equal(lesson.body.steps.length,2);assert.equal(lesson.body.step,0);
 assert.equal((await call('/api/study/step',{body:{moduleId:module,language:'en',version:1,step:1}})).body.saved,true);
 assert.equal((await call('/api/study/lesson?moduleId='+module+'&language=en')).body.step,1);assert.equal((await call('/api/study/lesson?moduleId='+module+'&language=ar')).body.step,0);
 assert.equal((await call('/api/study/step',{body:{moduleId:module,language:'en',version:2,step:1}})).status,400);
 assert.equal((await call('/api/study/lesson?moduleId='+module+'&language=en',{center:ids.other})).status,403);
 await db.query("update qib.modules set status='draft' where id=$1",[module]);assert.equal((await call('/api/study/lesson?moduleId='+module+'&language=en')).status,403);
 await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 try{const image={moduleId:module,fileName:'synthetic.png',mimeType:'image/png',base64:Buffer.from([137,80,78,71,13,10,26,10,1,2,3]).toString('base64')};const asset=(await call('/api/content/upload',{token:'supervisor',body:image})).body.asset;
 assert.equal((await call('/api/content/file?id='+asset.id)).status,403);await db.query("update qib.modules set status='published' where id=$1",[module]);assert.equal((await call('/api/content/file?id='+asset.id)).status,200);
 const different=(await db.query("select id from qib.specialties where code='dermatology'")).rows[0].id;await db.query('update qib.modules set specialty_id=$2 where id=$1',[module,different]);assert.equal((await call('/api/content/assets?moduleId='+module)).status,403);assert.equal((await call('/api/content/file?id='+asset.id)).status,403);
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});

test('growth recommendations are private, evidence based and support plans are idempotent',async()=>{
 const attempt=(await db.query("select id from qib.attempts where assessment_id=$1 order by attempt_number limit 1",[ids.exam])).rows[0];await db.query('update qib.attempts set score=50 where id=$1',[attempt.id]);
 assert.equal((await call('/api/growth/team')).status,403);assert.equal((await call('/api/growth',{center:ids.other})).status,403);
 const own=await call('/api/growth');assert.ok(own.body.gaps.some(g=>g.reference===attempt.id));const request={userId:ids.nurse,reference:attempt.id};
 assert.equal((await call('/api/growth/plan',{body:request})).status,403);
 const plan=await call('/api/growth/plan',{token:'supervisor',body:request});assert.equal(plan.status,200);assert.equal((await call('/api/growth/plan',{token:'supervisor',body:request})).body.id,plan.body.id);
 const {reminderSweep}=require('../api/growth');const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0}};await reminderSweep({query});const before=(await db.query("select count(*)::int n from qib.notifications where kind like 'training_reminder_%'")).rows[0].n;await reminderSweep({query});assert.equal((await db.query("select count(*)::int n from qib.notifications where kind like 'training_reminder_%'")).rows[0].n,before);
});

test('readiness is admin-only and reports actual preparation blockers without secrets',async()=>{
 assert.equal((await call('/api/readiness')).status,403);await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);try{const r=await call('/api/readiness',{token:'supervisor'});assert.equal(r.status,200);assert.ok(r.body.unpublishedLessons>0);assert.equal(r.body.automaticClinicalCompetency,false);assert.equal(r.body.aiConfigured,false);assert.equal(r.body.secretKey,undefined)}finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});

test('passport roadmap remains private and does not infer practical competency from theory',async()=>{
 const r=await call('/api/passport-path');assert.equal(r.status,200);assert.ok(r.body.paths.length>0);assert.equal(r.body.supervisorApprovalRequired,true);assert.equal((await call('/api/passport-path',{center:ids.other})).status,403);
 for(const p of r.body.paths){if(p.requiredSkills===0)assert.equal(p.practicalComplete,false);assert.equal(p.answer_index,undefined)}
});

test('file-free authoring creates only review-blocked drafts and preserves published content when forked',async()=>{
 const input={kind:'idea',specialtyId:specialty,title:'Synthetic preparation topic',notes:'Synthetic source facts for testing only.'};assert.equal((await call('/api/authoring/create',{body:input})).status,403);await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 try{const created=await call('/api/authoring/create',{token:'supervisor',body:input});assert.equal(created.status,200);assert.equal(created.body.clinicalContentGenerated,false);const id=created.body.module.id;
 const module=(await db.query('select * from qib.modules where id=$1',[id])).rows[0];assert.equal(module.status,'draft');assert.equal(module.translations._authoring.needsAuthoring,true);
 await call('/api/modules/request-review',{token:'supervisor',body:{moduleId:id}});assert.equal((await call('/api/modules/publish',{token:'supervisor',body:{moduleId:id,reviewerNote:'Synthetic review cannot approve a scaffold'}})).body.error,'AUTHORING_REQUIRED');
 assert.equal((await call('/api/authoring/archive',{token:'supervisor',body:{moduleId:id}})).body.status,'archived');assert.equal((await call('/api/authoring/restore',{token:'supervisor',body:{moduleId:id}})).body.status,'draft');
 await db.query("update qib.modules set status='published' where id=$1",[id]);const fork=await call('/api/authoring/fork',{token:'supervisor',body:{moduleId:id}});assert.notEqual(fork.body.module.id,id);assert.equal((await db.query('select status from qib.modules where id=$1',[id])).rows[0].status,'published');
 assert.equal((await call('/api/modules/save',{token:'supervisor',body:{specialtyId:specialty,slug:module.slug,translations:{en:{title:'Changed',body:'Changed content'}}}})).body.error,'FORK_PUBLISHED_MODULE_BEFORE_EDIT');
 assert.equal((await call('/api/authoring/fork',{token:'supervisor',center:ids.other,body:{moduleId:id}})).status,403);
 assert.equal((await call('/api/authoring/create',{token:'supervisor',body:{kind:'tool',specialtyId:specialty,sourceId:'not-in-source'}})).body.error,'SOURCE_SPECIALTY_MISMATCH');
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});

test('AI lesson proposals are compared change by change and only accepted changes reach a draft',async()=>{
 const tr={en:{title:'Synthetic hand hygiene',body:'Line one stays.\nLine two is vague.\nLine three stays.\nLine four is old.'},ar:{title:'',body:''}};
 const id=(await db.query("insert into qib.modules(center_id,specialty_id,slug,translations,status) values($1,$2,'synthetic-proposals',$3,'review') returning id",[ids.center,specialty,JSON.stringify(tr)])).rows[0].id;
 const sent=[],prior={key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL},mockFetch=global.fetch;
 let reply={title:'Synthetic hand hygiene',body:'Line one stays.\nLine two is now specific.\nLine three stays.\nLine four is new.\n[NEEDS CLINICAL INPUT: local policy]',changes:[{summary:'Clarified line two'},{summary:'Updated line four'}],review_notes:'Check local policy.'};
 global.fetch=async(url,options)=>{if(String(url)==='https://api.openai.com/v1/responses'){sent.push(JSON.parse(options.body));return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(reply)}]}]}),{status:200})}return mockFetch(url,options)};
 const gen=body=>call('/api/proposals/generate',{token:'supervisor',body:{moduleId:id,confirmEducationalOnly:true,...body}});
 assert.equal((await gen({mode:'revise',language:'en',instruction:'Make line two specific'})).status,403);
 await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 try{
  assert.equal((await gen({mode:'revise',language:'en',instruction:'Make line two specific'})).body.error,'AI_GENERATION_NOT_CONFIGURED');
  process.env.OPENAI_API_KEY='synthetic-key';process.env.OPENAI_MODEL='synthetic-model';
  assert.equal((await gen({mode:'revise',language:'en',instruction:'Make line two specific',confirmEducationalOnly:false})).body.error,'EDUCATIONAL_CONTENT_CONFIRMATION_REQUIRED');
  assert.equal((await gen({mode:'revise',language:'en',instruction:'x'})).body.error,'EDIT_INSTRUCTION_REQUIRED');
  assert.equal((await gen({mode:'revise',language:'ar',instruction:'Make line two specific'})).body.error,'LESSON_TEXT_REQUIRED');
  assert.equal((await call('/api/proposals/generate',{token:'supervisor',center:ids.other,body:{moduleId:id,mode:'revise',language:'en',instruction:'Make line two specific',confirmEducationalOnly:true}})).status,403);
  const made=await gen({mode:'revise',language:'en',instruction:'Make line two specific'});assert.equal(made.status,200);assert.equal(sent.length,1);assert.equal(sent[0].store,false);assert.match(sent[0].instructions,/untrusted data/);
  const p=made.body.proposal,changes=p.segments.filter(s=>s.kind==='change');assert.equal(p.status,'pending');assert.equal(changes.length,2);assert.deepEqual(changes[0].removed,['Line two is vague.']);assert.deepEqual(changes[0].added,['Line two is now specific.']);
  assert.equal((await db.query('select version,translations from qib.modules where id=$1',[id])).rows[0].translations.en.body,tr.en.body);
  assert.equal((await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:p.id,acceptChangeIds:[99]}})).body.error,'INVALID_CHANGE_SELECTION');
  const decided=await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:p.id,acceptChangeIds:[changes[0].id],note:'Accept clarity only'}});assert.equal(decided.body.status,'partially_accepted');assert.equal(decided.body.moduleStatus,'draft');
  const m=(await db.query('select * from qib.modules where id=$1',[id])).rows[0];assert.equal(m.status,'draft');assert.equal(m.version,2);assert.equal(m.translations.en.body,'Line one stays.\nLine two is now specific.\nLine three stays.\nLine four is old.');assert.equal(m.translations._aiAssist.en.clinicalReview,'pending');
  assert.equal((await db.query("select count(*)::int as n from qib.content_revisions where module_id=$1 and snapshot->>'action'='ai_proposal_applied'",[id])).rows[0].n,1);
  assert.equal((await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:p.id,acceptChangeIds:[]}})).body.error,'PROPOSAL_ALREADY_DECIDED');
  reply={title:'نظافة اليدين التجريبية',body:'سطر أول\nسطر ثانٍ\nسطر ثالث\nسطر رابع',changes:[],review_notes:'Language review required.'};
  assert.equal((await gen({mode:'translate',language:'ar',sourceLanguage:'ar'})).body.error,'INVALID_SOURCE_LANGUAGE');
  const old=(await gen({mode:'translate',language:'ar',sourceLanguage:'en'})).body.proposal;
  const translated=(await gen({mode:'translate',language:'ar',sourceLanguage:'en'})).body.proposal;assert.equal(translated.title.changed,true);
  assert.equal((await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:translated.id,acceptTitle:true,acceptChangeIds:translated.segments.filter(s=>s.kind==='change').map(s=>s.id)}})).body.status,'accepted');
  assert.equal((await db.query('select translations from qib.modules where id=$1',[id])).rows[0].translations.ar.body,reply.body);
  assert.equal((await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:old.id,acceptTitle:true}})).body.error,'PROPOSAL_STALE');
  assert.equal((await call('/api/proposals/decide',{token:'supervisor',body:{proposalId:old.id,acceptChangeIds:[],note:'Superseded'}})).body.status,'rejected');
  const listed=await call('/api/proposals?moduleId='+id,{token:'supervisor'});assert.equal(listed.body.proposals.length,3);assert.equal(listed.body.proposals.find(x=>x.id===p.id).stale,true);
  await db.query("update qib.modules set status='published' where id=$1",[id]);assert.equal((await gen({mode:'revise',language:'en',instruction:'Make line two specific'})).body.error,'FORK_PUBLISHED_MODULE_BEFORE_EDIT');
 }finally{global.fetch=mockFetch;for(const [k,v] of [['OPENAI_API_KEY',prior.key],['OPENAI_MODEL',prior.model]])if(v===undefined)delete process.env[k];else process.env[k]=v;await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});

test('rule-based drafting and content search respect roles, centers and specialty assignment',async()=>{
 const rows=[['Tools','rt0',{id:'rt0',specialtyId:'dental',nameEn:'Synthetic mirror',useEn:'Synthetic indirect vision'}],['Tools','rt1',{id:'rt1',specialtyId:'dental',nameEn:'Synthetic probe',useEn:'Synthetic pocket measurement'}],['Tools','rt2',{id:'rt2',specialtyId:'dental',nameEn:'Synthetic pliers',useEn:'Synthetic small item transfer'}],['Tools','rt3',{id:'rt3',specialtyId:'dental',nameEn:'Synthetic bib',useEn:'Synthetic clothing protection'}],['Tools','rx0',{id:'rx0',specialtyId:'zz-other',nameEn:'Other specialty laser',useEn:'Not assigned to nurse'}]];
 for(const [s,id,p] of rows)await db.query('insert into qib.legacy_catalog(source_name,legacy_id,specialty_legacy_id,payload,content_hash) values($1,$2,$3,$4,$5)',[s,id,p.specialtyId,JSON.stringify(p),'synthetic-test-hash']);
 try{
  assert.equal((await call('/api/content/rule-candidates',{body:{specialtyId:specialty,count:5}})).status,403);
  await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
  try{
   assert.equal((await call('/api/content/rule-candidates',{token:'supervisor',body:{specialtyId:specialty,count:0}})).body.error,'INVALID_COUNT');
   const made=await call('/api/content/rule-candidates',{token:'supervisor',body:{specialtyId:specialty,count:50,categories:['instrument_use']}});assert.equal(made.status,200);assert.equal(made.body.aiUsed,false);assert.ok(made.body.created>=4);
   const rowsOut=(await db.query("select * from qib.question_candidates where origin='catalog_rule_draft' and center_id=$1",[ids.center])).rows;assert.equal(rowsOut.length,made.body.created);assert.ok(rowsOut.every(r=>r.status==='draft'&&r.category==='instrument_use'&&r.source_quote));
   assert.equal((await call('/api/content/rule-candidates',{token:'supervisor',body:{specialtyId:specialty,count:50,categories:['instrument_use']}})).body.created,0);
  }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
  const nurse=await call('/api/search?q='+encodeURIComponent('synthetic mirror'));assert.equal(nurse.status,200);assert.equal(nurse.body.tools[0].id,'rt0');
  assert.equal((await call('/api/search?q=laser')).body.tools.length,0);
  assert.equal((await call('/api/search?q=laser',{token:'supervisor'})).body.tools.length,1);
  assert.equal((await call('/api/search?q=mirror',{center:ids.other})).status,403);
 }finally{await db.query("delete from qib.question_candidates where origin='catalog_rule_draft'");await db.query("delete from qib.legacy_catalog where legacy_id=any($1::text[])",[rows.map(r=>r[1])])}
});


test('guided clinic enforces specialty, explicit source review, private resume and server-side tray decisions without competency',async()=>{
 const pack=require('../content/nse-dental.json');
 const rows=[['Tools','clinic-t0',{id:'clinic-t0',specialtyId:'dental',nameEn:'Synthetic clinic tool'}],['Tools','clinic-t1',{id:'clinic-t1',specialtyId:'dental',nameEn:'Synthetic spare'}],['Procedures','clinic-p',{id:'clinic-p',specialtyId:'dental',nameEn:'Synthetic clinic procedure',toolIds:['clinic-t0'],consumableIds:[]}],['Procedures','clinic-broken',{id:'clinic-broken',specialtyId:'dental',nameEn:'Missing association',toolIds:['not-present']}]];
 for(const [source,id,payload] of rows)await db.query('insert into qib.legacy_catalog(source_name,legacy_id,specialty_legacy_id,payload,content_hash) values($1,$2,$3,$4,$5)',[source,id,'dental',JSON.stringify(payload),'synthetic-clinic-hash']);
 const before=(await db.query('select count(*)::int n from qib.certificates')).rows[0].n;
 assert.equal((await call('/api/clinic/setup',{center:ids.other})).status,403);
 assert.equal((await call('/api/clinic/start',{body:{procedureId:'clinic-p',preview:true}})).status,403);
 assert.equal((await call('/api/clinic/start',{body:{procedureId:'clinic-p'}})).body.error,'CLINIC_REVIEW_REQUIRED');
 await db.query("update qib.memberships set role='admin' where user_id=$1",[ids.supervisor]);
 try{
  const setup=await call('/api/clinic/setup',{token:'supervisor'});assert.equal(setup.body.ready,false);assert(setup.body.procedures.some(p=>p.id==='clinic-p'));assert(!setup.body.procedures.some(p=>p.id==='clinic-broken'));
  const preview=await call('/api/clinic/start',{token:'supervisor',body:{procedureId:'clinic-p',preview:true}});assert.equal(preview.status,200);assert.equal(preview.body.preview,true);assert.equal(preview.body.lessons.length,6);assert.equal(preview.body.awardsCompetency,false);
  assert.equal((await call('/api/clinic/session?sessionId='+preview.body.id)).status,403);
  assert.equal((await call('/api/clinic/review',{token:'supervisor',body:{note:'Synthetic clinical language and policy review',confirmed:true}})).body.error,'CLINIC_SOURCES_NOT_PUBLISHED');
  for(const m of pack.modules)await db.query("insert into qib.modules(center_id,specialty_id,slug,translations,status) values($1,$2,$3,$4,'published') on conflict(center_id,slug) do update set translations=excluded.translations,status='published'",[ids.center,specialty,m.slug,JSON.stringify(m.translations)]);
  assert.equal((await call('/api/clinic/review',{body:{note:'Unprivileged review',confirmed:true}})).status,403);
  assert.equal((await call('/api/clinic/review',{token:'supervisor',body:{note:'Synthetic clinical language and policy review',confirmed:true}})).status,200);
  assert.equal((await call('/api/clinic/setup')).body.ready,true);
  const start=await call('/api/clinic/start',{body:{procedureId:'clinic-p'}}),id=start.body.id;assert.equal(start.status,200);assert.equal(start.body.requiredTools,undefined);
  assert.equal((await call('/api/clinic/act',{body:{sessionId:id,step:4,action:'handover'}})).status,409);
  let r=await call('/api/clinic/act',{body:{sessionId:id,step:0,action:'rush'}});assert.equal(r.body.accepted,false);assert.equal(r.body.step,0);
  r=await call('/api/clinic/act',{body:{sessionId:id,step:0,action:'receive'}});assert.equal(r.body.step,1);
  assert.equal((await call('/api/clinic/session?sessionId='+id)).body.step,1);
  await call('/api/clinic/act',{body:{sessionId:id,step:1,action:'prepare'}});
  assert.equal((await call('/api/clinic/act',{body:{sessionId:id,step:2,tools:['foreign-id']}})).status,400);
  assert.equal((await call('/api/clinic/act',{body:{sessionId:id,step:2,tools:['clinic-t0','clinic-t1']}})).body.accepted,false);
  assert.equal((await call('/api/clinic/act',{body:{sessionId:id,step:2,tools:['clinic-t0']}})).body.step,3);
  await call('/api/clinic/act',{body:{sessionId:id,step:3,action:'pause'}});
  const done=await call('/api/clinic/act',{body:{sessionId:id,step:4,action:'handover'}});assert.equal(done.body.status,'completed');assert.equal(done.body.awardsCompetency,false);assert.equal(done.body.events.length,7);
  assert.equal((await db.query('select count(*)::int n from qib.certificates')).rows[0].n,before);
  await db.query("update qib.modules set version=version+1 where center_id=$1 and slug=$2",[ids.center,pack.modules[0].slug]);assert.equal((await call('/api/clinic/setup')).body.ready,false);assert.equal((await call('/api/clinic/session?sessionId='+id)).body.error,'CLINIC_SOURCE_CHANGED');
  await db.query('delete from qib.assignments where user_id=$1 and center_id=$2 and specialty_id=$3',[ids.nurse,ids.center,specialty]);assert.equal((await call('/api/clinic/setup')).status,403);await db.query('insert into qib.assignments(user_id,center_id,specialty_id) values($1,$2,$3)',[ids.nurse,ids.center,specialty]);
 }finally{await db.query("update qib.memberships set role='supervisor' where user_id=$1",[ids.supervisor])}
});

test('revoked Supabase session cannot reuse an unexpired token',async()=>{
 await db.query('delete from auth.sessions where id=$1',[sessions.nurse]);
 assert.equal((await call('/api/bootstrap')).status,401);
});
