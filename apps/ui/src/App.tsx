import { useState } from 'react';
import { useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { StartScreen } from './screens/StartScreen';
import { ChatScreen } from './screens/ChatScreen';
import { TranslateScreen } from './screens/TranslateScreen';
import { JsonScreen } from './screens/JsonScreen';
import { BootScreen } from './screens/BootScreen';
import { ForgeDashboardScreen } from './screens/ForgeDashboardScreen';
import { ForgeWorkflowScreen } from './screens/ForgeWorkflowScreen';
import { ForgeTimelineScreen, ForgeTimelineListScreen } from './screens/ForgeTimelineScreen';
import { ForgeTasksScreen } from './screens/ForgeTasksScreen';
import { ForgeGraphScreen } from './screens/ForgeGraphScreen';
import { ForgeReportScreen } from './screens/ForgeReportScreen';
import { useApp } from './context/AppContext';

function App() {
  const { mode, setMode, status, appState, retryBoot, selectedModel, openModelSelector } = useApp();
  const location = useLocation();
  
  if (appState === 'AppBoot' || appState === 'AppOffline') {
    return <BootScreen appState={appState} onRetry={retryBoot} />;
  }

  const [showClearModal, setShowClearModal] = useState(false);

  const handleMenuClick = () => {
    if (location.pathname === '/chat') {
       setShowClearModal(true);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-text-primary overflow-hidden">
      <Header
        status={status}
        mode={mode}
        modelName={selectedModel || 'Loading...'}
        onToggleMode={() => setMode(mode === 'public' ? 'maker' : 'public')}
        onModelClick={openModelSelector}
        onMenuClick={handleMenuClick}
      />

      <main className="flex-1 overflow-auto pt-[52px] md:pt-[56px]">
        <Routes>
          <Route path="/" element={<StartScreen status={status} mode={mode} />} />
          <Route path="/chat" element={<ChatScreen clearTrigger={showClearModal} onClearClose={() => setShowClearModal(false)} />} />
          <Route path="/translate" element={<TranslateScreen />} />
          <Route path="/json" element={<JsonScreen />} />
          <Route path="/forge" element={<ForgeDashboardScreen />} />
          <Route path="/forge/workflow/:id" element={<ForgeWorkflowScreen />} />
          <Route path="/forge/timeline/:id" element={<ForgeTimelineScreen />} />
          <Route path="/forge/timelines" element={<ForgeTimelineListScreen />} />
          <Route path="/forge/tasks" element={<ForgeTasksScreen />} />
          <Route path="/forge/graph" element={<ForgeGraphScreen />} />
          <Route path="/forge/report/:id" element={<ForgeReportScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
