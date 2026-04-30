import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RuntimeStatus, Mode } from '../types';
import { cn } from '../utils/cn';
import { useApp } from '../context/AppContext';

interface StartScreenProps {
  status: RuntimeStatus;
  mode: Mode;
}

export const StartScreen: React.FC<StartScreenProps> = ({ status, mode }) => {
  const navigate = useNavigate();
  const { t } = useApp();

  useEffect(() => {
    if (status === 'ready') {
      const timer = setTimeout(() => {
        navigate('/chat');
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [status, navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[calc(100vh-56px)] p-6 text-center space-y-8">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Tele<span className="text-accent-primary">•</span>GPT
        </h1>
        <p className="text-text-secondary text-sm">{t('app.subtitle')}</p>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "px-4 py-2 rounded-full text-sm font-medium border",
          status === 'ready' ? "bg-status-ready/10 text-status-ready border-status-ready/20" :
          status === 'loading' ? "bg-status-loading/10 text-status-loading border-status-loading/20" :
          "bg-status-offline/10 text-status-offline border-status-offline/20"
        )}>
          Status: {t(('status.' + status) as any)}
        </div>

        {status !== 'ready' && (
          <button 
            className="px-6 py-2 bg-surface hover:bg-white/10 border border-border rounded-lg transition-colors"
            onClick={() => window.location.reload()}
          >
            {t('btn.retry')}
          </button>
        )}

        {status === 'ready' && (
          <button
            onClick={() => navigate('/chat')}
            className="px-8 py-3 bg-accent-primary hover:bg-blue-600 text-white font-bold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
          >
            {t('start.open_chat')}
          </button>
        )}
      </div>

      {mode === 'maker' && (
        <div className="text-xs text-text-muted font-mono mt-8">
          {t('start.last_activity')} {new Date().toLocaleTimeString()}
          <br />
          {t('start.build')} v1.0.0-alpha
        </div>
      )}
    </div>
  );
};
