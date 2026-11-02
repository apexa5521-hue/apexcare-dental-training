"use strict";
(function(root){
const languages=["en","ar","ur","id"];
const strings={
en:{language:"Learning language",journey:"Achievement journey",knowledge:"Knowledge Card",competency:"Competency Card",completed:"Completed",locked:"Not eligible yet",learning:"Learning",practice:"Practice",assessment:"Assessment",observation:"Observed skill",next:"Next step",motivation:"Small steps, strong skills.",review:"Supervisor review required",qualify:"Eligibility requirements",achievement:"Achievements",viewCard:"Preview card",specialty:"Specialty",center:"Center",issued:"Issued",status:"Status",unverified:"Preview only — not a verified credential",assessmentLanguage:"Official assessments and clinical drills are conducted in English only."},
ar:{language:"لغة التعلم",journey:"رحلة الإنجاز",knowledge:"بطاقة المعرفة",competency:"بطاقة الكفاءة",completed:"مكتمل",locked:"غير مؤهلة للإصدار بعد",learning:"التعلم",practice:"التدريب",assessment:"الاختبار",observation:"الملاحظة العملية",next:"الخطوة التالية",motivation:"خطوات صغيرة، مهارات قوية.",review:"تتطلب اعتماد المشرفة",qualify:"متطلبات الاستحقاق",achievement:"إنجازاتي",viewCard:"معاينة البطاقة",specialty:"التخصص",center:"المركز",issued:"تاريخ الإصدار",status:"الحالة",unverified:"معاينة فقط — ليست وثيقة اعتماد موثقة",assessmentLanguage:"الاختبارات الرسمية والتدريبات السريرية باللغة الإنجليزية فقط."},
ur:{language:"سیکھنے کی زبان",journey:"کامیابی کا سفر",knowledge:"علمی کارڈ",competency:"مہارت کا کارڈ",completed:"مکمل",locked:"ابھی اہل نہیں",learning:"سیکھنا",practice:"مشق",assessment:"امتحان",observation:"عملی مشاہدہ",next:"اگلا مرحلہ",motivation:"چھوٹے قدم، مضبوط مہارتیں۔",review:"سپروائزر کی منظوری ضروری ہے",qualify:"اہلیت کی شرائط",achievement:"کامیابیاں",viewCard:"کارڈ دیکھیں",specialty:"تخصص",center:"مرکز",issued:"اجراء",status:"حالت",unverified:"صرف پیش نظارہ — تصدیق شدہ سند نہیں",assessmentLanguage:"سرکاری امتحانات اور طبی مشقیں صرف انگریزی میں ہوں گی۔"},
id:{language:"Bahasa pembelajaran",journey:"Perjalanan pencapaian",knowledge:"Kartu Pengetahuan",competency:"Kartu Kompetensi",completed:"Selesai",locked:"Belum memenuhi syarat",learning:"Belajar",practice:"Latihan",assessment:"Ujian",observation:"Observasi praktik",next:"Langkah berikutnya",motivation:"Langkah kecil, keterampilan kuat.",review:"Memerlukan persetujuan supervisor",qualify:"Persyaratan kelayakan",achievement:"Pencapaian",viewCard:"Pratinjau kartu",specialty:"Spesialisasi",center:"Pusat",issued:"Diterbitkan",status:"Status",unverified:"Hanya pratinjau — bukan kredensial terverifikasi",assessmentLanguage:"Ujian resmi dan latihan klinis hanya dalam bahasa Inggris."}
};
function t(lang,key){return (strings[lang]||strings.en)[key]||strings.en[key]||key;}
function deriveAchievements({modulesCompleted=0,practiceCompleted=false,assessmentPassed=false,observationApproved=false}={}){
 const stages=[!!(modulesCompleted>=1),!!practiceCompleted,!!assessmentPassed,!!observationApproved];
 const knowledge=stages[0]&&stages[2];
 const competency=knowledge&&stages[1]&&stages[3];
 return {stages,completed:stages.filter(Boolean).length,progress:Math.round(stages.filter(Boolean).length/4*100),knowledgeEligible:knowledge,competencyEligible:competency,badges:[...(stages[0]?["Learning Explorer"]:[]),...(stages[1]?["Practice Ready"]:[]),...(knowledge?["Knowledge Milestone"]:[]),...(competency?["Observed Competent"]:[])]};
}
function issuePreviewCard({type,staff,center,specialty,evidence}){
 if(!["knowledge","competency"].includes(type))throw Error("INVALID_CARD_TYPE");
 if(!staff||!center||!specialty)throw Error("MISSING_SCOPE");
 const a=deriveAchievements(evidence);
 if(type==="knowledge"&&!a.knowledgeEligible)throw Error("KNOWLEDGE_NOT_ELIGIBLE");
 if(type==="competency"&&!a.competencyEligible)throw Error("COMPETENCY_NOT_ELIGIBLE");
 return {type,staff,center,specialty,preview:true,verified:false};
}
root.QIBLearning={languages,t,deriveAchievements,issuePreviewCard};
if(typeof module!=="undefined"&&module.exports)module.exports=root.QIBLearning;
})(typeof globalThis!=="undefined"?globalThis:this);
