"use strict";
const {test,before,after,mock}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const apiRequire=createRequire(path.resolve(__dirname,'../api/package.json'));
const {PGlite}=apiRequire('@electric-sql/pglite');
const {server,pool}=require('../api/server');
const ids={center:'10000000-0000-0000-0000-000000000001',other:'10000000-0000-0000-0000-000000000002',nurse:'20000000-0000-0000-0000-000000000001',supervisor:'20000000-0000-0000-0000-000000000002',exam:'30000000-0000-0000-0000-000000000001',reviewExam:'30000000-0000-0000-0000-000000000002'};
let db,base,specialty,nativeFetch=global.fetch;
async function call(route,{token='nurse',body,center=ids.center}={}){
 const url=base+route+(body?'':(route.includes('?')?'&':'?')+'centerId='+center);
 const response=await nativeFetch(url,{method:body?'POST':'GET',headers:{...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify({centerId:center,...body})}:{})});
 return {status:response.status,body:await response.json()};
}
before(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;');
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/schema.sql'),'utf8').replace('create extension if not exists pgcrypto;',''));
 await db.exec(fs.readFileSync(path.join(__dirname,'../deploy/legacy-catalog.sql'),'utf8'));
 const query=async(sql,args)=>{const r=await db.query(sql,args);return {...r,rowCount:r.rows.length||r.affectedRows||0}};
 mock.method(pool,'query',query);
 mock.method(pool,'connect',async()=>({query,release(){}}));
 process.env.SUPABASE_URL='https://nse-auth.test';process.env.SUPABASE_PUBLISHABLE_KEY='test-public';
 global.fetch=async(url,options)=>{
  if(String(url).startsWith('https://nse-auth.test/')){
   const token=options.headers.authorization;
   const id=token==='Bearer nurse'?ids.nurse:token==='Bearer supervisor'?ids.supervisor:null;
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
