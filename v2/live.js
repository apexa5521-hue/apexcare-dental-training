"use strict";
(()=>{
 const $=id=>document.getElementById(id);
 const el=(tag,txt,cls)=>{const v=document.createElement(tag);if(txt!==undefined)v.textContent=txt;if(cls)v.className=cls;return v};
 const state={token:null,auth:null,centers:[],center:null,user:null,specialties:[],modules:[],assignments:[],completed:new Set(),certificates:[],exams:[],attempt:null,heartbeat:null,role:null,catalog:null,selectedProcedure:null};
 const nav=[["home","Overview"],["learning","Learning library"],["catalog","Clinical skills"],["ipc","Infection control"],["assessments","Clinical Assessments"],["achievements","My achievements"],["team","Nursing team"],["studio","Content studio"],["reports","Insights & reports"]];
 const titles={ar:["نظرة عامة","المكتبة التعليمية","المهارات السريرية","مكافحة العدوى","التقييمات السريرية","إنجازاتي","فريق التمريض","محرر المحتوى","التقارير"],ur:["جائزہ","تعلیمی لائبریری","کلینیکل مہارتیں","انفیکشن کنٹرول","طبی جائزے","میری کامیابیاں","نرسنگ ٹیم","مواد میں ترمیم","رپورٹس"],id:["Ringkasan","Pustaka pembelajaran","Keterampilan klinis","Pencegahan infeksi","Penilaian klinis","Pencapaian saya","Tim keperawatan","Editor konten","Laporan"]};
 const help={en:"Learn in your preferred language. Official exams and clinical practice are in English only.",ar:"تعلّمي بلغتك المفضلة. الاختبارات الرسمية والتدريبات السريرية باللغة الإنجليزية فقط.",ur:"اپنی پسندیدہ زبان میں سیکھیں۔ رسمی امتحانات اور طبی مشق صرف انگریزی میں ہیں۔",id:"Belajar dalam bahasa pilihan Anda. Ujian resmi dan latihan klinis hanya dalam bahasa Inggris."};
 const setText=(id,v)=>{$(id).textContent=String(v)};
 const err=(e)=>e?.message||"Request failed";
 const allowed=()=>state.role==="admin"?nav:state.role==="supervisor"?nav.filter(n=>n[0]!=="studio"):nav.filter(n=>!["team","studio","reports"].includes(n[0]));
 let sessionEnd=false;
 async function request(route,options={}){
  const r=await fetch(route,{...options,headers:{"Authorization":"Bearer "+state.token,"Content-Type":"application/json",...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"API_ERROR");return d;
 }
 const post=(route,body,opts={})=>request(route,{method:"POST",body:JSON.stringify({...body,centerId:state.center}),...opts});
 function displayPage(id){
  if(!allowed().some(n=>n[0]===id))return;
  document.querySelectorAll(".view").forEach(v=>v.hidden=v.dataset.page!==id);
  document.querySelectorAll("#nav button").forEach(v=>v.classList.toggle("selected",v.dataset.page===id));
  const index=nav.findIndex(n=>n[0]===id),l=$("language").value;setText("heading",titles[l]?.[index]||nav[index][1]);setText("breadcrumb","WORKSPACE / "+id.toUpperCase());
  if(id==="catalog")loadCatalog().catch(showError);
  if(id==="ipc")loadIPC().catch(showError);
  if(id==="assessments")loadExams().catch(showError);
  if(id==="team")loadTeam().catch(showError);
  if(id==="studio")loadStudio().catch(showError);
  if(id==="reports")loadReports().catch(showError);
 }
 function showError(e){const note=$("connection");note.textContent="Notice · "+err(e);note.style.color="#ffc4b9"}
 function updateLanguage(){
  const l=$("language").value;document.documentElement.lang=l;document.documentElement.dir=["ar","ur"].includes(l)?"rtl":"ltr";
  const items=allowed();$("nav").replaceChildren(...items.map(([id,label])=>{const index=nav.findIndex(n=>n[0]===id),b=el("button",titles[l]?.[index]||label);b.dataset.page=id;b.onclick=()=>displayPage(id);return b}));
  setText("learningHeading",titles[l]?.[1]||"Learning library");setText("learningHelp",help[l]);renderModules();const active=Array.from(document.querySelectorAll(".view")).find(v=>!v.hidden)?.dataset.page||"home";displayPage(active);
 }
 function fill(select,items){const prev=select.value;select.replaceChildren(...items.map(o=>{const op=el("option",o.name);op.value=o.id;return op}));if(items.some(o=>o.id===prev))select.value=prev}
 async function init(){
  const data=await request("/api/my-centers");state.centers=data.centers||[];
  if(!state.centers.length){
   const name=prompt("No assigned centers found. If you are the authorized platform owner, enter a new NSE center name. Otherwise select Cancel and contact your administrator.");
   if(!name)throw Error("No assigned center. Contact your administrator.");
   await request("/api/centers/create",{method:"POST",body:JSON.stringify({name:name.trim()})});
   state.centers=(await request("/api/my-centers")).centers||[];
   if(!state.centers.length)throw Error("Center setup could not be completed.");
  }
  fill($("center"),state.centers);state.center=$("center").value;await changeCenter();$("login").hidden=true;
 }
 async function changeCenter(){
  state.center=$("center").value;const data=await request("/api/bootstrap?centerId="+encodeURIComponent(state.center));
  state.catalog=null;state.selectedProcedure=null;state.user=data.userId;state.role=data.role;state.specialties=data.specialties||[];state.assignments=data.assignments||[];state.modules=data.modules||[];
  const [p,exams]=await Promise.all([request("/api/progress?centerId="+encodeURIComponent(state.center)),request("/api/exams?centerId="+encodeURIComponent(state.center))]);
  state.completed=new Set((p.completedModules||[]).map(x=>x.module_id));state.certificates=p.certificates||[];state.exams=exams.assessments||[];
  setText("connection",state.centers.find(c=>c.id===state.center)?.name+" · "+state.role);
  renderDashboard();renderModules();renderAchievements();fill($("assignSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("moduleSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("draftExamSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("inviteSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));updateLanguage();displayPage("home");
 }
 function renderDashboard(){
  const completed=state.modules.filter(m=>state.completed.has(m.id)).length,total=state.modules.length;
  setText("moduleCount",total);setText("completedCount",completed);setText("assessmentCount",state.exams.length);setText("certificateCount",state.certificates.filter(c=>!c.revoked_at).length);
  $("progressBar").style.width=(total?Math.round(completed/total*100):0)+"%";setText("progressText",completed+" / "+total+" modules completed");setText("nextStep",total===0?"Your center has not published learning modules yet.":completed===total?"Learning modules complete. Review your assessments and practical skills.":"Continue the next assigned module.");
 }
 function translation(m){const l=$("language").value,t=m.translations||{};return t[l]||t.en||{title:m.slug,body:""}}
 function renderModules(){
  const out=$("modules");out.replaceChildren();
  if(!state.modules.length){out.append(el("p","No published modules available yet.","muted"));return}
  state.modules.filter(m=>m.status===undefined||m.status==="published").forEach(m=>{
   const t=translation(m),card=el("article",undefined,"card");
   card.append(el("span",state.completed.has(m.id)?"✓ Completed":"Learning module","pill"),el("h3",t.title||m.slug),el("p",String(t.body||t.description||"").slice(0,170),"muted"));
   const b=el("button",state.completed.has(m.id)?"Review lesson":"Open lesson","btn sub");
   b.onclick=()=>openLesson(m);card.append(b);out.append(card)
  })
 }
 function openLesson(m){
  const t=translation(m),body=$("modalBody");body.replaceChildren(el("span","NSE LEARNING","over"),el("h2",t.title||m.slug));
  const p=el("p",t.body||t.description||"No detailed lesson has been entered yet.");p.style.whiteSpace="pre-wrap";body.append(p);
  const note=el("p",help[$("language").value],"subtle"),btn=el("button",state.completed.has(m.id)?"Completed":"Mark lesson complete","btn");btn.disabled=state.completed.has(m.id);
  btn.onclick=async()=>{try{await post("/api/modules/complete",{moduleId:m.id});state.completed.add(m.id);btn.disabled=true;btn.textContent="Completed";renderDashboard();renderModules()}catch(e){showError(e)}};
  body.append(note,btn);$("modal").showModal()
 }
 async function renderAchievements(){
  const c=$("certificates"),o=$("observations");c.replaceChildren();o.replaceChildren();
  if(!state.certificates.length)c.append(el("p","Verified Knowledge and Competency Cards will appear after center approval.","muted"));
  state.certificates.forEach(x=>{const card=el("div",undefined,"card");card.append(el("span",x.kind==="knowledge"?"Knowledge Card":"Competency Card","pill"),el("h3",state.specialties.find(s=>s.id===x.specialty_id)?.label||"Clinical Competence"),el("p","Issued "+new Date(x.issued_at).toLocaleDateString(),"small"));if(x.revoked_at)card.append(el("p","Revoked","error"));c.append(card)});
  o.append(el("h2","Observed competencies"));
  try{
   const data=await request("/api/achievements?centerId="+encodeURIComponent(state.center));
   const finished=state.completed.size,passed=(data.assessments||[]).filter(x=>x.score>=75).length,practical=(data.observations||[]).filter(x=>x.status==="competent").length,issued=state.certificates.filter(x=>!x.revoked_at).length;
   const achievements=[
     ["Learning Explorer",finished>0,finished+" modules completed"],
     ["Clinical Knowledge",passed>0,passed+" English assessments passed"],
     ["Observed Competent",practical>0,practical+" clinical observations approved"],
     ["Achievement Card",issued>0,issued+" verified cards issued"]
   ];
   const achieved=achievements.filter(x=>x[1]).length;
   $("journeyBar").style.width=Math.round(achieved/achievements.length*100)+"%";
   setText("journeyScore",achieved+" / "+achievements.length+" milestones achieved");
   setText("journeyMessage",achieved===achievements.length?"Your verified learning journey is progressing strongly.":achieved===0?"Your development starts with the first module. Small steps build clinical confidence.":"Great progress. Continue your next learning or assessment milestone.");
   const milestones=$("achievementMilestones");milestones.replaceChildren();
   achievements.forEach(([name,done,detail])=>{const card=el("div",undefined,"card");card.append(el("span",done?"Achieved":"In progress",done?"pill":"small"),el("h3",name),el("p",detail,"muted"));milestones.append(card)});
   o.append(...(data.observations||[]).map(x=>{const row=el("div",undefined,"row");row.append(el("span","Skill observation"),el("span",x.status,"pill"));return row}));
   if(!data.observations?.length)o.append(el("p","No completed observations recorded yet.","muted"));
  }catch(e){showError(e)}

 }
 function translated(r){
  const l=$("language").value,cap=l[0].toUpperCase()+l.slice(1);
  return {name:r["name"+cap]||r.nameEn||r.nameAr||r.title||"Unnamed",use:r["use"+cap]||r.useEn||r.useAr||""};
 }
 async function loadCatalog(){
   if(!state.catalog){const data=await request("/api/catalog?centerId="+encodeURIComponent(state.center));state.catalog=data.catalog;}
   const cat=state.catalog,select=$("catalogSpecialty");
   setText("catalogSpecialties",cat.specialties.length);setText("catalogTools",cat.tools.length);setText("catalogProcedures",cat.procedures.length);
   const previous=select.value;
   select.replaceChildren(...cat.specialties.map(x=>{const o=el("option",translated(x).name);o.value=x.id;return o}));
   if(cat.specialties.some(x=>x.id===previous))select.value=previous;
   renderCatalog();
 }
 async function loadIPC(){
   if(!state.catalog){const x=await request("/api/catalog?centerId="+encodeURIComponent(state.center));state.catalog=x.catalog}
   const data=state.catalog,root=$("ipcModules");root.replaceChildren();
   for(const m of data.ipcModules){
    const card=el("div",undefined,"card"),t=translated(m);card.append(el("span","IPC Learning","pill"),el("h3",t.name));
    const btn=el("button","Study steps","btn sub");
    btn.onclick=()=>{
     const panel=$("ipcDetail");panel.hidden=false;panel.replaceChildren(el("h2",t.name));
     const steps=data.ipcSteps.filter(s=>String(s.moduleId)===String(m.id));
     if(!steps.length)panel.append(el("p","Learning steps have not been imported yet.","muted"));
     steps.forEach((step,i)=>{
      const lang=$("language").value,cap=lang[0].toUpperCase()+lang.slice(1);
      const row=el("div",undefined,"row");row.append(el("span",String(i+1).padStart(2,"0"),"pill"),el("span",String(step["text"+cap]||step.textEn||step.textAr||"")));
      panel.append(row)
     });
     panel.scrollIntoView({behavior:"smooth",block:"start"});
    };
    card.append(btn);root.append(card);
   }
   if(!data.ipcModules.length)root.append(el("p","No infection control modules imported yet.","muted"));
 }
 function renderCatalog(){
   if(!state.catalog)return;const cat=state.catalog,sp=$("catalogSpecialty").value,search=$("catalogSearch").value.toLowerCase().trim();
   const procs=cat.procedures.filter(x=>x.specialtyId===sp);
   const tools=cat.tools.filter(x=>x.specialtyId===sp);
   const list=$("catalogProceduresList");list.replaceChildren();
   procs.filter(p=>translated(p).name.toLowerCase().includes(search)).forEach(p=>{
      const b=el("button",translated(p).name,"btn sub");b.style.textAlign="start";b.onclick=()=>{state.selectedProcedure=p;renderProcedure()};list.append(b);
   });
   if(!list.childElementCount)list.append(el("p","No procedures found.","small"));
   const toolList=$("catalogToolList");toolList.replaceChildren();
   tools.filter(t=>translated(t).name.toLowerCase().includes(search)).forEach(t=>{
      const card=el("div",undefined,"skill-row");
      if(t.imageUrl&&/^https:\/\//i.test(t.imageUrl)){const img=el("img");img.src=t.imageUrl;img.loading="lazy";img.alt=translated(t).name;card.append(img)}
      const block=el("div");block.append(el("strong",translated(t).name),el("small",translated(t).use));card.append(block);toolList.append(card)
   });
   if(!toolList.childElementCount)toolList.append(el("p","No tools found.","small"));
   if(!state.selectedProcedure||state.selectedProcedure.specialtyId!==sp)state.selectedProcedure=procs[0]||null;
   renderProcedure();
 }
 function asIds(v){if(Array.isArray(v))return v.map(String);if(typeof v==="string"){try{const x=JSON.parse(v);return Array.isArray(x)?x.map(String):[]}catch{return []}}return []}
 function renderProcedure(){
  const p=state.selectedProcedure,root=$("procedureChecklist");root.replaceChildren();
  if(!p){setText("procedureHeading","Procedure preparation");setText("procedureDetail","Choose a procedure.");return}
  setText("procedureHeading",translated(p).name);
  const tools=state.catalog.tools,tid=asIds(p.toolIds),cid=asIds(p.consumableIds),all=[...new Set([...tid,...cid])];
  setText("procedureDetail",all.length+" curated items · Practice checklist only; not an official exam result.");
  const checked=new Set();
  const progress=el("p","0 / "+all.length+" checked","good");
  root.append(progress);
  all.forEach(id=>{
    const item=tools.find(t=>String(t.id)===id);if(!item)return;
    const label=el("label",undefined,"skill-row"),cb=el("input");cb.type="checkbox";cb.className="skill-checkbox";
    cb.onchange=()=>{if(cb.checked)checked.add(id);else checked.delete(id);progress.textContent=checked.size+" / "+all.length+" checked"+(all.length&&checked.size===all.length?" · Great work!":"")};
    const text=el("div");text.append(el("strong",translated(item).name),el("small",(cid.includes(id)?"Consumable · ":"Instrument · ")+translated(item).use));
    label.append(cb,text);root.append(label);
  });
  if(!all.length)root.append(el("p","No curated tools assigned to this procedure yet.","muted"));
 }
 $("catalogSpecialty").onchange=()=>{state.selectedProcedure=null;renderCatalog()};
 $("catalogSearch").oninput=renderCatalog;
 async function loadExams(){
  const data=await request("/api/exams?centerId="+encodeURIComponent(state.center));state.exams=data.assessments||[];
  $("exams").replaceChildren(...state.exams.map(a=>{const b=el("button",a.title+" · "+a.minutes+" min","btn sub");b.style.margin="5px";b.onclick=()=>beginExam(a);return b}));
  if(!state.exams.length)$("exams").append(el("p","No currently assigned exams.","muted"));
 }
 function lockExam(reason){
  if(!state.attempt)return;clearInterval(state.heartbeat);
  const id=state.attempt;state.attempt=null;
  $("examPanel").replaceChildren(el("p","Assessment Paused. Your session requires supervisor review.","warning"));
  setText("examMessage","Your attempt remains recorded. Do not start a new attempt without review.");
  if(reason)post("/api/exams/event",{attemptId:id,eventKey:crypto.randomUUID(),kind:reason},{keepalive:true}).catch(()=>{});
 }
 async function beginExam(a){
  try{
   const data=await post("/api/exams/start",{assessmentId:a.id});setText("examMessage","");
   if(data.status!=="active"){$("examPanel").replaceChildren(el("p","Assessment "+data.status.replace("_"," ")+" — contact your supervisor.","warning"));return}
   state.attempt=data.attemptId;const root=$("examPanel");root.replaceChildren();
   for(const [i,q] of data.questions.entries()){
    const div=el("div",undefined,"question"),group=el("fieldset"),legend=el("legend",(i+1)+". "+q.prompt_en);group.append(legend);
    for(const [index,opt] of q.options_en.entries()){
     const label=el("label",undefined,"option"),radio=el("input");radio.type="radio";radio.name="q-"+q.id;radio.checked=data.answers?.[q.id]===index;
     radio.onchange=async()=>{try{await post("/api/exams/answer",{attemptId:data.attemptId,questionId:q.id,choice:index});setText("examMessage","Answer saved")}catch(e){showError(e);lockExam("connection_interrupted")}};
     label.append(radio,document.createTextNode(" "+opt));group.append(label)
    }div.append(group);root.append(div)
   }
   const submit=el("button","Submit assessment","btn");submit.onclick=async()=>{try{const response=await post("/api/exams/submit",{attemptId:data.attemptId});state.attempt=null;clearInterval(state.heartbeat);root.replaceChildren(el("p","Assessment completed. Recorded score: "+response.score+"%","notice"));setText("examMessage","Submission verified by server.");await changeCenter()}catch(e){showError(e)}};
   root.append(submit);
   state.heartbeat=setInterval(async()=>{if(!state.attempt)return;try{const r=await post("/api/exams/heartbeat",{attemptId:data.attemptId});if(r.status!=="active")lockExam("connection_interrupted")}catch{lockExam("connection_interrupted")}},10000);
  }catch(e){showError(e)}
 }
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&state.attempt)lockExam("visibility_hidden")});
 window.addEventListener("pagehide",()=>{if(state.attempt)lockExam("pagehide")});
 async function loadTeam(){
  $("inviteArea").hidden=state.role!=="admin";$("assignmentForm").hidden=state.role!=="admin";
  const data=await request("/api/learners?centerId="+encodeURIComponent(state.center)),list=$("teamList");
  list.replaceChildren(...data.learners.map(x=>{const row=el("div",undefined,"row");row.append(el("span",x.display_name),el("span",x.role,"pill"));return row}));
  const users=new Map(data.learners.map(x=>[x.user_id,x.display_name]));fill($("assignUser"),[...users].map(([id,name])=>({id,name})));
 }
 async function loadStudio(){
  await loadDraftExams();
  const data=await request("/api/modules?centerId="+encodeURIComponent(state.center)),root=$("manageModules");root.replaceChildren(el("h3","Drafts and published modules"));
  data.modules.forEach(m=>{const row=el("div",undefined,"row");row.append(el("span",m.translations?.en?.title||m.slug),el("span",m.status,"pill"));if(m.status!=="published"){const b=el("button","Publish after review","btn sub");b.onclick=async()=>{if(!confirm("Confirm clinical review is complete?"))return;try{await post("/api/modules/publish",{moduleId:m.id});await loadStudio();await changeCenter()}catch(e){showError(e)}};row.append(b)}root.append(row)})
 }
 async function loadReports(){
  const data=await request("/api/reports?centerId="+encodeURIComponent(state.center)),root=$("reportCards");root.replaceChildren();
  [["Nursing staff",data.learners],["Submitted assessments",data.assessments.total],["Average score",data.assessments.average??"—"]].forEach(([label,value])=>{const card=el("div",undefined,"card");card.append(el("span",label,"over"),el("div",value,"metric"));root.append(card)});
  $("reviewQueue").replaceChildren(el("p","Clinical assessment review requires an authorized supervisor and a documented reason.","muted"))
 }
 $("inviteForm").onsubmit=async e=>{e.preventDefault();try{const result=await post("/api/team/invite",{email:$("inviteEmail").value,displayName:$("inviteName").value,role:$("inviteRole").value,specialtyId:$("inviteSpecialty").value});$("inviteForm").reset();await loadTeam();alert("Invitation sent to "+result.userId)}catch(ex){showError(ex)}};
 async function loadDraftExams(){
  const root=$("draftExamList");root.replaceChildren();
  const data=await request("/api/exams/drafts?centerId="+encodeURIComponent(state.center));
  data.assessments.forEach(x=>{
   const row=el("div",undefined,"row"),copy=el("div");copy.append(el("strong",x.title),el("p",x.specialty+" · "+x.question_count+" questions · "+x.status,"small"));row.append(copy);
   if(x.status==="draft"){
    const b=el("button","Approve & publish","btn sub");b.onclick=async()=>{
     const note=prompt("Enter the clinical review note (reviewer, content checked, version and approval):");
     if(!note)return;try{await post("/api/exams/publish",{assessmentId:x.id,reviewerNote:note});await loadDraftExams();await loadExams()}catch(e){showError(e)}
    };row.append(b)
   }root.append(row);
  });
  if(!data.assessments.length)root.append(el("p","No specialty exams drafted yet.","muted"));
 }
 $("draftExamForm").onsubmit=async e=>{e.preventDefault();try{
   const x=await post("/api/exams/draft-from-specialty",{specialtyId:$("draftExamSpecialty").value,title:$("draftExamTitle").value,questionCount:Number($("draftExamCount").value),minutes:Number($("draftExamMinutes").value)});
   await loadDraftExams();alert(x.questions+" English questions prepared as draft. Clinical review is required before publishing.");
  }catch(ex){showError(ex)}};
 $("assignmentForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/assign",{userId:$("assignUser").value,specialtyId:$("assignSpecialty").value});await loadTeam();alert("Specialty assigned")}catch(ex){showError(ex)}};
 $("moduleForm").onsubmit=async e=>{e.preventDefault();const tr={};for(const lang of ["en","ar","ur","id"]){const title=$("title"+lang[0].toUpperCase()+lang.slice(1)).value,body=$("body"+lang[0].toUpperCase()+lang.slice(1)).value;if(title||body)tr[lang]={title,body}};
 try{await post("/api/modules/save",{specialtyId:$("moduleSpecialty").value,slug:$("moduleSlug").value,translations:tr});await loadStudio();alert("Draft saved for review")}catch(ex){showError(ex)}};
 $("loginForm").onsubmit=async e=>{e.preventDefault();setText("loginError","");try{state.auth=state.auth||await fetch("/api/config").then(r=>r.json());const r=await fetch(state.auth.supabaseUrl.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:state.auth.publishableKey},body:JSON.stringify({email:$("email").value,password:$("password").value})});const data=await r.json();if(!r.ok||!data.access_token)throw Error("Invalid account or password");state.token=data.access_token;$("password").value="";await init()}catch(ex){setText("loginError",err(ex))}};
 $("center").onchange=()=>{if(state.attempt){showError(Error("Complete or review active assessment before switching centers."));return}changeCenter().catch(showError)};
 $("language").onchange=updateLanguage;$("closeModal").onclick=()=>$("modal").close();$("logout").onclick=()=>{if(state.attempt)lockExam("pagehide");state.token=null;location.reload()};
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>displayPage(b.dataset.go));
})();
