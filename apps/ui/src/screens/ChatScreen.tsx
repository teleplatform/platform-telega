import React, { useRef, useEffect, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useChat } from '../hooks/useChat';
import { MessageCard } from '../components/chat/MessageCard';
import { Composer } from '../components/Composer';
import { ConfirmClear } from '../components/modals/ConfirmClear';
import { parseContent } from '../utils/parser';

interface ChatScreenProps {
  clearTrigger?: boolean;
  onClearClose?: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ clearTrigger, onClearClose }) => {
  const { mode, selectedModel } = useApp();
  const { messages, state, sendMessage, stop, clearMessages } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const { t, busyFeature, setBusyFeature } = useApp();
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Handle Scroll
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    if (distanceFromBottom > 120) {
      setAutoScroll(false);
      setShowScrollButton(true);
    } else {
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  };

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]); // dependencies on messages update

  // Keyboard/viewport adaptation: scroll to bottom when viewport changes (e.g., keyboard open)
  useEffect(() => {
    const vv = (window as any).visualViewport;
    if (!vv) return;
    const handler = () => {
      if (autoScroll && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    };
    vv.addEventListener('resize', handler);
    vv.addEventListener('scroll', handler);
    return () => {
      vv.removeEventListener('resize', handler);
      vv.removeEventListener('scroll', handler);
    };
  }, [autoScroll]);

  // TTS fallback: speak assistant message on success
  useEffect(() => {
    if (state !== 'ChatSuccess') return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (busyFeature && busyFeature !== 'voice') return;

    const parsed = parseContent(last.content, 'answer');
    const text = parsed.valid ? parsed.content : last.content;
    if (!text.trim()) return;

    try {
      setBusyFeature('voice');
      setIsSpeaking(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => {
        setIsSpeaking(false);
        setBusyFeature(null);
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setBusyFeature(null);
      };
      window.speechSynthesis.cancel(); // cancel any previous
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      setBusyFeature(null);
    }
  }, [state, messages, busyFeature, setBusyFeature]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
    setShowScrollButton(false);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 md:px-8 py-4 space-y-4 pb-24"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-50">
            <div className="text-4xl mb-4">💬</div>
            <p>Start a conversation with Tele•GPT</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <MessageCard key={msg.id} message={msg} mode={mode} />
        ))}
        
        <div ref={bottomRef} />
      </div>

      {/* Jump to latest button */}
      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-surface border border-border rounded-full p-2 shadow-lg z-10 animate-bounce"
        >
          <ArrowDown size={20} />
        </button>
      )}

      {/* Retry on error */}
      {state === 'ChatError' && (
        <button
          onClick={() => {
            const lastUser = [...messages].reverse().find(m => m.role === 'user');
            if (lastUser) {
              sendMessage(lastUser.content, selectedModel, mode);
            } else {
              scrollToBottom();
            }
          }}
          className="absolute bottom-36 left-1/2 -translate-x-1/2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full px-3 py-1 text-xs shadow z-10"
        >
          {t('ui.btn.retry')}
        </button>
      )}
      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-surface/80 border border-border rounded-full px-3 py-1 text-xs text-text-secondary shadow z-10">
          {t('voice.speak')}
        </div>
      )}

      {/* Composer */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <Composer 
          onSend={(text) => sendMessage(text, selectedModel, mode)} 
          chatState={state} 
          onStop={stop}
        />
      </div>

      {/* Modals */}
      <ConfirmClear 
        isOpen={!!clearTrigger} 
        onClose={onClearClose || (() => {})} 
        onConfirm={clearMessages}
      />
    </div>
  );
};
