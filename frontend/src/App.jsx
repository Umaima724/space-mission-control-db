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

function App() {
  return (
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
  )
}

export default App