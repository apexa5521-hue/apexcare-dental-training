'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module'),req=createRequire(path.resolve(__dirname,'../api/package.json')),{JSDOM}=req('jsdom');
const tick=()=>new Promise(r=>setImmediate(r));
test('clinic interface saves actions, keeps future steps locked, resumes in each learning language and does not issue credentials',async()=>{
 const dom=new JSDOM('<main id="clinicRoot"></main>',{runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(fs.readFileSync(path.join(__dirname,'../v2/clinic-practice.js'),'utf8'));let lang='ar';
 const session={id:'s',step:0,status:'active',preview:true,procedure:{id:'p',nameEn:'Test examination',nameAr:'فحص تجريبي'},tools:[{id:'t',nameEn:'Synthetic tool'}],lessons:Array.from({length:6},(_,i)=>({slug:'lesson'+i,translations:{en:{title:'Source '+i,body:'Synthetic lesson'},ar:{title:'مصدر '+i,body:'درس تجريبي'}}})),events:[]};const calls=[];
 const el=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const api=w.initClinicPractice({el,language:()=>lang,context:()=>({center:'c'}),request:async url=>url.includes('/setup')?{ready:false,canPreview:true,publishedCount:0,requiredCount:6,procedures:[session.procedure],sessions:[]}:structuredClone(session),post:async(route,body)=>{calls.push({route,body});if(route.endsWith('/act')){session.step++;session.status=session.step===5?'completed':'active';return {...structuredClone(session),accepted:true}}return structuredClone(session)}});
 await api.load();assert.match(d.body.textContent,/معاينة/);[...d.querySelectorAll('button')].find(b=>b.textContent==='معاينة السيناريو غير المعتمد').click();await tick();assert.match(d.body.textContent,/المريض يسأل/);assert.equal(d.querySelectorAll('.clinic-stops button')[4].disabled,true);
 [...d.querySelectorAll('button')].find(b=>b.textContent==='شرح الزيارة والاتفاق على إشارة للتوقف').click();await tick();assert.equal(calls.at(-1).body.action,'receive');assert.equal(calls.at(-1).body.step,0);assert.match(d.body.textContent,/العيادة بانتظار/);assert.equal(d.querySelectorAll('.clinic-stops button')[4].disabled,true);
 [...d.querySelectorAll('button')].find(b=>b.textContent==='السابق').click();assert.match(d.body.textContent,/تم حفظ القرار/);
 for(const l of ['en','ur','id']){lang=l;await api.load();assert(!d.body.textContent.includes('undefined'))}
 assert(calls.every(c=>!c.route.includes('certificate')&&!c.route.includes('observations')));api.reset();assert.equal(d.getElementById('clinicRoot').textContent,'');w.close();
});
