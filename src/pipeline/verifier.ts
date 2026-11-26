import type {
  FlagType,
  LabResultItem,
  LanguageCode,
  SummarySentence,
  VerifierCheckResult,
  VerifierLog,
} from '../types/medreport';
import {
  DIAGNOSIS_PATTERNS,
  MANDATORY_DISCLAIMER,
  MEDICINE_PATTERNS,
} from './rulesData';
import type { SafetyFilterOutput } from './safetyFilter';

export function extractNumbersFromText(text: string): number[] {
  // Ignore evidence tags like [R1], [R2] and test names containing numbers like B12 or HbA1c
  const sanitized = text
    .replace(/\[R\d+\]/gi, ' ')
    .replace(/\b(?:vitamin\s*b12|vit\s*b12|b12|hba1c)\b/gi, ' ');
  const matches = sanitized.match(/\b\d+(?:\.\d+)?\b/g);
  if (!matches) return [];
  return matches.map((m) => Number.parseFloat(m)).filter((n) => Number.isFinite(n));
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return 0;
  if (clean.length <= 3) return 1;
  const trimmed = clean.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function estimateFleschKincaidGrade(text: string): number {
  const cleaned = text.replace(/\[R\d+\]/gi, '').trim();
  if (!cleaned) return 0;
  const sentences = cleaned
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const words = cleaned.match(/[A-Za-z]+/g) || [];
  if (sentences.length === 0 || words.length === 0) return 0;

  let totalSyllables = 0;
  for (const w of words) {
    totalSyllables += countSyllables(w);
  }

  const wordsPerSentence = words.length / sentences.length;
  const syllablesPerWord = totalSyllables / words.length;
  const grade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;
  return Number(Math.max(0, grade).toFixed(1));
}

function getAllowedNumbersForResult(item: LabResultItem): number[] {
  const nums: number[] = [item.value];
  const parsedRaw = Number.parseFloat(item.value_raw);
  if (Number.isFinite(parsedRaw)) nums.push(parsedRaw);
  if (item.ref_low !== null) nums.push(item.ref_low);
  if (item.ref_high !== null) nums.push(item.ref_high);
  return nums;
}

function numberMatchesAllowed(candidate: number, allowed: number[]): boolean {
  return allowed.some((a) => Math.abs(a - candidate) < 0.005);
}

function checkFlagConsistency(sentence: string, flag: FlagType): boolean {
  const lower = sentence.toLowerCase();
  if (flag === 'low') {
    if (/\b(normal|within the normal range|in the normal range|looks normal|above normal|too high)\b/.test(lower)) {
      return false;
    }
  }
  if (flag === 'high') {
    if (/\b(normal|within the normal range|in the normal range|looks normal|below normal|too low)\b/.test(lower)) {
      return false;
    }
  }
  if (flag === 'normal') {
    if (/\b(too high|above the normal range|too low|below the normal range|critical|urgent)\b/.test(lower)) {
      return false;
    }
  }
  if (flag === 'critical') {
    if (/\b(normal|within the normal range|looks normal)\b/.test(lower)) {
      return false;
    }
  }
  return true;
}

export function verifySummary(
  sentences: SummarySentence[],
  results: LabResultItem[],
  safety: SafetyFilterOutput,
  language: LanguageCode = 'en',
): VerifierLog {
  const resultMap = new Map<string, LabResultItem>(results.map((r) => [r.result_key, r]));
  const allAllowedNumbers = results.flatMap(getAllowedNumbersForResult);
  const fullText = sentences.map((s) => s.sentence).join(' ');
  const checks: VerifierCheckResult[] = [];

  // V1: Numeric fidelity — every number in text must exist in allowed numbers for cited results
  let v1Passed = true;
  let v1Reason: string | undefined;
  for (const s of sentences) {
    if (s.section === 'disclaimer') continue;
    const nums = extractNumbersFromText(s.sentence);
    if (nums.length === 0) continue;

    const citedAllowed =
      s.evidence_result_keys.length > 0
        ? s.evidence_result_keys.flatMap((key) => {
            const found = resultMap.get(key);
            return found ? getAllowedNumbersForResult(found) : [];
          })
        : allAllowedNumbers;

    for (const num of nums) {
      if (!numberMatchesAllowed(num, citedAllowed)) {
        v1Passed = false;
        v1Reason = `Number ${num} not found in cited structured results (${s.evidence_result_keys.join(', ') || 'none'}).`;
        break;
      }
    }
    if (!v1Passed) break;
  }
  checks.push({ id: 'V1', name: 'Numeric fidelity', passed: v1Passed, reason: v1Reason });

  // V2: Flag consistency
  let v2Passed = true;
  let v2Reason: string | undefined;
  for (const s of sentences) {
    if (s.section === 'disclaimer' || s.section === 'safety_note') continue;
    if (s.evidence_result_keys.length === 1) {
      const target = resultMap.get(s.evidence_result_keys[0]);
      if (target && !checkFlagConsistency(s.sentence, target.flag)) {
        v2Passed = false;
        v2Reason = `Text contradicts deterministic flag "${target.flag}" for ${target.display_name}.`;
        break;
      }
    }
  }
  checks.push({ id: 'V2', name: 'Flag consistency', passed: v2Passed, reason: v2Reason });

  // V3: Blocked advice — no blocked item or synonym may appear as advice (safety warning sentences that explicitly say "avoid" are allowed)
  let v3Passed = true;
  let v3Reason: string | undefined;
  for (const s of sentences) {
    if (s.section === 'safety_note' || s.section === 'disclaimer') continue;
    const lower = s.sentence.toLowerCase();
    for (const blocked of safety.blocked_synonyms) {
      if (lower.includes(blocked)) {
        v3Passed = false;
        v3Reason = `Blocked item "${blocked}" appeared in explanation text.`;
        break;
      }
    }
    if (!v3Passed) break;
  }
  checks.push({ id: 'V3', name: 'Blocked advice guard', passed: v3Passed, reason: v3Reason });

  // V4: No diagnosis
  let v4Passed = true;
  let v4Reason: string | undefined;
  for (const s of sentences) {
    if (s.section === 'disclaimer') continue;
    for (const pattern of DIAGNOSIS_PATTERNS) {
      if (pattern.test(s.sentence)) {
        v4Passed = false;
        v4Reason = `Diagnosis language detected matching ${pattern.source}.`;
        break;
      }
    }
    if (!v4Passed) break;
  }
  checks.push({ id: 'V4', name: 'No diagnosis language', passed: v4Passed, reason: v4Reason });

  // V5: No medicine / dose
  let v5Passed = true;
  let v5Reason: string | undefined;
  for (const s of sentences) {
    if (s.section === 'disclaimer') continue;
    for (const pattern of MEDICINE_PATTERNS) {
      if (pattern.test(s.sentence)) {
        v5Passed = false;
        v5Reason = `Medicine or dose pattern detected matching ${pattern.source}.`;
        break;
      }
    }
    if (!v5Passed) break;
  }
  checks.push({ id: 'V5', name: 'No medicine or dosage', passed: v5Passed, reason: v5Reason });

  // V6: Coverage — every abnormal/critical result must be cited; critical requires urgent doctor message
  const abnormalResults = results.filter((r) => r.flag === 'low' || r.flag === 'high' || r.flag === 'critical');
  const citedKeys = new Set(sentences.flatMap((s) => s.evidence_result_keys));
  const missingAbnormal = abnormalResults.filter((r) => !citedKeys.has(r.result_key));
  const hasCritical = results.some((r) => r.flag === 'critical');
  const hasUrgentPrompt = /\b(right away|see a doctor now|urgent|immediately|right now)\b/i.test(fullText);

  let v6Passed = missingAbnormal.length === 0;
  let v6Reason: string | undefined;
  if (!v6Passed) {
    v6Reason = `Missing abnormal result citations: ${missingAbnormal.map((m) => m.result_key).join(', ')}.`;
  } else if (hasCritical && !hasUrgentPrompt) {
    v6Passed = false;
    v6Reason = 'Critical value detected without urgent "see a doctor now" prompt.';
  }
  checks.push({ id: 'V6', name: 'Abnormal & critical coverage', passed: v6Passed, reason: v6Reason });

  // V7: Readability (English Flesch-Kincaid <= 8, target ~6)
  const nonDisclaimerText = sentences
    .filter((s) => s.section !== 'disclaimer')
    .map((s) => s.sentence)
    .join(' ');
  const grade = language === 'en' ? estimateFleschKincaidGrade(nonDisclaimerText) : 6.0;
  const v7Passed = language !== 'en' || grade <= 8.5;
  checks.push({
    id: 'V7',
    name: 'Plain-language readability',
    passed: v7Passed,
    reason: v7Passed ? undefined : `Reading grade ${grade} exceeds limit (<= 8.5).`,
  });

  // V8: Mandatory disclaimer present
  const expectedDisclaimer = MANDATORY_DISCLAIMER[language];
  const v8Passed = sentences.some((s) => s.sentence.includes(expectedDisclaimer));
  checks.push({
    id: 'V8',
    name: 'Mandatory disclaimer present',
    passed: v8Passed,
    reason: v8Passed ? undefined : 'Exact required disclaimer sentence is missing.',
  });

  return {
    attempts: 1,
    passed: checks.every((c) => c.passed),
    used_fallback: false,
    readability_grade: grade,
    checks,
  };
}

export function verifyTranslationNumbers(
  sourceSentences: SummarySentence[],
  translatedSentences: SummarySentence[],
): boolean {
  if (sourceSentences.length !== translatedSentences.length) return false;
  for (let i = 0; i < sourceSentences.length; i++) {
    const srcNums = extractNumbersFromText(sourceSentences[i].sentence).sort((a, b) => a - b);
    const dstNums = extractNumbersFromText(translatedSentences[i].sentence).sort((a, b) => a - b);
    if (srcNums.length !== dstNums.length) return false;
    for (let j = 0; j < srcNums.length; j++) {
      if (Math.abs(srcNums[j] - dstNums[j]) >= 0.005) {
        return false;
      }
    }
  }
  return true;
}
