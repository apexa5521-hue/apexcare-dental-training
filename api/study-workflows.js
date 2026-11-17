'use strict';
function makeSteps(text){const out=[];for(const part of String(text||'').split(/\n\s*\n/).filter(x=>x.trim())){let rest=part.trim();while(rest.length>1100){let cut=rest.lastIndexOf(' ',1000);if(cut<300)cut=1000;out.push(rest.slice(0,cut));rest=rest.slice(cut).trim()}if(rest)out.push(rest)}return out.length?out:['Learning content is awaiting preparation.']}
module.exports=async({req,url,body,c,userId,centerId,role,mustUUID,deny})=>{
 if(!['/api/study/lesson','/api/study/step'].includes(url.pathname))return {handled:false};
 const id=mustUUID(body.moduleId||url.searchParams.get('moduleId')),language=body.language||url.searchParams.get('language');if(!['ar','en','ur','id'].includes(language))throw Object.assign(Error('INVALID_LANGUAGE'),{status:400});
 const found=await c.query("select * from qib.modules where id=$1 and (center_id=$2 or center_id is null) and status='published'",[id,centerId]);if(!found.rowCount)deny();const m=found.rows[0];if(role.role==='nurse'&&m.specialty_id&&!(await c.query('select 1 from qib.assignments where user_id=$1 and center_id=$2 and specialty_id=$3',[userId,centerId,m.specialty_id])).rowCount)deny();
 const translation=m.translations?.[language];if(!translation?.body)throw Object.assign(Error('TRANSLATION_NOT_READY'),{status:409});const steps=makeSteps(translation.body);
 const saved=(await c.query('select * from qib.study_sessions where user_id=$1 and center_id=$2 and module_id=$3 and language=$4',[userId,centerId,id,language])).rows[0];
 if(req.method==='GET'&&url.pathname==='/api/study/lesson')return {handled:true,data:{id,title:translation.title,version:m.version,language,steps,step:saved?.version===m.version?Math.min(saved.step,steps.length-1):0}};
 if(req.method==='POST'&&url.pathname==='/api/study/step'){
  if(!Number.isInteger(body.step)||body.step<0||body.step>=steps.length||body.version!==m.version)throw Object.assign(Error('INVALID_STUDY_STEP'),{status:400});
  await c.query('insert into qib.study_sessions(user_id,center_id,module_id,language,version,step) values($1,$2,$3,$4,$5,$6) on conflict(user_id,center_id,module_id,language) do update set version=excluded.version,step=excluded.step,updated_at=now()',[userId,centerId,id,language,m.version,body.step]);return {handled:true,data:{saved:true}};
 }
 return {handled:false};
};
module.exports.makeSteps=makeSteps;
