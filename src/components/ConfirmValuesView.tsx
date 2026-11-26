import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import type { LabResultItem, ReportRecord } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { api } from '../api/client';

interface ConfirmValuesViewProps {
  report: ReportRecord;
  copy: UiCopy;
  onReportUpdated: (updated: ReportRecord) => void;
  onBackToSummary: () => void;
}

export const ConfirmValuesView: React.FC<ConfirmValuesViewProps> = ({
  report,
  copy,
  onReportUpdated,
  onBackToSummary,
}) => {
  const candidates = report.results.filter((r) => r.needs_confirmation && !r.user_confirmed);
  const displayList: LabResultItem[] = candidates.length > 0 ? candidates : report.results;

  const [drafts, setDrafts] = useState<Record<string, { value: string; unit: string }>>(() => {
    const initial: Record<string, { value: string; unit: string }> = {};
    for (const r of report.results) {
      initial[r.result_key] = { value: String(r.value), unit: r.unit_std };
    }
    return initial;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async (item: LabResultItem) => {
    const draft = drafts[item.result_key];
    const parsed = Number.parseFloat(draft?.value ?? '');
    if (!Number.isFinite(parsed)) {
      setErrorMsg(`Enter a valid number for ${item.display_name}.`);
      return;
    }

    setErrorMsg(null);
    setSavingKey(item.result_key);
    try {
      const res = await api.confirmResultValue(
        report.id,
        item.result_key,
        parsed,
        draft?.unit || item.unit_std,
      );
      onReportUpdated(res.report);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save confirmed value.');
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBackToSummary}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back to Summary</span>
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{copy.confirmValuesTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">
            Compare the cropped row from the original scan with the extracted number. Saving re-runs the Rule Checker, Comorbidity Safety Filter, and Output Verifier.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      {candidates.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm font-medium text-emerald-900">
            <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>All extracted values are high-confidence or confirmed. You can still edit any row below if needed.</span>
          </div>
          <button
            type="button"
            onClick={onBackToSummary}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
          >
            View Verified Summary
          </button>
        </div>
      )}

      <div className="space-y-5">
        {displayList.map((item) => {
          const [x1, y1, x2, y2] = item.bbox;
          const padY = 18;
          const cropY = Math.max(0, y1 - padY);
          const cropH = Math.max(64, y2 - y1 + padY * 2);
          const cropX = Math.max(0, x1 - 12);
          const cropW = Math.max(240, x2 - x1 + 24);
          const draft = drafts[item.result_key] || { value: String(item.value), unit: item.unit_std };
          const isSaving = savingKey === item.result_key;

          return (
            <div
              key={item.result_key}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {item.display_name} <span className="font-mono text-xs text-slate-500">[{item.result_key}]</span>
                  </h2>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    OCR Confidence: {Math.round(item.confidence * 100)}% · Printed Range: {item.ref_text || 'Not listed'}
                  </p>
                </div>
                {item.user_confirmed && (
                  <span className="text-xs font-semibold text-emerald-700">Confirmed by user</span>
                )}
              </div>

              {/* Zoomed visual crop of exact bbox from original report */}
              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-2">
                <p className="text-xs text-slate-500 mb-1.5">Zoomed crop from original report page:</p>
                <svg
                  viewBox={`${cropX} ${cropY} ${cropW} ${cropH}`}
                  className="w-full h-24 sm:h-28 bg-white border border-slate-200 rounded"
                  role="img"
                  aria-label={`Cropped scan of ${item.display_name} row`}
                >
                  <image
                    href={report.original_image_url}
                    width={report.page_width}
                    height={report.page_height}
                  />
                  <rect
                    x={x1}
                    y={y1}
                    width={x2 - x1}
                    height={y2 - y1}
                    fill="rgba(15, 118, 110, 0.08)"
                    stroke="#0f766e"
                    strokeWidth="2.5"
                  />
                </svg>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
                <div className="sm:col-span-5">
                  <label
                    htmlFor={`confirm-val-${item.result_key}`}
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Verified numeric value
                  </label>
                  <input
                    id={`confirm-val-${item.result_key}`}
                    type="number"
                    step="any"
                    value={draft.value}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.result_key]: { ...draft, value: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-base font-mono tabular-nums border border-slate-300 rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label
                    htmlFor={`confirm-unit-${item.result_key}`}
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Unit
                  </label>
                  <input
                    id={`confirm-unit-${item.result_key}`}
                    type="text"
                    value={draft.unit}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [item.result_key]: { ...draft, unit: e.target.value },
                      }))
                    }
                    className="w-full px-3 py-2 text-base font-mono border border-slate-300 rounded-lg bg-white text-slate-900"
                  />
                </div>

                <div className="sm:col-span-4">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleConfirm(item)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                    <span>{copy.confirmAndReverify}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
