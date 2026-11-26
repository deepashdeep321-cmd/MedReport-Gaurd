export type LanguageCode = 'en' | 'ta' | 'hi';

export type FlagType = 'normal' | 'low' | 'high' | 'critical' | 'unknown';

export type ReportStatus =
  | 'uploaded'
  | 'quality_failed'
  | 'processing'
  | 'needs_confirmation'
  | 'done'
  | 'failed';

export type UserRole = 'patient' | 'reviewer' | 'admin';

export type BoundingBox = [number, number, number, number]; // [x1, y1, x2, y2] in image pixels

export interface PiiMaskBox {
  id: string;
  label: string;
  bbox: BoundingBox;
}

export interface LabResultItem {
  id: string;
  result_key: string; // R1, R2, ...
  test_name_raw: string;
  test_name_std: string;
  display_name: string;
  value: number;
  value_raw: string;
  unit_raw: string;
  unit_std: string;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string;
  flag: FlagType;
  confidence: number;
  needs_confirmation: boolean;
  user_confirmed: boolean;
  page: number;
  bbox: BoundingBox;
}

export interface SafetyHit {
  rule_id: string;
  title: string;
  severity: 'high' | 'moderate';
  matched_tests: string[];
  blocked_items: string[];
  safe_message: string;
  clinical_review_note: string;
}

export interface VerifierCheckResult {
  id: 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8';
  name: string;
  passed: boolean;
  reason?: string;
}

export interface VerifierLog {
  attempts: number;
  passed: boolean;
  used_fallback: boolean;
  readability_grade: number;
  checks: VerifierCheckResult[];
}

export type SummarySection = 'needs_attention' | 'looks_normal' | 'ask_doctor' | 'safety_note' | 'disclaimer';

export interface SummarySentence {
  sentence: string;
  evidence_result_keys: string[];
  section: SummarySection;
  check_ids: string[];
}

export interface LocalizedSummary {
  language: LanguageCode;
  sentences: SummarySentence[];
  used_fallback: boolean;
  verifier_log: VerifierLog;
  rules_version: string;
  disclaimer: string;
}

export interface QualityCheckResult {
  passed: boolean;
  score: number; // 0..100
  blur_score: number;
  brightness_score: number;
  reason?: string;
}

export interface ReportRecord {
  id: string;
  user_id: string;
  title: string;
  lab_name_masked: string;
  visit_date: string; // YYYY-MM-DD
  patient_age_sex: string; // e.g., "54Y / F" (masked demographic only)
  status: ReportStatus;
  quality_check: QualityCheckResult;
  page_width: number;
  page_height: number;
  original_image_url: string;
  masked_image_url: string;
  pii_masks: PiiMaskBox[];
  results: LabResultItem[];
  safety_hits: SafetyHit[];
  blocked_items: string[];
  summaries: Record<LanguageCode, LocalizedSummary>;
  created_at: string;
}

export interface ConflictRule {
  id: string;
  title: string;
  illustrativeNeedsClinicalReview: boolean;
  if_all: Array<{
    any_tests: string[];
    flags: FlagType[];
  }>;
  blocked_items: string[];
  blocked_synonyms: string[];
  safe_message: string;
  severity: 'high' | 'moderate';
}

export interface CriticalLimitRule {
  test_name_std: string;
  unit_std: string;
  critical_low: number | null;
  critical_high: number | null;
  needs_clinical_review: boolean;
  note: string;
}

export interface UnitConversionRule {
  test_name_std: string;
  from_unit: string;
  to_unit: string;
  factor: number;
}

export interface RulesBundle {
  version: string;
  updated_at: string;
  test_aliases: Record<string, string>;
  unit_conversions: UnitConversionRule[];
  critical_limits: CriticalLimitRule[];
  conflict_rules: ConflictRule[];
}

export interface RuleVersionEntry {
  id: string;
  name: keyof Omit<RulesBundle, 'version' | 'updated_at'>;
  version: string;
  updated_at: string;
  summary: string;
}

export interface AuditLogEntry {
  id: string;
  report_id: string | null;
  event: string;
  details: Record<string, string | number | boolean | string[]>;
  created_at: string;
}

export interface TrendPoint {
  report_id: string;
  visit_date: string;
  value: number;
  unit_std: string;
  ref_low: number | null;
  ref_high: number | null;
  flag: FlagType;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  language: LanguageCode;
}
