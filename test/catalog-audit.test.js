'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {auditCatalog}=require('../api/catalog-audit');
const route=require('../api/content-rules');
test('catalog audit preserves input and distinguishes missing associations, malformed lists and missing content',()=>{
 const input={specialties:[{id:'gp'}],tools:[{id:'t',specialtyId:'gp',nameEn:'Mirror',useEn:'Documented purpose',imageUrl:'http://insecure'}],procedures:[{id:'p',specialtyId:'gp',toolIds:'["t","lost"]',consumableIds:'{}'}]},before=JSON.stringify(input);
 const r=auditCatalog(input);assert.equal(r.counts.missing_tool_link,1);assert.equal(r.counts.invalid_association_list,1);assert.equal(r.counts.missing_or_non_https_image,1);assert.equal(r.counts.missing_purpose_ar,1);assert.equal(r.clinicalApproval,false);assert.equal(JSON.stringify(input),before);
});
test('catalog audit caps details without capping totals',()=>{
 const r=auditCatalog({tools:Array.from({length:250},(_,i)=>({id:String(i)}))});assert.equal(r.issues.length,200);assert.ok(r.totalIssues>200);assert.equal(r.detailsTruncated,true);
});
test('catalog integrity refuses nurses before reading the database',async()=>{
 let called=false;await assert.rejects(route({req:{method:'GET'},url:new URL('https://nse.test/api/catalog/integrity'),role:{role:'nurse'},deny:()=>{throw Error('FORBIDDEN')},c:{query:async()=>{called=true;return {rows:[]}}}}),/FORBIDDEN/);assert.equal(called,false);
});
