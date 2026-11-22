'use strict';

const dentalChildren = ['gp','endo','surgery','ortho','pedo','perio','prostho','restorative'];

function practiceCodes(assigned, isNurse) {
  if (isNurse && assigned.includes('dermatology')) return ['dermatology'];
  return [...new Set(assigned.flatMap(code => code === 'dental' ? ['dental', ...dentalChildren] : [code]))];
}

function browseCodes(assigned) {
  return new Set(['dental', ...dentalChildren, ...assigned]);
}

module.exports = { dentalChildren, practiceCodes, browseCodes };
