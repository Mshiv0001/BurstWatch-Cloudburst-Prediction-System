import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("BurstWatch Crash caught by ErrorBoundary:", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: '#f87171', background: '#0f172a', minHeight: '100vh', fontFamily: 'monospace', zIndex: 9999, position: 'relative' }}>
          <h2 style={{ fontSize: 20, color: '#ef4444', marginBottom: 12 }}>BurstWatch Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#1e293b', padding: 16, borderRadius: 8, color: '#fca5a5' }}>
            {this.state.error?.toString()}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#1e293b', padding: 16, borderRadius: 8, marginTop: 12, fontSize: 12, color: '#94a3b8' }}>
            {this.state.info?.componentStack || this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: 16, padding: '8px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);