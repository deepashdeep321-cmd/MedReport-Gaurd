import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultRulesBundle, MANDATORY_DISCLAIMER } from './rulesData';
import { convertUnit, normalizeTestName, parseReferenceRange } from './normalize';
import { applyRuleChecker, evaluateResultFlag } from './rules';
import { runComorbiditySafetyFilter } from './safetyFilter';
import { verifySummary, verifyTranslationNumbers } from './verifier';
import { buildTemplateSummary } from './templates';
import { buildSyntheticReportRecord, SYNTHETIC_PRESETS } from './syntheticReports';
import type { LabResultItem, SummarySentence } from '../types/medreport';

const rules = createDefaultRulesBundle();

test('normalize: maps common lab aliases to canonical test names', () => {
  assert.equal(normalizeTestName('Hb', rules.test_aliases), 'hemoglobin');
  assert.equal(normalizeTestName('Haemoglobin', rules.test_aliases), 'hemoglobin');
  assert.equal(normalizeTestName('S. Creatinine', rules.test_aliases), 'creatinine');
  assert.equal(normalizeTestName('Fasting Blood Sugar', rules.test_aliases), 'glucose_fasting');
  assert.equal(normalizeTestName('ALT (SGPT)', rules.test_aliases), 'alt');
});

test('normalize: parses printed reference ranges accurately', () => {
  assert.deepEqual(parseReferenceRange('13.5 - 17.5'), { ref_low: 13.5, ref_high: 17.5 });
  assert.deepEqual(parseReferenceRange('(0.7 - 1.2)'), { ref_low: 0.7, ref_high: 1.2 });
  assert.deepEqual(parseReferenceRange('< 200'), { ref_low: null, ref_high: 200 });
  assert.deepEqual(parseReferenceRange('> 40'), { ref_low: 40, ref_high: null });
  assert.deepEqual(parseReferenceRange(''), { ref_low: null, ref_high: null });
});

test('normalize: converts SI units using unit_conversions', () => {
  const glu = convertUnit('glucose_fasting', 7.0, 'mmol/L', rules);
  assert.equal(glu.unit_std, 'mg/dL');
  assert.equal(glu.converted, true);
  assert.ok(glu.value > 125 && glu.value < 127);

  const hb = convertUnit('hemoglobin', 135, 'g/L', rules);
  assert.equal(hb.unit_std, 'g/dL');
  assert.equal(hb.value, 13.5);
});

test('rules: flags values strictly against report reference range and critical limits', () => {
  assert.equal(
    evaluateResultFlag(
      { test_name_std: 'hemoglobin', value: 14.2, unit_std: 'g/dL', ref_low: 13.5, ref_high: 17.5 },
      rules.critical_limits,
    ),
    'normal',
  );
  assert.equal(
    evaluateResultFlag(
      { test_name_std: 'hemoglobin', value: 9.8, unit_std: 'g/dL', ref_low: 12.0, ref_high: 15.5 },
      rules.critical_limits,
    ),
    'low',
  );
  assert.equal(
    evaluateResultFlag(
      { test_name_std: 'hemoglobin', value: 6.5, unit_std: 'g/dL', ref_low: 12.0, ref_high: 15.5 },
      rules.critical_limits,
    ),
    'critical',
  );
  assert.equal(
    evaluateResultFlag(
      { test_name_std: 'creatinine', value: 1.8, unit_raw: 'mg/dL', unit_std: 'mg/dL', ref_low: 0.6, ref_high: 1.1 } as never,
      rules.critical_limits,
    ),
    'high',
  );
  assert.equal(
    evaluateResultFlag(
      { test_name_std: 'tsh', value: 2.5, unit_std: 'mIU/L', ref_low: null, ref_high: null },
      rules.critical_limits,
    ),
    'unknown',
  );
});

test('safety_filter: fires C1 and C2 when iron low + creatinine high + glucose high', () => {
  const sample = buildSyntheticReportRecord(SYNTHETIC_PRESETS[2], 'demo-user', rules);
  const hitIds = sample.safety_hits.map((h) => h.rule_id);
  assert.ok(hitIds.includes('C1'), 'Expected C1 (low iron/Hb + high creatinine) to fire');
  assert.ok(hitIds.includes('C2'), 'Expected C2 (low Hb + high sugar/HbA1c) to fire');
  assert.ok(sample.blocked_items.includes('spinach'));
  assert.ok(sample.blocked_items.includes('jaggery'));
});

test('safety_filter: fires C4 and C7 on liver + kidney + protein + deficiency profile', () => {
  const sample = buildSyntheticReportRecord(SYNTHETIC_PRESETS[3], 'demo-user', rules);
  const hitIds = sample.safety_hits.map((h) => h.rule_id);
  assert.ok(hitIds.includes('C4'), 'Expected C4 (raised ALT + deficiency) to fire');
  assert.ok(hitIds.includes('C7'), 'Expected C7 (high creatinine + low albumin) to fire');
});

test('verifier: passes deterministic templates in English, Tamil, and Hindi', () => {
  const sample = buildSyntheticReportRecord(SYNTHETIC_PRESETS[2], 'demo-user', rules);
  const safety = runComorbiditySafetyFilter(sample.results, rules.conflict_rules);

  for (const lang of ['en', 'ta', 'hi'] as const) {
    const summary = buildTemplateSummary(sample.results, safety, lang, rules.version);
    assert.equal(summary.verifier_log.passed, true, `Template failed verifier in ${lang}: ${JSON.stringify(summary.verifier_log.checks)}`);
    assert.ok(summary.sentences.some((s) => s.sentence.includes(MANDATORY_DISCLAIMER[lang])));
  }
});

test('verifier: rejects adversarial outputs (V1 wrong number, V2 wrong flag, V3 blocked food, V4 diagnosis, V5 medicine, V6 missing critical urgent prompt, V8 missing disclaimer)', () => {
  const results: LabResultItem[] = applyRuleChecker(
    [
      {
        id: '1',
        result_key: 'R1',
        test_name_raw: 'Hemoglobin',
        test_name_std: 'hemoglobin',
        display_name: 'Hemoglobin',
        value: 6.6,
        value_raw: '6.6',
        unit_raw: 'g/dL',
        unit_std: 'g/dL',
        ref_low: 12.0,
        ref_high: 15.5,
        ref_text: '12.0 - 15.5',
        flag: 'unknown',
        confidence: 0.99,
        needs_confirmation: false,
        user_confirmed: true,
        page: 1,
        bbox: [0, 0, 100, 20],
      },
      {
        id: '2',
        result_key: 'R2',
        test_name_raw: 'Creatinine',
        test_name_std: 'creatinine',
        display_name: 'Serum Creatinine',
        value: 2.1,
        value_raw: '2.1',
        unit_raw: 'mg/dL',
        unit_std: 'mg/dL',
        ref_low: 0.6,
        ref_high: 1.1,
        ref_text: '0.6 - 1.1',
        flag: 'unknown',
        confidence: 0.99,
        needs_confirmation: false,
        user_confirmed: true,
        page: 1,
        bbox: [0, 30, 100, 50],
      },
    ],
    rules,
  );
  const safety = runComorbiditySafetyFilter(results, rules.conflict_rules);

  const adversarial: SummarySentence[] = [
    {
      // Wrong number (99.5), diagnosis ("you have anemia"), blocked food ("spinach"), medicine ("iron tablet 500mg"), flag contradiction ("looks normal")
      sentence: 'Your Hemoglobin is 99.5 g/dL which looks normal, but you have anemia so eat spinach and take metformin 500mg. [R1]',
      evidence_result_keys: ['R1'],
      section: 'needs_attention',
      check_ids: [],
    },
  ];

  const log = verifySummary(adversarial, results, safety, 'en');
  assert.equal(log.passed, false);
  const byId = Object.fromEntries(log.checks.map((c) => [c.id, c.passed]));
  assert.equal(byId.V1, false, 'V1 should reject hallucinated 99.5');
  assert.equal(byId.V2, false, 'V2 should reject "looks normal" on critical hemoglobin');
  assert.equal(byId.V3, false, 'V3 should reject blocked food "spinach"');
  assert.equal(byId.V4, false, 'V4 should reject diagnosis "you have anemia"');
  assert.equal(byId.V5, false, 'V5 should reject medicine "metformin 500mg"');
  assert.equal(byId.V6, false, 'V6 should reject missing R2 citation and missing urgent critical message');
  assert.equal(byId.V8, false, 'V8 should reject missing mandatory disclaimer');
});

test('verifier: detects altered numbers during translation', () => {
  const src: SummarySentence[] = [
    { sentence: 'Your Hemoglobin is 9.8 g/dL (range 12.0 to 15.5). [R1]', evidence_result_keys: ['R1'], section: 'needs_attention', check_ids: [] },
  ];
  const goodTa: SummarySentence[] = [
    { sentence: 'உங்கள் ஹீமோகுளோபின் 9.8 g/dL (வரம்பு 12.0 முதல் 15.5). [R1]', evidence_result_keys: ['R1'], section: 'needs_attention', check_ids: [] },
  ];
  const badTa: SummarySentence[] = [
    { sentence: 'உங்கள் ஹீமோகுளோபின் 19.8 g/dL (வரம்பு 12.0 முதல் 15.5). [R1]', evidence_result_keys: ['R1'], section: 'needs_attention', check_ids: [] },
  ];

  assert.equal(verifyTranslationNumbers(src, goodTa), true);
  assert.equal(verifyTranslationNumbers(src, badTa), false);
});
