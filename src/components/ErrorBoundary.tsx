import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message;
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && parsed.error) {
        readable = `${parsed.operationType?.toUpperCase() || 'FIRESTORE'} error on ${parsed.path || 'unknown path'}: ${parsed.error}`;
      }
    } catch {
      // keep raw error message
    }
    return { hasError: true, errorMessage: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
            <div className="flex items-center gap-3 text-red-700 mb-3">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">
                Application Error Encountered
              </h1>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-relaxed">
              A runtime or database permission error interrupted this view. Details are shown below for verification.
            </p>
            <pre className="text-xs font-mono bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-800 overflow-x-auto whitespace-pre-wrap mb-6">
              {this.state.errorMessage}
            </pre>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#0F1E3D] rounded-lg hover:bg-[#19305E] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reload View
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
