'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {pickItem,pickDrill,riyadhDay}=require('../api/daily-practice');const {buildRuleCandidates}=require('../api/content-rules');
const tools=Array.from({length:8},(_,i)=>({id:'t'+i,specialtyId:'dental',nameEn:'Item '+i,useEn:'Documented use '+i,imageUrl:i%2?'https://img.test/'+i+'.webp':''}));
const procedures=[{id:'p1',specialtyId:'dental',nameEn:'Examination',toolIds:'["t1","t2","t3"]'}];
test('item of the day is stable for a day, prefers items with images and stays in the specialty',()=>{
 const a=pickItem({tools,procedures,specialtyCodes:['dental'],day:'2026-11-11'}),b=pickItem({tools,procedures,specialtyCodes:['dental'],day:'2026-11-11'});
 assert.equal(a.id,b.id);assert.ok(a.imageUrl);assert.equal(pickItem({tools,procedures,specialtyCodes:['other'],day:'2026-11-11'}),null);
 const days=new Set(['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06'].map(day=>pickItem({tools,procedures,specialtyCodes:['dental'],day}).id));assert.ok(days.size>1);
 assert.match(riyadhDay(new Date('2026-11-10T22:30:00Z')),/^2026-11-11$/);
});
test('daily drill takes three questions across categories with valid answer keys',()=>{
 const pool=buildRuleCandidates({tools,procedures,specialtyCode:'dental',categories:['instrument_name','instrument_use','procedure_preparation']});
 const d=pickDrill(pool,'2026-11-11|u');assert.equal(d.length,3);assert.equal(new Set(d.map(q=>q.category)).size,3);
 assert.deepEqual(pickDrill(pool,'2026-11-11|u').map(q=>q.prompt_en),d.map(q=>q.prompt_en));
 for(const q of d)assert.ok(q.answer_index>=0&&q.answer_index<q.options_en.length);
 assert.equal(pickDrill(pool.slice(0,2),'k'),null);
});
