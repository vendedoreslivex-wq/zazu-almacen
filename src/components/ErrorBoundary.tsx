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
        <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center gap-6 p-8">
          <div className="w-full max-w-md border-2 border-red-600 shadow-[6px_6px_0_#dc2626] bg-white p-8 flex flex-col gap-4">
            <div className="font-mono text-[9px] font-bold tracking-[0.4em] text-red-600 uppercase">ERROR DEL SISTEMA</div>
            <div className="font-mono font-black text-lg text-[#141414] uppercase">Algo salió mal</div>
            <pre className="font-mono text-[10px] text-[#141414]/60 bg-[#f5f5f4] p-3 overflow-auto max-h-40 border border-[#141414]/20">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="bg-[#141414] text-[#E4E3E0] font-mono text-[11px] font-bold tracking-widest uppercase px-6 py-3 border border-[#141414] hover:bg-white hover:text-[#141414] transition-colors shadow-[4px_4px_0_#141414] active:shadow-none active:translate-y-1 active:translate-x-1"
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
