'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path'),fs=require('node:fs');
const {createRequire}=require('node:module');const {JSDOM}=createRequire(path.resolve(__dirname,'../api/package.json'))('jsdom');
test('notification bell shows unread count, filters by category and marks all read',async()=>{
 const dom=new JSDOM('<div class="controls"></div>',{runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(fs.readFileSync(path.join(__dirname,'../v2/notifications.js'),'utf8'));
 const now=new Date().toISOString(),items=[{id:'a',kind:'learning_plan',body:'Plan ready',read_at:null,created_at:now},{id:'b',kind:'plan_completed',body:'Done',read_at:null,created_at:now},{id:'c',kind:'training_reminder_2026-11-11',body:'Reminder',read_at:now,created_at:now}];
 try{
 const posts=[];w.nseMountNotifications({center:()=>'c1',language:()=>'en',initial:items,request:async()=>({notifications:items}),post:async(r,b)=>{posts.push([r,b]);return {}}});
 await new Promise(r=>setTimeout(r,5));
 const bell=d.querySelector('.nse-bell');assert.equal(bell.querySelector('.badge').textContent,'2');assert.equal(bell.parentElement.className,'controls');
 bell.click();await new Promise(r=>setTimeout(r,5));const panel=d.querySelector('.nse-notes');assert.equal(panel.hidden,false);assert.equal(panel.querySelectorAll('.item').length,3);assert.equal(panel.querySelectorAll('.item.unread').length,2);
 [...panel.querySelectorAll('.filters button')].find(b=>b.textContent==='Results').click();assert.equal(panel.querySelectorAll('.item').length,1);
 [...panel.querySelectorAll('.filters button')].find(b=>b.textContent==='My tasks').click();assert.equal(panel.querySelectorAll('.item').length,2);
 [...panel.querySelectorAll('button')].find(b=>b.textContent==='Mark all read').click();await new Promise(r=>setTimeout(r,5));
 assert.equal(posts[0][0],'/api/notifications/read-all');assert.equal(bell.querySelector('.badge').hidden,true);
 w.nseToast({type:'success',title:'Saved'});assert.equal(d.querySelector('.nse-toast').getAttribute('role'),'status');
 }finally{w.close()}
});
