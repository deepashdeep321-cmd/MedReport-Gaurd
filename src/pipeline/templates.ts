import type {
  LabResultItem,
  LanguageCode,
  LocalizedSummary,
  SummarySentence,
} from '../types/medreport';
import { MANDATORY_DISCLAIMER } from './rulesData';
import type { SafetyFilterOutput } from './safetyFilter';
import { verifySummary } from './verifier';

const TEST_LABELS_TA: Record<string, string> = {
  hemoglobin: 'ஹீமோகுளோபின்',
  iron: 'சீரம் இரும்பு',
  ferritin: 'ஃபெரிட்டின்',
  creatinine: 'கிரியேட்டினின்',
  egfr: 'eGFR',
  glucose_fasting: 'வெறும் வயிற்று சர்க்கரை',
  hba1c: 'HbA1c',
  vitamin_b12: 'வைட்டமின் B12',
  ldl_cholesterol: 'LDL கொழுப்பு',
  cholesterol: 'மொத்த கொழுப்பு',
  triglycerides: 'டிரைகிளிசரைடுகள்',
  alt: 'ALT (கல்லீரல் நொதி)',
  ast: 'AST (கல்லீரல் நொதி)',
  bilirubin: 'பிலிரூபின்',
  uric_acid: 'யூரிக் அமிலம்',
  potassium: 'பொட்டாசியம்',
  albumin: 'அல்புமின்',
  protein: 'மொத்த புரதம்',
  tsh: 'TSH',
  platelets: 'பிளேட்லெட் எண்ணிக்கை',
};

const TEST_LABELS_HI: Record<string, string> = {
  hemoglobin: 'हीमोग्लोबिन',
  iron: 'सीरम आयरन',
  ferritin: 'फेरिटिन',
  creatinine: 'क्रिएटिनिन',
  egfr: 'eGFR',
  glucose_fasting: 'फास्टिंग शुगर',
  hba1c: 'HbA1c',
  vitamin_b12: 'विटामिन B12',
  ldl_cholesterol: 'LDL कोलेस्ट्रॉल',
  cholesterol: 'कुल कोलेस्ट्रॉल',
  triglycerides: 'ट्राइग्लिसराइड्स',
  alt: 'ALT (लिवर एंजाइम)',
  ast: 'AST (लिवर एंजाइम)',
  bilirubin: 'बिलीरुबिन',
  uric_acid: 'यूरिक एसिड',
  potassium: 'पोटैशियम',
  albumin: 'एल्ब्यूमिन',
  protein: 'कुल प्रोटीन',
  tsh: 'TSH',
  platelets: 'प्लेटलेट काउंट',
};

const SAFETY_TA: Record<string, string> = {
  C1: 'இரும்பு மற்றும் சிறுநீரக மதிப்புகள் வரம்பிற்கு வெளியே உள்ளதால், கீரை போன்ற அதிக பொட்டாசியம் உணவுகளை நீங்களாக சேர்க்க வேண்டாம்; மருத்துவரிடம் கேளுங்கள்.',
  C2: 'இரத்த சர்க்கரையும் அதிகமாக உள்ளதால், வெல்லம், பேரீச்சம்பழம் அல்லது இனிப்பு டானிக்குகளைத் தவிர்த்து மருத்துவரிடம் பாதுகாப்பான உணவு முறையைக் கேளுங்கள்.',
  C3: 'கொழுப்பு அளவும் அதிகமாக உள்ளதால், அதிக கொழுப்புள்ள உணவுகளைத் தவிர்த்து மருத்துவரிடம் ஆலோசனை கேளுங்கள்.',
  C4: 'கல்லீரல் மதிப்புகள் அதிகமாக உள்ளதால், மருத்துவரின் ஆலோசனை இல்லாமல் எந்த சப்ளிமெண்ட் அல்லது மூலிகைப் பொருட்களையும் தொடங்க வேண்டாம்.',
  C5: 'யூரிக் அமிலம் அதிகமாக உள்ளதால், அதிக பியூரின் உணவுகளைத் தவிர்த்து மருத்துவரிடம் கேளுங்கள்.',
  C6: 'சிறுநீரக மற்றும் பொட்டாசியம் மதிப்புகள் கவனம் தேவைப்படுவதால், நீங்களாக பொட்டாசியம் பானங்களை எடுக்காமல் மருத்துவரைச் சந்தியுங்கள்.',
  C7: 'கிரியேட்டினின் அதிகமாகவும் புரதம் குறைவாகவும் உள்ளதால், அதிக புரத பானங்களைத் தவிர்த்து மருத்துவரிடம் கேளுங்கள்.',
};

const SAFETY_HI: Record<string, string> = {
  C1: 'आयरन और किडनी दोनों के मान सामान्य सीमा से बाहर हैं, इसलिए अपने आप पालक जैसे अधिक पोटैशियम वाले भोजन न बढ़ाएं और डॉक्टर से सुरक्षित आहार पूछें।',
  C2: 'ब्लड शुगर भी सीमा से ऊपर है, इसलिए गुड़, खजूर या मीठे टॉनिक से बचें और डॉक्टर से संतुलित विकल्प पूछें।',
  C3: 'कोलेस्ट्रॉल भी बढ़ा हुआ है, इसलिए अधिक वसा वाले भोजन से बचें और डॉक्टर से सुरक्षित आहार के बारे में पूछें।',
  C4: 'लिवर के मान बढ़े हैं, इसलिए डॉक्टर से पूछे बिना कोई भी सप्लीमेंट या हर्बल उत्पाद न लें।',
  C5: 'यूरिक एसिड बढ़ा है, इसलिए अधिक प्यूरिन वाले भोजन से बचें और डॉक्टर से सलाह लें।',
  C6: 'किडनी और पोटैशियम दोनों को संतुलन चाहिए, इसलिए अपने आप पोटैशियम ड्रिंक न लें और तुरंत डॉक्टर से मिलें।',
  C7: 'क्रिएटिनिन बढ़ा है और प्रोटीन कम है, इसलिए डॉक्टर की सलाह के बिना हाई-प्रोटीन शेक न लें।',
};

function formatRangePhrase(item: LabResultItem, lang: LanguageCode): string {
  if (item.ref_low !== null && item.ref_high !== null) {
    if (lang === 'ta') return `${item.ref_low} முதல் ${item.ref_high} ${item.unit_std}`;
    if (lang === 'hi') return `${item.ref_low} से ${item.ref_high} ${item.unit_std}`;
    return `${item.ref_low} to ${item.ref_high} ${item.unit_std}`;
  }
  if (item.ref_high !== null) {
    if (lang === 'ta') return `${item.ref_high} ${item.unit_std}-க்கு கீழ்`;
    if (lang === 'hi') return `${item.ref_high} ${item.unit_std} से कम`;
    return `under ${item.ref_high} ${item.unit_std}`;
  }
  if (item.ref_low !== null) {
    if (lang === 'ta') return `${item.ref_low} ${item.unit_std}-க்கு மேல்`;
    if (lang === 'hi') return `${item.ref_low} ${item.unit_std} से अधिक`;
    return `above ${item.ref_low} ${item.unit_std}`;
  }
  return '';
}

function localizedName(item: LabResultItem, lang: LanguageCode): string {
  if (lang === 'ta') return TEST_LABELS_TA[item.test_name_std] || item.display_name;
  if (lang === 'hi') return TEST_LABELS_HI[item.test_name_std] || item.display_name;
  return item.display_name;
}

export function buildTemplateSummary(
  results: LabResultItem[],
  safety: SafetyFilterOutput,
  language: LanguageCode,
  rulesVersion: string,
  attempts = 1,
): LocalizedSummary {
  const sentences: SummarySentence[] = [];
  const checkIds = ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'];

  const criticalItems = results.filter((r) => r.flag === 'critical');
  const lowOrHighItems = results.filter((r) => r.flag === 'low' || r.flag === 'high');
  const normalItems = results.filter((r) => r.flag === 'normal');
  const unknownItems = results.filter((r) => r.flag === 'unknown');

  for (const item of criticalItems) {
    const name = localizedName(item, language);
    const rangeStr = formatRangePhrase(item, language);
    let sentence = '';
    if (language === 'ta') {
      sentence = `அவசரம்: உங்கள் ${name} அளவு ${item.value} ${item.unit_std} ஆக உள்ளது (வரம்பு ${rangeStr}). தயவுசெய்து உடனே மருத்துவரைப் பாருங்கள். [${item.result_key}]`;
    } else if (language === 'hi') {
      sentence = `तुरंत ध्यान दें: आपका ${name} स्तर ${item.value} ${item.unit_std} है (सीमा ${rangeStr})। कृपया अभी डॉक्टर से मिलें। [${item.result_key}]`;
    } else {
      sentence = `Your ${name} is ${item.value} ${item.unit_std}, which is a critical value outside ${rangeStr}. Please see a doctor now. [${item.result_key}]`;
    }
    sentences.push({
      sentence,
      evidence_result_keys: [item.result_key],
      section: 'needs_attention',
      check_ids: checkIds,
    });
  }

  for (const item of lowOrHighItems) {
    const name = localizedName(item, language);
    const rangeStr = formatRangePhrase(item, language);
    let sentence = '';
    if (language === 'ta') {
      const dir = item.flag === 'low' ? 'குறைவாக' : 'அதிகமாக';
      sentence = `உங்கள் ${name} அளவு ${item.value} ${item.unit_std} ஆக உள்ளது; இது அறிக்கை வரம்பை (${rangeStr}) விட ${dir} உள்ளது. [${item.result_key}]`;
    } else if (language === 'hi') {
      const dir = item.flag === 'low' ? 'कम' : 'अधिक';
      sentence = `आपका ${name} स्तर ${item.value} ${item.unit_std} है, जो रिपोर्ट की सीमा (${rangeStr}) से ${dir} है। [${item.result_key}]`;
    } else {
      const dir = item.flag === 'low' ? 'below' : 'above';
      sentence = `Your ${name} is ${item.value} ${item.unit_std}, which is ${dir} the lab range of ${rangeStr}. [${item.result_key}]`;
    }
    sentences.push({
      sentence,
      evidence_result_keys: [item.result_key],
      section: 'needs_attention',
      check_ids: checkIds,
    });
  }

  for (const hit of safety.hits) {
    let sentence = hit.safe_message;
    if (language === 'ta' && SAFETY_TA[hit.rule_id]) {
      sentence = SAFETY_TA[hit.rule_id];
    } else if (language === 'hi' && SAFETY_HI[hit.rule_id]) {
      sentence = SAFETY_HI[hit.rule_id];
    }
    const abnormalKeys = results
      .filter((r) => r.flag === 'low' || r.flag === 'high' || r.flag === 'critical')
      .map((r) => r.result_key);
    sentences.push({
      sentence,
      evidence_result_keys: abnormalKeys.slice(0, 3),
      section: 'safety_note',
      check_ids: checkIds,
    });
  }

  for (const item of normalItems) {
    const name = localizedName(item, language);
    const rangeStr = formatRangePhrase(item, language);
    let sentence = '';
    if (language === 'ta') {
      sentence = `உங்கள் ${name} அளவு ${item.value} ${item.unit_std} ஆக உள்ளது; இது சாதாரண வரம்பில் (${rangeStr}) உள்ளது. [${item.result_key}]`;
    } else if (language === 'hi') {
      sentence = `आपका ${name} स्तर ${item.value} ${item.unit_std} है, जो सामान्य सीमा (${rangeStr}) के भीतर है। [${item.result_key}]`;
    } else {
      sentence = `Your ${name} is ${item.value} ${item.unit_std}, which is in the lab range of ${rangeStr}. [${item.result_key}]`;
    }
    sentences.push({
      sentence,
      evidence_result_keys: [item.result_key],
      section: 'looks_normal',
      check_ids: checkIds,
    });
  }

  for (const item of unknownItems) {
    const name = localizedName(item, language);
    let sentence = '';
    if (language === 'ta') {
      sentence = `உங்கள் ${name} அளவு ${item.value} ${item.unit_std} என உள்ளது, ஆனால் அறிக்கையில் வரம்பு இல்லை. தயவுசெய்து மருத்துவரிடம் கேளுங்கள். [${item.result_key}]`;
    } else if (language === 'hi') {
      sentence = `आपका ${name} स्तर ${item.value} ${item.unit_std} है, लेकिन रिपोर्ट में सीमा नहीं दी गई है। कृपया डॉक्टर से पूछें। [${item.result_key}]`;
    } else {
      sentence = `Your ${name} is ${item.value} ${item.unit_std}, with no range printed on this page. Please ask your doctor about it. [${item.result_key}]`;
    }
    sentences.push({
      sentence,
      evidence_result_keys: [item.result_key],
      section: 'ask_doctor',
      check_ids: checkIds,
    });
  }

  // Closing doctor reminder
  const askDoctorClose =
    language === 'ta'
      ? 'தயவுசெய்து இந்த அறிக்கையை உங்கள் மருத்துவரிடம் காட்டி அடுத்த கட்டத்தைப் பற்றி கேளுங்கள்.'
      : language === 'hi'
        ? 'कृपया यह रिपोर्ट अपने डॉक्टर को दिखाएं और आगे के कदम के बारे में पूछें।'
        : 'Please show this report to your doctor and ask what steps fit you best.';

  sentences.push({
    sentence: askDoctorClose,
    evidence_result_keys: [],
    section: 'ask_doctor',
    check_ids: checkIds,
  });

  // Mandatory disclaimer sentence
  sentences.push({
    sentence: MANDATORY_DISCLAIMER[language],
    evidence_result_keys: [],
    section: 'disclaimer',
    check_ids: checkIds,
  });

  const verifierLog = verifySummary(sentences, results, safety, language);
  verifierLog.attempts = attempts;
  verifierLog.used_fallback = true;

  return {
    language,
    sentences,
    used_fallback: true,
    verifier_log: verifierLog,
    rules_version: rulesVersion,
    disclaimer: MANDATORY_DISCLAIMER[language],
  };
}
