import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles.css'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import PublicPage from './pages/PublicPage'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboard" element={<Onboarding />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/:slug" element={<PublicPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
