/**
 * Quiz statistics storage utilities.
 * Tracks per-card quiz performance in localStorage with spaced repetition support.
 */

import type { Flashcard } from '../data/flashcards'

export type QuizResult = 'correct' | 'incorrect'

/**
 * Legacy QuizStat interface (for backward compatibility).
 * @deprecated Use QuizCardStats for new code.
 */
export interface QuizStat {
  totalAttempts: number
  correctCount: number
  lastResult: QuizResult | null
  lastSeen: string | null // ISO date string
}

/**
 * Enhanced quiz statistics for spaced repetition.
 * Tracks correct streak, incorrect count, and last seen timestamp.
 */
export interface QuizCardStats {
  cardId: string // Stable ID for card (category::german)
  correctStreak: number // Consecutive correct answers
  incorrectCount: number // Total incorrect attempts
  lastSeen: string // ISO timestamp
}

export type QuizStatsMap = Record<string, QuizCardStats>

const STORAGE_KEY = 'quizStats'
const STORAGE_KEY_V2 = 'motionEduApp_quizStats_v1' // New key for spaced repetition
const MAX_STATS_SIZE = 5000 // Limit to prevent localStorage bloat

/**
 * Load quiz statistics from localStorage.
 * Returns an empty object if no stats exist or if there's an error.
 */
function loadQuizStatsFromStorage(): QuizStatsMap {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored)

    // Validate that it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[QuizStats] Stats in localStorage is not an object, clearing it.')
      localStorage.removeItem(STORAGE_KEY)
      return {}
    }

    // Validate and filter entries
    const validStats: QuizStatsMap = {}
    for (const [cardKey, stat] of Object.entries(parsed)) {
      if (
        typeof cardKey === 'string' &&
        typeof stat === 'object' &&
        stat !== null &&
        typeof (stat as QuizStat).totalAttempts === 'number' &&
        typeof (stat as QuizStat).correctCount === 'number' &&
        ((stat as QuizStat).lastResult === null ||
          (stat as QuizStat).lastResult === 'correct' ||
          (stat as QuizStat).lastResult === 'incorrect') &&
        ((stat as QuizStat).lastSeen === null || typeof (stat as QuizStat).lastSeen === 'string')
      ) {
        validStats[cardKey] = {
          totalAttempts: (stat as QuizStat).totalAttempts,
          correctCount: (stat as QuizStat).correctCount,
          lastResult: (stat as QuizStat).lastResult,
          lastSeen: (stat as QuizStat).lastSeen,
        }
      }
    }

    return validStats
  } catch (error) {
    console.warn('[QuizStats] Failed to load stats from localStorage:', error)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore removal errors
    }
    return {}
  }
}

/**
 * Write quiz statistics to localStorage.
 * Trims old entries if the map is too large.
 */
function writeQuizStatsToStorage(stats: QuizStatsMap): void {
  try {
    // If stats map is too large, keep only the most recent entries (by lastSeen)
    let statsToSave = stats
    const entries = Object.entries(stats)
    
    if (entries.length > MAX_STATS_SIZE) {
      // Sort by lastSeen (most recent first) and keep top entries
      const sorted = entries.sort((a, b) => {
        const aDate = a[1].lastSeen ? new Date(a[1].lastSeen).getTime() : 0
        const bDate = b[1].lastSeen ? new Date(b[1].lastSeen).getTime() : 0
        return bDate - aDate
      })
      
      statsToSave = Object.fromEntries(sorted.slice(0, MAX_STATS_SIZE))
    }

    const serialized = JSON.stringify(statsToSave)
    localStorage.setItem(STORAGE_KEY, serialized)
  } catch (error) {
    // localStorage quota exceeded or other errors
    console.warn('[QuizStats] Failed to write stats, attempting to trim old entries:', error)
    try {
      // Keep only the most recent 50% of entries
      const entries = Object.entries(stats)
      const sorted = entries.sort((a, b) => {
        const aDate = a[1].lastSeen ? new Date(a[1].lastSeen).getTime() : 0
        const bDate = b[1].lastSeen ? new Date(b[1].lastSeen).getTime() : 0
        return bDate - aDate
      })
      const trimmedStats = Object.fromEntries(sorted.slice(0, Math.floor(MAX_STATS_SIZE / 2)))
      const serialized = JSON.stringify(trimmedStats)
      localStorage.setItem(STORAGE_KEY, serialized)
    } catch (retryError) {
      console.error('[QuizStats] Failed to save stats even after trimming:', retryError)
    }
  }
}

/**
 * Get all quiz statistics from localStorage.
 * @returns Map of cardKey -> QuizStat
 */
export function getQuizStats(): QuizStatsMap {
  return loadQuizStatsFromStorage()
}

/**
 * Get quiz statistics for a specific card.
 * @param cardKey - The card key (categoryId + '|' + german)
 * @returns QuizStat or null if not found
 */
export function getQuizStat(cardKey: string): QuizStat | null {
  const stats = getQuizStats()
  return stats[cardKey] || null
}

/**
 * Save quiz statistics to localStorage.
 * @param stats - The complete stats map to save
 */
export function saveQuizStats(stats: QuizStatsMap): void {
  writeQuizStatsToStorage(stats)
}

/**
 * Update quiz statistics for a specific card.
 * Creates a new stat entry if none exists, otherwise updates the existing one.
 * @param cardKey - The card key (categoryId + '|' + german)
 * @param result - The quiz result ('correct' or 'incorrect')
 */
export function updateQuizStat(cardKey: string, result: QuizResult): void {
  const stats = getQuizStats()
  
  // Get existing stat or create default
  const existingStat = stats[cardKey] || {
    totalAttempts: 0,
    correctCount: 0,
    lastResult: null,
    lastSeen: null,
  }

  // Update stat
  const updatedStat: QuizStat = {
    totalAttempts: existingStat.totalAttempts + 1,
    correctCount: existingStat.correctCount + (result === 'correct' ? 1 : 0),
    lastResult: result,
    lastSeen: new Date().toISOString(),
  }

  // Save back to storage
  stats[cardKey] = updatedStat
  saveQuizStats(stats)
}

/**
 * Generate a card key from categoryId and german text.
 * Format: "categoryId|german"
 * @param categoryId - The category identifier
 * @param german - The German word/phrase
 * @returns Card key string
 */
export function generateCardKey(categoryId: string, german: string): string {
  return `${categoryId}|${german}`
}

/**
 * Get a stable card ID for spaced repetition.
 * Format: "category::german"
 * @param card - The flashcard object
 * @returns Stable card ID string
 */
export function getCardId(card: Flashcard): string {
  return `${card.category}::${card.german}`
}

/**
 * Clear all quiz statistics.
 */
export function clearQuizStats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_KEY_V2)
  } catch (error) {
    console.warn('[QuizStats] Failed to clear stats:', error)
  }
}

// ============================================================================
// SPACED REPETITION FUNCTIONS
// ============================================================================

/**
 * Load quiz statistics for spaced repetition from localStorage.
 * Uses the new v1 storage key.
 * @returns Map of cardId -> QuizCardStats
 */
export function loadQuizStats(): Record<string, QuizCardStats> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY_V2)
    if (!stored) {
      return {}
    }

    const parsed = JSON.parse(stored)

    // Validate that it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn('[QuizStats] Stats in localStorage is not an object, clearing it.')
      localStorage.removeItem(STORAGE_KEY_V2)
      return {}
    }

    // Validate and filter entries
    const validStats: Record<string, QuizCardStats> = {}
    for (const [cardId, stat] of Object.entries(parsed)) {
      if (
        typeof cardId === 'string' &&
        typeof stat === 'object' &&
        stat !== null &&
        typeof (stat as QuizCardStats).correctStreak === 'number' &&
        typeof (stat as QuizCardStats).incorrectCount === 'number' &&
        typeof (stat as QuizCardStats).lastSeen === 'string' &&
        typeof (stat as QuizCardStats).cardId === 'string'
      ) {
        validStats[cardId] = {
          cardId: (stat as QuizCardStats).cardId,
          correctStreak: (stat as QuizCardStats).correctStreak,
          incorrectCount: (stat as QuizCardStats).incorrectCount,
          lastSeen: (stat as QuizCardStats).lastSeen,
        }
      }
    }

    return validStats
  } catch (error) {
    console.warn('[QuizStats] Failed to load stats from localStorage:', error)
    try {
      localStorage.removeItem(STORAGE_KEY_V2)
    } catch {
      // Ignore removal errors
    }
    return {}
  }
}

/**
 * Save quiz statistics for spaced repetition to localStorage.
 * @param stats - The complete stats map to save
 */
export function saveQuizStatsV2(stats: Record<string, QuizCardStats>): void {
  try {
    // If stats map is too large, keep only the most recent entries (by lastSeen)
    let statsToSave = stats
    const entries = Object.entries(stats)

    if (entries.length > MAX_STATS_SIZE) {
      // Sort by lastSeen (most recent first) and keep top entries
      const sorted = entries.sort((a, b) => {
        const aDate = new Date(a[1].lastSeen).getTime()
        const bDate = new Date(b[1].lastSeen).getTime()
        return bDate - aDate
      })

      statsToSave = Object.fromEntries(sorted.slice(0, MAX_STATS_SIZE))
    }

    const serialized = JSON.stringify(statsToSave)
    localStorage.setItem(STORAGE_KEY_V2, serialized)
  } catch (error) {
    console.warn('[QuizStats] Failed to write stats, attempting to trim old entries:', error)
    try {
      // Keep only the most recent 50% of entries
      const entries = Object.entries(stats)
      const sorted = entries.sort((a, b) => {
        const aDate = new Date(a[1].lastSeen).getTime()
        const bDate = new Date(b[1].lastSeen).getTime()
        return bDate - aDate
      })
      const trimmedStats = Object.fromEntries(sorted.slice(0, Math.floor(MAX_STATS_SIZE / 2)))
      const serialized = JSON.stringify(trimmedStats)
      localStorage.setItem(STORAGE_KEY_V2, serialized)
    } catch (retryError) {
      console.error('[QuizStats] Failed to save stats even after trimming:', retryError)
    }
  }
}

/**
 * Update quiz statistics for a card answer in spaced repetition format.
 * @param stats - Current stats map
 * @param card - The flashcard
 * @param wasCorrect - Whether the answer was correct
 * @returns Updated stats map
 */
export function updateQuizStatsForAnswer(
  stats: Record<string, QuizCardStats>,
  card: Flashcard,
  wasCorrect: boolean
): Record<string, QuizCardStats> {
  const cardId = getCardId(card)
  const now = new Date().toISOString()

  // Get existing stat or create default
  const existingStat = stats[cardId] || {
    cardId,
    correctStreak: 0,
    incorrectCount: 0,
    lastSeen: new Date(0).toISOString(), // Very old timestamp for new cards
  }

  // Update stat based on answer
  const updatedStat: QuizCardStats = {
    cardId,
    correctStreak: wasCorrect ? existingStat.correctStreak + 1 : 0,
    incorrectCount: wasCorrect ? existingStat.incorrectCount : existingStat.incorrectCount + 1,
    lastSeen: now,
  }

  // Update stats map
  const updatedStats = { ...stats, [cardId]: updatedStat }

  // Save to localStorage
  saveQuizStatsV2(updatedStats)

  return updatedStats
}

/**
 * Compute priority for a card based on its stats.
 * Higher priority = harder card (should be shown more often).
 * @param cardStats - Optional card statistics
 * @returns Priority value (higher = harder)
 */
export function computeCardPriority(cardStats?: QuizCardStats): number {
  if (!cardStats) {
    return 2 // Default medium priority for new cards
  }

  // Base priority increases with incorrect count, decreases with correct streak
  // Formula: 1 + (incorrectCount * 2) - correctStreak
  const base = 1 + cardStats.incorrectCount * 2 - cardStats.correctStreak

  // Ensure minimum priority of 0.5 (even easy cards get some chance)
  return Math.max(0.5, base)
}

/**
 * Choose the next quiz card index using weighted random selection based on priority.
 * Cards with higher priority (harder) are more likely to be selected.
 * @param cards - Array of flashcards
 * @param stats - Current quiz statistics map
 * @returns Index of the selected card
 */
export function chooseNextQuizCardIndex(
  cards: Flashcard[],
  stats: Record<string, QuizCardStats>
): number {
  if (cards.length === 0) {
    return 0
  }

  try {
    // Compute weights for each card
    const weights = cards.map((card) => {
      const cardId = getCardId(card)
      const cardStats = stats[cardId]
      return computeCardPriority(cardStats)
    })

    // Sum all weights
    const totalWeight = weights.reduce((sum, w) => sum + w, 0)

    if (totalWeight === 0) {
      // Fallback: random selection
      return Math.floor(Math.random() * cards.length)
    }

    // Draw random number in [0, totalWeight)
    const random = Math.random() * totalWeight

    // Find the card index where cumulative weight exceeds random
    let cumulative = 0
    for (let i = 0; i < weights.length; i++) {
      cumulative += weights[i]
      if (random <= cumulative) {
        return i
      }
    }

    // Fallback: return last index
    return cards.length - 1
  } catch (error) {
    console.warn('[QuizStats] Error in chooseNextQuizCardIndex, using fallback:', error)
    // Fallback: random selection
    return Math.floor(Math.random() * cards.length)
  }
}

