"use strict";
/** Center isolation and nursing assignments: pure domain logic, no production DB connection. */
const ROLES=new Set(["nurse","supervisor","admin","platform_admin"]);
const perms={nurse:new Set(["learn.read","assessment.own","competency.own"]),supervisor:new Set(["learn.read","team.read","competency.review","assessment.review","reports.read"]),admin:new Set(["learn.read","team.read","team.write","content.write","reports.read","competency.review","assessment.review"]),platform_admin:new Set(["*"])};
class Denied extends Error{constructor(code){super(code);this.code=code;}}
function requireAccess(actor,{centerId,permission,userId}){
 if(!actor||!actor.id||!ROLES.has(actor.role)||actor.authenticated!==true)throw new Denied("AUTH_REQUIRED");
 if(!centerId)throw new Denied("CENTER_REQUIRED");
 if(!perms[actor.role].has(permission)&&!perms[actor.role].has("*"))throw new Denied("PERMISSION_DENIED");
 if(actor.role!=="platform_admin"&&!actor.centerIds?.includes(centerId))throw new Denied("CENTER_FORBIDDEN");
 if(["assessment.own","competency.own"].includes(permission)&&userId!==actor.id)throw new Denied("USER_FORBIDDEN");
 return true;
}
function assignNurse(actor,assignment,allowedSpecialties){
 requireAccess(actor,{centerId:assignment.centerId,permission:"team.write"});
 if(!assignment.userId||!assignment.specialtyId||!allowedSpecialties.includes(assignment.specialtyId))throw new Denied("INVALID_ASSIGNMENT");
 return {userId:assignment.userId,centerId:assignment.centerId,specialtyId:assignment.specialtyId,active:true};
}
function redactEmployee(record,actor){
 requireAccess(actor,{centerId:record.centerId,permission:"team.read"});
 const {userId,displayName,centerId,specialtyIds}=record;
 return {userId,displayName,centerId,specialtyIds};
}
module.exports={requireAccess,assignNurse,redactEmployee,Denied};
