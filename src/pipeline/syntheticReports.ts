import type {
  BoundingBox,
  LabResultItem,
  PiiMaskBox,
  ReportRecord,
  RulesBundle,
} from '../types/medreport';
import { getDisplayName, normalizeTestName, parseReferenceRange } from './normalize';
import { applyRuleChecker } from './rules';
import { runComorbiditySafetyFilter } from './safetyFilter';
import { buildTemplateSummary } from './templates';

export interface SyntheticRowSpec {
  result_key: string;
  test_name_raw: string;
  value_raw: string;
  unit_raw: string;
  ref_text: string;
  confidence: number;
  method?: string;
}

export interface SyntheticReportPreset {
  id: string;
  title: string;
  visit_date: string;
  lab_name: string;
  patient_name_synthetic: string;
  patient_id_synthetic: string;
  patient_phone_synthetic: string;
  doctor_name_synthetic: string;
  patient_age_sex: string;
  rows: SyntheticRowSpec[];
}

export const PAGE_WIDTH = 900;
export const PAGE_HEIGHT = 1160;

export const SYNTHETIC_PRESETS: SyntheticReportPreset[] = [
  {
    id: 'visit-1-baseline',
    title: 'Annual Preventive Metabolic & CBC Panel',
    visit_date: '2026-03-14',
    lab_name: 'SYNTHETIC DIAGNOSTICS LAB (DEMO ONLY)',
    patient_name_synthetic: 'A. Kumar (Synthetic)',
    patient_id_synthetic: 'SYN-2026-0412',
    patient_phone_synthetic: '+91 90000 00001',
    doctor_name_synthetic: 'Dr. M. Rao (Synthetic)',
    patient_age_sex: '54Y / F',
    rows: [
      { result_key: 'R1', test_name_raw: 'Haemoglobin (Hb)', value_raw: '12.4', unit_raw: 'g/dL', ref_text: '12.0 - 15.5', confidence: 0.98 },
      { result_key: 'R2', test_name_raw: 'Serum Ferritin', value_raw: '28', unit_raw: 'ng/mL', ref_text: '15 - 150', confidence: 0.97 },
      { result_key: 'R3', test_name_raw: 'S. Creatinine', value_raw: '1.0', unit_raw: 'mg/dL', ref_text: '0.6 - 1.1', confidence: 0.99 },
      { result_key: 'R4', test_name_raw: 'Fasting Blood Sugar', value_raw: '108', unit_raw: 'mg/dL', ref_text: '70 - 99', confidence: 0.96 },
      { result_key: 'R5', test_name_raw: 'HbA1c', value_raw: '6.1', unit_raw: '%', ref_text: '4.0 - 5.6', confidence: 0.98 },
      { result_key: 'R6', test_name_raw: 'Serum Potassium', value_raw: '4.3', unit_raw: 'mEq/L', ref_text: '3.5 - 5.1', confidence: 0.99 },
      { result_key: 'R7', test_name_raw: 'ALT (SGPT)', value_raw: '24', unit_raw: 'U/L', ref_text: '7 - 35', confidence: 0.97 },
    ],
  },
  {
    id: 'visit-2-followup',
    title: '6-Month Follow-Up Biochemistry & Iron Panel',
    visit_date: '2026-07-20',
    lab_name: 'SYNTHETIC DIAGNOSTICS LAB (DEMO ONLY)',
    patient_name_synthetic: 'A. Kumar (Synthetic)',
    patient_id_synthetic: 'SYN-2026-0412',
    patient_phone_synthetic: '+91 90000 00001',
    doctor_name_synthetic: 'Dr. M. Rao (Synthetic)',
    patient_age_sex: '54Y / F',
    rows: [
      { result_key: 'R1', test_name_raw: 'Haemoglobin (Hb)', value_raw: '11.2', unit_raw: 'g/dL', ref_text: '12.0 - 15.5', confidence: 0.98 },
      { result_key: 'R2', test_name_raw: 'Serum Ferritin', value_raw: '13', unit_raw: 'ng/mL', ref_text: '15 - 150', confidence: 0.96 },
      { result_key: 'R3', test_name_raw: 'S. Creatinine', value_raw: '1.3', unit_raw: 'mg/dL', ref_text: '0.6 - 1.1', confidence: 0.97 },
      { result_key: 'R4', test_name_raw: 'Fasting Blood Sugar', value_raw: '132', unit_raw: 'mg/dL', ref_text: '70 - 99', confidence: 0.98 },
      { result_key: 'R5', test_name_raw: 'HbA1c', value_raw: '6.8', unit_raw: '%', ref_text: '4.0 - 5.6', confidence: 0.99 },
      { result_key: 'R6', test_name_raw: 'Serum Potassium', value_raw: '4.7', unit_raw: 'mEq/L', ref_text: '3.5 - 5.1', confidence: 0.98 },
      { result_key: 'R7', test_name_raw: 'ALT (SGPT)', value_raw: '29', unit_raw: 'U/L', ref_text: '7 - 35', confidence: 0.97 },
    ],
  },
  {
    id: 'visit-3-latest',
    title: 'Latest Comprehensive Renal, Iron & Sugar Panel',
    visit_date: '2026-11-18',
    lab_name: 'SYNTHETIC DIAGNOSTICS LAB (DEMO ONLY)',
    patient_name_synthetic: 'A. Kumar (Synthetic)',
    patient_id_synthetic: 'SYN-2026-0412',
    patient_phone_synthetic: '+91 90000 00001',
    doctor_name_synthetic: 'Dr. M. Rao (Synthetic)',
    patient_age_sex: '54Y / F',
    rows: [
      { result_key: 'R1', test_name_raw: 'Haemoglobin (Hb)', value_raw: '9.8', unit_raw: 'g/dL', ref_text: '12.0 - 15.5', confidence: 0.98 },
      { result_key: 'R2', test_name_raw: 'Serum Ferritin', value_raw: '9', unit_raw: 'ng/mL', ref_text: '15 - 150', confidence: 0.95 },
      { result_key: 'R3', test_name_raw: 'S. Creatinine', value_raw: '1.8', unit_raw: 'mg/dL', ref_text: '0.6 - 1.1', confidence: 0.72 },
      { result_key: 'R4', test_name_raw: 'Fasting Blood Sugar', value_raw: '154', unit_raw: 'mg/dL', ref_text: '70 - 99', confidence: 0.97 },
      { result_key: 'R5', test_name_raw: 'HbA1c', value_raw: '7.4', unit_raw: '%', ref_text: '4.0 - 5.6', confidence: 0.96 },
      { result_key: 'R6', test_name_raw: 'Serum Potassium', value_raw: '4.9', unit_raw: 'mEq/L', ref_text: '3.5 - 5.1', confidence: 0.99 },
      { result_key: 'R7', test_name_raw: 'ALT (SGPT)', value_raw: '28', unit_raw: 'U/L', ref_text: '7 - 35', confidence: 0.98 },
      { result_key: 'R8', test_name_raw: 'Vitamin B12', value_raw: '410', unit_raw: 'pg/mL', ref_text: '200 - 900', confidence: 0.97 },
    ],
  },
  {
    id: 'preset-critical-demo',
    title: 'Urgent Electrolyte & Hemoglobin Check (Synthetic Critical)',
    visit_date: '2026-11-24',
    lab_name: 'SYNTHETIC DIAGNOSTICS LAB (DEMO ONLY)',
    patient_name_synthetic: 'R. Verma (Synthetic)',
    patient_id_synthetic: 'SYN-2026-0991',
    patient_phone_synthetic: '+91 90000 00099',
    doctor_name_synthetic: 'Dr. S. Nair (Synthetic)',
    patient_age_sex: '62Y / M',
    rows: [
      { result_key: 'R1', test_name_raw: 'Haemoglobin (Hb)', value_raw: '6.6', unit_raw: 'g/dL', ref_text: '13.5 - 17.5', confidence: 0.97 },
      { result_key: 'R2', test_name_raw: 'Serum Potassium', value_raw: '6.4', unit_raw: 'mEq/L', ref_text: '3.5 - 5.1', confidence: 0.98 },
      { result_key: 'R3', test_name_raw: 'S. Creatinine', value_raw: '2.4', unit_raw: 'mg/dL', ref_text: '0.7 - 1.3', confidence: 0.96 },
      { result_key: 'R4', test_name_raw: 'Serum Albumin', value_raw: '3.0', unit_raw: 'g/dL', ref_text: '3.5 - 5.0', confidence: 0.95 },
      { result_key: 'R5', test_name_raw: 'ALT (SGPT)', value_raw: '62', unit_raw: 'U/L', ref_text: '7 - 40', confidence: 0.96 },
    ],
  },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSyntheticReportAssets(
  preset: SyntheticReportPreset,
  results: LabResultItem[],
): { original_image_url: string; masked_image_url: string; pii_masks: PiiMaskBox[]; rowBboxes: Record<string, BoundingBox> } {
  const piiMasks: PiiMaskBox[] = [
    { id: 'pii-name', label: 'Patient Name', bbox: [56, 132, 390, 170] },
    { id: 'pii-id', label: 'Patient ID', bbox: [56, 174, 340, 206] },
    { id: 'pii-phone', label: 'Phone Number', bbox: [440, 132, 820, 170] },
    { id: 'pii-doctor', label: 'Referring Doctor', bbox: [440, 174, 820, 206] },
    { id: 'pii-barcode', label: 'Barcode', bbox: [680, 44, 844, 102] },
  ];

  const tableStartY = 330;
  const rowHeight = 68;
  const rowBboxes: Record<string, BoundingBox> = {};

  results.forEach((row, index) => {
    const y1 = tableStartY + index * rowHeight;
    const y2 = y1 + rowHeight - 8;
    rowBboxes[row.result_key] = [48, y1, 852, y2];
  });

  const renderSvg = (masked: boolean): string => {
    const rowsMarkup = results
      .map((row, idx) => {
        const y = tableStartY + idx * rowHeight;
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        const isLowConf = row.confidence < 0.85 && !row.user_confirmed;
        const flagColor =
          row.flag === 'critical'
            ? '#b91c1c'
            : row.flag === 'high' || row.flag === 'low'
              ? '#b45309'
              : '#334155';
        return `
          <rect x="48" y="${y}" width="804" height="${rowHeight - 8}" fill="${bg}" stroke="#e2e8f0" stroke-width="1" />
          <text x="68" y="${y + 36}" font-family="sans-serif" font-size="16" font-weight="600" fill="#0f172a">${escapeXml(row.test_name_raw)}</text>
          <text x="68" y="${y + 52}" font-family="monospace" font-size="11" fill="#64748b">Code: ${escapeXml(row.result_key)}${isLowConf ? ' · faint print' : ''}</text>
          <text x="455" y="${y + 38}" font-family="monospace" font-size="18" font-weight="700" fill="${flagColor}" ${isLowConf ? 'opacity="0.72"' : ''}>${escapeXml(String(row.value))}</text>
          <text x="565" y="${y + 38}" font-family="monospace" font-size="14" fill="#475569">${escapeXml(row.unit_std)}</text>
          <text x="685" y="${y + 38}" font-family="monospace" font-size="14" fill="#334155">${escapeXml(row.ref_text || 'Not listed')}</text>
        `;
      })
      .join('');

    const maskOverlay = masked
      ? piiMasks
          .map(
            (m) => `
          <rect x="${m.bbox[0]}" y="${m.bbox[1]}" width="${m.bbox[2] - m.bbox[0]}" height="${m.bbox[3] - m.bbox[1]}" rx="4" fill="#0f172a" />
          <text x="${m.bbox[0] + 10}" y="${m.bbox[1] + 22}" font-family="monospace" font-size="12" font-weight="600" fill="#e2e8f0">[MASKED: ${escapeXml(m.label.toUpperCase())}]</text>
        `,
          )
          .join('')
      : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
      <rect width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" fill="#ffffff" />
      <rect x="28" y="24" width="844" height="1112" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Lab Header -->
      <rect x="28" y="24" width="844" height="92" fill="#f1f5f9" />
      <text x="56" y="64" font-family="sans-serif" font-size="22" font-weight="700" fill="#0f172a">${escapeXml(preset.lab_name)}</text>
      <text x="56" y="90" font-family="monospace" font-size="12" fill="#475569">ACCREDITED CLINICAL PATHOLOGY · SYNTHETIC TEST RECORD</text>
      
      <!-- Barcode -->
      <g>
        <rect x="684" y="46" width="156" height="52" fill="#ffffff" stroke="#cbd5e1" />
        <rect x="698" y="54" width="4" height="28" fill="#0f172a" />
        <rect x="706" y="54" width="2" height="28" fill="#0f172a" />
        <rect x="712" y="54" width="6" height="28" fill="#0f172a" />
        <rect x="723" y="54" width="3" height="28" fill="#0f172a" />
        <rect x="731" y="54" width="5" height="28" fill="#0f172a" />
        <rect x="742" y="54" width="2" height="28" fill="#0f172a" />
        <rect x="749" y="54" width="6" height="28" fill="#0f172a" />
        <rect x="760" y="54" width="3" height="28" fill="#0f172a" />
        <rect x="769" y="54" width="5" height="28" fill="#0f172a" />
        <rect x="779" y="54" width="2" height="28" fill="#0f172a" />
        <rect x="786" y="54" width="6" height="28" fill="#0f172a" />
        <rect x="798" y="54" width="4" height="28" fill="#0f172a" />
        <rect x="807" y="54" width="3" height="28" fill="#0f172a" />
        <rect x="815" y="54" width="5" height="28" fill="#0f172a" />
        <text x="715" y="94" font-family="monospace" font-size="10" fill="#475569">${escapeXml(preset.patient_id_synthetic)}</text>
      </g>

      <!-- Patient Metadata Block (PII Zone) -->
      <rect x="48" y="128" width="804" height="122" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1" />
      <text x="64" y="156" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Name:</tspan> ${escapeXml(preset.patient_name_synthetic)}</text>
      <text x="64" y="194" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Patient ID:</tspan> ${escapeXml(preset.patient_id_synthetic)}</text>
      <text x="64" y="232" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Age / Sex:</tspan> ${escapeXml(preset.patient_age_sex)}</text>
      
      <text x="450" y="156" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Mobile:</tspan> ${escapeXml(preset.patient_phone_synthetic)}</text>
      <text x="450" y="194" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Ref. By:</tspan> ${escapeXml(preset.doctor_name_synthetic)}</text>
      <text x="450" y="232" font-family="sans-serif" font-size="14" fill="#334155"><tspan font-weight="700">Visit Date:</tspan> ${escapeXml(preset.visit_date)}</text>

      <!-- Results Table Header -->
      <rect x="48" y="278" width="804" height="44" fill="#0f172a" />
      <text x="68" y="305" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">TEST INVESTIGATION</text>
      <text x="455" y="305" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">RESULT</text>
      <text x="565" y="305" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">UNIT</text>
      <text x="685" y="305" font-family="sans-serif" font-size="13" font-weight="700" fill="#ffffff">REFERENCE RANGE</text>

      ${rowsMarkup}

      <!-- Footer -->
      <line x1="48" y1="1030" x2="852" y2="1030" stroke="#cbd5e1" stroke-width="1" />
      <text x="56" y="1062" font-family="sans-serif" font-size="12" fill="#64748b">End of Synthetic Lab Report · Reference ranges printed on this report govern deterministic flagging.</text>
      <text x="56" y="1084" font-family="monospace" font-size="11" fill="#94a3b8">No real patient data. Generated for MedReport-Guard verification.</text>

      ${maskOverlay}
    </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };

  return {
    original_image_url: renderSvg(false),
    masked_image_url: renderSvg(true),
    pii_masks: piiMasks,
    rowBboxes,
  };
}

export function buildSyntheticReportRecord(
  preset: SyntheticReportPreset,
  userId: string,
  rules: RulesBundle,
  reportId?: string,
): ReportRecord {
  const id = reportId || `rep-${preset.id}`;
  const rawResults: LabResultItem[] = preset.rows.map((row, idx) => {
    const stdName = normalizeTestName(row.test_name_raw, rules.test_aliases);
    const parsedRange = parseReferenceRange(row.ref_text);
    const numericVal = Number.parseFloat(row.value_raw);
    const y1 = 330 + idx * 68;
    const y2 = y1 + 60;
    return {
      id: `${id}-${row.result_key}`,
      result_key: row.result_key,
      test_name_raw: row.test_name_raw,
      test_name_std: stdName,
      display_name: getDisplayName(stdName, row.test_name_raw),
      value: Number.isFinite(numericVal) ? numericVal : 0,
      value_raw: row.value_raw,
      unit_raw: row.unit_raw,
      unit_std: row.unit_raw,
      ref_low: parsedRange.ref_low,
      ref_high: parsedRange.ref_high,
      ref_text: row.ref_text,
      flag: 'unknown',
      confidence: row.confidence,
      needs_confirmation: row.confidence < 0.85,
      user_confirmed: false,
      page: 1,
      bbox: [48, y1, 852, y2],
    };
  });

  const flaggedResults = applyRuleChecker(rawResults, rules);
  const safety = runComorbiditySafetyFilter(flaggedResults, rules.conflict_rules);
  const assets = buildSyntheticReportAssets(preset, flaggedResults);

  const summaryEn = buildTemplateSummary(flaggedResults, safety, 'en', rules.version, 1);
  summaryEn.used_fallback = false;
  summaryEn.verifier_log.used_fallback = false;
  const summaryTa = buildTemplateSummary(flaggedResults, safety, 'ta', rules.version, 1);
  summaryTa.used_fallback = false;
  summaryTa.verifier_log.used_fallback = false;
  const summaryHi = buildTemplateSummary(flaggedResults, safety, 'hi', rules.version, 1);
  summaryHi.used_fallback = false;
  summaryHi.verifier_log.used_fallback = false;

  const needsConfirmation = flaggedResults.some((r) => r.needs_confirmation && !r.user_confirmed);

  return {
    id,
    user_id: userId,
    title: preset.title,
    lab_name_masked: 'Verified Diagnostics Laboratory',
    visit_date: preset.visit_date,
    patient_age_sex: preset.patient_age_sex,
    status: needsConfirmation ? 'needs_confirmation' : 'done',
    quality_check: {
      passed: true,
      score: 94,
      blur_score: 412,
      brightness_score: 215,
    },
    page_width: PAGE_WIDTH,
    page_height: PAGE_HEIGHT,
    original_image_url: assets.original_image_url,
    masked_image_url: assets.masked_image_url,
    pii_masks: assets.pii_masks,
    results: flaggedResults,
    safety_hits: safety.hits,
    blocked_items: safety.blocked_items,
    summaries: {
      en: summaryEn,
      ta: summaryTa,
      hi: summaryHi,
    },
    created_at: `${preset.visit_date}T09:30:00.000Z`,
  };
}
