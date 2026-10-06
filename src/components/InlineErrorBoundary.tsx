import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Nazwa widoku do komunikatu, np. „Bez zdjęć”. */
  label: string;
  /** Zmiana tej wartości czyści błąd (np. po zmianie filtrów). */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Lokalna siatka bezpieczeństwa: błąd jednego widoku nie wywala całej aplikacji,
 * a treść błędu jest widoczna (do zgłoszenia), zamiast ogólnego „Coś poszło nie tak”.
 */
export class InlineErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Błąd widoku ${this.props.label}`, error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" />
          Widok „{this.props.label}” napotkał błąd
        </p>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-2 text-xs text-red-100/90">
          {String(this.state.error.stack || this.state.error.message).slice(0, 1200)}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-medium hover:bg-red-500/20"
        >
          Spróbuj ponownie
        </button>
      </div>
    );
  }
}
