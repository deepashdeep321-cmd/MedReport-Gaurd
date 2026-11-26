import type {
  ConflictRule,
  CriticalLimitRule,
  LanguageCode,
  RulesBundle,
  UnitConversionRule,
} from '../types/medreport';

export const MANDATORY_DISCLAIMER: Record<LanguageCode, string> = {
  en: 'This tool explains your report. It does not diagnose any disease or replace a doctor.',
  ta: 'இந்த கருவி உங்கள் அறிக்கையை விளக்குகிறது. இது எந்த நோயையும் கண்டறியாது அல்லது மருத்துவருக்கு மாற்றாகாது.',
  hi: 'यह टूल आपकी रिपोर्ट को समझाता है। यह किसी बीमारी का निदान नहीं करता और न ही डॉक्टर की जगह लेता है।',
};

export const DISPLAY_NAMES: Record<string, string> = {
  hemoglobin: 'Hemoglobin',
  iron: 'Serum Iron',
  ferritin: 'Ferritin',
  creatinine: 'Serum Creatinine',
  egfr: 'eGFR',
  glucose_fasting: 'Fasting Glucose',
  hba1c: 'HbA1c',
  vitamin_b12: 'Vitamin B12',
  ldl_cholesterol: 'LDL Cholesterol',
  cholesterol: 'Total Cholesterol',
  triglycerides: 'Triglycerides',
  alt: 'ALT (SGPT)',
  ast: 'AST (SGOT)',
  bilirubin: 'Total Bilirubin',
  uric_acid: 'Uric Acid',
  potassium: 'Serum Potassium',
  albumin: 'Serum Albumin',
  protein: 'Total Protein',
  tsh: 'TSH',
  platelets: 'Platelet Count',
};

export const DEFAULT_TEST_ALIASES: Record<string, string> = {
  hb: 'hemoglobin',
  hgb: 'hemoglobin',
  haemoglobin: 'hemoglobin',
  hemoglobin: 'hemoglobin',
  'serum iron': 'iron',
  iron: 'iron',
  fe: 'iron',
  ferritin: 'ferritin',
  'serum ferritin': 'ferritin',
  creatinine: 'creatinine',
  's. creatinine': 'creatinine',
  'serum creatinine': 'creatinine',
  creat: 'creatinine',
  egfr: 'egfr',
  'estimated gfr': 'egfr',
  fbs: 'glucose_fasting',
  'fasting blood sugar': 'glucose_fasting',
  'fasting glucose': 'glucose_fasting',
  'blood glucose fasting': 'glucose_fasting',
  hba1c: 'hba1c',
  'glycated hemoglobin': 'hba1c',
  'glycosylated hb': 'hba1c',
  'vitamin b12': 'vitamin_b12',
  'vit b12': 'vitamin_b12',
  b12: 'vitamin_b12',
  'ldl cholesterol': 'ldl_cholesterol',
  'ldl-c': 'ldl_cholesterol',
  ldl: 'ldl_cholesterol',
  'total cholesterol': 'cholesterol',
  cholesterol: 'cholesterol',
  triglycerides: 'triglycerides',
  tg: 'triglycerides',
  alt: 'alt',
  sgpt: 'alt',
  'alt (sgpt)': 'alt',
  ast: 'ast',
  sgot: 'ast',
  'ast (sgot)': 'ast',
  bilirubin: 'bilirubin',
  'total bilirubin': 'bilirubin',
  'uric acid': 'uric_acid',
  'serum uric acid': 'uric_acid',
  potassium: 'potassium',
  'serum potassium': 'potassium',
  'k+': 'potassium',
  albumin: 'albumin',
  'serum albumin': 'albumin',
  'total protein': 'protein',
  protein: 'protein',
  tsh: 'tsh',
  platelets: 'platelets',
  'platelet count': 'platelets',
  plt: 'platelets',
};

export const DEFAULT_UNIT_CONVERSIONS: UnitConversionRule[] = [
  { test_name_std: 'glucose_fasting', from_unit: 'mmol/L', to_unit: 'mg/dL', factor: 18.0182 },
  { test_name_std: 'creatinine', from_unit: 'umol/L', to_unit: 'mg/dL', factor: 0.011312 },
  { test_name_std: 'creatinine', from_unit: 'µmol/L', to_unit: 'mg/dL', factor: 0.011312 },
  { test_name_std: 'cholesterol', from_unit: 'mmol/L', to_unit: 'mg/dL', factor: 38.67 },
  { test_name_std: 'ldl_cholesterol', from_unit: 'mmol/L', to_unit: 'mg/dL', factor: 38.67 },
  { test_name_std: 'hemoglobin', from_unit: 'g/L', to_unit: 'g/dL', factor: 0.1 },
];

export const DEFAULT_CRITICAL_LIMITS: CriticalLimitRule[] = [
  {
    test_name_std: 'potassium',
    unit_std: 'mEq/L',
    critical_low: 2.8,
    critical_high: 6.2,
    needs_clinical_review: true,
    note: 'NEEDS_CLINICAL_REVIEW: Illustrative prototype threshold only.',
  },
  {
    test_name_std: 'glucose_fasting',
    unit_std: 'mg/dL',
    critical_low: 50,
    critical_high: 450,
    needs_clinical_review: true,
    note: 'NEEDS_CLINICAL_REVIEW: Illustrative prototype threshold only.',
  },
  {
    test_name_std: 'hemoglobin',
    unit_std: 'g/dL',
    critical_low: 7.0,
    critical_high: null,
    needs_clinical_review: true,
    note: 'NEEDS_CLINICAL_REVIEW: Illustrative prototype threshold only.',
  },
  {
    test_name_std: 'platelets',
    unit_std: '10^3/uL',
    critical_low: 50,
    critical_high: null,
    needs_clinical_review: true,
    note: 'NEEDS_CLINICAL_REVIEW: Illustrative prototype threshold only.',
  },
];

export const DEFAULT_CONFLICT_RULES: ConflictRule[] = [
  {
    id: 'C1',
    title: 'Low Iron/Ferritin with Raised Kidney Markers',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['iron', 'ferritin', 'hemoglobin'], flags: ['low', 'critical'] },
      { any_tests: ['creatinine', 'egfr'], flags: ['high', 'low', 'critical'] },
    ],
    blocked_items: ['spinach', 'high-potassium foods', 'banana', 'coconut water'],
    blocked_synonyms: ['spinach', 'palak', 'keerai', 'banana', 'coconut water', 'potassium-rich', 'potato skins'],
    safe_message:
      'Because both iron and kidney markers are out of range, avoid adding high-potassium foods like spinach on your own and ask your doctor for a kidney-safe food plan.',
    severity: 'high',
  },
  {
    id: 'C2',
    title: 'Low Hemoglobin/Iron with Elevated Blood Sugar',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['hemoglobin', 'iron', 'ferritin'], flags: ['low', 'critical'] },
      { any_tests: ['glucose_fasting', 'hba1c'], flags: ['high', 'critical'] },
    ],
    blocked_items: ['jaggery', 'dates', 'sweet tonics', 'sugary syrups'],
    blocked_synonyms: ['jaggery', 'gur', 'vellam', 'dates', 'khajoor', 'sweet tonic', 'sweet syrup', 'sugar-rich'],
    safe_message:
      'Because blood sugar is also above range, avoid sweet items such as jaggery, dates, or sweet tonics and ask your doctor for balanced options.',
    severity: 'high',
  },
  {
    id: 'C3',
    title: 'Low B12/Iron with Raised Cholesterol or Triglycerides',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['vitamin_b12', 'iron', 'hemoglobin'], flags: ['low', 'critical'] },
      { any_tests: ['ldl_cholesterol', 'cholesterol', 'triglycerides'], flags: ['high', 'critical'] },
    ],
    blocked_items: ['organ meats', 'high-fat foods', 'liver', 'fried fatty meats'],
    blocked_synonyms: ['organ meat', 'liver', 'red meat', 'high-fat', 'high-cholesterol', 'ghee-heavy'],
    safe_message:
      'Because blood fats are also high, avoid high-fat or organ meats and ask your doctor about safe nutrition choices.',
    severity: 'moderate',
  },
  {
    id: 'C4',
    title: 'Raised Liver Enzymes with Any Deficiency',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['alt', 'ast', 'bilirubin'], flags: ['high', 'critical'] },
      { any_tests: ['hemoglobin', 'iron', 'ferritin', 'vitamin_b12'], flags: ['low', 'critical'] },
    ],
    blocked_items: ['self-started supplements', 'herbal products', 'over-the-counter tonics'],
    blocked_synonyms: ['herbal', 'supplement', 'over-the-counter', 'ayurvedic tonic', 'self-started'],
    safe_message:
      'Because liver markers are raised, do not start any supplements or herbal products without your doctor checking first.',
    severity: 'high',
  },
  {
    id: 'C5',
    title: 'High Uric Acid with Low Hemoglobin or Protein',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['uric_acid'], flags: ['high', 'critical'] },
      { any_tests: ['hemoglobin', 'protein', 'albumin'], flags: ['low', 'critical'] },
    ],
    blocked_items: ['high-purine foods', 'shellfish', 'organ meats'],
    blocked_synonyms: ['purine', 'shellfish', 'anchovies', 'sardines', 'organ meat'],
    safe_message:
      'Because uric acid is high, avoid high-purine foods and ask your doctor how to support nutrition safely.',
    severity: 'moderate',
  },
  {
    id: 'C6',
    title: 'Low Potassium with Raised Kidney Markers',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['potassium'], flags: ['low', 'critical'] },
      { any_tests: ['creatinine', 'egfr'], flags: ['high', 'low', 'critical'] },
    ],
    blocked_items: ['self-correcting potassium drinks', 'potassium salt substitutes'],
    blocked_synonyms: ['potassium drink', 'electrolyte powder', 'potassium salt', 'coconut water'],
    safe_message:
      'Because kidney markers and potassium both need careful balance, do not try to adjust potassium on your own; speak with your doctor promptly.',
    severity: 'high',
  },
  {
    id: 'C7',
    title: 'Raised Creatinine with Low Albumin or Protein',
    illustrativeNeedsClinicalReview: true,
    if_all: [
      { any_tests: ['creatinine'], flags: ['high', 'critical'] },
      { any_tests: ['albumin', 'protein'], flags: ['low', 'critical'] },
    ],
    blocked_items: ['protein loading', 'high-protein shakes', 'whey powder'],
    blocked_synonyms: ['protein loading', 'protein shake', 'whey', 'high-protein diet'],
    safe_message:
      'Because kidney markers are high while protein is low, avoid heavy protein shakes or protein loading until your doctor advises you.',
    severity: 'high',
  },
];

export const DIAGNOSIS_PATTERNS: RegExp[] = [
  /\byou have\b/i,
  /\bdiagnosed with\b/i,
  /\byou suffer from\b/i,
  /\bthis confirms\b/i,
  /\bchronic kidney disease\b/i,
  /\bdiabetes\b/i,
  /\banemia\b/i,
  /\banaemia\b/i,
  /\bliver disease\b/i,
  /\bhepatitis\b/i,
  /\bhyperlipidemia\b/i,
  /\bgout\b/i,
  /\bhyperkalemia\b/i,
  /\bhypokalemia\b/i,
];

export const MEDICINE_PATTERNS: RegExp[] = [
  /\b\d+\s?(mg|mcg|iu|tablets?|capsules?|pills?)\b(?!\/)/i,
  /\b(metformin|insulin|atorvastatin|statin|ferrous|iron tablet|allopurinol|amlodipine|losartan|levothyroxine|paracetamol|ibuprofen|aspirin)\b/i,
  /\btake\s+(a|an|one|two|\d+)\s+(tablet|pill|capsule|dose|syrup)\b/i,
  /\bprescribe\b/i,
  /\bdosage\b/i,
];

export function createDefaultRulesBundle(): RulesBundle {
  return {
    version: '1.0.0',
    updated_at: '2026-11-25T09:00:00.000Z',
    test_aliases: { ...DEFAULT_TEST_ALIASES },
    unit_conversions: DEFAULT_UNIT_CONVERSIONS.map((item) => ({ ...item })),
    critical_limits: DEFAULT_CRITICAL_LIMITS.map((item) => ({ ...item })),
    conflict_rules: DEFAULT_CONFLICT_RULES.map((rule) => ({
      ...rule,
      if_all: rule.if_all.map((cond) => ({
        any_tests: [...cond.any_tests],
        flags: [...cond.flags],
      })),
      blocked_items: [...rule.blocked_items],
      blocked_synonyms: [...rule.blocked_synonyms],
    })),
  };
}
