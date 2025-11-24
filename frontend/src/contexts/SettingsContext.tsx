import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type GestureSensitivity = 'Low' | 'Medium' | 'High'

export interface Settings {
  gestureSensitivity: GestureSensitivity
  mirrorCamera: boolean
  playSounds: boolean
}

interface SettingsContextValue {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
  gestureSensitivityFactor: number
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined)

// Map sensitivity levels to factors
// Higher factor = lower thresholds (easier to trigger)
// Lower factor = higher thresholds (harder to trigger)
const SENSITIVITY_FACTORS: Record<GestureSensitivity, number> = {
  Low: 1.3, // Higher thresholds (30% harder to trigger)
  Medium: 1.0, // Default (base thresholds)
  High: 0.7, // Lower thresholds (30% easier to trigger)
}

const DEFAULT_SETTINGS: Settings = {
  gestureSensitivity: 'Medium',
  mirrorCamera: false,
  playSounds: false,
}

const SETTINGS_STORAGE_KEY = 'motion-edu-app-settings'

function loadSettingsFromStorage(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.warn('Failed to load settings from localStorage:', error)
  }
  return DEFAULT_SETTINGS
}

function saveSettingsToStorage(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('Failed to save settings to localStorage:', error)
  }
}

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(loadSettingsFromStorage)

  // Load settings from localStorage on mount
  useEffect(() => {
    const loaded = loadSettingsFromStorage()
    setSettings(loaded)
  }, [])

  // Save settings to localStorage whenever they change
  useEffect(() => {
    saveSettingsToStorage(settings)
  }, [settings])

  const updateSettings = (updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }))
  }

  const gestureSensitivityFactor = SENSITIVITY_FACTORS[settings.gestureSensitivity]

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    gestureSensitivityFactor,
  }

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}

