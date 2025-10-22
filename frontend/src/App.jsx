import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { initFhevm, getContractInstance } from './utils/fhevm';
import { useLanguage } from './contexts/LanguageContext';
import { t } from './i18n/translations';
import ConnectButton from './components/ConnectButton';
import LanguageToggle from './components/LanguageToggle';
import CreateSurvey from './components/CreateSurvey';
import SurveyList from './components/SurveyList';
import VoteSurvey from './components/VoteSurvey';
import ViewResults from './components/ViewResults';
import './App.css';

function App() {
  const { language } = useLanguage();
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [fhevmInstance, setFhevmInstance] = useState(null);
  const [currentView, setCurrentView] = useState('list'); // 'list', 'create', 'vote', 'results'
  const [selectedSurveyId, setSelectedSurveyId] = useState(null);

  // 初始化合约和 fhEVM
  const initializeContract = async () => {
    if (!window.ethereum) {
      toast.error(t('installMetaMask', language));
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      
      setAccount(address);

      // 初始化 fhEVM
      const instance = await initFhevm();
      setFhevmInstance(instance);

      // 获取合约实例
      const contractInstance = await getContractInstance(signer);
      setContract(contractInstance);

      toast.success(t('walletConnected', language));
    } catch (error) {
      console.error('初始化失败:', error);
      toast.error(t('initError', language) + ': ' + error.message);
    }
  };

  // 监听账户变化
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          initializeContract();
        } else {
          setAccount(null);
          setContract(null);
          setFhevmInstance(null);
          toast.warning(t('walletDisconnected', language));
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners('accountsChanged');
        window.ethereum.removeAllListeners('chainChanged');
      }
    };
  }, []);

  // 渲染当前视图
  const renderView = () => {
    if (!contract || !fhevmInstance) {
      return (
        <div className="welcome-section">
          <h2>{t('welcomeTitle', language)}</h2>
          <p>{t('welcomeDesc', language)}</p>
          <ul>
            <li>{t('feature1', language)}</li>
            <li>{t('feature2', language)}</li>
            <li>{t('feature3', language)}</li>
            <li>{t('feature4', language)}</li>
          </ul>
          <p className="connect-hint">{t('connectHint', language)}</p>
        </div>
      );
    }

    switch (currentView) {
      case 'create':
        return (
          <CreateSurvey
            contract={contract}
            fhevmInstance={fhevmInstance}
            onBack={() => setCurrentView('list')}
          />
        );
      case 'vote':
        return (
          <VoteSurvey
            contract={contract}
            fhevmInstance={fhevmInstance}
            surveyId={selectedSurveyId}
            onBack={() => setCurrentView('list')}
          />
        );
      case 'results':
        return (
          <ViewResults
            contract={contract}
            surveyId={selectedSurveyId}
            account={account}
            onBack={() => setCurrentView('list')}
          />
        );
      default:
        return (
          <SurveyList
            contract={contract}
            account={account}
            onCreateNew={() => setCurrentView('create')}
            onVote={(id) => {
              setSelectedSurveyId(id);
              setCurrentView('vote');
            }}
            onViewResults={(id) => {
              setSelectedSurveyId(id);
              setCurrentView('results');
            }}
          />
        );
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <h1>{t('appTitle', language)}</h1>
          <div className="wallet-section">
            <LanguageToggle />
            <ConnectButton 
              account={account}
              onConnect={initializeContract}
            />
          </div>
        </div>
      </header>

      <main className="app-main">
        {renderView()}
      </main>

      <footer className="app-footer">
        <p>{t('footerText', language)}</p>
      </footer>

      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

export default App;

