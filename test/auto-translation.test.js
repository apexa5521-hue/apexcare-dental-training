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
test('translation endpoint returns a draft without database writes',async()=>{
 const oldFetch=global.fetch,oldKey=process.env.OPENAI_API_KEY,oldModel=process.env.OPENAI_MODEL;
 process.env.OPENAI_API_KEY='test-key';process.env.OPENAI_MODEL='test-model';
 global.fetch=async(url,options)=>{const payload=JSON.parse(options.body);assert.equal(payload.store,false);assert.equal(JSON.parse(payload.input).lesson.body,source.body);return {ok:true,json:async()=>({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({title:'Handwashing',body:'Wet hands with water.',changes:[],review_notes:'Clinical review required'})}]}]})};};
 try{const result=await route({source,sourceLanguage:'ar',language:'en',confirmEducationalOnly:true});assert.equal(result.data.translation.title,'Handwashing');assert.equal(result.data.status,'draft');assert.equal(result.data.clinicalReviewRequired,true);}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.OPENAI_MODEL;else process.env.OPENAI_MODEL=oldModel;}
});
function ui(){
 const dom=new JSDOM('<form id="moduleForm"><input id="titleAr"><textarea id="bodyAr"></textarea><input id="titleEn"><textarea id="bodyEn"></textarea></form>',{runScripts:'outside-only'}),w=dom.window;
 const code=fs.readFileSync(require.resolve('../v2/live.js'),'utf8').split(' // Opt-in automatic Arabic')[1].split(' let clientReady,workspaceOpening;')[0];
 let timer,resolve;
 w.setTimeout=fn=>{timer=fn;return 1};w.clearTimeout=()=>{timer=null};
 w.document.getElementById('titleAr').value=source.title;w.document.getElementById('bodyAr').value=source.body;
 w.__post=()=>new Promise(r=>{resolve=r});
 w.eval("const state={center:'center-a',token:'token-a'}; const $=id=>document.getElementById(id); const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e}; const post=window.__post; // Opt-in automatic Arabic"+code);
 const input=id=>w.document.getElementById(id),enable=w.document.querySelector('input[type=checkbox]');
 return {dom,w,input,enable,start(){enable.checked=true;enable.dispatchEvent(new w.Event('change'));timer();},async finish(){resolve({translation:{title:'Translated',body:'Translated body'}});await Promise.resolve();await Promise.resolve();},edit(id,text){input(id).value=text;input(id).dispatchEvent(new w.Event('input'));}};
}
test('automatic translation fills empty English, preserves manual text and ignores stale responses',async()=>{
 let x=ui();x.start();await x.finish();assert.equal(x.input('titleEn').value,'Translated');x.dom.window.close();
 x=ui();x.input('titleEn').value='Manual';x.start();await x.finish();assert.equal(x.input('titleEn').value,'Manual');const apply=[...x.w.document.querySelectorAll('button')][0];assert.equal(apply.hidden,false);apply.click();assert.equal(x.input('titleEn').value,'Translated');x.dom.window.close();
 x=ui();x.start();x.edit('titleAr','نص أحدث');await x.finish();assert.equal(x.input('titleEn').value,'');x.dom.window.close();
 x=ui();x.start();x.edit('titleEn','Keep this');await x.finish();assert.equal(x.input('titleEn').value,'Keep this');x.dom.window.close();
 x=ui();x.start();x.enable.checked=false;x.enable.dispatchEvent(new x.w.Event('change'));await x.finish();assert.equal(x.input('titleEn').value,'');x.dom.window.close();
});
