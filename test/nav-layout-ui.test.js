'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path'),fs=require('node:fs');
const {createRequire}=require('node:module');const {JSDOM}=createRequire(path.resolve(__dirname,'../api/package.json'))('jsdom');
test('side menu gets an administration group and the bottom bar delegates to the real menu buttons',async()=>{
 const pages=[['home','Overview'],['learning','Learning library'],['catalog','Clinical skills'],['ipc','Infection control'],['assessments','Clinical Assessments'],['team','Nursing team'],['studio','Content studio']];
 const dom=new JSDOM('<select id="language"><option value="en" selected>en</option></select><aside class="side"><nav id="nav">'+pages.map(([id,l])=>'<button data-page="'+id+'">'+l+'</button>').join('')+'</nav></aside>',{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 try{
  const clicked=[];d.querySelectorAll('#nav button').forEach(b=>b.addEventListener('click',()=>{clicked.push(b.dataset.page);d.querySelectorAll('#nav button').forEach(x=>x.classList.toggle('selected',x===b))}));
  w.eval(fs.readFileSync(path.join(__dirname,'../v2/nav-layout.js'),'utf8'));await new Promise(r=>setTimeout(r,30));
  const group=d.querySelector('#nav .nse-nav-group');assert.equal(group.textContent,'Administration');assert.equal(group.nextElementSibling.dataset.page,'team');
  const bar=[...d.querySelectorAll('.nse-bottom button')];assert.deepEqual(bar.map(b=>b.dataset.page||'more').join(','),'home,learning,catalog,assessments,more');assert.equal(bar[1].textContent,'Learn');
  bar[3].click();assert.deepEqual(clicked,['assessments']);await new Promise(r=>setTimeout(r,20));assert.equal(d.querySelector('.nse-bottom button[data-page=assessments]').getAttribute('aria-current'),'page');
  d.querySelector('.nse-more').click();const sheet=d.querySelector('.nse-sheet');assert.equal(sheet.hidden,false);
  const items=[...sheet.querySelectorAll('.nse-sheet-grid button')].map(b=>b.dataset.page);assert.deepEqual(items.join(','),'ipc,team,studio');
  sheet.querySelector('.nse-sheet-grid button[data-page=team]').click();assert.equal(clicked.at(-1),'team');assert.equal(sheet.hidden,true);
 }finally{w.close()}
});
