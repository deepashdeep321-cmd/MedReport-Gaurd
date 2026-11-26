import React from 'react';
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { LanguageCode, ReportRecord } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { MANDATORY_DISCLAIMER } from '../pipeline/rulesData';

interface HomeViewProps {
  reports: ReportRecord[];
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onSelectReport: (reportId: string, openConfirm?: boolean) => void;
  onStartUpload: () => void;
  onOpenTrends: () => void;
  copy: UiCopy;
}

export const HomeView: React.FC<HomeViewProps> = ({
  reports,
  language,
  onLanguageChange,
  onSelectReport,
  onStartUpload,
  onOpenTrends,
  copy,
}) => {
  const langOptions: Array<{ code: LanguageCode; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'hi', label: 'हिन्दी' },
  ];

  const latestReport = reports[0] || null;
  const totalAbnormal = latestReport
    ? latestReport.results.filter((r) => r.flag === 'low' || r.flag === 'high' || r.flag === 'critical').length
    : 0;
  const totalSafetyHits = latestReport ? latestReport.safety_hits.length : 0;

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
          <div className="max-w-2xl space-y-5">
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>Zero PII sent to AI</span>
              <span aria-hidden="true">·</span>
              <span>Deterministic Range Checking</span>
              <span aria-hidden="true">·</span>
              <span>Click-to-Verify Evidence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
              {copy.heroTitle}
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              {copy.heroSubtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onStartUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                {copy.ctaUpload}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              {latestReport && (
                <button
                  type="button"
                  onClick={() => onSelectReport(latestReport.id)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copy.openSummary}
                </button>
              )}
              {reports.length > 1 && (
                <button
                  type="button"
                  onClick={onOpenTrends}
                  className="px-4 py-2.5 text-sm font-medium text-teal-800 hover:text-teal-900 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {copy.trendsTitle}
                </button>
              )}
            </div>
          </div>

          {/* Language Switcher + Safety Summary */}
          <div className="w-full lg:w-80 shrink-0 space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Summary &amp; interface language</p>
              <div
                role="group"
                aria-label="Select language"
                className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg"
              >
                {langOptions.map((opt) => (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => onLanguageChange(opt.code)}
                    aria-pressed={language === opt.code}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      language === opt.code
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
                <span>Medical Safety Boundary</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {MANDATORY_DISCLAIMER[language]}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                {copy.privacyNote}
              </p>
            </div>
          </div>
        </div>

        {/* Clean 4-column summary strip below hero split */}
        <div className="mt-8 pt-6 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500">Encrypted Reports Stored</p>
            <p className="mt-1 text-2xl font-mono font-semibold tabular-nums text-slate-900">
              {reports.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Latest Visit Out-of-Range</p>
            <p className="mt-1 text-2xl font-mono font-semibold tabular-nums text-amber-700">
              {totalAbnormal}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Comorbidity Rules Active</p>
            <p className="mt-1 text-2xl font-mono font-semibold tabular-nums text-slate-900">
              {totalSafetyHits}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Output Verifier Gate</p>
            <p className="mt-1 text-2xl font-mono font-semibold tabular-nums text-emerald-700">
              V1–V8
            </p>
          </div>
        </div>
      </section>

      {/* Reports List */}
      <section aria-labelledby="reports-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="reports-heading" className="text-xl font-bold text-slate-900">
              {copy.recentReports}
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Synthetic demonstration visits are pre-loaded so you can inspect Click-to-Verify, Comorbidity Safety Filtering, and Trends right away.
            </p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
            <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-900">No lab reports stored</p>
              <p className="text-sm text-slate-600">
                Upload a photo of a lab report or run one of the synthetic sample reports to generate a verified summary.
              </p>
            </div>
            <button
              type="button"
              onClick={onStartUpload}
              className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              {copy.ctaUpload}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {reports.map((report) => {
              const abnormalCount = report.results.filter(
                (r) => r.flag === 'low' || r.flag === 'high' || r.flag === 'critical',
              ).length;
              const criticalCount = report.results.filter((r) => r.flag === 'critical').length;
              const unconfirmedCount = report.results.filter(
                (r) => r.needs_confirmation && !r.user_confirmed,
              ).length;

              return (
                <div
                  key={report.id}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                      <span>{report.visit_date}</span>
                      <span aria-hidden="true">·</span>
                      <span>{report.patient_age_sex}</span>
                      <span aria-hidden="true">·</span>
                      <span>{report.results.length} tests</span>
                      <span aria-hidden="true">·</span>
                      <span>{report.pii_masks.length} PII blocks masked</span>
                    </div>

                    <h3 className="text-base font-semibold text-slate-900">
                      {report.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-sm pt-0.5">
                      {criticalCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-red-700">
                          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                          Critical value ({criticalCount}) — see a doctor now
                        </span>
                      ) : abnormalCount > 0 ? (
                        <span className="inline-flex items-center gap-1.5 font-medium text-amber-800">
                          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                          {abnormalCount} out of range
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                          All values in printed range
                        </span>
                      )}

                      {report.safety_hits.length > 0 && (
                        <span className="text-slate-600">
                          Safety filter rules triggered:{' '}
                          <span className="font-mono font-semibold text-slate-900">
                            {report.safety_hits.map((h) => h.rule_id).join(', ')}
                          </span>
                        </span>
                      )}

                      {unconfirmedCount > 0 && (
                        <span className="font-medium text-teal-800">
                          Needs confirmation ({unconfirmedCount} low-confidence cell)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {unconfirmedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => onSelectReport(report.id, true)}
                        className="px-3.5 py-2 text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {copy.reviewValues}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectReport(report.id, false)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {copy.openSummary}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
