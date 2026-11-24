'use strict';

const dentalChildren = ['gp','endo','surgery','ortho','pedo','perio','prostho','restorative'];
const dermatologyChildren = ['derm_laser','derm_skin_care','derm_assistance'];
const departments = { dental: dentalChildren, dermatology: dermatologyChildren };

function departmentCodes(department, selected = []) {
  const children = departments[department];
  if (!children || selected.some(code => !children.includes(code))) return null;
  return [department, ...children];
}

function practiceCodes(assigned, isNurse) {
  if (isNurse && assigned.includes('dermatology')) return assigned.filter(code => code === 'dermatology' || dermatologyChildren.includes(code));
  return [...new Set(assigned.flatMap(code => code === 'dental' && !assigned.some(s => dentalChildren.includes(s)) ? ['dental', ...dentalChildren] : [code]))];
}

function browseCodes(assigned) {
  return new Set(['dental', ...dentalChildren, ...assigned]);
}

module.exports = { dentalChildren, dermatologyChildren, departmentCodes, practiceCodes, browseCodes };
