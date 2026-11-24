'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const search=require('../api/content-search');
test('Lucy rejects searches before reading content when user has an active or paused exam in any center',async()=>{
 let calls=0;
 await assert.rejects(search({req:{method:'GET'},url:new URL('https://test/api/search?q=mirror'),userId:'user',centerId:'other-center',role:{role:'nurse'},c:{query:async(sql,args)=>{calls++;assert.match(sql,/where user_id=\$1/);assert.equal(sql.includes('center_id'),false);assert.deepEqual(args,['user',['active','paused_review']]);return {rows:[{exists:1}]}}}}),/NURSE_LUCY_UNAVAILABLE_DURING_ASSESSMENT/);
 assert.equal(calls,1);
});
