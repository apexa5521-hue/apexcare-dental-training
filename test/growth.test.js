'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{insights}=require('../api/growth');
test('growth uses latest results, records unanswered items as support needs and never infers competence from missing evidence',()=>{
 const older={id:'old',assessment_id:'exam',score:10,question_snapshot:[]};assert.deepEqual(insights({attempts:[{...older,id:'new',score:90},older]}),[]);
 const gaps=insights({attempts:[{...older,question_snapshot:[{id:'q',category:'instrument_use',answer_index:1}],answers:{}}],observations:[{id:'latest',skill_id:'s',status:'competent'},{id:'older',skill_id:'s',status:'needs_support'}]});assert.equal(gaps.length,1);assert.equal(gaps[0].categories[0].missed,1);assert.deepEqual(insights({}),[]);
});
