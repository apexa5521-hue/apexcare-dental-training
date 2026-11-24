const {test}=require("node:test"),assert=require("node:assert/strict");
const I=require("../v2/interface-i18n.js");
test("all four language menus cover every QIB module",()=>{for(const l of ["en","ar","ur","id"]){assert.equal(I.get(l,"nav").length,11);assert(I.get(l,"modules").length>1);}});
test("every built-in learning module has translations in ar, ur, id",()=>{for(const [en,map] of Object.entries(I.moduleNames))for(const l of ["ar","ur","id"])assert(map[l]&&map[l]!==en);});
test("every built-in module description has three translations",()=>{for(const [en,map] of Object.entries(I.moduleDescriptions))for(const l of ["ar","ur","id"])assert(map[l]&&map[l]!==en);});
test("unknown dynamic content falls back to original text",()=>assert.equal(I.translate("ur","Custom learning item"),"Custom learning item"));
