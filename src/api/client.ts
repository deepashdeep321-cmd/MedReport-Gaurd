import type {
  AuditLogEntry,
  AuthUser,
  LanguageCode,
  PiiMaskBox,
  QualityCheckResult,
  ReportRecord,
  RulesBundle,
  RuleVersionEntry,
  TrendPoint,
} from '../types/medreport';

let activeAuthToken: string | null = null;
let activeAdminToken: string | null = null;

export function setAuthToken(token: string | null): void {
  activeAuthToken = token;
}

export function setAdminToken(token: string | null): void {
  activeAdminToken = token;
}

export function hasAdminToken(): boolean {
  return Boolean(activeAdminToken);
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  useAdminAuth = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = useAdminAuth ? activeAdminToken : activeAuthToken;
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: text };
    }
  }

  if (!response.ok) {
    const errObj = parsed as { error?: string; status?: string; quality_check?: QualityCheckResult };
    const err = new Error(errObj.error || `Request failed (${response.status})`) as Error & {
      status?: number;
      payload?: unknown;
    };
    err.status = response.status;
    err.payload = parsed;
    throw err;
  }

  return parsed as T;
}

export const api = {
  health: () =>
    apiFetch<{ status: string; geminiConfigured: boolean; rulesVersion: string }>('/api/health'),

  me: () => apiFetch<{ authenticated: boolean; user: AuthUser | null }>('/api/auth/me'),

  register: (email: string, password: string, language: LanguageCode) =>
    apiFetch<{ user: AuthUser; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, language }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  listReports: () => apiFetch<{ reports: ReportRecord[] }>('/api/reports'),

  createFromPreset: (presetId: string, visitDate?: string) =>
    apiFetch<{ report: ReportRecord }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ presetId, visitDate }),
    }),

  submitQualityFailedTest: (qualityCheck: QualityCheckResult) =>
    apiFetch<{ status: string; error: string }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ qualityCheck }),
    }),

  uploadMaskedReport: (payload: {
    title: string;
    visitDate: string;
    patientAgeSex: string;
    originalImageUrl: string;
    maskedImageUrl: string;
    pageWidth: number;
    pageHeight: number;
    piiMasks: PiiMaskBox[];
    qualityCheck: QualityCheckResult;
  }) =>
    apiFetch<{ report: ReportRecord }>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  confirmResultValue: (reportId: string, resultKey: string, value: number, unitStd: string) =>
    apiFetch<{ report: ReportRecord }>(`/api/reports/${encodeURIComponent(reportId)}/results/${encodeURIComponent(resultKey)}`, {
      method: 'PATCH',
      body: JSON.stringify({ value, unit_std: unitStd }),
    }),

  deleteReport: (reportId: string) =>
    apiFetch<{ ok: boolean }>(`/api/reports/${encodeURIComponent(reportId)}`, {
      method: 'DELETE',
    }),

  deleteAllData: () => apiFetch<{ ok: boolean; removed: number }>('/api/me/data', { method: 'DELETE' }),

  resetDemo: () => apiFetch<{ ok: boolean; reports: ReportRecord[] }>('/api/demo/reset', { method: 'POST' }),

  getTrends: (test?: string) =>
    apiFetch<{
      availableTests: Array<{ test_name_std: string; display_name: string; count: number }>;
      selectedTest: string;
      points: TrendPoint[];
    }>(`/api/trends${test ? `?test=${encodeURIComponent(test)}` : ''}`),

  adminStatus: () => apiFetch<{ envConfigured: boolean; claimed: boolean }>('/api/admin/status'),

  adminClaim: (password: string) =>
    apiFetch<{ token: string; role: string }>('/api/admin/claim', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminLogin: (password: string) =>
    apiFetch<{ token: string; role: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  adminGetRules: () =>
    apiFetch<{ rules: RulesBundle; versions: RuleVersionEntry[] }>('/api/admin/rules', {}, true),

  adminUpdateRule: (name: string, data: unknown, summary: string) =>
    apiFetch<{ rules: RulesBundle; versions: RuleVersionEntry[] }>(
      `/api/admin/rules/${encodeURIComponent(name)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ data, summary }),
      },
      true,
    ),

  adminGetAudit: () => apiFetch<{ logs: AuditLogEntry[] }>('/api/admin/audit', {}, true),
};
