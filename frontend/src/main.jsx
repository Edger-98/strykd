import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import './styles.css'
import Dashboard from './pages/Dashboard'
import Journey from './pages/Journey'
import Tasks from './pages/Tasks'
import Settings from './pages/Settings'
import Landing from './pages/Landing'
import Onboarding from './pages/Onboarding'
import PublicPage from './pages/PublicPage'
import ResetPassword from './pages/ResetPassword'
import SharedListPage from './pages/SharedListPage'
import Contact from './pages/Contact'

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/onboard" element={<Onboarding />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard/journey" element={<Journey />} />
        <Route path="/dashboard/tasks" element={<Tasks />} />
        <Route path="/dashboard/settings" element={<Settings />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/shared/:code" element={<SharedListPage />} />
        <Route path="/:slug" element={<PublicPage />} />
      </Routes>
    </AnimatePresence>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  </React.StrictMode>
)
