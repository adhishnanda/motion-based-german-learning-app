import React, { useState, useEffect } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { downloadGestureLog, clearGestureLog, getGestureLog } from '../utils/gestureLogger'
import { useTelemetry } from '../contexts/TelemetryContext'
import { useSettings } from '../contexts/SettingsContext'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

// Default values
const DEFAULT_GESTURE_SENSITIVITY = 0.12
const DEFAULT_SHOW_CAMERA = true
const STORAGE_KEYS = {
  GESTURE_SENSITIVITY: 'gestureSensitivity',
  SHOW_CAMERA: 'showCamera',
  DARK_MODE: 'darkMode',
} as const

// Helper functions for localStorage
function loadNumberFromStorage(key: string, defaultValue: number): number {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed)) {
        return parsed
      }
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
  }
  return defaultValue
}

function loadBooleanFromStorage(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored !== null) {
      return stored === 'true'
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error)
  }
  return defaultValue
}

function saveToStorage(key: string, value: string | number | boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error)
  }
}

function resetAllProgress(): void {
  try {
    // Remove all keys starting with "progress:"
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('progress:')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))

    // Remove gestureLog
    localStorage.removeItem('gestureLog')

    console.log(`Removed ${keysToRemove.length} progress keys and gestureLog`)
  } catch (error) {
    console.error('Failed to reset progress:', error)
    throw error
  }
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme, effectiveTheme } = useTheme()
  const { logs: telemetryLogs, clearLogs: clearTelemetryLogs, exportToCSV, exportToJSON, logEvent } = useTelemetry()
  const { updateSettings } = useSettings()
  
  // Local state for settings
  const [gestureSensitivity, setGestureSensitivity] = useState<number>(() =>
    loadNumberFromStorage(STORAGE_KEYS.GESTURE_SENSITIVITY, DEFAULT_GESTURE_SENSITIVITY)
  )
  const [showCamera, setShowCamera] = useState<boolean>(() =>
    loadBooleanFromStorage(STORAGE_KEYS.SHOW_CAMERA, DEFAULT_SHOW_CAMERA)
  )

  // Load settings from localStorage on mount
  useEffect(() => {
    setGestureSensitivity(loadNumberFromStorage(STORAGE_KEYS.GESTURE_SENSITIVITY, DEFAULT_GESTURE_SENSITIVITY))
    setShowCamera(loadBooleanFromStorage(STORAGE_KEYS.SHOW_CAMERA, DEFAULT_SHOW_CAMERA))
  }, [isOpen]) // Reload when panel opens

  // Save gesture sensitivity to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.GESTURE_SENSITIVITY, gestureSensitivity)
  }, [gestureSensitivity])

  // Save show camera to localStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.SHOW_CAMERA, showCamera)
  }, [showCamera])

  // Handle gesture sensitivity change
  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value) && value >= 0 && value <= 1) {
      const oldValue = gestureSensitivity
      setGestureSensitivity(value)
      // Log telemetry event for sensitivity change
      logEvent({
        categoryId: null,
        cardIndex: null,
        german: null,
        english: null,
        gesture: 'REST',
        actionType: `settings_change:gestureSensitivity:${oldValue.toFixed(2)}->${value.toFixed(2)}`,
      })
    }
  }

  // Handle show camera toggle
  const handleShowCameraToggle = () => {
    const newValue = !showCamera
    setShowCamera(newValue)
    saveToStorage(STORAGE_KEYS.SHOW_CAMERA, newValue)
    // Trigger storage event so LessonPage can react
    window.dispatchEvent(new StorageEvent('storage', {
      key: STORAGE_KEYS.SHOW_CAMERA,
      newValue: String(newValue),
    }))
  }

  // Handle dark mode toggle
  const handleDarkModeToggle = () => {
    const newTheme = effectiveTheme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    saveToStorage(STORAGE_KEYS.DARK_MODE, newTheme === 'dark')
  }

  // Handle download gesture log
  const handleDownloadGestureLog = () => {
    const logCount = getGestureLog().length
    if (logCount > 0) {
      downloadGestureLog('gesture_log.csv')
    } else {
      alert('No gesture log data available to download.')
    }
  }

  // Handle clear gesture log
  const handleClearGestureLog = () => {
    const logCount = getGestureLog().length
    if (logCount > 0) {
      if (confirm(`Are you sure you want to clear ${logCount} gesture log entries?`)) {
        clearGestureLog()
        alert('Gesture log cleared successfully.')
      }
    } else {
      alert('Gesture log is already empty.')
    }
  }

  // Handle reset all progress
  const handleResetAllProgress = () => {
    // Count progress keys
    let progressCount = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('progress:')) {
          progressCount++
        }
      }
    } catch {
      // Ignore errors
    }

    const logCount = getGestureLog().length
    const totalItems = progressCount + (logCount > 0 ? 1 : 0)

    if (totalItems > 0) {
      const message = `Are you sure you want to reset all progress?\n\nThis will:\n- Remove progress for ${progressCount} categor${progressCount !== 1 ? 'ies' : 'y'}\n${logCount > 0 ? `- Clear ${logCount} gesture log entries\n` : ''}\nThis action cannot be undone.`
      
      if (confirm(message)) {
        try {
          resetAllProgress()
          alert('All progress has been reset successfully.')
          // Reload page to reflect changes
          window.location.reload()
        } catch (error) {
          alert('Failed to reset progress. Please try again.')
          console.error('Failed to reset progress:', error)
        }
      }
    } else {
      alert('No progress data to reset.')
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="settings-overlay"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            onClose()
          }
        }}
        aria-hidden="true"
      />

      {/* Settings panel */}
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button
            className="settings-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        <div className="settings-content">
          {/* Gesture Sensitivity Slider */}
          <div className="settings-group">
            <div className="settings-sensitivity-control">
              <label className="settings-sensitivity-label" htmlFor="gesture-sensitivity-slider">
                Gesture Sensitivity
              </label>
              <div className="settings-sensitivity-input-group">
                <input
                  id="gesture-sensitivity-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={gestureSensitivity}
                  onChange={handleSensitivityChange}
                  className="settings-sensitivity-slider"
                />
                <span className="settings-sensitivity-value">{gestureSensitivity.toFixed(2)}</span>
              </div>
            </div>
            <p className="settings-description">
              Adjust how easily gestures are detected. Lower values = easier to trigger, Higher values = harder to trigger.
              Default: {DEFAULT_GESTURE_SENSITIVITY}
            </p>
          </div>

          {/* Show Camera Toggle */}
          <div className="settings-group">
            <label className="settings-toggle-label">
              <span>Show Camera Feed</span>
              <button
                className={`settings-toggle ${showCamera ? 'active' : ''}`}
                onClick={handleShowCameraToggle}
                aria-pressed={showCamera}
                type="button"
              >
                <span className="settings-toggle-slider" />
              </button>
            </label>
            <p className="settings-description">
              Toggle visibility of the camera feed in the lesson page.
            </p>
          </div>

          {/* Dark Mode Toggle */}
          <div className="settings-group">
            <label className="settings-toggle-label">
              <span>Dark Mode</span>
              <button
                className={`settings-toggle ${effectiveTheme === 'dark' ? 'active' : ''}`}
                onClick={handleDarkModeToggle}
                aria-pressed={effectiveTheme === 'dark'}
                type="button"
              >
                <span className="settings-toggle-slider" />
              </button>
            </label>
            <p className="settings-description">
              Toggle between light and dark theme.
            </p>
          </div>

          {/* Gesture Telemetry (Legacy) */}
          <div className="settings-group">
            <h3 className="settings-section-title">Gesture Telemetry (Legacy)</h3>
            <div className="settings-button-group">
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={handleDownloadGestureLog}
                type="button"
              >
                📥 Download Gesture Log (Legacy)
              </button>
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={handleClearGestureLog}
                type="button"
              >
                🗑️ Clear Gesture Log (Legacy)
              </button>
            </div>
            <p className="settings-description">
              Download or clear legacy gesture interaction data for analysis.
            </p>
          </div>

          {/* Telemetry / Diagnostics */}
          <div className="settings-group">
            <h3 className="settings-section-title">Diagnostics / Telemetry</h3>
            <p className="settings-description" style={{ marginBottom: '0.75rem' }}>
              Current session has {telemetryLogs.length} logged events.
            </p>
            <div className="settings-button-group">
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={() => {
                  const csv = exportToCSV()
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `telemetry_${new Date().toISOString().split('T')[0]}.csv`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                }}
                type="button"
                disabled={telemetryLogs.length === 0}
              >
                📥 Export Logs (CSV)
              </button>
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={() => {
                  const json = exportToJSON()
                  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url
                  link.download = `telemetry_${new Date().toISOString().split('T')[0]}.json`
                  document.body.appendChild(link)
                  link.click()
                  document.body.removeChild(link)
                  URL.revokeObjectURL(url)
                }}
                type="button"
                disabled={telemetryLogs.length === 0}
              >
                📥 Export Logs (JSON)
              </button>
              <button
                className="btn btn-secondary settings-action-btn"
                onClick={() => {
                  if (telemetryLogs.length > 0) {
                    if (confirm(`Are you sure you want to clear ${telemetryLogs.length} telemetry log entries?`)) {
                      clearTelemetryLogs()
                      alert('Telemetry logs cleared successfully.')
                    }
                  } else {
                    alert('Telemetry log is already empty.')
                  }
                }}
                type="button"
                disabled={telemetryLogs.length === 0}
              >
                🗑️ Clear Logs
              </button>
            </div>
            <p className="settings-description">
              Export or clear telemetry data for analysis. Data includes gesture interactions, card navigation, and lesson behavior. All data stays on your device.
            </p>
          </div>

          {/* Reset Progress */}
          <div className="settings-group">
            <h3 className="settings-section-title">Reset Data</h3>
            <button
              className="btn btn-danger settings-action-btn"
              onClick={handleResetAllProgress}
              type="button"
            >
              🔄 Reset All Progress
            </button>
            <p className="settings-description">
              Clear all lesson progress for all categories and gesture logs. This action cannot be undone.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export default SettingsPanel

// Export utility functions for use in other components
export function loadGestureSensitivity(): number {
  return loadNumberFromStorage(STORAGE_KEYS.GESTURE_SENSITIVITY, DEFAULT_GESTURE_SENSITIVITY)
}

export function loadShowCamera(): boolean {
  return loadBooleanFromStorage(STORAGE_KEYS.SHOW_CAMERA, DEFAULT_SHOW_CAMERA)
}
