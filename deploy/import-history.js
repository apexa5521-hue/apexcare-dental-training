"use strict";
const fs=require("node:fs"),crypto=require("node:crypto");
const TYPES=["Users","AssessmentResults","NurseProgress","DrillProgress","Logs","Mastery"];
const hash=v=>crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
function prepareHistory(json){
 if(!json||typeof json!=="object")throw Error("Invalid export");
 const rows=[],counts={};for(const name of TYPES){
  const list=json[name]||[];if(!Array.isArray(list))throw Error("Invalid "+name);
  counts[name]=list.length;
  for(let i=0;i<list.length;i++){
   const x=structuredClone(list[i]);
   if(!x||typeof x!=="object"||Array.isArray(x))throw Error(name+" invalid row "+i);
   const key=String(x.id||x.username||x.ts||x.createdAt||i).trim()+"#"+i;
   if(name==="Users"){delete x.password;delete x.token;delete x.passwordHash;delete x.password_hash;}
   rows.push({name,key,payload:x,hash:hash(x)});
  }
 }return {rows,counts,fingerprint:hash(rows.map(x=>[x.name,x.key,x.hash]))};
}
async function archiveHistory(client,raw){
 const exportData=prepareHistory(raw);await client.query("begin");
 try{
  for(const x of exportData.rows){
   await client.query("insert into qib.legacy_history_archive(source_name,legacy_key,payload,content_hash) values($1,$2,$3,$4) on conflict(source_name,legacy_key) do update set payload=excluded.payload,content_hash=excluded.content_hash,imported_at=now()",[x.name,x.key,JSON.stringify(x.payload),x.hash]);
  }
  await client.query("commit");return {counts:exportData.counts,fingerprint:exportData.fingerprint,archived:true,linkedToAuth:false};
 }catch(e){await client.query("rollback");throw e}
}
if(require.main===module){
 const filepath=process.argv[2];if(!filepath)throw Error("Usage: node import-history.js nse-export.json [--commit]");
 const raw=JSON.parse(fs.readFileSync(filepath,"utf8"));const result=prepareHistory(raw);
 if(!process.argv.includes("--commit"))console.log(JSON.stringify({dryRun:true,counts:result.counts,fingerprint:result.fingerprint,passwordsExcluded:true},null,2));
 else{if(!process.env.DATABASE_URL)throw Error("Missing DATABASE_URL");const {Pool}=require("pg");const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true}});
 pool.connect().then(async c=>{try{console.log(JSON.stringify(await archiveHistory(c,raw),null,2))}finally{c.release();await pool.end()}}).catch(e=>{console.error(e);process.exitCode=1})}
}
module.exports={TYPES,prepareHistory,archiveHistory};
