import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  // 从 localStorage 获取保存的语言设置，默认中文
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('survey-language');
    return saved || 'zh';
  });

  // 当语言改变时保存到 localStorage
  useEffect(() => {
    localStorage.setItem('survey-language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const value = {
    language,
    setLanguage,
    toggleLanguage,
    isZh: language === 'zh',
    isEn: language === 'en'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

