import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  effectiveTheme: 'light' | 'dark' // Resolved theme (if system, resolves to light/dark)
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const THEME_STORAGE_KEY = 'motion-edu-app-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function loadThemeFromStorage(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch (error) {
    console.warn('Failed to load theme from localStorage:', error)
  }
  return 'system' // Default to system preference
}

function saveThemeToStorage(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error)
  }
}

function applyThemeToDocument(effectiveTheme: 'light' | 'dark'): void {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', effectiveTheme)
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(loadThemeFromStorage)
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(() => {
    const saved = loadThemeFromStorage()
    if (saved === 'system') {
      return getSystemTheme()
    }
    return saved
  })

  // Apply theme to document on mount and when effective theme changes
  useEffect(() => {
    applyThemeToDocument(effectiveTheme)
  }, [effectiveTheme])

  // Update effective theme when theme preference changes
  useEffect(() => {
    if (theme === 'system') {
      const systemTheme = getSystemTheme()
      setEffectiveTheme(systemTheme)
    } else {
      setEffectiveTheme(theme)
    }
  }, [theme])

  // Listen for system theme changes when using 'system' preference
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setEffectiveTheme(e.matches ? 'dark' : 'light')
    }

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    saveThemeToStorage(newTheme)
    
    if (newTheme === 'system') {
      setEffectiveTheme(getSystemTheme())
    } else {
      setEffectiveTheme(newTheme)
    }
  }

  const value: ThemeContextValue = {
    theme,
    effectiveTheme,
    setTheme,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

