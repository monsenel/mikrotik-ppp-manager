import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AppDataMode, setApiClientMode } from '../lib/apiClient';
import { Language, translations } from '../lib/i18n';

export type NavSection = 'dashboard' | 'users' | 'sessions' | 'profiles' | 'logs' | 'settings';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface AppContextValue {
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;
  mode: AppDataMode;
  setMode: (mode: AppDataMode) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.en;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  inspectedUserId: string | null;
  setInspectedUserId: (id: string | null) => void;
  triggerCreateUserModal: boolean;
  setTriggerCreateUserModal: (open: boolean) => void;
  triggerCreateProfileModal: boolean;
  setTriggerCreateProfileModal: (open: boolean) => void;
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mode, setModeState] = useState<AppDataMode>('demo');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [globalSearch, setGlobalSearch] = useState('');
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [inspectedUserId, setInspectedUserId] = useState<string | null>(null);
  const [triggerCreateUserModal, setTriggerCreateUserModal] = useState(false);
  const [triggerCreateProfileModal, setTriggerCreateProfileModal] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const setMode = useCallback(
    (nextMode: AppDataMode) => {
      setApiClientMode(nextMode);
      setModeState(nextMode);
      queryClient.invalidateQueries();
      addToast({
        type: 'info',
        title:
          nextMode === 'live'
            ? language === 'fa'
              ? 'حالت اتصال واقعی (Live Mode) فعال شد'
              : 'Switched to Live RouterOS Mode'
            : language === 'fa'
            ? 'حالت آزمایشی (Demo Mode) فعال شد'
            : 'Switched to Demo Mode',
        description:
          nextMode === 'live'
            ? language === 'fa'
              ? 'تمامی عملیات مستقیماً به سرویس میکروتیک ارسال می‌شوند.'
              : 'All operations now execute against the configured MikroTik RouterOS endpoint.'
            : language === 'fa'
            ? 'داده‌های شبیه‌سازی‌شده فعال هستند و روتر واقعی تغییر نمی‌کند.'
            : 'Using realistic simulated RouterOS state. No physical router is modified.',
      });
    },
    [queryClient, addToast, language]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  // Global keyboard shortcuts (Cmd/Ctrl+K for Command Palette)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const t = translations[language];

  return (
    <AppContext.Provider
      value={{
        activeSection,
        setActiveSection,
        mode,
        setMode,
        language,
        setLanguage,
        t,
        theme,
        toggleTheme,
        globalSearch,
        setGlobalSearch,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        inspectedUserId,
        setInspectedUserId,
        triggerCreateUserModal,
        setTriggerCreateUserModal,
        triggerCreateProfileModal,
        setTriggerCreateProfileModal,
        toasts,
        addToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
