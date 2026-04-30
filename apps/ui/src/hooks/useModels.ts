import { useState, useEffect } from 'react';
import { Model } from '../types';

export function useModels(status: string) {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');

  useEffect(() => {
    if (status !== 'ready') return;

    const fetchModels = async () => {
      try {
        const res = await fetch('/v1/models');
        if (!res.ok) return;
        const data = await res.json();
        // The backend returns { status: 'ok', data: { models: [...], assigned: {...} } }
        // based on models.route.ts: ok(..., { models, assigned }, ...)
        // contract.ts probably wraps it in { status: 'ok', data: ... }
        
        // Let's assume the shape based on models.route.ts
        if (data.status === 'ok' && data.data?.models) {
            setModels(data.data.models);
            
            // Restore selection or pick first
            const stored = localStorage.getItem('telegpt.selectedModel');
            const exists = stored && data.data.models.some((m: Model) => m.id === stored);
            const next = exists ? stored : data.data.models[0]?.id;
            if (next) setSelectedModel(next);
        }
      } catch (e) {
        console.error('Failed to load models', e);
      }
    };

    fetchModels();
  }, [status]);

  const selectModel = (id: string) => {
    setSelectedModel(id);
    localStorage.setItem('telegpt.selectedModel', id);
  };

  return { models, selectedModel, selectModel };
}
