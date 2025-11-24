import React, { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from 'react'
import type { GestureType } from '../cv/gestureTypes'

/**
 * Telemetry event input (without derived fields like id, timestamp, sessionId).
 * This is what components pass when logging events.
 */
export interface TelemetryEventInput {
  categoryId: string | null
  cardIndex: number | null
  german: string | null
  english: string | null
  gesture: GestureType | 'KEYBOARD_NEXT' | 'KEYBOARD_PREV' | 'KEYBOARD_SELECT' | 'REST'
  actionType: string // e.g., "navigate_next", "navigate_prev", "toggle_translation", "no_action"
}

/**
 * Complete telemetry entry with all fields including derived ones.
 */
export interface TelemetryEntry {
  id: string // UUID or timestamp-based unique identifier
  timestamp: string // ISO 8601 string
  sessionId: string // Unique session identifier (date-based + random suffix)
  categoryId: string | null
  cardIndex: number | null
  german: string | null
  english: string | null
  gesture: GestureType | 'KEYBOARD_NEXT' | 'KEYBOARD_PREV' | 'KEYBOARD_SELECT' | 'REST'
  actionType: string
}

interface TelemetryContextValue {
  logs: TelemetryEntry[]
  logEvent: (event: TelemetryEventInput) => void
  clearLogs: () => void
  exportToCSV: () => string
  exportToJSON: () => string
}

const TelemetryContext = createContext<TelemetryContextValue | undefined>(undefined)

interface TelemetryProviderProps {
  children: ReactNode
}

const STORAGE_KEY = 'gestureTelemetry'
const MAX_LOG_SIZE = 10000 // Prevent localStorage from getting too large
const DEBOUNCE_MS = 200 // Debounce localStorage writes by 200ms

/**
 * Generate a unique session ID (date-based + random suffix).
 * Created once per page load and reused for all log entries in that session.
 */
function generateSessionId(): string {
  const date = new Date()
  const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
  const randomSuffix = Math.random().toString(36).substring(2, 9) // 7 random chars
  return `${dateStr}-${randomSuffix}`
}

/**
 * Generate a unique entry ID (timestamp-based).
 */
function generateEntryId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Load telemetry logs from localStorage.
 * Returns an empty array if no logs exist or if there's an error.
 */
function loadTelemetryFromStorage(): TelemetryEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return []
    }

    const parsed = JSON.parse(stored)

    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn('[Telemetry] Log in localStorage is not an array, clearing it.')
      localStorage.removeItem(STORAGE_KEY)
      return []
    }

    // Validate array items have correct structure
    const validLogs: TelemetryEntry[] = []
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.timestamp === 'string' &&
        typeof item.sessionId === 'string' &&
        (typeof item.categoryId === 'string' || item.categoryId === null) &&
        (typeof item.cardIndex === 'number' || item.cardIndex === null) &&
        (typeof item.german === 'string' || item.german === null) &&
        (typeof item.english === 'string' || item.english === null) &&
        typeof item.gesture === 'string' &&
        typeof item.actionType === 'string'
      ) {
        validLogs.push({
          id: item.id,
          timestamp: item.timestamp,
          sessionId: item.sessionId,
          categoryId: item.categoryId,
          cardIndex: item.cardIndex,
          german: item.german,
          english: item.english,
          gesture: item.gesture,
          actionType: item.actionType,
        })
      }
    }

    return validLogs
  } catch (error) {
    console.warn('[Telemetry] Failed to load logs from localStorage:', error)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore removal errors
    }
    return []
  }
}

/**
 * Write telemetry logs to localStorage.
 */
function writeTelemetryToStorage(logs: TelemetryEntry[]): void {
  try {
    // Limit log size to prevent localStorage from getting too large
    const logToSave = logs.slice(-MAX_LOG_SIZE)
    const serialized = JSON.stringify(logToSave)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    // localStorage quota exceeded or other errors
    // Try to clear old entries and save again
    console.warn('[Telemetry] Failed to write logs, attempting to trim old entries:', error)
    try {
      // Keep only the most recent 50% of entries
      const trimmedLog = logs.slice(-Math.floor(MAX_LOG_SIZE / 2))
      const serialized = JSON.stringify(trimmedLog)
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (retryError) {
      console.error('[Telemetry] Failed to save logs even after trimming:', retryError)
    }
  }
}

export function TelemetryProvider({ children }: TelemetryProviderProps) {
  // Session ID: generated once per page load
  const sessionIdRef = useRef<string>(generateSessionId())
  
  // In-memory logs state
  const [logs, setLogs] = useState<TelemetryEntry[]>(() => loadTelemetryFromStorage())
  
  // Debouncing refs for localStorage writes
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingLogsRef = useRef<TelemetryEntry[] | null>(null)

  // Load logs from localStorage on mount
  useEffect(() => {
    const loadedLogs = loadTelemetryFromStorage()
    setLogs(loadedLogs)
  }, [])

  /**
   * Debounced write function for localStorage.
   * Batches multiple writes within 200ms window.
   */
  const debouncedWriteLogs = useCallback(() => {
    if (pendingLogsRef.current === null) return

    const logsToSave = pendingLogsRef.current
    writeTelemetryToStorage(logsToSave)
    pendingLogsRef.current = null
    debounceTimerRef.current = null
  }, [])

  /**
   * Log a telemetry event.
   * Creates a new entry with id, timestamp, and sessionId, then appends to logs.
   * Debounces localStorage writes to prevent performance drops.
   */
  const logEvent = useCallback((event: TelemetryEventInput) => {
    // Create entry with derived fields
    const entry: TelemetryEntry = {
      id: generateEntryId(),
      timestamp: new Date().toISOString(),
      sessionId: sessionIdRef.current,
      categoryId: event.categoryId,
      cardIndex: event.cardIndex,
      german: event.german,
      english: event.english,
      gesture: event.gesture,
      actionType: event.actionType,
    }

    // Update in-memory logs immediately
    setLogs((prevLogs) => {
      const newLogs = [...prevLogs, entry]
      
      // Store as pending for debounced write
      pendingLogsRef.current = newLogs

      // Cancel existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Schedule write after debounce period
      debounceTimerRef.current = setTimeout(() => {
        debouncedWriteLogs()
      }, DEBOUNCE_MS)

      return newLogs
    })
  }, [debouncedWriteLogs])

  /**
   * Clear all telemetry logs.
   * Clears both in-memory state and localStorage.
   */
  const clearLogs = useCallback(() => {
    // Clear in-memory logs
    setLogs([])
    
    // Clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (error) {
      console.warn('[Telemetry] Failed to clear logs from localStorage:', error)
    }

    // Cancel pending write
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    pendingLogsRef.current = null

    // Generate new session ID for fresh session
    sessionIdRef.current = generateSessionId()
  }, [])

  /**
   * Export logs to CSV format.
   * Returns CSV string with header row and one line per log entry.
   */
  const exportToCSV = useCallback((): string => {
    const headers = [
      'id',
      'timestamp',
      'sessionId',
      'categoryId',
      'cardIndex',
      'german',
      'english',
      'gesture',
      'actionType',
    ]

    // Escape CSV values (handle commas, quotes, newlines)
    const escapeCSV = (value: string | number | null): string => {
      if (value === null) return ''
      const str = String(value)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    // Convert each entry to CSV row
    const rows = logs.map((entry) => [
      escapeCSV(entry.id),
      escapeCSV(entry.timestamp),
      escapeCSV(entry.sessionId),
      escapeCSV(entry.categoryId),
      escapeCSV(entry.cardIndex),
      escapeCSV(entry.german),
      escapeCSV(entry.english),
      escapeCSV(entry.gesture),
      escapeCSV(entry.actionType),
    ].join(','))

    return [headers.join(','), ...rows].join('\n')
  }, [logs])

  /**
   * Export logs to JSON format.
   * Returns JSON string of the logs array.
   */
  const exportToJSON = useCallback((): string => {
    return JSON.stringify(logs, null, 2)
  }, [logs])

  // Cleanup: flush pending writes on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      // Flush any pending writes
      if (pendingLogsRef.current) {
        writeTelemetryToStorage(pendingLogsRef.current)
      }
    }
  }, [])

  const value: TelemetryContextValue = {
    logs,
    logEvent,
    clearLogs,
    exportToCSV,
    exportToJSON,
  }

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>
}

/**
 * Hook to access telemetry context.
 * Must be used within a TelemetryProvider.
 */
export function useTelemetry(): TelemetryContextValue {
  const context = useContext(TelemetryContext)
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider')
  }
  return context
}

