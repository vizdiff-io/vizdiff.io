import React from 'react';
import posthog from 'posthog-js';
import { getIsDev } from 'util/env';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    const isDev = getIsDev();
    if (!isDev) {
      posthog.capture('error', { error, errorInfo });
    }
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      const isDev = getIsDev();
      if (isDev) {
        console.log(this.state.error);
      }
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
