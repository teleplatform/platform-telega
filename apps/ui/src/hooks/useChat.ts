import { useState, useCallback, useRef } from 'react';
import { Message, Mode } from '../types';
import { ChatState } from '../types/state';
import { useApp } from '../context/AppContext';
import { parseContent } from '../utils/parser';

export function useChat(feature: 'chat' | 'translate' | 'json' = 'chat') {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<ChatState>('ChatIdle');
  const abortControllerRef = useRef<AbortController | null>(null);
  const { busyFeature, setBusyFeature, setActivityStatus } = useApp();

  const sendMessage = useCallback(async (content: string, model: string, mode: Mode) => {
    if (state === 'ChatLoading' || state === 'ChatStreaming') return;
    if (busyFeature && busyFeature !== feature) return;

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    
    // Optimistic update
    setMessages(prev => [...prev, userMsg]);
    setState('ChatLoading');
    setActivityStatus('loading');
    setBusyFeature(feature);

    // 2. Prepare Assistant Message Placeholder
    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '', // Start empty
      timestamp: Date.now(),
      meta: {
        model,
        provider: 'loading...',
      }
    };
    setMessages(prev => [...prev, assistantMsg]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await fetch('/v1/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          model,
          mode,
          feature, 
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const contentType = res.headers.get('content-type');
      
      // Handle Streaming (text/plain or text/event-stream)
      if (contentType?.includes('text/plain') || contentType?.includes('text/event-stream') || contentType?.includes('application/octet-stream')) {
        setState('ChatStreaming');
        setActivityStatus('streaming');
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (!reader) throw new Error('No reader available');

        let receivedContent = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          receivedContent += chunk;
          
          setMessages(prev => prev.map(m => 
            m.id === assistantId 
              ? { 
                  ...m, 
                  content: receivedContent, 
                  meta: {
                    ...m.meta,
                    provider: 'streaming...',
                  }
                } 
              : m
          ));
        }

        // Final update: validate tag, then mark completed
        const expectedTag = feature === 'translate' ? 't' : feature === 'json' ? 'json' : 'answer';
        const parsed = parseContent(receivedContent, expectedTag as any);
        if (!parsed.valid) {
          // INVALID_TAG
          setMessages(prev => prev.map(m => 
            m.id === assistantId 
              ? { 
                  ...m, 
                  content: receivedContent,
                  error: { code: 'INVALID_TAG', details: 'Missing required tag' },
                  meta: { 
                    ...m.meta,
                    provider: 'completed',
                    latencyMs: Date.now() - assistantMsg.timestamp,
                    contractStatus: 'fail'
                  }
                } 
              : m
          ));
          setState('ChatError');
          setActivityStatus(null);
          setBusyFeature(null);
          return;
        }
        setMessages(prev => prev.map(m => 
          m.id === assistantId 
            ? { 
                ...m, 
                content: receivedContent,
                meta: {
                  ...m.meta,
                  provider: 'completed',
                  latencyMs: Date.now() - assistantMsg.timestamp
                }
              } 
            : m
        ));
        setState('ChatSuccess');
        setActivityStatus(null);
        setBusyFeature(null);
        return;
      }

      // Handle JSON (Legacy / Non-streaming)
      const data = await res.json();
      
      if (data.status === 'ok') {
        let content = '';
        if (feature === 'translate') {
          content = `<t>${data.data.answer}</t>`;
        } else if (feature === 'json') {
          content = `<json>${data.data.answer}</json>`;
        } else {
          content = `<answer>${data.data.answer}</answer>`;
        }

        setMessages(prev => prev.map(m => 
          m.id === assistantId 
            ? { 
                ...m, 
                content, 
                meta: {
                  ...m.meta,
                  model: data.meta?.model || model,
                  provider: data.meta?.provider || 'unknown',
                  latencyMs: data.meta?.latency_ms,
                  raw: data.debug?.raw, // Maker mode debug
                  traceId: data.meta?.request_id,
                  contractStatus: 'ok' // Determinism Rule 1
                }
              } 
            : m
        ));
        setState('ChatSuccess');
        setBusyFeature(null);
      } else {
        throw new Error(data.message || 'Unknown error');
      }

    } catch (e: any) {
      if (e.name === 'AbortError') {
        // STOP_CLICK -> mark as success (stopped)
        setState('ChatSuccess');
        setActivityStatus(null);
        // Add system message "Generation stopped"
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Generation stopped',
          timestamp: Date.now()
        }]);
        setBusyFeature(null);
        return;
      }
      
      console.error(e);
      // Mark assistant message as error
      setMessages(prev => prev.map(m => 
        m.id === assistantId 
          ? { 
              ...m, 
              content: 'Error generating response.',
              error: {
                code: 'PROVIDER_FAIL',
                details: e.message
              }
            } 
          : m
      ));
      setState('ChatError');
      setActivityStatus(null);
      setBusyFeature(null);
    } finally {
      abortControllerRef.current = null;
    }
  }, [messages, state]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      // State transition handled in catch block
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setState('ChatIdle');
  }, []);

  const retryLast = useCallback(() => {
    // Retry only last user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUser) return;
    // reuse current model/mode via caller; for simplicity, require caller to pass them again
    // Alternatively we could store last used model/mode in meta; skipped for brevity.
  }, [messages]);

  return { messages, state, sendMessage, stop, clearMessages, retryLast };
}
