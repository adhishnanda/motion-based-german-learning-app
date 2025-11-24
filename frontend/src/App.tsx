import React, { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LessonPage from "./pages/LessonPage";
import { PoseProvider } from "./cv/poseContext";
import { SettingsProvider } from "./contexts/SettingsContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TelemetryProvider } from "./contexts/TelemetryContext";
import OnboardingModal from "./components/OnboardingModal";
import SettingsPanel from "./components/SettingsPanel";
import { useOnboarding } from "./hooks/useOnboarding";

const AppContent: React.FC = () => {
  const [showOnboarding, dismissOnboarding] = useOnboarding();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/lesson/:categoryId" element={<LessonPage />} />
        </Routes>
      </div>

      <button
        className="settings-gear-btn"
        onClick={() => setShowSettings(true)}
        aria-label="Open settings"
        type="button"
      >
        ⚙️
      </button>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <OnboardingModal isOpen={showOnboarding} onClose={dismissOnboarding} />
    </>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SettingsProvider>
          <TelemetryProvider>
            <PoseProvider>
              <AppContent />
            </PoseProvider>
          </TelemetryProvider>
        </SettingsProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
