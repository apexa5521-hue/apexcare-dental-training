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
 assert.equal((await call('/api/exams/answer',{body:{attemptId,questionId,choice:1}})).status,200);
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
 }finally{await db.query('delete from qib.platform_owners where user_id=$1',[ids.supervisor]);await db.query("update qib.memberships set role='supervisor' where user_id=$1 and center_id=$2",[ids.supervisor,ids.center])}
});

test('revoked Supabase session cannot reuse an unexpired token',async()=>{
 await db.query('delete from auth.sessions where id=$1',[sessions.nurse]);
 assert.equal((await call('/api/bootstrap')).status,401);
});
