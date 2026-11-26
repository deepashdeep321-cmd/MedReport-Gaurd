import React from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Home, RefreshCw, RotateCcw } from 'lucide-react';
import { formatSafeErrorMessage } from './errorBoundaryUtils';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  scope?: 'application' | 'view';
  resetKey?: string;
  onRetry?: () => void | Promise<void>;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
  showDetails: boolean;
  isRetrying: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
      showDetails: false,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: unknown): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      errorMessage: formatSafeErrorMessage(error),
      showDetails: false,
      isRetrying: false,
    };
  }

  componentDidCatch(error: Error): void {
    // Log error type/message only; never log patient report content or PII.
    console.error(`[MedReport-Guard ErrorBoundary:${this.props.scope ?? 'application'}]`, error.name, error.message);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false, errorMessage: '', showDetails: false, isRetrying: false });
    }
  }

  handleTryAgain = async (): Promise<void> => {
    if (this.state.isRetrying) return;
    if (this.props.onRetry) {
      this.setState({ isRetrying: true });
      try {
        await Promise.resolve(this.props.onRetry());
      } finally {
        this.setState({ hasError: false, errorMessage: '', showDetails: false, isRetrying: false });
      }
      return;
    }
    this.setState({ hasError: false, errorMessage: '', showDetails: false, isRetrying: false });
  };

  handleGoHome = (): void => {
    this.setState({ hasError: false, errorMessage: '', showDetails: false, isRetrying: false });
    this.props.onReset?.();
  };

  handleReloadApp = (): void => {
    window.location.reload();
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isAppScope = (this.props.scope ?? 'application') === 'application';

    return (
      <div
        role="alert"
        className={
          isAppScope
            ? 'min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center p-6'
            : 'py-8'
        }
      >
        <div className="w-full max-w-xl mx-auto bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1.5">
              <h1 className="text-lg font-bold text-slate-900">
                {isAppScope
                  ? 'MedReport-Guard ran into an unexpected error'
                  : 'This screen could not be displayed'}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                A temporary display error was caught safely. Your encrypted lab reports are unaffected—choose an option below to recover.
              </p>
            </div>
          </div>

          {/* User-friendly recovery actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {isAppScope ? (
              <>
                <button
                  type="button"
                  onClick={this.handleReloadApp}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Reload App</span>
                </button>
                <button
                  type="button"
                  disabled={this.state.isRetrying}
                  onClick={this.handleTryAgain}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>{this.state.isRetrying ? 'Retrying...' : 'Try Again'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={this.state.isRetrying}
                  onClick={this.handleTryAgain}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>{this.state.isRetrying ? 'Retrying...' : 'Try Again'}</span>
                </button>

                {this.props.onReset && (
                  <button
                    type="button"
                    onClick={this.handleGoHome}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Home className="w-4 h-4" aria-hidden="true" />
                    <span>Go to Overview</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={this.handleReloadApp}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  <span>Reload App</span>
                </button>
              </>
            )}
          </div>

          {/* Collapsible sanitized error summary */}
          <div className="pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={this.toggleDetails}
              aria-expanded={this.state.showDetails}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              {this.state.showDetails ? (
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>{this.state.showDetails ? 'Hide error details' : 'Show error details'}</span>
            </button>

            {this.state.showDetails && (
              <div className="mt-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-xs font-mono text-slate-700 break-words">
                {this.state.errorMessage}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
