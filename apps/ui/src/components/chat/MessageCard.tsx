import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, ChevronRight, ChevronDown, User, Bot, AlertTriangle } from 'lucide-react';
import { Message, Mode } from '../../types';
import { cn } from '../../utils/cn';
import { parseContent } from '../../utils/parser';
import { useApp } from '../../context/AppContext';

interface MessageCardProps {
  message: Message;
  mode: Mode;
  expectedTag?: 'answer' | 't' | 'json';
}

export const MessageCard: React.FC<MessageCardProps> = ({ message, mode, expectedTag = 'answer' }) => {
  const { t, language } = useApp();
  const [debugOpen, setDebugOpen] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  // Parse content if assistant
  const parsed = message.role === 'assistant' 
    ? parseContent(message.content, expectedTag) 
    : { valid: true, content: message.content, type: 'raw' };

  const isLoading = message.role === 'assistant' && !message.content && message.meta?.provider === 'loading...';

  // Handle Invalid Format in Public Mode
  if (message.role === 'assistant' && !parsed.valid && mode === 'public' && !isLoading) {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-status-offline/10 border border-status-offline/20 rounded-lg p-3 flex items-center gap-3 max-w-md">
           <AlertTriangle className="text-status-offline w-5 h-5" />
           <div className="text-sm text-status-offline">
             <strong>{t('sys.invalid_format')}</strong><br/>
             {t('chat.error.protocol')}
           </div>
        </div>
      </div>
    );
  }

  if (isSystem) {
     return (
       <div className="flex justify-center my-4">
         <div className="bg-surface/50 px-3 py-1 rounded-full text-xs text-text-muted">
           {message.content}
         </div>
       </div>
     );
  }

  return (
    <div className={cn(
      "flex flex-col mb-6 max-w-[85%] md:max-w-[75%]",
      isUser ? "self-end items-end" : "self-start items-start"
    )}>
      {/* Top Line */}
      <div className="flex items-center gap-2 mb-1 px-1">
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center",
          isUser ? "bg-accent-primary/20 text-accent-primary" : "bg-status-ready/20 text-status-ready"
        )}>
          {isUser ? <User size={14} /> : <Bot size={14} />}
        </div>
        <span className="text-xs font-bold text-text-secondary">
          {isUser ? 'You' : 'Tele•GPT'}
        </span>
        {mode === 'maker' && !isUser && message.meta?.model && (
           <span className="text-[10px] bg-white/5 px-1 rounded text-text-muted">
             {message.meta.provider ? `${message.meta.provider}:` : ''}{message.meta.model}
           </span>
        )}
      </div>

      {/* Body */}
      <div
        className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
        isUser 
          ? "bg-accent-primary text-white rounded-tr-none" 
          : "bg-surface text-text-primary rounded-tl-none border border-border"
      )}
        onMouseDown={() => {
          if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
          pressTimerRef.current = window.setTimeout(() => {
            navigator.clipboard.writeText(parsed.content || message.content);
          }, 600);
        }}
        onMouseUp={() => {
          if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }}
        onMouseLeave={() => {
          if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }}
        onTouchStart={() => {
          if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
          pressTimerRef.current = window.setTimeout(() => {
            navigator.clipboard.writeText(parsed.content || message.content);
          }, 600);
        }}
        onTouchEnd={() => {
          if (pressTimerRef.current) window.clearTimeout(pressTimerRef.current);
          pressTimerRef.current = null;
        }}
      >
        {isLoading ? (
           <div className="flex gap-1 h-5 items-center">
             <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.3s]" />
             <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce [animation-delay:-0.15s]" />
             <div className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" />
           </div>
        ) : (
          <>
            {/* Render parsed content or raw if valid/user */}
            <div className="markdown-body">
              <ReactMarkdown
                components={{
                  code({node, className, children, ...props}) {
                    return (
                      <code className={cn(className, "bg-black/30 rounded px-1 py-0.5 font-mono text-xs")} {...props}>
                        {children}
                      </code>
                    );
                  },
                  pre({node, children, ...props}) {
                     return (
                       <pre className="bg-black/30 rounded p-2 overflow-x-auto my-2 border border-white/5" {...props}>
                         {children}
                       </pre>
                     );
                  }
                }}
              >
                 {parsed.content || (mode === 'maker' && !parsed.valid ? message.content : '')}
              </ReactMarkdown>
            </div>
            
            {/* Maker: Parse Error info in body if invalid */}
            {mode === 'maker' && !parsed.valid && message.role === 'assistant' && (
               <div className="mt-2 pt-2 border-t border-white/10 text-status-offline text-xs font-mono">
                 {t('chat.error.parse').replace('{tag}', expectedTag)}
               </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Line */}
      <div className="flex items-center gap-3 mt-1 px-1 opacity-60 hover:opacity-100 transition-opacity">
        <button 
          onClick={() => navigator.clipboard.writeText(parsed.content)}
          className="text-xs flex items-center gap-1 hover:text-white"
        >
          <Copy size={10} /> {t('btn.copy')}
        </button>
        <span className="text-[10px] text-text-muted">
          {new Date(message.timestamp).toLocaleTimeString([language], {hour: '2-digit', minute:'2-digit'})}
        </span>
      </div>

      {/* Debug Block (Maker only) */}
      {mode === 'maker' && !isUser && (
        <div className="mt-1 w-full">
           <button 
             onClick={() => setDebugOpen(!debugOpen)}
             className="flex items-center gap-1 text-[10px] text-text-muted hover:text-accent-primary transition-colors"
           >
             {debugOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
             Debug
           </button>
           
           {debugOpen && (
             <div className="mt-2 p-2 bg-black/40 rounded border border-white/5 text-[10px] font-mono text-text-muted overflow-x-auto">
               <div className="grid grid-cols-[80px_1fr] gap-1">
                 {/* 3.3.3 Debug Fields Strict Order */}
                 
                 {/* Provider */}
                 {message.meta?.provider && (
                   <>
                     <div className="text-text-secondary">{t('dbg.provider')}:</div>
                     <div>{message.meta.provider}</div>
                   </>
                 )}

                 {/* Model */}
                 {message.meta?.model && (
                   <>
                     <div className="text-text-secondary">{t('dbg.model')}:</div>
                     <div>{message.meta.model}</div>
                   </>
                 )}

                 {/* Latency */}
                 {message.meta?.latencyMs !== undefined && (
                   <>
                     <div className="text-text-secondary">{t('dbg.latency')}:</div>
                     <div>{message.meta.latencyMs} ms</div>
                   </>
                 )}

                 {/* Tokens In */}
                 {message.meta?.tokensIn !== undefined && (
                   <>
                     <div className="text-text-secondary">{t('dbg.tokens_in')}:</div>
                     <div>{message.meta.tokensIn}</div>
                   </>
                 )}

                 {/* Tokens Out */}
                 {message.meta?.tokensOut !== undefined && (
                   <>
                     <div className="text-text-secondary">{t('dbg.tokens_out')}:</div>
                     <div>{message.meta.tokensOut}</div>
                   </>
                 )}

                 {/* Warnings */}
                 {message.meta?.warnings && message.meta.warnings.length > 0 && (
                   <>
                     <div className="text-status-degraded">{t('dbg.warnings')}:</div>
                     <div className="text-status-degraded">
                       {message.meta.warnings.map((w, i) => <div key={i}>{w}</div>)}
                     </div>
                   </>
                 )}

                 {/* Trace ID */}
                 {message.meta?.traceId && (
                   <>
                     <div className="text-text-secondary">{t('dbg.trace_id')}:</div>
                     <div>{message.meta.traceId}</div>
                   </>
                 )}

                 {/* Contract Status */}
                 {message.meta?.contractStatus && (
                   <>
                     <div className="text-text-secondary">{t('dbg.contract')}:</div>
                     <div className={message.meta.contractStatus === 'ok' ? 'text-status-ready' : 'text-status-offline'}>
                       {message.meta.contractStatus.toUpperCase()}
                     </div>
                   </>
                 )}

                 {/* Raw */}
                 <div className="text-text-secondary col-span-2 mt-1 border-t border-white/5 pt-1">{t('dbg.raw')}:</div>
                 <div className="col-span-2 relative group">
                    <div className="whitespace-pre-wrap text-white/70 max-h-32 overflow-y-auto bg-black/20 p-1 rounded">
                      {message.meta?.raw || message.content}
                    </div>
                    <button 
                      onClick={() => navigator.clipboard.writeText(message.meta?.raw || message.content)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-surface p-1 rounded text-text-muted hover:text-white transition-opacity"
                      title={t('btn.copy')}
                    >
                      <Copy size={10} />
                    </button>
                 </div>
               </div>
             </div>
           )}
        </div>
      )}
    </div>
  );
};
