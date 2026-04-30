import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { AppState } from '../types/state';
import { useApp } from '../context/AppContext';

interface BootScreenProps {
  appState: AppState;
  onRetry: () => void;
}

export const BootScreen: React.FC<BootScreenProps> = ({ appState, onRetry }) => {
  const { t } = useApp();
  const isOffline = appState === 'AppOffline';

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-background text-text-primary p-6 space-y-8">
      <div className="space-y-2 text-center animate-in fade-in zoom-in duration-500">
        <h1 className="text-5xl font-bold tracking-tight">
          Tele<span className="text-accent-primary">•</span>GPT
        </h1>
        <p className="text-text-secondary text-lg">{t('app.subtitle')}</p>
      </div>

      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center gap-3 px-6 py-3 rounded-full bg-surface border border-border/50 shadow-lg">
          {isOffline ? (
            <AlertCircle className="text-status-offline animate-pulse" size={24} />
          ) : (
            <Loader2 className="text-accent-primary animate-spin" size={24} />
          )}
          <span className="font-medium text-lg">
            {isOffline ? t('status.offline') : t('status.loading')}
          </span>
        </div>

        {isOffline && (
          <button 
            onClick={onRetry}
            className="flex items-center gap-2 px-8 py-3 bg-surface hover:bg-white/10 border border-border rounded-xl transition-all hover:scale-105 active:scale-95"
          >
            <RefreshCw size={20} />
            {t('btn.retry')}
          </button>
        )}
      </div>

      <div className="absolute bottom-8 text-xs text-text-muted font-mono opacity-50">
        {isOffline ? 'Connection failed. Check your network.' : 'Initializing runtime...'}
      </div>
    </div>
  );
};
