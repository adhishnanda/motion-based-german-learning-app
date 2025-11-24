import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Pose } from '@mediapipe/pose'
import { Camera } from '@mediapipe/camera_utils'
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils'
import { POSE_CONNECTIONS } from '@mediapipe/pose'
import { usePoseContext } from '../cv/poseContext'
import { getGestureLabel, type GestureType } from '../cv/gestureTypes'
import { inferGestureFromLandmarks, type PoseLandmark } from '../cv/gestureEngine'
import { useSettings } from '../contexts/SettingsContext'

// Temporal smoothing configuration
const MAX_HISTORY_LENGTH = 7
const MIN_HISTORY_LENGTH = 4

// Performance: RAF throttling for pose results (module-level to persist across renders)
let globalRafId: number | null = null
let globalPendingResults: any = null
let globalLastFrameTime = 0
const TARGET_FPS = 30 // Target FPS for pose updates
const FRAME_INTERVAL = 1000 / TARGET_FPS

/**
 * Process pose results: detect gestures and draw on canvas.
 * Extracted for RAF throttling.
 */
function processPoseResults(
  results: any,
  canvas: HTMLCanvasElement,
  gestureSensitivityFactor: number,
  gestureHistoryRef: React.MutableRefObject<GestureType[]>,
  currentGestureRef: React.MutableRefObject<GestureType>,
  setGesture: (g: GestureType) => void
) {
  // Detect gesture from pose landmarks (primary detection method)
  if (results.poseLandmarks) {
    // Convert MediaPipe landmarks to PoseLandmark[] format
    const poseLandmarks = convertMediaPipeLandmarks(results.poseLandmarks)

    // Infer gesture from landmarks using gesture engine with sensitivity factor
    const inferredGesture = inferGestureFromLandmarks(poseLandmarks, gestureSensitivityFactor)

    // Add to history for temporal smoothing
    gestureHistoryRef.current.push(inferredGesture)

    // Limit history length to MAX_HISTORY_LENGTH
    if (gestureHistoryRef.current.length > MAX_HISTORY_LENGTH) {
      gestureHistoryRef.current.shift()
    }

    // Compute majority gesture from history
    if (gestureHistoryRef.current.length >= MIN_HISTORY_LENGTH) {
      const majorityGesture = computeMajorityGesture(gestureHistoryRef.current)

      // Only update gesture if:
      // a) majorityGesture is different from currentGesture
      // b) and history has at least MIN_HISTORY_LENGTH entries
      if (majorityGesture && majorityGesture !== currentGestureRef.current) {
        setGesture(majorityGesture)
      }
    }
  }

  // Draw on canvas
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw pose connections and landmarks
  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: '#00FF00',
      lineWidth: 2,
    })
    drawLandmarks(ctx, results.poseLandmarks, {
      color: '#FF0000',
      lineWidth: 1,
      radius: 3,
    })
  }

  ctx.restore()
}

/**
 * Computes the majority gesture from a history array.
 * Returns the gesture that appears most frequently.
 * Memoized to avoid recomputation for unchanged history.
 */
const computeMajorityGesture = (() => {
  let lastHistory: GestureType[] = []
  let lastResult: GestureType | null = null
  
  return (history: GestureType[]): GestureType | null => {
    // Quick check: if history hasn't changed, return cached result
    if (history.length === lastHistory.length && 
        history.every((g, i) => g === lastHistory[i])) {
      return lastResult
    }
    
    if (history.length === 0) {
      lastHistory = []
      lastResult = null
      return null
    }

    const counts: Record<GestureType, number> = {
      REST: 0,
      NEXT: 0,
      PREV: 0,
      SELECT: 0,
    }

    // Count occurrences of each gesture
    for (const gesture of history) {
      counts[gesture]++
    }

    // Find the gesture with the highest count
    let majorityGesture: GestureType = 'REST'
    let maxCount = 0

    for (const [gesture, count] of Object.entries(counts) as [GestureType, number][]) {
      if (count > maxCount) {
        maxCount = count
        majorityGesture = gesture
      }
    }

    lastHistory = [...history] // Store copy
    lastResult = majorityGesture
    return majorityGesture
  }
})()

/**
 * Converts MediaPipe Pose landmarks to PoseLandmark[] format.
 * Memoized to avoid unnecessary array operations.
 */
const convertMediaPipeLandmarks = (() => {
  let lastInput: any[] | null = null
  let lastOutput: PoseLandmark[] | null = null
  
  return (mpLandmarks: any[]): PoseLandmark[] => {
    // Quick check: if same reference, return cached
    if (mpLandmarks === lastInput && lastOutput !== null) {
      return lastOutput
    }
    
    const result = mpLandmarks.map((landmark) => ({
      x: landmark.x,
      y: landmark.y,
      z: landmark.z,
      visibility: landmark.visibility,
    }))
    
    lastInput = mpLandmarks
    lastOutput = result
    return result
  }
})()

const CameraFeedComponent: React.FC = () => {
  const { currentGesture, setGesture } = usePoseContext()
  const { settings, gestureSensitivityFactor } = useSettings()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gestureHistoryRef = useRef<GestureType[]>([])
  const currentGestureRef = useRef<GestureType>(currentGesture)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isPoseReady, setIsPoseReady] = useState(false)
  
  // Get numeric sensitivity from localStorage (SettingsPanel stores 0-1 range)
  // This takes precedence over SettingsContext's Low/Medium/High for gestureEngine
  const [numericSensitivity, setNumericSensitivity] = useState(() => {
    try {
      const stored = localStorage.getItem('gestureSensitivity')
      if (stored !== null) {
        const parsed = parseFloat(stored)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          return parsed
        }
      }
    } catch (error) {
      console.warn('Failed to load gestureSensitivity from localStorage:', error)
    }
    return 0.12 // Default value matching gestureEngine
  })
  
  // Listen for localStorage changes to update sensitivity in real-time
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'gestureSensitivity' && e.newValue !== null) {
        const newValue = parseFloat(e.newValue)
        if (!isNaN(newValue) && newValue >= 0 && newValue <= 1) {
          setNumericSensitivity(newValue)
        }
      }
    }
    
    // Also check localStorage directly (for same-window changes)
    const checkSensitivity = () => {
      try {
        const stored = localStorage.getItem('gestureSensitivity')
        if (stored !== null) {
          const parsed = parseFloat(stored)
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
            setNumericSensitivity(parsed)
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    const interval = setInterval(checkSensitivity, 500) // Check every 500ms
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])
  
  // Memoize settings to avoid unnecessary re-renders
  const mirrorCamera = useMemo(() => settings.mirrorCamera, [settings.mirrorCamera])

  // Keep ref in sync with currentGesture for use in pose callback
  useEffect(() => {
    currentGestureRef.current = currentGesture
  }, [currentGesture])

  // Set up MediaPipe Pose and webcam
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    let stream: MediaStream | null = null
    let pose: Pose | null = null
    let camera: Camera | null = null

    const setupPose = async () => {
      try {
        setIsLoading(true)
        setIsPoseReady(false)
        setHasError(false)
        
        // Initialize Pose solution
        pose = new Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
          },
        })

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        // Set up pose results callback with RAF throttling
        pose.onResults((results) => {
          // Mark pose as ready when we receive first valid landmarks
          if (results.poseLandmarks && results.poseLandmarks.length > 0 && !isPoseReady) {
            setIsPoseReady(true)
          }
          
          // Store pending results
          globalPendingResults = results
          
          // Throttle updates using requestAnimationFrame
          const now = performance.now()
          const timeSinceLastFrame = now - globalLastFrameTime
          
          if (timeSinceLastFrame >= FRAME_INTERVAL) {
            // Process immediately if enough time has passed
            processPoseResults(results, canvas, numericSensitivity, gestureHistoryRef, currentGestureRef, setGesture)
            globalLastFrameTime = now
            globalPendingResults = null
          } else {
            // Schedule for next frame if pending RAF doesn't exist
            if (globalRafId === null) {
              globalRafId = requestAnimationFrame(() => {
                if (globalPendingResults) {
                  processPoseResults(globalPendingResults, canvas, numericSensitivity, gestureHistoryRef, currentGestureRef, setGesture)
                  globalLastFrameTime = performance.now()
                  globalPendingResults = null
                }
                globalRafId = null
              })
            }
          }
        })

        // Request webcam access
        stream = await navigator.mediaDevices.getUserMedia({ video: true })

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }

        // Wait for video metadata to load
        await new Promise((resolve) => {
          if (video.readyState >= 2) {
            resolve(void 0)
          } else {
            video.onloadedmetadata = () => resolve(void 0)
          }
        })

        // Set canvas size to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        // Initialize camera helper to process frames
        camera = new Camera(video, {
          onFrame: async () => {
            if (pose) {
              await pose.send({ image: video })
            }
          },
          width: video.videoWidth,
          height: video.videoHeight,
        })

        camera.start()

        // Mark as loaded after a small delay to ensure video is rendering
        setTimeout(() => {
          setIsLoading(false)
        }, 300)

        console.log('MediaPipe Pose initialized successfully')
      } catch (error) {
        console.error('Error setting up MediaPipe Pose:', error)
        setHasError(true)
        setIsLoading(false)
      }
    }

    setupPose()

    // Cleanup: stop all tracks and close MediaPipe resources when component unmounts
    return () => {
      // Cancel pending RAF
      if (globalRafId !== null) {
        cancelAnimationFrame(globalRafId)
        globalRafId = null
      }
      globalPendingResults = null
      
      // Stop camera
      if (camera) {
        camera.stop()
      }

      // Close pose
      if (pose) {
        pose.close()
      }

      // Stop all tracks from the current video element
      if (videoRef.current && videoRef.current.srcObject) {
        const mediaStream = videoRef.current.srcObject as MediaStream
        mediaStream.getTracks().forEach((track) => {
          track.stop()
        })
        videoRef.current.srcObject = null
      }

      // Also stop the stream variable if it was set
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop()
        })
      }
    }
  }, [setGesture, numericSensitivity])

  // Keyboard gesture simulation (fallback when pose detection is not available)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Map keyboard keys to gesture types
      const keyToGesture: Record<string, GestureType> = {
        r: 'REST',
        n: 'NEXT',
        p: 'PREV',
        s: 'SELECT',
      }

      const gesture = keyToGesture[event.key.toLowerCase()]

      if (gesture) {
        event.preventDefault()
        // Clear gesture history when keyboard override is used
        gestureHistoryRef.current = []
        // Override with keyboard input (useful for testing/fallback)
        setGesture(gesture)
      }
    }

    // Attach event listener
    window.addEventListener('keydown', handleKeyDown)

    // Cleanup: remove event listener on unmount
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [setGesture])

  return (
    <div className="camera-panel">
      <h2>Gesture Camera</h2>
      <p style={{ fontSize: '0.9em', color: 'var(--color-text-secondary)', marginBottom: '1rem' }}>
        Your gestures (NEXT/PREV/SELECT) are detected here.
      </p>
      <div className="camera-container">
        {/* Camera Active Label */}
        {!isLoading && isPoseReady && !hasError && (
          <div className="camera-active-label">
            <span className="camera-active-dot"></span>
            Camera Active
          </div>
        )}

        {/* Loading placeholder */}
        {(isLoading || !isPoseReady) && !hasError && (
          <div className="camera-loading-placeholder">
            <div className="camera-loading-spinner"></div>
            <p className="camera-loading-text">
              {isLoading ? 'Initializing camera...' : 'Initializing pose detection...'}
            </p>
          </div>
        )}

        {/* Error placeholder */}
        {hasError && (
          <div className="camera-error-placeholder">
            <p className="camera-error-text">⚠️ Camera not available</p>
            <p className="camera-error-hint">Use keyboard controls instead</p>
          </div>
        )}

        <div className="camera-video-wrapper">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="camera-video"
            style={{
              transform: mirrorCamera ? 'scaleX(-1)' : 'none',
              opacity: isLoading || !isPoseReady ? 0 : 1,
              transition: 'opacity 300ms ease-out',
            }}
          />
          <canvas
            ref={canvasRef}
            className="camera-canvas"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              opacity: isLoading || !isPoseReady ? 0 : 1,
              transition: 'opacity 300ms ease-out',
            }}
          />
        </div>
      </div>
      {!hasError && (
        <p style={{ marginTop: '1rem' }}>
          <strong>Current gesture:</strong>{' '}
          <span className="gesture-badge">{getGestureLabel(currentGesture)}</span>
        </p>
      )}
      <p style={{ fontSize: '0.85em', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
        Press 'r' for REST, 'n' for NEXT, 'p' for PREV, 's' for SELECT (keyboard fallback)
      </p>
    </div>
  )
}

// Memoize CameraFeed to prevent unnecessary re-renders
// Since CameraFeed uses context, React.memo will help with internal optimization
const CameraFeed = React.memo(CameraFeedComponent)

export default CameraFeed

