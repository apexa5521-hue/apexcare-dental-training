'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const keepAlive=setInterval(()=>{},1000),path=require('node:path');
(async()=>{const data=Buffer.from(workerData.base64,'base64');let sections=[];
 if(workerData.mime==='application/pdf'){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const job=getDocument({data:new Uint8Array(data),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,standardFontDataUrl:path.join(path.dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts/')});
  const doc=await job.promise;if(doc.numPages>100)throw Error('DOCUMENT_PAGE_LIMIT');
  for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();const text=content.items.map(x=>x.str||'').join(' ');if(text.length>20000)throw Error('DOCUMENT_TEXT_LIMIT');sections.push({number:n,label:'Page '+n,text});page.cleanup()}await job.destroy();
 }else if(workerData.mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
  const result=await require('mammoth').extractRawText({buffer:data});const paragraphs=result.value.split(/\n\s*\n/).filter(x=>x.trim());if(paragraphs.length>250||paragraphs.some(x=>x.length>20000))throw Error('DOCUMENT_TEXT_LIMIT');sections=paragraphs.map((text,i)=>({number:i+1,label:'Paragraph '+(i+1),text}));
 }else if(workerData.mime==='text/plain'){const text=data.toString('utf8');if(text.length>100000)throw Error('DOCUMENT_TEXT_LIMIT');sections=[{number:1,label:'Text',text}]};
 if(JSON.stringify(sections).length>200000)throw Error('DOCUMENT_TEXT_LIMIT');parentPort.postMessage({sections});
})().catch(e=>parentPort.postMessage({error:/LIMIT/.test(e.message)?e.message:'DOCUMENT_EXTRACTION_FAILED'})).finally(()=>clearInterval(keepAlive));
