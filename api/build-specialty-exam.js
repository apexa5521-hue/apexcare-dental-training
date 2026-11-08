"use strict";
/** English-only candidate assessment questions from preserved, clinically curated source data.
 * Drafts must receive explicit clinical review before publication.
 * Never use preprinted consumable image text as a name-identification question.
 */
const crypto=require("node:crypto");
function parseArray(v){if(Array.isArray(v))return v;if(typeof v==="string"){try{const x=JSON.parse(v);return Array.isArray(x)?x:[]}catch{return []}}return []}
const clean=s=>String(s||"").replace(/\s+/g," ").trim();
function shuffled(xs){const out=xs.slice();for(let i=out.length-1;i>0;i--){const j=crypto.randomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
function makeQuestion(prompt,correct,wrong,category="instrument_name"){
 const unique=[clean(correct),...shuffled(wrong).map(clean)].filter(Boolean);
 const options=[...new Set(unique)];if(options.length<3)return null;
 const selected=shuffled(options.slice(1)).slice(0,3);
 const choices=shuffled([clean(correct),...selected]);
 return {prompt_en:prompt,options_en:choices,answer_index:choices.indexOf(clean(correct)),origin:"curated_catalog_draft",category,difficulty:"foundation"};
}
function buildSpecialtyQuestions({tools=[],procedures=[],bank=[],specialtyId,count=20}){
 const subset=tools.filter(x=>String(x.specialtyId)===String(specialtyId));
 const names=subset.map(x=>clean(x.nameEn)).filter(Boolean);
 const uniqueNames=[...new Set(names)];
 const candidates=[],seen=new Set();
 function add(q){if(q&&!seen.has(q.prompt_en)){seen.add(q.prompt_en);candidates.push(q)}}
 for(const q of bank){
  const prompt=clean(q.questionEn);
  const options=parseArray(q.optionsEn).map(clean);
  const answer=Number(q.answer);
  if(prompt&&options.length>=2&&options.length<=8&&options.every(Boolean)&&Number.isInteger(answer)&&answer>=0&&answer<options.length&&String(q.active).toLowerCase()!=="false"){
   add({prompt_en:prompt,options_en:options,answer_index:answer,origin:"existing_question_bank",category:"general",difficulty:"foundation"});
  }
 }
 for(const tool of subset){
  const name=clean(tool.nameEn),use=clean(tool.useEn);
  if(!name||!use)continue;
  const others=uniqueNames.filter(n=>n!==name);
  add(makeQuestion("Which instrument or supply is used for this purpose? "+use,name,others,"instrument_name"));
  const otherUses=subset.filter(t=>clean(t.nameEn)!==name).map(t=>clean(t.useEn)).filter(u=>u&&u!==use);
  add(makeQuestion("What is the documented purpose of "+name+"?",use,otherUses,"instrument_use"));
 }
 for(const p of procedures.filter(x=>String(x.specialtyId)===String(specialtyId))){
  const name=clean(p.nameEn);if(!name)continue;
  const required=new Set([...parseArray(p.toolIds),...parseArray(p.consumableIds)].map(String));
  const selected=subset.filter(t=>required.has(String(t.id))&&clean(t.nameEn));
  const wrong=uniqueNames.filter(n=>!selected.some(t=>clean(t.nameEn)===n));
  for(const item of selected.slice(0,1)){
   const q=makeQuestion("Which item is included in the documented preparation checklist for "+name+"?",item.nameEn,wrong,"procedure_preparation");
   if(q)add(q)
  }
 }
 const groups=new Map();for(const q of shuffled(candidates)){if(!groups.has(q.category))groups.set(q.category,[]);groups.get(q.category).push(q)}const selected=[];while(selected.length<count&&[...groups.values()].some(g=>g.length)){for(const g of groups.values())if(g.length&&selected.length<count)selected.push(g.pop())}
 return {questions:shuffled(selected),available:candidates.length,fromBank:candidates.filter(x=>x.origin==="existing_question_bank").length,draft:true};
}
module.exports={parseArray,buildSpecialtyQuestions};
