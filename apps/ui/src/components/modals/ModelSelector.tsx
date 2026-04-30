import React from 'react';
import { Check, Zap } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Model } from '../../types';
import { cn } from '../../utils/cn';

interface ModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  models: Model[];
  selectedModelId: string;
  onSelect: (id: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  isOpen,
  onClose,
  models,
  selectedModelId,
  onSelect,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Model">
      <div className="space-y-1">
        {models.map((model) => {
          const isSelected = model.id === selectedModelId;
          return (
            <button
              key={model.id}
              onClick={() => {
                onSelect(model.id);
                onClose();
              }}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                isSelected 
                  ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/20" 
                  : "hover:bg-white/5 text-text-primary border border-transparent"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  isSelected ? "bg-accent-primary text-white" : "bg-white/10 text-text-muted"
                )}>
                  <Zap size={14} />
                </div>
                <div className="text-left">
                   <div className="font-medium">{model.name || model.id}</div>
                   <div className="text-[10px] text-text-muted opacity-70 uppercase tracking-wider">{model.provider}</div>
                </div>
              </div>
              {isSelected && <Check size={16} />}
            </button>
          );
        })}
        {models.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            No models available.
          </div>
        )}
      </div>
    </Modal>
  );
};
