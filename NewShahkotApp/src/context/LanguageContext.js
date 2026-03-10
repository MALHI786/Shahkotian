import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations from '../config/translations';

const LanguageContext = createContext(null);
const LANG_KEY = '@app_language';

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY)
      .then(lang => { if (lang === 'ur' || lang === 'en') setLanguage(lang); })
      .catch(() => {});
  }, []);

  const changeLanguage = useCallback(async (lang) => {
    setLanguage(lang);
    try { await AsyncStorage.setItem(LANG_KEY, lang); } catch {}
  }, []);

  const t = useCallback(
    (key) => translations[language]?.[key] ?? translations['en'][key] ?? key,
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, t, isRTL: language === 'ur' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
