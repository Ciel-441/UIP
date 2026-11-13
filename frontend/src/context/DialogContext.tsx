'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type DialogType = 'info' | 'success' | 'warning' | 'destructive' | 'error';

export interface ConfirmOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export interface AlertOptions {
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
}

export interface Toast {
  id: string;
  message: string;
  type: DialogType;
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<boolean>;
  showToast: (message: string, type?: DialogType, duration?: number) => void;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

interface DialogState {
  isOpen: boolean;
  options: ConfirmOptions & { isConfirm: boolean };
  resolve: ((value: boolean) => void) | null;
}

const initialDialogState: DialogState = {
  isOpen: false,
  options: {
    title: '',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: 'Cancel',
    isConfirm: false,
  },
  resolve: null,
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dialogState, setDialogState] = useState<DialogState>(initialDialogState);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const confirm = useCallback((options: ConfirmOptions | string) => {
    const parsedOptions = typeof options === 'string'
      ? { title: 'Confirm Action', message: options, type: 'warning' as DialogType }
      : options;

    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        options: {
          title: parsedOptions.title || 'Confirm Action',
          message: parsedOptions.message,
          type: parsedOptions.type || 'warning',
          confirmText: parsedOptions.confirmText || 'Confirm',
          cancelText: parsedOptions.cancelText || 'Cancel',
          isConfirm: true,
        },
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string) => {
    const parsedOptions = typeof options === 'string'
      ? { title: 'Alert', message: options, type: 'info' as DialogType }
      : options;

    return new Promise<boolean>((resolve) => {
      setDialogState({
        isOpen: true,
        options: {
          title: parsedOptions.title || 'Alert',
          message: parsedOptions.message,
          type: parsedOptions.type || 'info',
          confirmText: parsedOptions.confirmText || 'OK',
          isConfirm: false,
        },
        resolve: (val) => {
          resolve(true);
        },
      });
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: DialogType = 'info', duration = 3500) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  const handleConfirm = () => {
    if (dialogState.resolve) {
      dialogState.resolve(true);
    }
    setDialogState(initialDialogState);
  };

  const handleCancel = () => {
    if (dialogState.resolve) {
      dialogState.resolve(false);
    }
    setDialogState(initialDialogState);
  };

  // Determine colors based on dialog type
  const getTypeStyles = (type: DialogType = 'info') => {
    switch (type) {
      case 'error':
      case 'destructive':
        return {
          glow: 'shadow-[0_0_50px_rgba(239,68,68,0.15)] border-red-500/20',
          icon: <AlertTriangle className="w-6 h-6 text-red-400" />,
          btnConfirm: 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 hover:border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]',
          accent: 'bg-red-500',
        };
      case 'warning':
        return {
          glow: 'shadow-[0_0_50px_rgba(245,158,11,0.15)] border-amber-500/20',
          icon: <AlertCircle className="w-6 h-6 text-amber-400" />,
          btnConfirm: 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]',
          accent: 'bg-amber-500',
        };
      case 'success':
        return {
          glow: 'shadow-[0_0_50px_rgba(16,185,129,0.15)] border-emerald-500/20',
          icon: <CheckCircle2 className="w-6 h-6 text-emerald-400" />,
          btnConfirm: 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]',
          accent: 'bg-emerald-500',
        };
      case 'info':
      default:
        return {
          glow: 'shadow-[0_0_50px_rgba(255,121,198,0.15)] border-accent/20',
          icon: <Info className="w-6 h-6 text-accent" />,
          btnConfirm: 'bg-accent/20 hover:bg-accent/30 text-accent border border-accent/30 hover:border-accent/50 hover:shadow-[0_0_15px_rgba(255,121,198,0.2)]',
          accent: 'bg-accent',
        };
    }
  };

  const styles = getTypeStyles(dialogState.options.type);

  return (
    <DialogContext.Provider value={{ confirm, alert, showToast }}>
      {children}

      {/* Custom Modal Backdrop & Dialog Box */}
      <AnimatePresence>
        {dialogState.isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Dark overlay backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={handleCancel}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Glassmorphic Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', bounce: 0.25, duration: 0.4 }}
              className={`relative w-full max-w-md bg-[#0D1120]/80 backdrop-blur-xl border ${styles.glow} rounded-2xl p-6 shadow-2xl overflow-hidden`}
            >
              {/* Top accent visual bar */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${styles.accent}`} />

              <div className="flex items-start gap-4">
                <div className="p-2 rounded-xl bg-white/5 border border-white/5 shrink-0">
                  {styles.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-white tracking-wide">
                    {dialogState.options.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed mt-2 whitespace-pre-wrap">
                    {dialogState.options.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 mt-6">
                {dialogState.options.isConfirm && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition-all duration-200"
                  >
                    {dialogState.options.cancelText}
                  </button>
                )}
                <button
                  onClick={handleConfirm}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl cursor-pointer transition-all duration-200 ${styles.btnConfirm}`}
                >
                  {dialogState.options.confirmText}
                </button>
              </div>

              {/* Top Right Close Button */}
              <button
                onClick={handleCancel}
                className="absolute top-4 right-4 text-slate-500 hover:text-white p-1 hover:bg-white/5 rounded-lg cursor-pointer transition-colors duration-200"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notifications Container */}
      <div className="fixed top-4 right-4 z-[99999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => {
            const toastStyles = getTypeStyles(toast.type);
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
                layout
                className="relative pointer-events-auto w-full bg-[#0D1120]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl flex items-start gap-3 overflow-hidden cursor-pointer"
                onClick={() => removeToast(toast.id)}
              >
                {/* Left accent line */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${toastStyles.accent}`} />
                
                <div className="p-1 rounded-lg bg-white/5 shrink-0">
                  {/* Smaller icon for toast */}
                  {React.cloneElement(toastStyles.icon, { className: 'w-4 h-4 text-inherit' })}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm text-slate-200 font-medium leading-normal">
                    {toast.message}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeToast(toast.id);
                  }}
                  className="text-slate-500 hover:text-white p-0.5 hover:bg-white/5 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </DialogContext.Provider>
  );
};
