'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildRound,grade}=require('../api/tray-practice');
const tools=Array.from({length:10},(_,i)=>({id:'t'+i,specialtyId:'dental',nameEn:'Item '+i,useEn:'Use '+i,nameAr:'أداة '+i}));
const procedures=[{id:'p1',specialtyId:'dental',nameEn:'Examination',toolIds:'["t0","t1"]',consumableIds:'["t2","missing"]'},{id:'p2',specialtyId:'dental',nameEn:'Too small',toolIds:'["t3"]'}];
test('tray round mixes every listed item with unlisted distractors from the same specialty',()=>{
 for(let k=0;k<20;k++){const r=buildRound({tools,procedures,specialtyCode:'dental'});assert.equal(r.procedure.id,'p1');assert.deepEqual([...r.expected].sort(),['t0','t1','t2']);
  const ids=r.options.map(o=>o.id);assert.ok(['t0','t1','t2'].every(id=>ids.includes(id)));assert.ok(ids.length>=6&&ids.length<=16);assert.equal(new Set(ids).size,ids.length);assert.ok(!ids.includes('missing'))}
 assert.equal(buildRound({tools,procedures,specialtyCode:'other'}),null);
});
test('tray grading separates correct, missed and wrong picks',()=>{
 const r=buildRound({tools,procedures,specialtyCode:'dental'}),wrong=r.options.find(o=>!r.expected.includes(o.id)).id;
 const g=grade(r.expected,r.options,['t0','t1',wrong]);assert.deepEqual(g.correct.map(x=>x.id).sort(),['t0','t1']);assert.deepEqual(g.missed.map(x=>x.id),['t2']);assert.deepEqual(g.wrong.map(x=>x.id),[wrong]);assert.equal(g.score,33);assert.equal(g.perfect,false);
 assert.equal(grade(r.expected,r.options,['t0','t1','t2']).perfect,true);assert.equal(grade(r.expected,r.options,[]).score,0);
 assert.throws(()=>grade(r.expected,r.options,['not-offered']),/INVALID_TRAY_SELECTION/);
});
