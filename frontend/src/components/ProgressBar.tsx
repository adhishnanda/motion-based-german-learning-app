import React from 'react'
import '../styles/components.css'

interface ProgressBarProps {
  current: number
  total: number
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = total > 0 ? ((current + 1) / total) * 100 : 0

  return (
    <div className="progress-bar-container">
      {/* Progress bar track */}
      <div className="progress-bar-track">
        {/* Progress bar fill */}
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      {/* Progress text label */}
      <p className="progress-bar-label">
        {current + 1} / {total} ({percentage.toFixed(0)}%)
      </p>
    </div>
  )
}

export default ProgressBar

