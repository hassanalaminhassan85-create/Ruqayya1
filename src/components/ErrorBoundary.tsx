import * as React from 'react';
import { AlertOctagon, RotateCw, Copy, Check } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  // Explicit properties for strict environments
  public declare props: Props;
  public declare setState: (
    state: Partial<State> | ((state: State) => Partial<State>),
    callback?: () => void
  ) => void;

  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleCopy = () => {
    const { error, errorInfo } = this.state;
    const errorDetails = `
Error Name: ${error?.name}
Error Message: ${error?.message}
Stack Trace: ${error?.stack}
Component Stack: ${errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-red-50 border-b border-red-100 p-6 flex items-start gap-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                <AlertOctagon className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-slate-900">Application Runtime Exception</h2>
                <p className="text-xs text-slate-500 mt-1">
                  An unexpected error occurred causing the system to halt. See diagnostic details below.
                </p>
              </div>
            </div>

            {/* Main Details */}
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Error Signature</div>
                <div className="text-sm font-bold text-red-600 mt-1 font-mono break-all">{error?.name}: {error?.message}</div>
              </div>

              {error?.stack && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">Stack Trace Details</div>
                  <pre className="text-[11px] font-mono leading-relaxed bg-slate-900 text-slate-300 p-4 rounded-xl overflow-auto max-h-48 whitespace-pre-wrap border border-slate-850">
                    {error.stack}
                  </pre>
                </div>
              )}

              {errorInfo?.componentStack && (
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">Component Mount Tree</div>
                  <pre className="text-[11px] font-mono leading-relaxed bg-slate-900 text-slate-300 p-4 rounded-xl overflow-auto max-h-36 whitespace-pre-wrap border border-slate-850">
                    {errorInfo.componentStack}
                  </pre>
                </div>
              )}
            </div>

            {/* Footer Control Panel */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={this.handleCopy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Copied Signature
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Diagnostic Signature
                  </>
                )}
              </button>

              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Reboot Application Node
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
