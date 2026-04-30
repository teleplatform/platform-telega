import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Mode, RuntimeStatus, Model } from '../types';
import { AppState } from '../types/state';
import { useRuntimeStatus } from '../hooks/useRuntimeStatus';
import { useModels } from '../hooks/useModels';
import { ModelSelector } from '../components/modals/ModelSelector';
import { translations, Language } from '../utils/translations';

interface AppContextType {
  mode: Mode;
  setMode: (mode: Mode) => void;
  status: RuntimeStatus;
  activityStatus: RuntimeStatus | null;
  setActivityStatus: (s: RuntimeStatus | null) => void;
  appState: AppState;
  retryBoot: () => void;
  models: Model[];
  selectedModel: string;
  selectModel: (id: string) => void;
  openModelSelector: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
  busyFeature: string | null;
  setBusyFeature: (feature: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>('public');
  const [busyFeature, setBusyFeature] = useState<string | null>(null);
  const [activityStatus, setActivityStatus] = useState<RuntimeStatus | null>(null);
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'ru' || saved === 'uz') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);
  
  const { appState, status, retry } = useRuntimeStatus();
  const { models, selectedModel, selectModel } = useModels(status);
  const [isModelSelectorOpen, setIsModelSelectorOpen] = useState(false);

  // Helper translation function
  const t = (key: keyof typeof translations['en']): string => {
    return translations[language][key] || translations['en'][key] || key;
  };

  return (
    <AppContext.Provider value={{ 
      mode, 
      setMode, 
      status,
      activityStatus,
      setActivityStatus,
      appState,
      retryBoot: retry,
      models, 
      selectedModel, 
      selectModel,
      openModelSelector: () => setIsModelSelectorOpen(true),
      language,
      setLanguage,
      t,
      busyFeature,
      setBusyFeature
    }}>
      {children}
      <ModelSelector 
        isOpen={isModelSelectorOpen} 
        onClose={() => setIsModelSelectorOpen(false)} 
        models={models}
        selectedModelId={selectedModel}
        onSelect={selectModel}
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
