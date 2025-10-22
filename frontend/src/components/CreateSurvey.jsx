import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { parseEther } from '../utils/fhevm';
import './CreateSurvey.css';

function CreateSurvey({ contract, fhevmInstance, onBack }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [duration, setDuration] = useState(5); // 默认5分钟
  const [depositRequired, setDepositRequired] = useState('0.01'); // 参与者押金
  const [rewardPerResponse, setRewardPerResponse] = useState('0.005'); // 每人奖励
  const [rewardPool, setRewardPool] = useState('0.01'); // 奖励池（必须 > 0）
  const [isCreating, setIsCreating] = useState(false);

  const handleAddOption = () => {
    if (options.length < 10) {
      setOptions([...options, '']);
    } else {
      toast.warning('最多只能添加10个选项');
    }
  };

  const handleRemoveOption = (index) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    } else {
      toast.warning('至少需要2个选项');
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 验证表单
    if (!question.trim()) {
      toast.error('请输入调查问题');
      return;
    }

    if (options.some(opt => !opt.trim())) {
      toast.error('请填写所有选项');
      return;
    }

    if (duration < 1) {
      toast.error('持续时间至少为1天');
      return;
    }

    if (parseFloat(depositRequired) < 0) {
      toast.error('押金不能为负数');
      return;
    }

    if (parseFloat(rewardPerResponse) < 0) {
      toast.error('奖励不能为负数');
      return;
    }

    const calculatedRewardPool = parseFloat(rewardPool) || 0;
    if (calculatedRewardPool <= 0) {
      toast.error('奖励池金额必须大于 0');
      return;
    }

    const rewardPerResponseValue = parseFloat(rewardPerResponse) || 0;
    if (rewardPerResponseValue > calculatedRewardPool) {
      toast.error('每人奖励不能大于奖励池总额');
      return;
    }

    if (rewardPerResponseValue === 0) {
      toast.error('每人奖励必须大于 0');
      return;
    }

    try {
      setIsCreating(true);
      
      // 调用合约创建调查
      const durationInSeconds = duration * 60; // 分钟转秒
      const depositRequiredWei = parseEther(depositRequired);
      const rewardPerResponseWei = parseEther(rewardPerResponse);
      const rewardPoolWei = parseEther(rewardPool);

      toast.info('正在创建调查，请确认交易...');
      
      // createSurvey(string question, string[] options, uint256 durationInSeconds, 
      //              uint256 depositRequired, uint256 rewardPerResponse) payable
      const tx = await contract.createSurvey(
        question,
        options,
        durationInSeconds,
        depositRequiredWei,
        rewardPerResponseWei,
        { value: rewardPoolWei }
      );

      toast.info('交易已提交，等待确认...');
      await tx.wait();

      toast.success('调查创建成功！');
      
      // 重置表单
      setQuestion('');
      setOptions(['', '']);
      setDuration(5);
      setDepositRequired('0.01');
      setRewardPerResponse('0.005');
      setRewardPool('0.01');
      
      // 返回列表页
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error('创建调查失败:', error);
      toast.error('创建失败: ' + (error.reason || error.message));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-survey-container">
      <div className="create-survey-header">
        <button onClick={onBack} className="back-btn">
          ← 返回
        </button>
        <h2>创建新调查</h2>
      </div>

      <form onSubmit={handleSubmit} className="survey-form">
        <div className="form-group">
          <label htmlFor="question">调查问题 *</label>
          <input
            type="text"
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="请输入调查问题"
            maxLength={200}
            required
          />
        </div>

        <div className="form-group">
          <label>选项 * (2-10个)</label>
          {options.map((option, index) => (
            <div key={index} className="option-input-group">
              <input
                type="text"
                value={option}
                onChange={(e) => handleOptionChange(index, e.target.value)}
                placeholder={`选项 ${index + 1}`}
                maxLength={100}
                required
              />
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(index)}
                  className="remove-option-btn"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="add-option-btn"
            >
              + 添加选项
            </button>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="duration">持续时间（分钟）*</label>
            <input
              type="number"
              id="duration"
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
              min="1"
              max="525600"
              required
            />
            <small className="form-hint">最短1分钟，最长365天（525600分钟）</small>
          </div>

          <div className="form-group">
            <label htmlFor="depositRequired">参与者押金（ETH）</label>
            <input
              type="number"
              id="depositRequired"
              value={depositRequired}
              onChange={(e) => setDepositRequired(e.target.value)}
              step="0.001"
              min="0"
            />
            <small className="form-hint">参与者投票时需支付的押金，结束后可退</small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="rewardPerResponse">每人奖励（ETH）</label>
            <input
              type="number"
              id="rewardPerResponse"
              value={rewardPerResponse}
              onChange={(e) => setRewardPerResponse(e.target.value)}
              step="0.001"
              min="0"
            />
            <small className="form-hint">每位参与者可获得的奖励</small>
          </div>

          <div className="form-group">
            <label htmlFor="rewardPool">奖励池（ETH）*</label>
            <input
              type="number"
              id="rewardPool"
              value={rewardPool}
              onChange={(e) => setRewardPool(e.target.value)}
              step="0.001"
              min="0.001"
              required
            />
            <small className="form-hint">
              创建时注入的奖励池，用于奖励参与者（必须 &gt; 0 且 ≥ 每人奖励）
              {rewardPool && rewardPerResponse && parseFloat(rewardPool) > 0 && parseFloat(rewardPerResponse) > 0 && (
                <span className="calculation-hint">
                  <br />💡 最多可支持 {Math.floor(parseFloat(rewardPool) / parseFloat(rewardPerResponse))} 人参与
                </span>
              )}
            </small>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            onClick={onBack}
            className="cancel-btn"
            disabled={isCreating}
          >
            取消
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={isCreating}
          >
            {isCreating ? '创建中...' : '创建调查'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateSurvey;

