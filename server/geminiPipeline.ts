import { GoogleGenAI, Type } from '@google/genai';
import type {
  BoundingBox,
  LabResultItem,
  LanguageCode,
  LocalizedSummary,
  RulesBundle,
  SummarySentence,
} from '../src/types/medreport';
import {
  convertUnit,
  getDisplayName,
  normalizeTestName,
  parseReferenceRange,
} from '../src/pipeline/normalize';
import { applyRuleChecker } from '../src/pipeline/rules';
import { MANDATORY_DISCLAIMER } from '../src/pipeline/rulesData';
import type { SafetyFilterOutput } from '../src/pipeline/safetyFilter';
import { buildTemplateSummary } from '../src/pipeline/templates';
import { verifySummary, verifyTranslationNumbers } from '../src/pipeline/verifier';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ExtractedRowCandidate {
  test_name_raw: string;
  value_raw: string;
  unit_raw: string;
  ref_text: string;
  confidence: number;
  bbox_norm: [number, number, number, number]; // [x1, y1, x2, y2] in 0..1000
}

/**
 * Extracts structured lab results ONLY from a PII-masked image.
 * The unmasked original image is never sent to Gemini.
 */
export async function extractResultsFromMaskedImage(
  maskedDataUrl: string,
  width: number,
  height: number,
  rules: RulesBundle,
  reportId: string,
): Promise<LabResultItem[]> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured for live image extraction.');
  }

  const match = maskedDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Uploaded image must be a valid base64 image data URL.');
  }
  const [, mimeType, base64Data] = match;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text:
            'Extract all clinical laboratory test result rows from this PII-masked medical lab report image. ' +
            'Ignore any blacked-out masked header boxes. For each test row, return test_name_raw, value_raw (numeric string), ' +
            'unit_raw, ref_text (exact printed reference range on the report, or empty string if none), confidence (0.0 to 1.0), ' +
            'and bbox_norm as [x1, y1, x2, y2] normalized on a 0-1000 scale covering the row.',
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            test_name_raw: { type: Type.STRING },
            value_raw: { type: Type.STRING },
            unit_raw: { type: Type.STRING },
            ref_text: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            bbox_norm: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
            },
          },
        },
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as ExtractedRowCandidate[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return [];
  }

  const items: LabResultItem[] = [];
  parsed.forEach((row, idx) => {
    const numericVal = Number.parseFloat(String(row.value_raw ?? '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(numericVal)) return;

    const resultKey = `R${items.length + 1}`;
    const stdName = normalizeTestName(row.test_name_raw || `test_${idx + 1}`, rules.test_aliases);
    const unitConverted = convertUnit(stdName, numericVal, row.unit_raw || '', rules);
    const parsedRange = parseReferenceRange(row.ref_text || '');
    const confidence = Math.max(0.1, Math.min(1, Number(row.confidence ?? 0.9)));

    const bn = Array.isArray(row.bbox_norm) && row.bbox_norm.length === 4 ? row.bbox_norm : [60, 260 + idx * 65, 940, 315 + idx * 65];
    const bbox: BoundingBox = [
      Math.round((Math.max(0, Math.min(1000, bn[0])) / 1000) * width),
      Math.round((Math.max(0, Math.min(1000, bn[1])) / 1000) * height),
      Math.round((Math.max(0, Math.min(1000, bn[2])) / 1000) * width),
      Math.round((Math.max(0, Math.min(1000, bn[3])) / 1000) * height),
    ];

    items.push({
      id: `${reportId}-${resultKey}`,
      result_key: resultKey,
      test_name_raw: row.test_name_raw || stdName,
      test_name_std: stdName,
      display_name: getDisplayName(stdName, row.test_name_raw || stdName),
      value: unitConverted.value,
      value_raw: String(row.value_raw),
      unit_raw: row.unit_raw || '',
      unit_std: unitConverted.unit_std,
      ref_low: parsedRange.ref_low,
      ref_high: parsedRange.ref_high,
      ref_text: row.ref_text || '',
      flag: 'unknown',
      confidence,
      needs_confirmation: confidence < 0.85,
      user_confirmed: false,
      page: 1,
      bbox,
    });
  });

  return applyRuleChecker(items, rules);
}

/**
 * Generates plain-language verified summaries from ONLY masked structured data.
 * Runs deterministic Output Verifier (V1-V8) up to 3 attempts (1 initial + 2 retries),
 * then falls back to deterministic templates if any check fails or LLM is unavailable.
 */
export async function generateVerifiedSummaries(
  results: LabResultItem[],
  safety: SafetyFilterOutput,
  ageSex: string,
  rulesVersion: string,
  useLlm: boolean = true,
): Promise<Record<LanguageCode, LocalizedSummary>> {
  const ai = useLlm ? getGeminiClient() : null;
  if (!ai) {
    return {
      en: buildTemplateSummary(results, safety, 'en', rulesVersion, 1),
      ta: buildTemplateSummary(results, safety, 'ta', rulesVersion, 1),
      hi: buildTemplateSummary(results, safety, 'hi', rulesVersion, 1),
    };
  }

  const structuredPayload = {
    masked_demographics: ageSex,
    results: results.map((r) => ({
      result_key: r.result_key,
      name: r.display_name,
      value: r.value,
      unit: r.unit_std,
      printed_range: r.ref_text || 'not printed',
      flag: r.flag,
    })),
    blocked_items_never_mention_as_advice: safety.blocked_items,
    safety_notes_to_include: safety.safe_messages,
    mandatory_disclaimer: MANDATORY_DISCLAIMER.en,
  };

  let approvedEn: LocalizedSummary | null = null;
  let lastFailureReasons = '';

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const prompt = [
        'Write a short, calm, 6th-grade reading level health report explanation using ONLY the verified structured JSON below.',
        'Strict safety rules:',
        '1. NEVER invent or change any number. Every number must match the exact value or printed_range in the cited result.',
        '2. NEVER diagnose a disease (do NOT say "you have", "anemia", "diabetes", "kidney disease", etc.).',
        '3. NEVER mention medicine names, pills, tablets, or dosages.',
        '4. NEVER suggest any item in blocked_items_never_mention_as_advice.',
        '5. Write one short sentence per result, ending with its evidence tag like [R1].',
        '6. Use section="needs_attention" for low/high/critical results (if critical, explicitly say "Please see a doctor now.").',
        '7. Use section="looks_normal" for normal results, section="ask_doctor" for unknown range results and a final doctor reminder, and section="safety_note" for each item in safety_notes_to_include.',
        '8. Include a final sentence with section="disclaimer" containing the exact mandatory_disclaimer string verbatim.',
        lastFailureReasons ? `Previous attempt failed verification for these reasons (fix all of them): ${lastFailureReasons}` : '',
        `Verified JSON:\n${JSON.stringify(structuredPayload, null, 2)}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sentence: { type: Type.STRING },
                evidence_result_keys: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                section: { type: Type.STRING },
              },
            },
          },
        },
      });

      const raw = (response.text ?? '[]').trim();
      const parsed = JSON.parse(raw) as Array<{
        sentence: string;
        evidence_result_keys?: string[];
        section?: string;
      }>;

      const validSections = new Set(['needs_attention', 'looks_normal', 'ask_doctor', 'safety_note', 'disclaimer']);
      const normalizedSentences: SummarySentence[] = parsed
        .filter((item) => item && typeof item.sentence === 'string' && item.sentence.trim().length > 0)
        .map((item) => ({
          sentence: item.sentence.trim(),
          evidence_result_keys: Array.isArray(item.evidence_result_keys) ? item.evidence_result_keys : [],
          section: (validSections.has(String(item.section)) ? item.section : 'ask_doctor') as SummarySentence['section'],
          check_ids: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'],
        }));

      const log = verifySummary(normalizedSentences, results, safety, 'en');
      log.attempts = attempt;
      if (log.passed) {
        approvedEn = {
          language: 'en',
          sentences: normalizedSentences,
          used_fallback: false,
          verifier_log: log,
          rules_version: rulesVersion,
          disclaimer: MANDATORY_DISCLAIMER.en,
        };
        break;
      }

      lastFailureReasons = log.checks
        .filter((c) => !c.passed)
        .map((c) => `${c.id}: ${c.reason}`)
        .join('; ');
    } catch {
      lastFailureReasons = 'Model response could not be parsed as valid JSON.';
    }
  }

  const finalEn = approvedEn || buildTemplateSummary(results, safety, 'en', rulesVersion, 3);

  // Translate verified English sentences to Tamil & Hindi with strict V1 number-preservation verification
  const [summaryTa, summaryHi] = await Promise.all([
    translateWithNumberCheck(ai, finalEn, results, safety, 'ta', rulesVersion),
    translateWithNumberCheck(ai, finalEn, results, safety, 'hi', rulesVersion),
  ]);

  return {
    en: finalEn,
    ta: summaryTa,
    hi: summaryHi,
  };
}

async function translateWithNumberCheck(
  ai: GoogleGenAI,
  sourceEn: LocalizedSummary,
  results: LabResultItem[],
  safety: SafetyFilterOutput,
  targetLang: 'ta' | 'hi',
  rulesVersion: string,
): Promise<LocalizedSummary> {
  const langLabel = targetLang === 'ta' ? 'Tamil' : 'Hindi';
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents:
        `Translate the following verified medical summary sentences into simple, natural ${langLabel}. ` +
        `CRITICAL: Keep EVERY number, unit (e.g. g/dL, mg/dL, %), and evidence tag ([R1], [R2], etc.) IDENTICAL using Arabic numerals (0-9). ` +
        `For the disclaimer sentence, use this exact string verbatim: "${MANDATORY_DISCLAIMER[targetLang]}".\n` +
        JSON.stringify(
          sourceEn.sentences.map((s) => ({
            sentence: s.sentence,
            evidence_result_keys: s.evidence_result_keys,
            section: s.section,
          })),
        ),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              sentence: { type: Type.STRING },
              evidence_result_keys: { type: Type.ARRAY, items: { type: Type.STRING } },
              section: { type: Type.STRING },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '[]').trim()) as Array<{
      sentence: string;
      evidence_result_keys?: string[];
      section?: string;
    }>;

    const translated: SummarySentence[] = parsed.map((item, idx) => ({
      sentence:
        sourceEn.sentences[idx]?.section === 'disclaimer'
          ? MANDATORY_DISCLAIMER[targetLang]
          : String(item.sentence || '').trim(),
      evidence_result_keys: sourceEn.sentences[idx]?.evidence_result_keys || [],
      section: sourceEn.sentences[idx]?.section || 'ask_doctor',
      check_ids: ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8'],
    }));

    const numbersIntact = verifyTranslationNumbers(sourceEn.sentences, translated);
    const verifierLog = verifySummary(translated, results, safety, targetLang);
    if (numbersIntact && verifierLog.passed) {
      return {
        language: targetLang,
        sentences: translated,
        used_fallback: false,
        verifier_log: verifierLog,
        rules_version: rulesVersion,
        disclaimer: MANDATORY_DISCLAIMER[targetLang],
      };
    }
  } catch {
    // Fall back safely to verified deterministic template translation
  }

  return buildTemplateSummary(results, safety, targetLang, rulesVersion, 1);
}
