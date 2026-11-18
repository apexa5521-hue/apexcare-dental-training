'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('../api/node_modules/jsdom');

test('Lucy shows only returned records and locks all search controls during assessment', async () => {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only' });
  const w = dom.window;
  w.eval(fs.readFileSync(require.resolve('../v2/content-search.js'), 'utf8'));
  let locked = false;
  w.nseMountSearch({
    host: w.document.querySelector('main'), center: () => 'center', language: () => 'ar',
    el: (tag, text, cls) => { const e = w.document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; },
    request: async () => { if (locked) throw Error('NURSE_LUCY_UNAVAILABLE_DURING_ASSESSMENT'); return { tools: [], procedures: [], infectionPrevention: [], lessons: [] }; },
    openLesson: () => {}
  });
  const form = w.document.querySelector('form'), input = form.querySelector('input');
  input.value = 'mirror';
  await form.onsubmit({ preventDefault() {} });
  assert.match(w.document.querySelector('.notice').textContent, /ما فيه نتائج/);
  assert.equal(w.document.querySelectorAll('.hit').length, 0);
  locked = true;
  input.value = 'mirror';
  await form.onsubmit({ preventDefault() {} });
  assert.match(w.document.querySelector('.notice').textContent, /غير متاحة/);
  assert.equal(input.disabled, true);
  assert.ok([...w.document.querySelectorAll('button')].every(b => b.disabled));
  assert.equal(w.document.querySelector('#nseSearch').getAttribute('aria-busy'), 'false');
  dom.window.close();
});

test('Lucy follows page language and switches conversation direction without deleting history', async () => {
  const dom = new JSDOM('<select id="language"><option value="en">English</option><option value="ar">العربية</option></select><main></main>', { runScripts: 'outside-only' });
  const w = dom.window, doc = w.document;
  w.eval(fs.readFileSync(require.resolve('../v2/content-search.js'), 'utf8'));
  w.nseMountSearch({host:doc.querySelector('main'),center:()=> 'center',language:()=>doc.getElementById('language').value,
    el:(tag,text,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;},
    request:async()=>({tools:[],procedures:[],infectionPrevention:[],lessons:[]}),openLesson:()=>{}});
  const card=doc.getElementById('nseSearch'),picker=card.querySelector('.lucy-language'),form=card.querySelector('form');
  assert.equal(card.dir,'ltr');
  assert.match(card.querySelector('.lucy-message').textContent,/Hello/);
  form.querySelector('input').value='mirror';await form.onsubmit({preventDefault(){}});
  picker.value='ar';picker.dispatchEvent(new w.Event('change'));
  assert.equal(card.dir,'rtl');assert.match(card.querySelector('.lucy-message').textContent,/هلا/);
  assert.equal(card.querySelector('.lucy-question').textContent,'mirror');
  doc.getElementById('language').dispatchEvent(new w.Event('change'));
  assert.equal(card.dir,'ltr');assert.equal(card.querySelector('.lucy-question').textContent,'mirror');
  dom.window.close();
});

test('Lucy discards an in-flight result when an assessment starts and exposes record sources', async () => {
  const dom = new JSDOM('<main></main>', {runScripts:'outside-only'}),w=dom.window,doc=w.document;
  w.eval(fs.readFileSync(require.resolve('../v2/content-search.js'),'utf8'));
  let resolve;
  const result={tools:[{id:'original-tool-17',names:{en:'Mirror'},uses:{en:'Recorded purpose'},procedures:[]}],procedures:[],infectionPrevention:[],lessons:[]};
  const mount=request=>w.nseMountSearch({host:doc.querySelector('main'),center:()=> 'center',language:()=> 'en',el:(tag,text,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;},request,openLesson:()=>{}});
  mount(async()=>result);
  let form=doc.querySelector('form');form.querySelector('input').value='mirror';
  await form.onsubmit({preventDefault(){}});
  assert.match(doc.querySelector('.hit .lucy-source').textContent,/original-tool-17/);
  mount(()=>new Promise(r=>{resolve=r}));
  form=doc.querySelector('form');form.querySelector('input').value='mirror';
  const pending=form.onsubmit({preventDefault(){}});
  w.nseLockLucy();resolve(result);await pending;
  assert.equal(doc.querySelectorAll('.hit').length,0);
  assert.equal(form.querySelector('input').disabled,true);
  assert.match(doc.querySelector('.notice').textContent,/unavailable/);
  dom.window.close();
});
