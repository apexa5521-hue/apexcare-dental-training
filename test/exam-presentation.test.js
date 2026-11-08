'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {prepareAttemptQuestions}=require('../api/exam-presentation.js');
test('attempt shuffle preserves question identity and correct answer after option permutation without mutating bank',()=>{
 const source=Array.from({length:8},(_,i)=>({id:String(i),prompt_en:'Q'+i,options_en:['wrongA','correct'+i,'wrongB'],answer_index:1}));
 const before=JSON.stringify(source),orders=new Set();
 for(let n=0;n<20;n++){const result=prepareAttemptQuestions(source);assert.deepEqual(result.map(q=>q.id).sort(),source.map(q=>q.id).sort());for(const q of result)assert.equal(q.options_en[q.answer_index],'correct'+q.id);orders.add(JSON.stringify(result));}
 assert.equal(JSON.stringify(source),before);assert.ok(orders.size>1);
});

test('authorized retake changes question and option order while preserving correct choices',()=>{
 const bank=Array.from({length:3},(_,i)=>({id:String(i),options_en:['a'+i,'b'+i,'c'+i],answer_index:1}));
 let previous=prepareAttemptQuestions(bank);
 for(let n=0;n<25;n++){const next=prepareAttemptQuestions(bank,previous);assert.notDeepEqual(next.map(q=>q.id),previous.map(q=>q.id));for(const q of next){assert.notDeepEqual(q.options_en,previous.find(old=>old.id===q.id).options_en);assert.equal(q.options_en[q.answer_index],'b'+q.id)}previous=next;}
});

test('staging upgrade refuses any other project before acquiring a database connection',async()=>{
 const {upgradeStaging}=require('../api/upgrade-staging');let connected=false;
 await assert.rejects(upgradeStaging({connect(){connected=true}},'https://other-project.supabase.co'),/NSE_STAGING_PROJECT_REQUIRED/);assert.equal(connected,false);
});
