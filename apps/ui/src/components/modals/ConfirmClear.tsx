import React from 'react';
import { Modal } from '../ui/Modal';

interface ConfirmClearProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
}

export const ConfirmClear: React.FC<ConfirmClearProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Clear Chat",
  description = "Are you sure you want to clear the current chat history? This action cannot be undone.",
  confirmText = "Clear History"
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-text-secondary text-sm">
          {description}
        </p>
        <div className="flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-colors"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
