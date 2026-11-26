import type { ReportRecord } from '../types/medreport';

/**
 * Formats an unknown runtime error into a safe, concise user-facing message
 * without leaking stack traces or sensitive values.
 */
export function formatSafeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim().slice(0, 220);
  }
  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim().slice(0, 220);
  }
  return 'An unexpected rendering error occurred while displaying this screen.';
}

/**
 * Safely validates and extracts a ReportRecord array from an API payload
 * so malformed or non-JSON responses never crash Array.prototype.find in render.
 */
export function extractSafeReports(payload: unknown): {
  reports: ReportRecord[];
  valid: boolean;
} {
  if (
    payload &&
    typeof payload === 'object' &&
    'reports' in payload &&
    Array.isArray((payload as { reports: unknown }).reports)
  ) {
    const safeList = (payload as { reports: unknown[] }).reports.filter(
      (item): item is ReportRecord =>
        Boolean(item && typeof item === 'object' && typeof (item as ReportRecord).id === 'string'),
    );
    return { reports: safeList, valid: true };
  }
  return { reports: [], valid: false };
}
