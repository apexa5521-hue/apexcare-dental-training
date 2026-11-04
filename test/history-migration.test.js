"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const {prepareHistory}=require("../deploy/import-history.js");
test("archives full history counts without dropping results",()=>{const x=prepareHistory({AssessmentResults:[{id:"x",score:82},{id:"y",score:94}],NurseProgress:[{username:"staff",masteredTools:'["t1"]'}]});assert.equal(x.counts.AssessmentResults,2);assert.equal(x.counts.NurseProgress,1)});
test("removes plaintext credentials and never hashes them as data",()=>{const x=prepareHistory({Users:[{id:"u1",name:"Staff",password:"secret-old",token:"old"}]});assert.equal(x.rows[0].payload.password,undefined);assert(!JSON.stringify(x).includes("secret-old"))});
