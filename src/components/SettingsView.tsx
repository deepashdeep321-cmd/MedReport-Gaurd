import React, { useState } from 'react';
import { Lock, RotateCcw, Shield, Trash2, User } from 'lucide-react';
import type { AuthUser, LanguageCode, ReportRecord } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { api, setAuthToken } from '../api/client';

export type TextScaleMode = 'standard' | 'large' | 'xlarge';

interface SettingsViewProps {
  copy: UiCopy;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  textScale: TextScaleMode;
  onTextScaleChange: (scale: TextScaleMode) => void;
  authUser: AuthUser | null;
  isAuthenticated: boolean;
  reports: ReportRecord[];
  onAuthUpdated: (user: AuthUser | null, authenticated: boolean) => void;
  onReportsChanged: () => Promise<void>;
  onOpenAdmin: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  copy,
  language,
  onLanguageChange,
  textScale,
  onTextScaleChange,
  authUser,
  isAuthenticated,
  reports,
  onAuthUpdated,
  onReportsChanged,
  onOpenAdmin,
}) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);
  const [privacyStatus, setPrivacyStatus] = useState<string | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    try {
      const res =
        authMode === 'register'
          ? await api.register(email, password, language)
          : await api.login(email, password);
      setAuthToken(res.token);
      onAuthUpdated(res.user, true);
      setPassword('');
      setAuthMessage(authMode === 'register' ? 'Encrypted personal account created.' : 'Signed in securely.');
      await onReportsChanged();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    }
  };

  const handleSignOut = async () => {
    await api.logout();
    setAuthToken(null);
    onAuthUpdated(null, false);
    setAuthMessage('Signed out. Returned to synthetic demo workspace.');
    await onReportsChanged();
  };

  const handleDeleteReport = async (id: string) => {
    await api.deleteReport(id);
    setPrivacyStatus('Report permanently erased from encrypted storage.');
    await onReportsChanged();
  };

  const handleEraseAll = async () => {
    const res = await api.deleteAllData();
    setConfirmErase(false);
    setPrivacyStatus(`Permanently erased ${res.removed} encrypted report(s).`);
    await onReportsChanged();
  };

  const handleRestoreDemo = async () => {
    await api.resetDemo();
    setPrivacyStatus('Restored 3 synthetic multi-visit demo reports.');
    await onReportsChanged();
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{copy.settingsTitle}</h1>
        <p className="text-sm text-slate-600 mt-1">
          Adjust readability, manage your encrypted account, delete stored reports, or open clinical safety rules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Accessibility & Language */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <h2 className="text-base font-bold text-slate-900">Accessibility &amp; Language</h2>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Text size</p>
            <div role="group" aria-label="Text size" className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'standard', label: 'Standard' },
                  { id: 'large', label: 'Large' },
                  { id: 'xlarge', label: 'Extra Large' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onTextScaleChange(opt.id)}
                  aria-pressed={textScale === opt.id}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                    textScale === opt.id
                      ? 'bg-teal-50 border-teal-700 text-teal-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Preferred summary &amp; UI language</p>
            <div role="group" aria-label="Preferred language" className="grid grid-cols-3 gap-2">
              {(
                [
                  { code: 'en', label: 'English' },
                  { code: 'ta', label: 'தமிழ்' },
                  { code: 'hi', label: 'हिन्दी' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => onLanguageChange(opt.code)}
                  aria-pressed={language === opt.code}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer ${
                    language === opt.code
                      ? 'bg-teal-50 border-teal-700 text-teal-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-slate-900">{copy.adminRulesTitle}</p>
              <p className="text-xs text-slate-500">
                Edit versioned comorbidity rules (C1–C7), critical limits, and inspect the PII-free audit log.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Open Admin</span>
            </button>
          </div>
        </section>

        {/* Patient Account */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Encrypted Account</h2>
          </div>

          {isAuthenticated && authUser ? (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold text-slate-900">{authUser.email}</p>
                <p className="text-xs text-slate-500">
                  Role: {authUser.role} · Session held in memory (Bearer auth)
                </p>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    authMode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Create Account
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    authMode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Sign In
                </button>
              </div>

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="patient@example.com"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-slate-700 mb-1">
                  Password (min 8 characters)
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
                />
              </div>

              {authError && <p role="alert" className="text-xs text-red-700 font-medium">{authError}</p>}
              {authMessage && <p role="status" className="text-xs text-emerald-700 font-medium">{authMessage}</p>}

              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
              >
                {authMode === 'register' ? 'Register Encrypted Workspace' : 'Sign In'}
              </button>
            </form>
          )}
        </section>

        {/* Privacy & Data Deletion */}
        <section className="lg:col-span-12 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-700" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">Privacy &amp; Data Control</h2>
              </div>
              <p className="text-xs text-slate-600">
                Reports are encrypted with AES-256-GCM on the server. Audit logs never store names, phone numbers, or raw report text.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRestoreDemo}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.resetDemoData}</span>
              </button>

              {!confirmErase ? (
                <button
                  type="button"
                  onClick={() => setConfirmErase(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{copy.deleteAllData}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEraseAll}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
                  >
                    Confirm Permanent Erase
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmErase(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {privacyStatus && (
            <p role="status" className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5">
              {privacyStatus}
            </p>
          )}

          {reports.length > 0 && (
            <div className="border-t border-slate-200 pt-4 divide-y divide-slate-100">
              {reports.map((rep) => (
                <div key={rep.id} className="py-2.5 flex items-center justify-between gap-4 text-sm">
                  <div>
                    <span className="font-mono text-xs text-slate-500 mr-2">{rep.visit_date}</span>
                    <span className="font-medium text-slate-900">{rep.title}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteReport(rep.id)}
                    aria-label={`Delete report ${rep.title}`}
                    className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
