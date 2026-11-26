import React, { useState } from 'react';
import { Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import type { LabResultItem, ReportRecord } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';

interface ClickToVerifyViewerProps {
  report: ReportRecord;
  highlightedKeys: string[];
  onSelectResultKey: (key: string) => void;
  copy: UiCopy;
}

export const ClickToVerifyViewer: React.FC<ClickToVerifyViewerProps> = ({
  report,
  highlightedKeys,
  onSelectResultKey,
  copy,
}) => {
  const [showOriginal, setShowOriginal] = useState(false);
  const [zoom, setZoom] = useState(1);

  const activeImageUrl = showOriginal ? report.original_image_url : report.masked_image_url;
  const highlightedResults: LabResultItem[] = report.results.filter((r) =>
    highlightedKeys.includes(r.result_key),
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{copy.clickToVerifyTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{copy.clickToVerifyHint}</p>
        </div>

        <div className="flex items-center gap-2">
          <div role="group" aria-label="Image redaction mode" className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setShowOriginal(false)}
              aria-pressed={!showOriginal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                !showOriginal ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.maskedViewLabel}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowOriginal(true)}
              aria-pressed={showOriginal}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                showOriginal ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{copy.originalViewLabel}</span>
            </button>
          </div>

          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              aria-label="Zoom out report"
              onClick={() => setZoom((z) => Math.max(0.85, Number((z - 0.15).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="px-2 text-xs font-mono tabular-nums text-slate-700 border-x border-slate-200">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              aria-label="Zoom in report"
              onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
              className="p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Active highlight status bar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
        {highlightedResults.length > 0 ? (
          <span>
            Highlighting:{' '}
            <strong className="text-teal-800 font-semibold">
              {highlightedResults.map((r) => `${r.display_name} (${r.value} ${r.unit_std}) [${r.result_key}]`).join(', ')}
            </strong>
          </span>
        ) : (
          <span>Click any sentence or test row on the left to highlight its exact source bounding box.</span>
        )}
        <span className="font-mono text-slate-500">
          {showOriginal ? 'Authorized original view' : `${report.pii_masks.length} PII zones masked`}
        </span>
      </div>

      {/* Report Document Stage with SVG Evidence Overlay */}
      <div className="overflow-auto bg-slate-100 p-4 max-h-[760px]" data-testid="click-to-verify-stage">
        <div
          style={{ width: `${Math.round(zoom * 100)}%` }}
          className="mx-auto transition-[width] duration-150 bg-white border border-slate-300 rounded shadow-xs"
        >
          <svg
            viewBox={`0 0 ${report.page_width} ${report.page_height}`}
            className="w-full h-auto block"
            role="img"
            aria-label={`Lab report page (${showOriginal ? 'original view' : 'PII masked view'}) with clickable bounding boxes`}
          >
            <image
              href={activeImageUrl}
              width={report.page_width}
              height={report.page_height}
            />

            {/* Interactive row overlays */}
            {report.results.map((res) => {
              const [x1, y1, x2, y2] = res.bbox;
              const isHighlighted = highlightedKeys.includes(res.result_key);
              const strokeColor =
                res.flag === 'critical'
                  ? '#b91c1c'
                  : res.flag === 'high' || res.flag === 'low'
                    ? '#d97706'
                    : '#0f766e';

              return (
                <g
                  key={res.result_key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Highlight ${res.display_name} (${res.result_key})`}
                  onClick={() => onSelectResultKey(res.result_key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectResultKey(res.result_key);
                    }
                  }}
                  className="cursor-pointer focus:outline-none"
                >
                  <rect
                    x={x1}
                    y={y1}
                    width={x2 - x1}
                    height={y2 - y1}
                    rx={4}
                    fill={isHighlighted ? 'rgba(15, 118, 110, 0.18)' : 'transparent'}
                    stroke={isHighlighted ? strokeColor : 'rgba(148, 163, 184, 0.35)'}
                    strokeWidth={isHighlighted ? 4 : 1.5}
                  />
                  {isHighlighted && (
                    <g>
                      <rect x={x1} y={Math.max(0, y1 - 24)} width={96} height={22} rx={3} fill={strokeColor} />
                      <text
                        x={x1 + 8}
                        y={Math.max(15, y1 - 9)}
                        fontFamily="monospace"
                        fontSize="12"
                        fontWeight="700"
                        fill="#ffffff"
                      >
                        {res.result_key} · {res.flag.toUpperCase()}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
};
