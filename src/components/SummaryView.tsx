import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react';
import type { FlagType, LanguageCode, ReportRecord, SummarySentence } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { ClickToVerifyViewer } from './ClickToVerifyViewer';
import { speakSentences, stopSpeaking } from '../utils/speech';

interface SummaryViewProps {
  reports: ReportRecord[];
  activeReport: ReportRecord | null;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onSelectReportId: (id: string) => void;
  onOpenConfirm: () => void;
  onOpenUpload: () => void;
  copy: UiCopy;
}

function getFlagPresentation(flag: FlagType): { label: string; textClass: string; bgClass: string } {
  switch (flag) {
    case 'critical':
      return { label: 'Critical — Urgent', textClass: 'text-red-800', bgClass: 'bg-red-50 border-red-200' };
    case 'high':
      return { label: 'High', textClass: 'text-amber-900', bgClass: 'bg-amber-50 border-amber-200' };
    case 'low':
      return { label: 'Low', textClass: 'text-amber-900', bgClass: 'bg-amber-50 border-amber-200' };
    case 'normal':
      return { label: 'Normal', textClass: 'text-emerald-800', bgClass: 'bg-emerald-50 border-emerald-200' };
    default:
      return { label: 'Ask Doctor', textClass: 'text-slate-700', bgClass: 'bg-slate-100 border-slate-200' };
  }
}

export const SummaryView: React.FC<SummaryViewProps> = ({
  reports,
  activeReport,
  language,
  onLanguageChange,
  onSelectReportId,
  onOpenConfirm,
  onOpenUpload,
  copy,
}) => {
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(null);
  const [highlightedKeys, setHighlightedKeys] = useState<string[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [showVerifierDetails, setShowVerifierDetails] = useState(false);

  useEffect(() => {
    stopSpeaking();
    setIsSpeaking(false);
    setSpeakingIdx(null);
    if (activeReport) {
      const firstAbnormal = activeReport.results.find(
        (r) => r.flag === 'critical' || r.flag === 'low' || r.flag === 'high',
      );
      setHighlightedKeys(firstAbnormal ? [firstAbnormal.result_key] : activeReport.results[0] ? [activeReport.results[0].result_key] : []);
      setSelectedSentenceIdx(null);
    }
    return () => {
      stopSpeaking();
    };
  }, [activeReport?.id, language]);

  if (!activeReport) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
        <h1 className="text-xl font-bold text-slate-900">No Report Selected</h1>
        <p className="text-sm text-slate-600">
          Upload a lab report or run a synthetic report to see its verified summary and Click-to-Verify evidence.
        </p>
        <button
          type="button"
          onClick={onOpenUpload}
          className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
        >
          {copy.ctaUpload}
        </button>
      </div>
    );
  }

  const summary = activeReport.summaries[language] || activeReport.summaries.en;
  const unconfirmedCount = activeReport.results.filter((r) => r.needs_confirmation && !r.user_confirmed).length;
  const hasCritical = activeReport.results.some((r) => r.flag === 'critical');

  const indexedSentences = summary.sentences.map((item, idx) => ({ item, idx }));
  const needsAttentionSentences = indexedSentences.filter((s) => s.item.section === 'needs_attention');
  const looksNormalSentences = indexedSentences.filter((s) => s.item.section === 'looks_normal');
  const askDoctorSentences = indexedSentences.filter((s) =>
    activeReport.safety_hits.length > 0
      ? s.item.section === 'ask_doctor'
      : s.item.section === 'ask_doctor' || s.item.section === 'safety_note',
  );

  const handleSentenceClick = (idx: number, sentence: SummarySentence) => {
    setSelectedSentenceIdx(idx);
    if (sentence.evidence_result_keys.length > 0) {
      setHighlightedKeys(sentence.evidence_result_keys);
    }
  };

  const handleToggleAudio = () => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      setSpeakingIdx(null);
      return;
    }
    const playable = summary.sentences.map((s) => s.sentence);
    setIsSpeaking(true);
    const started = speakSentences(
      playable,
      language,
      (idx) => {
        setSpeakingIdx(idx);
        if (idx !== null && summary.sentences[idx]?.evidence_result_keys.length) {
          setHighlightedKeys(summary.sentences[idx].evidence_result_keys);
        }
      },
      () => {
        setIsSpeaking(false);
        setSpeakingIdx(null);
      },
    );
    if (!started) {
      setIsSpeaking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Report Header Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
            <span>{activeReport.visit_date}</span>
            <span aria-hidden="true">·</span>
            <span>{activeReport.patient_age_sex}</span>
            <span aria-hidden="true">·</span>
            <span>Rules v{summary.rules_version}</span>
            <span aria-hidden="true">·</span>
            <span>Reading grade {summary.verifier_log.readability_grade}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{activeReport.title}</h1>
            {reports.length > 1 && (
              <label className="sr-only" htmlFor="report-switcher">
                Switch report
              </label>
            )}
            {reports.length > 1 && (
              <select
                id="report-switcher"
                value={activeReport.id}
                onChange={(e) => onSelectReportId(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.visit_date} — {r.title}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Language + Audio Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div role="group" aria-label="Summary language" className="flex items-center p-1 bg-slate-100 rounded-lg">
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
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  language === opt.code
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleToggleAudio}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isSpeaking
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-teal-700 text-white hover:bg-teal-800'
            }`}
          >
            {isSpeaking ? (
              <>
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copy.stopListening}</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>{copy.listenSummary}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Urgent Critical Value Alert */}
      {hasCritical && (
        <div role="alert" className="bg-red-50 border border-red-300 rounded-xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-bold text-red-950">Urgent: Critical Lab Value Detected — Please See a Doctor Now</p>
            <p className="text-sm text-red-900">
              One or more numbers on this report crossed an urgent safety threshold. Please contact your doctor or seek immediate medical care rather than waiting for a routine appointment.
            </p>
          </div>
        </div>
      )}

      {/* Low-Confidence Confirmation Callout */}
      {unconfirmedCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-amber-950">
              {unconfirmedCount} extracted value had lower OCR confidence
            </p>
            <p className="text-xs text-amber-900">
              MedReport-Guard never guesses faint numbers. Compare the cropped scan against the reading to confirm it.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenConfirm}
            className="px-4 py-2 text-xs font-semibold text-amber-950 bg-white border border-amber-400 hover:bg-amber-100 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copy.reviewValues}
          </button>
        </div>
      )}

      {/* Main Split Console: Left Verified Summary & Results Table, Right Click-to-Verify Viewer */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-6 space-y-6">
          {/* 1. Needs Attention */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">{copy.needsAttention}</h2>
            </div>

            {needsAttentionSentences.length === 0 ? (
              <p className="text-sm text-slate-600">No out-of-range values were flagged on this report.</p>
            ) : (
              <div className="space-y-2.5">
                {needsAttentionSentences.map(({ item, idx }) => {
                  const isSelected = selectedSentenceIdx === idx || speakingIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSentenceClick(idx, item)}
                      className={`w-full text-left p-3.5 rounded-lg border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-teal-700 ${
                        isSelected
                          ? 'bg-teal-50/70 border-teal-600 text-slate-950'
                          : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 text-slate-800'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{item.sentence}</p>
                      {item.evidence_result_keys.length > 0 && (
                        <span className="mt-1.5 inline-block text-xs font-mono text-teal-800">
                          Click to verify on report: {item.evidence_result_keys.join(', ')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 2. Comorbidity Safety Filter */}
          {activeReport.safety_hits.length > 0 && (
            <section className="bg-amber-50/60 border border-amber-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-800 shrink-0" aria-hidden="true" />
                <h2 className="text-base font-bold text-slate-900">{copy.safetyFilterTitle}</h2>
              </div>
              <p className="text-xs text-slate-600">
                Checked all abnormal results together before generating text. Conflicting generic diet or supplement tips are blocked automatically.
              </p>

              <div className="space-y-3">
                {activeReport.safety_hits.map((hit) => (
                  <div key={hit.rule_id} className="bg-white border border-amber-200 rounded-lg p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900">
                        <span className="font-mono text-amber-800 mr-1.5">{hit.rule_id}</span>
                        {hit.title}
                      </h3>
                      <span className="text-xs font-mono text-slate-500">
                        Matched: {hit.matched_tests.join(' + ')}
                      </span>
                    </div>
                    <p className="text-sm text-slate-800 leading-relaxed">{hit.safe_message}</p>
                    <p className="text-xs text-red-800">
                      <strong>{copy.blockedAdviceLabel}:</strong> {hit.blocked_items.join(', ')}
                    </p>
                    <p className="text-xs text-slate-500">{hit.clinical_review_note}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 3. Looks Normal */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">{copy.looksNormal}</h2>
            </div>

            {looksNormalSentences.length === 0 ? (
              <p className="text-sm text-slate-600">No tests fell inside the normal printed range on this page.</p>
            ) : (
              <div className="space-y-2">
                {looksNormalSentences.map(({ item, idx }) => {
                  const isSelected = selectedSentenceIdx === idx || speakingIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSentenceClick(idx, item)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-teal-50/70 border-teal-600 text-slate-950'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{item.sentence}</p>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* 4. Ask Your Doctor */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">{copy.askDoctor}</h2>
            </div>
            <div className="space-y-2">
              {askDoctorSentences.map(({ item, idx }) => (
                <p key={idx} className="text-sm text-slate-700 leading-relaxed">
                  {item.sentence}
                </p>
              ))}
            </div>

            {/* Mandatory Disclaimer */}
            <div className="pt-3 border-t border-slate-200">
              <p className="text-sm font-semibold text-slate-900" data-testid="mandatory-disclaimer">
                {summary.disclaimer}
              </p>
            </div>
          </section>

          {/* Structured Extracted Results Table */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-slate-900">Extracted Structured Values</h2>
              <button
                type="button"
                onClick={onOpenConfirm}
                className="text-xs font-semibold text-teal-800 hover:underline cursor-pointer"
              >
                Edit / Confirm Values
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                    <th className="py-2.5 px-4 font-semibold">Test</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Value</th>
                    <th className="py-2.5 px-4 font-semibold">Printed Range</th>
                    <th className="py-2.5 px-4 font-semibold">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activeReport.results.map((res) => {
                    const flagStyle = getFlagPresentation(res.flag);
                    const isHighlighted = highlightedKeys.includes(res.result_key);
                    return (
                      <tr
                        key={res.result_key}
                        onClick={() => setHighlightedKeys([res.result_key])}
                        className={`cursor-pointer transition-colors ${
                          isHighlighted ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">{res.display_name}</div>
                          <div className="text-xs font-mono text-slate-500">
                            {res.result_key} · {Math.round(res.confidence * 100)}% conf
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {res.value}{' '}
                          <span className="text-xs font-normal text-slate-500">{res.unit_std}</span>
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          {res.ref_text || 'Not listed'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`text-xs font-semibold ${flagStyle.textClass}`}>
                            {flagStyle.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Output Verifier V1-V8 Audit Disclosure */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowVerifierDetails((v) => !v)}
              aria-expanded={showVerifierDetails}
              className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <div>
                  <span className="text-sm font-bold text-slate-900">
                    Output Verifier Gate (V1–V8): {summary.verifier_log.passed ? 'All Passed' : 'Fallback Active'}
                  </span>
                  <span className="ml-2 text-xs text-slate-500 font-mono">
                    {summary.used_fallback ? 'Deterministic Template Fallback' : `Verified (${summary.verifier_log.attempts} attempt)`}
                  </span>
                </div>
              </div>
              {showVerifierDetails ? (
                <ChevronUp className="w-4 h-4 text-slate-500" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />
              )}
            </button>

            {showVerifierDetails && (
              <div className="px-5 pb-4 pt-1 border-t border-slate-200 divide-y divide-slate-100">
                {summary.verifier_log.checks.map((chk) => (
                  <div key={chk.id} className="py-2 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-slate-700">{chk.id}</span>
                      <span className="text-slate-800">{chk.name}</span>
                    </div>
                    <span className={`font-semibold ${chk.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                      {chk.passed ? 'Pass' : `Fail: ${chk.reason}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sticky Column: Click-to-Verify Document Canvas */}
        <div className="xl:col-span-6 xl:sticky xl:top-20">
          <ClickToVerifyViewer
            report={activeReport}
            highlightedKeys={highlightedKeys}
            onSelectResultKey={(key) => setHighlightedKeys([key])}
            copy={copy}
          />
        </div>
      </div>
    </div>
  );
};
