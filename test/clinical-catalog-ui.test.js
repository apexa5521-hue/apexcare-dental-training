'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('../api/node_modules/jsdom');
test('clinical catalog shows procedure tools with source images, purpose and active selection',()=>{
 const dom=new JSDOM('<select id="language"><option value="en">English</option></select><input id="catalogSpecialty" value="dental"><input id="catalogSearch"><div id="catalogProceduresList"></div><div id="catalogToolList"></div><h2 id="procedureHeading"></h2><p id="procedureDetail"></p><div id="procedureChecklist"></div>',{runScripts:'outside-only'}),w=dom.window;
 const code=fs.readFileSync(require.resolve('../v2/live.js'),'utf8');
 w.eval(`const $=id=>document.getElementById(id);const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};const setText=(id,v)=>$(id).textContent=v;const translated=x=>({name:x.nameEn,use:x.useEn});const state={catalog:{procedures:[{id:'p1',specialtyId:'dental',nameEn:'Examination',toolIds:['t1','t2'],consumableIds:[]}],tools:[{id:'t1',specialtyId:'dental',nameEn:'Mirror',useEn:'Indirect vision',imageUrl:'https://example.org/mirror.png'},{id:'t2',specialtyId:'dental',nameEn:'Probe',useEn:'Examination',imageUrl:''}]},selectedProcedure:null};`+code.slice(code.indexOf(' function renderCatalog(){'),code.indexOf(' async function loadExams(){'))+'renderCatalog();');
 const doc=w.document;assert.equal(doc.querySelector('#catalogProceduresList button').getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelector('#procedureChecklist img').alt,'Mirror');assert.match(doc.getElementById('procedureChecklist').textContent,/Indirect vision/);assert.match(doc.getElementById('procedureChecklist').textContent,/Image unavailable/);
 assert.equal(doc.querySelector('.skill-checkbox'),null);
 assert.equal(doc.querySelector('#procedureChecklist [role="status"]'),null);
 doc.querySelector('.procedure-practice-toggle').click();
 const check=doc.querySelector('.skill-checkbox');check.checked=true;check.dispatchEvent(new w.Event('change'));assert.match(doc.getElementById('procedureChecklist').textContent,/1 \/ 2 checked/);
 doc.querySelector('.procedure-practice-toggle').click();
 assert.equal(doc.querySelector('.skill-checkbox'),null);
 const search=doc.getElementById('catalogSearch');search.value='Indirect vision';search.dispatchEvent(new w.Event('input'));assert.equal(doc.querySelectorAll('#catalogToolList .skill-row').length,1);
 dom.window.close();
});

test('procedure and specialty tools are mutually exclusive and exploration is paginated',()=>{
 const dom=new JSDOM('<select id="language"><option value="en">English</option></select><section class="view" data-page="catalog"><div class="two section"><div class="card"><h2>Specialty</h2><select id="catalogSpecialty"><option value="dental">Dental</option></select><input id="catalogSearch"><h3>Procedure</h3><div id="catalogProceduresList"></div></div><div class="card"><h2 id="procedureHeading"></h2><p id="procedureDetail"></p><div id="procedureChecklist"></div><h3>Explore</h3><div id="catalogToolList"></div></div></div></section>',{runScripts:'outside-only'}),w=dom.window;
 const code=fs.readFileSync(require.resolve('../v2/live.js'),'utf8');
 w.eval(`const $=id=>document.getElementById(id);const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};const setText=(id,v)=>$(id).textContent=v;const translated=x=>({name:x.nameEn,use:x.useEn});const state={catalog:{procedures:[{id:'p1',specialtyId:'dental',nameEn:'Examination',toolIds:['t0'],consumableIds:[]}],tools:Array.from({length:9},(_,i)=>({id:'t'+i,specialtyId:'dental',nameEn:'Tool '+i,useEn:'Purpose '+i}))},selectedProcedure:null};`+code.slice(code.indexOf(' function renderCatalog(){'),code.indexOf(' async function loadExams(){'))+'renderCatalog();');
 const doc=w.document,procedure=doc.getElementById('catalogProcedurePanel'),explore=doc.getElementById('catalogExplorePanel');
 assert.equal(procedure.hidden,false);assert.equal(explore.hidden,true);assert.equal(doc.querySelectorAll('#procedureChecklist .skill-row').length,1);
 doc.querySelector('[data-catalog-mode="explore"]').click();assert.equal(procedure.hidden,true);assert.equal(explore.hidden,false);assert.equal(doc.querySelectorAll('#catalogToolList .skill-row').length,4);
 [...doc.querySelectorAll('.catalog-tool-pages button')].find(b=>b.textContent==='Next').click();assert.match(explore.textContent,/Tool 4/);assert.doesNotMatch(explore.textContent,/Tool 0/);
 const search=doc.getElementById('catalogSearch');search.value='Purpose 8';search.dispatchEvent(new w.Event('input'));assert.equal(doc.querySelectorAll('#catalogToolList .skill-row').length,1);
 doc.querySelector('[data-catalog-mode="procedure"]').click();assert.equal(explore.hidden,true);assert.equal(procedure.hidden,false);dom.window.close();
});
