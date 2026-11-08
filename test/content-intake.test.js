'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {validateFile,validateQuestion,validateEvidence,extract,generate}=require('../api/content-intake');
const {makeSteps}=require('../api/study-workflows');
const question={prompt_en:'Which item is described by the source?',options_en:['Option A','Option B'],answer_index:0,rationale_en:'The provided source supports option A.',category:'instrument_use',difficulty:'foundation',source_section:1,source_quote:'Synthetic source sentence for testing.'};
test('content intake rejects spoofed, executable and oversized files',()=>{
 assert.throws(()=>validateFile({mimeType:'image/png',base64:Buffer.from('<script>alert(1)</script>').toString('base64')}),/FILE_TYPE_MISMATCH/);
 assert.throws(()=>validateFile({mimeType:'image/svg+xml',base64:'YWJj'}),/UNSUPPORTED_FILE/);
 assert.throws(()=>validateFile({mimeType:'text/plain',base64:Buffer.alloc(1048577,65).toString('base64')}),/FILE_SIZE_LIMIT/);
 assert.equal(validateFile({mimeType:'text/plain',base64:Buffer.from('Synthetic test source').toString('base64')}).toString(),'Synthetic test source');
});
test('question candidates require answer integrity, English stem, distinct options and evidence',()=>{
 assert.equal(validateQuestion(question).answer_index,0);assert.throws(()=>validateQuestion({...question,answer_index:2}),/INVALID_QUESTION/);assert.throws(()=>validateQuestion({...question,options_en:['Same','same']}),/INVALID_QUESTION/);assert.throws(()=>validateQuestion({...question,prompt_en:'سؤال باللغة العربية للاختبار'}),/ENGLISH_ASSESSMENT_REQUIRED/);
 validateEvidence([{number:1,text:question.source_quote}],question);assert.throws(()=>validateEvidence([{number:1,text:'Other source content'}],question),/SOURCE_QUOTE_NOT_FOUND/);
});
test('document text extracts in bounded worker and corrupt DOCX fails cleanly',async()=>{
 const text='Synthetic source sentence for testing.';assert.equal((await extract(Buffer.from(text).toString('base64'),'text/plain'))[0].text,text);
 await assert.rejects(extract(Buffer.from('PK\u0003\u0004invalid').toString('base64'),'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),/DOCUMENT_EXTRACTION_FAILED/);
});
test('PDF extraction reads actual page text',async()=>{
 const stream='BT /F1 12 Tf 72 700 Td (Synthetic PDF source for testing.) Tj ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream'];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n'});const xref=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF';const sections=await extract(Buffer.from(pdf).toString('base64'),'application/pdf');assert.equal(sections.length,1);assert.match(sections[0].text,/Synthetic PDF source/);
});
test('Word DOCX extraction reads actual document paragraphs',async()=>{
 const {createRequire}=require('node:module'),path=require('node:path'),apiRequire=createRequire(path.resolve(__dirname,'../api/package.json')),JSZip=apiRequire('jszip'),zip=new JSZip();
 zip.file('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 zip.file('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic Word educational source.</w:t></w:r></w:p><w:p><w:r><w:t>Second synthetic paragraph.</w:t></w:r></w:p></w:body></w:document>');
 const sections=await extract(await zip.generateAsync({type:'base64'}),'application/vnd.openxmlformats-officedocument.wordprocessingml.document');assert.equal(sections.length,2);assert.equal(sections[0].text,'Synthetic Word educational source.');
});

test('AI integration is disabled without configuration and validates source evidence from structured responses',async()=>{
 await assert.rejects(generate({sections:[]},{key:null,model:null}),/NOT_CONFIGURED/);
 let sent;const result=await generate({sections:[{number:1,text:question.source_quote}]},{count:1,specialty:'Synthetic specialty',key:'synthetic-test-key',model:'synthetic-test-model',fetcher:async(url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({questions:[question]})}]}]}),{status:200})}});assert.equal(result.length,1);assert.equal(sent.store,false);assert.equal(sent.text.format.strict,true);assert.equal(sent.tools,undefined);
 await assert.rejects(generate({sections:[{number:1,text:'An unrelated source'}]},{count:1,key:'test',model:'test',fetcher:async()=>new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({questions:[question]})}]}]}))}),/SOURCE_QUOTE_NOT_FOUND/);
});
test('study steps retain every content paragraph without dropping long sections',()=>{
 const source='Intro\n\n'+Array(700).fill('Long content').join(' ');const steps=makeSteps(source);assert.ok(steps.length>2);assert.ok(steps.every(s=>s.length<=1100));assert.equal(steps.join(' ').replace(/\s+/g,' '),source.replace(/\s+/g,' '));
});
