import type { CriticalLimitRule, FlagType, LabResultItem, RulesBundle } from '../types/medreport';

export interface RuleEvaluationInput {
  test_name_std: string;
  value: number;
  unit_std: string;
  ref_low: number | null;
  ref_high: number | null;
}

export function evaluateResultFlag(
  input: RuleEvaluationInput,
  criticalLimits: CriticalLimitRule[],
): FlagType {
  const critRule = criticalLimits.find(
    (rule) =>
      rule.test_name_std === input.test_name_std &&
      rule.unit_std.toLowerCase() === input.unit_std.trim().toLowerCase(),
  );

  if (critRule) {
    if (critRule.critical_low !== null && input.value <= critRule.critical_low) {
      return 'critical';
    }
    if (critRule.critical_high !== null && input.value >= critRule.critical_high) {
      return 'critical';
    }
  }

  // Strictly use the reference range printed on the report
  if (input.ref_low === null && input.ref_high === null) {
    return 'unknown';
  }

  if (input.ref_low !== null && input.value < input.ref_low) {
    return 'low';
  }

  if (input.ref_high !== null && input.value > input.ref_high) {
    return 'high';
  }

  return 'normal';
}

export function applyRuleChecker(results: LabResultItem[], rules: RulesBundle): LabResultItem[] {
  return results.map((item) => ({
    ...item,
    flag: evaluateResultFlag(
      {
        test_name_std: item.test_name_std,
        value: item.value,
        unit_std: item.unit_std,
        ref_low: item.ref_low,
        ref_high: item.ref_high,
      },
      rules.critical_limits,
    ),
  }));
}
