import { Component } from 'react';

// Last-resort error screen. Text is bilingual because the language context may be what failed.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('BenefitBridge crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container-page max-w-xl py-16 text-center" role="alert">
        <h1 className="font-display text-3xl font-bold">Something went wrong · Algo salió mal</h1>
        <p className="mt-3 text-muted-foreground">
          Please reload the page. For help right now, dial <a className="font-bold underline" href="tel:211">2-1-1</a>.
          <br />
          Por favor recargue la página. Para ayuda ahora mismo, marque <a className="font-bold underline" href="tel:211">2-1-1</a>.
        </p>
        <button type="button" className="mt-6 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" onClick={() => window.location.assign('/')}>
          Home · Inicio
        </button>
      </div>
    );
  }
}
