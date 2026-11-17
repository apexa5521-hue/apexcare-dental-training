'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('../api/node_modules/jsdom');
const proposals=require('../api/content-proposals');
const source={title:'غسل اليدين',body:'بللي اليدين بالماء.'};
function route(body,role='admin'){return proposals({req:{method:'POST'},url:new URL('http://test/api/proposals/translate-preview'),body,role:{role},deny(){throw Error('DENIED')},c:{query(){throw Error('Unexpected database access')}}});}
test('unsaved translation rejects non-admins, missing consent, invalid languages and oversized input',async()=>{
 const valid={source,sourceLanguage:'ar',language:'en',confirmEducationalOnly:true};
 await assert.rejects(route(valid,'nurse'),/DENIED/);
 await assert.rejects(route({...valid,confirmEducationalOnly:false}),/CONFIRMATION/);
 await assert.rejects(route({...valid,language:'ar'}),/INVALID_SOURCE/);
 await assert.rejects(route({...valid,source:{...source,body:'x'.repeat(12001)}}),/INVALID_TRANSLATION_SOURCE/);
});
test('paid automatic translation is blocked even when provider credentials exist',async()=>{
 const oldFetch=global.fetch;let called=false;global.fetch=async()=>{called=true;throw Error('Provider must not be called')};
 try{await assert.rejects(route({source,sourceLanguage:'ar',language:'en',confirmEducationalOnly:true}),/PAID_AUTO_TRANSLATION_DISABLED/);assert.equal(called,false);}finally{global.fetch=oldFetch;}
});
test('bilingual manual editor no longer schedules automatic provider requests',()=>{
 const code=fs.readFileSync(require.resolve('../v2/live.js'),'utf8');
 assert.equal(code.includes("post('/api/proposals/translate-preview'"),false);
 for(const id of ['titleAr','bodyAr','titleEn','bodyEn'])assert.ok(code.includes(id)||fs.readFileSync(require.resolve('../v2/live.html'),'utf8').includes(id));
});
