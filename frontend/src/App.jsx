import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Missions from './pages/Missions'
import Satellites from './pages/Satellites'
import Telemetry from './pages/Telemetry'
import Anomalies from './pages/Anomalies'
import GroundStations from './pages/GroundStations'
import Reports from './pages/Reports'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'red', background: 'white' }}>
          <h2>App Crash:</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error?.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<PrivateRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/missions" element={<Missions />} />
                <Route path="/satellites" element={<Satellites />} />
                <Route path="/telemetry" element={<Telemetry />} />
                <Route path="/anomalies" element={<Anomalies />} />
                <Route path="/ground-stations" element={<GroundStations />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App