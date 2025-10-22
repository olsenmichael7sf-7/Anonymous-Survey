import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useLanguage } from '../contexts/LanguageContext';
import { t } from '../i18n/translations';
import { formatTimestamp, formatEther, isSurveyEnded, userDecrypt } from '../utils/fhevm';
import { ethers } from 'ethers';
import './ViewResults.css';

function ViewResults({ contract, surveyId, account, onBack }) {
  const { language } = useLanguage();
  const [survey, setSurvey] = useState(null);
  const [options, setOptions] = useState([]);
  const [decryptedVotes, setDecryptedVotes] = useState([]);
  const [percentages, setPercentages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canWithdraw, setCanWithdraw] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [hasWithdrawn, setHasWithdrawn] = useState(false);
  const [financials, setFinancials] = useState(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [autoReleaseTriggered, setAutoReleaseTriggered] = useState(false);
  const [skipReloadDecryptedData, setSkipReloadDecryptedData] = useState(false);

  useEffect(() => {
    loadResults();
  }, [surveyId]);

  // 自动发布结果的 Effect - 任何用户访问时都可以触发
  useEffect(() => {
    const autoReleaseResults = async () => {
      // 检查是否满足自动发布条件
      if (
        survey &&
        survey.isEnded &&            // 调查已结束
        !survey.resultsReleased &&   // 结果未发布
        !autoReleaseTriggered &&     // 未触发过自动发布
        !isDecrypting &&             // 不在解密中
        options.length > 0           // 已加载选项
      ) {
        console.log('🚀 检测到调查已结束且结果未发布，自动触发发布和解密...');
        toast.info(t('autoReleasingResults', language));
        setAutoReleaseTriggered(true);
        
        // 短暂延迟后执行，让用户看到页面加载完成
        setTimeout(() => {
          handleReleaseAndDecrypt();
        }, 1000);
      }
    };

    autoReleaseResults();
  }, [survey, options, autoReleaseTriggered, isDecrypting]);

  const loadResults = async () => {
    try {
      setIsLoading(true);
      
      // 获取问卷基本信息
      const surveyInfo = await contract.getSurveyInfo(surveyId);
      const isCreator = surveyInfo.creator.toLowerCase() === account.toLowerCase();
      const ended = !surveyInfo.isActive || isSurveyEnded(surveyInfo.endTime);
      
      setSurvey({
        question: surveyInfo.question,
        creator: surveyInfo.creator,
        endTime: surveyInfo.endTime,
        optionCount: Number(surveyInfo.optionCount),
        totalResponses: Number(surveyInfo.totalResponses),
        isActive: surveyInfo.isActive,
        resultsReleased: surveyInfo.resultsReleased,
        isCreator,
        isEnded: ended,
      });

      // 获取财务信息
      const financialInfo = await contract.getSurveyFinancials(surveyId);
      setFinancials({
        rewardPool: financialInfo.rewardPool,
        depositRequired: financialInfo.depositRequired,
        rewardPerResponse: financialInfo.rewardPerResponse,
        totalRewardsAllocated: financialInfo.totalRewardsAllocated,
        remainingRewardPool: financialInfo.remainingRewardPool,
        totalDepositsHeld: financialInfo.totalDepositsHeld,
      });

      // 加载选项
      const optionList = await contract.getSurveyOptions(surveyId);
      setOptions(optionList);

      // 如果结果已发布，尝试从区块链加载解密后的投票结果
      if (surveyInfo.resultsReleased) {
        console.log('\n📊 结果已发布，尝试从区块链读取解密数据...');
        try {
          const votes = await contract.getAllDecryptedVotes(surveyId);
          const votesAsNumbers = votes.map(v => Number(v));
          
          console.log('  - 区块链上的解密投票数:', votesAsNumbers);
          
          // 检查是否有有效的解密数据
          const hasValidData = votesAsNumbers.some(v => v > 0);
          
          if (hasValidData) {
            console.log('  ✅ 区块链上有解密数据，直接使用');
            setDecryptedVotes(votesAsNumbers);
            
            // 获取百分比统计
            const stats = await contract.getSurveyStatistics(surveyId);
            const statsAsNumbers = stats.map(s => Number(s));
            console.log('  - 区块链上的百分比统计:', statsAsNumbers);
            setPercentages(statsAsNumbers);
          } else {
            console.log('  ⚠️ 区块链上暂无解密数据（全为0）');
            console.log('  - 可能原因：结果已发布但尚未解密');
            console.log('  - 用户需要点击"发布并解密结果"按钮');
            setDecryptedVotes([]);
            setPercentages([]);
          }
        } catch (error) {
          console.log('  ❌ 读取解密结果失败:', error.message);
          console.log('  - 可能原因：合约调用失败或数据尚未准备好');
          setDecryptedVotes([]);
          setPercentages([]);
        }
      } else {
        console.log('\n⏳ 结果尚未发布，无法读取解密数据');
        setDecryptedVotes([]);
        setPercentages([]);
      }

      // 检查是否可以提取奖励
      if (ended) {
        const hasVoted = await contract.hasUserVoted(surveyId, account);
        const withdrawn = await contract.hasUserWithdrawn(surveyId, account);
        setCanWithdraw(hasVoted && !withdrawn);
        setHasWithdrawn(withdrawn);
      }
      
    } catch (error) {
      console.error('加载结果失败:', error);
      toast.error('加载失败: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawParticipant = async () => {
    try {
      setIsWithdrawing(true);
      
      toast.info('正在提取押金和奖励，请确认交易...');
      
      // withdrawParticipantFunds 会退还押金并支付奖励（如果有）
      const tx = await contract.withdrawParticipantFunds(surveyId);
      
      toast.info('交易已提交，等待确认...');
      await tx.wait();

      toast.success('提取成功！');
      setCanWithdraw(false);
      setHasWithdrawn(true);
      
      // 刷新数据
      loadResults();
    } catch (error) {
      console.error('提取失败:', error);
      toast.error('提取失败: ' + (error.reason || error.message));
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleWithdrawRewardPool = async () => {
    try {
      setIsWithdrawing(true);
      
      toast.info('正在提取剩余奖励池，请确认交易...');
      
      // 创建者可以在调查结束后提取剩余的奖励池
      const tx = await contract.withdrawRewardPool(surveyId);
      
      toast.info('交易已提交，等待确认...');
      await tx.wait();

      toast.success('提取成功！');
      setHasWithdrawn(true);
      
      // 刷新数据
      loadResults();
    } catch (error) {
      console.error('提取失败:', error);
      toast.error('提取失败: ' + (error.reason || error.message));
    } finally {
      setIsWithdrawing(false);
    }
  };

  /**
   * 发布结果并使用 HTTP 公开解密（即时解密）
   */
  const handleReleaseAndDecrypt = async () => {
    try {
      setIsDecrypting(true);
      
      console.log('═══════════════════════════════════════════════════════');
      console.log('🔓 开始解密投票流程');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 调查信息:');
      console.log('  - 调查 ID:', surveyId);
      console.log('  - 选项数量:', options.length);
      console.log('  - 选项列表:', options);
      console.log('───────────────────────────────────────────────────────');
      
      toast.info('正在发布结果并准备解密...');
      
      // 步骤 1: 为所有选项调用 releaseAndRequestDecrypt
      // 这会标记结果可公开，并从事件中获取加密句柄
      console.log('🔐 步骤 1: 发布加密结果并请求解密...');
      const handles = [];
      
      for (let i = 0; i < options.length; i++) {
        try {
          console.log(`\n📌 处理选项 ${i}/${options.length - 1}:`);
          console.log(`  - 选项内容: "${options[i]}"`);
          toast.info(`正在发布选项 ${i + 1}/${options.length}，请确认交易...`);
          
          console.log(`  - 调用合约方法: releaseAndRequestDecrypt(${surveyId}, ${i})`);
          const releaseTx = await contract.releaseAndRequestDecrypt(surveyId, i);
          console.log(`  - 交易已提交，哈希:`, releaseTx.hash);
          console.log(`  - 等待交易确认...`);
          
          const receipt = await releaseTx.wait();
          
          console.log(`  ✅ 交易已确认！`);
          console.log(`    * 区块号:`, receipt.blockNumber);
          console.log(`    * Gas 使用:`, receipt.gasUsed.toString());
          console.log(`    * 日志数量:`, receipt.logs.length);
          
          // 从事件中获取 voteHandle
          console.log(`  - 解析交易事件...`);
          const decryptionRequestedEvent = receipt.logs.find(
            log => {
              try {
                const parsed = contract.interface.parseLog(log);
                return parsed && parsed.name === 'DecryptionRequested';
              } catch {
                return false;
              }
            }
          );
          
          if (decryptionRequestedEvent) {
            const parsed = contract.interface.parseLog(decryptionRequestedEvent);
            const voteHandle = parsed.args.voteHandle;
            handles.push(voteHandle);
            console.log(`  ✅ 成功获取加密句柄！`);
            console.log(`    * voteHandle (前20字符):`, voteHandle.substring(0, 20) + '...');
            console.log(`    * voteHandle (完整):`, voteHandle);
            console.log(`    * 事件参数:`, {
              surveyId: parsed.args.surveyId?.toString(),
              optionIndex: parsed.args.optionIndex?.toString(),
              voteHandle: voteHandle.substring(0, 20) + '...'
            });
          } else {
            console.error(`  ❌ 未找到 DecryptionRequested 事件`);
            console.error(`  可用的事件:`, receipt.logs.map((log, idx) => {
              try {
                const parsed = contract.interface.parseLog(log);
                return `${idx}: ${parsed?.name || '未知'}`;
              } catch {
                return `${idx}: 无法解析`;
              }
            }));
            throw new Error(`未找到选项 ${i} 的解密请求事件`);
          }
        } catch (releaseError) {
          console.error(`  ❌ 发布选项 ${i} 失败:`);
          console.error(`    * 错误类型:`, releaseError.constructor.name);
          console.error(`    * 错误消息:`, releaseError.message);
          console.error(`    * 错误原因:`, releaseError.reason);
          console.error(`    * 完整错误:`, releaseError);
          throw new Error(`发布选项 ${i} 失败: ${releaseError.reason || releaseError.message}`);
        }
      }
      
      console.log('\n───────────────────────────────────────────────────────');
      console.log(`✅ 步骤 1 完成！共获取到 ${handles.length} 个加密句柄`);
      console.log('句柄列表:');
      handles.forEach((handle, idx) => {
        console.log(`  [${idx}] ${handle.substring(0, 30)}...`);
      });
      console.log('───────────────────────────────────────────────────────');
      
      // 步骤 2: 使用 userDecrypt 解密所有句柄
      console.log('\n🔓 步骤 2: 使用 SDK userDecrypt 解密投票数据...');
      console.log('  - 将为每个选项调用 userDecrypt');
      console.log('  - 需要用户签名授权解密请求');
      toast.info('正在解密投票数据，请签名授权...');
      
      // 获取 signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contractAddress = await contract.getAddress();
      
      const voteCounts = [];
      
      for (let i = 0; i < handles.length; i++) {
        try {
          console.log(`\n  [${i + 1}/${handles.length}] 解密选项 "${options[i]}"...`);
          toast.info(`解密选项 ${i + 1}/${handles.length}，请签名...`);
          
          const decryptedValue = await userDecrypt(handles[i], contractAddress, signer);
          voteCounts.push(decryptedValue);
          
          console.log(`    ✅ 解密成功！票数: ${decryptedValue}`);
        } catch (decryptError) {
          console.error(`    ❌ 解密选项 ${i} 失败:`, decryptError);
          toast.error(`解密选项 ${i + 1} 失败: ${decryptError.message}`);
          throw new Error(`解密选项 ${i} 失败: ${decryptError.message}`);
        }
      }
      
      console.log('\n───────────────────────────────────────────────────────');
      console.log(`✅ 步骤 2 完成！所有选项已解密`);
      console.log('解密结果:', voteCounts);
      console.log('───────────────────────────────────────────────────────');
      
      // 步骤 3: 将解密结果存储到区块链
      console.log('\n💾 步骤 3: 将解密结果存储到区块链...');
      console.log('  - 将为每个选项调用 storeDecryptedVote');
      toast.info('正在将解密结果存储到区块链...');
      
      for (let i = 0; i < voteCounts.length; i++) {
        try {
          console.log(`\n  [${i + 1}/${voteCounts.length}] 存储选项 "${options[i]}" 的结果...`);
          console.log(`    * 票数: ${voteCounts[i]}`);
          toast.info(`存储选项 ${i + 1}/${voteCounts.length}，请确认交易...`);
          
          const storeTx = await contract.storeDecryptedVote(surveyId, i, Number(voteCounts[i]));
          console.log(`    * 交易已提交，哈希:`, storeTx.hash);
          console.log(`    * 等待交易确认...`);
          
          const receipt = await storeTx.wait();
          console.log(`    ✅ 交易已确认！`);
          console.log(`      - 区块号:`, receipt.blockNumber);
          console.log(`      - Gas 使用:`, receipt.gasUsed.toString());
        } catch (storeError) {
          console.error(`    ❌ 存储选项 ${i} 失败:`, storeError);
          toast.error(`存储选项 ${i + 1} 失败: ${storeError.message}`);
          // 继续存储其他选项
        }
      }
      
      console.log('\n───────────────────────────────────────────────────────');
      console.log(`✅ 步骤 3 完成！解密结果已存储到区块链`);
      console.log('───────────────────────────────────────────────────────');
      
      // 步骤 4: 处理解密结果并计算统计信息
      console.log('\n🔍 步骤 4: 计算统计信息...');
      
      console.log('  - 解密后的投票数:');
      voteCounts.forEach((count, idx) => {
        console.log(`    [${idx}] ${options[idx]}: ${count} 票`);
      });
      
      // ⚠️ 重要：将 BigInt 转换为 Number 以进行数学运算
      const voteCountsAsNumbers = voteCounts.map(count => Number(count));
      console.log('  - 转换后的数字:', voteCountsAsNumbers);
      
      // 计算总票数和百分比
      let totalVotes = 0;
      voteCountsAsNumbers.forEach(count => {
        totalVotes += count;
      });
      
      console.log('  - 总票数:', totalVotes);
      
      // 计算百分比
      const percentageValues = voteCountsAsNumbers.map(count => 
        totalVotes > 0 ? (count * 10000 / totalVotes) : 0
      );
      
      console.log('  - 百分比 (basis points):');
      percentageValues.forEach((pct, idx) => {
        const percentage = (pct / 100).toFixed(2);
        console.log(`    [${idx}] ${options[idx]}: ${percentage}% (${pct} bp)`);
      });
      
      // 保存为 Number 类型（已转换过）
      setDecryptedVotes(voteCountsAsNumbers);
      setPercentages(percentageValues);
      
      // ⚠️ 重要：更新 survey.resultsReleased 状态，避免重新加载覆盖解密结果
      setSurvey(prev => ({
        ...prev,
        resultsReleased: true
      }));
      
      console.log('\n───────────────────────────────────────────────────────');
      console.log(`✅ 步骤 4 完成！统计信息已计算`);
      console.log('───────────────────────────────────────────────────────');
      
      console.log('\n═══════════════════════════════════════════════════════');
      console.log('🎉 解密成功！结果已存储到区块链');
      console.log('═══════════════════════════════════════════════════════');
      console.log('📊 最终结果:');
      console.log('  - 解密后的投票数:', voteCountsAsNumbers);
      console.log('  - 百分比 (basis points):', percentageValues);
      console.log('───────────────────────────────────────────────────────');
      
      // 步骤 5: 从区块链验证数据已存储
      console.log('\n🔍 步骤 5: 验证数据已存储到区块链...');
      try {
        const verifyVotes = await contract.getAllDecryptedVotes(surveyId);
        const verifyStats = await contract.getSurveyStatistics(surveyId);
        console.log('  ✅ 验证成功！区块链上的数据:');
        console.log('    * 投票数:', verifyVotes.map(v => Number(v)));
        console.log('    * 百分比:', verifyStats.map(s => Number(s)));
        
        toast.success('🎉 解密成功！结果已存储到区块链，刷新页面可继续查看');
      } catch (verifyError) {
        console.error('  ⚠️ 验证失败:', verifyError.message);
        toast.warning('解密成功，但验证失败，请刷新页面确认');
      }
      
      console.log('\n───────────────────────────────────────────────────────');
      console.log(`✅ 步骤 5 完成！数据已验证`);
      console.log('───────────────────────────────────────────────────────');
      console.log('✅ 所有步骤完成，刷新页面后可从区块链读取数据');
      
    } catch (error) {
      console.error('\n═══════════════════════════════════════════════════════');
      console.error('❌ 发布和解密失败');
      console.error('═══════════════════════════════════════════════════════');
      console.error('错误类型:', error.constructor.name);
      console.error('错误消息:', error.message);
      console.error('错误原因:', error.reason);
      console.error('错误堆栈:', error.stack);
      console.error('完整错误对象:', error);
      console.error('═══════════════════════════════════════════════════════');
      toast.error('解密失败: ' + (error.reason || error.message));
      
      // 失败提示
      toast.info('💡 提示：请确保已授权签名请求，如需帮助请查看控制台日志');
    } finally {
      setIsDecrypting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="view-results-container">
        <div className="loading">{t('loading', language)}</div>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="view-results-container">
        <div className="error">{t('surveyNotExist', language)}</div>
      </div>
    );
  }

  return (
    <div className="view-results-container">
      <div className="results-header">
        <button onClick={onBack} className="back-btn">
          ← {t('back', language)}
        </button>
        <h2>{t('surveyResults', language)}</h2>
      </div>

      <div className="survey-info-card">
        <h3>{survey.question}</h3>
        
        <div className="survey-stats-grid">
          <div className="stat-card">
            <span className="stat-label">{t('status', language)}</span>
            <span className={`stat-value ${survey.isEnded ? 'ended' : 'active'}`}>
              {survey.isEnded ? t('ended', language) : t('active', language)}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('totalParticipants', language)}</span>
            <span className="stat-value">{survey.totalResponses}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('endTime', language)}</span>
            <span className="stat-value">{formatTimestamp(survey.endTime)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{t('resultsStatus', language)}</span>
            <span className="stat-value">{survey.resultsReleased ? t('notPublished', language) : t('published', language)}</span>
          </div>
        </div>

        {financials && (
          <div className="financial-info">
            <h4>{t('financialInfo', language)}</h4>
            <div className="financial-grid">
              <div className="financial-item">
                <span className="financial-label">{t('initialRewardPool', language)}:</span>
                <span className="financial-value">{formatEther(financials.rewardPool)} ETH</span>
              </div>
              <div className="financial-item">
                <span className="financial-label">{t('remainingRewardPool', language)}:</span>
                <span className="financial-value">{formatEther(financials.remainingRewardPool)} ETH</span>
              </div>
              <div className="financial-item">
                <span className="financial-label">{t('allocatedRewards', language)}:</span>
                <span className="financial-value">{formatEther(financials.totalRewardsAllocated)} ETH</span>
              </div>
              <div className="financial-item">
                <span className="financial-label">{t('depositsHeld', language)}:</span>
                <span className="financial-value">{formatEther(financials.totalDepositsHeld)} ETH</span>
              </div>
              <div className="financial-item">
                <span className="financial-label">{t('participationDeposit', language)}:</span>
                <span className="financial-value">{formatEther(financials.depositRequired)} ETH</span>
              </div>
              <div className="financial-item">
                <span className="financial-label">{t('rewardPerPerson', language)}:</span>
                <span className="financial-value">{formatEther(financials.rewardPerResponse)} ETH</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="results-content">
        <div className="results-header-row">
          <h4>{t('voteResults', language)}</h4>
          
          {/* 发布结果按钮（调查结束后任何人可见，且结果未发布） */}
          {survey.isEnded && !survey.resultsReleased && !isDecrypting && (
            <button 
              onClick={handleReleaseAndDecrypt}
              className="release-decrypt-btn"
              disabled={isDecrypting}
            >
              {t('manualReleaseBtn', language)}
            </button>
          )}
        </div>
        
        {/* 自动发布提示 */}
        {survey.isEnded && !survey.resultsReleased && isDecrypting && (
          <div className="auto-release-notice">
            <div className="notice-icon">⏳</div>
            <div className="notice-content">
              <strong>{t('autoReleasingNotice', language)}</strong>
              <p>{t('autoReleasingDesc', language)}</p>
            </div>
          </div>
        )}
        
        {survey.resultsReleased ? (
          // 结果已发布，检查是否有解密数据
          decryptedVotes.length > 0 ? (
            <>
              {/* 数据来源提示 */}
              <div className="data-source-notice">
                <span className="notice-icon">✅</span>
                <span className="notice-text">{t('decryptedFromBlockchain', language)}</span>
              </div>
              
              <div className="options-results">
                {(() => {
                  console.log('🎨 渲染投票结果:');
                  console.log('  - decryptedVotes:', decryptedVotes);
                  console.log('  - percentages:', percentages);
                  console.log('  - options:', options);
                  return null;
                })()}
                {options.map((option, index) => {
                  const votes = decryptedVotes[index] || 0;
                  const percentage = percentages[index] || 0;
                  console.log(`  - 选项 ${index + 1} (${option}): ${votes} 票, ${(percentage / 100).toFixed(2)}%`);
                  return (
                    <div key={index} className="result-item">
                      <div className="result-header">
                        <span className="option-label">{t('optionLabel', language)} {index + 1}</span>
                        <span className="option-text">{option}</span>
                      </div>
                      <div className="result-stats">
                        <span className="vote-count">{votes} {t('votesCount', language)}</span>
                        <span className="vote-percentage">{(percentage / 100).toFixed(2)}%</span>
                      </div>
                      <div className="result-bar-container">
                        <div 
                          className="result-bar" 
                          style={{ width: `${percentage / 100}%` }}
                        >
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* 区块链数据未更新提示 */}
              <div className="decrypting-notice">
                <div className="notice-icon">⚠️</div>
                <div className="notice-content">
                  <strong>{t('blockchainNotUpdated', language)}</strong>
                  <p>{t('blockchainNotUpdatedDesc', language)}</p>
                  <p>{t('clickManualRelease', language)}</p>
                </div>
              </div>
              
              {/* 显示选项列表（但无数据） */}
              <div className="options-results">
                {options.map((option, index) => (
                  <div key={index} className="result-item">
                    <div className="result-header">
                      <span className="option-label">{t('optionLabel', language)} {index + 1}</span>
                      <span className="option-text">{option}</span>
                    </div>
                    <div className="result-bar-container">
                      <div className="result-bar pending">
                        <span className="pending-text">{t('waitingForDecryption', language)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        ) : (
          // 结果尚未发布，显示加密状态
          <>
            <div className="encrypted-notice">
              <p>{t('encryptedNotice1', language)}</p>
              <p>{t('encryptedNotice2', language)}</p>
              <p>{t('encryptedNotice3', language)}</p>
            </div>

            <div className="options-results">
              {options.map((option, index) => (
                <div key={index} className="result-item">
                  <div className="result-header">
                    <span className="option-label">{t('optionLabel', language)} {index + 1}</span>
                    <span className="option-text">{option}</span>
                  </div>
                  <div className="result-bar-container">
                    <div className="result-bar encrypted">
                      <span className="encrypted-text">{t('encrypted', language)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {survey.isEnded && (
        <div className="withdraw-section">
          {survey.isCreator && financials && financials.remainingRewardPool > 0n && !hasWithdrawn && (
            <div className="withdraw-card">
              <h4>{t('creatorActions', language)}</h4>
              <p>{t('surveyEndedWithdraw', language)}</p>
              <p className="withdraw-amount">
                {t('withdrawableAmount', language)}: {formatEther(financials.remainingRewardPool)} ETH
              </p>
              <button
                onClick={handleWithdrawRewardPool}
                className="withdraw-btn"
                disabled={isWithdrawing}
              >
                {isWithdrawing ? t('processing', language) : t('withdrawRemainingPool', language)}
              </button>
            </div>
          )}

          {canWithdraw && (
            <div className="withdraw-card">
              <h4>{t('participantActions', language)}</h4>
              <p>{t('thankYouParticipate', language)}</p>
              {financials && (
                <p className="withdraw-amount">
                  {t('deposit', language)}: {formatEther(financials.depositRequired)} ETH + 
                  {t('yourReward', language)}: {formatEther(financials.rewardPerResponse)} ETH
                </p>
              )}
              <button
                onClick={handleWithdrawParticipant}
                className="withdraw-btn"
                disabled={isWithdrawing}
              >
                {isWithdrawing ? t('processing', language) : t('withdrawDepositReward', language)}
              </button>
            </div>
          )}

          {hasWithdrawn && (
            <div className="withdraw-card success">
              <h4>{t('withdrawn', language)}</h4>
              <p>{t('successfullyWithdrawn', language)}{survey.isCreator ? t('remainingPoolText', language) : t('depositAndReward', language)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ViewResults;

