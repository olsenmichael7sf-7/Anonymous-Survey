import { ethers } from 'ethers';
import contractArtifact from '../abi.json';

// 导出 ethers 工具函数
export const { formatEther, parseEther } = ethers;

// ==================== 辅助工具函数 ====================

/**
 * 格式化时间戳为可读字符串
 */
export function formatTimestamp(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 获取剩余时间（人类可读格式）
 */
export function getRemainingTime(endTime) {
  const now = Math.floor(Date.now() / 1000);
  const end = Number(endTime);
  const remaining = end - now;
  
  if (remaining <= 0) {
    return '已结束';
  }
  
  const days = Math.floor(remaining / (24 * 60 * 60));
  const hours = Math.floor((remaining % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((remaining % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

/**
 * 检查调查是否已结束
 */
export function isSurveyEnded(endTime) {
  const now = Math.floor(Date.now() / 1000);
  return Number(endTime) <= now;
}

/**
 * 加密投票选项（用于提交投票）
 */
export async function encryptVoteOption(fhevmInstance, optionIndex) {
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│  🔐 TFHE 加密详细流程                               │');
  console.log('└─────────────────────────────────────────────────────┘');
  
  if (!fhevmInstance) {
    console.error('❌ fhEVM 实例未初始化');
    throw new Error('fhEVM 实例未初始化');
  }
  
  console.log('✅ fhEVM 实例状态: 已初始化');
  
  try {
    // 获取当前用户地址
    console.log('\n📝 步骤 1: 获取用户信息...');
    if (!window.ethereum) {
      console.error('❌ MetaMask 未安装');
      throw new Error('MetaMask 未安装');
    }
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();
    
    console.log('  ✅ 用户地址:', userAddress);
    console.log('  - 合约地址:', CONFIG.CONTRACT_ADDRESS);
    
    // 使用 fhEVM 实例加密选项索引
    console.log('\n🔒 步骤 2: 创建加密输入...');
    console.log('  - 待加密的值 (optionIndex):', optionIndex);
    console.log('  - 数据类型: euint8 (8-bit 无符号加密整数)');
    console.log('  - 加密方法: TFHE (Fully Homomorphic Encryption)');
    
    const input = fhevmInstance.createEncryptedInput(CONFIG.CONTRACT_ADDRESS, userAddress);
    console.log('  ✅ 加密输入对象已创建');
    
    console.log('\n🔐 步骤 3: 添加数据到加密输入...');
    input.add8(optionIndex); // euint8
    console.log('  ✅ 已添加 8-bit 值:', optionIndex);
    
    console.log('\n⚙️ 步骤 4: 执行加密...');
    const startTime = Date.now();
    const encrypted = input.encrypt();
    const duration = Date.now() - startTime;
    
    console.log(`  ✅ 加密完成！(耗时: ${duration}ms)`);
    console.log('\n📦 加密结果:');
    console.log('  - 结果类型:', typeof encrypted);
    console.log('  - handles 数量:', encrypted.handles?.length || 0);
    console.log('  - handles[0] (句柄):', encrypted.handles?.[0]);
    console.log('  - inputProof (Uint8Array):', encrypted.inputProof);
    console.log('  - inputProof 长度:', encrypted.inputProof?.length || 0, 'bytes');
    
    console.log('\n🔍 技术细节:');
    console.log('  - 加密句柄用于在链上引用加密数据');
    console.log('  - inputProof 证明加密的正确性');
    console.log('  - 这些数据将提交到智能合约');
    
    console.log('\n┌─────────────────────────────────────────────────────┐');
    console.log('│  ✅ TFHE 加密完成                                   │');
    console.log('└─────────────────────────────────────────────────────┘\n');
    
    return encrypted;
  } catch (error) {
    console.error('\n┌─────────────────────────────────────────────────────┐');
    console.error('│  ❌ TFHE 加密失败                                   │');
    console.error('└─────────────────────────────────────────────────────┘');
    console.error('错误详情:');
    console.error('  - 错误类型:', error.constructor.name);
    console.error('  - 错误消息:', error.message);
    console.error('  - 错误堆栈:', error.stack);
    console.error('  - 完整错误:', error);
    
    console.error('\n可能的原因:');
    console.error('  1. fhEVM 实例未正确初始化');
    console.error('  2. MetaMask 未连接或未授权');
    console.error('  3. 网络连接问题');
    console.error('  4. 输入值超出范围 (euint8: 0-255)');
    
    throw new Error('加密投票选项失败: ' + error.message);
  }
}

/**
 * 公开解密加密句柄（HTTP 方式，即时返回结果）
 * @param {Array<string>} handles - 加密句柄数组 (bytes32[])
 * @returns {Promise<Object>} - 解密结果对象，键是 handle，值是解密后的数值
 */
export async function publicDecryptHandles(handles) {
  console.log('\n┌─────────────────────────────────────────────────────┐');
  console.log('│  🔓 HTTP 公开解密详细流程                           │');
  console.log('└─────────────────────────────────────────────────────┘');
  
  const fhevmInstance = await initFhevm();
  
  if (!fhevmInstance) {
    console.error('❌ fhEVM 实例未初始化');
    throw new Error('fhEVM 实例未初始化');
  }
  
  console.log('✅ fhEVM 实例已初始化');
  console.log('📊 解密参数:');
  console.log('  - 句柄数量:', handles.length);
  console.log('  - Relayer URL:', CONFIG.RELAYER_URL);
  console.log('\n🔐 待解密的句柄列表:');
  handles.forEach((handle, idx) => {
    console.log(`  [${idx}] ${handle.substring(0, 40)}...${handle.substring(handle.length - 10)}`);
    console.log(`      完整句柄: ${handle}`);
  });
  
  try {
    console.log('\n📡 发起 HTTP 解密请求...');
    console.log('  - 使用方法: fhevmInstance.publicDecrypt()');
    console.log('  - 这是即时解密，不需要等待 Gateway 回调');
    
    // 使用 Relayer SDK 的 publicDecrypt 方法
    // 这会直接通过 HTTP 请求 Relayer 解密，无需等待 Gateway 回调
    const startTime = Date.now();
    const decryptedValues = await fhevmInstance.publicDecrypt(handles);
    const duration = Date.now() - startTime;
    
    console.log(`\n✅ HTTP 解密成功！(耗时: ${duration}ms)`);
    console.log('📊 解密结果:');
    console.log('  - 结果类型:', typeof decryptedValues);
    console.log('  - 结果对象:', decryptedValues);
    console.log('  - 结果数量:', Object.keys(decryptedValues).length);
    
    console.log('\n🔍 详细解密值:');
    Object.entries(decryptedValues).forEach(([handle, value], idx) => {
      console.log(`  [${idx}]`);
      console.log(`    * 句柄: ${handle.substring(0, 30)}...`);
      console.log(`    * 解密值: ${value}`);
      console.log(`    * 值类型: ${typeof value}`);
    });
    
    console.log('\n┌─────────────────────────────────────────────────────┐');
    console.log('│  ✅ HTTP 公开解密完成                               │');
    console.log('└─────────────────────────────────────────────────────┘\n');
    
    return decryptedValues;
  } catch (error) {
    console.error('\n┌─────────────────────────────────────────────────────┐');
    console.error('│  ❌ HTTP 公开解密失败                               │');
    console.error('└─────────────────────────────────────────────────────┘');
    console.error('错误详情:');
    console.error('  - 错误类型:', error.constructor.name);
    console.error('  - 错误消息:', error.message);
    console.error('  - 错误堆栈:', error.stack);
    console.error('  - 完整错误:', error);
    
    if (error.response) {
      console.error('  - HTTP 响应状态:', error.response.status);
      console.error('  - HTTP 响应数据:', error.response.data);
    }
    
    console.error('\n可能的原因:');
    console.error('  1. 句柄无效或未授权');
    console.error('  2. Relayer 服务不可用');
    console.error('  3. 网络连接问题');
    console.error('  4. 解密权限未正确设置');
    
    throw new Error('公开解密失败: ' + error.message);
  }
}

// ==================== 配置信息（明文）====================
export const CONFIG = {
  // 已部署的合约地址（新部署 2025-10-22）
  CONTRACT_ADDRESS: '0xACBF3D3211c9F41BD390feA94C142a6f241eF54C',
  
  // Sepolia 测试网 Chain ID
  CHAIN_ID: 11155111,
  
  // 多个免费的 Sepolia RPC URL（防止过载，自动轮询）
  RPC_URLS: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
    'https://sepolia.gateway.tenderly.co',
    'https://gateway.tenderly.co/public/sepolia',
    'https://ethereum-sepolia.blockpi.network/v1/rpc/public',
    'https://eth-sepolia-public.unifra.io',
    'https://1rpc.io/sepolia',
    'https://rpc2.sepolia.org',
  ],
  
  // Zama Relayer 地址
  RELAYER_URL: 'https://relayer.sepolia.zama.ai/',
  
  // 网络名称
  NETWORK_NAME: 'Sepolia',
  
  // 区块浏览器
  EXPLORER_URL: 'https://sepolia.etherscan.io',
  
  // Zama FHE 系统合约地址（Sepolia 官方部署）
  ACL_ADDRESS: '0x687820221192C5B662b25367F70076A37bc79b6c',
  COPROCESSOR_ADDRESS: '0x848B0066793BcC60346Da1F49049357399B8D595',
  KMS_VERIFIER_ADDRESS: '0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC',
};

// 导出常量（保持向后兼容）
const CONTRACT_ADDRESS = CONFIG.CONTRACT_ADDRESS;
const CHAIN_ID = CONFIG.CHAIN_ID;
const RELAYER_URL = CONFIG.RELAYER_URL;

// RPC URL 轮询索引
let currentRpcIndex = 0;

/**
 * 获取当前可用的 RPC URL（自动轮询）
 */
export function getRpcUrl() {
  const url = CONFIG.RPC_URLS[currentRpcIndex];
  currentRpcIndex = (currentRpcIndex + 1) % CONFIG.RPC_URLS.length;
  return url;
}

let relayerInstance = null;

/**
 * 初始化 Zama Relayer SDK (UMD 方式)
 */
export async function initFhevm() {
  if (relayerInstance) {
    return relayerInstance;
  }

  try {
    // 智能检测 SDK 全局对象（尝试多个可能的名称）
    const possibleNames = [
      'zamaRelayerSDK',    // 官方 CDN 使用的名称（小写开头）
      'ZamaRelayerSDK',    // 大写版本
      'relayerSDK',        // 可能的替代名称
      'RelayerSDK'         // 大写版本
    ];
    
    let sdkModule = null;
    for (const name of possibleNames) {
      if (window[name]) {
        console.log(`✅ 找到 SDK: window.${name}`);
        sdkModule = window[name];
        break;
      }
    }
    
    if (!sdkModule) {
      console.error('❌ 未找到 SDK 全局对象，可用的全局对象：', 
        Object.keys(window).filter(k => k.toLowerCase().includes('sdk') || k.toLowerCase().includes('zama')));
      throw new Error('Zama Relayer SDK UMD 未加载，请确保已在 index.html 中引入 CDN 脚本');
    }

    // UMD v0.2.0 API 初始化
    console.log('📝 SDK 可用方法:', Object.keys(sdkModule).filter(k => typeof sdkModule[k] === 'function'));
    
    // 先初始化 SDK（加载 WASM）
    if (typeof sdkModule.initSDK === 'function') {
      console.log('🔐 初始化 SDK (加载 WASM)...');
      await sdkModule.initSDK();
    }
    
    // 使用 SepoliaConfig 和 window.ethereum
    let config;
    if (sdkModule.SepoliaConfig) {
      console.log('🔐 使用 SepoliaConfig...');
      config = { 
        ...sdkModule.SepoliaConfig, 
        network: window.ethereum 
      };
    } else {
      // 备用配置
      config = {
        chainId: CHAIN_ID,
        relayerUrl: RELAYER_URL,
        aclAddress: CONFIG.ACL_ADDRESS,
        kmsVerifierAddress: CONFIG.KMS_VERIFIER_ADDRESS,
        network: window.ethereum
      };
    }
    
    console.log('📝 FHE 配置:', config);
    
    // 创建实例
    if (typeof sdkModule.createInstance === 'function') {
      console.log('🔐 使用 createInstance API...');
      relayerInstance = await sdkModule.createInstance(config);
    } else if (typeof sdkModule.initRelayer === 'function') {
      console.log('🔐 使用 initRelayer API...');
      relayerInstance = await sdkModule.initRelayer(config);
    } else if (typeof sdkModule === 'function') {
      console.log('🔐 SDK 本身是构造函数...');
      relayerInstance = await sdkModule(config);
    } else {
      throw new Error('无法找到 SDK 初始化方法，可用方法: ' + Object.keys(sdkModule).join(', '));
    }

    console.log('✅ Zama Relayer SDK 初始化成功 (UMD v0.2.0)');
    console.log('📦 Relayer 实例:', relayerInstance);
    return relayerInstance;
  } catch (error) {
    console.error('❌ 初始化 Relayer SDK 失败:', error);
    throw new Error('无法初始化 Relayer SDK: ' + error.message);
  }
}

/**
 * 获取合约实例
 */
export async function getContractInstance(signer) {
  if (!CONTRACT_ADDRESS) {
    throw new Error('合约地址未配置');
  }

  return new ethers.Contract(CONTRACT_ADDRESS, contractArtifact, signer);
}

/**
 * 加密数值
 */
export async function encryptValue(value) {
  const relayer = await initFhevm();
  
  try {
    // 使用 Relayer SDK 加密数值
    const encryptedValue = await relayer.encrypt(value);
    return encryptedValue;
  } catch (error) {
    console.error('加密失败:', error);
    throw new Error('加密数值失败: ' + error.message);
  }
}

/**
 * 解密数值
 */
export async function decryptValue(encryptedValue, contractAddress) {
  const relayer = await initFhevm();
  
  try {
    // 使用 Relayer SDK 解密数值
    const decryptedValue = await relayer.decrypt(encryptedValue, contractAddress);
    return decryptedValue;
  } catch (error) {
    console.error('解密失败:', error);
    throw new Error('解密数值失败: ' + error.message);
  }
}

/**
 * 重新加密数值（用于查询链上加密数据）
 */
export async function reencryptValue(encryptedValue, publicKey) {
  const relayer = await initFhevm();
  
  try {
    // 使用 Relayer SDK 重新加密
    const reencryptedValue = await relayer.reencrypt(encryptedValue, publicKey);
    return reencryptedValue;
  } catch (error) {
    console.error('重新加密失败:', error);
    throw new Error('重新加密数值失败: ' + error.message);
  }
}

/**
 * 使用用户密钥对解密密文句柄
 * @param {string} ciphertextHandle - 密文句柄（bytes32 格式）
 * @param {string} contractAddress - 合约地址
 * @param {object} signer - ethers.js signer 对象
 * @returns {Promise<number>} 解密后的值
 */
export async function userDecrypt(ciphertextHandle, contractAddress, signer) {
  try {
    console.log('🔓 userDecrypt 开始');
    console.log('  - 密文句柄:', ciphertextHandle);
    console.log('  - 合约地址:', contractAddress);
    console.log('  - 签名者地址:', await signer.getAddress());
    
    // 获取 FHE 实例
    const instance = await initFhevm();
    
    // 生成密钥对
    console.log('  - 生成密钥对...');
    const keypair = instance.generateKeypair();
    console.log('    ✅ 密钥对生成成功');
    
    // 准备解密请求参数
    const handleContractPairs = [
      {
        handle: ciphertextHandle,
        contractAddress: contractAddress,
      },
    ];
    
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = '10'; // 10天有效期
    const contractAddresses = [contractAddress];
    
    console.log('  - 创建 EIP-712 签名消息...');
    const eip712 = instance.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays,
    );
    
    console.log('  - 请求用户签名...');
    const signature = await signer.signTypedData(
      eip712.domain,
      {
        UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
      },
      eip712.message,
    );
    console.log('    ✅ 签名成功');
    
    console.log('  - 调用 userDecrypt...');
    const result = await instance.userDecrypt(
      handleContractPairs,
      keypair.privateKey,
      keypair.publicKey,
      signature.replace('0x', ''),
      contractAddresses,
      await signer.getAddress(),
      startTimeStamp,
      durationDays,
    );
    
    const decryptedValue = result[ciphertextHandle];
    console.log('  ✅ 解密成功! 值:', decryptedValue);
    
    return decryptedValue;
  } catch (error) {
    console.error('❌ userDecrypt 失败:', error);
    throw new Error('用户解密失败: ' + error.message);
  }
}

/**
 * 创建调查
 */
export async function createSurvey(title, description, signer) {
  const contract = await getContractInstance(signer);
  
  try {
    const tx = await contract.createSurvey(title, description);
    const receipt = await tx.wait();
    
    // 从事件中获取调查ID
    const event = receipt.logs.find(
      log => log.fragment && log.fragment.name === 'SurveyCreated'
    );
    
    return event ? event.args.surveyId : null;
  } catch (error) {
    console.error('创建调查失败:', error);
    throw new Error('创建调查失败: ' + error.message);
  }
}

/**
 * 添加问题
 */
export async function addQuestion(surveyId, questionText, questionType, signer) {
  const contract = await getContractInstance(signer);
  
  try {
    const tx = await contract.addQuestion(surveyId, questionText, questionType);
    await tx.wait();
    return true;
  } catch (error) {
    console.error('添加问题失败:', error);
    throw new Error('添加问题失败: ' + error.message);
  }
}

/**
 * 提交答案（加密）
 */
export async function submitAnswer(surveyId, questionId, answer, signer) {
  const contract = await getContractInstance(signer);
  
  try {
    // 加密答案
    const encryptedAnswer = await encryptValue(answer);
    
    const tx = await contract.submitAnswer(surveyId, questionId, encryptedAnswer);
    await tx.wait();
    return true;
  } catch (error) {
    console.error('提交答案失败:', error);
    throw new Error('提交答案失败: ' + error.message);
  }
}

/**
 * 获取调查列表
 */
export async function getSurveys(contract) {
  try {
    const surveyCount = await contract.surveyCount();
    const surveys = [];
    
    for (let i = 1; i <= surveyCount; i++) {
      const survey = await contract.surveys(i);
      surveys.push({
        id: i,
        title: survey.title,
        description: survey.description,
        creator: survey.creator,
        isActive: survey.isActive,
        createdAt: new Date(Number(survey.createdAt) * 1000),
      });
    }
    
    return surveys;
  } catch (error) {
    console.error('获取调查列表失败:', error);
    throw new Error('获取调查列表失败: ' + error.message);
  }
}

/**
 * 获取问题列表
 */
export async function getQuestions(surveyId, contract) {
  try {
    const questionCount = await contract.getQuestionCount(surveyId);
    const questions = [];
    
    for (let i = 0; i < questionCount; i++) {
      const question = await contract.getQuestion(surveyId, i);
      questions.push({
        id: i,
        text: question.text,
        questionType: question.questionType,
      });
    }
    
    return questions;
  } catch (error) {
    console.error('获取问题列表失败:', error);
    throw new Error('获取问题列表失败: ' + error.message);
  }
}

/**
 * 获取加密的统计结果
 */
export async function getEncryptedResults(surveyId, questionId, contract) {
  try {
    const result = await contract.getQuestionResults(surveyId, questionId);
    return result;
  } catch (error) {
    console.error('获取加密结果失败:', error);
    throw new Error('获取加密结果失败: ' + error.message);
  }
}

