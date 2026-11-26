import type { ConflictRule, LabResultItem, SafetyHit } from '../types/medreport';

export interface SafetyFilterOutput {
  hits: SafetyHit[];
  blocked_items: string[];
  blocked_synonyms: string[];
  safe_messages: string[];
}

export function runComorbiditySafetyFilter(
  results: LabResultItem[],
  conflictRules: ConflictRule[],
): SafetyFilterOutput {
  const hits: SafetyHit[] = [];
  const blockedItemsSet = new Set<string>();
  const blockedSynonymsSet = new Set<string>();
  const safeMessages: string[] = [];

  for (const rule of conflictRules) {
    const matchedTestKeys: string[] = [];
    let allConditionsMet = true;

    for (const condition of rule.if_all) {
      const matchingResults = results.filter(
        (res) =>
          condition.any_tests.includes(res.test_name_std) &&
          condition.flags.includes(res.flag),
      );

      if (matchingResults.length === 0) {
        allConditionsMet = false;
        break;
      }

      for (const m of matchingResults) {
        // Extra safety for C1 / C6: eGFR is abnormal when low, creatinine when high
        if (m.test_name_std === 'egfr' && m.flag === 'high') {
          continue;
        }
        if (m.test_name_std === 'creatinine' && m.flag === 'low') {
          continue;
        }
        matchedTestKeys.push(`${m.display_name} (${m.flag})`);
      }

      if (matchedTestKeys.length === 0) {
        allConditionsMet = false;
        break;
      }
    }

    // Re-verify each clause actually has a clinically valid match (e.g. eGFR low or creatinine high)
    if (allConditionsMet) {
      const validClauses = rule.if_all.every((condition) =>
        results.some((res) => {
          if (!condition.any_tests.includes(res.test_name_std)) return false;
          if (!condition.flags.includes(res.flag)) return false;
          if (res.test_name_std === 'egfr' && res.flag === 'high') return false;
          if (res.test_name_std === 'creatinine' && res.flag === 'low') return false;
          return true;
        }),
      );

      if (!validClauses) {
        continue;
      }

      const uniqueMatches = Array.from(new Set(matchedTestKeys));
      hits.push({
        rule_id: rule.id,
        title: rule.title,
        severity: rule.severity,
        matched_tests: uniqueMatches,
        blocked_items: [...rule.blocked_items],
        safe_message: rule.safe_message,
        clinical_review_note: rule.illustrativeNeedsClinicalReview
          ? 'Illustrative prototype safety rule — requires clinical sign-off before clinical deployment.'
          : 'Clinically reviewed rule.',
      });

      for (const item of rule.blocked_items) {
        blockedItemsSet.add(item);
      }
      for (const syn of rule.blocked_synonyms) {
        blockedSynonymsSet.add(syn.toLowerCase());
      }
      safeMessages.push(rule.safe_message);
    }
  }

  return {
    hits,
    blocked_items: Array.from(blockedItemsSet),
    blocked_synonyms: Array.from(blockedSynonymsSet),
    safe_messages: safeMessages,
  };
}
