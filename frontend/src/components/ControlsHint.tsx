import React from 'react'
import '../styles/components.css'

const ControlsHint: React.FC = () => {
  return (
    <div className="controls-hint">
      <h3 className="controls-hint-title">Controls</h3>
      <ul className="controls-hint-list">
        <li>
          <strong>NEXT</strong> → Raise right hand OR press <kbd className="controls-hint-kbd">→</kbd>
        </li>
        <li>
          <strong>PREV</strong> → Raise left hand OR press <kbd className="controls-hint-kbd">←</kbd>
        </li>
        <li>
          <strong>SELECT</strong> → Raise both hands OR press <kbd className="controls-hint-kbd">Space</kbd>
        </li>
      </ul>
    </div>
  )
}

export default ControlsHint

