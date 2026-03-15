// AI 相关功能模块

// AI 缓存配置
const AI_CACHE_CONFIG = {
  maxSize: 1000, // 最大缓存条目数
  expiryTime: 7 * 24 * 60 * 60 * 1000, // 缓存过期时间（7天）
};

// 在这里加上：
const AI_CACHE_KEY = 'ai_file_classify_cache';

// AI 调用配置
const AI_CALL_CONFIG = {
  maxRetries: 3, // 最大重试次数
  retryDelay: 1000, // 重试延迟（ms）
  batchSize: 20, // 批量处理大小
};

// 加载 AI 配置
function getAiConfig() {
  return {
    provider:    localStorage.getItem(window.STORAGE_KEY.AI_PROVIDER)     || 'claude',
    model:       localStorage.getItem(window.STORAGE_KEY.AI_MODEL)        || 'claude-haiku-4-5-20251001',
    proxy:       (localStorage.getItem(window.STORAGE_KEY.AI_PROXY)       || '').replace(/\/+$/, ''),
    key:         localStorage.getItem(window.STORAGE_KEY.AI_KEY)          || '',
    modelPolicy: localStorage.getItem(window.STORAGE_KEY.AI_MODEL_POLICY) || 'auto',
    maxTokens:   parseInt(localStorage.getItem(window.STORAGE_KEY.AI_MAX_TOKENS)) || 2000};
}

// 保存 AI 配置
function saveAiProxy(v)       { try { localStorage.setItem(window.STORAGE_KEY.AI_PROXY, v.trim()); } catch(e) {} }
function saveAiKey(v)         { try { localStorage.setItem(window.STORAGE_KEY.AI_KEY, v.trim()); } catch(e) {} }
function saveAiModel(v)       { try { localStorage.setItem(window.STORAGE_KEY.AI_MODEL, v); } catch(e) {} }
function saveAiProvider(v)    { try { localStorage.setItem(window.STORAGE_KEY.AI_PROVIDER, v); } catch(e) {} }
function saveModelPolicy(v)   { try { localStorage.setItem(window.STORAGE_KEY.AI_MODEL_POLICY, v); } catch(e) {} }
function saveAiMaxTokens(v)   { try { localStorage.setItem(window.STORAGE_KEY.AI_MAX_TOKENS, parseInt(v) || 2000); } catch(e) {} }

// ╔══════════════════════════════════════════╗
// ║  MODULE: ai-service（AI 调用层）          ║
// ╚══════════════════════════════════════════╝

const AI_PROVIDERS = {
  claude: {
    name: 'Claude', icon: '🤖',
    endpoint: (proxy) => proxy ? `${proxy}/claude/v1/messages` : 'https://api.anthropic.com/v1/messages',
    models: [
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5（快速）' },
      { id: 'claude-sonnet-4-20250514',  label: 'Claude Sonnet 4（均衡）' },
      { id: 'claude-opus-4-20250514',    label: 'Claude Opus 4（最强）' },
    ],
    buildHeaders: (key, proxy) => {
      const h = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' };
      if (key) h['x-api-key'] = key;
      if (!proxy) h['anthropic-dangerous-direct-browser-access'] = 'true';
      return h;
    },
    buildBody: (model, max_tokens, messages) => ({ model, max_tokens, messages }),
    parseResponse: (data) => ({
      text:  data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '',
      usage: data.usage,
      error: data.error?.message
    })
  },
  openai: {
    name: 'OpenAI', icon: '✨',
    endpoint: (proxy) => proxy ? `${proxy}/openai/v1/chat/completions` : 'https://api.openai.com/v1/chat/completions',
    models: [
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini（快速）' },
      { id: 'gpt-4o',      label: 'GPT-4o（均衡）' },
      { id: 'o1-mini',     label: 'o1 Mini（推理）' },
    ],
    buildHeaders: (key) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }),
    buildBody: (model, max_tokens, messages) => ({
      model, max_tokens,
      messages: messages.map(m => ({
        role: m.role,
        content: Array.isArray(m.content) ? m.content.map(c => c.text || '').join('') : m.content
      }))
    }),
    parseResponse: (data) => ({
      text:  data.choices?.[0]?.message?.content || '',
      usage: data.usage ? { input_tokens: data.usage.prompt_tokens, output_tokens: data.usage.completion_tokens } : null,
      error: data.error?.message
    })
  },
  gemini: {
    name: 'Gemini', icon: '💎',
    endpoint: (proxy, model, key) => proxy
      ? `${proxy}/gemini/v1beta/models/${model}:generateContent`
      : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    models: [
      { id: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash（快速）' },
      { id: 'gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro（最强）' },
    ],
    buildHeaders: (key, proxy) => {
      const h = { 'Content-Type': 'application/json' };
      if (proxy && key) h['x-goog-api-key'] = key;
      return h;
    },
    buildBody: (model, max_tokens, messages) => ({
      contents: messages.map(m => ({
        role:  m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: Array.isArray(m.content) ? m.content.map(c => c.text || '').join('') : m.content }]
      })),
      generationConfig: { maxOutputTokens: max_tokens }
    }),
    parseResponse: (data) => ({
      text:  data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '',
      usage: data.usageMetadata
        ? { input_tokens: data.usageMetadata.promptTokenCount, output_tokens: data.usageMetadata.candidatesTokenCount }
        : null,
      error: data.error?.message
    })
  },
  custom: {
    name: '自定义', icon: '🔧',
    endpoint: (proxy) => proxy || '',
    models: [{ id: '', label: '请在下方输入模型名称' }],
    buildHeaders: (key) => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` }),
    buildBody: (model, max_tokens, messages) => ({
      model, max_tokens,
      messages: messages.map(m => ({
        role: m.role,
        content: Array.isArray(m.content) ? m.content.map(c => c.text || '').join('') : m.content
      }))
    }),
    parseResponse: (data) => {
      const choice    = data.choices?.[0];
      const content   = choice?.message?.content || '';
      const truncated = choice?.finish_reason === 'length';
      return {
        text:  content,
        usage: data.usage
          ? { input_tokens: data.usage.prompt_tokens || data.usage.input_tokens || 0, output_tokens: data.usage.completion_tokens || data.usage.output_tokens || 0 }
          : null,
        error: data.error?.message || (truncated ? '输出被截断（token 不足），请在模型配置中调大 max_tokens' : undefined)
      };
    }
  }
};

// 快速任务用小模型，复杂任务用高级模型
const TASK_MODEL_OVERRIDE = {
  '合同文本解析': 'advanced',
  '合同PDF解析':  'advanced',
  '语雀文档解析': 'advanced',
  '台账AI筛选':   'advanced'
};

// 自定义服务商的路由前缀（通过 Worker 转发）
const CUSTOM_ROUTE = '/custom';

// AI 调用日志
let aiLogs = [];
try { aiLogs = JSON.parse(localStorage.getItem(window.STORAGE_KEY.AI_LOGS) || '[]'); } catch(e) { aiLogs = []; }

async function claudeCall({ task, model, max_tokens, messages }) {
  const t0  = Date.now();
  const cfg = getAiConfig();
  const provider = AI_PROVIDERS[cfg.provider] || AI_PROVIDERS.claude;

  // 模型策略：fixed=全部用cfg.model；auto=复杂任务升级高级模型
  let usedModel = cfg.model;
  if (cfg.modelPolicy === 'auto' && TASK_MODEL_OVERRIDE[task] === 'advanced' && cfg.provider !== 'custom') {
    usedModel = provider.models[provider.models.length - 1].id;
  }

  const log = { id: Date.now(), time: new Date().toLocaleString(), task, model: usedModel, provider: cfg.provider, in: 0, out: 0, dur: 0, status: 'ok', error: '' };

  let endpoint;
  if (cfg.provider === 'custom') {
    const base = cfg.proxy.replace(/\/+$/, '');
    endpoint = base.endsWith('/chat/completions') ? base : base + '/chat/completions';
  } else {
    endpoint = typeof provider.endpoint === 'function'
      ? provider.endpoint(cfg.proxy, usedModel, cfg.key)
      : provider.endpoint;
  }

  const headers = provider.buildHeaders(cfg.key, cfg.proxy);
  const body    = provider.buildBody(usedModel, max_tokens || cfg.maxTokens, messages);

  try {
    const resp = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const data = await resp.json();
    log.dur = ((Date.now() - t0) / 1000).toFixed(2);
    const parsed = provider.parseResponse(data);
    if (parsed.usage) { log.in = parsed.usage.input_tokens || 0; log.out = parsed.usage.output_tokens || 0; }
    if (!resp.ok || parsed.error) { log.status = 'err'; log.error = parsed.error || `HTTP ${resp.status}`; }
    aiLogs.unshift(log);
    if (aiLogs.length > 200) aiLogs = aiLogs.slice(0, 200);
    try { localStorage.setItem(window.STORAGE_KEY.AI_LOGS, JSON.stringify(aiLogs)); } catch(e) {}
    return { ...data, _parsed: parsed };
  } catch(e) {
    log.dur = ((Date.now() - t0) / 1000).toFixed(2);
    log.status = 'err'; log.error = e.message;
    aiLogs.unshift(log);
    try { localStorage.setItem(window.STORAGE_KEY.AI_LOGS, JSON.stringify(aiLogs)); } catch(e2) {}
    throw e;
  }
}

function clearAiLogs() {
  aiLogs = [];
  try { localStorage.removeItem(window.STORAGE_KEY.AI_LOGS); } catch(e) {}
}

function getAiLogs() {
  return aiLogs;
}

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
  // AI 配置
  getAiConfig,
  saveAiProxy,
  saveAiKey,
  saveAiModel,
  saveAiProvider,
  saveModelPolicy,
  saveAiMaxTokens,
  // AI 服务商
  AI_PROVIDERS,
  TASK_MODEL_OVERRIDE,
  CUSTOM_ROUTE,
  // AI 调用
  claudeCall,
  aiLogs,
  clearAiLogs,
  getAiLogs,
  // 文件分类
  classifyFileNames,
  clearAiClassificationCache
};
