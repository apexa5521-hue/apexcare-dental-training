'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('../api/node_modules/jsdom');
test('admin tabs translate labels and keyboard navigation skips hidden tabs',()=>{
 const dom=new JSDOM('<select id="language"><option value="en">English</option><option value="ar">العربية</option></select><section class="view" data-page="team"><div class="card"><h2>Team</h2><div id="teamList">Nurses</div><div id="assignmentForm">Assignment</div></div></section>',{runScripts:'outside-only',url:'https://test.local'});
 const w=dom.window;w.matchMedia=()=>({matches:false});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.requestAnimationFrame=()=>0;w.eval(fs.readFileSync(require.resolve('../v2/page-tabs.js'),'utf8'));w.nsePageTabs.start();
 const tabs=[...w.document.querySelectorAll('[role=tab]')],members=tabs.find(x=>x.dataset.tab==='members'),assign=tabs.find(x=>x.dataset.tab==='assign');
 assert.equal(members.lastElementChild.textContent,'Team');
 assert.equal(tabs.find(x=>x.dataset.tab==='invite').hidden,true);
 members.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(assign.getAttribute('aria-selected'),'true');
 assign.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Home',bubbles:true}));assert.equal(members.getAttribute('aria-selected'),'true');
 const lang=w.document.getElementById('language');lang.value='ar';lang.dispatchEvent(new w.Event('change'));assert.equal(members.lastElementChild.textContent,'الفريق');
 dom.window.close();
});
