import React from 'react'
import type { Flashcard as FlashcardType } from '../data/flashcards'

interface FlashcardProps {
  flashcard: FlashcardType
  showTranslation: boolean
  isFlipping: boolean
  className?: string
  answerFeedback?: 'correct' | 'incorrect' | null
}

const FlashcardComponent: React.FC<FlashcardProps> = ({
  flashcard,
  showTranslation,
  isFlipping,
  className = '',
  answerFeedback = null,
}) => {
  // Build feedback class name
  const feedbackClass = answerFeedback ? `flashcard--${answerFeedback}` : ''
  
  return (
    <div className={`flashcard-flip-container ${className} ${feedbackClass}`}>
      <div
        className={`flashcard-flip-inner ${showTranslation ? 'flipped' : ''} ${isFlipping ? 'flipping' : ''}`}
      >
        {/* Front side - German */}
        <div className="flashcard-face flashcard-face-front">
          {flashcard.image_local && (
            <img
              src={`/${flashcard.image_local}`}
              alt={flashcard.german}
              className="flashcard-image"
              onError={(e) => {
                const target = e.target as HTMLImageElement
                if (flashcard.image_url) {
                  target.src = flashcard.image_url
                } else {
                  target.style.display = 'none'
                }
              }}
            />
          )}
          <div className="flashcard-text">
            <h2 className="flashcard-german">{flashcard.german || 'Unknown'}</h2>
            <p className="flashcard-hint">Tap or SELECT gesture to flip</p>
          </div>
        </div>

        {/* Back side - English */}
        <div className="flashcard-face flashcard-face-back">
          <div className="flashcard-text">
            <h2 className="flashcard-german">{flashcard.german || 'Unknown'}</h2>
            <div className="flashcard-translation-wrapper">
              <span className="flashcard-translation-label">Translation</span>
              <p className="flashcard-translation">
                {flashcard.english || 'Translation not available yet'}
              </p>
              {flashcard.example_de && flashcard.example_en && (
                <div className="flashcard-examples">
                  <div className="flashcard-example">
                    <span className="flashcard-example-label">DE:</span>
                    <p className="flashcard-example-text">{flashcard.example_de}</p>
                  </div>
                  <div className="flashcard-example">
                    <span className="flashcard-example-label">EN:</span>
                    <p className="flashcard-example-text">{flashcard.example_en}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Memoize Flashcard to prevent unnecessary re-renders
const Flashcard = React.memo(FlashcardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.flashcard.german === nextProps.flashcard.german &&
    prevProps.flashcard.english === nextProps.flashcard.english &&
    prevProps.showTranslation === nextProps.showTranslation &&
    prevProps.isFlipping === nextProps.isFlipping &&
    prevProps.className === nextProps.className &&
    prevProps.answerFeedback === nextProps.answerFeedback
  )
})

export default Flashcard

