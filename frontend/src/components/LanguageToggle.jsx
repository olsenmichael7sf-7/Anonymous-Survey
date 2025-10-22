import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import './LanguageToggle.css';

const LanguageToggle = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button 
      onClick={toggleLanguage} 
      className="language-toggle-btn"
      title={language === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <span className="lang-icon">{language === 'zh' ? '🌐' : '🌏'}</span>
      <span className="lang-text">{language === 'zh' ? 'EN' : '中'}</span>
    </button>
  );
};

export default LanguageToggle;

