'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs'),path=require('node:path');
// The animated wave canvas must stay absolutely positioned behind the hero. A later stylesheet that
// gives every hero child position:relative turns the canvas into a block that keeps growing.
test('no stylesheet repositions the hero wave canvas',()=>{
 for(const f of fs.readdirSync(path.join(__dirname,'../v2')).filter(f=>f.endsWith('.css'))){
  const css=fs.readFileSync(path.join(__dirname,'../v2',f),'utf8');
  assert.ok(!/\.hero>\*\s*\{[^}]*position\s*:\s*relative/.test(css),f+' sets position:relative on every hero child, including the wave canvas');
 }
});
