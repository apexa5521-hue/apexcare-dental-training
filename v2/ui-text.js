'use strict';
// Interface button labels in the selected language (ar, ur, id). Only buttons are touched:
// lesson content, catalog names and the official English assessment (#examPanel) are left as written.
// Buttons written as "عربي · English" show the half that matches the language.
// Renderers keep writing English; this layer re-labels after every DOM change.
(() => {
  const T = {
    'Sign in': ['تسجيل الدخول', 'سائن اِن کریں', 'Masuk'],
    'Sign out': ['تسجيل الخروج', 'سائن آؤٹ', 'Keluar'],
    'Dark mode': ['الوضع الليلي', 'ڈارک موڈ', 'Mode gelap'],
    'Light mode': ['الوضع النهاري', 'لائٹ موڈ', 'Mode terang'],
    'Theme': ['المظهر', 'تھیم', 'Tema'],
    'Close': ['إغلاق', 'بند کریں', 'Tutup'],
    'Next': ['التالي', 'اگلا', 'Berikutnya'],
    'Previous': ['السابق', 'پچھلا', 'Sebelumnya'],
    'Done': ['تم', 'ہو گیا', 'Selesai'],
    'Start now': ['ابدئي الآن', 'ابھی شروع کریں', 'Mulai sekarang'],
    'Continue learning': ['تابعي التعلّم', 'سیکھنا جاری رکھیں', 'Lanjutkan belajar'],
    'Continue this step': ['كمّلي هذه الخطوة', 'یہ مرحلہ جاری رکھیں', 'Lanjutkan langkah ini'],
    'Learning path': ['المسار التعليمي', 'سیکھنے کا راستہ', 'Jalur belajar'],
    'Study steps': ['خطوات الدراسة', 'مطالعے کے مراحل', 'Langkah belajar'],
    'See card requirements': ['متطلبات البطاقة', 'کارڈ کی شرائط دیکھیں', 'Lihat persyaratan kartu'],
    'Save draft': ['حفظ المسودة', 'مسودہ محفوظ کریں', 'Simpan draf'],
    'Send for clinical review': ['إرسال للمراجعة السريرية', 'کلینیکل جائزے کے لیے بھیجیں', 'Kirim untuk tinjauan klinis'],
    'Approve & publish': ['اعتماد ونشر', 'منظور کر کے شائع کریں', 'Setujui & terbitkan'],
    'Approve reviewed content & publish': ['اعتماد المحتوى المراجَع ونشره', 'جائزہ شدہ مواد منظور کر کے شائع کریں', 'Setujui konten yang ditinjau & terbitkan'],
    'Open & review content': ['فتح المحتوى ومراجعته', 'مواد کھولیں اور جائزہ لیں', 'Buka & tinjau konten'],
    'Edit translations': ['تعديل الترجمات', 'ترجمے میں ترمیم کریں', 'Edit terjemahan'],
    'Review questions': ['مراجعة الأسئلة', 'سوالات کا جائزہ لیں', 'Tinjau pertanyaan'],
    'Create draft exam': ['إنشاء اختبار مسودة', 'مسودہ امتحان بنائیں', 'Buat draf ujian'],
    'Exam timing': ['توقيت الاختبار', 'امتحان کا وقت', 'Waktu ujian'],
    'Save timing': ['حفظ التوقيت', 'وقت محفوظ کریں', 'Simpan waktu'],
    'Schedule assessment': ['جدولة التقييم', 'جائزہ شیڈول کریں', 'Jadwalkan penilaian'],
    'Save schedule': ['حفظ الجدول', 'شیڈول محفوظ کریں', 'Simpan jadwal'],
    'Send invitation': ['إرسال الدعوة', 'دعوت نامہ بھیجیں', 'Kirim undangan'],
    'Assign specialty': ['إسناد التخصص', 'تخصص تفویض کریں', 'Tetapkan spesialisasi'],
    'Link previous history': ['ربط السجل السابق', 'سابقہ ریکارڈ منسلک کریں', 'Tautkan riwayat sebelumnya'],
    'Prepare imported IPC drafts': ['تجهيز مسودات مكافحة العدوى المستوردة', 'درآمد شدہ انفیکشن کنٹرول مسودے تیار کریں', 'Siapkan draf PPI yang diimpor'],
    'Prepare 6 multilingual foundation drafts': ['تجهيز 6 مسودات أساسية متعددة اللغات', '6 کثیر لسانی بنیادی مسودے تیار کریں', 'Siapkan 6 draf dasar multibahasa'],
    'Prepare 6 multilingual dental chairside drafts (into the specialty selected in the form above)': ['تجهيز 6 مسودات لمساعدة طبيب الأسنان متعددة اللغات (في التخصص المختار أعلاه)', 'دندان سازی کے 6 کثیر لسانی مسودے تیار کریں (اوپر منتخب تخصص میں)', 'Siapkan 6 draf asisten dokter gigi multibahasa (ke spesialisasi yang dipilih di atas)'],
    'Save password and continue': ['حفظ كلمة المرور والمتابعة', 'پاس ورڈ محفوظ کر کے جاری رکھیں', 'Simpan kata sandi dan lanjutkan']
  };
  const IDX = { ar: 0, ur: 1, id: 2 };
  const SKIP = '#examPanel, .nse-tabs, .nse-drill .opts, [data-no-i18n]';
  const lang = () => document.getElementById('language')?.value || 'en';
  const hasArabic = s => /[؀-ۿ]/.test(s);

  // The visible label of a button: its only text node, or the last span (icons sit before it).
  const labelNode = b => {
    const kids = [...b.childNodes].filter(n => n.nodeType === 3 ? n.textContent.trim() : n.nodeType === 1);
    if (kids.length === 1 && kids[0].nodeType === 3) return kids[0];
    const span = [...b.children].reverse().find(c => c.tagName === 'SPAN' && c.children.length === 0 && c.textContent.trim());
    return span ? span.firstChild : null;
  };

  const label = (en, l) => {
    const parts = en.split(' · ');
    if (parts.length === 2 && hasArabic(en)) {
      const ar = parts.find(hasArabic), eng = parts.find(p => !hasArabic(p));
      if (l === 'ar') return ar;
      return (IDX[l] !== undefined && T[eng]?.[IDX[l]]) || eng;
    }
    if (l === 'en' || IDX[l] === undefined) return en;
    return T[en]?.[IDX[l]] || en;
  };

  let busy = false, observer = null;
  function apply(root = document) {
    if (busy) return; busy = true;
    try {
      const l = lang();
      root.querySelectorAll('button, a.btn').forEach(b => {
        if (b.closest(SKIP)) return;
        const node = labelNode(b); if (!node) return;
        const now = node.textContent;
        // A renderer changed the text since we last labelled it: that is the new source label.
        if (b.dataset.i18nShown !== now) b.dataset.i18nEn = now.trim();
        const want = label(b.dataset.i18nEn, l);
        if (now !== want) node.textContent = want;
        b.dataset.i18nShown = want;
      });
    } finally { observer?.takeRecords(); busy = false; }
  }

  let queued = false;
  const schedule = () => { if (queued || busy) return; queued = true; queueMicrotask(() => { queued = false; apply(); }); };
  const start = () => {
    observer = new MutationObserver(schedule); observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    document.getElementById('language')?.addEventListener('change', () => apply());
    apply();
  };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
  window.nseUiText = { apply, label, T, stop: () => observer?.disconnect() };
})();
