import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Lock, Save } from 'lucide-react';
import type { AuditLogEntry, RulesBundle, RuleVersionEntry } from '../types/medreport';
import { api, hasAdminToken, setAdminToken } from '../api/client';

interface AdminViewProps {
  onBack: () => void;
}

type EditableRuleKey = 'conflict_rules' | 'critical_limits' | 'test_aliases' | 'unit_conversions';

export const AdminView: React.FC<AdminViewProps> = ({ onBack }) => {
  const [adminStatus, setAdminStatus] = useState<{ envConfigured: boolean; claimed: boolean } | null>(null);
  const [unlocked, setUnlocked] = useState<boolean>(hasAdminToken());
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  const [rules, setRules] = useState<RulesBundle | null>(null);
  const [versions, setVersions] = useState<RuleVersionEntry[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [selectedRuleKey, setSelectedRuleKey] = useState<EditableRuleKey>('conflict_rules');
  const [editorText, setEditorText] = useState('');
  const [changeSummary, setChangeSummary] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadAdminData = async () => {
    const [rulesRes, auditRes] = await Promise.all([api.adminGetRules(), api.adminGetAudit()]);
    setRules(rulesRes.rules);
    setVersions(rulesRes.versions);
    setAuditLogs(auditRes.logs);
    setEditorText(JSON.stringify(rulesRes.rules[selectedRuleKey], null, 2));
  };

  useEffect(() => {
    api.adminStatus().then(setAdminStatus).catch(() => {});
    if (hasAdminToken()) {
      loadAdminData().catch(() => {
        setAdminToken(null);
        setUnlocked(false);
      });
    }
  }, []);

  const handleRuleTabChange = (key: EditableRuleKey) => {
    setSelectedRuleKey(key);
    setSaveError(null);
    setSaveMessage(null);
    if (rules) {
      setEditorText(JSON.stringify(rules[key], null, 2));
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const needsFirstRunClaim = adminStatus && !adminStatus.envConfigured && !adminStatus.claimed;
    try {
      const res = needsFirstRunClaim
        ? await api.adminClaim(password)
        : await api.adminLogin(password);
      setAdminToken(res.token);
      setUnlocked(true);
      setPassword('');
      await loadAdminData();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    }
  };

  const handleSaveRule = async () => {
    setSaveError(null);
    setSaveMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(editorText);
    } catch {
      setSaveError('Invalid JSON syntax. Please check commas, quotes, and brackets.');
      return;
    }

    try {
      const res = await api.adminUpdateRule(
        selectedRuleKey,
        parsed,
        changeSummary.trim() || `Updated ${selectedRuleKey}`,
      );
      setRules(res.rules);
      setVersions(res.versions);
      setChangeSummary('');
      setSaveMessage(`Saved version ${res.rules.version} of ${selectedRuleKey}.`);
      const auditRes = await api.adminGetAudit();
      setAuditLogs(auditRes.logs);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unable to save rule update.');
    }
  };

  if (!unlocked) {
    const isFirstRun = adminStatus && !adminStatus.envConfigured && !adminStatus.claimed;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Settings</span>
        </button>

        <form onSubmit={handleAdminAuth} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-teal-700" aria-hidden="true" />
            <h1 className="text-xl font-bold text-slate-900">
              {isFirstRun ? 'First-Run Admin Setup' : 'Admin Sign In'}
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            {isFirstRun
              ? 'No admin passcode is set yet. Choose an admin password (min 8 characters) to lock and manage versioned clinical safety rules.'
              : 'Enter the server admin password to edit versioned clinical safety rules and inspect the PII-free audit log.'}
          </p>

          <div>
            <label htmlFor="admin-pass-input" className="block text-xs font-medium text-slate-700 mb-1">
              {isFirstRun ? 'New admin password (min 8 characters)' : 'Admin password'}
            </label>
            <input
              id="admin-pass-input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
            />
          </div>

          {authError && (
            <p role="alert" className="text-xs font-medium text-red-700">
              {authError}
            </p>
          )}

          <button
            type="submit"
            className="px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
          >
            {isFirstRun ? 'Claim Admin Access' : 'Unlock Admin Rules'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Settings</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Admin Clinical Rules &amp; Audit Log</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Active Rules Bundle: <span className="font-mono font-semibold text-slate-900">v{rules?.version}</span> · Changes apply immediately to new analyses and confirmations.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Rule JSON Editor */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {(
              [
                { id: 'conflict_rules', label: 'Conflict Rules (C1–C7)' },
                { id: 'critical_limits', label: 'Critical Limits' },
                { id: 'test_aliases', label: 'Test Aliases' },
                { id: 'unit_conversions', label: 'Unit Conversions' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRuleTabChange(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap cursor-pointer ${
                  selectedRuleKey === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="rule-json-editor" className="sr-only">
              Rule JSON editor
            </label>
            <textarea
              id="rule-json-editor"
              rows={18}
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              spellCheck={false}
              className="w-full p-4 font-mono text-xs bg-slate-950 text-slate-100 rounded-lg border border-slate-300 leading-relaxed"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              placeholder="Short clinical change note (optional)"
              aria-label="Clinical change note"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
            />
            <button
              type="button"
              onClick={handleSaveRule}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Save className="w-4 h-4" aria-hidden="true" />
              <span>Save Versioned Rule</span>
            </button>
          </div>

          {saveError && <p role="alert" className="text-xs font-medium text-red-700">{saveError}</p>}
          {saveMessage && (
            <p role="status" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              <span>{saveMessage}</span>
            </p>
          )}
        </div>

        {/* Version History + PII-Free Audit Log */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Rule Version History</h2>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {versions.map((ver) => (
                <div key={ver.id} className="py-2.5 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-semibold text-teal-800">v{ver.version}</span>
                    <span className="text-slate-500">{ver.name}</span>
                  </div>
                  <p className="text-slate-700">{ver.summary}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pipeline Audit Log (Zero PII)</h2>
              <p className="text-xs text-slate-500">Records stage transitions, rule IDs, and verifier results only.</p>
            </div>
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {auditLogs.map((entry) => (
                <div key={entry.id} className="py-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between font-mono">
                    <span className="font-semibold text-slate-900">{entry.event}</span>
                    <span className="text-slate-400">{entry.created_at.slice(11, 19)}</span>
                  </div>
                  <p className="font-mono text-[11px] text-slate-600 break-all">
                    {JSON.stringify(entry.details)}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
