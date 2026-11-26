import type { LanguageCode } from '../types/medreport';

export interface UiCopy {
  brand: string;
  navOverview: string;
  navUpload: string;
  navSummary: string;
  navTrends: string;
  navSettings: string;
  ctaUpload: string;
  heroTitle: string;
  heroSubtitle: string;
  privacyNote: string;
  recentReports: string;
  openSummary: string;
  reviewValues: string;
  needsAttention: string;
  looksNormal: string;
  askDoctor: string;
  safetyFilterTitle: string;
  blockedAdviceLabel: string;
  safeGuidanceLabel: string;
  clickToVerifyTitle: string;
  clickToVerifyHint: string;
  maskedViewLabel: string;
  originalViewLabel: string;
  listenSummary: string;
  stopListening: string;
  uploadTitle: string;
  uploadSubtitle: string;
  photoTipsTitle: string;
  confirmValuesTitle: string;
  confirmAndReverify: string;
  trendsTitle: string;
  trendsSubtitle: string;
  settingsTitle: string;
  deleteAllData: string;
  resetDemoData: string;
  adminRulesTitle: string;
}

export const UI_COPY: Record<LanguageCode, UiCopy> = {
  en: {
    brand: 'MedReport-Guard',
    navOverview: 'Overview',
    navUpload: 'Upload',
    navSummary: 'Summary',
    navTrends: 'Trends',
    navSettings: 'Settings',
    ctaUpload: 'Upload Report',
    heroTitle: 'Understand your lab report safely, line by line.',
    heroSubtitle:
      'Personal details are masked before analysis. Every number is checked against the range printed on your report, and every sentence links straight back to the page.',
    privacyNote: 'Privacy-first: PII is redacted before AI processing. Reports are encrypted at rest and deletable anytime.',
    recentReports: 'Your Lab Reports',
    openSummary: 'Open Summary',
    reviewValues: 'Confirm 1 Value',
    needsAttention: 'Needs attention',
    looksNormal: 'Looks normal',
    askDoctor: 'Ask your doctor',
    safetyFilterTitle: 'Comorbidity Safety Filter',
    blockedAdviceLabel: 'Blocked generic advice',
    safeGuidanceLabel: 'Safe guidance for your combined results',
    clickToVerifyTitle: 'Click-to-Verify Evidence',
    clickToVerifyHint: 'Select any sentence on the left to highlight its exact row on the report.',
    maskedViewLabel: 'Masked (PII Hidden)',
    originalViewLabel: 'Original (Authorized)',
    listenSummary: 'Listen to Summary',
    stopListening: 'Stop Audio',
    uploadTitle: 'Upload a Lab Report',
    uploadSubtitle: 'Check photo clarity, mask personal identifiers locally, and run verified deterministic flagging.',
    photoTipsTitle: 'Tips for a clear photo',
    confirmValuesTitle: 'Confirm Low-Confidence Values',
    confirmAndReverify: 'Confirm & Re-verify',
    trendsTitle: 'Progress Across Visits',
    trendsSubtitle: 'Track each lab marker over time against the reference range printed on your reports.',
    settingsTitle: 'Settings, Account & Privacy',
    deleteAllData: 'Delete All My Data',
    resetDemoData: 'Restore Synthetic Demo Reports',
    adminRulesTitle: 'Clinical Safety Rules & Audit Log',
  },
  ta: {
    brand: 'MedReport-Guard',
    navOverview: 'முகப்பு',
    navUpload: 'பதிவேற்று',
    navSummary: 'சுருக்கம்',
    navTrends: 'போக்குகள்',
    navSettings: 'அமைப்புகள்',
    ctaUpload: 'அறிக்கை பதிவேற்று',
    heroTitle: 'உங்கள் மருத்துவ அறிக்கையை எளிமையாகவும் பாதுகாப்பாகவும் புரிந்துகொள்ளுங்கள்.',
    heroSubtitle:
      'தனிப்பட்ட விவரங்கள் முதலில் மறைக்கப்படுகின்றன. ஒவ்வொரு எண்ணும் உங்கள் அறிக்கையில் அச்சிடப்பட்ட வரம்புடன் சரிபார்க்கப்படுகிறது.',
    privacyNote: 'தனியுரிமை பாதுகாப்பு: AI பகுப்பாய்விற்கு முன் பெயர் மற்றும் தொலைபேசி எண்கள் மறைக்கப்படும்.',
    recentReports: 'உங்கள் ஆய்வக அறிக்கைகள்',
    openSummary: 'சுருக்கத்தைக் காண்க',
    reviewValues: 'மதிப்பை உறுதிசெய்க',
    needsAttention: 'கவனம் தேவை',
    looksNormal: 'சாதாரணமாக உள்ளது',
    askDoctor: 'மருத்துவரிடம் கேளுங்கள்',
    safetyFilterTitle: 'இணைநோய் பாதுகாப்பு வடிகட்டி',
    blockedAdviceLabel: 'தடுக்கப்பட்ட பொது ஆலோசனை',
    safeGuidanceLabel: 'பாதுகாப்பான வழிகாட்டுதல்',
    clickToVerifyTitle: 'கிளிக் செய்து சரிபார்க்கவும்',
    clickToVerifyHint: 'அறிக்கையில் அந்த வரியை முன்னிலைப்படுத்த இடதுபுற வாக்கியத்தைத் தேர்ந்தெடுக்கவும்.',
    maskedViewLabel: 'மறைக்கப்பட்ட காட்சி (PII இல்லை)',
    originalViewLabel: 'அசல் அறிக்கை',
    listenSummary: 'குரலில் கேளுங்கள்',
    stopListening: 'நிறுத்து',
    uploadTitle: 'ஆய்வக அறிக்கையைப் பதிவேற்றவும்',
    uploadSubtitle: 'படத்தின் தெளிவைச் சரிபார்த்து, தனிப்பட்ட தகவல்களை மறைத்து பாதுகாப்பாக பகுப்பாய்வு செய்யுங்கள்.',
    photoTipsTitle: 'தெளிவான புகைப்படத்திற்கான குறிப்புகள்',
    confirmValuesTitle: 'குறைந்த நம்பிக்கை மதிப்புகளை உறுதிசெய்க',
    confirmAndReverify: 'உறுதிசெய்து மீண்டும் சரிபார்',
    trendsTitle: 'மருத்துவ வருகைகளின் போக்கு',
    trendsSubtitle: 'பல வருகைகளில் உங்கள் பரிசோதனை மதிப்புகளின் மாற்றத்தைக் காண்க.',
    settingsTitle: 'அமைப்புகள் & தனியுரிமை',
    deleteAllData: 'எனது எல்லா தரவையும் நீக்கு',
    resetDemoData: 'மாதிரி அறிக்கைகளை மீட்டெடு',
    adminRulesTitle: 'பாதுகாப்பு விதிகள் & தணிக்கை பதிவு',
  },
  hi: {
    brand: 'MedReport-Guard',
    navOverview: 'मुख्य पृष्ठ',
    navUpload: 'अपलोड',
    navSummary: 'सारांश',
    navTrends: 'प्रगति',
    navSettings: 'सेटिंग्स',
    ctaUpload: 'रिपोर्ट अपलोड करें',
    heroTitle: 'अपनी लैब रिपोर्ट को सरल और सुरक्षित तरीके से समझें।',
    heroSubtitle:
      'विश्लेषण से पहले व्यक्तिगत जानकारी छिपाई जाती है। हर संख्या को आपकी रिपोर्ट की सीमा से जांचा जाता है।',
    privacyNote: 'गोपनीयता सर्वोपरि: AI विश्लेषण से पहले नाम और फ़ोन नंबर छिपा दिए जाते हैं।',
    recentReports: 'आपकी लैब रिपोर्ट्स',
    openSummary: 'सारांश देखें',
    reviewValues: 'मान की पुष्टि करें',
    needsAttention: 'ध्यान देने योग्य',
    looksNormal: 'सामान्य दिखता है',
    askDoctor: 'अपने डॉक्टर से पूछें',
    safetyFilterTitle: 'सह-रुग्णता सुरक्षा फ़िल्टर',
    blockedAdviceLabel: 'रोकी गई सामान्य सलाह',
    safeGuidanceLabel: 'सुरक्षित मार्गदर्शन',
    clickToVerifyTitle: 'क्लिक करके सत्यापित करें',
    clickToVerifyHint: 'रिपोर्ट पर सटीक पंक्ति देखने के लिए बाईं ओर किसी भी वाक्य पर क्लिक करें।',
    maskedViewLabel: 'मास्क किया गया (PII छिपा हुआ)',
    originalViewLabel: 'मूल रिपोर्ट',
    listenSummary: 'सारांश सुनें',
    stopListening: 'ऑडियो रोकें',
    uploadTitle: 'लैब रिपोर्ट अपलोड करें',
    uploadSubtitle: 'फ़ोटो की स्पष्टता जांचें, व्यक्तिगत जानकारी छिपाएं और सुरक्षित विश्लेषण चलाएं।',
    photoTipsTitle: 'स्पष्ट फ़ोटो के लिए सुझाव',
    confirmValuesTitle: 'कम-विश्वास मानों की पुष्टि करें',
    confirmAndReverify: 'पुष्टि करें और पुनः जांचें',
    trendsTitle: 'विज़िट के साथ प्रगति',
    trendsSubtitle: 'रिपोर्ट की संदर्भ सीमा के साथ समय के साथ अपने मानों की तुलना करें।',
    settingsTitle: 'सेटिंग्स, खाता और गोपनीयता',
    deleteAllData: 'मेरा सारा डेटा हटाएं',
    resetDemoData: 'डेमो रिपोर्ट पुनर्स्थापित करें',
    adminRulesTitle: 'सुरक्षा नियम और ऑडिट लॉग',
  },
};
