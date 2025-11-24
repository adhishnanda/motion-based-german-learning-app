import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTelemetry } from '../contexts/TelemetryContext'
import {
  getQuizStats,
  generateCardKey,
  type QuizStatsMap,
  loadQuizStats,
  getCardId,
  computeCardPriority,
  type QuizCardStats,
} from '../utils/quizStatsStorage'
import Button from './Button'
import type { Flashcard } from '../data/flashcards'
import type { TelemetryEntry } from '../contexts/TelemetryContext'

interface LessonSummaryProps {
  categoryName: string
  totalCards: number
  mode: 'learn' | 'quiz'
  startTime: number
  endTime: number
  categoryId: string
  flashcards: Flashcard[]
  onRestartLesson: () => void
  onBackToLesson?: () => void
  quizStats?: Record<string, QuizCardStats> // Optional: pass in spaced repetition stats
}

/**
 * Format time duration in a human-readable format.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }
  return `${remainingSeconds}s`
}

/**
 * Calculate statistics from telemetry logs for this session.
 */
function calculateTelemetryStats(
  logs: TelemetryEntry[],
  categoryId: string,
  startTime: number,
  endTime: number
) {
  // Filter logs for this category and time range
  const sessionLogs = logs.filter((log) => {
    if (log.categoryId !== categoryId) return false
    const logTime = new Date(log.timestamp).getTime()
    return logTime >= startTime && logTime <= endTime
  })

  // Count gesture actions (NEXT, PREV, SELECT, quiz actions)
  const gestureActions = sessionLogs.filter(
    (log) =>
      log.actionType === 'navigate_next' ||
      log.actionType === 'navigate_prev' ||
      log.actionType === 'toggle_translation' ||
      log.actionType === 'quiz_reveal' ||
      log.gesture === 'NEXT' ||
      log.gesture === 'PREV' ||
      log.gesture === 'SELECT'
  )

  const totalActions = gestureActions.length
  
  // Count successful actions (non-"no_action" actions)
  const successfulActions = sessionLogs.filter(
    (log) =>
      log.actionType !== 'no_action' &&
      (log.actionType === 'navigate_next' ||
        log.actionType === 'navigate_prev' ||
        log.actionType === 'toggle_translation' ||
        log.actionType === 'quiz_reveal' ||
        log.actionType === 'quiz_correct' ||
        log.actionType === 'quiz_incorrect')
  ).length

  // Calculate accuracy (successful actions / total gesture actions)
  const accuracy = totalActions > 0 ? (successfulActions / totalActions) * 100 : 0

  return {
    totalGestures: totalActions,
    accuracy: Math.round(accuracy),
  }
}

/**
 * Calculate quiz statistics from quizStatsStorage.
 */
function calculateQuizStats(categoryId: string, flashcards: Flashcard[]): {
  totalAttempts: number
  correctCount: number
  incorrectCount: number
  percentage: number
  mastered: string[] // Words with ≥ 80% correct
  needReview: string[] // Words with < 50% correct
} {
  const stats = getQuizStats()
  
  let totalAttempts = 0
  let correctCount = 0
  const mastered: string[] = []
  const needReview: string[] = []

  // Iterate through flashcards to check their stats
  for (const card of flashcards) {
    const cardKey = generateCardKey(categoryId, card.german)
    const cardStat = stats[cardKey]

    if (cardStat && cardStat.totalAttempts > 0) {
      totalAttempts += cardStat.totalAttempts
      correctCount += cardStat.correctCount

      const percentage = (cardStat.correctCount / cardStat.totalAttempts) * 100

      if (percentage >= 80) {
        mastered.push(card.german)
      } else if (percentage < 50) {
        needReview.push(card.german)
      }
    }
  }

  const incorrectCount = totalAttempts - correctCount
  const percentage = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0

  return {
    totalAttempts,
    correctCount,
    incorrectCount,
    percentage,
    mastered,
    needReview,
  }
}

const LessonSummary: React.FC<LessonSummaryProps> = ({
  categoryName,
  totalCards,
  mode,
  startTime,
  endTime,
  categoryId,
  flashcards,
  onRestartLesson,
  onBackToLesson,
  quizStats: passedQuizStats,
}) => {
  const navigate = useNavigate()
  const { logs, exportToCSV, exportToJSON } = useTelemetry()

  // Load spaced repetition stats if not passed in
  const spacedRepetitionStats = useMemo(() => {
    return passedQuizStats || loadQuizStats()
  }, [passedQuizStats])

  // Calculate statistics
  const duration = endTime - startTime
  const telemetryStats = useMemo(
    () => calculateTelemetryStats(logs, categoryId, startTime, endTime),
    [logs, categoryId, startTime, endTime]
  )
  const quizStats = useMemo(
    () => calculateQuizStats(categoryId, flashcards),
    [categoryId, flashcards]
  )

  // Export logs handler
  const handleExportLogs = (format: 'csv' | 'json') => {
    const data = format === 'csv' ? exportToCSV() : exportToJSON()
    const blob = new Blob([data], {
      type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `lesson_telemetry_${new Date().toISOString().split('T')[0]}.${format}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'transparent',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* Confetti animation */}
        <div className="lesson-complete-confetti">
          {Array.from({ length: 50 }).map((_, i) => (
            <div
              key={i}
              className="lesson-complete-confetti-piece"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                backgroundColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
              }}
            />
          ))}
        </div>

        <h1 style={{ fontSize: 'var(--font-size-3xl)', marginBottom: '1rem' }}>
          Lesson Complete! 🎉
        </h1>

        <p style={{ fontSize: 'var(--font-size-lg)', color: 'var(--color-text-secondary)', marginBottom: '2rem' }}>
          {categoryName}
        </p>

        {/* Common Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
            textAlign: 'left',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Total Cards
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>{totalCards}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Time Spent
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>
              {formatDuration(duration)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Gestures Used
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>
              {telemetryStats.totalGestures}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              Accuracy
            </div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '600' }}>
              {telemetryStats.accuracy}%
            </div>
          </div>
        </div>

        {/* Quiz Mode Specific Stats */}
        {mode === 'quiz' && (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '2rem',
              border: '1px solid var(--color-border)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: '1rem' }}>Quiz Results</h2>
            
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  Total Attempts
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600' }}>
                  {quizStats.totalAttempts}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  Correct
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600', color: 'var(--color-success)' }}>
                  {quizStats.correctCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  Wrong
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600', color: 'var(--color-error)' }}>
                  {quizStats.incorrectCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  Score
                </div>
                <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: '600', color: 'var(--color-primary)' }}>
                  {quizStats.percentage}%
                </div>
              </div>
            </div>

            {/* Mastered Words */}
            {quizStats.mastered.length > 0 && (
              <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-success)' }}>
                  ✅ Words you mastered ({quizStats.mastered.length})
                </h3>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  {quizStats.mastered.map((word, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'var(--color-success-light)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-success)',
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Words to Review */}
            {quizStats.needReview.length > 0 && (
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-error)' }}>
                  📚 Words you need to review ({quizStats.needReview.length})
                </h3>
                <div
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  {quizStats.needReview.map((word, idx) => (
                    <span
                      key={idx}
                      style={{
                        background: 'var(--color-error-light)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-error)',
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Hardest Cards Section (using spaced repetition stats) */}
        {mode === 'quiz' && (
          <div
            style={{
              background: 'var(--color-bg-primary)',
              borderRadius: 'var(--radius-md)',
              padding: '1.5rem',
              marginBottom: '2rem',
              border: '1px solid var(--color-border)',
            }}
          >
            <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: '1rem' }}>
              Hardest Cards (Review These More)
            </h2>

            {(() => {
              // Build ranked list of hardest cards
              const ranked = flashcards
                .map((card) => {
                  const cardId = getCardId(card)
                  const stats = spacedRepetitionStats[cardId]
                  const priority = computeCardPriority(stats)
                  return { card, stats, priority }
                })
                .filter((item) => item.stats !== undefined) // Only show cards with stats
                .sort((a, b) => b.priority - a.priority) // Hardest first
                .slice(0, 10) // Top 10

              if (ranked.length === 0) {
                return (
                  <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    No quiz statistics available yet. Complete some quiz questions to see your hardest cards here.
                  </p>
                )
              }

              return (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  {ranked.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem',
                        background: 'var(--color-bg-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                          {item.card.german} → {item.card.english}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            gap: '1rem',
                          }}
                        >
                          <span>
                            ❌ Incorrect: {item.stats.incorrectCount}
                          </span>
                          <span>
                            ✅ Streak: {item.stats.correctStreak}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            alignItems: 'stretch',
          }}
        >
          {onBackToLesson && (
            <Button variant="secondary" onClick={onBackToLesson}>
              ← Back to Lesson
            </Button>
          )}
          <Button variant="primary" onClick={onRestartLesson}>
            🔄 Restart Lesson
          </Button>
          <Button variant="secondary" onClick={() => navigate('/')}>
            🏠 Go Back Home
          </Button>
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              justifyContent: 'center',
              marginTop: '0.5rem',
            }}
          >
            <Button
              variant="secondary"
              onClick={() => handleExportLogs('csv')}
              style={{ fontSize: 'var(--font-size-sm)', padding: '0.5rem 1rem' }}
            >
              📥 Export CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleExportLogs('json')}
              style={{ fontSize: 'var(--font-size-sm)', padding: '0.5rem 1rem' }}
            >
              📥 Export JSON
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LessonSummary

