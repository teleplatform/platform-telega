import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from '../../utils/cn';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, className }) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        ref={overlayRef}
        onClick={(e) => e.target === overlayRef.current && onClose()}
        className="absolute inset-0" 
      />
      <div className={cn(
        "relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200",
        className
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="font-semibold text-sm">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-md transition-colors text-text-muted hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-4 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
