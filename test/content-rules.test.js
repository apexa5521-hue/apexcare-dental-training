'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildRuleCandidates,balance}=require('../api/content-rules');const {search,norm}=require('../api/content-search');
const tools=['Mouth mirror|Indirect vision and retraction','Explorer|Detects caries and calculus','Cotton pliers|Carries small items into the mouth','Saliva ejector|Removes saliva during treatment','Bib|Protects the patient clothing','Excavator|Removes soft carious dentine'].map((x,i)=>{const [nameEn,useEn]=x.split('|');return {id:'t'+i,specialtyId:'dental',nameEn,useEn,nameAr:['مرآة الفم','مسبار','ملقط قطن','شفاط اللعاب','مريلة','مجرفة'][i]}});
const procedures=[{id:'p1',specialtyId:'dental',nameEn:'Dental examination',nameAr:'فحص الأسنان',toolIds:'["t0","t1","t2"]',consumableIds:'["t4","missing"]'}];
const ipcModules=[{id:'m1',nameEn:'Hand hygiene'}],ipcSteps=['Wet hands','Apply soap','Rub all surfaces','Rinse','Dry with single-use towel'].map((textEn,i)=>({id:'s'+i,moduleId:'m1',textEn,order:i+1}));
test('rule candidates come only from documented catalog facts and keep the answer key correct',()=>{
 const all=buildRuleCandidates({tools,procedures,ipcModules,ipcSteps,specialtyCode:'dental'});
 assert.deepEqual([...new Set(all.map(q=>q.category))].sort(),['instrument_name','instrument_use','procedure_preparation','sequence']);
 for(const q of all){assert.equal(q.options_en.length,4);assert.equal(new Set(q.options_en).size,4);assert.ok(q.rationale_en.length>=10);assert.ok(q.source_quote.length>=12);assert.doesNotMatch(q.prompt_en+q.options_en.join(' '),/[؀-ۿ]/)}
 const use=all.find(q=>q.prompt_en==='What is the documented purpose of Explorer?');assert.equal(use.options_en[use.answer_index],'Detects caries and calculus');
 const not=all.find(q=>q.prompt_en.includes('NOT part'));assert.ok(!['Mouth mirror','Explorer','Cotton pliers','Bib'].includes(not.options_en[not.answer_index]));
 const after=all.find(q=>q.prompt_en.includes('after: "Apply soap"'));assert.equal(after.options_en[after.answer_index],'Rub all surfaces');
 assert.equal(buildRuleCandidates({tools,procedures,ipcModules,ipcSteps,specialtyCode:'other'}).filter(q=>q.category!=='sequence').length,0);
 const picked=balance(all,4);assert.equal(new Set(picked.map(q=>q.category)).size,4);
});
test('content search answers from the catalog in Arabic and English, tolerating spelling forms',()=>{
 assert.equal(norm('إستخدامُ المرآة'),norm('استخدام المراه'));
 const r=search({q:'مراه',tools,procedures,ipcModules,ipcSteps,lessons:[]});assert.equal(r.tools[0].id,'t0');assert.equal(r.tools[0].procedures[0].id,'p1');assert.equal(r.aiUsed,false);
 const p=search({q:'examination',tools,procedures,ipcModules,ipcSteps,lessons:[{id:'l1',translations:{en:{title:'Exam room set-up',body:'Prepare the examination tray before the patient sits.'}}}]});
 assert.equal(p.procedures[0].unresolvedItems,1);assert.equal(p.procedures[0].tools.length,4);assert.match(p.lessons[0].snippet,/examination tray/);
 assert.equal(search({q:'soap',tools,procedures,ipcModules,ipcSteps,lessons:[]}).infectionPrevention[0].id,'m1');
 assert.throws(()=>search({q:'x',tools,procedures,ipcModules,ipcSteps,lessons:[]}),/INVALID_SEARCH/);
});
test('search card labels missing translations instead of presenting English as translated',async()=>{
 const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module'),{JSDOM}=createRequire(path.resolve(__dirname,'../api/package.json'))('jsdom');
 const dom=new JSDOM('<section data-page="home"><div class="hero"></div></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(fs.readFileSync(path.join(__dirname,'../v2/content-search.js'),'utf8'));
 const el=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};let opened=null,asked='';
 const result=search({q:'mirror',tools,procedures,ipcModules,ipcSteps,lessons:[{id:'l1',translations:{en:{title:'Mirror basics',body:'Use the mouth mirror for indirect vision.'}}}]});
 w.nseMountSearch({host:d.querySelector('section'),el,center:()=>'c1',language:()=>'ur',request:async url=>{asked=url;return JSON.parse(JSON.stringify(result))},openLesson:id=>{opened=id}});
 const form=d.querySelector('#nseSearch form');d.querySelector('#nseSearch input').value='mirror';form.onsubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,10));
 assert.match(asked,/\/api\/search\?centerId=c1&q=mirror/);assert.match(d.querySelector('#nseSearch').textContent,/Translation not available/);assert.equal(d.querySelector('#nseSearch h4 span').lang,'en');
 [...d.querySelectorAll('#nseSearch button')].find(b=>b.textContent==='Open lesson').click();assert.equal(opened,'l1');w.close();
});
