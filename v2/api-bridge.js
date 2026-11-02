"use strict";
/* Authenticated bridge for Render-hosted QIB. No service keys in browser. */
(function(){
 const el=(tag,txt)=>{const x=document.createElement(tag);if(txt)x.textContent=txt;return x};
 const box=el("div");box.id="qib-login-wall";box.style.cssText="position:fixed;inset:0;z-index:999;background:#0c1117;color:#e9eff3;display:grid;place-items:center;padding:20px;font:15px system-ui";
 const form=el("form");form.style.cssText="width:min(100%,420px);background:#151e27;border:1px solid #374a55;border-radius:20px;padding:30px;display:grid;gap:15px";
 const title=el("h2","QIB System · Secure Sign In");const hint=el("p","Sign in with your assigned nursing account.");hint.style.color="#a6b9c5";
 const email=el("input"),pass=el("input"),submit=el("button","Sign in"),error=el("div");email.type="email";email.required=true;email.placeholder="Email";pass.type="password";pass.required=true;pass.placeholder="Password";
 [email,pass].forEach(x=>{x.style.cssText="border:1px solid #486270;background:#111e27;color:white;padding:14px;border-radius:9px;width:100%"});
 submit.type="submit";submit.style.cssText="background:#b9ead8;color:#122a25;border:0;border-radius:10px;padding:13px;font-weight:bold;cursor:pointer";error.style.color="#ffc2bd";error.setAttribute("role","alert");
 form.append(title,hint,email,pass,submit,error);box.append(form);document.body.append(box);
 let config,accessToken,centers=[];
 async function api(route,opts={}){if(!accessToken)throw Error("Sign in first");const r=await fetch(route,{...opts,headers:{Authorization:"Bearer "+accessToken,"Content-Type":"application/json",...(opts.headers||{})}});const data=await r.json();if(!r.ok)throw Error(data.error||"Request failed");return data}
 async function showCenters(){
  const data=await api("/api/my-centers");centers=data.centers||[];
  if(!centers.length){error.textContent="No assigned center. Ask the administrator to authorize your account.";return}
  const picker=document.getElementById("center");picker.replaceChildren(...centers.map(c=>{const o=el("option",c.name);o.value=c.id;return o}));
  const apply=async()=>{const id=picker.value;const d=await api("/api/bootstrap?centerId="+encodeURIComponent(id));
   document.getElementById("nurseCount").textContent="—";
   document.getElementById("pathCount").textContent=d.modules.length;
   const status=document.getElementById("qib-live-status");status.textContent="Connected · "+d.role+" · "+centers.find(c=>c.id===id)?.name;
   const assign=d.assignments.map(x=>x.specialty_id);
   const spec=document.getElementById("specialty");if(assign.length){Array.from(spec.options).forEach(o=>o.disabled=false)}
   window.QIBLive={api,centerId:()=>picker.value,userId:d.userId,role:d.role,bootstrap:d};
  };
  picker.addEventListener("change",()=>apply().catch(e=>{error.textContent=e.message}));
  const status=el("div","Connected");status.id="qib-live-status";status.style.cssText="position:fixed;bottom:10px;right:14px;z-index:900;background:#264239;color:#dffced;border:1px solid #4c7662;padding:9px 13px;border-radius:10px;font:12px system-ui";
  document.body.append(status);await apply();box.remove();
 }
 form.addEventListener("submit",async e=>{
  e.preventDefault();submit.disabled=true;error.textContent="";
  try{
   config=config||await fetch("/api/config").then(r=>r.json());
   const response=await fetch(config.supabaseUrl.replace(/\/$/,"")+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"Content-Type":"application/json",apikey:config.publishableKey},body:JSON.stringify({email:email.value,password:pass.value})});
   const auth=await response.json();if(!response.ok||!auth.access_token)throw Error("Invalid credentials or account not activated");
   accessToken=auth.access_token;pass.value="";await showCenters();
  }catch(err){error.textContent=err.message}finally{submit.disabled=false}
 });
})();
