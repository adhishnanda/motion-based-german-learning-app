import React from 'react'

interface OnboardingModalProps {
  isOpen: boolean
  onClose: () => void
}

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="onboarding-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="onboarding-modal">
        <div className="onboarding-content">
          <h2 className="onboarding-title">Welcome to Motion-Based German Learning</h2>
          
          <div className="onboarding-steps">
            <div className="onboarding-step">
              <span className="onboarding-step-number">1</span>
              <p className="onboarding-step-text">
                Allow camera access so we can detect your pose.
              </p>
            </div>
            
            <div className="onboarding-step">
              <span className="onboarding-step-number">2</span>
              <p className="onboarding-step-text">
                Use your right arm to go to the next card, left arm to go back.
              </p>
            </div>
            
            <div className="onboarding-step">
              <span className="onboarding-step-number">3</span>
              <p className="onboarding-step-text">
                Raise both hands to reveal or hide the translation (or use keyboard arrows + Space).
              </p>
            </div>
          </div>

          <button
            className="onboarding-button"
            onClick={onClose}
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  )
}

export default OnboardingModal

