const {test}=require("node:test"),assert=require("node:assert/strict");
const {languages,t,deriveAchievements,issuePreviewCard}=require("../v2/learning-achievements.js");
test("four supported learning languages",()=>assert.deepEqual(languages,["en","ar","ur","id"]));
test("all translations include assessment English-only disclosure",()=>{for(const l of languages)assert.notEqual(t(l,"assessmentLanguage"),"assessmentLanguage")});
test("knowledge requires learning and passed assessment",()=>{assert.equal(deriveAchievements({modulesCompleted:1}).knowledgeEligible,false);assert.equal(deriveAchievements({modulesCompleted:1,assessmentPassed:true}).knowledgeEligible,true)});
test("competency requires supervised observation and practice",()=>{assert.equal(deriveAchievements({modulesCompleted:1,assessmentPassed:true}).competencyEligible,false);assert.equal(deriveAchievements({modulesCompleted:1,assessmentPassed:true,practiceCompleted:true,observationApproved:true}).competencyEligible,true)});
test("cannot issue unsupported card",()=>assert.throws(()=>issuePreviewCard({type:"license",staff:"Demo",center:"C",specialty:"S"}),/INVALID_CARD_TYPE/));
test("cannot issue credential with no proof",()=>assert.throws(()=>issuePreviewCard({type:"competency",staff:"Demo",center:"C",specialty:"S",evidence:{}}),/COMPETENCY_NOT_ELIGIBLE/));
test("preview card is never verified",()=>{const c=issuePreviewCard({type:"knowledge",staff:"Demo",center:"C",specialty:"S",evidence:{modulesCompleted:1,assessmentPassed:true}});assert.equal(c.verified,false);assert.equal(c.preview,true)});
