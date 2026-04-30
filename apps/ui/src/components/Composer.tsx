import React, { useState, useRef, useEffect } from 'react';
import { Send, Square, Trash2, AlertCircle, Mic } from 'lucide-react';
import { cn } from '../utils/cn';
import { useApp } from '../context/AppContext';
import { ConfirmClear } from './modals/ConfirmClear';
import { ChatState, VoiceState } from '../types/state';

interface ComposerProps {
  onSend: (text: string) => void;
  chatState: ChatState;
  onStop: () => void;
  placeholder?: string;
}

export const Composer: React.FC<ComposerProps> = ({ onSend, chatState, onStop, placeholder }) => {
  const { status, t, busyFeature, setBusyFeature } = useApp();
  const [text, setText] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [voiceState, setVoiceState] = useState<VoiceState>('VoiceIdle');

  const isGenerating = chatState === 'ChatLoading' || chatState === 'ChatStreaming';
  const isGlobalBusy = busyFeature && busyFeature !== 'voice' && busyFeature !== 'chat';
  const isOffline = status === 'offline';

  const inputPlaceholder = placeholder || t('chat.placeholder');

  // Auto-grow
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 130) + 'px';
    }
  }, [text]);

  // Focus/Clear Hotkeys
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K -> Focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        textareaRef.current?.focus();
      }
      // Cmd/Ctrl + L -> Clear (confirm)
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        handleClearRequest();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [text]);

  const handleClearRequest = () => {
    if (!text.trim()) return;
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    setText('');
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'Escape') {
      if (isGenerating) {
        onStop();
      } else {
        textareaRef.current?.blur();
      }
    }
  };

  const handleSend = () => {
    if (!text.trim() || isGenerating || isOffline || isGlobalBusy) return;
    onSend(text);
    setText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleMicClick = async () => {
    if (voiceState === 'VoiceIdle') {
      if (isGlobalBusy) return;
      try {
        setBusyFeature('voice');
        // Request mic access (future-ready: STT pipeline)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        setVoiceState('VoiceRecording');
        // Mock recording then processing
        setTimeout(() => {
          setVoiceState('VoiceProcessing');
          // Fallback: STT -> fill text and allow send
          setTimeout(() => {
            setText("Hello, this is a voice message simulation.");
            setVoiceState('VoiceIdle');
            setBusyFeature(null);
          }, 1000);
        }, 2000);
      } catch {
        setVoiceState('VoiceError');
        setBusyFeature(null);
        // Auto recover back to idle after showing error briefly
        setTimeout(() => setVoiceState('VoiceIdle'), 2500);
      }
    } else if (voiceState === 'VoiceRecording') {
      // Stop recording
      setVoiceState('VoiceIdle');
      setBusyFeature(null);
    }
  };

  return (
    <>
      <div className="bg-background border-t border-border p-3 pb-6 md:pb-4 min-h-[56px] relative z-20" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className={cn(
            "relative max-w-4xl mx-auto flex items-end gap-2 bg-surface rounded-2xl border transition-colors p-2",
            "focus-within:border-accent-primary/50",
            isOffline ? "border-status-offline/50" : "border-white/10",
            voiceState === 'VoiceRecording' && "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
          )}>
          
          {/* Voice Button (Left) */}
          <button
             onClick={handleMicClick}
             disabled={isOffline || isGenerating || (!!isGlobalBusy)}
             className={cn(
               "rounded-xl transition-all duration-200 flex-shrink-0 mb-0.5 w-11 h-11 flex items-center justify-center",
               voiceState === 'VoiceRecording' 
                 ? "bg-red-500 text-white animate-pulse" 
                 : "text-text-muted hover:bg-white/5 hover:text-text-primary",
               (isOffline || isGenerating || isGlobalBusy) && "opacity-50 cursor-not-allowed"
             )}
             title={t('composer.voice_soon')}
           >
             <Mic size={20} />
           </button>

          {/* Input Area or Voice Visualizer */}
          {voiceState === 'VoiceRecording' ? (
             <div className="flex-1 h-[38px] flex items-center justify-center gap-1">
               <span className="text-red-400 text-sm font-medium animate-pulse mr-2">{t('voice.listen')}</span>
               {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="w-1 bg-red-500 rounded-full animate-[bounce_1s_infinite]" style={{ height: Math.random() * 20 + 10 + 'px', animationDelay: i * 0.1 + 's' }} />
               ))}
             </div>
          ) : voiceState === 'VoiceProcessing' ? (
             <div className="flex-1 h-[38px] flex items-center justify-center text-text-muted text-sm animate-pulse">
               {t('composer.processing')}
             </div>
          ) : voiceState === 'VoiceError' ? (
             <div className="flex-1 h-[38px] flex items-center justify-center text-status-offline text-sm">
               {t('voice.mic_error')}
             </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isOffline ? t('chat.disabled.offline') : inputPlaceholder}
              disabled={isOffline || (!!isGlobalBusy)}
              rows={1}
              className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-[130px] py-2 px-2 text-sm md:text-base scrollbar-hide disabled:opacity-50 disabled:cursor-not-allowed"
            />
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1 mb-0.5">
             {/* Clear Button */}
             {text.trim().length > 0 && !isGenerating && voiceState === 'VoiceIdle' && (
               <button
                 onClick={handleClearRequest}
                 className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-red-400 transition-colors rounded-xl"
                 title={t('composer.clear_tooltip')}
               >
                 <Trash2 size={18} />
               </button>
             )}

             {/* Send / Stop Button */}
             <button
               onClick={isGenerating ? onStop : handleSend}
               disabled={(!text.trim() && !isGenerating) || isOffline || voiceState !== 'VoiceIdle' || (!!isGlobalBusy)}
               className={cn(
                 "rounded-xl transition-all duration-200 flex-shrink-0 w-11 h-11 flex items-center justify-center",
                 isGenerating 
                   ? "bg-red-500/10 text-red-500 hover:bg-red-500/20" 
                   : (text.trim() && !isOffline)
                     ? "bg-accent-primary text-white shadow-lg shadow-blue-500/20" 
                     : "bg-white/5 text-text-muted cursor-not-allowed"
               )}
             >
               {isGenerating ? <Square size={18} fill="currentColor" /> : <Send size={18} />}
             </button>
          </div>
        </div>
        
        {/* Hints */}
        {isOffline ? (
           <div className="text-center mt-2 text-xs text-status-offline flex items-center justify-center gap-1">
             <AlertCircle size={12} />
             {t('chat.disabled.offline')}
           </div>
        ) : (
          <div className="text-center mt-2 text-[10px] text-text-muted">
             {voiceState === 'VoiceRecording' ? t('composer.stop_recording') : isGenerating ? t('composer.generating') : t('composer.disclaimer')}
          </div>
        )}
      </div>

      <ConfirmClear 
        isOpen={showClearConfirm} 
        onClose={() => setShowClearConfirm(false)} 
        onConfirm={confirmClear}
        title={t('modal.clear.title')}
        description={t('modal.clear.description')}
        confirmText={t('modal.clear.confirm')}
      />
    </>
  );
};
