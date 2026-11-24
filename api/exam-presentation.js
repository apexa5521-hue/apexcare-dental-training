"use strict";
const {randomInt}=require('node:crypto');
function shuffle(items){const out=items.slice();for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
// Persist once per attempt. Avoid repeating the previous order when alternatives exist.
function prepareAttemptQuestions(questions,previous=[]){
 const ordered=shuffle(questions);
 if(ordered.length>1&&ordered.every((q,i)=>q.id===previous[i]?.id))ordered.push(ordered.shift());
 return ordered.map(q=>{const options=shuffle(q.options_en.map((text,index)=>({text,index}))),old=previous.find(p=>p.id===q.id);
 if(options.length>1&&options.every((o,i)=>o.text===old?.options_en[i]))options.push(options.shift());
 return {...q,options_en:options.map(x=>x.text),answer_index:options.findIndex(x=>x.index===q.answer_index)};
 });
}
module.exports={prepareAttemptQuestions};
