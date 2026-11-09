'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {diff,apply,propose}=require('../api/content-proposals');
test('proposal diff keeps unchanged lines and applies only selected changes',()=>{
 const before='a\nb\nc\nd',after='a\nB\nc\nd\ne',segments=diff(before,after),changes=segments.filter(s=>s.kind==='change');
 assert.equal(changes.length,2);assert.equal(apply(segments,[]),before);assert.equal(apply(segments,changes.map(c=>c.id)),after);assert.equal(apply(segments,[changes[1].id]),'a\nb\nc\nd\ne');
 assert.deepEqual(diff('','x\ny').filter(s=>s.kind==='change')[0].added,['x','y']);
});
test('proposal output is validated and missing configuration is refused',async()=>{
 await assert.rejects(propose({mode:'revise',targetLang:'en',current:{title:'t',body:'b'}},{key:'',model:''}),/AI_GENERATION_NOT_CONFIGURED/);
 const fetcher=async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({title:'',body:'x',changes:[],review_notes:''})}]}]}));
 await assert.rejects(propose({mode:'revise',targetLang:'en',current:{title:'t',body:'b'}},{fetcher,key:'k',model:'m'}),/INVALID_AI_OUTPUT/);
});
test('proposal studio applies only the changes left selected and disables generation without AI',async()=>{
 const path=require('node:path'),fs=require('node:fs'),{createRequire}=require('node:module'),{JSDOM}=createRequire(path.resolve(__dirname,'../api/package.json'))('jsdom');
 const dom=new JSDOM('<section id="root"></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;w.eval(fs.readFileSync(path.join(__dirname,'../v2/proposal-studio.js'),'utf8'));
 const el=(tag,text,cls)=>{const n=d.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
 const segments=diff('a\nb\nc','a\nB\nc\nD');const proposal={id:'p1',mode:'revise',language:'en',status:'pending',baseVersion:1,stale:false,changes:['x'],reviewNotes:'',instruction:'Clarify',title:{before:'T',after:'T2',changed:true},segments};
 const posts=[];let refreshed=0;
 await w.nseMountProposals({root:d.getElementById('root'),el,ctx:{center:'c'},aiConfigured:false,modules:[{id:'m1',slug:'m',status:'draft',version:1,translations:{en:{title:'T'}}}],request:async()=>({proposals:[proposal]}),post:async(route,body)=>{posts.push([route,body]);return {status:'partially_accepted',version:2}},refresh:async()=>{refreshed++}});
 const buttons=[...d.querySelectorAll('button')];assert.equal(buttons.find(b=>b.textContent.includes('Generate proposal')).disabled,true);
 const boxes=[...d.querySelectorAll('.nse-diff input[type=checkbox]')];assert.equal(boxes.length,3);boxes[0].checked=false;boxes[0].onchange();
 buttons.find(b=>b.textContent.includes('Apply selected')).click();await new Promise(r=>setTimeout(r,10));
 assert.equal(posts[0][0],'/api/proposals/decide');assert.equal(posts[0][1].acceptTitle,false);assert.equal(JSON.stringify(posts[0][1].acceptChangeIds),JSON.stringify(segments.filter(s=>s.kind==="change").map(s=>s.id)));assert.equal(refreshed,1);w.close();
});
