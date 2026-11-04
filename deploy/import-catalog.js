"use strict";
const fs=require("node:fs"),crypto=require("node:crypto");
const SOURCES=["Specialties","Tools","Procedures","IPC_Modules","IPC_Steps","Quizzes","AssessmentBank","AssessmentConfig"];
const PRIVATE=["Users","AssessmentResults","NurseProgress","DrillProgress","Logs"];
const digest=x=>crypto.createHash("sha256").update(JSON.stringify(x)).digest("hex");
function normalizedRows(raw){
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Expected JSON object with named sheet arrays");
 const out=[],counts={},ids=new Map();
 for(const source of SOURCES){
  const rows=raw[source]||[];if(!Array.isArray(rows))throw Error(source+" must be an array");
  counts[source]=rows.length;const seen=new Set();
  for(let i=0;i<rows.length;i++){
   const row=rows[i];if(!row||typeof row!=="object"||Array.isArray(row))throw Error(source+" row "+i+" invalid");
   const id=String(row.id??"").trim();if(!id)throw Error(source+" row "+i+" is missing an id");
   if(seen.has(id))throw Error(source+" has duplicate id "+id);seen.add(id);
   const speciality=String(row.specialtyId??"").trim()||null;
   const payload=structuredClone(row);
   if(source==="Procedures"){
    for(const field of ["toolIds","consumableIds"]){
     if(typeof payload[field]==="string"){try{payload[field]=JSON.parse(payload[field])}catch{throw Error("Invalid "+field+" on procedure "+id)}}
     if(payload[field]!=null&&!Array.isArray(payload[field]))throw Error("Invalid "+field+" type on procedure "+id);
    }
   }
   out.push({source,id,specialtyId:speciality,payload,hash:digest(payload)});
  }
  ids.set(source,seen);
 }
 const toolIds=ids.get("Tools"),procedures=out.filter(r=>r.source==="Procedures");
 for(const p of procedures)for(const k of ["toolIds","consumableIds"])for(const id of p.payload[k]||[]){
  if(!toolIds.has(String(id)))throw Error("Procedure "+p.id+" references missing tool "+id);
 }
 for(const r of out.filter(x=>x.specialtyId&&["Tools","Procedures","AssessmentBank"].includes(x.source))){
  if(!ids.get("Specialties").has(r.specialtyId))throw Error(r.source+" "+r.id+" references missing specialty "+r.specialtyId);
 }
 return {records:out,counts,fingerprint:digest(out.map(x=>[x.source,x.id,x.hash]))};
}
async function importCatalog(client,raw,{dryRun=true}={}){
 const prepared=normalizedRows(raw);
 if(dryRun)return {...prepared,records:undefined,dryRun:true};
 await client.query("begin");
 try{
  for(const r of prepared.records.filter(x=>x.source==="Specialties")){
   const label=String(r.payload.nameEn||r.payload.nameAr||r.id);await client.query("insert into qib.specialties(code,label) values($1,$2) on conflict(code) do update set label=excluded.label",[r.id,label]);
  }
  for(const r of prepared.records){
   await client.query("insert into qib.legacy_catalog(source_name,legacy_id,specialty_legacy_id,payload,content_hash) values($1,$2,$3,$4,$5) on conflict(source_name,legacy_id) do update set specialty_legacy_id=excluded.specialty_legacy_id,payload=excluded.payload,content_hash=excluded.content_hash,imported_at=now()",[r.source,r.id,r.specialtyId,JSON.stringify(r.payload),r.hash]);
  }
  const actual=await client.query("select source_name,count(*)::int as n from qib.legacy_catalog where source_name=any($1) group by source_name",[SOURCES]);
  const importedCounts=Object.fromEntries(actual.rows.map(x=>[x.source_name,x.n]));
  for(const [key,count] of Object.entries(prepared.counts))if((importedCounts[key]||0)<count)throw Error("Imported count less than source count for "+key);
  await client.query("insert into qib.migration_runs(source_fingerprint,source_counts,imported_counts) values($1,$2,$3)",[prepared.fingerprint,JSON.stringify(prepared.counts),JSON.stringify(importedCounts)]);
  await client.query("commit");
  return {fingerprint:prepared.fingerprint,sourceCounts:prepared.counts,importedCounts,dryRun:false};
 }catch(e){await client.query("rollback");throw e}
}
if(require.main===module){
 const filepath=process.argv[2];if(!filepath){console.error("Usage: node import-catalog.js export.json [--commit]");process.exit(2)}
 const raw=JSON.parse(fs.readFileSync(filepath,"utf8"));
 const commit=process.argv.includes("--commit");
 if(!commit){const result=normalizedRows(raw);console.log(JSON.stringify({dryRun:true,counts:result.counts,fingerprint:result.fingerprint,excludedPrivateSheets:PRIVATE},null,2))}
 else{
  if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required");
  const {Pool}=require("pg");const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
  pool.connect().then(async client=>{try{console.log(JSON.stringify(await importCatalog(client,raw,{dryRun:false}),null,2))}finally{client.release();await pool.end()}}).catch(e=>{console.error(e.message);process.exitCode=1});
 }
}
module.exports={SOURCES,PRIVATE,normalizedRows,importCatalog};
