"use strict";
(function(root){
const dictionaries={
en:{nav:["Overview","Learning library","Clinical simulation","Clinical Assessments","Skills passport","My achievements","Nursing team","Centers & specialties","Insights & reports","Content studio","Certificates & alerts"],search:"Search learning modules",searchPlaceholder:"Search by instrument, skill or procedure",modules:"Clinical learning library",subtitle:"Choose your specialty and learn at your own pace.",noModules:"No modules available in this specialty.",learningNote:"Clinical assessments and practical drills use English only."},
ar:{nav:["نظرة عامة","المكتبة التعليمية","المحاكاة السريرية","التقييمات السريرية","جواز الكفاءة","إنجازاتي","فريق التمريض","المراكز والتخصصات","التقارير والمتابعة","محرر المحتوى","البطاقات والتنبيهات"],search:"البحث في المحتوى التعليمي",searchPlaceholder:"ابحث عن أداة أو مهارة أو إجراء",modules:"المكتبة التعليمية السريرية",subtitle:"اختاري تخصصك وتعلمي بالوتيرة المناسبة لك.",noModules:"لا توجد وحدات متاحة لهذا التخصص.",learningNote:"تُجرى الاختبارات والتدريبات السريرية باللغة الإنجليزية فقط."},
ur:{nav:["جائزہ","تعلیمی لائبریری","طبی مشق","طبی جائزے","مہارت کا ریکارڈ","میری کامیابیاں","نرسنگ ٹیم","مراکز اور تخصصات","رپورٹس","مواد میں ترمیم","کارڈ اور اطلاعات"],search:"تعلیمی مواد تلاش کریں",searchPlaceholder:"آلہ، مہارت یا طریقہ تلاش کریں",modules:"طبی تعلیمی لائبریری",subtitle:"اپنا شعبہ منتخب کریں اور اپنی رفتار سے سیکھیں۔",noModules:"اس شعبے میں مواد دستیاب نہیں۔",learningNote:"تمام امتحانات اور طبی مشقیں صرف انگریزی میں ہیں۔"},
id:{nav:["Ringkasan","Pustaka pembelajaran","Simulasi klinis","Penilaian klinis","Paspor kompetensi","Pencapaian saya","Tim keperawatan","Pusat dan spesialisasi","Laporan","Editor konten","Kartu dan notifikasi"],search:"Cari materi belajar",searchPlaceholder:"Cari alat, keterampilan, atau prosedur",modules:"Pustaka pembelajaran klinis",subtitle:"Pilih spesialisasi dan belajar sesuai kemampuan Anda.",noModules:"Tidak ada modul untuk spesialisasi ini.",learningNote:"Ujian dan latihan klinis menggunakan bahasa Inggris saja."}
};
const moduleNames={
"Instrument recognition":{ar:"التعرف على أدوات الأسنان",ur:"دانتوں کے آلات کی شناخت",id:"Pengenalan instrumen gigi"},
"Tray preparation":{ar:"تجهيز صينية الأدوات",ur:"ٹرے کی تیاری",id:"Persiapan baki instrumen"},
"Instrument reprocessing & IPC":{ar:"إعادة معالجة الأدوات ومكافحة العدوى",ur:"آلات کی دوبارہ تیاری اور انفیکشن کنٹرول",id:"Pemrosesan ulang alat dan pencegahan infeksi"},
"Dermatology room preparation":{ar:"تجهيز غرفة الجلدية",ur:"جلد کے شعبے کے کمرے کی تیاری",id:"Persiapan ruang dermatologi"},
"Skin assessment support":{ar:"المساعدة في تقييم الجلد",ur:"جلد کی جانچ میں معاونت",id:"Dukungan penilaian kulit"},
"Biopsy assistance & specimen handling":{ar:"المساعدة في الخزعة والتعامل مع العينات",ur:"بایوپسی میں مدد اور نمونوں کا انتظام",id:"Bantuan biopsi dan penanganan spesimen"},
"Laser & energy device safety":{ar:"سلامة أجهزة الليزر والطاقة",ur:"لیزر اور توانائی والے آلات کی حفاظت",id:"Keselamatan laser dan perangkat energi"},
"Procedure aftercare and red flags":{ar:"رعاية ما بعد الإجراء وعلامات الخطر",ur:"عمل کے بعد دیکھ بھال اور خطرے کی علامات",id:"Perawatan setelah tindakan dan tanda bahaya"}
};
const moduleDescriptions={
"Identification, indications and handling":{ar:"الأسماء والاستخدامات والتعامل الآمن",ur:"شناخت، استعمال اور محفوظ طریقہ کار",id:"Identifikasi, indikasi, dan penanganan aman"},
"Prepare materials by procedure and clinician preference":{ar:"تجهيز المواد حسب الإجراء وتوجيه الطبيب",ur:"طریقہ کار اور ڈاکٹر کی ضرورت کے مطابق سامان تیار کریں",id:"Siapkan bahan sesuai prosedur dan preferensi klinisi"},
"Cleaning, packaging and sterilization checks":{ar:"التنظيف والتغليف والتحقق من التعقيم",ur:"صفائی، پیکنگ اور جراثیم کشی کی جانچ",id:"Pembersihan, pengemasan, dan pemeriksaan sterilisasi"},
"Room readiness, PPE, device and consumable checks":{ar:"جاهزية الغرفة والوقاية وفحص الأجهزة والمستهلكات",ur:"کمرے، حفاظتی سامان، آلات اور اشیاء کی تیاری",id:"Kesiapan ruangan, APD, alat, dan bahan habis pakai"},
"Photography consent, documentation and escalation":{ar:"الموافقة على التصوير والتوثيق والتصعيد عند الحاجة",ur:"تصاویر کی رضامندی، ریکارڈ اور ضرورت پر اطلاع",id:"Persetujuan foto, dokumentasi, dan eskalasi"},
"Patient identifiers, specimen labeling and safe transport":{ar:"التحقق من الهوية وترميز العينات ونقلها بأمان",ur:"مریض کی شناخت، نمونے کا لیبل اور محفوظ منتقلی",id:"Identitas pasien, pelabelan spesimen, dan transportasi aman"},
"Eye protection, safety checks and scope of practice":{ar:"حماية العين وفحوص السلامة وحدود الممارسة",ur:"آنکھوں کی حفاظت، حفاظتی جانچ اور دائرہ کار",id:"Pelindung mata, pemeriksaan keselamatan, dan batas praktik"},
"Education, documentation and escalation pathways":{ar:"تثقيف المريض والتوثيق ومتى يجب الإبلاغ",ur:"مریض کی تعلیم، ریکارڈ اور اطلاع دینے کے طریقے",id:"Edukasi pasien, dokumentasi, dan jalur eskalasi"}
};
const get=(l,key)=>dictionaries[l]?.[key]??dictionaries.en[key];
const translate=(l,value)=>l==="en"?value:moduleNames[value]?.[l]||moduleDescriptions[value]?.[l]||value;
root.QIBI18N={get,translate,dictionaries,moduleNames,moduleDescriptions};
if(typeof module!=="undefined"&&module.exports)module.exports=root.QIBI18N;
})(typeof globalThis!=="undefined"?globalThis:this);
