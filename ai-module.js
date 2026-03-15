// AI 相关功能模块

// AI 缓存配置
const AI_CACHE_CONFIG = {
  maxSize: 1000, // 最大缓存条目数
  expiryTime: 7 * 24 * 60 * 60 * 1000, // 缓存过期时间（7天）
};

// AI 调用配置
const AI_CALL_CONFIG = {
  maxRetries: 3, // 最大重试次数
  retryDelay: 1000, // 重试延迟（ms）
  batchSize: 20, // 批量处理大小
};

// 加载 AI 配置
function getAiConfig() {
  return {
    provider:    localStorage.getItem(STORAGE_KEY.AI_PROVIDER)     || 'claude',
    model:       localStorage.getItem(STORAGE_KEY.AI_MODEL)        || 'claude-haiku-4-5-20251001',
    proxy:       (localStorage.getItem(STORAGE_KEY.AI_PROXY)       || '').replace(/\/+$/, ''),
    key:         localStorage.getItem(STORAGE_KEY.AI_KEY)          || '',
    modelPolicy: localStorage.getItem(STORAGE_KEY.AI_MODEL_POLICY) || 'auto',
    maxTokens:   parseInt(localStorage.getItem(STORAGE_KEY.AI_MAX_TOKENS)) || 2000};
}

// 保存 AI 配置
function saveAiProxy(v)       { try { localStorage.setItem(STORAGE_KEY.AI_PROXY, v.trim()); } catch(e) {} }
function saveAiKey(v)         { try { localStorage.setItem(STORAGE_KEY.AI_KEY, v.trim()); } catch(e) {} }
function saveAiModel(v)       { try { localStorage.setItem(STORAGE_KEY.AI_MODEL, v); } catch(e) {} }
function saveAiProvider(v)    { try { localStorage.setItem(STORAGE_KEY.AI_PROVIDER, v); } catch(e) {} }
function saveModelPolicy(v)   { try { localStorage.setItem(STORAGE_KEY.AI_MODEL_POLICY, v); } catch(e) {} }
function saveAiMaxTokens(v)   { try { localStorage.setItem(STORAGE_KEY.AI_MAX_TOKENS, parseInt(v) || 2000); } catch(e) {} }

// AI 分类缓存
let aiClassificationCache = {};

// 会话级文件分类缓存
const fileClassifyCache = new Map();

// 加载 AI 分类缓存
function loadAiClassificationCache() {
  try {
    const cached = localStorage.getItem(AI_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const now = Date.now();
      // 清理过期缓存
      aiClassificationCache = {};
      Object.entries(parsed).forEach(([key, value]) => {
        if (value.timestamp && (now - value.timestamp) < AI_CACHE_CONFIG.expiryTime) {
          aiClassificationCache[key] = value.data;
        }
      });
      // 保存清理后的缓存
      if (Object.keys(aiClassificationCache).length < Object.keys(parsed).length) {
        saveAiClassificationCache();
      }
    }
  } catch (error) {
    if (DEBUG) console.error('加载 AI 分类缓存失败：', error);
    aiClassificationCache = {};
  }
}

// 保存 AI 分类缓存
function saveAiClassificationCache() {
  try {
    // 限制缓存大小
    const entries = Object.entries(aiClassificationCache);
    if (entries.length > AI_CACHE_CONFIG.maxSize) {
      // 保留最新的缓存条目
      const sorted = entries.sort((a, b) => {
        const timeA = a[1].timestamp || 0;
        const timeB = b[1].timestamp || 0;
        return timeB - timeA;
      });
      const trimmed = sorted.slice(0, AI_CACHE_CONFIG.maxSize);
      const newCache = {};
      trimmed.forEach(([key, value]) => {
        newCache[key] = value;
      });
      aiClassificationCache = newCache;
    }
    
    // 保存到本地存储
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(aiClassificationCache));
  } catch (error) {
    if (DEBUG) console.error('保存 AI 分类缓存失败：', error);
  }
}

// 清理 AI 分类缓存
function clearAiClassificationCache() {
  aiClassificationCache = {};
  try {
    localStorage.removeItem(AI_CACHE_KEY);
  } catch (error) {
    if (DEBUG) console.error('清理 AI 分类缓存失败：', error);
  }
}

// 防抖处理的 AI 分类函数
const debouncedClassifyFileNames = debounce(async function(names) {
  if (!names.length) return {};
  const TAG_MAP = {
    '合同':     { label:'合同',   cls:'tag-contract',  cat:'合同'     },
    '技术协议': { label:'技术协议',cls:'tag-agreement', cat:'技术协议' },
    '报价':     { label:'报价单', cls:'tag-quote',      cat:'报价'     },
    '发票':     { label:'发票',   cls:'tag-invoice',    cat:'发票'     },
    '其他':     { label:'其他',   cls:'tag-other',      cat:'其他'     }};

  // 关键词规则预匹配（优先于AI）
  const KEYWORD_RULES = [
    { keywords: ['合同','采购合同','销售合同','框架协议','购销合同'], cat: '合同' },
    { keywords: ['技术协议','技术方案','需求文档','技术规范','技术要求','规格书'], cat: '技术协议' },
    { keywords: ['报价','询价','报价单','报价表'], cat: '报价' },
    { keywords: ['发票','收据','收款'], cat: '发票' },
  ];

  const result = {};
  const needAi = [];

  for (const name of names) {
    // 1. 优先从缓存中获取
    if (aiClassificationCache[name]) {
      result[name] = aiClassificationCache[name].data || aiClassificationCache[name];
      continue;
    }

    // 2. 关键词规则预匹配
    let matched = false;
    for (const rule of KEYWORD_RULES) {
      if (rule.keywords.some(kw => name.includes(kw))) {
        result[name] = TAG_MAP[rule.cat];
        // 缓存结果（带时间戳）
        aiClassificationCache[name] = {
          data: TAG_MAP[rule.cat],
          timestamp: Date.now()
        };
        matched = true;
        break;
      }
    }
    if (!matched) needAi.push(name);
  }

  // 3. 剩余文件交给 AI 判断（批量处理）
  if (needAi.length) {
    // 分批处理文件
    const batches = [];
    for (let i = 0; i < needAi.length; i += AI_CALL_CONFIG.batchSize) {
      batches.push(needAi.slice(i, i + AI_CALL_CONFIG.batchSize));
    }
    
    for (const batch of batches) {
      try {
        // 带重试机制的 AI 调用
        let data;
        for (let retry = 0; retry < AI_CALL_CONFIG.maxRetries; retry++) {
          try {
            data = await claudeCall({
              task: '文件名分类',
              max_tokens: 600,
              messages: [{ role: 'user', content: `以下是项目文件夹中的文件名列表：\n${JSON.stringify(batch)}\n\n请判断每个文件名属于哪个类别，只能从以下类别中选择：\n- 合同（正式合同、框架协议等）\n- 技术协议（技术协议、技术方案、需求文档等）\n- 报价（报价单、询价单等）\n- 发票（发票、收据等）\n- 其他\n\n只返回JSON对象，key是文件名，value是类别。` }]
            });
            break; // 成功，退出重试循环
          } catch (e) {
            if (DEBUG) console.error(`AI 分类失败（重试 ${retry + 1}/${AI_CALL_CONFIG.maxRetries}）：`, e);
            if (retry < AI_CALL_CONFIG.maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, AI_CALL_CONFIG.retryDelay));
            }
          }
        }
        
        if (data) {
          const text = data._parsed?.text || data.content?.[0]?.text || '';
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            const raw = JSON.parse(match[0]);
            for (const [name, cat] of Object.entries(raw)) {
              result[name] = TAG_MAP[cat] || TAG_MAP['其他'];
              // 缓存结果（带时间戳）
              aiClassificationCache[name] = {
                data: TAG_MAP[cat] || TAG_MAP['其他'],
                timestamp: Date.now()
              };
            }
          }
        }
      } catch(e) {
        if (DEBUG) console.error('AI 分类失败：', e);
      }
    }
    
    // AI 未返回的文件标为其他
    for (const name of needAi) {
      if (!result[name]) {
        result[name] = TAG_MAP['其他'];
        // 缓存结果（带时间戳）
        aiClassificationCache[name] = {
          data: TAG_MAP['其他'],
          timestamp: Date.now()
        };
      }
    }
    
    // 保存缓存
    saveAiClassificationCache();
  }

  return result;
}, 500); // 500ms 防抖

// 导出的分类函数
async function classifyFileNames(names) {
  // 首先从会话级缓存中获取结果
  const cachedResults = {};
  const uncachedNames = [];
  
  for (const name of names) {
    if (fileClassifyCache.has(name)) {
      cachedResults[name] = fileClassifyCache.get(name);
    } else {
      uncachedNames.push(name);
    }
  }
  
  // 只对未缓存的文件名进行处理
  if (uncachedNames.length > 0) {
    // 确保持久化缓存已加载
    if (Object.keys(aiClassificationCache).length === 0) {
      loadAiClassificationCache();
    }
    
    // 调用防抖的分类函数处理未缓存的文件名
    const newResults = await debouncedClassifyFileNames(uncachedNames);
    
    // 将新结果写入会话级缓存
    for (const [name, result] of Object.entries(newResults)) {
      fileClassifyCache.set(name, result);
    }
    
    // 合并缓存结果和新结果
    return { ...cachedResults, ...newResults };
  }
  
  // 所有结果都在缓存中
  return cachedResults;
}

// 导出模块
export {
  getAiConfig,
  saveAiProxy,
  saveAiKey,
  saveAiModel,
  saveAiProvider,
  saveModelPolicy,
  saveAiMaxTokens,
  classifyFileNames,
  clearAiClassificationCache
};
