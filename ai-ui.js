// ╔══════════════════════════════════════════╗
// ║  MODULE: ai-ui（AI 界面控制）            ║
// ╚══════════════════════════════════════════╝

// ── AI 监控面板 ───────────────────────────

let chatHistory = [];

// ── 多 Provider 管理 UI ──────────────────

function renderProviderList() {
  const list   = getProviderList();
  const slots  = getTaskSlots();
  const usedIds = new Set(Object.values(slots));
  const container = document.getElementById('ai-provider-list');
  if (!container) return;
  container.innerHTML = list.map(p => {
    const pi = AI_PROVIDERS[p.type] || AI_PROVIDERS.custom;
    const isUsed = usedIds.has(p.id);
    return `
      <div class="ai-prov-item">
        <div class="ai-prov-icon">${pi.icon || '🔧'}</div>
        <div class="ai-prov-info">
          <div class="ai-prov-name">${p.name}</div>
          <div class="ai-prov-meta">${pi.name} · ${p.model || '未设置模型'}${p.supportsVision ? ' · 🖼️' : ''}</div>
        </div>
        <div class="ai-prov-actions">
          ${isUsed ? '<span class="ai-prov-used">使用中</span>' : ''}
          <button class="ai-prov-btn" onclick="editProvider('${p.id}')">编辑</button>
          ${!isUsed && list.length > 1 ? `<button class="ai-prov-btn danger" onclick="deleteProvider('${p.id}')">删除</button>` : ''}
        </div>
      </div>`;
  }).join('') + `<button class="ai-prov-add" onclick="addProvider()">＋ 添加配置</button>`;
}

function renderTaskSlots() {
  const slots = getTaskSlots();
  const list  = getProviderList();
  const container = document.getElementById('ai-task-slots');
  if (!container) return;
  container.innerHTML = Object.entries(TASK_SLOT_DEFS).map(([slotId, def]) => {
    const cur = slots[slotId] || slots['default'] || '';
    const opts = list.map(p => `<option value="${p.id}" ${cur === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
    return `
      <div class="ai-slot-row">
        <div class="ai-slot-icon">${def.icon}</div>
        <div class="ai-slot-info">
          <div class="ai-slot-label">${def.label}</div>
          <div class="ai-slot-desc">${def.desc}</div>
        </div>
        <select class="ai-slot-select" onchange="saveSlot('${slotId}', this.value)">${opts}</select>
      </div>`;
  }).join('');
}

function saveSlot(slotId, providerId) {
  const slots = getTaskSlots();
  slots[slotId] = providerId;
  saveTaskSlots(slots);
}

function addProvider() {
  showProviderEditor({ id: 'p_' + Date.now(), name: '新配置', type: 'custom', proxy: '', key: '', model: '', maxTokens: 4000, supportsVision: false });
}

function editProvider(id) {
  const entry = getProviderList().find(p => p.id === id);
  if (entry) showProviderEditor(entry);
}

function deleteProvider(id) {
  if (!confirm('确定删除这个配置？')) return;
  saveProviderList(getProviderList().filter(p => p.id !== id));
  renderProviderList();
  renderTaskSlots();
}

function showProviderEditor(entry) {
  const overlay = document.getElementById('ai-provider-editor');
  if (!overlay) return;
  document.getElementById('ape-name').value     = entry.name || '';
  document.getElementById('ape-proxy').value    = entry.proxy || '';
  document.getElementById('ape-key').value      = entry.key || '';
  document.getElementById('ape-model').value    = entry.model || '';
  document.getElementById('ape-tokens').value   = entry.maxTokens || 4000;
  document.getElementById('ape-vision').checked = !!(entry.supportsVision || (entry.type === 'claude') || (entry.type === 'gemini'));
  document.querySelectorAll('.ape-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === (entry.type || 'custom')));
  document.getElementById('ape-test-status').textContent = '';
  overlay.dataset.editId = entry.id;
  overlay.style.display  = 'flex';
  
  // 加载对应模型的对话历史
  loadChatTestHistory(entry.id);
}

function loadChatTestHistory(modelId) {
  const history = document.getElementById('ape-chat-history');
  if (!history) return;
  
  // 清空当前历史
  history.innerHTML = '';
  
  // 获取该模型的对话历史
  const modelHistory = window.chatTestHistory[modelId] || [];
  
  if (modelHistory.length === 0) {
    // 显示占位符
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'color:#999;font-size:.7rem;text-align:center;padding:16px 0';
    placeholder.textContent = '发送消息以测试当前配置的模型';
    history.appendChild(placeholder);
  } else {
    // 显示历史消息
    modelHistory.forEach(msg => {
      const bubble = document.createElement('div');
      if (msg.role === 'user') {
        bubble.style.cssText = 'background:rgba(79,70,229,.15);border:1px solid rgba(79,70,229,.25);border-radius:8px 8px 8px 0;padding:8px 12px;align-self:flex-start;max-width:80%;font-size:.7rem;line-height:1.4;color:#ffffff';
      } else {
        bubble.style.cssText = 'background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);border-radius:8px 8px 0 8px;padding:8px 12px;align-self:flex-end;max-width:80%;font-size:.7rem;line-height:1.4;color:#ffffff';
      }
      bubble.textContent = msg.content;
      history.appendChild(bubble);
    });
    // 滚动到底部
    history.scrollTop = history.scrollHeight;
  }
}

function selectProviderType(type) {
  document.querySelectorAll('.ape-type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  if (type === 'claude' || type === 'gemini') document.getElementById('ape-vision').checked = true;
  const hints = { claude: 'https://claudeapi.xxx.workers.dev', openai: 'https://claudeapi.xxx.workers.dev', gemini: 'https://claudeapi.xxx.workers.dev', custom: 'https://open.bigmodel.cn/api/paas/v4' };
  const el = document.getElementById('ape-proxy');
  if (!el.value) el.placeholder = hints[type] || '';
}

function saveProviderEditor() {
  const overlay = document.getElementById('ai-provider-editor');
  const id   = overlay.dataset.editId;
  const type = document.querySelector('.ape-type-btn.active')?.dataset.type || 'custom';
  const entry = {
    id,
    name:           document.getElementById('ape-name').value.trim()  || '未命名',
    type,
    proxy:          document.getElementById('ape-proxy').value.trim(),
    key:            document.getElementById('ape-key').value.trim(),
    model:          document.getElementById('ape-model').value.trim(),
    maxTokens:      parseInt(document.getElementById('ape-tokens').value) || 4000,
    supportsVision: document.getElementById('ape-vision').checked,
  };
  const list = getProviderList();
  const idx  = list.findIndex(p => p.id === id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  saveProviderList(list);
  if (list.length === 1) {
    const slots = getTaskSlots();
    Object.keys(slots).forEach(k => slots[k] = id);
    saveTaskSlots(slots);
  }
  overlay.style.display = 'none';
  renderProviderList();
  renderTaskSlots();
}

function closeProviderEditor() {
  const overlay = document.getElementById('ai-provider-editor');
  if (overlay) overlay.style.display = 'none';
}

async function testProviderConnection() {
  const type  = document.querySelector('.ape-type-btn.active')?.dataset.type || 'custom';
  const proxy = document.getElementById('ape-proxy').value.trim();
  const key   = document.getElementById('ape-key').value.trim();
  const model = document.getElementById('ape-model').value.trim();
  const statusEl = document.getElementById('ape-test-status');
  statusEl.textContent = '测试中…'; statusEl.style.color = '#888';
  try {
    const result = await _doCall({ task: 'API连接测试', max_tokens: 50, messages: [{ role: 'user', content: '回复ok' }], entry: { id: '_test', name: '测试', type, proxy, key, model, maxTokens: 200 } });
    const text = result._parsed?.text || '';
    statusEl.textContent = '✅ 连接成功' + (text ? `：${text.slice(0, 30)}` : '');
    statusEl.style.color = '#81c784';
  } catch(e) {
    statusEl.textContent = '❌ ' + e.message;
    statusEl.style.color = '#e57373';
  }
}



// sendProviderChatTest 函数已移至 ai-module.js



function switchMonitorTab(tab, el) {
  document.querySelectorAll('.monitor-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.monitor-tab-body').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mtab-' + tab).classList.add('active');
  if (tab === 'logs') renderMonitor();
}

function openMonitor() {
  renderProviderList();
  renderTaskSlots();
  renderMonitor();
  document.getElementById('monitorPanel').classList.add('open');
}

function closeMonitor() {
  document.getElementById('monitorPanel').classList.remove('open');
}

function renderMonitor() {
  const logs = getAiLogs();
  const totalIn  = logs.reduce((a,l) => a + (l.in  || 0), 0);
  const totalOut = logs.reduce((a,l) => a + (l.out || 0), 0);
  document.getElementById('ms-total').textContent  = logs.length;
  document.getElementById('ms-tokens').textContent = (totalIn + totalOut).toLocaleString();
  document.getElementById('ms-in').textContent     = totalIn.toLocaleString();
  document.getElementById('ms-out').textContent    = totalOut.toLocaleString();
  const empty = document.getElementById('monitorEmpty');
  const tbody = document.getElementById('monitorLogBody');
  if (!logs.length) { empty.style.display = 'block'; tbody.innerHTML = ''; return; }
  empty.style.display = 'none';
  tbody.innerHTML = logs.map((l, i) => `
    <tr>
      <td class="mlog-time">${logs.length - i}</td>
      <td class="mlog-time">${l.time}</td>
      <td class="mlog-task">${l.task}</td>
      <td class="mlog-model">${l.model.replace('claude-','').replace('-20250514','').replace('-20251001','')}</td>
      <td class="mlog-tokens"><span class="tin">${(l.in||0).toLocaleString()}</span></td>
      <td class="mlog-tokens"><span class="tout">${(l.out||0).toLocaleString()}</span></td>
      <td class="mlog-tokens">${((l.in||0)+(l.out||0)).toLocaleString()}</td>
      <td class="mlog-dur">${l.dur}s</td>
      <td>${l.status==='ok' ? '<span class="mlog-status-ok">✅ 成功</span>' : `<span class="mlog-status-err" title="${l.error}">❌ 失败</span>`}</td>
    </tr>`).join('');
}

// ── 沙盒调试台 ────────────────────────────

function openSandbox() { document.getElementById('sandboxPanel').classList.add('open'); }
function closeSandbox() { document.getElementById('sandboxPanel').classList.remove('open'); }

function switchSandboxTab(tab, el) {
  document.querySelectorAll('.sbx-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('sbxtab-contract').style.display  = tab === 'contract'  ? 'block' : 'none';
  document.getElementById('sbxtab-agreement').style.display = tab === 'agreement' ? 'block' : 'none';
  document.getElementById('sbxtab-table').style.display     = tab === 'table'     ? 'block' : 'none';
}

function getProjectFields() {
  return {
    basic: [
      { field: 'name',         label: '项目名称' },
      { field: 'channel',      label: '项目来源/渠道来源' },
      { field: 'source',       label: '客户名称' },
      { field: 'owner',        label: '负责人/销售' },
      { field: 'product',      label: '产品选型/方案' },
      { field: 'desc',         label: '项目简介/描述' },
      { field: 'stageLabel',   label: '项目阶段/状态（会自动转换为stage字段）' },
      { field: 'active',       label: '项目状态（active或inactive）' },
      { field: 'projectCode',  label: '项目编号' },
      { field: 'contractDate', label: '合同签署日期' }
    ],
    finance: [
      { field: 'quote',          label: '报价金额（万元）' },
      { field: 'quote_yuan',     label: '报价金额（元）' },
      { field: 'contract',       label: '合同金额（万元）' },
      { field: 'contract_yuan',  label: '合同金额（元）' },
      { field: 'cost',           label: '成本评估（万元）' },
      { field: 'collected',      label: '已回款（万元）' }
    ],
    delivery: [
      { field: 'deliveryBrief', label: '交付内容简要' },
      { field: 'deliveryNote',  label: '交付内容详细记录' }
    ],
    other: [
      { field: 'todos',        label: '待办事项（用|分隔多个）' },
      { field: 'collectTasks', label: '催款任务' },
      { field: 'logs',         label: '更新日志' }
    ]
  };
}

function generateTablePrompt(headers, sampleRows) {
  const fields = getProjectFields();
  let prompt = `以下是项目管理表格的列名：\n${JSON.stringify(headers)}\n\n样本数据：\n${JSON.stringify(sampleRows)}\n\n请将列名映射到字段（不匹配跳过）：\n\n`;
  prompt += '基本信息：\n';
  fields.basic.forEach(item => { prompt += `- ${item.field}: ${item.label}\n`; });
  prompt += '\n财务信息：\n';
  fields.finance.forEach(item => { prompt += `- ${item.field}: ${item.label}\n`; });
  prompt += '\n交付信息：\n';
  fields.delivery.forEach(item => { prompt += `- ${item.field}: ${item.label}\n`; });
  prompt += '\n其他信息：\n';
  fields.other.forEach(item => { prompt += `- ${item.field}: ${item.label}\n`; });
  prompt += '\n重要要求：\n1. 只返回JSON对象，不要添加任何额外说明\n2. JSON的key是列名，value是字段名\n3. 确保返回的是有效的JSON格式\n4. 不要包含任何JSON之外的内容\n5. 如果没有匹配的列名，返回空对象{}即可\n';
  prompt += '\n示例输出格式：\n{"项目名称": "name", "项目来源": "channel", "客户名称": "source", "负责人": "owner", "产品": "product", "描述": "desc", "状态": "stageLabel", "报价": "quote", "合同金额": "contract", "成本": "cost", "已回款": "collected", "交付内容": "deliveryBrief", "合同日期": "contractDate"}';
  return prompt;
}

async function sbxCallAI(messages, maxTokens = 2000, task = '沙盒测试') {
  const modelType = document.getElementById('sbx-model-select').value;
  try {
    if (modelType === 'sandbox') {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages })
      });
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(`内置 Claude 沙盒请求失败：HTTP ${resp.status} ${errorData.error?.message || resp.statusText}`);
      }
      const data = await resp.json();
      if (data.error) throw new Error(`内置 Claude 沙盒错误：${data.error.message}`);
      if (!data.content || !Array.isArray(data.content)) throw new Error(`内置 Claude 沙盒返回格式错误：缺少 content 字段`);
      const responseText = data.content.filter(b => b.type === "text").map(b => b.text).join("") || "";
      if (!responseText) throw new Error(`AI 返回了空响应。响应数据：${JSON.stringify(data)}`);
      return responseText;
    } else {
      const cfg = getAiConfig();
      const data = await claudeCall({ task, max_tokens: maxTokens, messages });
      if (!data._parsed) throw new Error(`全局模型返回数据格式错误：缺少 _parsed 字段`);
      if (data._parsed.error) throw new Error(`全局模型错误：${data._parsed.error}`);
      const responseText = data._parsed?.text || data.content?.[0]?.text || '';
      if (!responseText) throw new Error(`AI 返回了空响应。服务商：${cfg.provider}，模型：${cfg.model}`);
      return responseText;
    }
  } catch(e) {
    return `[错误] ${e.message}`;
  }
}

async function claudeCallSandbox(messages, maxTokens = 2000) {
  return sbxCallAI(messages, maxTokens, '沙盒测试（内置）');
}

// ── 表格识别 Tab ──────────────────────────

let sbxTableFile = null;
let sbxTableData = [];
let sbxTableHeaders = [];
let sbxTablePrompt = '';

function sbxTableFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  sbxTableFile = file;
  document.getElementById('sbx-t-file-info').textContent = `已选择：${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
  document.getElementById('sbx-t-file-info').style.display = 'block';
  document.getElementById('sbx-t-btn-parse').disabled = false;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      sbxTableData = jsonData;
      if (jsonData.length > 0) {
        sbxTableHeaders = jsonData[0];
        const preview = document.getElementById('sbx-t-raw-table');
        document.getElementById('sbx-t-table-info').textContent = `共 ${jsonData.length} 行，${jsonData[0].length} 列`;
        preview.textContent = jsonData.slice(0, 10).map(row => row.join('\t')).join('\n');
        document.getElementById('sbx-t-table-sec').style.display = 'block';
      }
    } catch(e) { alert('读取Excel文件失败：' + e.message); }
  };
  reader.readAsArrayBuffer(file);
}

function _sbxParseJsonResponse(response) {
  const firstBrace = response.indexOf('{');
  const lastBrace  = response.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return JSON.parse(response.substring(firstBrace, lastBrace + 1));
  }
  const codeBlock = response.match(/```json[\s\S]*?```/);
  if (codeBlock) return JSON.parse(codeBlock[0].replace(/```json|```/g, '').trim());
  return JSON.parse(response);
}

function _sbxRenderTableResult(response) {
  const resultBody = document.getElementById('sbx-t-result-body');
  document.getElementById('sbx-t-result-sec').style.display = 'block';
  if (response.startsWith('[错误]')) {
    resultBody.innerHTML = `<div style="background:rgba(255,204,128,.06);border:1px solid rgba(255,204,128,.15);border-radius:7px;padding:12px">
      <div style="font-size:.7rem;color:#ffcc80;margin-bottom:8px;font-weight:600">AI 调用错误：</div>
      <div style="color:#aaa;font-size:.68rem">${response.replace('[错误] ', '')}</div>
    </div>`;
    return;
  }
  let mapping = {}, parseError = null;
  try { mapping = _sbxParseJsonResponse(response); } catch(e) { parseError = e.message; }
  if (parseError) {
    resultBody.innerHTML = `<div style="background:rgba(255,204,128,.06);border:1px solid rgba(255,204,128,.15);border-radius:7px;padding:12px">
      <div style="font-size:.7rem;color:#ffcc80;margin-bottom:8px;font-weight:600">解析错误：</div>
      <div style="color:#aaa;font-size:.68rem">${parseError}</div>
    </div>`;
    return;
  }
  let html = '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:7px;padding:12px">';
  html += '<div style="font-size:.7rem;color:#7eccd8;margin-bottom:8px;font-weight:600">列名映射结果：</div>';
  if (!Object.keys(mapping).length) {
    html += '<div style="color:#aaa;font-size:.68rem">未识别到任何列名映射</div>';
  } else {
    Object.entries(mapping).forEach(([column, field]) => {
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)">
        <span style="color:#aaa">${column}</span>
        <span style="color:#7eccd8;font-weight:600">${field}</span>
      </div>`;
    });
  }
  html += '</div>';
  resultBody.innerHTML = html;
}

async function sbxTableAnalyze() {
  if (!sbxTableData.length) { alert('请先上传Excel文件'); return; }
  const btn = document.getElementById('sbx-t-btn-parse');
  btn.disabled = true; btn.textContent = '🔍 识别中...';
  try {
    sbxTablePrompt = generateTablePrompt(sbxTableHeaders, sbxTableData.slice(1, 4));
    document.getElementById('sbx-t-prompt-edit').value = sbxTablePrompt;
    document.getElementById('sbx-t-prompt-sec').style.display = 'block';
    const response = await sbxCallAI([{ role: 'user', content: sbxTablePrompt }], 1000, '表格识别（沙盒）');
    document.getElementById('sbx-t-raw-resp').textContent = response;
    document.getElementById('sbx-t-raw-sec').style.display = 'block';
    _sbxRenderTableResult(response);
  } catch(e) { alert('识别失败：' + e.message); }
  finally { btn.disabled = false; btn.textContent = '🔍 识别表格'; }
}

async function sbxTableRerun() {
  const prompt = document.getElementById('sbx-t-prompt-edit').value;
  if (!prompt) { alert('请输入Prompt'); return; }
  const btn = document.getElementById('sbx-t-btn-parse');
  btn.disabled = true; btn.textContent = '🔍 重新识别中...';
  try {
    const response = await sbxCallAI([{ role: 'user', content: prompt }], 1000, '表格识别（沙盒）');
    document.getElementById('sbx-t-raw-resp').textContent = response;
    document.getElementById('sbx-t-raw-sec').style.display = 'block';
    _sbxRenderTableResult(response);
  } catch(e) { alert('识别失败：' + e.message); }
  finally { btn.disabled = false; btn.textContent = '🔍 识别表格'; }
}

function sbxTableClear() {
  document.getElementById('sbx-t-file').value = '';
  document.getElementById('sbx-t-file-info').style.display = 'none';
  document.getElementById('sbx-t-btn-parse').disabled = true;
  sbxTableFile = null; sbxTableData = []; sbxTableHeaders = []; sbxTablePrompt = '';
  ['sbx-t-table-sec','sbx-t-prompt-sec','sbx-t-raw-sec','sbx-t-result-sec'].forEach(id => document.getElementById(id).style.display = 'none');
  document.getElementById('sbx-t-raw-table').textContent = '';
  document.getElementById('sbx-t-prompt-edit').value = '';
  document.getElementById('sbx-t-raw-resp').textContent = '';
  document.getElementById('sbx-t-result-body').innerHTML = '';
}

// ── 合同调试 Tab ──────────────────────────

let sbxContractFile = null;
let sbxContractText = '';
let sbxContractMode = 'both';

const SBX_PROMPT_DELIVERY = `请分析这份合同，只提取"交付内容"，只返回JSON，不加任何说明文字：

交付内容分类（可多选，四个分类可同时存在）：
- wireless_hardware: 是否包含无线硬件交付（true/false）
- wired_hardware: 是否包含有线硬件交付（true/false）
- software: 是否包含软件定制交付（true/false）
- other: 其他交付内容（字符串，不超过30字，没有则为空字符串""）

返回格式示例：
{"wireless_hardware":true,"wired_hardware":false,"software":true,"other":"现场安装调试服务"}`;

const SBX_PROMPT_PAYMENT = `请分析这份合同，只提取"回款节点"，只返回JSON数组，不加任何说明文字：

每个回款节点包含：
- condition: 回款要求（触发条件，如"合同签订后"、"完成验收后"）
- ratio: 回款比例（如"30%"，没有比例则为空字符串""）
- amount: 回款金额（如"50万元"，没有具体金额则为空字符串""）

返回格式示例：
[{"condition":"合同签订后7日内","ratio":"30%","amount":""},{"condition":"设备到货验收合格后","ratio":"40%","amount":""},{"condition":"竣工验收后","ratio":"30%","amount":""}]`;

const SBX_PROMPT_BOTH = `请分析这份合同，提取以下三部分内容，只返回JSON，不加任何说明文字：

1. contractAmount: 合同总金额（数字，单位元，找不到则为null）

2. delivery（交付内容，四个分类可同时存在）：
   - wireless_hardware / wired_hardware / software: true/false
   - other: 其他交付（字符串，无则""）

3. payment（回款节点数组，每项包含）：
   - condition: 回款要求
   - ratio: 比例（如"30%"，无则""）
   - amount: 金额（如有则填写，无则""）

返回格式：
{"contractAmount":1705760,"delivery":{"wireless_hardware":true,"wired_hardware":false,"software":true,"other":""},"payment":[{"condition":"合同签订后","ratio":"30%","amount":""}]}`;

function sbxGetContractPrompt(mode) {
  if (mode === 'delivery') return SBX_PROMPT_DELIVERY;
  if (mode === 'payment')  return SBX_PROMPT_PAYMENT;
  return SBX_PROMPT_BOTH;
}

async function sbxContractFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  sbxContractFile = file;
  const ext = file.name.split('.').pop().toLowerCase();
  const info = document.getElementById('sbx-c-file-info');
  info.style.display = 'block';
  info.innerHTML = `📄 <b>${file.name}</b> — 正在提取文本…`;
  try {
    if (['txt','md'].includes(ext))      sbxContractText = await file.text();
    else if (['doc','docx'].includes(ext)) sbxContractText = await readDocxText(file);
    else if (ext === 'pdf')              sbxContractText = '[PDF]';
    else                                 sbxContractText = await file.text();
    if (ext !== 'pdf') {
      document.getElementById('sbx-c-text-sec').style.display = 'block';
      document.getElementById('sbx-c-raw-text').textContent = sbxContractText.slice(0, 800) + (sbxContractText.length > 800 ? '\n…' : '');
      document.getElementById('sbx-c-text-len').textContent = `共 ${sbxContractText.length} 字符`;
    }
    info.innerHTML = `📄 <b>${file.name}</b> <span style="color:#81c784">✅ ${ext === 'pdf' ? 'PDF就绪' : sbxContractText.length + ' 字符'}</span>`;
    ['sbx-c-btn-delivery','sbx-c-btn-payment','sbx-c-btn-both'].forEach(id => document.getElementById(id).disabled = false);
    ['sbx-c-prompt-sec','sbx-c-raw-sec','sbx-c-result-sec'].forEach(id => document.getElementById(id).style.display = 'none');
  } catch(e) { info.innerHTML = `❌ 提取失败：${e.message}`; }
}

async function sbxContractAnalyze(mode) {
  sbxContractMode = mode;
  if (!sbxContractFile) { showToast('请先上传合同文件'); return; }
  const ext = sbxContractFile.name.split('.').pop().toLowerCase();
  const prompt = sbxGetContractPrompt(mode);
  document.getElementById('sbx-c-prompt-sec').style.display = 'block';
  document.getElementById('sbx-c-prompt-edit').value = ext === 'pdf' ? prompt : (prompt + '\n\n合同内容如下：\n' + sbxContractText.slice(0, 12000));
  document.getElementById('sbx-c-raw-sec').style.display = 'block';
  document.getElementById('sbx-c-raw-resp').textContent = '请求中…';
  document.getElementById('sbx-c-result-sec').style.display = 'none';
  ['sbx-c-btn-delivery','sbx-c-btn-payment','sbx-c-btn-both'].forEach(id => document.getElementById(id).disabled = true);
  try {
    let rawText;
    if (ext === 'pdf') {
      const ab = await sbxContractFile.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      rawText = await sbxCallAI([{ role:'user', content:[
        { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
        { type:'text', text:prompt }
      ]}], 4000, '合同识别（沙盒）');
    } else {
      rawText = await sbxCallAI([{ role:'user', content: document.getElementById('sbx-c-prompt-edit').value }], 4000, '合同识别（沙盒）');
    }
    document.getElementById('sbx-c-raw-resp').textContent = rawText || '（空响应）';
    sbxRenderContractResult(rawText, mode);
  } catch(e) {
    document.getElementById('sbx-c-raw-resp').textContent = '❌ 请求失败：' + e.message;
  } finally {
    ['sbx-c-btn-delivery','sbx-c-btn-payment','sbx-c-btn-both'].forEach(id => document.getElementById(id).disabled = false);
  }
}

async function sbxContractRerun() {
  const fullPrompt = document.getElementById('sbx-c-prompt-edit').value;
  document.getElementById('sbx-c-raw-resp').textContent = '请求中…';
  document.getElementById('sbx-c-result-sec').style.display = 'none';
  try {
    const rawText = await sbxCallAI([{ role:'user', content:fullPrompt }], 4000, '合同识别（沙盒）');
    document.getElementById('sbx-c-raw-resp').textContent = rawText || '（空响应）';
    sbxRenderContractResult(rawText, sbxContractMode);
  } catch(e) {
    document.getElementById('sbx-c-raw-resp').textContent = '❌ 请求失败：' + e.message;
  }
}

function sbxRenderContractResult(rawText, mode) {
  const sec  = document.getElementById('sbx-c-result-sec');
  const body = document.getElementById('sbx-c-result-body');
  sec.style.display = 'block';
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const match = clean.match(/[\[{][\s\S]*[\]}]/);
    if (!match) throw new Error('响应中未找到 JSON：\n' + rawText);
    const parsed = JSON.parse(match[0]);
    let html = '';
    if (mode === 'both' && parsed.contractAmount != null) {
      const yuan = Number(parsed.contractAmount);
      const wan  = +(yuan / 10000).toFixed(4).replace(/\.?0+$/, '');
      html += `<div class="ca-section" style="margin-bottom:10px">
        <div class="ca-title">📝 合同总金额</div>
        <div style="font-size:.8rem;color:#eee;font-weight:600">¥${yuan.toLocaleString()} 元 <span style="color:#888;font-size:.65rem;font-weight:400">（${wan} 万元）</span></div>
      </div>`;
    }
    const d = mode === 'payment' ? null : (parsed.delivery || (mode === 'delivery' ? parsed : null));
    if (d) {
      const chips = [
        d.wireless_hardware && `<span class="ca-chip wireless">📡 无线硬件</span>`,
        d.wired_hardware    && `<span class="ca-chip wired">🔌 有线硬件</span>`,
        d.software          && `<span class="ca-chip software">💻 软件定制</span>`,
        d.other             && `<span class="ca-chip other-dev">📎 ${d.other}</span>`,
      ].filter(Boolean);
      html += `<div class="ca-section" style="margin-bottom:10px">
        <div class="ca-title">📦 交付内容</div>
        <div class="ca-chips">${chips.length ? chips.join('') : '<span class="ca-chip none">未识别到明确交付内容</span>'}</div>
      </div>`;
    }
    const payments = mode === 'delivery' ? null : (Array.isArray(parsed) ? parsed : parsed.payment);
    if (payments) {
      const rows = payments.map(r => `
        <div class="ca-payment-row">
          <div class="ca-payment-label">📌 ${r.condition || '-'}</div>
          <div class="ca-payment-val">
            ${r.ratio  ? `<b style="color:var(--s1)">${r.ratio}</b>` : ''}
            ${r.amount ? `&nbsp;·&nbsp;${r.amount}` : ''}
          </div>
        </div>`).join('');
      html += `<div class="ca-section">
        <div class="ca-title">💰 回款节点（${payments.length} 个）</div>
        ${payments.length ? rows : '<div style="color:#555;font-size:.75rem">未识别到回款节点</div>'}
      </div>`;
    }
    body.innerHTML = html || '<div style="color:#555;font-size:.75rem">无结果</div>';
  } catch(e) {
    body.innerHTML = `<div style="color:#e57373;font-size:.75rem;white-space:pre-wrap">❌ 解析失败：${e.message}</div>`;
  }
}

// ── 技术协议调试 Tab ──────────────────────

let sbxAgreementFile = null;
let sbxAgreementText = '';

const SBX_AGREEMENT_PROMPT = `你是技术协议分析助手。请阅读这份技术协议，提取交付内容并按以下格式返回JSON，不加任何说明文字：

{
  "brief": "不超过50字的交付内容概述",
  "wireless_hardware": true或false（是否包含无线硬件交付）,
  "wired_hardware": true或false（是否包含有线硬件交付）,
  "software": true或false（是否包含软件/系统交付）,
  "other": "其他交付内容描述，没有则为空字符串"
}

示例：{"brief":"无线振动传感器×20套，数据采集网关×2套，在线监测平台软件1套","wireless_hardware":true,"wired_hardware":false,"software":true,"other":"现场安装调试"}`;

async function sbxAgreementFileSelected(input) {
  const file = input.files[0];
  if (!file) return;
  sbxAgreementFile = file;
  const ext = file.name.split('.').pop().toLowerCase();
  const info = document.getElementById('sbx-a-file-info');
  info.style.display = 'block';
  info.innerHTML = `📄 <b>${file.name}</b> — 正在提取文本…`;
  try {
    if (['txt','md'].includes(ext))        sbxAgreementText = await file.text();
    else if (['doc','docx'].includes(ext)) sbxAgreementText = await readDocxText(file);
    else if (ext === 'pdf')                sbxAgreementText = '[PDF]';
    else                                   sbxAgreementText = await file.text();
    if (ext !== 'pdf') {
      document.getElementById('sbx-a-text-sec').style.display = 'block';
      document.getElementById('sbx-a-raw-text').textContent = sbxAgreementText.slice(0, 800) + (sbxAgreementText.length > 800 ? '\n…' : '');
      document.getElementById('sbx-a-text-len').textContent = `共 ${sbxAgreementText.length} 字符`;
    }
    info.innerHTML = `📄 <b>${file.name}</b> <span style="color:#81c784">✅ ${ext === 'pdf' ? 'PDF就绪' : sbxAgreementText.length + ' 字符'}</span>`;
    document.getElementById('sbx-a-btn').disabled = false;
    ['sbx-a-prompt-sec','sbx-a-raw-sec','sbx-a-result-sec'].forEach(id => document.getElementById(id).style.display = 'none');
  } catch(e) { info.innerHTML = `❌ 提取失败：${e.message}`; }
}

async function sbxAgreementAnalyze() {
  if (!sbxAgreementFile) { showToast('请先上传技术协议文件'); return; }
  const ext = sbxAgreementFile.name.split('.').pop().toLowerCase();
  document.getElementById('sbx-a-prompt-sec').style.display = 'block';
  document.getElementById('sbx-a-prompt-edit').value = ext === 'pdf' ? SBX_AGREEMENT_PROMPT : (SBX_AGREEMENT_PROMPT + '\n\n以下是技术协议内容：\n' + sbxAgreementText.slice(0, 12000));
  document.getElementById('sbx-a-raw-sec').style.display = 'block';
  document.getElementById('sbx-a-raw-resp').textContent = '请求中…';
  document.getElementById('sbx-a-result-sec').style.display = 'none';
  document.getElementById('sbx-a-btn').disabled = true;
  try {
    let rawText;
    if (ext === 'pdf') {
      const ab = await sbxAgreementFile.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
      rawText = await sbxCallAI([{ role:'user', content:[
        { type:'document', source:{ type:'base64', media_type:'application/pdf', data:b64 } },
        { type:'text', text:SBX_AGREEMENT_PROMPT }
      ]}], 4000, '技术协议识别（沙盒）');
    } else {
      rawText = await sbxCallAI([{ role:'user', content: document.getElementById('sbx-a-prompt-edit').value }], 4000, '技术协议识别（沙盒）');
    }
    document.getElementById('sbx-a-raw-resp').textContent = rawText || '（空响应）';
    sbxRenderAgreementResult(rawText);
  } catch(e) {
    document.getElementById('sbx-a-raw-resp').textContent = '❌ 请求失败：' + e.message;
  } finally {
    document.getElementById('sbx-a-btn').disabled = false;
  }
}

async function sbxAgreementRerun() {
  const fullPrompt = document.getElementById('sbx-a-prompt-edit').value;
  document.getElementById('sbx-a-raw-resp').textContent = '请求中…';
  document.getElementById('sbx-a-result-sec').style.display = 'none';
  try {
    const rawText = await sbxCallAI([{ role:'user', content:fullPrompt }], 4000, '技术协议识别（沙盒）');
    document.getElementById('sbx-a-raw-resp').textContent = rawText || '（空响应）';
    sbxRenderAgreementResult(rawText);
  } catch(e) {
    document.getElementById('sbx-a-raw-resp').textContent = '❌ 请求失败：' + e.message;
  }
}

function sbxRenderAgreementResult(rawText) {
  const sec  = document.getElementById('sbx-a-result-sec');
  const body = document.getElementById('sbx-a-result-body');
  sec.style.display = 'block';
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('未找到 JSON：\n' + rawText);
    const r = JSON.parse(match[0]);
    const chips = [
      r.wireless_hardware && `<span class="ca-chip wireless">📡 无线硬件</span>`,
      r.wired_hardware    && `<span class="ca-chip wired">🔌 有线硬件</span>`,
      r.software          && `<span class="ca-chip software">💻 软件定制</span>`,
      r.other             && `<span class="ca-chip other-dev">📎 ${r.other}</span>`,
    ].filter(Boolean);
    body.innerHTML = `
      ${r.brief ? `<div style="font-size:.78rem;color:#eee;font-weight:600;margin-bottom:10px;padding:8px 12px;background:rgba(255,204,128,.08);border-radius:8px;border-left:2px solid #ffcc80;line-height:1.5">${r.brief}</div>` : ''}
      <div class="ca-chips">${chips.length ? chips.join('') : '<span class="ca-chip none">未识别到具体类型</span>'}</div>`;
  } catch(e) {
    body.innerHTML = `<div style="color:#e57373;font-size:.75rem;white-space:pre-wrap">❌ 解析失败：${e.message}</div>`;
  }
}

// ── 初始化 ────────────────────────────────

function initDragAndDrop() {
  function setupDrop(dropId, inputId, handler) {
    const drop = document.getElementById(dropId);
    const inp  = document.getElementById(inputId);
    if (!drop) return;
    drop.addEventListener('dragover',  e => { e.preventDefault(); drop.style.opacity = '.7'; });
    drop.addEventListener('dragleave', () => { drop.style.opacity = '1'; });
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.style.opacity = '1';
      const file = e.dataTransfer.files[0];
      if (file) { const dt = new DataTransfer(); dt.items.add(file); inp.files = dt.files; handler(inp); }
    });
  }
  setupDrop('sbx-c-drop', 'sbx-c-file', sbxContractFileSelected);
  setupDrop('sbx-a-drop', 'sbx-a-file', sbxAgreementFileSelected);
  setupTodoEventDelegation();
}

export {
  // AI 监控
  switchMonitorTab,
  openMonitor,
  closeMonitor,
  renderMonitor,
  // 多 Provider 管理
  renderProviderList,
  renderTaskSlots,
  saveSlot,
  addProvider,
  editProvider,
  deleteProvider,
  showProviderEditor,
  selectProviderType,
  saveProviderEditor,
  closeProviderEditor,
  testProviderConnection,
  // 沙盒
  openSandbox,
  closeSandbox,
  switchSandboxTab,
  getProjectFields,
  generateTablePrompt,
  sbxCallAI,
  claudeCallSandbox,
  sbxTableFileSelected,
  sbxTableAnalyze,
  sbxTableRerun,
  sbxTableClear,
  sbxGetContractPrompt,
  sbxContractFileSelected,
  sbxContractAnalyze,
  sbxContractRerun,
  sbxRenderContractResult,
  sbxAgreementFileSelected,
  sbxAgreementAnalyze,
  sbxAgreementRerun,
  sbxRenderAgreementResult,
  initDragAndDrop
};
