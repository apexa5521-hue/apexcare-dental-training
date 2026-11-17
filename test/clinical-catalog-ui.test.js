'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('../api/node_modules/jsdom');
test('clinical catalog shows procedure tools with source images, purpose and active selection',()=>{
 const dom=new JSDOM('<select id="language"><option value="en">English</option></select><input id="catalogSpecialty" value="dental"><input id="catalogSearch"><div id="catalogProceduresList"></div><div id="catalogToolList"></div><h2 id="procedureHeading"></h2><p id="procedureDetail"></p><div id="procedureChecklist"></div>',{runScripts:'outside-only'}),w=dom.window;
 const code=fs.readFileSync(require.resolve('../v2/live.js'),'utf8');
 w.eval(`const $=id=>document.getElementById(id);const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};const setText=(id,v)=>$(id).textContent=v;const translated=x=>({name:x.nameEn,use:x.useEn});const state={catalog:{procedures:[{id:'p1',specialtyId:'dental',nameEn:'Examination',toolIds:['t1','t2'],consumableIds:[]}],tools:[{id:'t1',specialtyId:'dental',nameEn:'Mirror',useEn:'Indirect vision',imageUrl:'https://example.org/mirror.png'},{id:'t2',specialtyId:'dental',nameEn:'Probe',useEn:'Examination',imageUrl:''}]},selectedProcedure:null};`+code.slice(code.indexOf(' function renderCatalog(){'),code.indexOf(' async function loadExams(){'))+'renderCatalog();');
 const doc=w.document;assert.equal(doc.querySelector('#catalogProceduresList button').getAttribute('aria-pressed'),'true');
 assert.equal(doc.querySelector('#procedureChecklist img').alt,'Mirror');assert.match(doc.getElementById('procedureChecklist').textContent,/Indirect vision/);assert.match(doc.getElementById('procedureChecklist').textContent,/Image unavailable/);
 const check=doc.querySelector('.skill-checkbox');check.checked=true;check.dispatchEvent(new w.Event('change'));assert.match(doc.getElementById('procedureChecklist').textContent,/1 \/ 2 checked/);
 const search=doc.getElementById('catalogSearch');search.value='Indirect vision';search.dispatchEvent(new w.Event('input'));assert.equal(doc.querySelectorAll('#catalogToolList .skill-row').length,1);
 dom.window.close();
});
