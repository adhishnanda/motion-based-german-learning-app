"""
Gesture Data Collection Script (Session-based)

Collects pose landmarks from webcam using MediaPipe with a structured, session-based
workflow per gesture. Saves each session to its own CSV with clear naming.

Data format remains compatible with existing notebooks:
- Landmark columns: landmark_{index}_{x|y|z|visibility}
- Label column: 'gesture' (also includes 'gesture_label' for backward compatibility)
- Additional metadata: session_id, frame_index, timestamp
"""

import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import os
from datetime import datetime
from typing import List, Dict, Optional
import time


def extract_landmarks(pose_landmarks) -> Optional[np.ndarray]:
    """
    Extract and flatten pose landmarks into a 1D numpy array.
    
    Args:
        pose_landmarks: MediaPipe pose landmarks object
        
    Returns:
        Flattened numpy array of [x, y, z, visibility] for each landmark,
        or None if no landmarks provided
    """
    if pose_landmarks is None:
        return None
    
    landmarks = []
    for landmark in pose_landmarks.landmark:
        landmarks.extend([landmark.x, landmark.y, landmark.z, landmark.visibility])
    
    return np.array(landmarks)


def get_output_path() -> str:
    """
    Get the path to the gesture_raw data directory.
    Uses __file__ to ensure correct relative path from ml/scripts/.
    
    Returns:
        Absolute path to ../data/gesture_raw/ directory
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    ml_dir = os.path.dirname(script_dir)
    data_dir = os.path.join(ml_dir, 'data', 'gesture_raw')
    return data_dir


def save_samples(samples: List[Dict], output_dir: str) -> None:
    """
    Convert samples list to DataFrame and save as CSV.
    
    Args:
        samples: List of dictionaries containing sample data
        output_dir: Directory path where CSV should be saved
    """
    if not samples:
        print("No samples collected. Nothing to save.")
        return
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert to DataFrame
    df = pd.DataFrame(samples)
    
    # Generate filename with timestamp; prefer per-session naming if available
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    gesture = samples[0].get('gesture', samples[0].get('gesture_label', 'UNKNOWN'))
    session_id = samples[0].get('session_id', ts)
    filename = f"{gesture}_session_{ts}.csv"
    filepath = os.path.join(output_dir, filename)
    
    # Save to CSV
    df.to_csv(filepath, index=False)
    print(f"\nSaved {len(samples)} samples to: {filepath}")


def main() -> None:
    """Main function to run session-based gesture collection."""

    # Initialize MediaPipe Pose
    mp_pose = mp.solutions.pose
    pose = mp_pose.Pose(
        static_image_mode=False,
        model_complexity=1,
        enable_segmentation=False,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    mp_drawing = mp.solutions.drawing_utils
    
    # Initialize webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam.")
        return
    
    print("=== Gesture Data Collection (Session-based) ===")
    print("Instructions:")
    print("- Stand at a comfortable distance facing the camera.")
    print("- Hold the chosen gesture steadily during recording.")
    print("- Repeat for each gesture to build a balanced dataset.\n")

    gestures = ["REST", "NEXT", "PREV", "SELECT"]
    per_gesture_counts: Dict[str, int] = {g: 0 for g in gestures}

    def prompt_gesture() -> Optional[str]:
        print("Available gestures:", ", ".join(gestures))
        choice = input("Choose a gesture label (or type 'exit' to finish): ").strip().upper()
        if choice == 'EXIT':
            return None
        if choice not in gestures:
            print(f"Invalid choice '{choice}'. Try again.\n")
            return prompt_gesture()
        return choice

    def prompt_count() -> int:
        try:
            n = int(input("How many frames to record for this session (e.g., 100)? ").strip())
            return max(1, n)
        except Exception:
            print("Invalid number. Defaulting to 100.")
            return 100

    def countdown():
        print("Starting in:")
        for s in [3, 2, 1]:
            print(f"  {s}...")
            time.sleep(1)
        print("Recording!\n")

    try:
        while True:
            gesture_label = prompt_gesture()
            if gesture_label is None:
                print("Exiting collection loop.")
                break

            num_frames = prompt_count()
            session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
            session_samples: List[Dict] = []

            print(f"\nPrepare for gesture: {gesture_label}")
            countdown()

            frame_index = 0
            collected = 0

            while collected < num_frames:
                ret, frame = cap.read()
                if not ret:
                    print("Error: Failed to read frame from webcam.")
                    break

                # Flip for mirror view and process
                frame = cv2.flip(frame, 1)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = pose.process(rgb_frame)

                # Draw feedback
                if results.pose_landmarks:
                    mp_drawing.draw_landmarks(
                        frame,
                        results.pose_landmarks,
                        mp_pose.POSE_CONNECTIONS,
                        mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=2),
                        mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
                    )

                # Overlay session info
                cv2.putText(frame, f"Gesture: {gesture_label}  Session: {session_id}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                cv2.putText(frame, f"Frame: {collected+1}/{num_frames}", (10, 60),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
                cv2.imshow('Gesture Collection (Session Mode)', frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("\nQuitting early...")
                    break

                # Capture landmark sample
                if results.pose_landmarks:
                    landmarks = extract_landmarks(results.pose_landmarks)
                    if landmarks is not None:
                        sample = {
                            'session_id': session_id,
                            'frame_index': frame_index,
                            'timestamp': datetime.now().isoformat(),
                            'gesture': gesture_label,          # primary label column for notebooks
                            'gesture_label': gesture_label     # backward-compat
                        }
                        for i in range(len(landmarks) // 4):
                            base_idx = i * 4
                            sample[f'landmark_{i}_x'] = landmarks[base_idx]
                            sample[f'landmark_{i}_y'] = landmarks[base_idx + 1]
                            sample[f'landmark_{i}_z'] = landmarks[base_idx + 2]
                            sample[f'landmark_{i}_visibility'] = landmarks[base_idx + 3]
                        session_samples.append(sample)
                        collected += 1

                frame_index += 1

            # Save session
            if session_samples:
                output_dir = get_output_path()
                save_samples(session_samples, output_dir)
                per_gesture_counts[gesture_label] += len(session_samples)

                # Summary and recommendation
                print("\n=== Session Summary ===")
                for g in gestures:
                    print(f"  {g}: {per_gesture_counts[g]} total samples (this run)")
                print("Recommendation: collect at least 120–150 samples per gesture.\n")

            # Ask to continue or switch gesture
            cont = input("Record another batch? (y to continue, other to choose gesture/exit): ").strip().lower()
            if cont == 'y':
                continue
            # else loop will re-prompt gesture (or exit)

    except KeyboardInterrupt:
        print("\nInterrupted by user.")

    finally:
        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        print("Cleanup done.")


if __name__ == "__main__":
    main()

