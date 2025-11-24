import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import SettingsPanel from './SettingsPanel'
import '../styles/components.css'

const AppHeader: React.FC = () => {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const location = useLocation()
  const isHomePage = location.pathname === '/'

  return (
    <>
      <header className="app-header">
        <div className="app-header-container">
          {/* Left side: App name/logo */}
          <Link to="/" className="app-header-logo">
            MotionDeutsch
          </Link>

          {/* Right side: Navigation */}
          <nav className="app-header-nav">
            {!isHomePage && (
              <Link to="/" className="app-header-nav-link">
                Home
              </Link>
            )}
            <button
              className="app-header-settings-btn"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              aria-label="Open settings"
            >
              ⚙️
            </button>
          </nav>
        </div>
      </header>

      {/* Settings Panel */}
      <SettingsPanel isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  )
}

export default AppHeader

