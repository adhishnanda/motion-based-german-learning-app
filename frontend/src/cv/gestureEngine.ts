import type { GestureType } from './gestureTypes'

/**
 * Represents a single pose landmark from MediaPipe Pose.
 * Coordinates are normalized (0..1) with origin at top-left.
 */
export interface PoseLandmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

// MediaPipe Pose landmark indices
const LANDMARK_INDICES = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
} as const

// Minimum visibility confidence for a landmark to be considered (0..1)
const MIN_VISIBILITY = 0.5

/**
 * Gesture detection thresholds (normalized coordinates 0..1)
 * 
 * These thresholds were derived from offline ML analysis in ml/notebooks/gesture_threshold_analysis.ipynb
 * and extracted from ml/threshold_suggestions.json.
 * 
 * The analysis computed optimal separation points between gesture classes using statistical methods
 * (mean, median, quartiles) on collected gesture data.
 * 
 * Note: NEXT/PREV mappings are inverted in this implementation:
 * - dxRight (right wrist to right shoulder) maps to PREV gesture
 * - dxLeft (left shoulder to left wrist) maps to NEXT gesture
 */

// NEXT gesture thresholds
// Minimum horizontal distance for NEXT: left arm extended to the left (dxLeft > threshold)
const NEXT_DX_LEFT_MIN = 0.025  // Derived from NEXT_dxRight_min in JSON (mapped to dxLeft for NEXT gesture)
// Maximum vertical tolerance for NEXT: ensures wrist is roughly at shoulder height
const NEXT_ABS_DY_LEFT_MAX = 0.31  // Derived from NEXT_absDyRight_max in JSON

// PREV gesture thresholds
// Minimum horizontal distance for PREV: right arm extended to the right (dxRight > threshold)
const PREV_DX_RIGHT_MIN = -0.051  // Derived from PREV_dxLeft_min in JSON (mapped to dxRight for PREV gesture)
// Maximum vertical tolerance for PREV: ensures wrist is roughly at shoulder height
const PREV_ABS_DY_RIGHT_MAX = 0.334  // Derived from PREV_absDyLeft_max in JSON

// SELECT gesture threshold
// Both wrists must be above shoulders: dy < threshold (more negative dy = wrist higher than shoulder)
// In our coordinate system (y decreases upward), more negative dy values indicate wrist above shoulder
const SELECT_DY_THRESHOLD = -0.334  // Derived from SELECT_wristAboveShoulder in JSON

// Memoized sensitivity value cache
let cachedSensitivity: number | null = null
let lastSensitivityCheck: number = 0
const SENSITIVITY_CACHE_MS = 1000 // Cache for 1 second

/**
 * Loads gesture sensitivity from localStorage.
 * Returns the stored value or default (0.12) if not found or invalid.
 * Memoized with short-term cache to avoid repeated localStorage reads.
 */
function loadGestureSensitivityFromStorage(): number {
  const now = Date.now()
  
  // Return cached value if still valid
  if (cachedSensitivity !== null && (now - lastSensitivityCheck) < SENSITIVITY_CACHE_MS) {
    return cachedSensitivity
  }
  
  try {
    const stored = localStorage.getItem('gestureSensitivity')
    if (stored !== null) {
      const parsed = parseFloat(stored)
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        cachedSensitivity = parsed
        lastSensitivityCheck = now
        return parsed
      }
    }
  } catch (error) {
    console.warn('Failed to load gestureSensitivity from localStorage:', error)
  }
  
  cachedSensitivity = 0.12 // Default value
  lastSensitivityCheck = now
  return cachedSensitivity
}

/**
 * Infers the gesture type from MediaPipe Pose landmarks using rule-based logic.
 * 
 * The numeric thresholds used in this function were tuned using offline ML analysis
 * from ml/notebooks/gesture_threshold_analysis.ipynb and extracted from
 * ml/threshold_suggestions.json.
 *
 * @param landmarks - Array of pose landmarks from MediaPipe Pose
 * @param sensitivityFactor - Optional factor to adjust thresholds (defaults to value from localStorage).
 *                            If not provided, reads from localStorage["gestureSensitivity"] (default 0.12).
 *                            Lower values = easier to trigger, Higher values = harder to trigger.
 * @returns The detected gesture type, or "REST" if no gesture is detected or landmarks are invalid
 *
 * Rules (using ML-derived thresholds):
 * - NEXT: Left wrist is significantly to the left of left shoulder (dxLeft > threshold)
 *         and roughly at the same vertical level as the shoulder (absDyLeft < tolerance)
 *         Uses NEXT_DX_LEFT_MIN and NEXT_ABS_DY_LEFT_MAX thresholds from ML analysis.
 *
 * - PREV: Right wrist is significantly to the right of right shoulder (dxRight > threshold)
 *         and roughly at the same vertical level as the shoulder (absDyRight < tolerance)
 *         Uses PREV_DX_RIGHT_MIN and PREV_ABS_DY_RIGHT_MAX thresholds from ML analysis.
 *
 * - SELECT: Both wrists are significantly above their respective shoulders
 *           (dy < threshold, where more negative dy = wrist higher than shoulder)
 *           In our coordinate system (y decreases upward), more negative dy values indicate wrist above shoulder.
 *           Uses SELECT_DY_THRESHOLD from ML analysis.
 *
 * - REST: Default when no other gesture matches or landmarks are missing
 */
export function inferGestureFromLandmarks(
  landmarks: PoseLandmark[],
  sensitivityFactor?: number
): GestureType {
  // If sensitivityFactor not provided, load from localStorage
  const effectiveSensitivityFactor = sensitivityFactor ?? loadGestureSensitivityFromStorage()
  // Validate input
  if (!landmarks || landmarks.length < 17) {
    return 'REST'
  }

  // Extract required landmarks by index
  const leftShoulder = landmarks[LANDMARK_INDICES.LEFT_SHOULDER]
  const rightShoulder = landmarks[LANDMARK_INDICES.RIGHT_SHOULDER]
  const leftWrist = landmarks[LANDMARK_INDICES.LEFT_WRIST]
  const rightWrist = landmarks[LANDMARK_INDICES.RIGHT_WRIST]

  // Check if all required landmarks are present and visible
  if (
    !leftShoulder ||
    !rightShoulder ||
    !leftWrist ||
    !rightWrist ||
    (leftShoulder.visibility !== undefined && leftShoulder.visibility < MIN_VISIBILITY) ||
    (rightShoulder.visibility !== undefined && rightShoulder.visibility < MIN_VISIBILITY) ||
    (leftWrist.visibility !== undefined && leftWrist.visibility < MIN_VISIBILITY) ||
    (rightWrist.visibility !== undefined && rightWrist.visibility < MIN_VISIBILITY)
  ) {
    return 'REST'
  }

  // Compute relative positions (normalized coordinates)
  // These calculations match the feature engineering in ml/notebooks/gesture_threshold_analysis.ipynb
  
  // Horizontal differences:
  // dxRight: positive means right wrist is to the right of right shoulder
  // dxLeft: positive means left wrist is to the left of left shoulder
  const dxRight = rightWrist.x - rightShoulder.x
  const dxLeft = leftShoulder.x - leftWrist.x

  // Vertical differences (y decreases upward in MediaPipe):
  // dyRight: more negative means right wrist is above right shoulder
  // dyLeft: more negative means left wrist is above left shoulder
  const dyRight = rightShoulder.y - rightWrist.y
  const dyLeft = leftShoulder.y - leftWrist.y

  // Absolute vertical differences (for horizontal gesture tolerance):
  // Smaller values mean wrist is closer to shoulder height (better horizontal alignment)
  // These prevent diagonal movements from triggering horizontal gestures
  const absDyRight = Math.abs(rightWrist.y - rightShoulder.y)
  const absDyLeft = Math.abs(leftWrist.y - leftShoulder.y)

  // Apply sensitivity factor to thresholds
  // The sensitivity value from localStorage (0.12 default) represents ease of triggering:
  // - Lower values (e.g., 0.12) = easier to trigger = lower thresholds needed
  // - Higher values (e.g., 1.0) = harder to trigger = higher thresholds needed
  // To achieve this, we scale thresholds inversely with sensitivity:
  // Lower sensitivity → divide thresholds by larger number → smaller thresholds → easier to trigger ✓
  // Higher sensitivity → divide thresholds by smaller number → larger thresholds → harder to trigger ✓
  // Use inverse multiplier: lower sensitivity → higher multiplier → lower thresholds → easier ✓
  const thresholdMultiplier = 1.0 / Math.max(0.01, effectiveSensitivityFactor)
  const adjustedPrevDxRightMin = PREV_DX_RIGHT_MIN * thresholdMultiplier
  const adjustedPrevAbsDyRightMax = PREV_ABS_DY_RIGHT_MAX * thresholdMultiplier
  const adjustedNextDxLeftMin = NEXT_DX_LEFT_MIN * thresholdMultiplier
  const adjustedNextAbsDyLeftMax = NEXT_ABS_DY_LEFT_MAX * thresholdMultiplier
  const adjustedSelectDyThreshold = SELECT_DY_THRESHOLD * thresholdMultiplier

  // Rule 1: PREV gesture - Right arm extended to the right
  // Right wrist is significantly to the right of right shoulder (dxRight > threshold)
  // and roughly at the same vertical level (absDyRight < tolerance) to ensure horizontal movement
  // Uses ML-derived thresholds: PREV_DX_RIGHT_MIN and PREV_ABS_DY_RIGHT_MAX (adjusted by sensitivity)
  if (dxRight > adjustedPrevDxRightMin && absDyRight < adjustedPrevAbsDyRightMax) {
    return 'PREV'
  }

  // Rule 2: NEXT gesture - Left arm extended to the left
  // Left wrist is significantly to the left of left shoulder (dxLeft > threshold)
  // and roughly at the same vertical level (absDyLeft < tolerance) to ensure horizontal movement
  // Uses ML-derived thresholds: NEXT_DX_LEFT_MIN and NEXT_ABS_DY_LEFT_MAX (adjusted by sensitivity)
  if (dxLeft > adjustedNextDxLeftMin && absDyLeft < adjustedNextAbsDyLeftMax) {
    return 'NEXT'
  }

  // Rule 3: SELECT gesture - Both arms raised
  // Both wrists are significantly above their respective shoulders
  // In our coordinate system (y decreases upward), more negative dy = wrist higher than shoulder
  // Therefore, we check if dy < threshold (more negative than threshold)
  // Uses ML-derived threshold: SELECT_DY_THRESHOLD (adjusted by sensitivity)
  if (dyRight < adjustedSelectDyThreshold && dyLeft < adjustedSelectDyThreshold) {
    return 'SELECT'
  }

  // Default: REST (no active gesture)
  return 'REST'
}

