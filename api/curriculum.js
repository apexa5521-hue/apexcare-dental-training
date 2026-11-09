"use strict";
const fs=require('node:fs'),path=require('node:path');
function validate(pack){
 if(pack.status!=='draft'||pack.assessmentLanguage!=='en'||!Array.isArray(pack.modules)||!pack.modules.length)throw Error('INVALID_CURRICULUM_PACK');
 const seen=new Set();for(const m of pack.modules){if(!/^nse-[a-z0-9-]{3,75}$/.test(m.slug)||seen.has(m.slug))throw Error('INVALID_LESSON_SLUG');seen.add(m.slug);
 for(const l of ['ar','en','ur','id'])if(!m.translations?.[l]?.title?.trim()||!m.translations?.[l]?.body?.trim())throw Error('INCOMPLETE_TRANSLATION');
 if(!m.sourceUrls?.length||m.sourceUrls.some(u=>!/^https:\/\/(www\.)?(cdc\.gov|who\.int)\//.test(u)))throw Error('CLINICAL_SOURCE_REQUIRED');
 if(m.review?.clinical!=='pending'||m.review?.translation!=='pending')throw Error('DRAFT_REVIEW_REQUIRED');
 for(const q of m.questionDrafts||[])if(q.status!=='draft'||typeof q.prompt_en!=='string'||!Array.isArray(q.options_en)||q.options_en.length<2||!Number.isInteger(q.answer_index)||q.answer_index<0||q.answer_index>=q.options_en.length)throw Error('INVALID_ENGLISH_QUESTION');
 }return pack;
}
const PACKS={foundations:'nse-foundations.json',dental:'nse-dental.json'};
const load=(name='foundations')=>{if(!PACKS[name])throw Object.assign(Error('UNKNOWN_CURRICULUM_PACK'),{status:400});return validate(JSON.parse(fs.readFileSync(path.join(__dirname,'../content',PACKS[name]),'utf8')))};
async function prepare(c,{centerId,userId,pack:packName='foundations'}){
 const pack=load(packName);await c.query('select id from qib.centers where id=$1 for update',[centerId]);let created=0,existing=0;
 let specialtyId=null;if(pack.specialtyCode){const s=(await c.query('select id from qib.specialties where code=$1',[pack.specialtyCode])).rows[0];if(!s)throw Object.assign(Error('SPECIALTY_NOT_FOUND'),{status:409});specialtyId=s.id}
 for(const m of pack.modules){const translations=Object.fromEntries(['ar','en','ur','id'].map(l=>[l,{title:m.translations[l].title,body:m.translations[l].body+'\n\nSources:\n'+m.sourceUrls.join('\n')} ]));
 const r=await c.query("insert into qib.modules(center_id,specialty_id,slug,translations,status) values($1,$2,$3,$4,'draft') on conflict(center_id,slug) do nothing returning id,version",[centerId,specialtyId,m.slug,JSON.stringify(translations)]);
 if(r.rowCount){created++;await c.query('insert into qib.content_revisions(module_id,editor_id,version,snapshot) values($1,$2,$3,$4)',[r.rows[0].id,userId,r.rows[0].version,JSON.stringify({action:packName+'_draft_prepared',sourceUrls:m.sourceUrls,review:m.review,packVersion:pack.version})])}else existing++;
 }
 const title=pack.assessmentTitle||'NSE Foundation Knowledge Review — Draft';let exam=(await c.query('select id from qib.assessments where center_id=$1 and title=$2',[centerId,title])).rows[0];let questionsCreated=0;
 if(!exam){exam=(await c.query("insert into qib.assessments(center_id,specialty_id,title,status,minutes) values($1,$2,$3,'draft',15) returning id",[centerId,specialtyId,title])).rows[0];
 for(const m of pack.modules)for(const q of m.questionDrafts||[]){await c.query('insert into qib.questions(assessment_id,prompt_en,options_en,answer_index,difficulty,rationale_en,provenance) values($1,$2,$3,$4,$5,$6,$7)',[exam.id,q.prompt_en,JSON.stringify(q.options_en),q.answer_index,q.difficulty||'foundation',q.rationale_en||null,JSON.stringify({origin:packName+'_pack',lesson:m.slug,sourceUrls:m.sourceUrls})]);questionsCreated++}}
 return {pack:packName,created,existing,questionDraftsCreated:questionsCreated,assessmentId:exam.id,status:'draft',clinicalReviewRequired:true,translationReviewRequired:true};
}
module.exports={validate,load,prepare};
