import { Component } from 'react';

// Without this, an unhandled error anywhere in the component tree unmounts the whole app and
// leaves a blank page -- this catches it and shows something a manager or client can act on
// (reload, or come back later) instead.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in the app:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong</h1>
          <p>Please try reloading the page. If the problem continues, contact your implementation manager.</p>
          <button type="button" className="primary-button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
