'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {departmentCodes,practiceCodes}=require('../api/nursing-tracks');

test('department accepts only its own specialties and preserves the primary order',()=>{
  assert.deepEqual(departmentCodes('dental',['endo','gp','endo']),['dental','endo','gp']);
  assert.deepEqual(departmentCodes('dermatology',['derm_skin_care','derm_laser']),['dermatology','derm_skin_care','derm_laser']);
  assert.equal(departmentCodes('dental',['derm_laser']),null);
  assert.equal(departmentCodes('dermatology',[]),null);
  assert.equal(departmentCodes('unknown',['gp']),null);
});

test('explicit specialties narrow practice while legacy dental accounts retain broad access',()=>{
  assert.deepEqual(practiceCodes(['dental','gp','endo'],true),['dental','gp','endo']);
  assert.ok(practiceCodes(['dental'],true).includes('surgery'));
  assert.deepEqual(practiceCodes(['dermatology','derm_laser'],true),['dermatology','derm_laser']);
});
