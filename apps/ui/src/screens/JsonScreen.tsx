import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileJson, Copy, Download, MessageSquarePlus, 
  Check, AlertTriangle, Braces, Code, 
  Wrench, ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { JsonState } from '../types/state';
import { useChat } from '../hooks/useChat';
import { cn } from '../utils/cn';
import { parseContent } from '../utils/parser';

// Simple JSON Tree View Component (Recursive)
const JsonTree: React.FC<{ data: any; level?: number }> = ({ data, level = 0 }) => {
  const [expanded, setExpanded] = useState(true);

  if (data === null) return <span className="text-red-400">null</span>;
  if (data === undefined) return <span className="text-gray-500">undefined</span>;
  if (typeof data === 'string') return <span className="text-green-400">"{data}"</span>;
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>;
  if (typeof data === 'boolean') return <span className="text-yellow-400">{data.toString()}</span>;

  const isArray = Array.isArray(data);
  const keys = Object.keys(data);
  const isEmpty = keys.length === 0;

  if (isEmpty) return <span className="text-text-muted">{isArray ? '[]' : '{}'}</span>;

  return (
    <div className="font-mono text-sm">
      <div 
        className="flex items-center cursor-pointer hover:bg-white/5 rounded px-1 -ml-1 select-none"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <span className="text-text-muted mr-1 w-4 text-center">{expanded ? '▼' : '▶'}</span>
        <span className="text-text-secondary">{isArray ? '[' : '{'}</span>
        {!expanded && <span className="text-text-muted ml-2">... {isArray ? ']' : '}'}</span>}
      </div>
      
      {expanded && (
        <div className="pl-6 border-l border-white/5 ml-2">
          {keys.map((key, index) => (
            <div key={key} className="flex items-start">
              {!isArray && <span className="text-purple-400 mr-2">"{key}":</span>}
              <JsonTree data={data[key]} level={level + 1} />
              {index < keys.length - 1 && <span className="text-text-muted">,</span>}
            </div>
          ))}
        </div>
      )}
      
      {expanded && <div className="ml-5 text-text-secondary">{isArray ? ']' : '}'}</div>}
    </div>
  );
};

export const JsonScreen: React.FC = () => {
  const { mode, selectedModel, status, t, busyFeature } = useApp();
  const { messages, state: chatState, sendMessage, stop } = useChat('json');
  const navigate = useNavigate();

  const [jsonState, setJsonState] = useState<JsonState>('JSONIdle');
  
  const isGlobalBusy = busyFeature && busyFeature !== 'json';
  const [isRepairing, setIsRepairing] = useState(false);
  
  const [instruction, setInstruction] = useState('');
  const [schema, setSchema] = useState('');
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);

  // Derived state
  const lastMsg = messages[messages.length - 1];
  
  const lastResult = useMemo(() => {
    if (lastMsg?.role === 'assistant') {
      const parsed = parseContent(lastMsg.content, 'json');
      return { content: parsed.content, valid: parsed.valid };
    }
    return null;
  }, [lastMsg]);

  const { parsedJson, jsonError } = useMemo(() => {
    if (!lastResult?.content) return { parsedJson: null, jsonError: null };
    try {
      if (lastResult.content.trim()) {
        return { parsedJson: JSON.parse(lastResult.content), jsonError: null };
      }
      return { parsedJson: null, jsonError: null };
    } catch (e) {
      return { parsedJson: null, jsonError: (e as Error).message };
    }
  }, [lastResult]);

  // Map ChatState to JsonState
  useEffect(() => {
    switch (chatState) {
      case 'ChatLoading':
      case 'ChatStreaming':
        setJsonState(isRepairing ? 'JSONRepairing' : 'JSONLoading');
        break;
      case 'ChatSuccess':
        setIsRepairing(false);
        if (jsonError) {
          setJsonState('JSONInvalid');
        } else {
          setJsonState('JSONValid');
        }
        break;
      case 'ChatError':
        setIsRepairing(false);
        setJsonState('JSONInvalid'); 
        break;
      case 'ChatIdle':
      case 'ChatStopped':
      default:
        setJsonState('JSONIdle');
        setIsRepairing(false);
        break;
    }
  }, [chatState, jsonError, isRepairing]);

  const validateSchema = () => {
    if (!schema.trim()) {
      setSchemaError(null);
      return true;
    }
    try {
      JSON.parse(schema);
      setSchemaError(null);
      return true;
    } catch (e) {
      setSchemaError(t('json.invalid_schema'));
      return false;
    }
  };

  const isGenerating = jsonState === 'JSONLoading' || jsonState === 'JSONRepairing';

  const handleGenerate = () => {
    if (!instruction.trim() || isGenerating || !validateSchema() || isGlobalBusy) return;

    let prompt = instruction;
    if (schema.trim()) {
      prompt += `\n\nFollow this JSON Schema strictly:\n${schema}`;
    }
    sendMessage(prompt, selectedModel, mode);
  };

  const handleRepair = () => {
    if (!lastResult?.content || isGlobalBusy) return;
    setIsRepairing(true);
    const prompt = `The previous JSON was invalid. Fix strict syntax errors:\n${jsonError}\n\nLast Output:\n${lastResult.content}`;
    sendMessage(prompt, selectedModel, mode); 
  };

  const copyToClipboard = () => {
    if (lastResult?.content) {
      navigator.clipboard.writeText(lastResult.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadJson = () => {
    if (!lastResult?.content) return;
    const blob = new Blob([lastResult.content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sendToChat = () => {
    if (lastResult?.content) {
      navigate('/chat', { state: { initialInput: `Here is the JSON data:\n\`\`\`json\n${lastResult.content}\n\`\`\`` } });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-2 md:p-4 gap-4 h-full overflow-y-auto md:overflow-hidden">
        
        {/* LEFT: Input Panel */}
        <div className="flex-1 flex flex-col gap-4 min-h-[300px] md:h-full overflow-y-auto pb-4 md:pb-0">
          
          {/* Instruction */}
          <div className="bg-surface rounded-2xl border border-white/10 p-4 flex flex-col gap-2 flex-shrink-0">
            <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <MessageSquarePlus size={16} />
              {t('json.instruction_label')}
            </label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={t('json.instruction')}
              className="bg-background/50 border border-white/5 rounded-xl p-3 text-sm min-h-[100px] focus:border-accent-primary/50 outline-none resize-none"
            />
          </div>

          {/* Schema */}
          <div className="bg-surface rounded-2xl border border-white/10 p-4 flex flex-col gap-2 flex-1 min-h-[200px]">
             <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-text-secondary flex items-center gap-2">
                  <Braces size={16} />
                  {t('json.schema')}
                </label>
                <button 
                  onClick={validateSchema}
                  className="text-xs text-accent-primary hover:text-white transition-colors"
                >
                  {t('json.validate')}
                </button>
             </div>
             <textarea
               value={schema}
               onChange={(e) => {
                 setSchema(e.target.value);
                 if (schemaError) setSchemaError(null);
               }}
               onBlur={validateSchema}
               placeholder='{ "type": "object", "properties": { ... } }'
               className={cn(
                 "bg-background/50 border rounded-xl p-3 text-sm font-mono flex-1 outline-none resize-none",
                 schemaError ? "border-red-500/50 focus:border-red-500" : "border-white/5 focus:border-accent-primary/50"
               )}
               spellCheck={false}
             />
             {schemaError && (
               <div className="text-xs text-red-400 flex items-center gap-1">
                 <AlertTriangle size={12} />
                 {schemaError}
               </div>
             )}
          </div>

          {/* Generate Button (Desktop - moved here for layout flow, or stick to bottom on mobile) */}
          <button
            onClick={isGenerating ? stop : handleGenerate}
            disabled={(!instruction.trim() && !isGenerating) || !!schemaError || status === 'offline'}
            className={cn(
              "p-4 rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2",
              isGenerating 
                ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                : "bg-accent-primary text-white hover:bg-blue-600 shadow-blue-500/20"
            )}
          >
            {isGenerating ? (
              <>
                 <div className="w-2 h-2 bg-current rounded-sm animate-pulse" />
                 {t('btn.stop')}
              </>
            ) : (
              <>
                {t('btn.generate')} <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>

        {/* RIGHT: Output Panel */}
        <div className="flex-1 bg-surface rounded-2xl border border-white/10 flex flex-col h-full overflow-hidden relative">
           {/* Header */}
           <div className="p-3 border-b border-white/5 flex items-center justify-between bg-surface/50">
             <div className="flex gap-1 bg-background/50 p-1 rounded-lg">
               <button
                 onClick={() => setViewMode('tree')}
                 className={cn(
                   "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                   viewMode === 'tree' ? "bg-accent-primary text-white" : "hover:bg-white/5 text-text-secondary"
                 )}
               >
                 <Braces size={14} /> {t('json.view_tree')}
               </button>
               <button
                 onClick={() => setViewMode('raw')}
                 className={cn(
                   "px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1",
                   viewMode === 'raw' ? "bg-accent-primary text-white" : "hover:bg-white/5 text-text-secondary"
                 )}
               >
                 <Code size={14} /> {t('json.view_raw')}
               </button>
             </div>

             <div className="flex gap-1">
               <button onClick={copyToClipboard} className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors" title={t('btn.copy')}>
                 {copied ? <Check size={16} /> : <Copy size={16} />}
               </button>
               <button onClick={downloadJson} className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors" title={t('json.download')}>
                 <Download size={16} />
               </button>
               <button onClick={sendToChat} className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors" title={t('tr.send_chat')}>
                 <MessageSquarePlus size={16} />
               </button>
             </div>
           </div>

           {/* Content */}
           <div className="flex-1 overflow-auto p-4 relative">
             {isGenerating && !lastResult?.content && (
               <div className="absolute inset-0 flex items-center justify-center bg-surface/50 z-10 backdrop-blur-sm">
                 <div className="flex flex-col items-center gap-2">
                   <div className="w-8 h-8 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
                   <span className="text-xs text-text-muted">{t('json.generating')}</span>
                 </div>
               </div>
             )}

             {!lastResult?.content ? (
               <div className="h-full flex flex-col items-center justify-center opacity-30 select-none">
                 <FileJson size={48} className="mb-4" />
                 <p>{t('json.output_placeholder')}</p>
               </div>
             ) : (
               <>
                 {viewMode === 'tree' ? (
                   parsedJson ? (
                     <JsonTree data={parsedJson} />
                   ) : (
                     <div className="text-red-400 font-mono text-sm whitespace-pre-wrap">
                       {/* Parse failed, show raw with error hint */}
                       {lastResult.content}
                     </div>
                   )
                 ) : (
                   <pre className="font-mono text-xs md:text-sm text-text-secondary whitespace-pre-wrap">
                     {lastResult.content}
                   </pre>
                 )}
               </>
             )}
           </div>

           {/* Repair Bar (if invalid JSON) */}
           {(jsonState === 'JSONInvalid' || jsonState === 'JSONRepairing') && lastResult?.content && (
             <div className="absolute bottom-4 left-4 right-4 bg-red-500/10 border border-red-500/20 backdrop-blur-md p-3 rounded-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
               <div className="flex items-center gap-2 text-red-400 text-xs md:text-sm truncate">
                 <AlertTriangle size={16} className="flex-shrink-0" />
                 <span className="truncate">{t('json.invalid')}: {jsonError}</span>
               </div>
               <button
                 onClick={handleRepair}
                 disabled={isGenerating || (!!isGlobalBusy)}
                 className={cn(
                    "flex-shrink-0 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors",
                    (isGenerating || isGlobalBusy) && "opacity-50 cursor-not-allowed"
                 )}
               >
                 {isGenerating ? (
                   <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <Wrench size={12} />
                 )}
                 {t('json.repair')}
               </button>
             </div>
           )}
        </div>

      </div>
    </div>
  );
};
