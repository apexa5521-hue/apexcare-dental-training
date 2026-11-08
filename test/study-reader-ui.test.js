'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),apiRequire=createRequire(path.resolve(__dirname,'../api/package.json')),{JSDOM}=apiRequire('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('real study reader renders short steps, saves navigation, completes only on final step and supports RTL',async()=>{
 const dom=new JSDOM('<dialog id="modal"><div id="modalBody"></div></dialog>',{runScripts:'outside-only',url:'https://nse.test'}),w=dom.window,doc=w.document;const modal=doc.getElementById('modal');modal.showModal=()=>modal.open=true;modal.close=()=>modal.open=false;
 w.eval(fs.readFileSync(path.join(__dirname,'../v2/study-reader.js'),'utf8'));const calls=[];let completed=false,returned=false;
 const el=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 await w.openNseStudy({module:{id:'synthetic-module'},language:'ar',center:'synthetic-center',el,request:async url=>url.includes('/study/')?{title:'درس تجريبي',version:1,steps:['هدف قصير','شرح قصير','ملخص'],step:0}:{assets:[]},post:async(route,body)=>calls.push({route,body}),isComplete:()=>completed,onComplete:async()=>completed=true,onLibrary:()=>returned=true});
 assert.equal(doc.getElementById('modalBody').dir,'rtl');assert.match(doc.body.textContent,/هدف قصير/);assert.equal([...doc.querySelectorAll('button')].find(b=>b.textContent==='السابق').disabled,true);
 for(let i=0;i<2;i++){[...doc.querySelectorAll('button')].find(b=>b.textContent==='التالي').click();await tick()}
 assert.equal(completed,false);assert.equal(calls.length,2);assert.equal(calls[1].body.step,2);assert.match(doc.body.textContent,/ملخص/);
 [...doc.querySelectorAll('button')].find(b=>b.textContent==='تسجيل إكمال المذاكرة').click();await tick();assert.equal(completed,true);
 [...doc.querySelectorAll('button')].find(b=>b.textContent==='العودة للمكتبة').click();assert.equal(returned,true);assert.equal(modal.open,false);w.close();
});
test('content studio clearly disables unconfigured AI while keeping manual authoring and uploads available',async()=>{
 const dom=new JSDOM('<section class="view" data-page="studio"></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(fs.readFileSync(path.join(__dirname,'../v2/content-studio.js'),'utf8'));const el=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const studio=w.initContentStudio({el,post:async()=>{},context:()=>({role:'admin',center:'synthetic',specialties:[{id:'s',label:'Synthetic specialty'}]}),request:async url=>url.includes('/status')?{aiConfigured:false,categories:['instrument_use'],types:{'text/plain':1}}:url.includes('/assets')?{assets:[]}:url.includes('/modules')?{modules:[]}:url.includes('/exams')?{assessments:[]}:{candidates:[]}});await studio.mount();
 const buttons=[...d.querySelectorAll('button')];assert.equal(buttons.find(b=>b.textContent.includes('Generate drafts')).disabled,true);assert.equal(buttons.find(b=>b.textContent.includes('Save question draft')).disabled,false);assert.equal(d.querySelectorAll('input[type=file]').length,1);assert.match(d.body.textContent,/غير مهيأ/);w.close();
});
