import { useState, useEffect } from 'react'

const ONBOARDING_STORAGE_KEY = 'motion-edu-app-has-seen-onboarding'

export function useOnboarding(): [boolean, () => void] {
  // Default to false (don't show) to avoid flash; useEffect will check localStorage and show if needed
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false)

  // Load onboarding status from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (stored === null) {
        // First visit - show onboarding
        setShowOnboarding(true)
      } else {
        // Already seen - don't show
        setShowOnboarding(false)
      }
    } catch (error) {
      console.warn('Failed to load onboarding status from localStorage:', error)
      // On error, default to showing onboarding (safer for new users)
      setShowOnboarding(true)
    }
  }, [])

  const dismissOnboarding = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true')
      setShowOnboarding(false)
    } catch (error) {
      console.warn('Failed to save onboarding status to localStorage:', error)
      // Still update state even if localStorage fails
      setShowOnboarding(false)
    }
  }

  return [showOnboarding, dismissOnboarding]
}

