import React from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  props!: React.PropsWithChildren;
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-full max-w-md border-2 border-red-600 shadow-[6px_6px_0_#dc2626] bg-[var(--bg-input)] p-8 flex flex-col gap-4">
            <div className="font-mono text-[9px] font-bold tracking-[0.4em] text-red-600 uppercase">ERROR DEL SISTEMA</div>
            <div className="font-mono font-black text-lg text-[var(--ink)] uppercase">Algo salió mal</div>
            <pre className="font-mono text-[10px] text-[var(--ink)]/60 bg-[var(--bg-card)] p-3 overflow-auto max-h-40 border border-[var(--border)]/20">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-[var(--ink)] text-[var(--ink-inv)] font-mono text-[11px] font-bold tracking-widest uppercase px-6 py-3 border border-[var(--border)] hover:bg-[var(--bg-input)] hover:text-[var(--ink)] transition-colors shadow-[4px_4px_0_var(--border)] active:shadow-none active:translate-y-1 active:translate-x-1"
            >
              RECARGAR APLICACIÓN
            </button>
          </div>
        </div>
      );
    }
    return <>{this.props.children}</>;
  }
}
