import React, { useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, EyeOff, FileUp, Loader2, Shield } from 'lucide-react';
import type { ReportRecord } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { api } from '../api/client';
import { inspectAndMaskUploadedFile, type ProcessedUploadImage } from '../utils/reportCanvas';
import { SYNTHETIC_PRESETS } from '../pipeline/syntheticReports';

interface UploadViewProps {
  copy: UiCopy;
  onReportCreated: (report: ReportRecord) => void;
}

export const UploadView: React.FC<UploadViewProps> = ({ copy, onReportCreated }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [maskHeaderPercent, setMaskHeaderPercent] = useState<number>(22);
  const [processed, setProcessed] = useState<ProcessedUploadImage | null>(null);
  const [title, setTitle] = useState('Uploaded Lab Report');
  const [visitDate, setVisitDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ageSex, setAgeSex] = useState('54Y / F');
  const [isProcessing, setIsProcessing] = useState(false);
  const [stageMessage, setStageMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [qualityFailureMsg, setQualityFailureMsg] = useState<string | null>(null);

  const handleFileChange = async (file: File | null, maskPct = maskHeaderPercent) => {
    setErrorMessage(null);
    setQualityFailureMsg(null);
    if (!file) {
      setSelectedFile(null);
      setProcessed(null);
      return;
    }
    setSelectedFile(file);
    try {
      const result = await inspectAndMaskUploadedFile(file, maskPct);
      setProcessed(result);
      if (!result.qualityCheck.passed) {
        setQualityFailureMsg(
          result.qualityCheck.reason ||
            'Image quality check failed. Please upload a brighter, sharper photo.',
        );
      }
    } catch (err) {
      setProcessed(null);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to read image.');
    }
  };

  const handleMaskSliderChange = async (nextPct: number) => {
    setMaskHeaderPercent(nextPct);
    if (selectedFile) {
      await handleFileChange(selectedFile, nextPct);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processed) {
      setErrorMessage('Select a lab report photo first, or run one of the synthetic sample reports below.');
      return;
    }
    if (!processed.qualityCheck.passed) {
      setQualityFailureMsg(processed.qualityCheck.reason || 'Photo quality is too low. Please retake.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setStageMessage('Step 1/4: Verifying local PII mask & extracting lab rows...');
    try {
      const res = await api.uploadMaskedReport({
        title,
        visitDate,
        patientAgeSex: ageSex,
        originalImageUrl: processed.originalDataUrl,
        maskedImageUrl: processed.maskedDataUrl,
        pageWidth: processed.width,
        pageHeight: processed.height,
        piiMasks: processed.piiMasks,
        qualityCheck: processed.qualityCheck,
      });
      setStageMessage('Verified summary ready.');
      onReportCreated(res.report);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setIsProcessing(false);
      setStageMessage('');
    }
  };

  const handleRunSyntheticPreset = async (presetId: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setQualityFailureMsg(null);
    setStageMessage('Running PII masking, Rule Checker, Comorbidity Filter & Output Verifier V1–V8...');
    try {
      const res = await api.createFromPreset(presetId);
      onReportCreated(res.report);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to run synthetic preset.');
    } finally {
      setIsProcessing(false);
      setStageMessage('');
    }
  };

  const handleSimulateBlurryUpload = async () => {
    setErrorMessage(null);
    setQualityFailureMsg(null);
    try {
      await api.submitQualityFailedTest({
        passed: false,
        score: 21,
        blur_score: 11,
        brightness_score: 48,
        reason:
          'Photo failed quality check (blur variance 11, low brightness 48). Hold your camera flat over the report in bright, even light and retake.',
      });
    } catch (err) {
      setQualityFailureMsg(
        err instanceof Error
          ? err.message
          : 'Photo failed quality check. Please retake in bright, even light.',
      );
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{copy.uploadTitle}</h1>
        <p className="text-sm text-slate-600 mt-1">{copy.uploadSubtitle}</p>
      </div>

      {qualityFailureMsg && (
        <div
          role="alert"
          className="bg-amber-50 border border-amber-300 rounded-xl p-5 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-amber-950">Photo Quality Check Failed — Re-upload Requested</p>
            <p className="text-sm text-amber-900">{qualityFailureMsg}</p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800"
        >
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Real Photo Upload & Local PII Redaction Preview */}
        <form
          onSubmit={handleUploadSubmit}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-6"
        >
          <div className="space-y-2">
            <p className="block text-sm font-semibold text-slate-900">
              Select or photograph your lab report (PNG, JPG, WebP)
            </p>
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-teal-600 transition-colors bg-slate-50/50">
              <FileUp className="w-7 h-7 text-slate-400 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-700 font-medium">
                Choose a scanned lab report image or take a photo
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Quality check and header PII masking run locally in your browser before anything is sent.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer">
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Choose Image</span>
                  <input
                    id="report-file-input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSimulateBlurryUpload}
                  className="px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer"
                >
                  Test Blurry Photo Rejection
                </button>
              </div>
            </div>
          </div>

          {processed && (
            <div className="space-y-4 border-t border-slate-200 pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <EyeOff className="w-4 h-4 text-teal-700" aria-hidden="true" />
                  <span>Local PII Mask Preview (Sent to AI)</span>
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-600">
                  Quality: {processed.qualityCheck.score}/100 · Blur: {processed.qualityCheck.blur_score} · Brightness: {processed.qualityCheck.brightness_score}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="mask-slider" className="flex justify-between text-xs font-medium text-slate-700">
                  <span>Top header redaction height (cover patient name, phone, ID, doctor)</span>
                  <span className="font-mono tabular-nums">{maskHeaderPercent}%</span>
                </label>
                <input
                  id="mask-slider"
                  type="range"
                  min={10}
                  max={40}
                  value={maskHeaderPercent}
                  onChange={(e) => handleMaskSliderChange(Number(e.target.value))}
                  className="w-full accent-teal-700"
                />
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-100 max-h-72 flex items-center justify-center">
                <img
                  src={processed.maskedDataUrl}
                  alt="Preview of uploaded lab report with top PII header redacted in black"
                  referrerPolicy="no-referrer"
                  className="max-h-72 w-auto object-contain"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label htmlFor="upload-visit-date" className="block text-xs font-medium text-slate-700 mb-1">
                Visit Date
              </label>
              <input
                id="upload-visit-date"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900 font-mono"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="upload-age-sex" className="block text-xs font-medium text-slate-700 mb-1">
                Age / Sex (Optional)
              </label>
              <input
                id="upload-age-sex"
                type="text"
                value={ageSex}
                onChange={(e) => setAgeSex(e.target.value)}
                placeholder="e.g. 54Y / F"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>
            <div className="sm:col-span-1">
              <label htmlFor="upload-title" className="block text-xs font-medium text-slate-700 mb-1">
                Report Label
              </label>
              <input
                id="upload-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Shield className="w-4 h-4 text-teal-700 shrink-0" aria-hidden="true" />
              <span>Original image stays encrypted; AI only sees masked data.</span>
            </div>
            <button
              type="submit"
              disabled={isProcessing || !processed || !processed.qualityCheck.passed}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              <span>Analyze Masked Report</span>
            </button>
          </div>

          {stageMessage && (
            <div role="status" className="text-sm text-teal-800 font-medium bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
              {stageMessage}
            </div>
          )}
        </form>

        {/* Right: Tips + Instant Synthetic Test Reports */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">{copy.photoTipsTitle}</h2>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Place the page flat on a table in bright, even natural light.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Include all four columns: Test Name, Result, Unit, and Reference Range.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" aria-hidden="true" />
                <span>Avoid harsh camera flash glare or angled shadows across numbers.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Run Synthetic Lab Reports</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Zero real patient data. Tests full PII masking, Rule Checker, Comorbidity Filter (C1–C7), and Output Verifier (V1–V8).
              </p>
            </div>

            <div className="space-y-3">
              {SYNTHETIC_PRESETS.slice(2).map((preset) => (
                <div
                  key={preset.id}
                  className="border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{preset.title}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {preset.visit_date} · {preset.rows.length} tests · {preset.patient_age_sex}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleRunSyntheticPreset(preset.id)}
                    className="px-3.5 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Run Pipeline
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
