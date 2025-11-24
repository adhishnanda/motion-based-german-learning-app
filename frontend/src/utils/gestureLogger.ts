/**
 * Gesture telemetry logging utilities.
 * Stores gesture interaction events in localStorage for analysis.
 */

export interface GestureEventLog {
  timestamp: number;
  categoryId: string;
  detectedGesture: string;
  actionTaken: string;
  indexBefore: number;
  indexAfter: number;
}

const STORAGE_KEY = 'gestureLog';
const MAX_LOG_SIZE = 10000; // Prevent localStorage from getting too large
const DEBOUNCE_MS = 200; // Debounce localStorage writes by 200ms

// Debounce timer and pending writes
let debounceTimer: NodeJS.Timeout | null = null;
let pendingLog: GestureEventLog[] | null = null;

/**
 * Read the existing gesture log from localStorage.
 * Returns an empty array if no log exists or if there's an error.
 */
function readGestureLog(): GestureEventLog[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    
    // Validate that it's an array
    if (!Array.isArray(parsed)) {
      console.warn('Gesture log in localStorage is not an array, clearing it.');
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    // Validate array items have correct structure
    const validLogs: GestureEventLog[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.timestamp === 'number' &&
        typeof item.categoryId === 'string' &&
        typeof item.detectedGesture === 'string' &&
        typeof item.actionTaken === 'string' &&
        typeof item.indexBefore === 'number' &&
        typeof item.indexAfter === 'number'
      ) {
        validLogs.push({
          timestamp: item.timestamp,
          categoryId: item.categoryId,
          detectedGesture: item.detectedGesture,
          actionTaken: item.actionTaken,
          indexBefore: item.indexBefore,
          indexAfter: item.indexAfter,
        });
      }
    }

    return validLogs;
  } catch (error) {
    console.warn('Failed to read gesture log from localStorage:', error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore removal errors
    }
    return [];
  }
}

/**
 * Write the gesture log array to localStorage.
 */
function writeGestureLog(log: GestureEventLog[]): void {
  try {
    // Limit log size to prevent localStorage from getting too large
    const logToSave = log.slice(-MAX_LOG_SIZE);
    const serialized = JSON.stringify(logToSave);
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    // localStorage quota exceeded or other errors
    // Try to clear old entries and save again
    console.warn('Failed to write gesture log, attempting to trim old entries:', error);
    try {
      // Keep only the most recent 50% of entries
      const trimmedLog = log.slice(-Math.floor(MAX_LOG_SIZE / 2));
      const serialized = JSON.stringify(trimmedLog);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch (retryError) {
      console.error('Failed to save gesture log even after trimming:', retryError);
    }
  }
}

/**
 * Debounced write function for localStorage.
 * Batches multiple writes within 200ms window.
 */
function debouncedWriteGestureLog(): void {
  if (pendingLog === null) return;
  
  console.log('[Performance] Batched localStorage write: Gesture log');
  writeGestureLog(pendingLog);
  pendingLog = null;
  debounceTimer = null;
}

/**
 * Log a gesture event to localStorage.
 * Uses debouncing to batch writes and prevent performance drops.
 * @param event - The gesture event to log
 */
export function logGesture(event: GestureEventLog): void {
  // Read current log or initialize
  const currentLog = pendingLog || readGestureLog();
  
  // Add new event
  currentLog.push(event);
  
  // Store as pending
  pendingLog = currentLog;
  
  // Cancel existing timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  // Schedule write after debounce period
  debounceTimer = setTimeout(() => {
    debouncedWriteGestureLog();
  }, DEBOUNCE_MS);
  
  console.log('[Performance] Gesture throttled: Added to batch queue');
}

/**
 * Get all gesture events from localStorage.
 * @returns Array of gesture event logs
 */
export function getGestureLog(): GestureEventLog[] {
  return readGestureLog();
}

/**
 * Clear all gesture events from localStorage.
 */
export function clearGestureLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear gesture log:', error);
  }
}

/**
 * Convert gesture log array to CSV string.
 * @param log - Array of gesture events (optional, defaults to reading from storage)
 * @returns CSV string with headers
 */
export function gestureLogToCSV(log?: GestureEventLog[]): string {
  const events = log || getGestureLog();
  
  // CSV headers
  const headers = ['timestamp', 'categoryId', 'detectedGesture', 'actionTaken', 'indexBefore', 'indexAfter'];
  
  // Convert each event to CSV row
  const rows = events.map(event => [
    event.timestamp.toString(),
    event.categoryId,
    event.detectedGesture,
    event.actionTaken,
    event.indexBefore.toString(),
    event.indexAfter.toString(),
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Trigger download of gesture log as CSV file.
 * @param filename - Optional filename (defaults to 'gesture_log.csv')
 */
export function downloadGestureLog(filename: string = 'gesture_log.csv'): void {
  const csv = gestureLogToCSV();
  
  // Create blob and download link
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  
  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  URL.revokeObjectURL(url);
}

