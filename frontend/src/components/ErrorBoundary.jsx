import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV
      return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
          <h2>Algo salió mal</h2>
          <p>Recargá la página. Si el problema persiste, contactá soporte.</p>
          <button onClick={() => window.location.reload()}>Recargar</button>
          {isDev && (
            <pre style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#c00', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
