'use strict';
const fs=require('node:fs'),path=require('node:path');
const STAGING_URL='https://btehppfdtnajzmxtdhzk.supabase.co';
// This release can upgrade only the explicitly authorized, dedicated NSE staging DB.
// Runtime credentials remain on Render; never export or print them.
async function upgradeStaging(pool,url){
 if(String(url||'').replace(/\/$/,'')!==STAGING_URL)throw Error('NSE_STAGING_PROJECT_REQUIRED');
 const client=await pool.connect();
 try{
  await client.query("select pg_advisory_lock(783651902)");
  const before=await client.query('select count(*)::int as attempts,coalesce(sum(score),0)::text as score_sum from qib.attempts');
  await client.query(fs.readFileSync(path.join(__dirname,'../deploy/exam-workflows-upgrade.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(__dirname,'../deploy/content-intake-upgrade.sql'),'utf8'));
  await client.query(fs.readFileSync(path.join(__dirname,'../deploy/content-proposals-upgrade.sql'),'utf8'));
  const after=await client.query('select count(*)::int as attempts,coalesce(sum(score),0)::text as score_sum from qib.attempts');
  if(JSON.stringify(before.rows)!==JSON.stringify(after.rows))throw Error('NSE_ATTEMPT_HISTORY_MISMATCH');
  console.log('NSE exam schema ready; historical attempt counts and score totals unchanged.');
 }finally{try{await client.query('select pg_advisory_unlock(783651902)')}finally{client.release()}}
}
module.exports={upgradeStaging,STAGING_URL};
