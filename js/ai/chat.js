// ╔══════════════════════════════════════════════════════════════╗
// ║  ai-chat.js — 智能数据分析对话面板                            ║
// ║  依赖：ai-module.js (claudeCallWithTools - 统一AI调用出口)    ║
// ║        Chart.js (从 CDN 动态加载)                            ║
// ╚══════════════════════════════════════════════════════════════╝

// ── 状态 ────────────────────────────────────────────────────────
let _chatHistory   = [];   // { role, content } 对话历史
let _chatBusy      = false; // 是否正在等待响应
let _chartInstances = {};   // chartId → Chart 实例（防重复创建）

// ── 获取 AI Provider 配置（多层 fallback）────────────────────────
function _resolveEntry() {
  // 1. 优先通过任务槽位系统获取
  if (typeof window.getProviderForTask === 'function') {
    const entry = window.getProviderForTask('台账AI筛选')
                || window.getProviderForTask('对话测试');
    if (entry) return entry;
  }
  // 2. fallback：直接读 providerList[0]
  if (typeof window.getProviderList === 'function') {
    const list = window.getProviderList();
    if (list && list.length) return list[0];
  }
  // 3. 终极 fallback：从旧版配置构建 entry
  if (typeof window.getAiConfig === 'function') {
    const cfg = window.getAiConfig();
    if (cfg && (cfg.key || cfg.proxy)) {
      return {
        id: '_legacy', name: '默认配置',
        type: cfg.provider || 'claude',
        proxy: cfg.proxy || '',
        key: cfg.key || '',
        model: cfg.model || '',
        maxTokens: cfg.maxTokens || 2000
      };
    }
  }
  return null;
}

// ── Tool 定义 ────────────────────────────────────────────────────
// 两阶段设计：
//   1. get_project_index  → AI 拿到轻量索引，自己判断需要哪些项目
//   2. get_project_detail → AI 按需取指定项目的完整数据
//   3. render_*           → AI 分析完后调用前端渲染
const CHAT_TOOLS = [
  {
    name: 'get_project_index',
    description: '获取所有项目的轻量索引（每个项目只含关键字段）。这是分析的第一步，用于了解有哪些项目、快速过滤出目标 id，然后再用 get_project_detail 取完整数据。',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_project_detail',
    description: '按 id 批量获取指定项目的完整数据，包含回款节点、催款任务、更新日志等详细字段。请先调用 get_project_index 确定需要哪些项目，再用此工具精准取数。',
    input_schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'string' },
          description: '需要查询的项目 id 数组，从 get_project_index 的结果中选取'
        }
      },
      required: ['ids']
    }
  },
  {
    name: 'render_chart',
    description: '将分析结果渲染为图表。在你完成数据分析、算好数据后调用。',
    input_schema: {
      type: 'object',
      properties: {
        chart_type: {
          type: 'string',
          enum: ['bar', 'pie', 'doughnut', 'line', 'table'],
          description: '图表类型'
        },
        title: { type: 'string', description: '图表标题' },
        labels: { type: 'array', items: { type: 'string' } },
        datasets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              data:  { type: 'array', items: { type: 'number' } }
            }
          }
        },
        table_columns: { type: 'array', items: { type: 'string' } },
        table_rows:    { type: 'array' }
      },
      required: ['chart_type', 'title']
    }
  },
  {
    name: 'render_project_list',
    description: '将项目渲染为可点击的卡片列表。在你筛选出目标项目后调用。',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '列表标题，如"近7天有更新的项目（5个）"' },
        projects: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:        { type: 'string' },
              name:      { type: 'string' },
              stage_num: { type: 'number', description: '0=洽谈中 1=交付中 2=已完结 3=已终止' },
              owner:     { type: 'string' },
              contract:  { type: 'number' },
              note:      { type: 'string', description: '补充说明，如更新时间、金额、状态等' }
            },
            required: ['id', 'name']
          }
        }
      },
      required: ['projects']
    }
  }
];

// ── Tool 执行器 ──────────────────────────────────────────────────
function _execTool(name, input) {
  const STAGE_LABELS = ['洽谈中', '交付中', '已完结', '已终止'];
  const ps = window.projects || [];

  if (name === 'get_project_index') {
    // 只返回关键字段，供 AI 快速过滤
    return {
      total: ps.length,
      available_fields: [
        'id','name','source','channel','owner','product','desc',
        'stage','active','quote','contract','collected','cost',
        'contractDate','projectCode','deliveryBrief','deliveryNote',
        'terminationReason','paymentNodes','collectTasks','todos',
        'logs','createdAt','updatedAt'
      ],
      projects: ps.map(p => ({
        id:         String(p.id),
        name:       p.name        || '',
        customer:   p.customer || p.source || '',  // 兼容旧数据
        owner:      p.owner       || '',
        stage:      p.stage,
        stage_label:STAGE_LABELS[p.stage] || '未知',
        active:     p.active      || 'active',
        contract:   parseFloat(p.contract)  || 0,
        collected:  parseFloat(p.collected) || 0,
        quote:      parseFloat(p.quote)     || 0,
        updatedAt:  p.updatedAt   || '',
        createdAt:  p.createdAt   || '',
        contractDate: p.contractDate || ''
      }))
    };
  }

  if (name === 'get_project_detail') {
    const ids = (input.ids || []).map(String);
    const targets = ps.filter(p => ids.includes(String(p.id)));
    return targets.map(p => ({
      ...p,
      id: String(p.id),
      stage_label: STAGE_LABELS[p.stage] || '未知',
      // logs 只取最近15条，避免过长
      logs: (p.logs || []).slice(0, 15)
    }));
  }

  // render_* 由前端处理
  if (name === 'render_chart' || name === 'render_project_list') {
    return { rendered: true };
  }

  return { error: `未知工具: ${name}` };
}

// ── Chart.js 加载 ────────────────────────────────────────────────
let _chartJsReady = false;
async function _ensureChartJs() {
  if (_chartJsReady || window.Chart) { _chartJsReady = true; return; }
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload  = () => { _chartJsReady = true; resolve(); };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ── 渲染图表 ────────────────────────────────────────────────────
const CHART_PALETTE = [
  'rgba(123,31,162,0.85)', 'rgba(30,136,229,0.85)', 'rgba(0,150,136,0.85)',
  'rgba(230,81,0,0.85)',   'rgba(194,24,91,0.85)',  'rgba(46,125,50,0.85)',
  'rgba(106,27,154,0.7)',  'rgba(21,101,192,0.7)',  'rgba(0,121,107,0.7)',
];

async function _renderChart(input, container) {
  await _ensureChartJs();
  const { chart_type, title, labels, datasets, table_columns, table_rows } = input;
  const wrap = document.createElement('div');
  wrap.className = 'acp-chart-wrap';

  const titleEl = document.createElement('div');
  titleEl.className = 'acp-chart-title';
  titleEl.textContent = title;
  wrap.appendChild(titleEl);

  if (chart_type === 'table') {
    const table = document.createElement('table');
    table.className = 'acp-table';
    if (table_columns?.length) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      table_columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }
    if (table_rows?.length) {
      const tbody = document.createElement('tbody');
      table_rows.forEach(row => {
        const tr = document.createElement('tr');
        (Array.isArray(row) ? row : Object.values(row)).forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell ?? '—';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
    }
    wrap.appendChild(table);
    container.appendChild(wrap);
    return;
  }

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'acp-chart-canvas-wrap';
  const canvas = document.createElement('canvas');
  const chartId = 'chart_' + Date.now();
  canvas.id = chartId;
  const isPie = chart_type === 'pie' || chart_type === 'doughnut';
  canvas.style.maxHeight = isPie ? '200px' : '180px';
  canvasWrap.appendChild(canvas);
  wrap.appendChild(canvasWrap);
  container.appendChild(wrap);

  // 销毁旧实例
  if (_chartInstances[chartId]) { _chartInstances[chartId].destroy(); }

  const chartDatasets = (datasets || []).map((ds, i) => ({
    label: ds.label || '',
    data:  ds.data  || [],
    backgroundColor: isPie
      ? (ds.data||[]).map((_,j) => CHART_PALETTE[j % CHART_PALETTE.length])
      : CHART_PALETTE[i % CHART_PALETTE.length],
    borderColor: isPie ? 'rgba(26,5,51,0.6)' : CHART_PALETTE[i % CHART_PALETTE.length].replace('0.85','1'),
    borderWidth: isPie ? 2 : 1.5,
    borderRadius: chart_type === 'bar' ? 4 : 0,
    tension: 0.35,
    fill: chart_type === 'line' ? 'origin' : false,
  }));

  _chartInstances[chartId] = new Chart(canvas, {
    type: chart_type === 'doughnut' ? 'doughnut' : chart_type,
    data: { labels: labels || [], datasets: chartDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 400 },
      plugins: {
        legend: {
          display: isPie,
          position: 'bottom',
          labels: { color: 'rgba(206,147,216,0.7)', font: { size: 10 }, padding: 8, boxWidth: 10 }
        },
        tooltip: {
          backgroundColor: 'rgba(26,5,51,0.92)',
          titleColor: '#f0e6ff',
          bodyColor: 'rgba(206,147,216,0.85)',
          borderColor: 'rgba(123,31,162,0.3)',
          borderWidth: 1,
          callbacks: {
            label: ctx => {
              const v = ctx.parsed.y ?? ctx.parsed;
              return typeof v === 'number' ? ` ${v.toFixed(2)}` : ` ${v}`;
            }
          }
        }
      },
      scales: isPie ? {} : {
        x: {
          ticks: { color: 'rgba(206,147,216,0.55)', font: { size: 9 } },
          grid:  { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          ticks: { color: 'rgba(206,147,216,0.55)', font: { size: 9 } },
          grid:  { color: 'rgba(255,255,255,0.06)' },
          beginAtZero: true
        }
      }
    }
  });
}

// ── 渲染项目列表 ─────────────────────────────────────────────────
function _renderProjectList(projects, container) {
  if (!projects?.length) return;
  const STAGE_COLORS = ['var(--s0)','var(--s1)','var(--s2)','#999'];
  const list = document.createElement('div');
  list.className = 'acp-project-list';
  projects.slice(0, 12).forEach(p => {
    const item = document.createElement('div');
    item.className = 'acp-project-item';
    item.innerHTML = `
      <span class="acp-project-stage-dot" style="background:${STAGE_COLORS[p.stage_num]??'#999'}"></span>
      <span class="acp-project-name">${p.name}</span>
      <span class="acp-project-meta">${p.owner !== '—' ? p.owner : ''} ${p.contract ? p.contract+'万' : ''}</span>
    `;
    item.onclick = () => { if (window.editProject) window.editProject(p.id); };
    list.appendChild(item);
  });
  container.appendChild(list);
}

// ── DOM 工具 ────────────────────────────────────────────────────
function _getMessages()   { return document.getElementById('acp-messages'); }
function _getInput()      { return document.getElementById('acp-input'); }
function _getSendBtn()    { return document.getElementById('acp-send-btn'); }

function _scrollBottom() {
  const el = _getMessages();
  if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 30);
}

function _appendMsg(role, htmlOrEl) {
  const msgs = _getMessages();
  if (!msgs) return null;
  // 移除空状态
  const empty = msgs.querySelector('.acp-empty');
  if (empty) empty.remove();

  const row = document.createElement('div');
  row.className = `acp-msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'acp-avatar';
  avatar.textContent = role === 'ai' ? '✦' : '你';

  const bubble = document.createElement('div');
  bubble.className = 'acp-bubble';

  if (typeof htmlOrEl === 'string') {
    bubble.innerHTML = htmlOrEl;
  } else if (htmlOrEl instanceof HTMLElement) {
    bubble.appendChild(htmlOrEl);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  msgs.appendChild(row);
  _scrollBottom();
  return bubble;
}

function _appendToolStatus(text) {
  const msgs = _getMessages();
  if (!msgs) return null;
  const el = document.createElement('div');
  el.style.paddingLeft = '34px';
  const inner = document.createElement('div');
  inner.className = 'acp-tool-status';
  inner.innerHTML = `<span class="acp-tool-dot"></span><span>${text}</span>`;
  el.appendChild(inner);
  msgs.appendChild(el);
  _scrollBottom();
  return el;
}

function _appendThinking() {
  const msgs = _getMessages();
  if (!msgs) return null;
  const row = document.createElement('div');
  row.className = 'acp-msg ai';
  row.id = 'acp-thinking';
  row.innerHTML = `
    <div class="acp-avatar">✦</div>
    <div class="acp-bubble">
      <div class="acp-thinking"><span></span><span></span><span></span></div>
    </div>`;
  msgs.appendChild(row);
  _scrollBottom();
  return row;
}

function _removeThinking() {
  const el = document.getElementById('acp-thinking');
  if (el) el.remove();
}

// ── 核心：Tool Use 多轮循环 ──────────────────────────────────────
async function _runChat(userText) {
  if (_chatBusy) return;
  _chatBusy = true;
  const sendBtn = _getSendBtn();
  if (sendBtn) sendBtn.disabled = true;

  // 追加用户消息到历史 & UI
  _chatHistory.push({ role: 'user', content: userText });
  _appendMsg('user', _escHtml(userText));

  // 构造系统提示（注入项目摘要供AI理解上下文）
  const ps = window.projects || [];
  const STAGE_LABELS = ['洽谈中','交付中','已完结','已终止'];
  const overview = {
    total: ps.length,
    stages: [0,1,2,3].map(s => ({ stage: STAGE_LABELS[s], count: ps.filter(p=>p.stage===s).length })),
    owners: [...new Set(ps.map(p=>p.owner).filter(Boolean))].slice(0,10),
    customers: [...new Set(ps.map(p=>p.customer || p.source).filter(Boolean))].slice(0,10)  // 兼容旧数据
  };
  const systemPrompt = `你是一个项目管理数据分析助手，擅长从数据中发现洞察。

【工作流程 - 请严格遵守】
第一步：调用 get_project_index，获取所有项目的轻量索引
第二步：在索引数据中自行筛选出目标项目的 id（这一步你自己做，不需要调工具）
第三步：调用 get_project_detail(ids) 获取目标项目的完整数据（如需要详细字段）
第四步：完成分析后，调用 render_chart 或 render_project_list 展示结果
第五步：用简洁的文字给出结论和洞察

【字段说明】
- stage: 0=洽谈中, 1=交付中, 2=已完结, 3=已终止
- active: active=活跃, inactive=不活跃
- contract/quote/collected: 单位万元
- updatedAt/createdAt/contractDate: 日期字符串
- paymentNodes: 回款节点数组（含 amount、done、dueDate 等）
- logs: 更新日志数组（含 time、content）
- collectTasks: 催款任务数组

【当前概况】共 ${ps.length} 个项目：洽谈中 ${overview.stages[0].count} 个，交付中 ${overview.stages[1].count} 个，已完结 ${overview.stages[2].count} 个，已终止 ${overview.stages[3].count} 个

回答使用中文，语言简洁，结论明确。`;

  // 构建API消息（多轮历史）
  let apiMessages = [..._chatHistory];

  const thinkEl = _appendThinking();

  try {
    // 多轮 Tool Use 循环（最多5轮防死循环）
    for (let round = 0; round < 5; round++) {
      // 检查 AI 配置是否可用（claudeCallWithTools 会再次检查，这里提前检查给出更好的错误提示）
      const entry = _resolveEntry();
      if (!entry) throw new Error('未找到 AI 配置，请先在右上角「⚙ AI 设置」中配置模型');
      if (!entry.key && !entry.proxy) throw new Error(`AI 配置「${entry.name || '默认'}」缺少 API Key 或代理地址，请在设置中完善`);

      // 调用 API（使用统一出口 claudeCallWithTools，支持日志记录）
      if (typeof window.claudeCallWithTools !== 'function') {
        throw new Error('AI 模块尚未完全加载，请稍后再试');
      }
      const response = await window.claudeCallWithTools({ 
        task: 'AI数据分析', 
        max_tokens: 4000, 
        messages: apiMessages, 
        systemPrompt, 
        tools: CHAT_TOOLS 
      });
      
      // 解析响应
      const result = response._parsed;

      _removeThinking();

      // 解析响应
      const stopReason = result.stop_reason || result.finish_reason;
      const content    = result.content || [];

      // 收集本轮文本和工具调用
      const textBlocks = content.filter(b => b.type === 'text');
      const toolBlocks = content.filter(b => b.type === 'tool_use');

      // 如果有文本先显示
      if (textBlocks.length) {
        const txt = textBlocks.map(b => b.text).join('');
        if (txt.trim()) {
          _appendMsg('ai', _formatText(txt));
          _chatHistory.push({ role: 'assistant', content: txt });
        }
      }

      // 没有工具调用 → 对话结束
      if (!toolBlocks.length || stopReason === 'end_turn') break;

      // 把 AI 的完整响应加入历史（工具调用格式）
      apiMessages.push({ role: 'assistant', content: content });

      // 执行工具并收集结果
      const toolResults = [];
      for (const tb of toolBlocks) {
        const statusEl = _appendToolStatus(`正在调用 ${_toolLabel(tb.name)}…`);

        let toolOutput;
        if (tb.name === 'render_chart') {
          // 直接渲染图表，返回简单确认给 AI
          const bubble = _appendMsg('ai', '');
          if (bubble) await _renderChart(tb.input, bubble);
          toolOutput = { rendered: true };
        } else if (tb.name === 'render_project_list') {
          // 直接渲染项目列表，返回简单确认给 AI
          const title  = tb.input.title || '';
          const bubble = _appendMsg('ai', title ? `<strong>${_escHtml(title)}</strong>` : '');
          if (bubble) _renderProjectList(tb.input.projects || [], bubble);
          toolOutput = { rendered: true, count: (tb.input.projects || []).length };
        } else {
          // 数据类工具（get_project_index / get_project_detail）：执行并把结果喂回给 AI
          toolOutput = _execTool(tb.name, tb.input);
        }

        if (statusEl) statusEl.remove();

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tb.id,
          content: JSON.stringify(toolOutput)
        });
      }

      // 工具结果加入消息历史
      apiMessages.push({ role: 'user', content: toolResults });

      // 继续下一轮
      _appendThinking();
    }
    _removeThinking();

  } catch (e) {
    _removeThinking();
    _appendMsg('ai', `<span class="acp-error">❌ ${_escHtml(e.message)}</span>`);
  }

  _chatBusy = false;
  if (sendBtn) sendBtn.disabled = false;
  const inp = _getInput();
  if (inp) inp.focus();
}

// ── UI 初始化 ────────────────────────────────────────────────────
function initAiChat() {
  if (document.getElementById('ai-chat-panel')) return; // 防重复

  // 注入 CSS
  if (!document.querySelector('link[href*="ai-chat.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './css/ai-chat.css';
    document.head.appendChild(link);
  }

  // 触发按钮
  const trigger = document.createElement('button');
  trigger.id = 'ai-chat-trigger';
  trigger.title = '智能数据分析';
  trigger.innerHTML = '✦';
  trigger.onclick = toggleAiChat;
  document.body.appendChild(trigger);

  // 快捷提示
  const SUGGESTIONS = [
    '各阶段项目数量',
    '合同金额分布',
    '超60天未更新的项目',
    '各负责人业绩对比',
    '回款率概览',
  ];

  // 面板
  const panel = document.createElement('div');
  panel.id = 'ai-chat-panel';
  panel.innerHTML = `
    <div class="acp-header">
      <div class="acp-header-icon">✦</div>
      <div class="acp-header-text">
        <div class="acp-header-title">数据分析助手</div>
        <div class="acp-header-sub">用自然语言分析你的项目数据</div>
      </div>
      <button class="acp-clear-btn" onclick="clearAiChat()" title="清空对话">清空</button>
    </div>
    <div class="acp-suggestions">
      ${SUGGESTIONS.map(s => `<span class="acp-suggestion-chip" onclick="acpSuggest('${s}')">${s}</span>`).join('')}
    </div>
    <div class="acp-messages" id="acp-messages">
      <div class="acp-empty">
        <div class="acp-empty-icon">✦</div>
        <div class="acp-empty-text">用自然语言问我任何关于<br>你的项目数据的问题</div>
      </div>
    </div>
    <div class="acp-input-area">
      <div class="acp-input-row">
        <textarea class="acp-textarea" id="acp-input" placeholder="例：各阶段项目数量是多少？" rows="1"></textarea>
        <button class="acp-send-btn" id="acp-send-btn" onclick="acpSend()">➤</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // 回车发送（Shift+Enter 换行）
  const textarea = document.getElementById('acp-input');
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); acpSend(); }
  });
  // 自动高度
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  });
}

// ── 公开函数 ────────────────────────────────────────────────────
function toggleAiChat() {
  const panel   = document.getElementById('ai-chat-panel');
  const trigger = document.getElementById('ai-chat-trigger');
  if (!panel) return;
  const open = panel.classList.toggle('open');
  trigger.classList.toggle('panel-open', open);
  if (open) document.getElementById('acp-input')?.focus();
}

function clearAiChat() {
  _chatHistory = [];
  const msgs = _getMessages();
  if (msgs) {
    msgs.innerHTML = `
      <div class="acp-empty">
        <div class="acp-empty-icon">✦</div>
        <div class="acp-empty-text">用自然语言问我任何关于<br>你的项目数据的问题</div>
      </div>`;
  }
}

function acpSuggest(text) {
  const inp = _getInput();
  if (inp) { inp.value = text; inp.focus(); }
}

function acpSend() {
  const inp = _getInput();
  if (!inp) return;
  const text = inp.value.trim();
  if (!text || _chatBusy) return;
  inp.value = '';
  inp.style.height = 'auto';
  _runChat(text);
}

// ── 工具标签 ────────────────────────────────────────────────────
function _toolLabel(name) {
  return { get_project_index: '读取项目索引', get_project_detail: '读取项目详情', render_chart: '渲染图表', render_project_list: '渲染项目列表' }[name] || name;
}

// ── 文本工具 ────────────────────────────────────────────────────
function _escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _formatText(text) {
  // 简单 markdown：加粗、换行
  return _escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

export { initAiChat, toggleAiChat, clearAiChat, acpSuggest, acpSend };
