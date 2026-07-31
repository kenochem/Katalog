import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Zamiast białego ekranu po crashu React — odzyskanie. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-400" />
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Coś poszło nie tak</h1>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            Widok się zawiesił. Odśwież stronę — dane w katalogu są bezpieczne.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-500"
        >
          Odśwież stronę
        </button>
      </div>
    );
  }
}
