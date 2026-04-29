import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { cn } from '../utils/cn';
import { RuntimeStatus, Mode } from '../types';
import { useApp } from '../context/AppContext';
import { Language } from '../utils/translations';

interface HeaderProps {
  status: RuntimeStatus;
  mode: Mode;
  modelName: string;
  onToggleMode: () => void;
  onModelClick: () => void;
  onMenuClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  mode,
  modelName: _modelName,
  onToggleMode,
  onModelClick: _onModelClick,
  onMenuClick,
}) => {
  const { t, language, setLanguage, activityStatus } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isForge = location.pathname.startsWith('/forge');
  const effectiveStatus = activityStatus || status;
  
  const getStatusColor = (s: RuntimeStatus) => {
    switch (s) {
      case 'ready': return 'text-status-ready';
      case 'loading': return 'text-status-loading';
      case 'offline': return 'text-status-offline';
      case 'degraded': return 'text-status-degraded';
      case 'streaming': return 'text-accent-primary';
      default: return 'text-gray-500';
    }
  };

  const getStatusLabel = (s: RuntimeStatus) => {
    switch(s) {
        case 'ready': return t('status.ready');
        case 'loading': return t('status.loading');
        case 'streaming': return t('status.streaming');
        case 'offline': return t('status.offline');
        case 'degraded': return t('status.degraded');
        default: return s;
    }
  };

  const toggleLanguage = () => {
    const next: Language = language === 'en' ? 'ru' : language === 'ru' ? 'uz' : 'en';
    setLanguage(next);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 bg-background/95 backdrop-blur border-b border-border h-[52px] md:h-[56px]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Left Zone */}
      <div className="flex items-center gap-2 w-[120px] md:w-[160px]">
        {/* Back Button */}
        {!isHome && (
          <button onClick={() => navigate('/')} className="p-1 hover:bg-white/10 rounded">
            <ChevronLeft size={20} />
          </button>
        )}
        
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="font-bold text-lg tracking-tight">
            Tele<span className="text-accent-primary">•</span>GPT
          </div>
          <span className="text-[10px] bg-white/10 px-1 rounded text-text-muted">v1.0</span>
          {!isForge && (
            <NavLink
              to="/forge"
              className="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
            >
              ⚡ FORGE
            </NavLink>
          )}
          {isForge && (
            <NavLink
              to="/forge/operator"
              className="ml-2 px-2 py-0.5 text-xs font-bold rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              👁 OPERATOR
            </NavLink>
          )}
        </div>
      </div>

      {/* Center Zone */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Tabs */}
        {!isHome && (
          <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-lg">
            {['chat', 'translate', 'json'].map((tab) => (
              <NavLink
                key={tab}
                to={`/${tab}`}
                className={({ isActive }) => cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-colors",
                  isActive ? "bg-white/10 text-white" : "text-text-secondary hover:text-white hover:bg-white/5"
                )}
              >
                {t(`tab.${tab}` as any)}
              </NavLink>
            ))}
          </div>
        )}
        
        {/* Status Indicator */}
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", getStatusColor(effectiveStatus))} />
          <span className={cn("text-[10px] font-medium uppercase tracking-wider", getStatusColor(effectiveStatus))}>
            {getStatusLabel(effectiveStatus)}
          </span>
        </div>
      </div>

      {/* Right Zone */}
      <div className="flex items-center justify-end gap-2 w-[120px] md:w-[220px]">
        {/* Language Toggle */}
        <button 
            onClick={toggleLanguage}
            className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/10 text-xs font-bold text-text-secondary transition-colors"
        >
            {language.toUpperCase()}
        </button>

        {/* Mode Toggle */}
        <button
          onClick={onToggleMode}
          className={cn(
            "hidden md:block px-2 py-0.5 text-xs font-bold rounded border transition-colors",
            mode === 'maker' 
              ? "border-accent-primary text-accent-primary bg-accent-primary/10" 
              : "border-white/20 text-text-muted hover:text-white"
          )}
        >
          {mode === 'maker' ? 'MAKER' : 'PUBLIC'}
        </button>

        {/* Mobile Menu (placeholder for mode toggle/etc) */}
        <button onClick={onMenuClick} className="md:hidden p-1 text-text-secondary">
           <MoreHorizontal size={20} />
        </button>
      </div>
    </header>
  );
};
