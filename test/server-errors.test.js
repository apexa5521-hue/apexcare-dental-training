'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const selfcheck=require('../api/selfcheck.js');
const fakeClient=owner=>({query:async sql=>/platform_owners/.test(sql)?{rowCount:owner?1:0,rows:[]}:{rowCount:0,rows:[]}});
const req={method:'GET'},url=new URL('http://x/api/admin/selfcheck');
test('unexpected server errors are listed for platform owners in diagnostics, newest first, capped at 20',async()=>{
 for(let i=0;i<25;i++)selfcheck.recordError({method:'GET',route:'/api/r'+i,ref:'42703',message:'column x does not exist'});
 const out=await selfcheck({req,url,c:fakeClient(true),userId:'u',centerId:'c',deny:()=>{throw Error('DENIED')}});
 assert.equal(out.data.recentErrors.length,20);assert.equal(out.data.recentErrors[0].route,'/api/r24');assert.equal(out.data.recentErrors[0].ref,'42703');
 await assert.rejects(selfcheck({req,url,c:fakeClient(false),userId:'u',centerId:'c',deny:()=>{throw Error('DENIED')}}),/DENIED/);
});
