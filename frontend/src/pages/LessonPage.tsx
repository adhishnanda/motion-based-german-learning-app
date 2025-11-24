import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getFlashcardsForCategory, getCategories } from '../data/flashcards'
import { usePoseContext } from '../cv/poseContext'
import type { GestureType } from '../cv/gestureTypes'
import { getGestureLabel } from '../cv/gestureTypes'
import { loadProgress, saveProgress, type LessonProgress } from '../utils/progressStorage'
import { useTelemetry } from '../contexts/TelemetryContext'
import {
  generateCardKey,
  getQuizStat,
  updateQuizStat,
  loadQuizStats,
  updateQuizStatsForAnswer,
  chooseNextQuizCardIndex,
  getCardId,
  type QuizStatsMap as SpacedRepetitionStats,
} from '../utils/quizStatsStorage'
import CameraFeed from '../components/CameraFeed'
import Flashcard from '../components/Flashcard'
import Button from '../components/Button'
import { loadShowCamera } from '../components/SettingsPanel'
import ProgressBar from '../components/ProgressBar'
import ControlsHint from '../components/ControlsHint'
import AppHeader from '../components/AppHeader'
import LessonSummary from '../components/LessonSummary'

// Memoized Camera Section Component
const CameraSection: React.FC<{ currentGesture: GestureType }> = ({ currentGesture }) => {
  const gestureLabel = useMemo(() => getGestureLabel(currentGesture), [currentGesture])

  return (
    <div className="camera-section">
      <div className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
        <h2 className="camera-section-header">Camera & Gestures</h2>
        <p className="camera-section-description">
          Detected gesture: <strong>{gestureLabel}</strong>
        </p>
      </div>
      <CameraFeed />
    </div>
  )
}

const MemoizedCameraSection = React.memo(
  CameraSection,
  (prevProps, nextProps) => prevProps.currentGesture === nextProps.currentGesture
)

const LessonPage: React.FC = () => {
  const { categoryId } = useParams<{ categoryId: string }>()
  const navigate = useNavigate()
  const { currentGesture } = usePoseContext()
  const { logEvent } = useTelemetry()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [showTranslation, setShowTranslation] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [progressLoaded, setProgressLoaded] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'next' | 'prev' | null>(null)
  const [lastAction, setLastAction] = useState<'NEXT' | 'PREV' | 'SELECT' | null>(null)
  const [pulseVisible, setPulseVisible] = useState(false)
  const [pulseLabel, setPulseLabel] = useState<string>('Ready')
  const [showCamera, setShowCamera] = useState(() => loadShowCamera())
  const [isFlipping, setIsFlipping] = useState(false)
  const [mode, setMode] = useState<'learn' | 'quiz'>('learn')
  const [showSummary, setShowSummary] = useState(false)
  const [quizStats, setQuizStats] = useState<SpacedRepetitionStats>({})
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'incorrect' | null>(null)

  const lastActionRef = useRef<number>(0)
  const previousGestureRef = useRef<GestureType>('REST')
  const lessonStartTimeRef = useRef<number>(Date.now())
  const COOLDOWN_MS = 1000
  const PULSE_DURATION_MS = 700

  // Handler for quiz answers with spaced repetition
  const handleQuizAnswer = (wasCorrect: boolean) => {
    if (!currentFlashcard || mode !== 'quiz') {
      return
    }

    // 1) Show visual feedback
    setAnswerFeedback(wasCorrect ? 'correct' : 'incorrect')

    // 2) Update stats (local + localStorage)
    const updatedStats = updateQuizStatsForAnswer(quizStats, currentFlashcard, wasCorrect)
    setQuizStats(updatedStats)

    // 3) Log telemetry
    logEvent({
      categoryId: categoryId || null,
      cardIndex: currentIndex,
      german: currentFlashcard.german || null,
      english: currentFlashcard.english || null,
      gesture: 'REST',
      actionType: wasCorrect ? 'quiz_correct' : 'quiz_incorrect',
    })

    // 4) Also update legacy stats for backward compatibility
    const cardKey = generateCardKey(categoryId || '', currentFlashcard.german)
    updateQuizStat(cardKey, wasCorrect ? 'correct' : 'incorrect')

    // 5) After animation, choose next card using spaced repetition
    setTimeout(() => {
      setAnswerFeedback(null) // Clear feedback
      if (mode === 'quiz' && flashcards.length > 0) {
        const nextIndex = chooseNextQuizCardIndex(flashcards, updatedStats)
        setCurrentIndex(nextIndex)
        setShowTranslation(false) // Reset translation for new card
      }
    }, 600) // Wait for animation to complete
  }

  // All cards for current category
  const flashcards = useMemo(
    () => (categoryId ? getFlashcardsForCategory(categoryId) : []),
    [categoryId]
  )

  const currentFlashcard = useMemo(
    () => flashcards[currentIndex] || null,
    [flashcards, currentIndex]
  )

  // --- Debug / perf logs (safe to keep or remove) ---
  useEffect(() => {
    console.log('[Performance] Re-render: LessonPage', {
      categoryId,
      currentIndex,
      gesture: currentGesture,
      flashcardCount: flashcards.length,
    })
  })

  useEffect(() => {
    console.log('[LessonPage Debug] Category ID:', categoryId)
    console.log('[LessonPage Debug] Flashcards found:', flashcards.length)
    if (flashcards.length > 0) {
      console.log('[LessonPage Debug] First flashcard:', flashcards[0])
      console.log('[LessonPage Debug] Current index:', currentIndex)
      console.log('[LessonPage Debug] Current flashcard:', currentFlashcard)
    } else {
      console.warn('[LessonPage Debug] No flashcards found for category:', categoryId)
      const allCategories = getCategories()
      console.log('[LessonPage Debug] Available categories:', allCategories.map(c => `${c.id} -> ${c.label}`))
    }
  }, [categoryId, flashcards.length, currentIndex, currentFlashcard])
  // --------------------------------------------------

  // Load quiz stats for spaced repetition
  useEffect(() => {
    if (mode === 'quiz') {
      const loadedStats = loadQuizStats()
      setQuizStats(loadedStats)
    }
  }, [mode, categoryId])

  // Load progress & mode
  useEffect(() => {
    if (!categoryId || flashcards.length === 0) {
      setProgressLoaded(false)
      return
    }

    try {
      const savedMode = localStorage.getItem(`lessonMode:${categoryId}`)
      if (savedMode === 'learn' || savedMode === 'quiz') {
        setMode(savedMode)
      }
    } catch (error) {
      console.warn('Failed to load lesson mode:', error)
    }

    const savedProgress = loadProgress(categoryId)

    if (savedProgress) {
      const validIndex = Math.max(0, Math.min(savedProgress.index, flashcards.length - 1))
      setCurrentIndex(validIndex)

      try {
        const savedMode = localStorage.getItem(`lessonMode:${categoryId}`)
        if (savedMode === 'learn' || savedMode === 'quiz') {
          setMode(savedMode)
          setShowTranslation(savedProgress.showTranslation && savedMode === 'learn')
        } else {
          setShowTranslation(savedProgress.showTranslation)
        }
      } catch (error) {
        console.warn('Failed to load lesson mode:', error)
        setShowTranslation(savedProgress.showTranslation)
      }

      setIsComplete(savedProgress.completed)
    } else {
      setCurrentIndex(0)
      setShowTranslation(false)
      setIsComplete(false)
    }

    // reset animation state
    setSlideDirection(null)
    setLastAction(null)
    setPulseVisible(false)
    setPulseLabel('Ready')
    lastActionRef.current = 0
    previousGestureRef.current = 'REST'

    lessonStartTimeRef.current = Date.now()
    setProgressLoaded(true)
  }, [categoryId, flashcards.length])

  // Save progress
  useEffect(() => {
    if (!progressLoaded) return
    if (!categoryId || flashcards.length === 0) return

    const validIndex = Math.max(0, Math.min(currentIndex, flashcards.length - 1))

    const progress: LessonProgress = {
      index: validIndex,
      completed: isComplete,
      showTranslation,
    }

    saveProgress(categoryId, progress)
  }, [categoryId, currentIndex, isComplete, showTranslation, progressLoaded, flashcards.length])

  // Pulse animation
  useEffect(() => {
    if (!pulseVisible) return
    const timeout = setTimeout(() => {
      setPulseVisible(false)
      setPulseLabel('Ready')
    }, PULSE_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [pulseVisible])

  // Reset slide animation flag
  useEffect(() => {
    if (!slideDirection) return
    const timeout = setTimeout(() => setSlideDirection(null), 250)
    return () => clearTimeout(timeout)
  }, [slideDirection])

  // Gesture-based navigation
  useEffect(() => {
    if (isComplete || !categoryId) return

    const now = Date.now()
    const timeSinceLastAction = now - lastActionRef.current
    const isCooldownActive = timeSinceLastAction < COOLDOWN_MS

    const isGestureChange =
      previousGestureRef.current !== currentGesture &&
      (previousGestureRef.current === 'REST' || previousGestureRef.current === 'SELECT')

    if (isGestureChange && !isCooldownActive) {
      if (currentGesture === 'NEXT') {
        setSlideDirection('next')
        setCurrentIndex(prev => {
          const currentCard = flashcards[prev]
          if (prev >= flashcards.length - 1) {
            setIsComplete(true)
            setShowSummary(true)
            logEvent({
              categoryId: categoryId || null,
              cardIndex: prev,
              german: currentCard?.german || null,
              english: currentCard?.english || null,
              gesture: 'NEXT',
              actionType: 'lesson_complete',
            })
            return prev
          }

          setShowTranslation(false)
          setAnswerFeedback(null) // Clear any answer feedback when navigating
          setLastAction('NEXT')
          setPulseLabel('NEXT')
          setPulseVisible(true)

          const newIndex = prev + 1
          const nextCard = flashcards[newIndex]

          logEvent({
            categoryId: categoryId || null,
            cardIndex: newIndex,
            german: nextCard?.german || null,
            english: nextCard?.english || null,
            gesture: 'NEXT',
            actionType: 'navigate_next',
          })

          return newIndex
        })
        lastActionRef.current = now
      } else if (currentGesture === 'PREV') {
        setSlideDirection('prev')
        setCurrentIndex(prev => {
          const currentCard = flashcards[prev]
          if (prev <= 0) {
            logEvent({
              categoryId: categoryId || null,
              cardIndex: prev,
              german: currentCard?.german || null,
              english: currentCard?.english || null,
              gesture: 'PREV',
              actionType: 'no_action',
            })
            return prev
          }

          setShowTranslation(false)
          setAnswerFeedback(null) // Clear any answer feedback when navigating
          setLastAction('PREV')
          setPulseLabel('PREV')
          setPulseVisible(true)

          const prevCard = flashcards[prev - 1]
          logEvent({
            categoryId: categoryId || null,
            cardIndex: prev - 1,
            german: prevCard?.german || null,
            english: prevCard?.english || null,
            gesture: 'PREV',
            actionType: 'navigate_prev',
          })

          return prev - 1
        })
        lastActionRef.current = now
      } else if (currentGesture === 'SELECT') {
        const currentCard = flashcards[currentIndex]
        setShowTranslation(prev => {
          const newValue = !prev

          setIsFlipping(true)
          setTimeout(() => setIsFlipping(false), 400)

          if (mode === 'quiz' && !prev && newValue) {
            logEvent({
              categoryId: categoryId || null,
              cardIndex: currentIndex,
              german: currentCard?.german || null,
              english: currentCard?.english || null,
              gesture: 'SELECT',
              actionType: 'quiz_reveal',
            })
          } else if (mode === 'learn') {
            logEvent({
              categoryId: categoryId || null,
              cardIndex: currentIndex,
              german: currentCard?.german || null,
              english: currentCard?.english || null,
              gesture: 'SELECT',
              actionType: 'toggle_translation',
            })
          }

          setLastAction('SELECT')
          setPulseLabel('SELECT')
          setPulseVisible(true)
          return newValue
        })
        lastActionRef.current = now
      }
    } else if (currentGesture === 'REST' && previousGestureRef.current !== 'REST') {
      const currentCard = flashcards[currentIndex]
      logEvent({
        categoryId: categoryId || null,
        cardIndex: currentIndex,
        german: currentCard?.german || null,
        english: currentCard?.english || null,
        gesture: 'REST',
        actionType: 'no_action',
      })
    }

    previousGestureRef.current = currentGesture
  }, [currentGesture, flashcards.length, isComplete, currentIndex, categoryId, logEvent, mode, flashcards])

  // Sync showCamera with localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'showCamera') {
        setShowCamera(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)

    const checkShowCamera = () => {
      try {
        const stored = localStorage.getItem('showCamera')
        if (stored !== null) {
          setShowCamera(stored === 'true')
        }
      } catch (error) {
        console.warn('Failed to read showCamera from localStorage:', error)
      }
    }

    const interval = setInterval(checkShowCamera, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  // Handle keyboard navigation (arrows + r/n/p/s shortcuts)
useEffect(() => {
  if (isComplete || !categoryId) return

  const handleKeyDown = (event: KeyboardEvent) => {
    const now = Date.now()
    const timeSinceLastAction = now - lastActionRef.current
    const isCooldownActive = timeSinceLastAction < COOLDOWN_MS

    // Let ESC, Ctrl+something etc. pass through
    if (isCooldownActive) return

    const key = event.key

    const isNextKey = key === 'ArrowRight' || key === 'n' || key === 'N'
    const isPrevKey = key === 'ArrowLeft' || key === 'p' || key === 'P'
    const isSelectKey = key === ' ' || key === 's' || key === 'S'
    const isRestKey = key === 'r' || key === 'R'

    if (isNextKey) {
      event.preventDefault()
      setSlideDirection('next')
      setCurrentIndex(prev => {
        const currentCard = flashcards[prev]
        if (prev >= flashcards.length - 1) {
          setIsComplete(true)
          setShowSummary(true)
          logEvent({
            categoryId: categoryId || null,
            cardIndex: prev,
            german: currentCard?.german || null,
            english: currentCard?.english || null,
            gesture: 'KEYBOARD_NEXT',
            actionType: 'lesson_complete',
          })
          return prev
        }

        setShowTranslation(false)
        setLastAction('NEXT')
        setPulseLabel('NEXT')
        setPulseVisible(true)

        const nextCard = flashcards[prev + 1]
        logEvent({
          categoryId: categoryId || null,
          cardIndex: prev + 1,
          german: nextCard?.german || null,
          english: nextCard?.english || null,
          gesture: 'KEYBOARD_NEXT',
          actionType: 'navigate_next',
        })

        return prev + 1
      })
      lastActionRef.current = now
    } else if (isPrevKey) {
      event.preventDefault()
      setSlideDirection('prev')
      setCurrentIndex(prev => {
        const currentCard = flashcards[prev]
        if (prev <= 0) {
          logEvent({
            categoryId: categoryId || null,
            cardIndex: prev,
            german: currentCard?.german || null,
            english: currentCard?.english || null,
            gesture: 'KEYBOARD_PREV',
            actionType: 'no_action',
          })
          return prev
        }

        setShowTranslation(false)
        setAnswerFeedback(null) // Clear any answer feedback when navigating
        setLastAction('PREV')
        setPulseLabel('PREV')
        setPulseVisible(true)

        const prevCard = flashcards[prev - 1]
        logEvent({
          categoryId: categoryId || null,
          cardIndex: prev - 1,
          german: prevCard?.german || null,
          english: prevCard?.english || null,
          gesture: 'KEYBOARD_PREV',
          actionType: 'navigate_prev',
        })

        if (mode === 'quiz') {
          setShowTranslation(false)
        }

        return prev - 1
      })
      lastActionRef.current = now
    } else if (isSelectKey) {
      event.preventDefault()
      const currentCard = flashcards[currentIndex]
      setShowTranslation(prev => {
        const newValue = !prev

        setIsFlipping(true)
        setTimeout(() => setIsFlipping(false), 400)

        logEvent({
          categoryId: categoryId || null,
          cardIndex: currentIndex,
          german: currentCard?.german || null,
          english: currentCard?.english || null,
          gesture: 'KEYBOARD_SELECT',
          actionType: 'toggle_translation',
        })

        setLastAction('SELECT')
        setPulseLabel('SELECT')
        setPulseVisible(true)
        return newValue
      })
      lastActionRef.current = now
    } else if (isRestKey) {
      // Soft "reset" key – no navigation, just clear translation + pulse
      event.preventDefault()
      setShowTranslation(false)
      setLastAction(null)
      setPulseVisible(false)
      setPulseLabel('Ready')
      lastActionRef.current = now
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => {
    window.removeEventListener('keydown', handleKeyDown)
  }
}, [flashcards.length, isComplete, currentIndex, categoryId, mode, logEvent, flashcards])

  // Guards
  if (!categoryId) {
    return (
      <div className="lesson-page">
        <AppHeader />
        <div className="lesson-complete-container" style={{ minHeight: '50vh', padding: '2rem' }}>
          <div className="lesson-complete-content">
            <h1 className="lesson-complete-title">Invalid Category</h1>
            <p className="lesson-complete-message">Please select a valid category from the home page.</p>
            <div className="lesson-complete-actions">
              <Button variant="primary" onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (flashcards.length === 0) {
    const allCategories = getCategories()
    return (
      <div className="lesson-page">
        <AppHeader />
        <div className="lesson-complete-container" style={{ minHeight: '50vh', padding: '2rem' }}>
          <div className="lesson-complete-content">
            <h1 className="lesson-complete-title">No Flashcards Found</h1>
            <p className="lesson-complete-message">
              {categoryId ? `No flashcards available for category: "${categoryId}"` : 'No category selected.'}
              <br />
              <small style={{ marginTop: '1rem', display: 'block' }}>
                Available categories: {allCategories.map(c => c.id).join(', ')}
              </small>
            </p>
            <div className="lesson-complete-actions">
              <Button variant="primary" onClick={() => navigate('/')}>
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Summary screen
  if (showSummary && flashcards.length > 0) {
    return (
      <LessonSummary
        categoryName={flashcards[0]?.category || 'Unknown Category'}
        totalCards={flashcards.length}
        mode={mode}
        startTime={lessonStartTimeRef.current}
        endTime={Date.now()}
        categoryId={categoryId || ''}
        flashcards={flashcards}
        quizStats={quizStats}
        onRestartLesson={() => {
          setCurrentIndex(0)
          setIsComplete(false)
          setShowSummary(false)
          setShowTranslation(false)
          lessonStartTimeRef.current = Date.now()
        }}
        onBackToLesson={() => setShowSummary(false)}
      />
    )
  }

  // ---- MAIN RENDER ----
  return (
    <div className="lesson-page">
      <AppHeader />

      <div className="lesson-category-header">
        <h2 className="lesson-category-title">{flashcards[0]?.category || 'Unknown'}</h2>
      </div>

      {/* Mode toggle + summary button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          marginTop: '0.5rem',
          padding: '0 1rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => {
            const newMode: 'learn' | 'quiz' = 'learn'
            setMode(newMode)
            if (categoryId) {
              try {
                localStorage.setItem(`lessonMode:${categoryId}`, newMode)
              } catch (error) {
                console.warn('Failed to save lesson mode:', error)
              }
            }
            setShowTranslation(false)
          }}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: '2px solid',
            borderColor: mode === 'learn' ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: mode === 'learn' ? 'var(--color-primary)' : 'transparent',
            color: mode === 'learn' ? 'var(--color-bg)' : 'var(--color-text-primary)',
            cursor: 'pointer',
            transition: 'all 200ms ease-out',
            boxShadow: mode === 'learn' ? 'var(--shadow-card)' : 'none',
          }}
          aria-pressed={mode === 'learn'}
        >
          📚 Learn
        </button>

        <button
          type="button"
          onClick={() => {
            const newMode: 'learn' | 'quiz' = 'quiz'
            setMode(newMode)
            if (categoryId) {
              try {
                localStorage.setItem(`lessonMode:${categoryId}`, newMode)
              } catch (error) {
                console.warn('Failed to save lesson mode:', error)
              }
            }
            setShowTranslation(false)
          }}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: '2px solid',
            borderColor: mode === 'quiz' ? 'var(--color-primary)' : 'var(--color-border)',
            backgroundColor: mode === 'quiz' ? 'var(--color-primary)' : 'transparent',
            color: mode === 'quiz' ? 'var(--color-bg)' : 'var(--color-text-primary)',
            cursor: 'pointer',
            transition: 'all 200ms ease-out',
            boxShadow: mode === 'quiz' ? 'var(--shadow-card)' : 'none',
          }}
          aria-pressed={mode === 'quiz'}
        >
          🎯 Quiz
        </button>

        {flashcards.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSummary(true)}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: '2px solid var(--color-border)',
              backgroundColor: 'transparent',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              transition: 'all 200ms ease-out',
              marginLeft: 'auto',
            }}
          >
            📊 View Summary
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="lesson-status-bar">
        <span className="status-item">
          <span className="status-label">Card</span>
          <span className="status-value">
            {currentIndex + 1} of {flashcards.length}
          </span>
        </span>
        <span className="status-item">
          <span className="status-label">Translation</span>
          <span className={`status-pill ${showTranslation ? 'status-pill-active' : ''}`}>
            {showTranslation ? 'Shown' : 'Hidden'}
          </span>
        </span>
        {isComplete ? (
          <span className="status-item">
            <span className="status-label">Status</span>
            <span className="status-pill status-pill-completed">✓ Completed</span>
          </span>
        ) : (
          <span className="status-item">
            <span className="status-label">Last action</span>
            <span className="status-pill status-pill-action">
              {lastAction ? getGestureLabel(lastAction) : 'None yet'}
            </span>
          </span>
        )}
      </div>

      <main className="lesson-main">
        <div className="lesson-content">
          {/* Gesture pulse */}
          <div className={`gesture-pulse ${pulseVisible ? 'pulse-active' : ''}`}>
            <span className="gesture-pulse-label">{pulseLabel}</span>
          </div>

          {/* Flashcard + quiz controls */}
          <div className="flashcard-section">
            <div
              className={`flashcard-overlay ${
                currentGesture === 'NEXT'
                  ? 'gesture-next-glow'
                  : currentGesture === 'PREV'
                  ? 'gesture-prev-glow'
                  : currentGesture === 'SELECT'
                  ? 'gesture-select-glow'
                  : 'gesture-rest'
              }`}
            >
              <div className="flashcard-panel card">
                <div
                  className={`flashcard-wrapper ${
                    slideDirection === 'next' ? 'slide-next' : ''
                  } ${slideDirection === 'prev' ? 'slide-prev' : ''}`}
                  key={currentIndex}
                >
                  {currentFlashcard ? (
                    <Flashcard
                      flashcard={currentFlashcard}
                      showTranslation={showTranslation}
                      isFlipping={isFlipping}
                      answerFeedback={answerFeedback}
                    />
                  ) : (
                    <div className="flashcard-text" style={{ padding: '2rem', textAlign: 'center' }}>
                      <p>Loading flashcard...</p>
                      <p
                        style={{
                          fontSize: '0.875rem',
                          color: 'var(--color-text-muted)',
                          marginTop: '1rem',
                        }}
                      >
                        Current index: {currentIndex}, Total cards: {flashcards.length}
                      </p>
                    </div>
                  )}
                </div>

                {/* QUIZ CONTROLS – now below the card, not overlapping */}
                {mode === 'quiz' && currentFlashcard && (
                  <div className="quiz-controls">
                    {!showTranslation ? (
                      <Button
                        variant="primary"
                        onClick={() => {
                          setShowTranslation(true)
                          setIsFlipping(true)
                          setTimeout(() => setIsFlipping(false), 400)
                          logEvent({
                            categoryId: categoryId || null,
                            cardIndex: currentIndex,
                            german: currentFlashcard.german || null,
                            english: currentFlashcard.english || null,
                            gesture: 'REST',
                            actionType: 'quiz_reveal',
                          })
                        }}
                        className="quiz-reveal-btn"
                      >
                        🔍 Reveal Answer
                      </Button>
                    ) : (
                      <div className="quiz-buttons-row">
                        <Button
                          variant="primary"
                          onClick={() => handleQuizAnswer(true)}
                          className="quiz-button quiz-button-success"
                        >
                          ✅ I knew this
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => handleQuizAnswer(false)}
                          className="quiz-button quiz-button-danger"
                        >
                          ❌ I didn't know
                        </Button>
                      </div>
                    )}

                    {/* Stats line */}
                    {(() => {
                      const cardKey = generateCardKey(
                        categoryId || '',
                        currentFlashcard.german
                      )
                      const stats = getQuizStat(cardKey)
                      if (stats && stats.totalAttempts > 0) {
                        const correctPercentage = Math.round(
                          (stats.correctCount / stats.totalAttempts) * 100
                        )
                        return (
                          <div className="quiz-stats">
                            You knew this {stats.correctCount} out of {stats.totalAttempts}{' '}
                            time{stats.totalAttempts !== 1 ? 's' : ''} ({correctPercentage}
                            %)
                          </div>
                        )
                      }
                      return null
                    })()}
                  </div>
                )}
              </div>
            </div>

            <ProgressBar current={currentIndex} total={flashcards.length} />
            <ControlsHint />
          </div>

          {showCamera && <MemoizedCameraSection currentGesture={currentGesture} />}
        </div>
      </main>
    </div>
  )
}

export default LessonPage
