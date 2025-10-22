import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n/translations';
import { formatTimestamp, formatEther, getRemainingTime, isSurveyEnded } from '../utils/fhevm';
import './SurveyList.css';

function SurveyList({ contract, account, onCreateNew, onVote, onViewResults }) {
  const { language } = useLanguage();
  const [surveys, setSurveys] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'ended', 'my'

  useEffect(() => {
    loadSurveys();
  }, [contract]);

  const loadSurveys = async () => {
    try {
      setIsLoading(true);
      
      // 获取调查总数
      const count = await contract.surveyCount();
      const surveyList = [];

      // 加载每个调查
      for (let i = 0; i < count; i++) {
        try {
          // getSurveyInfo 返回: creator, question, optionCount, endTime, totalResponses, isActive, resultsReleased
          const surveyInfo = await contract.getSurveyInfo(i);
          
          // getSurveyFinancials 返回财务信息
          const financials = await contract.getSurveyFinancials(i);
          
          const hasVoted = await contract.hasUserVoted(i, account);
          const isEnded = !surveyInfo.isActive || isSurveyEnded(surveyInfo.endTime);
          
          surveyList.push({
            id: i,
            question: surveyInfo.question,
            creator: surveyInfo.creator,
            endTime: surveyInfo.endTime,
            optionCount: Number(surveyInfo.optionCount),
            totalResponses: Number(surveyInfo.totalResponses),
            isActive: surveyInfo.isActive,
            resultsReleased: surveyInfo.resultsReleased,
            rewardPool: financials.rewardPool,
            depositRequired: financials.depositRequired,
            rewardPerResponse: financials.rewardPerResponse,
            hasVoted,
            isEnded,
            isCreator: surveyInfo.creator.toLowerCase() === account.toLowerCase(),
          });
        } catch (error) {
          console.error(`加载调查 ${i} 失败:`, error);
        }
      }

      setSurveys(surveyList.reverse()); // 最新的在前面
    } catch (error) {
      console.error('加载调查列表失败:', error);
      toast.error('加载失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredSurveys = () => {
    switch (filter) {
      case 'active':
        return surveys.filter(s => !s.isEnded);
      case 'ended':
        return surveys.filter(s => s.isEnded);
      case 'my':
        return surveys.filter(s => s.isCreator);
      default:
        return surveys;
    }
  };

  const handleRefresh = () => {
    loadSurveys();
    toast.info(t('refreshing', language));
  };

  if (isLoading) {
    return (
      <div className="survey-list-container">
        <div className="loading">{t('loading', language)}</div>
      </div>
    );
  }

  const filteredSurveys = getFilteredSurveys();

  return (
    <div className="survey-list-container">
      <div className="list-header">
        <h2>{t('surveyList', language)}</h2>
        <div className="header-actions">
          <button onClick={handleRefresh} className="refresh-btn">
            🔄 {t('refresh', language)}
          </button>
          <button onClick={onCreateNew} className="create-new-btn">
            {t('createNew', language)}
          </button>
        </div>
      </div>

      <div className="filter-tabs">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          {t('allSurveys', language)} ({surveys.length})
        </button>
        <button
          className={filter === 'active' ? 'active' : ''}
          onClick={() => setFilter('active')}
        >
          {t('activeSurveys', language)} ({surveys.filter(s => !s.isEnded).length})
        </button>
        <button
          className={filter === 'ended' ? 'active' : ''}
          onClick={() => setFilter('ended')}
        >
          {t('endedSurveys', language)} ({surveys.filter(s => s.isEnded).length})
        </button>
        <button
          className={filter === 'my' ? 'active' : ''}
          onClick={() => setFilter('my')}
        >
          {t('mySurveys', language)} ({surveys.filter(s => s.isCreator).length})
        </button>
      </div>

      {filteredSurveys.length === 0 ? (
        <div className="empty-state">
          <p>{t('noSurveys', language)}</p>
          <button onClick={onCreateNew} className="create-first-btn">
            {t('noSurveysDesc', language)}
          </button>
        </div>
      ) : (
        <div className="survey-grid">
          {filteredSurveys.map((survey) => (
            <div key={survey.id} className="survey-card">
              <div className="survey-card-header">
                <h3>{survey.question}</h3>
                {survey.isCreator && (
                  <span className="creator-badge">{t('mySurveys', language)}</span>
                )}
                {survey.isEnded ? (
                  <span className="status-badge ended">{t('ended', language)}</span>
                ) : (
                  <span className="status-badge active">{t('active', language)}</span>
                )}
                {survey.resultsReleased && (
                  <span className="status-badge released">{t('released', language)}</span>
                )}
              </div>

              <div className="survey-meta">
                <div className="meta-item">
                  <span className="meta-label">{t('surveyOptions', language)}:</span>
                  <span className="meta-value">{survey.optionCount}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('participants', language)}:</span>
                  <span className="meta-value">{survey.totalResponses}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('rewardPool', language)}:</span>
                  <span className="meta-value">{formatEther(survey.rewardPool)} ETH</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('deposit', language)}:</span>
                  <span className="meta-value">{formatEther(survey.depositRequired)} ETH</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('rewardPerVote', language)}:</span>
                  <span className="meta-value">{formatEther(survey.rewardPerResponse)} ETH</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">
                    {survey.isEnded ? t('endTime', language) : t('timeRemaining', language)}:
                  </span>
                  <span className="meta-value">
                    {survey.isEnded
                      ? formatTimestamp(survey.endTime)
                      : getRemainingTime(survey.endTime)}
                  </span>
                </div>
              </div>

              <div className="survey-actions">
                {!survey.isEnded && !survey.hasVoted ? (
                  <button
                    onClick={() => onVote(survey.id)}
                    className="vote-btn"
                  >
                    📝 {t('vote', language)}
                  </button>
                ) : survey.hasVoted ? (
                  <button
                    onClick={() => onViewResults(survey.id)}
                    className="view-results-btn"
                  >
                    📊 {t('viewResults', language)}
                  </button>
                ) : (
                  <button
                    onClick={() => onViewResults(survey.id)}
                    className="view-results-btn"
                  >
                    📊 {t('viewResults', language)}
                  </button>
                )}
              </div>

              {survey.hasVoted && (
                <div className="voted-indicator">
                  ✓ {t('alreadyVoted', language)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SurveyList;

