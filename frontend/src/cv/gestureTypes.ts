// frontend/src/cv/gestureTypes.ts

// A simple string union type for gestures
export type GestureType = "REST" | "NEXT" | "PREV" | "SELECT";

// All gestures in an array (useful for debugging or dropdowns)
export const ALL_GESTURES: GestureType[] = ["REST", "NEXT", "PREV", "SELECT"];

// Pretty labels for UI
export function getGestureLabel(gesture: GestureType): string {
  switch (gesture) {
    case "REST":
      return "Rest / Neutral";
    case "NEXT":
      return "Next Card";
    case "PREV":
      return "Previous Card";
    case "SELECT":
      return "Select / Confirm";
    default:
      return gesture;
  }
}
