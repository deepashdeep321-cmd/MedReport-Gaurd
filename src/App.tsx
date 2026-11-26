import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';
import { UI_COPY } from './i18n/translations';
import { MANDATORY_DISCLAIMER } from './pipeline/rulesData';
import type { AuthUser, LanguageCode, ReportRecord } from './types/medreport';
import { TopNav, type AppView } from './components/TopNav';
import { HomeView } from './components/HomeView';
import { UploadView } from './components/UploadView';
import { SummaryView } from './components/SummaryView';
import { ConfirmValuesView } from './components/ConfirmValuesView';
import { TrendsView } from './components/TrendsView';
import { SettingsView, type TextScaleMode } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { extractSafeReports } from './components/errorBoundaryUtils';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('overview');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [textScale, setTextScale] = useState<TextScaleMode>('standard');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const copy = UI_COPY[language] || UI_COPY.en;

  const fetchReports = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await api.listReports();
      const { reports: safeReports, valid } = extractSafeReports(data);
      if (!valid) {
        setLoadError('Received an unexpected response while loading reports. Please try again.');
        setReports([]);
        setSelectedReportId(null);
        return;
      }
      setReports(safeReports);
      setSelectedReportId((prev) => {
        if (prev && safeReports.some((r) => r.id === prev)) return prev;
        return safeReports[0]?.id ?? null;
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
    api
      .me()
      .then((res) => {
        setAuthUser(res.user);
        setIsAuthenticated(res.authenticated);
      })
      .catch(() => {});
  }, [fetchReports]);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('text-scale-standard', 'text-scale-large', 'text-scale-xlarge');
    html.classList.add(`text-scale-${textScale}`);
    html.lang = language;
  }, [textScale, language]);

  const activeReport = reports.find((r) => r.id === selectedReportId) || reports[0] || null;

  const handleSelectReport = (reportId: string, openConfirm = false) => {
    setSelectedReportId(reportId);
    setActiveView(openConfirm ? 'confirm' : 'summary');
  };

  const handleReportCreated = (report: ReportRecord) => {
    setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
    setSelectedReportId(report.id);
    const results = Array.isArray(report.results) ? report.results : [];
    const hasLowConf = results.some((r) => r.needs_confirmation && !r.user_confirmed);
    setActiveView(hasLowConf ? 'confirm' : 'summary');
  };

  const handleReportUpdated = (updated: ReportRecord) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSelectedReportId(updated.id);
    const results = Array.isArray(updated.results) ? updated.results : [];
    const stillLowConf = results.some((r) => r.needs_confirmation && !r.user_confirmed);
    if (!stillLowConf) {
      setActiveView('summary');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <TopNav activeView={activeView} onNavigate={setActiveView} copy={copy} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {loadError && (
          <div role="alert" className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
            {loadError}
          </div>
        )}

        <ErrorBoundary
          scope="view"
          resetKey={activeView}
          onRetry={fetchReports}
          onReset={() => setActiveView('overview')}
        >
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Loading MedReport-Guard workspace...
            </div>
          ) : (
            <>
              {activeView === 'overview' && (
                <HomeView
                  reports={reports}
                  language={language}
                  onLanguageChange={setLanguage}
                  onSelectReport={handleSelectReport}
                  onStartUpload={() => setActiveView('upload')}
                  onOpenTrends={() => setActiveView('trends')}
                  copy={copy}
                />
              )}

              {activeView === 'upload' && (
                <UploadView copy={copy} onReportCreated={handleReportCreated} />
              )}

              {activeView === 'summary' && (
                <SummaryView
                  reports={reports}
                  activeReport={activeReport}
                  language={language}
                  onLanguageChange={setLanguage}
                  onSelectReportId={setSelectedReportId}
                  onOpenConfirm={() => setActiveView('confirm')}
                  onOpenUpload={() => setActiveView('upload')}
                  copy={copy}
                />
              )}

              {activeView === 'confirm' && (
                activeReport ? (
                  <ConfirmValuesView
                    report={activeReport}
                    copy={copy}
                    onReportUpdated={handleReportUpdated}
                    onBackToSummary={() => setActiveView('summary')}
                  />
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
                    <h1 className="text-xl font-bold text-slate-900">No Report Selected to Confirm</h1>
                    <p className="text-sm text-slate-600">
                      Select an existing lab report or upload a new one to review low-confidence values.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveView('overview')}
                      className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                    >
                      Return to Overview
                    </button>
                  </div>
                )
              )}

              {activeView === 'trends' && (
                <TrendsView copy={copy} onOpenUpload={() => setActiveView('upload')} />
              )}

              {activeView === 'settings' && (
                <SettingsView
                  copy={copy}
                  language={language}
                  onLanguageChange={setLanguage}
                  textScale={textScale}
                  onTextScaleChange={setTextScale}
                  authUser={authUser}
                  isAuthenticated={isAuthenticated}
                  reports={reports}
                  onAuthUpdated={(user, authed) => {
                    setAuthUser(user);
                    setIsAuthenticated(authed);
                  }}
                  onReportsChanged={fetchReports}
                  onOpenAdmin={() => setActiveView('admin')}
                />
              )}

              {activeView === 'admin' && (
                <AdminView onBack={() => setActiveView('settings')} />
              )}
            </>
          )}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <p className="font-medium text-slate-700">{MANDATORY_DISCLAIMER[language] || MANDATORY_DISCLAIMER.en}</p>
          <p>MedReport-Guard Prototype · Synthetic demonstration data only</p>
        </div>
      </footer>
    </div>
  );
}
