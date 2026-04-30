import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Copy, Check, MessageSquarePlus, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TranslateState } from '../types/state';
import { useChat } from '../hooks/useChat';
import { cn } from '../utils/cn';
import { parseContent } from '../utils/parser';

const LANGUAGES = [
  'English', 'Russian', 'Spanish', 'French', 'German', 
  'Chinese', 'Japanese', 'Korean', 'Italian', 'Portuguese'
];

export const TranslateScreen: React.FC = () => {
  const { mode, selectedModel, status, t, busyFeature } = useApp();
  const isGlobalBusy = busyFeature && busyFeature !== 'translate';
  const { messages, state: chatState, sendMessage, stop } = useChat('translate');
  const navigate = useNavigate();

  const [translateState, setTranslateState] = useState<TranslateState>('TranslateIdle');
  const [sourceLang, setSourceLang] = useState('Auto');
  const [targetLang, setTargetLang] = useState('English');
  const [inputText, setInputText] = useState('');
  const [lastResult, setLastResult] = useState<{content: string, valid: boolean} | null>(null);
  const [copied, setCopied] = useState(false);

  // Map ChatState to TranslateState
  useEffect(() => {
    switch (chatState) {
      case 'ChatLoading':
      case 'ChatStreaming':
        setTranslateState('TranslateLoading');
        break;
      case 'ChatSuccess':
        setTranslateState('TranslateSuccess');
        break;
      case 'ChatError':
        setTranslateState('TranslateError');
        break;
      case 'ChatIdle':
      case 'ChatStopped':
      default:
        setTranslateState('TranslateIdle');
        break;
    }
  }, [chatState]);

  // Derive result from latest message
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        const parsed = parseContent(lastMsg.content, 't');
        setLastResult({ content: parsed.content, valid: parsed.valid });
      }
    }
  }, [messages]);

  const handleTranslate = () => {
    if (!inputText.trim() || translateState === 'TranslateLoading' || isGlobalBusy) return;
    
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n${inputText}`;
    sendMessage(prompt, selectedModel, mode);
  };

  const handleSwap = () => {
    if (sourceLang === 'Auto') {
      setSourceLang(targetLang);
      setTargetLang('English'); // Default fallback or keep Auto? Spec says Target Auto forbidden.
    } else {
      setSourceLang(targetLang);
      setTargetLang(sourceLang);
    }
    // Swap text if we have a result?
    if (lastResult?.valid && lastResult.content) {
      setInputText(lastResult.content);
      setLastResult(null); // Clear result as we swapped
    }
  };

  const copyToClipboard = () => {
    if (lastResult?.content) {
      navigator.clipboard.writeText(lastResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReplaceInput = () => {
    if (lastResult?.content) {
      setInputText(lastResult.content);
    }
  };

  const handleSendToChat = () => {
    if (lastResult?.content) {
      navigate('/chat', { state: { initialInput: lastResult.content } });
    }
  };

  const maxChars = 2000; // Arbitrary limit, spec says "N / Max"
  const charCount = inputText.length;
  const isOverLimit = charCount > maxChars;

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-20 md:pb-0">
      {/* Header handled by shell? No, spec says "4.2 Layout - Header". Shell has header. 
          Maybe this is a sub-header or just the top part of the screen. 
          We'll assume the main Shell Header is present.
      */}
      
      <div className="flex-1 max-w-5xl mx-auto w-full p-4 flex flex-col gap-4">
        
        {/* Language Selectors */}
        <div className="bg-surface rounded-xl p-2 flex flex-col md:flex-row items-center justify-between gap-2 border border-white/10">
          <div className="flex-1 w-full md:w-auto">
            <select 
              value={sourceLang} 
              onChange={(e) => setSourceLang(e.target.value)}
              className="w-full bg-transparent text-text-primary p-2 outline-none cursor-pointer"
            >
              <option value="Auto">{t('tr.detect')}</option>
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          
          <button 
            onClick={handleSwap}
            className="p-2 rounded-full hover:bg-white/10 text-accent-primary transition-colors"
          >
            <ArrowRightLeft size={18} />
          </button>
          
          <div className="flex-1 w-full md:w-auto text-right">
             <select 
              value={targetLang} 
              onChange={(e) => setTargetLang(e.target.value)}
              className="w-full bg-transparent text-text-primary p-2 outline-none cursor-pointer text-right" // text-right might look weird for dropdown
              style={{ direction: 'rtl' }} // Hack to align text? No, better just keep standard.
            >
              {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex flex-col md:flex-row gap-4 h-[60vh] md:h-[500px]">
          
          {/* Input Area */}
          <div className="flex-1 bg-surface rounded-2xl border border-white/10 flex flex-col focus-within:border-accent-primary/50 transition-colors">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('tr.placeholder')}
              className="flex-1 bg-transparent border-none resize-none p-4 focus:ring-0 text-lg scrollbar-hide"
              spellCheck={false}
            />
            <div className="p-3 flex justify-between items-center text-xs text-text-muted border-t border-white/5">
              <span className={isOverLimit ? "text-status-offline" : ""}>
                {charCount} / {maxChars}
              </span>
              {inputText && (
                <button 
                  onClick={() => setInputText('')}
                  className="hover:text-white"
                >
                  {t('btn.clear')}
                </button>
              )}
            </div>
          </div>

          {/* Result Area */}
          <div className="flex-1 bg-surface/50 rounded-2xl border border-white/10 flex flex-col relative overflow-hidden">
             {translateState === 'TranslateLoading' ? (
               <div className="absolute inset-0 flex items-center justify-center bg-surface/50 z-10">
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                   <span className="text-xs text-text-muted">{t('status.streaming')}</span>
                 </div>
               </div>
             ) : null}

             {translateState === 'TranslateError' ? (
                <div className="flex-1 flex items-center justify-center text-status-offline gap-2">
                  <AlertTriangle size={24} />
                  <span>{t('status.error')}</span>
                </div>
             ) : lastResult ? (
               <>
                 <div className="flex-1 p-4 text-lg overflow-y-auto whitespace-pre-wrap">
                   {lastResult.valid ? (
                     lastResult.content
                   ) : (
                     <div className="text-status-offline flex items-center gap-2">
                       <AlertTriangle size={18} />
                       {mode === 'maker' ? (
                         <span className="font-mono text-sm">
                           [{t('dbg.raw')}]<br/>{lastResult.content}
                         </span>
                       ) : (
                         t('sys.contract_fail')
                       )}
                     </div>
                   )}
                 </div>
                 
                 {/* Result Actions */}
                 <div className="p-2 flex items-center justify-end gap-2 border-t border-white/5 bg-surface/30">
                   <button 
                     onClick={copyToClipboard}
                     className="p-2 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
                     title={t('btn.copy')}
                   >
                     {copied ? <Check size={18} /> : <Copy size={18} />}
                   </button>
                   <button 
                     onClick={handleReplaceInput}
                     className="p-2 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
                     title={t('tr.replace')}
                   >
                     <RefreshCw size={18} />
                   </button>
                   <button 
                     onClick={handleSendToChat}
                     className="p-2 rounded-lg hover:bg-white/10 text-text-secondary hover:text-white transition-colors"
                     title={t('tr.send_chat')}
                   >
                     <MessageSquarePlus size={18} />
                   </button>
                 </div>
               </>
             ) : (
               <div className="flex-1 flex items-center justify-center text-text-muted text-sm opacity-50 select-none">
                 {t('tr.output_placeholder')}
               </div>
             )}
          </div>
        </div>

        {/* Action Bar (Mobile/Desktop) */}
        <div className="flex justify-center mt-4">
           <button
             onClick={translateState === 'TranslateLoading' ? stop : handleTranslate}
             disabled={((!inputText.trim() || !!isGlobalBusy) && translateState !== 'TranslateLoading') || isOverLimit || status === 'offline'}
             className={cn(
               "px-8 py-3 rounded-full font-medium shadow-lg transition-all transform active:scale-95",
               (((!inputText.trim() || !!isGlobalBusy) && translateState !== 'TranslateLoading') || isOverLimit || status === 'offline')
                 ? "bg-white/5 text-text-muted cursor-not-allowed"
                 : translateState === 'TranslateLoading'
                   ? "bg-red-500 hover:bg-red-600 text-white"
                   : "bg-accent-primary text-white hover:bg-blue-600 hover:shadow-blue-500/20"
             )}
           >
             {translateState === 'TranslateLoading' ? (
               <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-white rounded-sm animate-pulse" />
                 {t('btn.stop')}
               </div>
             ) : t('btn.translate')} 
           </button>
        </div>
        
        {/* Remove floating Stop button as it's now integrated */}

      </div>
    </div>
  );
};
