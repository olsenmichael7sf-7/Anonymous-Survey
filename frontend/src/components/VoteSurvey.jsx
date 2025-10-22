import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n/translations';
import { formatTimestamp, getRemainingTime, encryptVoteOption, formatEther } from '../utils/fhevm';
import './VoteSurvey.css';

function VoteSurvey({ contract, fhevmInstance, surveyId, onBack }) {
  const { language } = useLanguage();
  const [survey, setSurvey] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [financials, setFinancials] = useState(null);

  useEffect(() => {
    loadSurvey();
  }, [surveyId]);

  const loadSurvey = async () => {
    try {
      setIsLoading(true);
      
      // getSurveyInfo 返回: creator, question, optionCount, endTime, totalResponses, isActive, resultsReleased
      const surveyInfo = await contract.getSurveyInfo(surveyId);
      
      // getSurveyFinancials 返回: rewardPool, depositRequired, rewardPerResponse, totalRewardsAllocated, remainingRewardPool, totalDepositsHeld
      const financialInfo = await contract.getSurveyFinancials(surveyId);
      
      setSurvey({
        question: surveyInfo.question,
        endTime: surveyInfo.endTime,
        optionCount: Number(surveyInfo.optionCount),
        totalResponses: Number(surveyInfo.totalResponses),
        isActive: surveyInfo.isActive,
        resultsReleased: surveyInfo.resultsReleased,
      });

      setFinancials({
        depositRequired: financialInfo.depositRequired,
        rewardPerResponse: financialInfo.rewardPerResponse,
        rewardPool: financialInfo.rewardPool,
        remainingRewardPool: financialInfo.remainingRewardPool,
      });

      // 加载选项
      const optionList = await contract.getSurveyOptions(surveyId);
      setOptions(optionList);
    } catch (error) {
      console.error('加载调查失败:', error);
      toast.error(t('loadFailed', language) + ': ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVote = async () => {
    if (selectedOption === null) {
      toast.warning(t('selectOption', language));
      return;
    }

    try {
      setIsVoting(true);
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔐 开始加密投票流程');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 投票信息:');
      console.log('  - 调查 ID:', surveyId);
      console.log('  - 选择的选项索引:', selectedOption);
      console.log('  - 选项内容:', options[selectedOption]);
      console.log('  - 需要押金:', formatEther(financials?.depositRequired || 0n), 'ETH');
      console.log('───────────────────────────────────────────────────────');
      
      toast.info(t('encryptingVote', language));
      console.log('🔒 步骤 1: 使用 TFHE 加密投票选项...');
      console.log('  - fhevmInstance 状态:', fhevmInstance ? '已初始化' : '未初始化');
      
      // 加密投票选项
      const encrypted = await encryptVoteOption(fhevmInstance, selectedOption);
      
      console.log('✅ 加密成功！');
      console.log('  - 加密句柄:', encrypted.handles[0]);
      console.log('  - 证明长度:', encrypted.inputProof?.length || 0, 'bytes');
      console.log('───────────────────────────────────────────────────────');
      
      toast.info(t('submittingVote', language));
      console.log('📤 步骤 2: 提交加密投票到合约...');
      
      // submitResponse(uint256 surveyId, externalEuint8 encryptedOptionIndex, bytes inputProof) payable
      // 需要支付押金
      const depositRequired = financials?.depositRequired || 0n;
      console.log('  - 交易参数:');
      console.log('    * surveyId:', surveyId);
      console.log('    * encryptedHandle:', encrypted.handles[0]);
      console.log('    * inputProof (Uint8Array):', encrypted.inputProof);
      console.log('    * inputProof length:', encrypted.inputProof.length, 'bytes');
      console.log('    * value (押金):', formatEther(depositRequired), 'ETH');
      
      const tx = await contract.submitResponse(
        surveyId,
        encrypted.handles[0],
        encrypted.inputProof,
        { value: depositRequired }
      );

      console.log('  - 交易哈希:', tx.hash);
      toast.info(t('transactionSubmitted', language));
      console.log('⏳ 等待交易确认...');
      
      const receipt = await tx.wait();
      
      console.log('✅ 交易已确认！');
      console.log('  - 区块号:', receipt.blockNumber);
      console.log('  - Gas 使用:', receipt.gasUsed.toString());
      console.log('═══════════════════════════════════════════════════════');
      console.log('🎉 投票流程完成！');
      console.log('═══════════════════════════════════════════════════════');

      toast.success(t('voteSuccessMessage', language));
      
      // 返回列表页
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ 投票失败');
      console.error('═══════════════════════════════════════════════════════');
      console.error('错误详情:', error);
      console.error('错误消息:', error.message);
      console.error('错误原因:', error.reason);
      console.error('═══════════════════════════════════════════════════════');
      
      if (error.message.includes('AlreadyVoted')) {
        toast.error(t('alreadyVotedError', language));
      } else if (error.message.includes('SurveyEnded')) {
        toast.error(t('surveyEndedError', language));
      } else if (error.message.includes('InsufficientDeposit')) {
        toast.error(t('insufficientDepositError', language));
      } else {
        toast.error(t('voteFailed', language) + ': ' + (error.reason || error.message));
      }
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="vote-survey-container">
        <div className="loading">{t('loading', language)}</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="vote-survey-container">
        <div className="error">{t('surveyNotExist', language)}</div>
      </div>
    );
  }

  return (
    <div className="vote-survey-container">
      <div className="vote-survey-header">
        <button onClick={onBack} className="back-btn">
          ← {t('back', language)}
        </button>
        <h2>{t('participateInVote', language)}</h2>
      </div>

      <div className="survey-info-card">
        <h3>{survey.question}</h3>
        
        <div className="survey-stats">
          <div className="stat-item">
            <span className="stat-label">{t('timeRemaining', language)}:</span>
            <span className="stat-value">{getRemainingTime(survey.endTime)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('currentParticipants', language)}:</span>
            <span className="stat-value">{survey.totalResponses}</span>
          </div>
          {financials && (
            <>
              <div className="stat-item">
                <span className="stat-label">{t('needDeposit', language)}:</span>
                <span className="stat-value">{formatEther(financials.depositRequired)} ETH</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('participationReward', language)}:</span>
                <span className="stat-value">{formatEther(financials.rewardPerResponse)} ETH</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="options-container">
        <h4>{t('selectYourAnswer', language)}</h4>
        <div className="options-list">
          {options.map((option, index) => (
            <div
              key={index}
              className={`option-item ${selectedOption === index ? 'selected' : ''}`}
              onClick={() => setSelectedOption(index)}
            >
              <div className="option-radio">
                {selectedOption === index && <div className="option-radio-dot" />}
              </div>
              <div className="option-content">
                <span className="option-label">{t('optionLabel', language)} {index + 1}</span>
                <span className="option-text">{option}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="vote-actions">
        <button
          onClick={onBack}
          className="cancel-btn"
          disabled={isVoting}
        >
          {t('cancel', language)}
        </button>
        <button
          onClick={handleVote}
          className="submit-vote-btn"
          disabled={isVoting || selectedOption === null}
        >
          {isVoting ? t('submitting', language) : t('submitVote', language)}
        </button>
      </div>

      <div className="privacy-notice">
        <p>{t('privacyNotice', language)}</p>
      </div>
    </div>
  );
}

export default VoteSurvey;

