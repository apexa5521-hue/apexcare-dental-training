'use strict';
module.exports=async({req,url,c,userId,centerId})=>{
 if(req.method!=='GET'||url.pathname!=='/api/passport-path')return {handled:false};
 const assigned=await c.query('select s.id,s.label from qib.assignments a join qib.specialties s on s.id=a.specialty_id where a.user_id=$1 and a.center_id=$2',[userId,centerId]);const paths=[];
 for(const s of assigned.rows){const modules=(await c.query("select m.id,exists(select 1 from qib.module_progress p where p.module_id=m.id and p.user_id=$1 and p.center_id=$2) as completed from qib.modules m where m.specialty_id=$3 and m.status='published' and (m.center_id=$2 or m.center_id is null)",[userId,centerId,s.id])).rows;
 const passed=(await c.query("select 1 from qib.attempts a join qib.assessments x on x.id=a.assessment_id where a.user_id=$1 and a.center_id=$2 and x.specialty_id=$3 and a.status='submitted' and a.score>=75 limit 1",[userId,centerId,s.id])).rowCount>0;
 const skills=(await c.query('select s.id,(select o.status from qib.skill_observations o where o.skill_id=s.id and o.center_id=$2 and o.user_id=$1 order by observed_at desc,id desc limit 1) as status from qib.skill_definitions s where s.specialty_id=$3',[userId,centerId,s.id])).rows;
 const cards=(await c.query('select kind from qib.certificates where user_id=$1 and center_id=$2 and specialty_id=$3 and revoked_at is null and (expires_at is null or expires_at>now())',[userId,centerId,s.id])).rows;
 paths.push({specialtyId:s.id,title:s.label,lessons:modules.length,completedLessons:modules.filter(m=>m.completed).length,learningComplete:modules.length>0&&modules.every(m=>m.completed),assessmentPassed:passed,requiredSkills:skills.length,competentSkills:skills.filter(s=>s.status==='competent').length,practicalComplete:skills.length>0&&skills.every(s=>s.status==='competent'),knowledgeIssued:cards.some(x=>x.kind==='knowledge'),competencyIssued:cards.some(x=>x.kind==='competency')});
 }return {handled:true,data:{paths,supervisorApprovalRequired:true}};
};
