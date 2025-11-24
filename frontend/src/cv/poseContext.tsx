import React, { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react'
import type { GestureType } from './gestureTypes'

interface PoseContextValue {
  currentGesture: GestureType
  setGesture: (g: GestureType) => void
}

const defaultContextValue: PoseContextValue = {
  currentGesture: 'REST',
  setGesture: () => {
    // No-op function for default context
  },
}

const PoseContext = createContext<PoseContextValue | undefined>(undefined)

interface PoseProviderProps {
  children: ReactNode
}

// Performance constants
const THROTTLE_MS = 66 // ~15 FPS (1000 / 15)
const DEBOUNCE_MS = 150 // 120-180ms window (using middle value)

export function PoseProvider({ children }: PoseProviderProps) {
  const [currentGesture, setCurrentGesture] = useState<GestureType>('REST')
  
  // Throttling refs
  const lastUpdateTimeRef = useRef<number>(0)
  const rafIdRef = useRef<number | null>(null)
  
  // Debouncing refs
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingGestureRef = useRef<GestureType | null>(null)
  const lastGestureRef = useRef<GestureType>('REST')

  // Throttled and debounced gesture setter
  const setGesture = useCallback((g: GestureType) => {
    // Performance log
    console.log('[Performance] Gesture throttled: Request for', g)
    
    // Cancel any pending debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    // Store pending gesture
    pendingGestureRef.current = g
    
    // Debounce: Wait 150ms before actually changing gesture
    debounceTimerRef.current = setTimeout(() => {
      const gestureToSet = pendingGestureRef.current
      if (gestureToSet === null) return
      
      // Check if gesture actually changed
      if (gestureToSet === lastGestureRef.current) {
        pendingGestureRef.current = null
        return
      }
      
      // Throttle: Only update at most every 66ms (15 FPS)
      const now = Date.now()
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current
      
      if (timeSinceLastUpdate >= THROTTLE_MS) {
        // Update immediately
        lastUpdateTimeRef.current = now
        lastGestureRef.current = gestureToSet
        setCurrentGesture(gestureToSet)
        console.log('[Performance] FPS update: Gesture set to', gestureToSet)
        pendingGestureRef.current = null
      } else {
        // Schedule update via requestAnimationFrame
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current)
        }
        
        rafIdRef.current = requestAnimationFrame(() => {
          // Double-check throttle after RAF
          const now = Date.now()
          if (now - lastUpdateTimeRef.current >= THROTTLE_MS) {
            lastUpdateTimeRef.current = now
            lastGestureRef.current = pendingGestureRef.current!
            setCurrentGesture(pendingGestureRef.current!)
            console.log('[Performance] FPS update (RAF): Gesture set to', pendingGestureRef.current)
            pendingGestureRef.current = null
            rafIdRef.current = null
          }
        })
      }
    }, DEBOUNCE_MS)
  }, [])

  const value: PoseContextValue = {
    currentGesture,
    setGesture,
  }

  return <PoseContext.Provider value={value}>{children}</PoseContext.Provider>
}

export function usePoseContext(): PoseContextValue {
  const ctx = useContext(PoseContext)

  if (!ctx) {
    throw new Error('usePoseContext must be used within a PoseProvider')
  }

  return ctx
}

