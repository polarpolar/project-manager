// ╔══════════════════════════════════════════╗
// ║  MODULE: import（数据导入）              ║
// ╚══════════════════════════════════════════╝

// ── 常量 ──────────────────────────────────

const DEBUG = false;

const STAGE_MAP_IMPORT = {
  '洽谈推进中':0,'洽谈中':0,'跟进中':0,
  '已签单·执行中':1,'已签单执行中':1,'已签单·回款中':1,'已执行·回款中':1,'已执行·汇款中':1,
  '执行中':1,'签单中':1,'已签单':1,'交付中':1,
  '已完结':2
};

const COL_MAP = {
  '项目名称':     'name',  '项目名称*': 'name',
  '项目来源':     'channel','客户名称': 'source',
  '负责人':       'owner',
  '产品类型':     'product','产品选型': 'product',
  '项目简介':     'desc',  '项目阶段':  'stageLabel',
  '报价金额':     'quote', '报价金额(万元)':'quote','报价金额(元)':'quote_yuan','报价金额/元':'quote_yuan',
  '合同金额':     'contract','合同金额(万元)':'contract','合同金额(元)':'contract_yuan','合同金额/元':'contract_yuan',
  '成本评估':     'cost',  '成本评估(万元)':'cost','成本评估(元)':'cost_yuan',
  '已回款金额(万元)':'collected','已回款金额':'collected',
  '合同签署日期': 'contractDate', '合同日期': 'contractDate', '签署日期': 'contractDate',
  '待办事项':     'todosRaw','待办事项(用|分隔)':'todosRaw'
};

const YUAN_COLS = new Set(['quote_yuan','contract_yuan','cost_yuan']);

// 语雀阶段映射
const STAGE_MAP_YUQUE = {
  '洽谈中':0, '洽谈':0, '跟进中':0,
  '已签单·执行中':1, '已签单执行中':1, '执行中':1, '交付中':1, '已签单':1,
  '已执行·回款中':1, '回款中':1, '催款中':1,
  '已完结':2, '完结':2, '已结束':2
};

// ── 状态变量 ──────────────────────────────

let pendingImport = [];
let yuquePendingImport = [];

// ── Excel 导入 ────────────────────────────

function openImport()  { document.getElementById('importOverlay').classList.add('show'); }
function closeImport() { document.getElementById('importOverlay').classList.remove('show'); pendingImport = []; }

function initImportDropZone() {
  const dz = document.getElementById('dropZone');
  if (!dz) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop',      e => { e.preventDefault(); dz.classList.remove('over'); handleFile(e.dataTransfer.files[0]); });
  dz.addEventListener('click',     () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', e => handleFile(e.target.files[0]));
}

function handleFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => parseExcel(e.target.result, file.name);
  reader.readAsArrayBuffer(file);
}

// 从行数据中智能定位"项目名称"列
function _findNameColIdx(headers, colIdx) {
  if (colIdx.name !== undefined) return;
  const patterns = [
    h => h.includes('项目') && h.includes('名称'),
    h => h.includes('项目'),
    h => h.includes('名称'),
  ];
  for (const test of patterns) {
    const i = headers.findIndex(test);
    if (i !== -1) { colIdx.name = i; return; }
  }
  colIdx.name = 0; // 最终回退：第一列
}

// 解析行对象（处理阶段、待办、催款、日志字段）
function _parseRowObj(obj) {
  // 阶段
  let slRaw = (obj.stageLabel || obj.stage || '').trim();
  if (!slRaw) {
    for (const [key, value] of Object.entries(obj)) {
      if (key.includes('阶段') || key.includes('状态')) { slRaw = String(value).trim(); break; }
    }
  }
  const numPrefix = slRaw.match(/^(\d+)/)?.[1];
  const sl = slRaw.replace(/^\d+/, '').replace(/\s/g, '');
  if      (numPrefix === '1') obj.stage = STAGE.NEGOTIATING;
  else if (numPrefix === '2') obj.stage = STAGE.DELIVERING;
  else if (numPrefix === '3') obj.stage = STAGE.COMPLETED;
  else obj.stage = STAGE_MAP_IMPORT[sl] ?? STAGE.NEGOTIATING;

  // 待办
  obj.todos = obj.todos
    ? obj.todos.split('|').map(t => ({ text: t.trim(), done: false })).filter(t => t.text)
    : (obj.todosRaw
      ? obj.todosRaw.split('|').map(t => ({ text: t.trim(), done: false })).filter(t => t.text)
      : []);
  delete obj.todosRaw;

  // 催款任务
  obj.collectTasks = obj.collectTasks
    ? obj.collectTasks.split('|').map(task => ({ text: task.trim(), date: '', amount: '', done: false })).filter(t => t.text)
    : [];

  // 日志
  obj.logs = obj.logs
    ? obj.logs.split('|').map(log => ({ time: new Date().toLocaleString(), text: log.trim() })).filter(l => l.text)
    : [];

  delete obj.stageLabel;
  obj.id     = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  obj.active = obj.active || 'active';
  return obj;
}

async function parseExcel(buf, filename) {
  try {
    const wb   = XLSX.read(buf, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (rows.length < 2) { showImportError('文件为空'); return; }
    const headers = rows[0].map(h => String(h).trim());

    let colIdx = {};
    if (getParseMode() === 'ai') {
      document.getElementById('dropText').innerHTML = `<b>${filename}</b> 🤖 AI 正在理解列名…`;
      try {
        const prompt = generateTablePrompt(headers, rows.slice(1, 4));
        const data = await claudeCall({ task: 'Excel列名识别', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
        const text = data._parsed?.text || data.content?.[0]?.text || '';
        const firstBrace = text.indexOf('{'), lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const mapping = JSON.parse(text.substring(firstBrace, lastBrace + 1));
          headers.forEach((h, i) => { if (mapping[h]) colIdx[mapping[h]] = i; });
        } else {
          const cb = text.match(/```json[\s\S]*?```/);
          if (cb) { const mapping = JSON.parse(cb[0].replace(/```json|```/g, '').trim()); headers.forEach((h,i) => { if (mapping[h]) colIdx[mapping[h]] = i; }); }
        }
      } catch(e) {
        headers.forEach((h, i) => { if (COL_MAP[h]) colIdx[COL_MAP[h]] = i; });
      }
    } else {
      headers.forEach((h, i) => { if (COL_MAP[h]) colIdx[COL_MAP[h]] = i; });
    }

    _findNameColIdx(headers, colIdx);

    const filteredRows = rows.slice(1).filter(r => r.some(c => c !== ''));
    pendingImport = filteredRows.map(r => {
      const obj = {};
      Object.entries(colIdx).forEach(([field, idx]) => {
        let val = String(r[idx] || '').trim();
        if (YUAN_COLS.has(field)) {
          const n = parseFloat(val);
          obj[field.replace('_yuan', '')] = isNaN(n) ? '' : (n / 10000).toFixed(2);
        } else {
          obj[field] = val;
        }
      });
      return _parseRowObj(obj);
    }).filter(p => p.name);
    _renderImportPreview(filename);
  } catch(err) {
    showImportError('解析失败：' + err.message);
  }
}

function _renderImportPreview(filename) {
  const existNames  = new Set(projects.map(p => p.name));
  const stageNames  = ['洽谈中','已签单·执行中','已完结'];
  const fieldLabels = { name:'项目名称', stage:'阶段', channel:'项目来源', source:'客户名称', owner:'负责人', product:'产品选型', desc:'项目简介', quote:'报价（万）', contract:'合同（万）', cost:'成本（万）', collected:'已回款（万）', projectCode:'项目编号', contractDate:'合同日期', deliveryBrief:'交付内容', deliveryNote:'交付详情' };
  const SKIP = new Set(['id','todos','collectTasks','logs','active']);

  const fieldStats = {};
  pendingImport.forEach(p => {
    Object.keys(p).forEach(f => { if (!SKIP.has(f) && p[f] && String(p[f]).trim()) fieldStats[f] = (fieldStats[f] || 0) + 1; });
  });
  const visibleFields = Object.keys(fieldStats).filter(f => fieldStats[f] > 0);
  if (visibleFields.includes('name')) { visibleFields.splice(visibleFields.indexOf('name'), 1); visibleFields.unshift('name'); }

  document.getElementById('importHead').innerHTML = '<tr><th>状态</th>' + visibleFields.map(f => `<th>${fieldLabels[f] || f}</th>`).join('') + '</tr>';

  let bodyHtml = pendingImport.slice(0, 10).map(p => {
    return '<tr><td>' + (existNames.has(p.name) ? '<span class="tag-update">↻ 更新</span>' : '<span class="tag-new">＋ 新增</span>') + '</td>'
      + visibleFields.map(f => `<td>${f === 'stage' ? (stageNames[p.stage] || '-') : (String(p[f] || '').trim() || '-')}</td>`).join('') + '</tr>';
  }).join('');
  if (pendingImport.length > 10) bodyHtml += `<tr><td colspan="${visibleFields.length + 1}" style="text-align:center;color:#aaa">…还有${pendingImport.length - 10}条</td></tr>`;

  document.getElementById('importBody').innerHTML = bodyHtml;
  document.getElementById('dropText').innerHTML = `<b>${filename}</b> 已解析 ${pendingImport.length} 条`;
  document.getElementById('importPreview').classList.add('show');
  document.getElementById('btnConfirmImport').style.display = pendingImport.length ? 'inline-block' : 'none';
}

function showImportError(msg) {
  document.getElementById('importPreview').classList.remove('show');
  document.getElementById('btnConfirmImport').style.display = 'none';
  document.getElementById('dropText').innerHTML = `<span style="color:var(--sc)">⚠️ ${msg}</span>`;
}

function confirmImport() {
  if (!pendingImport.length) return;
  let added = 0, updated = 0;
  pendingImport.forEach(p => {
    const idx = projects.findIndex(x => x.name === p.name);
    if (idx >= 0) { projects[idx] = { ...projects[idx], ...p, id: projects[idx].id }; updated++; }
    else { if (!p.projectCode) p.projectCode = genProjectCode(p.stage || 0, p.contractDate || ''); projects.push(p); added++; }
  });
  closeImport(); save(); refreshView();
  showToast(`导入完成：新增 ${added} 个，更新 ${updated} 个`);
}

function downloadTemplate() {
  const headers = ['项目名称*','项目来源','负责人','产品选型','项目简介','项目阶段','报价金额(万元)','合同金额(万元)','成本评估(万元)','已回款金额(万元)','待办事项(用|分隔)'];
  const sample  = [['示例项目','佳电运维科技','苏奕玮','G01+V03','示例简介','已签单·执行中','10.5','9.8','3.2','5','跟进合同|准备方案']];
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  ws['!cols'] = [18,14,10,14,20,16,14,14,14,14,24].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '项目导入模板');
  XLSX.writeFile(wb, '项目导入模板.xlsx');
}

// 导出带项目编号的项目列表
function exportExcelWithProjectCodes() {
  if (!yuquePendingImport.length) { showToast('请先读取语雀文档'); return; }
  const data = yuquePendingImport.map(p => ({
    '项目名称': p.name,
    '项目编号': p.projectCode || ''
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '项目编号');
  XLSX.writeFile(wb, '项目编号.xlsx');
}

function switchImportTab(tab) {
  document.getElementById('tab-excel').classList.toggle('active', tab === 'excel');
  document.getElementById('tab-yuque').classList.toggle('active', tab === 'yuque');
  document.getElementById('panel-excel').style.display = tab === 'excel' ? 'block' : 'none';
  document.getElementById('panel-yuque').style.display = tab === 'yuque' ? 'block' : 'none';
}

// ── 解析模式 ──────────────────────────────

function getParseMode()  { return document.querySelector('input[name="parse-mode"]:checked')?.value || 'ai'; }
function saveParseMode() { try { localStorage.setItem(STORAGE_KEY.PARSE_MODE, getParseMode()); } catch(e) {} }
function loadParseMode() {
  try {
    const m = localStorage.getItem(STORAGE_KEY.PARSE_MODE);
    if (m) { const el = document.getElementById('mode-' + m); if (el) el.checked = true; }
  } catch(e) {}
}

// ── 语雀导入 ──────────────────────────────

function saveYuqueProxy() { try { localStorage.setItem(STORAGE_KEY.YUQUE_PROXY, document.getElementById('yuque-proxy').value.trim()); } catch(e) {} }
function saveYuqueToken() { try { localStorage.setItem(STORAGE_KEY.YUQUE_TOKEN, document.getElementById('yuque-token').value.trim()); } catch(e) {} }
function saveYuqueUrl()   { try { localStorage.setItem(STORAGE_KEY.YUQUE_URL,   document.getElementById('yuque-url').value.trim());   } catch(e) {} }

function loadYuqueSettings() {
  try {
    const proxy = localStorage.getItem(STORAGE_KEY.YUQUE_PROXY);
    const token = localStorage.getItem(STORAGE_KEY.YUQUE_TOKEN);
    const url   = localStorage.getItem(STORAGE_KEY.YUQUE_URL);
    if (proxy) document.getElementById('yuque-proxy').value = proxy;
    if (token) document.getElementById('yuque-token').value = token;
    if (url)   document.getElementById('yuque-url').value   = url;
  } catch(e) {}
}

function setYuqueStatus(msg, loading = false, isError = false) {
  const box = document.getElementById('yuque-status');
  box.style.display = msg ? 'block' : 'none';
  document.getElementById('yuque-status-msg').innerHTML = msg;
  document.getElementById('yuque-status-msg').style.color = isError ? '#e53935' : '#555';
  document.getElementById('yuque-spinner').style.display = loading ? 'inline-flex' : 'none';
}

function getProxyBase() {
  let raw = (document.getElementById('yuque-proxy').value.trim() || 'http://127.0.0.1:3030').replace(/\/+$/, '');
  if (!raw.startsWith('http://') && !raw.startsWith('https://')) raw = 'https://' + raw;
  return raw;
}

function getYuqueBase() {
  const base = getProxyBase().replace(/\/+$/, '');
  return base.toLowerCase().includes('yuque') ? base : base + '/yuque';
}

async function yuqueFetch(path, token) {
  const base = getYuqueBase();
  const sep  = path.includes('?') ? '&' : '?';
  const url  = base + path + sep + 'token=' + encodeURIComponent(token);
  let resp, text;
  try { resp = await fetch(url); text = await resp.text(); } catch(e) { throw new Error(`网络请求失败：${e.message}`); }
  if (text.trim().startsWith('<')) throw new Error(`返回了 HTML 而非 JSON（${resp.status}），请检查代理地址`);
  let json;
  try { json = JSON.parse(text); } catch(e) { throw new Error(`JSON 解析失败（${resp.status}）：${text.slice(0, 100)}`); }
  if (resp.status === 401) throw new Error('Token 无效或已过期');
  if (resp.status === 403) throw new Error(`无权限（403）：${json?.message || ''}`);
  if (resp.status === 404) throw new Error(`文档不存在（404）：${path}`);
  if (!resp.ok) throw new Error(`请求失败（${resp.status}）：${json?.message || ''}`);
  return json;
}

async function testProxy() {
  const statusEl = document.getElementById('yuque-proxy-status');
  const btn = document.querySelector('[onclick="testProxy()"]');
  const proxy = getProxyBase();
  statusEl.innerHTML = '测试中…';
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try {
    await fetch(getYuqueBase() + '/api/v2/user', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    statusEl.innerHTML = `<span style="color:#2e7d32">✅ 代理在线（${proxy}）</span>`;
    saveYuqueProxy();
  } catch(e) {
    statusEl.innerHTML = `<span style="color:#e53935">❌ 无法连接代理：${e.message}</span>`;
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

async function testYuqueToken() {
  const token = document.getElementById('yuque-token').value.trim();
  const statusEl = document.getElementById('yuque-token-status');
  const btn = document.querySelector('[onclick="testYuqueToken()"]');
  if (!token) { statusEl.innerHTML = '<span style="color:#e53935">请先输入 Token</span>'; return; }
  statusEl.innerHTML = '验证中…';
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  try {
    const tryPaths = ['/api/v2/user', '/api/v2/users/me', '/api/v2/hello'];
    let lastError = '';
    for (const path of tryPaths) {
      try {
        const resp = await fetch(getYuqueBase() + path, { headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' } });
        const text = await resp.text();
        if (text.trim().startsWith('<')) { lastError = '接口返回了 HTML，跳过'; continue; }
        const json = JSON.parse(text);
        if (resp.ok && json?.data) {
          const name = json.data?.name || json.data?.login || json.data?.id || '用户';
          statusEl.innerHTML = `<span style="color:#2e7d32">✅ Token 有效，用户：${name}</span>`;
          saveYuqueToken(); return;
        }
        lastError = `接口 ${path} 返回 ${resp.status}：${json?.message || JSON.stringify(json).slice(0,80)}`;
      } catch(e) { lastError = e.message; }
    }
    statusEl.innerHTML = `<span style="color:#2e7d32">✅ 代理连接正常，可直接读取文档</span>`;
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

function parseYuqueUrl(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean);
    if (parts.length < 3) throw new Error('请粘贴到具体文档的链接（需包含文档路径）');
    return { namespace: parts[0] + '/' + parts[1], slug: parts[2].split('#')[0] };
  } catch(e) { throw new Error('链接格式有误：' + e.message); }
}

async function fetchYuqueDoc() {
  const token = document.getElementById('yuque-token').value.trim();
  const url   = document.getElementById('yuque-url').value.trim();
  if (!token) { setYuqueStatus('⚠️ 请先填写语雀 Token', false, true); return; }
  if (!url)   { setYuqueStatus('⚠️ 请输入文档链接', false, true); return; }

  const btn = document.getElementById('yuque-fetch-btn');
  btn.disabled = true; btn.style.opacity = '0.5';
  document.getElementById('btnConfirmYuque').style.display = 'none';
  document.getElementById('yuquePreview').style.display   = 'none';
  yuquePendingImport = [];

  try {
    const { namespace, slug } = parseYuqueUrl(url);
    setYuqueStatus('测试连接…', true);
    const testResp = await fetch(getYuqueBase() + '/api/v2/user', { headers: { 'X-Auth-Token': token, 'Content-Type': 'application/json' } });
    setYuqueStatus(`测试通过（${testResp.status}），正在读取文档…`, true);

    const docData = await yuqueFetch(`/api/v2/repos/${namespace}/docs/${slug}`, token);
    const doc = docData?.data;
    if (!doc) throw new Error('文档内容为空，请检查链接和 Token');
    const docTitle = doc.title || slug;
    const content  = doc.body_sheet || doc.body_html || doc.body || '';
    if (!content) throw new Error('文档正文为空，可能无权限或文档没有内容');

    let rawProjects;
    
    if (doc.body_sheet) {
      if (getParseMode() === 'ai') {
        setYuqueStatus(`已读取「${docTitle}」，🤖 AI 正在解析…`, true);
        const sheetData = JSON.parse(doc.body_sheet);
        const result = await parseTableWithClaude(sheetData?.data?.[0]?.table || [], docTitle);
        rawProjects = result.projects;
      } else {
        setYuqueStatus(`已读取「${docTitle}」，正在解析表格…`, true);
        const result = parseBodySheet(doc.body_sheet, docTitle);
        rawProjects = result.projects;
      }
    } else {
      setYuqueStatus(`已读取「${docTitle}」，🤖 AI 正在解析…`, true);
      rawProjects = await parseYuqueDocWithClaude(doc.body_html || doc.body || '', docTitle);
    }

    if (!Array.isArray(rawProjects) || !rawProjects.length) throw new Error('未识别到项目数据，请确认文档包含项目列表表格');

    yuquePendingImport = rawProjects.filter(p => p.name).map(p => ({
      ...p,
      stage: typeof p.stage === 'number' ? p.stage : (STAGE_MAP_YUQUE[p.stage] ?? 0),
      todos: [], collectTasks: [], logs: [], active: 'active',
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    }));
    


    renderYuquePreview(docTitle);
  } catch(e) {
    setYuqueStatus('❌ ' + e.message, false, true);
  } finally {
    btn.disabled = false; btn.style.opacity = '1';
  }
}

// AI 解析语雀 lakesheet 表格列名
async function parseTableWithClaude(table, docTitle) {
  if (!table.length) throw new Error('表格为空');
  const headers    = table[0];
  const sampleRows = table.slice(1, 4);

  // 检查是否有项目编号列（保留供外部判断，暂不使用）
  for (const h of headers) {
    if (h?.includes('项目编号') || h?.includes('编号')) break;
  }

  const prompt = `以下是项目管理表格的列名：\n${JSON.stringify(headers)}\n\n样本数据：\n${JSON.stringify(sampleRows)}\n\n请将列名映射到字段（不匹配跳过）：\n\n基本信息：\n- name: 项目名称\n- source: 项目来源/客户\n- owner: 负责人/销售\n- product: 产品选型/方案\n- desc: 项目简介/描述\n- stageLabel: 项目阶段/状态\n- active: 项目状态（active或inactive）\n- projectCode: 项目编号\n- contractDate: 合同签署日期\n\n财务信息：\n- quote: 报价金额（万元）\n- quote_yuan: 报价金额（元）\n- contract: 合同金额（万元）\n- contract_yuan: 合同金额（元）\n- cost: 成本评估（万元）\n- collected: 已回款（万元）\n\n只返回JSON对象，key是列名，value是字段名。`;

  let mapping = {};
  try {
    const data = await claudeCall({ task: '语雀表格列名识别', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
    const text = data._parsed?.text || data.content?.[0]?.text || '';
    const firstBrace = text.indexOf('{'), lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try { mapping = JSON.parse(text.substring(firstBrace, lastBrace + 1)); }
      catch(e) {
        const cb = text.match(/```json[\s\S]*?```/);
        if (cb) try { mapping = JSON.parse(cb[0].replace(/```json|```/g,'').trim()); } catch(e2) {}
      }
    }
  } catch(e) {}

  // 回退到固定映射
  if (!Object.keys(mapping).length) {
    headers.forEach((h, i) => { if (COL_MAP[h?.trim()]) mapping[h] = COL_MAP[h.trim()]; });
    if (!Object.values(mapping).includes('name')) {
      const nameCol = headers.find(h => h?.includes('项目') && h?.includes('名称'))
        || headers.find(h => h?.includes('项目'))
        || headers.find(h => h?.includes('名称'))
        || headers[0];
      if (nameCol) mapping[nameCol] = 'name';
    }
  }

  // 确保项目编号列映射
  if (!Object.values(mapping).includes('projectCode')) {
    const codeCol = headers.find(h => h?.includes('项目编号') || h?.includes('编号'));
    if (codeCol) mapping[codeCol] = 'projectCode';
  }

  const result = table.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const field = mapping[h];
      if (!field) return;
      let val = String(row[i] || '').trim();
      if (field.endsWith('_yuan')) {
        const n = parseFloat(val);
        obj[field.replace('_yuan', '')] = isNaN(n) ? '' : (n / 10000).toFixed(2);
      } else { obj[field] = val; }
    });
    return _parseRowObj(obj);
  }).filter(p => p.name);

  if (!result.length) throw new Error('未能从表格中识别到项目数据，请确保表格包含项目名称列');
  return { projects: result };
}

// 模板模式解析 lakesheet body_sheet
function parseBodySheet(bodySheetStr, docTitle) {
  const sheetData = JSON.parse(bodySheetStr);
  const sheets    = sheetData.data || [];
  const results   = [];
  const LOCAL_COL_MAP = {
    '项目名称': 'name', '名称': 'name',
    '项目编号': 'projectCode', '编号': 'projectCode',
    '项目来源': 'channel', '来源': 'channel', '客户来源': 'channel',
    '客户名称': 'source', '客户': 'source',
    '负责人': 'owner', '销售': 'owner', '业务员': 'owner',
    '产品选型': 'product', '产品': 'product', '方案': 'product',
    '项目简介': 'desc', '简介': 'desc', '描述': 'desc', '备注': 'desc',
    '项目阶段': 'stage', '阶段': 'stage', '状态': 'stage',
    '合同签署日期': 'contractDate', '合同日期': 'contractDate', '签署日期': 'contractDate',
    '报价金额': 'quote', '报价': 'quote', '报价金额(万元)': 'quote', '报价金额（万元）': 'quote',
    '合同金额': 'contract', '合同': 'contract', '合同金额(万元)': 'contract', '合同金额（万元）': 'contract',
    '成本评估': 'cost', '成本': 'cost', '成本评估(万元)': 'cost', '成本评估（万元）': 'cost',
    '已回款金额': 'collected', '已回款': 'collected', '回款金额': 'collected',
    '报价金额/元': 'quote_yuan', '报价金额(元)': 'quote_yuan', '报价金额（元）': 'quote_yuan',
    '合同金额/元': 'contract_yuan', '合同金额(元)': 'contract_yuan', '合同金额（元）': 'contract_yuan',
    '成本评估/元': 'cost_yuan', '成本评估(元)': 'cost_yuan', '成本评估（元）': 'cost_yuan',
    '已回款金额/元': 'collected_yuan', '已回款金额(元)': 'collected_yuan',
  };
  const YUAN_FIELDS = new Set(['quote_yuan','contract_yuan','cost_yuan','collected_yuan']);

  for (const sheet of sheets) {
    const table = sheet.table || [];
    if (table.length < 2) continue;
    const headers  = table[0];
    const colIndex = {};
    
    headers.forEach((h, i) => { 
      const key = LOCAL_COL_MAP[h?.trim()]; 
      if (key) {
        colIndex[key] = i;
      }
    });
    
    if (!colIndex.name) continue;

    for (let r = 1; r < table.length; r++) {
      const row  = table[r];
      const name = row[colIndex.name]?.trim();
      if (!name) continue;
      const p = { name };
      for (const [field, idx] of Object.entries(colIndex)) {
        if (field === 'name') continue;
        const raw = String(row[idx] ?? '').trim();
        if (YUAN_FIELDS.has(field)) {
          const n = parseFloat(raw);
          p[field.replace('_yuan', '')] = isNaN(n) ? '' : (n / 10000).toFixed(4).replace(/\.?0+$/, '');
        } else { p[field] = raw; }
      }
      const stageRaw = p.stage || '';
      const numPfx   = stageRaw.match(/^(\d+)/)?.[1];
      p.stage = (numPfx === '2' || stageRaw.includes('执行') || stageRaw.includes('已签')) ? '已签单·执行中'
              : (numPfx === '3' || stageRaw.includes('完结') || stageRaw.includes('完成')) ? '已完结'
              : '洽谈中';
      results.push(p);
    }
  }
  if (!results.length) throw new Error(`未在「${docTitle}」中找到项目数据`);
  return { projects: results };
}

// AI 解析普通语雀文档
async function parseYuqueDocWithClaude(content, title) {
  const data = await claudeCall({
    task: '语雀文档解析',
    max_tokens: 4000,
    messages: [{ role: 'user', content: `你是项目数据提取助手。从语雀文档内容中提取项目列表表格，返回 JSON 数组。\n字段：name, source, owner, product, desc, stage(洽谈中/已签单·执行中/已完结), quote(万元), contract(万元), cost(万元), collected(万元)。只返回JSON数组。\n\n文档：${title}\n\n${content.slice(0, 14000)}` }]
  });
  if (data.error) throw new Error('AI 解析失败：' + data.error.message);
  const text = (data._parsed?.text || data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '').replace(/```json|```/g, '').trim();
  return JSON.parse(text);
}

function renderYuquePreview(docTitle) {
  if (!yuquePendingImport.length) { setYuqueStatus('⚠️ 未识别到项目数据', false, true); return; }
  setYuqueStatus(`✅ 从「${docTitle}」识别到 <b>${yuquePendingImport.length}</b> 个项目`, false);

  const existNames  = new Set(projects.map(p => p.name));
  const stageNames  = ['洽谈中','已签单·执行中','已完结'];
  const fieldLabels = { name:'项目名称', stage:'阶段', channel:'项目来源', source:'客户名称', owner:'负责人', product:'产品选型', desc:'项目简介', quote:'报价（万）', contract:'合同（万）', cost:'成本（万）', collected:'已回款（万）', projectCode:'项目编号', contractDate:'合同日期', deliveryBrief:'交付内容', deliveryNote:'交付详情' };
  const SKIP = new Set(['id','todos','collectTasks','logs','active']);

  const fieldStats = {};
  yuquePendingImport.forEach(p => { Object.keys(p).forEach(f => { if (!SKIP.has(f) && p[f] && String(p[f]).trim()) fieldStats[f] = (fieldStats[f] || 0) + 1; }); });
  const visibleFields = Object.keys(fieldStats).filter(f => fieldStats[f] > 0);
  if (visibleFields.includes('name')) { visibleFields.splice(visibleFields.indexOf('name'), 1); visibleFields.unshift('name'); }

  document.getElementById('yuqueHead').innerHTML = '<tr><th>状态</th>' + visibleFields.map(f => `<th>${fieldLabels[f] || f}</th>`).join('') + '</tr>';
  document.getElementById('yuqueBody').innerHTML = yuquePendingImport.map(p =>
    '<tr><td>' + (existNames.has(p.name) ? '<span class="tag-update">↻ 更新</span>' : '<span class="tag-new">＋ 新增</span>') + '</td>'
    + visibleFields.map(f => `<td>${f === 'stage' ? (stageNames[p.stage] || '-') : (String(p[f] || '').trim() || '-')}</td>`).join('') + '</tr>'
  ).join('');
  document.getElementById('yuquePreview').style.display      = 'block';
  document.getElementById('btnConfirmYuque').style.display   = 'inline-block';
}

async function confirmYuqueImport() {
  if (!yuquePendingImport.length) return;
  let added = 0, updated = 0;

  yuquePendingImport.forEach(p => {
    let idx = -1;
    if (p.projectCode) {
      idx = projects.findIndex(x => x.projectCode === p.projectCode);
    }
    if (idx === -1) {
      idx = projects.findIndex(x => x.name === p.name);
    }
    if (idx >= 0) {
      projects[idx] = { ...projects[idx], ...p, id: projects[idx].id };
      updated++;
    } else {
      if (!p.projectCode) p.projectCode = genProjectCode(p.stage || 0, p.contractDate || '');
      projects.push(p);
      added++;
    }
  });

  document.getElementById('btnExportProjectCodes').style.display = 'inline-block';
  showToast(`语雀导入：新增 ${added} 个，更新 ${updated} 个`);
  exportExcelWithProjectCodes(); // 自动触发下载
  closeImport(); save(); refreshView();
}

// ── Excel 文本读取（供文件识别模块使用）──

async function readExcelText(file) {
  try {
    const data     = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    let text = '';
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const json  = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      text += `\n\n【Sheet：${sheetName}】\n`;
      json.forEach(row => { text += row.filter(c => c !== undefined && c !== null).join('\t') + '\n'; });
    });
    return text;
  } catch(e) {
    return '【Excel读取失败】';
  }
}

export {
  // Excel 导入
  openImport,
  closeImport,
  initImportDropZone,
  handleFile,
  parseExcel,
  showImportError,
  confirmImport,
  downloadTemplate,
  exportExcelWithProjectCodes,
  switchImportTab,
  // 解析模式
  getParseMode,
  saveParseMode,
  loadParseMode,
  // 语雀导入
  saveYuqueProxy,
  saveYuqueToken,
  saveYuqueUrl,
  loadYuqueSettings,
  setYuqueStatus,
  getProxyBase,
  getYuqueBase,
  yuqueFetch,
  testProxy,
  testYuqueToken,
  parseYuqueUrl,
  fetchYuqueDoc,
  parseTableWithClaude,
  parseBodySheet,
  parseYuqueDocWithClaude,
  renderYuquePreview,
  confirmYuqueImport,
  // Excel 文本读取
  readExcelText
};
