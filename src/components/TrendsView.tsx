import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TrendPoint } from '../types/medreport';
import type { UiCopy } from '../i18n/translations';
import { api } from '../api/client';

interface TrendsViewProps {
  copy: UiCopy;
  onOpenUpload: () => void;
}

export const TrendsView: React.FC<TrendsViewProps> = ({ copy, onOpenUpload }) => {
  const [availableTests, setAvailableTests] = useState<
    Array<{ test_name_std: string; display_name: string; count: number }>
  >([]);
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTrends = async (testName?: string) => {
    setLoading(true);
    try {
      const data = await api.getTrends(testName);
      setAvailableTests(data.availableTests);
      setSelectedTest(data.selectedTest);
      setPoints(data.points);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrends();
  }, []);

  const currentMeta = availableTests.find((t) => t.test_name_std === selectedTest);
  const latestPoint = points[points.length - 1];
  const firstPoint = points[0];
  const refLow = latestPoint?.ref_low ?? null;
  const refHigh = latestPoint?.ref_high ?? null;

  const allValues = points.map((p) => p.value);
  if (refLow !== null) allValues.push(refLow);
  if (refHigh !== null) allValues.push(refHigh);
  const minDomain = allValues.length ? Math.floor(Math.min(...allValues) * 0.85 * 10) / 10 : 0;
  const maxDomain = allValues.length ? Math.ceil(Math.max(...allValues) * 1.15 * 10) / 10 : 100;

  let trendSentence = 'Upload more than one visit report to track how this test changes over time.';
  if (points.length >= 2 && firstPoint && latestPoint) {
    const delta = Number((latestPoint.value - firstPoint.value).toFixed(2));
    const direction = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stayed unchanged';
    trendSentence = `From ${firstPoint.visit_date} to ${latestPoint.visit_date}, ${currentMeta?.display_name || selectedTest} ${direction} from ${firstPoint.value} to ${latestPoint.value} ${latestPoint.unit_std}. Show this trend to your doctor at your next visit.`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{copy.trendsTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{copy.trendsSubtitle}</p>
        </div>

        {availableTests.length > 0 && (
          <div className="w-full sm:w-64">
            <label htmlFor="trend-test-select" className="block text-xs font-medium text-slate-600 mb-1">
              Select lab test
            </label>
            <select
              id="trend-test-select"
              value={selectedTest}
              onChange={(e) => loadTrends(e.target.value)}
              className="w-full px-3 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-lg"
            >
              {availableTests.map((t) => (
                <option key={t.test_name_std} value={t.test_name_std}>
                  {t.display_name} ({t.count} visits)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Loading longitudinal visit data...
        </div>
      ) : points.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <p className="text-base font-semibold text-slate-900">No lab trend data yet</p>
          <p className="text-sm text-slate-600">
            Upload reports from multiple visits to compare results over time against the lab reference band.
          </p>
          <button
            type="button"
            onClick={onOpenUpload}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
          >
            {copy.ctaUpload}
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {currentMeta?.display_name || selectedTest}
              </h2>
              <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
                Unit: {latestPoint?.unit_std} · Printed reference band:{' '}
                {refLow !== null && refHigh !== null
                  ? `${refLow} – ${refHigh} ${latestPoint?.unit_std}`
                  : 'Not printed'}
              </p>
            </div>
            {latestPoint && (
              <div className="text-right">
                <p className="text-xs text-slate-500">Latest ({latestPoint.visit_date})</p>
                <p className="text-2xl font-mono font-bold tabular-nums text-slate-900">
                  {latestPoint.value}{' '}
                  <span className="text-xs font-normal text-slate-500">{latestPoint.unit_std}</span>
                </p>
              </div>
            )}
          </div>

          {/* Recharts Line Chart with Shaded Reference Band */}
          <div className="w-full h-80" data-testid="trends-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="visit_date"
                  tick={{ fontSize: 12, fill: '#475569' }}
                  stroke="#cbd5e1"
                />
                <YAxis
                  domain={[minDomain, maxDomain]}
                  tick={{ fontSize: 12, fill: '#475569' }}
                  stroke="#cbd5e1"
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                  }}
                />
                {refLow !== null && refHigh !== null && (
                  <ReferenceArea
                    y1={refLow}
                    y2={refHigh}
                    fill="#10b981"
                    fillOpacity={0.14}
                    stroke="#10b981"
                    strokeOpacity={0.3}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  name={currentMeta?.display_name || selectedTest}
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#0f766e', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-1">
            <p className="text-sm font-medium text-slate-900">{trendSentence}</p>
            <p className="text-xs text-slate-500">
              Shaded green band shows the reference range printed on your latest lab report.
            </p>
          </div>

          {/* Tabular Visit History */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Visit Date</th>
                  <th className="py-2 px-4 font-semibold text-right">Value</th>
                  <th className="py-2 px-4 font-semibold">Printed Range</th>
                  <th className="py-2 pl-4 font-semibold">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {points.map((pt) => (
                  <tr key={`${pt.report_id}-${pt.visit_date}`}>
                    <td className="py-2.5 pr-4 font-mono tabular-nums text-slate-700">{pt.visit_date}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {pt.value} {pt.unit_std}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-500">
                      {pt.ref_low !== null && pt.ref_high !== null ? `${pt.ref_low} – ${pt.ref_high}` : '—'}
                    </td>
                    <td className="py-2.5 pl-4 text-xs font-semibold capitalize text-slate-800">{pt.flag}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
