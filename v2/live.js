"use strict";
(()=>{
 const $=id=>document.getElementById(id);
 const el=(tag,txt,cls)=>{const v=document.createElement(tag);if(txt!==undefined)v.textContent=txt;if(cls)v.className=cls;return v};
 const state={token:null,auth:null,centers:[],center:null,user:null,specialties:[],modules:[],assignments:[],completed:new Set(),certificates:[],exams:[],attempt:null,heartbeat:null,role:null,catalog:null,selectedProcedure:null};
 const workspace=document.querySelector(".layout");workspace.inert=true;
 const nav=[["home","Overview"],["learning","Learning library"],["catalog","Clinical skills"],["clinic","Interactive clinic"],["ipc","Infection control"],["assessments","Clinical Assessments"],["achievements","My achievements"],["team","Nursing team"],["studio","Content studio"],["reports","Insights & reports"]];
 const titles={ar:["نظرة عامة","المكتبة التعليمية","المهارات السريرية","العيادة التفاعلية","مكافحة العدوى","التقييمات السريرية","إنجازاتي","فريق التمريض","محرر المحتوى","التقارير"],ur:["جائزہ","تعلیمی لائبریری","کلینیکل مہارتیں","انٹرایکٹو کلینک","انفیکشن کنٹرول","طبی جائزے","میری کامیابیاں","نرسنگ ٹیم","مواد میں ترمیم","رپورٹس"],id:["Ringkasan","Pustaka pembelajaran","Keterampilan klinis","Klinik interaktif","Pencegahan infeksi","Penilaian klinis","Pencapaian saya","Tim keperawatan","Editor konten","Laporan"]};
 const help={en:"Learn in your preferred language. Official exams and clinical practice are in English only.",ar:"تعلّمي بلغتك المفضلة. الاختبارات الرسمية والتدريبات السريرية باللغة الإنجليزية فقط.",ur:"اپنی پسندیدہ زبان میں سیکھیں۔ رسمی امتحانات اور طبی مشق صرف انگریزی میں ہیں۔",id:"Belajar dalam bahasa pilihan Anda. Ujian resmi dan latihan klinis hanya dalam bahasa Inggris."};
 const setText=(id,v)=>{$(id).textContent=String(v)};
 const err=(e)=>e?.message||"Request failed";
 const allowed=()=>state.role==="admin"?nav:state.role==="supervisor"?nav.filter(n=>n[0]!=="studio"):nav.filter(n=>!["team","studio","reports"].includes(n[0]));
 let sessionEnd=false;
 function updateThemeLabel(){const dark=document.documentElement.dataset.theme==='dark';$("themeToggle").textContent=dark?'Light mode':'Dark mode';$("themeToggle").setAttribute('aria-pressed',String(dark));}
 $("themeToggle").onclick=()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('nse-theme',document.documentElement.dataset.theme)}catch{}updateThemeLabel()};updateThemeLabel();
 async function request(route,options={}){
  const r=await fetch(route,{...options,headers:{"Authorization":"Bearer "+state.token,"Content-Type":"application/json",...(options.headers||{})}});
  const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"API_ERROR");return d;
 }
 const post=(route,body,opts={})=>request(route,{method:"POST",body:JSON.stringify({...body,centerId:state.center}),...opts});
 const contentStudio=window.initContentStudio({request,post,el,context:()=>state});
 const clinicPractice=window.initClinicPractice({request,post,context:()=>state,language:()=>$("language").value,el});
 let activePage="home",pageTrail=[];
 function renderPageNavigation(){
  const ar=$("language").value==="ar";let bar=$("pageNavigation");if(!bar){bar=el("nav",undefined,"page-navigation");bar.id="pageNavigation";bar.setAttribute("aria-label","Page navigation");document.querySelector(".top").after(bar)}bar.replaceChildren();
  const back=el("button",ar?"→ رجوع":"← Back","btn sub");back.disabled=!pageTrail.length;back.onclick=()=>{const previous=pageTrail.at(-1);if(previous)displayPage(previous,true)};
  const home=el("button",ar?"المسار التعليمي":"Learning path","btn sub");home.onclick=()=>displayPage("home");const current=el("span",titles[$("language").value]?.[nav.findIndex(n=>n[0]===activePage)]||nav.find(n=>n[0]===activePage)?.[1],"small");bar.append(back,home,el("span","/","small"),current)
 }
 const development=window.initDevelopment({request,post,context:()=>({center:state.center,role:state.role,user:state.user,specialties:state.specialties})});delete window.initDevelopment;
 function displayPage(id,fromBack=false){
  if(!allowed().some(n=>n[0]===id))return;
  if(state.attempt&&id!=="assessments"){
   if(!confirm($("language").value==="ar"?"مغادرة الاختبار ستوقف جلستك للمراجعة. هل تريدين المغادرة؟":"Leaving this assessment will pause your session for supervisor review. Leave assessment?"))return;
   lockExam("visibility_hidden");
  }
  if(id!==activePage){if(fromBack)pageTrail.pop();else pageTrail.push(activePage);activePage=id}renderPageNavigation();
  document.querySelectorAll(".view").forEach(v=>v.hidden=v.dataset.page!==id);
  document.querySelectorAll("#nav button").forEach(v=>v.classList.toggle("selected",v.dataset.page===id));
  const index=nav.findIndex(n=>n[0]===id),l=$("language").value;setText("heading",titles[l]?.[index]||nav[index][1]);setText("breadcrumb","WORKSPACE / "+id.toUpperCase());
  if(id==="clinic")clinicPractice.load();
  if(id==="catalog")loadCatalog().catch(showError);
  if(id==="ipc")loadIPC().catch(showError);
  if(id==="assessments")loadExams().catch(showError);
  if(id==="team"){loadTeam().catch(showError);development.manage()}
  if(id==="home")development.refresh();
  if(id==="studio")loadStudio().catch(showError);
  if(id==="reports")loadReports().catch(showError);
 }
 function showError(e){const note=$("connection");note.textContent="Notice · "+err(e);note.style.color="#ffc4b9"}
 function updateLanguage(){
  const l=$("language").value;document.documentElement.lang=l;document.documentElement.dir=["ar","ur"].includes(l)?"rtl":"ltr";
  const items=allowed();$("nav").replaceChildren(...items.map(([id,label])=>{const index=nav.findIndex(n=>n[0]===id),b=el("button",titles[l]?.[index]||label);b.dataset.page=id;b.onclick=()=>displayPage(id);return b}));
  renderJourney();setText("learningHeading",titles[l]?.[1]||"Learning library");setText("learningHelp",help[l]);renderModules();const active=Array.from(document.querySelectorAll(".view")).find(v=>!v.hidden)?.dataset.page||"home";displayPage(active);
 }
 function fill(select,items){const prev=select.value;select.replaceChildren(...items.map(o=>{const op=el("option",o.name);op.value=o.id;return op}));if(items.some(o=>o.id===prev))select.value=prev}
 async function init(){
  const data=await request("/api/my-centers");state.centers=data.centers||[];
  if(!state.centers.length){
   if(!data.platformOwner)throw Error("Your account is awaiting center assignment. Contact your administrator.");
   const name=prompt("No assigned centers found. If you are the authorized platform owner, enter a new NSE center name. Otherwise select Cancel and contact your administrator.");
   if(!name)throw Error("No assigned center. Contact your administrator.");
   await request("/api/centers/create",{method:"POST",body:JSON.stringify({name:name.trim()})});
   state.centers=(await request("/api/my-centers")).centers||[];
   if(!state.centers.length)throw Error("Center setup could not be completed.");
  }
  fill($("center"),state.centers);state.center=$("center").value;await changeCenter();$("login").hidden=true;workspace.inert=false;
 }
 async function changeCenter(){
  clinicPractice.reset();
  state.center=$("center").value;const data=await request("/api/bootstrap?centerId="+encodeURIComponent(state.center));
  state.catalog=null;state.selectedProcedure=null;state.user=data.userId;state.displayName=data.displayName;state.role=data.role;state.specialties=data.specialties||[];state.assignments=data.assignments||[];state.modules=data.modules||[];
  const [p,exams]=await Promise.all([request("/api/progress?centerId="+encodeURIComponent(state.center)),request("/api/exams?centerId="+encodeURIComponent(state.center))]);
  state.completed=new Set((p.completedModules||[]).map(x=>x.module_id));state.certificates=p.certificates||[];state.exams=exams.assessments||[];
  setText("connection",state.centers.find(c=>c.id===state.center)?.name+" · "+state.role);
  renderDashboard();renderModules();renderAchievements();if(window.nseMountSearch)window.nseMountSearch({host:document.querySelector('section.view[data-page="home"]'),request,el,center:()=>state.center,language:()=>$("language").value,openLesson:id=>{const m=state.modules.find(x=>x.id===id);if(m)openLesson(m)}});if(window.nseMountTray)window.nseMountTray({host:document.querySelector('section.view[data-page="home"]'),request,post,el,center:()=>state.center,language:()=>$("language").value});fill($("assignSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("moduleSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("draftExamSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));fill($("inviteSpecialty"),state.specialties.map(x=>({id:x.id,name:x.label})));updateLanguage();displayPage("home");
 }
 function renderJourney(){
  const root=$("learningJourney"),ar=$("language").value==="ar";root.replaceChildren();const grid=el("div",undefined,"journey-grid"),path=el("article",undefined,"card"),aside=el("article",undefined,"card journey-aside");
  path.append(el("span",ar?"خطوتك القادمة":"YOUR NEXT CHAPTER","over"),el("h2",ar?"رحلتك نحو الإتقان":"Your path to clinical confidence"));const list=el("div",undefined,"path-list");
  const pending=state.modules.find(m=>!state.completed.has(m.id));const task=el("article",undefined,"daily-task section"),taskText=el("div"),taskIcon=el("span",undefined,"task-orbit");taskIcon.innerHTML=window.nseIcon(1);taskText.append(el("span",ar?"خطوتك اليوم":"YOUR STEP TODAY","over"),el("h2",pending?(translation(pending).title||pending.slug):(ar?"استكشفي أدوات تخصصك":"Explore your clinical instruments")),el("p",pending?(ar?"تابعي درسًا منشورًا ضمن تكليفاتك.":"Continue a published lesson assigned to you."):(ar?"تدريب تعريفي؛ لا يمنح كفاءة أو نتيجة اختبار.":"Familiarization practice; no competency or assessment result awarded."),"muted"));const start=el("button",ar?"ابدئي الآن":"Start now","btn");start.onclick=()=>pending?openLesson(pending):displayPage("catalog");task.append(taskIcon,taskText,start);root.append(task);
  const stages=[[ar?"تعلّمي الأساسيات":"Build your knowledge",state.modules.length?state.completed.size+" / "+state.modules.length+(ar?" دروس مكتملة":" lessons completed"):(ar?"الدروس بانتظار النشر":"Lessons awaiting publication"),"learning"],[ar?"تدرّبي على الأدوات والإجراءات":"Explore tools & procedures",ar?"تدريب تحضيري دون اعتماد كفاءة":"Preparation practice · no competency awarded","catalog"],["English Clinical Assessment",state.exams.length+" available assessments","assessments"],[ar?"التقييم العملي والإنجازات":"Supervised practice & achievements",ar?"الكفاءة تتطلب ملاحظة المشرفة":"Competency requires supervisor observation","achievements"]];
  stages.forEach(([name,detail,page],i)=>{const row=el("div",undefined,"path-stop"+(i===0?" current":"")),b=el("button",String(i+1),"path-node");b.setAttribute("aria-label",name);b.onclick=()=>displayPage(page);const text=el("div");text.append(el("strong",name),el("small",detail));row.append(b,text);list.append(row)});path.append(list);
  const img=el("img");img.src="/journey-art.svg";img.alt=ar?"رحلة المعرفة والتدريب والكفاءة":"Knowledge, practice and verified growth";aside.append(img,el("h2",ar?"كل خطوة تصنع فرقًا":"Small steps. Real growth."),el("p",ar?"تقدّمك يعكس التعلّم والتقييم الموثّق. لا يمنح الاختبار النظري وحده كفاءة سريرية.":"Your progress reflects documented learning and assessment. Clinical competency also requires supervised practical evaluation.","muted"));grid.append(path,aside);root.append(grid);
 }
 function renderDashboard(){renderJourney();
  const completed=state.modules.filter(m=>state.completed.has(m.id)).length,total=state.modules.length;
  setText("moduleCount",total);setText("completedCount",completed);setText("assessmentCount",state.exams.length);setText("certificateCount",state.certificates.filter(c=>!c.revoked_at).length);
  $("progressBar").style.width=(total?Math.round(completed/total*100):0)+"%";setText("progressText",completed+" / "+total+" modules completed");setText("nextStep",total===0?"Your center has not published learning modules yet.":completed===total?"Learning modules complete. Review your assessments and practical skills.":"Continue the next assigned module.");
 }
 function translation(m){const l=$("language").value,t=m.translations||{};return t[l]||t.en||{title:m.slug,body:""}}
 function renderModules(){
  const out=$("modules"),ar=$("language").value==="ar";out.replaceChildren();out.className="learning-route";setText("learningHeading",ar?"رحلتك التعليمية":"Your learning journey");
  if(!state.modules.length){out.append(el("p",ar?"تجهّز الإدارة خطوات رحلتك الآن. يمكنك استكشاف أدوات تخصصك حتى تُنشر الدروس.":"Your learning steps are being prepared. Explore your specialty tools while lessons await publication.","notice"));return}
  const completed=state.modules.filter(m=>state.completed.has(m.id)).length;const header=el("div",undefined,"route-summary");header.append(el("strong",Math.round(completed/state.modules.length*100)+"%"),el("span",completed+" / "+state.modules.length+(ar?" دروس مكتملة":" lessons complete")));out.append(header);
  const pending=state.modules.find(m=>!state.completed.has(m.id));if(pending){const start=el("button",(ar?"تابعي رحلتك: ":"Continue your journey: ")+(translation(pending).title||pending.slug),"btn continue-journey");start.onclick=()=>openLesson(pending);out.append(start)}
  state.modules.forEach((m,i)=>{const done=state.completed.has(m.id),current=m===pending,row=el("article",undefined,"learning-stop "+(done?"completed":current?"current":"upcoming")),node=el("span",done?"✓":String(i+1),"learning-node"),copy=el("div");copy.append(el("span",done?(ar?"مكتمل":"Completed"):current?(ar?"خطوتك القادمة":"Your next step"):(ar?"في مسارك":"On your path"),"pill"),el("h3",translation(m).title||m.slug));const b=el("button",done?(ar?"مراجعة":"Review"):(ar?"ابدئي الخطوة":"Start step"),current?"btn":"btn sub");b.onclick=()=>openLesson(m);row.append(node,copy,b);out.append(row)});
  const goal=el("div",undefined,"notice section");goal.append(el("strong",ar?"هدف الرحلة: بطاقة معرفة ثم كفاءة عملية":"Journey goal: knowledge, then practical competence"),el("p",ar?"الدروس ← اختبار المعرفة ← بطاقة المعرفة. ثم تقييم عملي موثّق ← بطاقة الكفاءة.":"Lessons → knowledge assessment → knowledge card. Then documented practical assessment → competency card."));const view=el("button",ar?"شاهدي طريق البطاقات":"See card requirements","btn sub");view.onclick=()=>displayPage("achievements");goal.append(view);out.append(goal);
 }

 function openLesson(m){return window.openNseStudy({module:m,language:$("language").value,center:state.center,request,post,el,isComplete:()=>state.completed.has(m.id),onLibrary:()=>displayPage("learning"),onComplete:async()=>{await post("/api/modules/complete",{moduleId:m.id});state.completed.add(m.id);renderDashboard();renderModules()}})}

 async function renderAchievements(){
  const c=$("certificates"),o=$("observations");c.replaceChildren();o.replaceChildren();
  const routeRoot=el("section");c.append(routeRoot);try{const path=await request("/api/passport-path?centerId="+encodeURIComponent(state.center));window.renderPassportPath({root:routeRoot,paths:path.paths,el,ar:$("language").value==="ar",navigate:displayPage})}catch(e){routeRoot.append(el("p",e.message,"error"))}
  if(!state.certificates.length)c.append(el("p","Verified Knowledge and Competency Cards will appear after center approval.","muted"));
  state.certificates.forEach(x=>{const card=el("article",undefined,"card real-passport");const header=el("div",undefined,"passport-heading");header.append(el("strong","NSE"),el("span",x.kind==="competency"?"COMPETENCY PASSPORT":"KNOWLEDGE CARD","small"));card.append(header,el("h2",state.displayName||"Your learning record"));card.append(el("span",x.kind==="knowledge"?"Knowledge Card":"Competency Card","pill"),el("h3",state.specialties.find(s=>s.id===x.specialty_id)?.label||"Clinical Competence"),el("p","Issued "+new Date(x.issued_at).toLocaleDateString(),"small"));const verify=el("a","Verify card ↗","preview-link");verify.href="/verify?id="+encodeURIComponent(x.id);verify.target="_blank";verify.rel="noopener";const evidence=el("div",undefined,"stack section");evidence.append(el("p","Completed modules: "+(x.evidence?.completedModules??"Not recorded"),"small"),el("p","Assessment verified: "+(x.evidence?.passedAssessment?"Yes":"Not recorded"),"small"),el("p",x.kind==="competency"?"Practical approval: "+(x.evidence?.practicalApproved?"Recorded":"Not recorded"):"Knowledge only — does not certify practical competence","small"),el("p","Reference: "+x.id,"subtle"));card.append(evidence,verify);if(x.expires_at)card.append(el("p","Expires "+new Date(x.expires_at).toLocaleDateString(),"small"));if(x.revoked_at)card.append(el("p","Revoked","error"));c.append(card)});
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
  try{
   const archive=await request("/api/legacy-history?centerId="+encodeURIComponent(state.center)),root=$("previousHistory");
   root.replaceChildren(el("h2","Previous learning history"));
   if(!archive.linked)root.append(el("p","Historic learning records have not been linked to your account yet.","muted"));
   else{
    root.append(el("p",archive.assessments.length+" archived assessments · "+archive.training.length+" past training records","small"));
    archive.assessments.slice(0,12).forEach(x=>{const row=el("div",undefined,"row");row.append(el("span",String(x.type||"Assessment")+" · "+String(x.date||"Previous result")),el("strong",x.score==null?"—":x.score+"%"));root.append(row)});
   }
  }catch(e){showError(e)}
 }
 function translated(r){
  const l=$("language").value,cap=l[0].toUpperCase()+l.slice(1);
  return {name:r["name"+cap]||r.nameEn||r.nameAr||r.title||"Unnamed",use:r["use"+cap]||r.useEn||r.useAr||""};
 }
 async function loadCatalog(){
   if(!state.catalog){const data=await request("/api/catalog?centerId="+encodeURIComponent(state.center));state.catalog=data.catalog;state.catalog.integrityIssues=data.integrityIssues||[];}
   const cat=state.catalog,select=$("catalogSpecialty");
   setText("catalogSpecialties",cat.specialties.length);setText("catalogTools",cat.tools.length);setText("catalogProcedures",cat.procedures.length);
   const previous=select.value;
   select.replaceChildren(...cat.specialties.map(x=>{const o=el("option",translated(x).name);o.value=x.id;return o}));
   if(cat.specialties.some(x=>x.id===previous))select.value=previous;
   renderCatalog();
 }
 async function loadIPC(){
   if(!state.catalog){const x=await request("/api/catalog?centerId="+encodeURIComponent(state.center));state.catalog=x.catalog;state.catalog.integrityIssues=x.integrityIssues||[]}
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
      if(t.imageUrl&&/^https:\/\//i.test(t.imageUrl)){const img=el("img");img.src=t.imageUrl;img.loading="lazy";img.alt=translated(t).name;const zoom=el("button",undefined,"tool-image-button");zoom.type="button";zoom.setAttribute("aria-label","View image: "+translated(t).name);zoom.append(img);zoom.onclick=()=>{const body=$("modalBody");body.replaceChildren(el("h2",translated(t).name));const large=el("img");large.src=t.imageUrl;large.alt=translated(t).name;large.className="tool-zoom";body.append(large,el("p",translated(t).use,"muted"));$("modal").showModal()};card.append(zoom)}
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
    const item=tools.find(t=>String(t.id)===id);if(!item){root.append(el('p','Source item '+id+' is missing. This procedure needs clinical review before use.','warning'));return;}
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
   root.className="exam-focus";root.dir="ltr";const examProgress=el("progress"),examPercent=el("p",undefined,"exam-progress-label");examProgress.max=data.questions.length;examProgress.value=0;root.append(examProgress,examPercent);const timer=el("p",undefined,"notice"),position=el("p",undefined,"small"),questionHost=el("div"),nav=el("div",undefined,"row"),jump=el("div",undefined,"row");
   const previous=el("button","Previous","btn sub"),next=el("button","Next","btn sub"),flag=el("button","Flag for review","btn sub");
   let cursor=0,pendingSaves=0;const flags=new Set(data.questions.map((q,i)=>data.flags?.[q.id]?i:null).filter(i=>i!==null)),panels=[],jumpButtons=[];
   const clocks={...data.questionClocks};let serverOffset=Date.parse(data.serverNow)-Date.now();
   async function openQuestion(){const q=data.questions[cursor];try{const r=await post("/api/exams/open-question",{attemptId:data.attemptId,questionId:q.id});serverOffset=Date.parse(r.serverNow)-Date.now();if(r.deadlineAt)clocks[q.id]=r.deadlineAt;tick()}catch(e){showError(e);lockExam("connection_interrupted")}}
   function tick(){if(state.attempt!==data.attemptId)return;const now=Date.now()+serverOffset,seconds=Math.max(0,Math.ceil((Date.parse(data.deadlineAt)-now)/1000));let text="Exam time: "+Math.floor(seconds/60)+":"+String(seconds%60).padStart(2,"0");if(data.timingMode==="per_question"){const deadline=clocks[data.questions[cursor].id],left=deadline?Math.max(0,Math.ceil((Date.parse(deadline)-now)/1000)):null;text+=" · Question: "+(left===null?"Loading…":left+"s")+" · Timer continues when leaving this question";panels[cursor]?.querySelectorAll("input").forEach(input=>input.disabled=left===null||left===0)}timer.textContent=text;if(!seconds)lockExam("connection_interrupted")}
   function draw(){const answered=data.questions.filter(q=>data.answers?.[q.id]!==undefined).length;examProgress.value=answered;examPercent.textContent=Math.round(answered/data.questions.length*100)+"% answered · "+answered+" / "+data.questions.length+" · Progress, not your score";panels.forEach((p,i)=>p.hidden=i!==cursor);position.textContent="Question "+(cursor+1)+" of "+panels.length;previous.disabled=cursor===0;next.disabled=cursor===panels.length-1;flag.textContent=flags.has(cursor)?"Remove flag":"Flag for review";jumpButtons.forEach((b,i)=>{b.textContent=(i+1)+(flags.has(i)?" ⚑":"")+(data.answers?.[data.questions[i].id]!==undefined?" ✓":"");b.dataset.answered=String(data.answers?.[data.questions[i].id]!==undefined);b.dataset.flagged=String(flags.has(i));b.setAttribute("aria-current",i===cursor?"step":"false")})}
   previous.onclick=()=>{cursor--;draw();openQuestion()};next.onclick=()=>{cursor++;draw();openQuestion()};flag.onclick=async()=>{const i=cursor;flag.disabled=true;try{const r=await post("/api/exams/flag",{attemptId:data.attemptId,questionId:data.questions[i].id,flagged:!flags.has(i)});if(r.flags[data.questions[i].id])flags.add(i);else flags.delete(i);draw()}catch(e){showError(e)}finally{flag.disabled=false}};nav.append(previous,flag,next);root.append(timer,position,questionHost,nav,jump);
   const countdown=setInterval(()=>{if(state.attempt!==data.attemptId){clearInterval(countdown);return}tick()},1000);
   for(const [i,q] of data.questions.entries()){
    const div=el("div",undefined,"question"),group=el("fieldset"),legend=el("legend",(i+1)+". "+q.prompt_en);group.append(legend);
    for(const [index,opt] of q.options_en.entries()){
     const label=el("label",undefined,"option"),radio=el("input");radio.type="radio";radio.name="q-"+q.id;radio.checked=data.answers?.[q.id]===index;
     radio.onchange=async()=>{pendingSaves++;try{await post("/api/exams/answer",{attemptId:data.attemptId,questionId:q.id,choice:index});data.answers={...data.answers,[q.id]:index};draw();setText("examMessage","Answer saved")}catch(e){showError(e);if(e.message.includes("QUESTION_TIME_EXPIRED")){radio.checked=data.answers?.[q.id]===index;tick()}else lockExam("connection_interrupted")}finally{pendingSaves--}};
     label.append(radio,document.createTextNode(" "+opt));group.append(label)
    }if(q.media_asset_id){const media=el("div");div.append(media);window.nseRenderAsset({id:q.media_asset_id,host:media,request,center:state.center,attemptId:data.attemptId}).catch(()=>media.append(el("p","Question image could not load. Contact your supervisor.","warning")))}div.append(group);panels.push(div);questionHost.append(div);const go=el("button",String(i+1),"btn sub");go.onclick=()=>{cursor=i;draw();openQuestion()};jumpButtons.push(go);jump.append(go)
   }
   const submit=el("button","Submit assessment","btn");submit.onclick=async()=>{try{const response=await post("/api/exams/submit",{attemptId:data.attemptId});state.attempt=null;clearInterval(state.heartbeat);root.replaceChildren(el("p","Assessment completed. Recorded score: "+response.score+"%","notice"));setText("examMessage","Submission verified by server.");await changeCenter()}catch(e){showError(e)}};
   submit.onclick=(original=>async()=>{if(pendingSaves){alert("Please wait for your answer to finish saving.");return}const unanswered=data.questions.filter(q=>data.answers?.[q.id]===undefined).length;if(!confirm("Submit assessment? "+unanswered+" unanswered; "+flags.size+" flagged for review."))return;await original()})(submit.onclick);
   root.append(submit);draw();openQuestion();tick();
   state.heartbeat=setInterval(async()=>{if(!state.attempt)return;try{const r=await post("/api/exams/heartbeat",{attemptId:data.attemptId});if(r.status!=="active")lockExam("connection_interrupted")}catch{lockExam("connection_interrupted")}},10000);
  }catch(e){showError(e)}
 }
 document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&state.attempt)lockExam("visibility_hidden")});
 window.addEventListener("pagehide",()=>{if(state.attempt)lockExam("pagehide")});
 async function loadTeam(){
  $("inviteArea").hidden=state.role!=="admin";$("legacyLinkArea").hidden=state.role!=="admin";$("assignmentForm").hidden=state.role!=="admin";
  const data=await request("/api/learners?centerId="+encodeURIComponent(state.center)),list=$("teamList");
  list.replaceChildren(...data.learners.map(x=>{const row=el("div",undefined,"row");row.append(el("span",x.display_name),el("span",x.role,"pill"));return row}));
  const users=new Map(data.learners.map(x=>[x.user_id,x.display_name]));fill($("assignUser"),[...users].map(([id,name])=>({id,name})));fill($("legacyTarget"),[...users].map(([id,name])=>({id,name})));if(state.role==="admin"){const historic=await request("/api/legacy-history/unlinked?centerId="+encodeURIComponent(state.center));fill($("legacyUsername"),historic.unlinked.map(name=>({id:name,name})))}
 }
 async function loadStudio(){
  await contentStudio.mount();
  await loadDraftExams();
  const data=await request("/api/modules?centerId="+encodeURIComponent(state.center)),root=$("manageModules");root.replaceChildren(el("h3","Drafts and published modules"));
  const importButton=el("button","Prepare imported IPC drafts","btn sub");importButton.onclick=async()=>{importButton.disabled=true;try{const result=await post("/api/modules/import-ipc",{});alert(result.created+" draft modules prepared. Translation and clinical review required.");await loadStudio()}catch(e){showError(e)}finally{importButton.disabled=false}};root.append(importButton);const dentalPack=el("button","Prepare 6 multilingual dental chairside drafts","btn sub");dentalPack.onclick=async()=>{dentalPack.disabled=true;try{const r=await post("/api/modules/prepare-foundations",{pack:"dental"});alert(r.created+" dental lesson drafts and "+r.questionDraftsCreated+" English question drafts prepared. Clinical and translation review required.");await loadStudio()}catch(e){showError(e)}finally{dentalPack.disabled=false}};t.append(dentalPack);const foundations=el("button","Prepare 6 multilingual foundation drafts","btn sub");foundations.onclick=async()=>{foundations.disabled=true;try{const r=await post("/api/modules/prepare-foundations",{});alert(r.created+" lesson drafts and "+r.questionDraftsCreated+" English question drafts prepared. Clinical and translation review required.");await loadStudio()}catch(e){showError(e)}finally{foundations.disabled=false}};root.append(foundations);
  data.modules.forEach(m=>{const row=el("div",undefined,"row"),copy=el("div");copy.append(el("strong",m.translations?.en?.title||m.slug),el("p","Version "+m.version+" · "+m.status,"small"));row.append(copy);const edit=el("button",m.status==="published"?"Edit a new draft version":"Edit translations","btn sub");edit.onclick=async()=>{let editSlug=m.slug;if(m.status==="published"){try{editSlug=(await post("/api/authoring/fork",{moduleId:m.id})).module.slug}catch(e){showError(e);return}}setText("heading","Content studio");$("moduleSlug").value=editSlug;if(m.specialty_id)$("moduleSpecialty").value=m.specialty_id;for(const [l,cap] of [["en","En"],["ar","Ar"],["ur","Ur"],["id","Id"]]){$("title"+cap).value=m.translations?.[l]?.title||"";$("body"+cap).value=m.translations?.[l]?.body||""}$("moduleForm").scrollIntoView({behavior:"smooth",block:"start"})};row.append(edit);const review=el("button","Open & review content","btn sub");review.onclick=()=>{const panel=$("modalBody");panel.replaceChildren(el("h2",m.translations?.en?.title||m.slug));for(const lang of ["en","ar","ur","id"]){const block=el("article",undefined,"card section");block.append(el("h3",lang.toUpperCase()+" · "+(m.translations?.[lang]?.title||"Title missing")),el("p",m.translations?.[lang]?.body||"Translation missing","muted"));panel.append(block)}if(m.status==="draft"){const send=el("button","Send for clinical review","btn");send.onclick=async()=>{try{await post("/api/modules/request-review",{moduleId:m.id});$("modal").close();await loadStudio()}catch(e){showError(e)}};panel.append(send)}if(m.status==="review"){const note=el("textarea");note.className="input";note.placeholder="Document clinical and translation review rationale";const approve=el("button","Approve reviewed content & publish","btn");approve.onclick=async()=>{try{await post("/api/modules/publish",{moduleId:m.id,reviewerNote:note.value});$("modal").close();await loadStudio();await changeCenter()}catch(e){showError(e)}};panel.append(note,approve)}$("modal").showModal()};row.append(review);root.append(row)})
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
   const schedule=el("button","Schedule assessment","btn sub");schedule.onclick=()=>{const panel=$("modalBody");panel.replaceChildren(el("h2",x.title),el("p","Dates use your device timezone. Scheduling locks after the first attempt.","muted"));const start=el("input"),end=el("input");start.type=end.type="datetime-local";start.className=end.className="input";const local=iso=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)};if(x.starts_at)start.value=local(x.starts_at);if(x.ends_at)end.value=local(x.ends_at);const reason=el("textarea");reason.className="input";reason.placeholder="Reason for this schedule";const save=el("button","Save schedule","btn");save.onclick=async()=>{try{await post("/api/exams/schedule",{assessmentId:x.id,startsAt:start.value?new Date(start.value).toISOString():null,endsAt:end.value?new Date(end.value).toISOString():null,reason:reason.value});$("modal").close();await loadDraftExams()}catch(e){showError(e)}};const a=el("label",undefined,"field");a.append(el("span","Starts"),start);const b=el("label",undefined,"field");b.append(el("span","Ends"),end);panel.append(a,b,reason,save);$("modal").showModal()};row.append(schedule);
   const timing=el("button","Exam timing","btn sub");timing.onclick=()=>{const panel=$("modalBody");panel.replaceChildren(el("h2",x.title),el("p","Settings lock after the first attempt. In per-question mode, a question timer starts when opened and continues while you navigate away. Expired answers become read-only.","muted"));const mode=el("select"),minutes=el("input"),seconds=el("input");[["total","Whole exam"],["per_question","Per question + overall limit"]].forEach(([value,text])=>{const o=el("option",text);o.value=value;mode.append(o)});mode.value=x.timing_mode||"total";minutes.type=seconds.type="number";minutes.min="1";minutes.max="240";minutes.value=x.minutes;seconds.min="10";seconds.max="3600";seconds.value=x.seconds_per_question||60;[["Timing mode",mode],["Overall limit (minutes)",minutes],["Each question (seconds)",seconds]].forEach(([text,input])=>{const label=el("label",undefined,"field");label.append(el("span",text),input);panel.append(label)});const save=el("button","Save timing","btn");save.onclick=async()=>{try{await post("/api/exams/timing",{assessmentId:x.id,timingMode:mode.value,minutes:Number(minutes.value),secondsPerQuestion:Number(seconds.value)});$("modal").close();await loadDraftExams()}catch(e){showError(e)}};panel.append(save);$("modal").showModal()};row.append(timing);
   if(x.status==="draft"){
    const b=el("button","Review questions","btn sub");b.onclick=async()=>{
     try{
      const data=await request("/api/exams/draft-questions?centerId="+encodeURIComponent(state.center)+"&assessmentId="+encodeURIComponent(x.id));
      const panel=$("modalBody");panel.replaceChildren(el("h2",x.title),el("p","Review every question and its correct answer before publishing.","muted"));
      data.questions.forEach((q,i)=>{
       const item=el("div",undefined,"question");item.append(el("span",(q.category||"general")+" · "+(q.difficulty||"foundation"),"pill"),el("strong",(i+1)+". "+q.prompt_en));if(q.rationale_en)item.append(el("p",q.rationale_en,"muted"));
       q.options_en.forEach((opt,j)=>item.append(el("p",(j===q.answer_index?"✓ ":"")+" "+opt,j===q.answer_index?"good":"muted")));
       panel.append(item);
      });
      const note=el("textarea");note.placeholder="Clinical review: reviewer name, items checked and approval rationale";note.className="input";note.style.cssText="width:100%;min-height:100px";
      const publish=el("button","Approve & publish","btn");publish.onclick=async()=>{
       if(note.value.trim().length<12){alert("A clinical review rationale is required.");return}
       try{await post("/api/exams/publish",{assessmentId:x.id,reviewerNote:note.value});$("modal").close();await loadDraftExams();await loadExams()}catch(e){showError(e)}
      };
      panel.append(note,publish);$("modal").showModal();
     }catch(e){showError(e)}
    };row.append(b)
   }root.append(row);
  });
  if(!data.assessments.length)root.append(el("p","No specialty exams drafted yet.","muted"));
 }
 $("draftExamForm").onsubmit=async e=>{e.preventDefault();try{
   const x=await post("/api/exams/draft-from-specialty",{specialtyId:$("draftExamSpecialty").value,title:$("draftExamTitle").value,questionCount:Number($("draftExamCount").value),minutes:Number($("draftExamMinutes").value)});
   await loadDraftExams();alert(x.questions+" English questions prepared as draft. Clinical review is required before publishing.");
  }catch(ex){showError(ex)}};
 $("legacyLinkForm").onsubmit=async e=>{e.preventDefault();try{
   if(!$("legacyVerified").checked)throw Error("Verify employee identity first.");
   await post("/api/legacy-history/link",{userId:$("legacyTarget").value,legacyUsername:$("legacyUsername").value,confirmIdentity:true});
   $("legacyVerified").checked=false;await loadTeam();alert("Previous training records securely linked.");
  }catch(ex){showError(ex)}};
 $("assignmentForm").onsubmit=async e=>{e.preventDefault();try{await post("/api/assign",{userId:$("assignUser").value,specialtyId:$("assignSpecialty").value});await loadTeam();alert("Specialty assigned")}catch(ex){showError(ex)}};
 $("moduleForm").onsubmit=async e=>{e.preventDefault();const tr={};for(const lang of ["en","ar","ur","id"]){const title=$("title"+lang[0].toUpperCase()+lang.slice(1)).value,body=$("body"+lang[0].toUpperCase()+lang.slice(1)).value;if(title||body)tr[lang]={title,body}};
 try{await post("/api/modules/save",{specialtyId:$("moduleSpecialty").value,slug:$("moduleSlug").value,translations:tr});await loadStudio();alert("Draft saved for review")}catch(ex){showError(ex)}};
 let clientReady,workspaceOpening;
 let passwordSetupRequired=['invite','recovery'].includes(new URLSearchParams(location.hash.slice(1)).get('type'));
 function openWorkspace(){
  if(workspaceOpening)return workspaceOpening;
  workspaceOpening=init().catch(e=>{setText("loginError",err(e));$("login").hidden=false}).finally(()=>{workspaceOpening=null});
  return workspaceOpening;
 }
 function showPasswordSetup(){
  $("login").hidden=false;$("loginForm").hidden=true;$("passwordSetupForm").hidden=false;
 }
 async function authClient(){
  if(clientReady)return clientReady;
  clientReady=(async()=>{
   const response=await fetch('/api/config');if(!response.ok)throw Error('Sign-in service unavailable');
   state.auth=await response.json();
   state.client=supabase.createClient(state.auth.supabaseUrl,state.auth.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
   state.client.auth.onAuthStateChange((event,session)=>{
    state.token=session?.access_token||null;
    if(!session){clearInterval(state.heartbeat);state.attempt=null;state.center=null;state.user=null;workspace.inert=true;$("login").hidden=false;return}
    if(event==='PASSWORD_RECOVERY')passwordSetupRequired=true;
    if(passwordSetupRequired){showPasswordSetup();return}
    if((event==='INITIAL_SESSION'||event==='SIGNED_IN')&&!state.center)setTimeout(()=>openWorkspace(),0);
   });
   return state.client;
  })();
  return clientReady;
 }
 $("loginForm").onsubmit=async e=>{
  e.preventDefault();setText("loginError","");const button=$("loginForm").querySelector('button[type="submit"]');button.disabled=true;
  try{const client=await authClient();const {data,error}=await client.auth.signInWithPassword({email:$("email").value.trim(),password:$("password").value});$("password").value='';if(error||!data.session)throw Error('Invalid account or password');state.token=data.session.access_token;await openWorkspace()}
  catch(e){setText('loginError',err(e))}finally{button.disabled=false}
 };
 $("passwordSetupForm").onsubmit=async e=>{
  e.preventDefault();setText('passwordSetupError','');const button=$("passwordSetupForm").querySelector('button[type="submit"]');
  if($("newPassword").value!==$("confirmPassword").value){setText('passwordSetupError','The passwords do not match.');return}
  button.disabled=true;
  try{const client=await authClient();const {error}=await client.auth.updateUser({password:$("newPassword").value});if(error)throw Error('Password could not be updated. Check the account requirements.');$("newPassword").value='';$("confirmPassword").value='';passwordSetupRequired=false;$("passwordSetupForm").hidden=true;$("loginForm").hidden=false;await openWorkspace()}
  catch(e){setText('passwordSetupError',err(e))}finally{button.disabled=false}
 };
 authClient().catch(e=>setText('loginError',err(e)));
 $("center").onchange=()=>{if(state.attempt){$("center").value=state.center;showError(Error("Complete or review active assessment before switching centers."));return}changeCenter().catch(showError)};
 $("language").onchange=updateLanguage;$("closeModal").onclick=()=>$("modal").close();$("logout").onclick=async()=>{if(state.attempt)lockExam("pagehide");try{const client=await authClient();await client.auth.signOut({scope:"local"})}catch{}state.token=null;location.reload()};
 document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>displayPage(b.dataset.go));
})();
