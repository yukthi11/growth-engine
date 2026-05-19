import React from 'react';
import Dashboard from './pages/Dashboard';
import R2StorageModal from './components/R2StorageModal';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("🔥 [React Error]:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', background: '#050811', color: '#ff4444', fontFamily: 'monospace', height: '100vh' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>🚨 GROWTH ENGINE CRASHED</h1>
          <pre style={{ background: '#111', padding: '20px', borderRadius: '10px', overflowX: 'auto', border: '1px solid #333' }}>
            {this.state.error?.stack || this.state.error?.message || "Unknown Error"}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '10px 20px', background: '#444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
            Try Reloading
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-midnight">
        <R2StorageModal />
        <Dashboard />
      </div>
    </ErrorBoundary>
  );
}

export default App;
