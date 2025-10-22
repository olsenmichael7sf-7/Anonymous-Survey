import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n/translations';
import './ConnectButton.css';

const ConnectButton = ({ onConnect, account }) => {
  const { language } = useLanguage();
  
  const handleConnect = async () => {
    if (!window.ethereum) {
      alert(t('installMetaMask', language));
      return;
    }

    try {
      // 请求连接钱包
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (onConnect) {
        await onConnect();
      }
    } catch (error) {
      console.error('连接钱包失败:', error);
      alert(t('connectWalletFirst', language) + ': ' + error.message);
    }
  };

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="connect-button-wrapper">
      {account ? (
        <div className="wallet-connected">
          <div className="wallet-icon">🔗</div>
          <div className="wallet-address">{formatAddress(account)}</div>
          <div className="connected-indicator">●</div>
        </div>
      ) : (
        <button className="connect-wallet-btn" onClick={handleConnect}>
          <span className="btn-icon">🔐</span>
          <span className="btn-text">{t('connectWallet', language)}</span>
        </button>
      )}
    </div>
  );
};

export default ConnectButton;



