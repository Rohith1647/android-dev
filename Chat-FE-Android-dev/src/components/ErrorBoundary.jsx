import { Component } from 'react';
import { Button } from './ui';

/**
 * Last line of defence: a render error anywhere below shows a recoverable
 * screen instead of a blank page. Reporting is left as a single hook so an
 * error tracker can be attached without touching the UI.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.props.onError?.(error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center bg-navy px-4 py-10">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
          <h1 className="font-display text-lg font-semibold text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm text-ink-soft">
            The page hit an unexpected error. Reloading usually clears it.
          </p>
          <Button className="mt-5 w-full" onClick={() => window.location.reload()}>
            Reload CS Setu
          </Button>
        </div>
      </div>
    );
  }
}
