'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const path=require('node:path'),fs=require('node:fs');
const {createRequire}=require('node:module');const {JSDOM}=createRequire(path.resolve(__dirname,'../api/package.json'))('jsdom');
const tick=()=>new Promise(r=>setTimeout(r,40));
test('interface buttons follow the selected language and leave the English assessment alone',async()=>{
 const html='<select id="language"><option value="en">en</option><option value="ar">ar</option><option value="ur">ur</option><option value="id">id</option></select>'+
  '<button id="logout">Sign out</button><button id="themeToggle">Dark mode</button><button id="bi">إنشاء الطلب ونسخه · Build & copy prompt</button>'+
  '<button id="icon"><span class="nse-tab-icon"><svg></svg></span><span>Save draft</span></button><button id="custom">Custom label</button>'+
  '<div id="examPanel"><button id="exam">Next</button></div>';
 const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document,$=id=>d.getElementById(id);
 try{
  w.eval(fs.readFileSync(path.join(__dirname,'../v2/ui-text.js'),'utf8'));await tick();
  assert.equal($('logout').textContent,'Sign out');assert.equal($('bi').textContent,'إنشاء الطلب ونسخه · Build & copy prompt'.split(' · ')[1]);
  const set=l=>{$('language').value=l;$('language').dispatchEvent(new w.Event('change'))};
  set('ar');
  assert.equal($('logout').textContent,'تسجيل الخروج');assert.equal($('themeToggle').textContent,'الوضع الليلي');
  assert.equal($('bi').textContent,'إنشاء الطلب ونسخه');assert.equal($('icon').lastElementChild.textContent,'حفظ المسودة');assert.ok($('icon').querySelector('svg'));
  assert.equal($('custom').textContent,'Custom label');assert.equal($('exam').textContent,'Next');
  // A renderer rewrites the label in English: it is translated again.
  $('themeToggle').textContent='Light mode';await tick();assert.equal($('themeToggle').textContent,'الوضع النهاري');
  set('ur');assert.equal($('logout').textContent,'سائن آؤٹ');assert.equal($('bi').textContent,'Build & copy prompt');
  set('id');assert.equal($('themeToggle').textContent,'Mode terang');
  set('en');assert.equal($('logout').textContent,'Sign out');assert.equal($('themeToggle').textContent,'Light mode');
 }finally{w.nseUiText?.stop();w.close()}
});
