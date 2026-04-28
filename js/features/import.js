// ╔══════════════════════════════════════════╗
// ║  MODULE: import（数据导入）              ║
// ╚══════════════════════════════════════════╝

// ── 常量 ──────────────────────────────────

const DEBUG = true;

const STAGE_MAP_IMPORT = {
  '洽谈推进中':0,'洽谈中':0,'跟进中':0,
  '已签单·执行中':1,'已签单执行中':1,'已签单·回款中':1,'已执行·回款中':1,'已执行·汇款中':1,
  '执行中':1,'签单中':1,'已签单':1,'交付中':1,
  '已完结':2
};

const COL_MAP = {
  '项目名称':     'name',  '项目名称*': 'name',
  '项目来源':     'channel','客户名称': 'customer',
  '负责人':       'owner',
  '产品类型':     'product','产品选型': 'product',
  '项目简介':     'desc',  '项目阶段':  'stageLabel',
  '报价金额':     'quote', '报价金额(万元)':'quote','报价金额(元)':'quote_yuan','报价金额/元':'quote_yuan',
  '合同金额':     'contract','合同金额(万元)':'contract','合同金额(元)':'contract_yuan','合同金额/元':'contract_yuan',
  '成本评估':     'cost',  '成本评估(万元)':'cost','成本评估(元)':'cost_yuan',
  '已回款金额(万元)':'collected','已回款金额':'collected',
  '合同签署日期': 'contractDate', '合同日期': 'contractDate', '签署日期': 'contractDate', '合同时间': 'contractDate', '签单时间': 'contractDate', '签约日期': 'contractDate',
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
let yuqueRawTableData = null; // 存储原始表格数据，用于提取进度

// ── Excel 导入 ────────────────────────────

function openImport()  { 
  document.getElementById('importOverlay').classList.add('show'); 
}
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
  else if (numPrefix === '2') { obj.stage = STAGE.DELIVERING; addDefaultPaymentNode(obj); }
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
  // 不使用外部导入的active字段，由系统自行判断
  delete obj.active;
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

    // 识别进度列
    const progressColMap = await identifyProgressColumns(headers);
    if (DEBUG) {
      if (DEBUG) console.log('识别到的进度列:', progressColMap);
    }

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
      // 提取进度数据
      const progress = extractProgressFromRow(r, headers, progressColMap);
      if (progress.length > 0) {
        obj.monthlyProgress = progress;
      }
      const result = _parseRowObj(obj);
      return result;
    }).filter(p => p.name);

    _renderImportPreview(filename);
  } catch(err) {
    showImportError('解析失败：' + err.message);
  }
}

// 判断项目数据是否有实质性的变化（排除空值和无关字段）
function hasProjectChanged(existing, incoming) {
  const importantFields = ['name', 'customer', 'owner', 'product', 'desc', 'stage', 'quote', 'contract', 'cost', 'collected', 'channel', 'contractDate'];

  for (const field of importantFields) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // 只有当导入值不是 undefined 时，才比较差异
    if (incomingVal !== undefined) {
      // 格式化值，与 getProjectChanges 函数保持一致
      let formattedExisting = existingVal;
      let formattedIncoming = incomingVal;
      
      // 处理金额值，保留4位小数
      if (['quote', 'contract', 'cost', 'collected'].includes(field)) {
        if (existingVal) {
          const num = parseFloat(existingVal);
          formattedExisting = isNaN(num) ? existingVal : num.toFixed(4);
        }
        if (incomingVal) {
          const num = parseFloat(incomingVal);
          formattedIncoming = isNaN(num) ? incomingVal : num.toFixed(4);
        }
      }
      
      // 如果两边都有值且不相等，说明有变化
      if (formattedExisting && formattedIncoming && String(formattedExisting).trim() !== String(formattedIncoming).trim()) {
        return true;
      }
      // 如果系统中没有值但导入中有值，也算变化
      if (!formattedExisting && formattedIncoming) {
        return true;
      }
    }
  }
  
  // 检查进度数据是否有变化
  const existingProgress = existing.monthlyProgress || [];
  const incomingProgress = incoming.monthlyProgress || [];
  
  // 只有当导入的进度数据不是 undefined 时，才比较差异
  if (incomingProgress !== undefined) {
    if (existingProgress.length !== incomingProgress.length) {
      return true;
    }
    
    // 检查进度内容是否有变化
    for (let i = 0; i < existingProgress.length; i++) {
      const existingItem = existingProgress[i];
      const incomingItem = incomingProgress[i];
      if (incomingItem && (existingItem.month !== incomingItem.month || existingItem.content !== incomingItem.content)) {
        return true;
      }
    }
  }
  
  return false;
}

// 获取项目的最新进度时间
function getLatestProgressTime(project) {
  const progress = project.monthlyProgress || [];
  if (progress.length === 0) return null;
  
  // 按月份排序，最新的在前面
  const sortedProgress = [...progress].sort((a, b) => {
    const [yearA, monthA] = a.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    const [yearB, monthB] = b.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    return yearB - yearA || monthB - monthA;
  });
  
  return sortedProgress[0].month;
}

// 获取项目的变化内容
function getProjectChanges(existing, incoming) {
  const fieldLabels = {
    'name': '项目名称',
    'customer': '客户名称',
    'owner': '负责人',
    'product': '产品选型',
    'desc': '项目简介',
    'stage': '项目阶段',
    'quote': '报价金额',
    'contract': '合同金额',
    'cost': '成本评估',
    'collected': '已回款金额',
    'channel': '项目来源',
    'contractDate': '合同日期'
  };
  
  const stageLabels = {
    0: '洽谈中',
    1: '已签单·执行中',
    2: '已完结'
  };
  
  const importantFields = ['name', 'customer', 'owner', 'product', 'desc', 'stage', 'quote', 'contract', 'cost', 'collected', 'channel', 'contractDate'];
  const changes = [];
  
  for (const field of importantFields) {
    const existingVal = existing[field];
    const incomingVal = incoming[field];

    // 只有当导入值不是 undefined 时，才比较差异
    if (incomingVal !== undefined) {
      // 格式化值
      let formattedExisting = existingVal;
      let formattedIncoming = incomingVal;
      
      // 处理阶段值
      if (field === 'stage') {
        formattedExisting = stageLabels[existingVal] || existingVal || '无';
        formattedIncoming = stageLabels[incomingVal] || incomingVal || '无';
      }
      // 处理金额值，保留4位小数
      else if (['quote', 'contract', 'cost', 'collected'].includes(field)) {
        if (existingVal) {
          const num = parseFloat(existingVal);
          formattedExisting = isNaN(num) ? existingVal : num.toFixed(4);
        }
        if (incomingVal) {
          const num = parseFloat(incomingVal);
          formattedIncoming = isNaN(num) ? incomingVal : num.toFixed(4);
        }
      }
      
      // 如果两边都有值且不相等，说明有变化
      if (formattedExisting && formattedIncoming && String(formattedExisting).trim() !== String(formattedIncoming).trim()) {
        changes.push(`${fieldLabels[field] || field}: ${String(formattedExisting).trim()} → ${String(formattedIncoming).trim()}`);
      }
      // 如果系统中没有值但导入中有值，也算变化
      if (!formattedExisting && formattedIncoming) {
        changes.push(`${fieldLabels[field] || field}: 无 → ${String(formattedIncoming).trim()}`);
      }
    }
  }
  
  // 检查进度数据是否有变化
  const existingProgress = existing.monthlyProgress || [];
  const incomingProgress = incoming.monthlyProgress || [];
  
  // 只有当导入的进度数据不是 undefined 时，才比较差异
  if (incomingProgress !== undefined && incomingProgress.length > 0) {
    // 按日期排序获取最新进度（降序，最新的在前）
    const sortedProgress = [...incomingProgress].sort((a, b) => {
      const [yearA, monthA] = (a.month || '').match(/(\d{4})年(\d+)月/)?.slice(1).map(Number) || [0, 0];
      const [yearB, monthB] = (b.month || '').match(/(\d{4})年(\d+)月/)?.slice(1).map(Number) || [0, 0];
      return yearB - yearA || monthB - monthA; // 降序排列
    });
    const latestProgress = sortedProgress[0];
    
    if (existingProgress.length !== incomingProgress.length) {
      // 进度条数有变化，显示最新进度详情
      const progressInfo = latestProgress 
        ? `📋 进度更新：${latestProgress.month || '未知日期'} - ${(latestProgress.content || '').substring(0, 50)}${(latestProgress.content || '').length > 50 ? '...' : ''}（共 ${incomingProgress.length} 条）`
        : `进度数据: ${existingProgress.length} 条 → ${incomingProgress.length} 条`;
      changes.push(progressInfo);
    } else if (existingProgress.length > 0) {
      // 检查是否有进度内容变化
      let progressChanged = false;
      for (let i = 0; i < existingProgress.length; i++) {
        const existingItem = existingProgress[i];
        const incomingItem = incomingProgress[i];
        if (incomingItem && (existingItem.month !== incomingItem.month || existingItem.content !== incomingItem.content)) {
          progressChanged = true;
          break;
        }
      }
      if (progressChanged && latestProgress) {
        // 显示最新进度详情
        changes.push(`📋 进度更新：${latestProgress.month || '未知日期'} - ${(latestProgress.content || '').substring(0, 50)}${(latestProgress.content || '').length > 50 ? '...' : ''}`);
      }
    }
  }
  
  return changes;
}

function _renderImportPreview(filename) {
  // 判断项目是新增还是更新：通过唯一代码或项目编号匹配
  const existCodes = new Set(projects.map(p => p.projectCode).filter(Boolean));
  const existUniqueCodes = new Set(projects.map(p => p.projectCode ? p.projectCode.slice(-4) : null).filter(Boolean));
  const existNames = new Set(projects.map(p => p.name).filter(Boolean));

  const stageNames  = ['洽谈中','已签单·执行中','已完结'];
  const fieldLabels = { name:'项目名称', stage:'阶段', channel:'项目来源', customer:'客户名称', owner:'负责人', product:'产品选型', desc:'项目简介', quote:'报价（万）', contract:'合同（万）', cost:'成本（万）', collected:'已回款（万）', projectCode:'项目编号', uniqueCode:'唯一代码', contractDate:'合同日期', deliveryBrief:'交付内容', deliveryNote:'交付详情', monthlyProgress:'项目进度', paymentNodes:'回款节点' };
  const SKIP = new Set(['id','todos','collectTasks','logs','active']);

  const fieldStats = {};
  pendingImport.forEach(p => {
    Object.keys(p).forEach(f => {
      if (!SKIP.has(f)) {
        if (f === 'monthlyProgress') {
          if (p[f] && p[f].length > 0) {
            fieldStats[f] = (fieldStats[f] || 0) + 1;
          }
        } else if (p[f] && String(p[f]).trim()) {
          fieldStats[f] = (fieldStats[f] || 0) + 1;
        }
      }
    });
  });
  const visibleFields = Object.keys(fieldStats).filter(f => fieldStats[f] > 0);
  if (visibleFields.includes('name')) { visibleFields.splice(visibleFields.indexOf('name'), 1); visibleFields.unshift('name'); }

  document.getElementById('importHead').innerHTML = '<tr><th>状态</th>' + visibleFields.map(f => `<th>${fieldLabels[f] || f}</th>`).join('') + '</tr>';

  let bodyHtml = pendingImport.slice(0, 10).map(p => {
    // 通过唯一代码、项目编号或项目名称判断是否已存在
    let isExisting = (p.uniqueCode && existUniqueCodes.has(p.uniqueCode)) ||
                     (p.projectCode && existCodes.has(p.projectCode)) ||
                     (p.name && existNames.has(p.name));
    let statusTag = '<span class="tag-new">＋ 新增</span>';

    if (isExisting) {
      // 找到现有项目，判断是否有实质变化
      const existingProject = projects.find(x =>
        (p.uniqueCode && x.projectCode && x.projectCode.endsWith(p.uniqueCode)) ||
        (p.projectCode && x.projectCode === p.projectCode) ||
        (p.name && x.name === p.name)
      );
      if (existingProject && hasProjectChanged(existingProject, p)) {
        statusTag = '<span class="tag-update">↻ 更新</span>';
      } else {
        statusTag = '<span class="tag-unchanged">＝ 无变化</span>';
      }
    }

    return '<tr><td>' + statusTag + '</td>'
      + visibleFields.map(f => {
          if (f === 'stage') {
            return `<td>${stageNames[p.stage] || '-'}</td>`;
          } else if (f === 'monthlyProgress') {
            const progress = p.monthlyProgress || [];
            if (progress.length === 0) {
              return '<td>-</td>';
            } else {
              const latestProgress = progress[progress.length - 1];
              return `<td style="font-size:.7rem;line-height:1.2">${latestProgress.month}: ${latestProgress.content.substring(0, 30)}${latestProgress.content.length > 30 ? '...' : ''}</td>`;
            }
          } else {
            return `<td>${String(p[f] || '').trim() || '-'}</td>`;
          }
        }).join('') + '</tr>';
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

async function confirmImport() {
  if (!pendingImport.length) return;
  let added = 0, updated = 0, progressUpdated = 0;
  let hasNewCodeGenerated = false; // 是否有新生成的唯一代码

  // 本次导入中已生成的唯一代码集合
  const usedCodesInThisImport = new Set();
  // 记录本次新增的项目id，用于活跃度分析时区分新旧项目
  const newProjectIds = new Set();

  pendingImport.forEach(p => {
    let idx = -1;
    // 优先通过唯一代码匹配
    if (p.uniqueCode) {
      idx = projects.findIndex(x => x.projectCode && x.projectCode.endsWith(p.uniqueCode));
    }
    // 其次通过完整项目编号匹配
    if (idx === -1 && p.projectCode) {
      idx = projects.findIndex(x => x.projectCode === p.projectCode);
    }
    // 最后通过项目名称匹配
    if (idx === -1 && p.name) {
      idx = projects.findIndex(x => x.name === p.name);
    }

    if (idx >= 0) {
      // 检查项目是否有变化
      const existingProject = projects[idx];
      if (hasProjectChanged(existingProject, p)) {
        // 更新时保留原有唯一代码
        const oldCode = existingProject.projectCode || '';
        const oldUniqueCode = oldCode.slice(-4);
        if (p.projectCode && !p.projectCode.endsWith(oldUniqueCode)) {
          p.projectCode = p.projectCode.slice(0, -4) + oldUniqueCode;
        }
        // 合并进度数据
        if (p.monthlyProgress && p.monthlyProgress.length > 0) {
          const existingProgress = existingProject.monthlyProgress || [];
          const mergedProgress = mergeMonthlyProgress(existingProgress, p.monthlyProgress);
          p.monthlyProgress = mergedProgress;
          progressUpdated++;
        }
        projects[idx] = { ...existingProject, ...p, id: existingProject.id };
        updated++;
      }
    } else {
      // 新项目：如果有 uniqueCode 则使用它，否则生成新的
      if (!p.projectCode) {
        const stage = p.stage || 0;
        const contractDate = p.contractDate || '';
        const now = new Date();
        let ym;
        if (stage === 0) {
          ym = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0');
        } else {
          const d = contractDate ? new Date(contractDate) : now;
          ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
        }
        const prefix = stage === 0 ? 'C' : 'P';

        // 如果有 uniqueCode 则使用它，否则生成新的
        let uniqueCode = p.uniqueCode;
        if (!uniqueCode) {
          // 生成新代码
          hasNewCodeGenerated = true;
          // 检查系统中和本次导入中是否已存在相同代码
          let attempt = 0;
          do {
            uniqueCode = genIdCode();
            attempt++;
          } while (
            (projects.some(x => x.projectCode === prefix + ym + uniqueCode) ||
             usedCodesInThisImport.has(prefix + ym + uniqueCode)) &&
            attempt < 100
          );
          usedCodesInThisImport.add(prefix + ym + uniqueCode);
        }

        p.projectCode = prefix + ym + uniqueCode;
        // 使用唯一代码作为项目 id
        p.id = uniqueCode;
      } else if (p.uniqueCode && !usedCodesInThisImport.has(p.projectCode)) {
        // 有 uniqueCode 但没有完整 projectCode 的情况（使用已有代码）
        usedCodesInThisImport.add(p.projectCode);
        // 使用唯一代码作为项目 id
        p.id = p.uniqueCode;
      }

      // 初始化进度数据（如果没有）
      if (!p.monthlyProgress) {
        p.monthlyProgress = [];
      }

      // 新项目默认活跃度为active
      p.active = 'active';

      projects.push(p);
      added++;
      newProjectIds.add(p.id); // 记录新增项目id
    }
  });
  // 收集新增和更新的项目信息
  const addedProjects = [];
  const updatedProjects = [];
  const activeChanges = { activeAdded: 0, inactiveAdded: 0 };
  
  // 分析活跃度变化（新增项目跳过，它们已经在上面设为 active）
  projects.forEach(project => {
    if (window.updateProjectActivity) {
      const isNew = newProjectIds.has(project.id);
      const oldActive = project.active;
      window.updateProjectActivity(project, isNew);
      if (oldActive !== project.active) {
        if (project.active === 'active') {
          activeChanges.activeAdded++;
          project._justActivated = true;
        } else {
          activeChanges.inactiveAdded++;
          project._justDeactivated = true;
        }
      }
    }
  });
  
  // 收集新增和更新的项目
  pendingImport.forEach(p => {
    let isAdded = true;
    let idx = -1;
    
    // 优先通过唯一代码匹配
    if (p.uniqueCode) {
      idx = projects.findIndex(x => x.projectCode && x.projectCode.endsWith(p.uniqueCode));
    }
    // 其次通过完整项目编号匹配
    if (idx === -1 && p.projectCode) {
      idx = projects.findIndex(x => x.projectCode === p.projectCode);
    }
    // 最后通过项目名称匹配
    if (idx === -1 && p.name) {
      idx = projects.findIndex(x => x.name === p.name);
    }
    
    if (idx >= 0) {
      updatedProjects.push(projects[idx]);
      isAdded = false;
    } else {
      // 找到新增的项目
      const newProject = projects.find(x => x.projectCode === p.projectCode);
      if (newProject) {
        addedProjects.push(newProject);
      }
    }
  });
  
  // 显示确认弹窗
  await showImportConfirmation(added, updated, progressUpdated, addedProjects, updatedProjects, activeChanges);
  
  closeImport(); save(); refreshView();

  // 导入完成后自动关联文件夹
  if (window.fsRootHandle && added > 0) {
    const newlyAdded = projects.slice(-added);
    const matches = [];
    
    for (const p of newlyAdded) {
      const existingDir = await getProjectDirById(p.id);
      if (existingDir) continue;
      const candidates = await matchExistingDirs(p.name, p.channel);
      if (candidates.length > 0) {
        matches.push({ projectId: p.id, projectName: p.name, candidates });
      } else {
        await createProjectDir(p);
      }
    }
    
    if (matches.length > 0) {
      openFolderMatch(matches);
    }
  }

  // 有新生成的唯一代码时导出
  if (hasNewCodeGenerated) {
    exportExcelWithProjectCodes(pendingImport.map(p => ({
      '项目名称': p.name,
      '唯一代码': p.projectCode ? p.projectCode.slice(-4) : ''
    })));
  }
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

// 导出带项目唯一代码的项目列表
function exportExcelWithProjectCodes(data) {
  const exportData = data || yuquePendingImport.map(p => ({
    '项目名称': p.name,
    '唯一代码': p.projectCode ? p.projectCode.slice(-4) : ''
  }));
  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '唯一代码');
  XLSX.writeFile(wb, '项目唯一代码.xlsx');
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
function saveYuqueToken() {
  const token = document.getElementById('yuque-token').value.trim();
  try {
    localStorage.setItem(STORAGE_KEY.YUQUE_TOKEN, token);
    // 同时保存到安全存储
    if (typeof window.saveSecureConfig === 'function') {
      window.saveSecureConfig(STORAGE_KEY.YUQUE_TOKEN, token);
    }
  } catch(e) {}
}
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
        yuqueRawTableData = sheetData?.data?.[0]?.table;
        const result = await parseTableWithClaude(yuqueRawTableData || [], docTitle);
        rawProjects = result.projects;
        // 缓存进度列映射
        if (result.progressColMap) {
          window.yuqueProgressColMap = result.progressColMap;
        }
      } else {
        setYuqueStatus(`已读取「${docTitle}」，正在解析表格…`, true);
        const sheetData = JSON.parse(doc.body_sheet);
        yuqueRawTableData = sheetData?.data?.[0]?.table;
        const result = parseBodySheet(doc.body_sheet, docTitle);
        rawProjects = result.projects;
        // 识别进度列
        const headers = yuqueRawTableData?.[0];
        if (headers) {
          const progressColMap = await identifyProgressColumns(headers);
          window.yuqueProgressColMap = progressColMap;
        }
      }
    } else {
      setYuqueStatus(`已读取「${docTitle}」，🤖 AI 正在解析…`, true);
      rawProjects = await parseYuqueDocWithClaude(doc.body_html || doc.body || '', docTitle);
      // 对于非表格文档，无法提取进度数据，重置相关变量
      yuqueRawTableData = null;
      window.yuqueProgressColMap = null;
    }

    if (!Array.isArray(rawProjects) || !rawProjects.length) throw new Error('未识别到项目数据，请确认文档包含项目列表表格');

    yuquePendingImport = rawProjects.filter(p => p.name).map(p => {
      // 创建项目对象，不包含AI解析的active字段
      const { active, paymentNodes, ...rest } = p;
      const project = {
        ...rest,
        stage: typeof p.stage === 'number' ? p.stage : (STAGE_MAP_YUQUE[p.stage] ?? 0),
        todos: [], collectTasks: [], logs: [], active: 'active',
        monthlyProgress: p.monthlyProgress || [] // 使用从AI解析中获取的进度数据
      };
      
      // 为表格文档提取进度数据
      if (window.yuqueProgressColMap && yuqueRawTableData) {
        const headers = yuqueRawTableData[0];
        // 动态找到项目名称列的索引
        const nameColIndex = headers.findIndex(h => h?.includes('项目') && h?.includes('名称'))
          || headers.findIndex(h => h?.includes('项目'))
          || headers.findIndex(h => h?.includes('名称'))
          || 0;
        
        // 找到当前项目在原始表格中的行
        for (let r = 1; r < yuqueRawTableData.length; r++) {
          const row = yuqueRawTableData[r];
          
          // 优先使用唯一代码匹配，其次使用项目名称匹配
          let isMatch = false;
          if (p.uniqueCode) {
            // 查找唯一代码列
            const uniqueCodeColIndex = headers.findIndex(h => h?.includes('唯一代码'));
            if (uniqueCodeColIndex !== -1) {
              const rowUniqueCode = row[uniqueCodeColIndex]?.trim();
              isMatch = rowUniqueCode === p.uniqueCode;
            }
          }
          // 如果唯一代码匹配失败，使用项目名称匹配
          if (!isMatch) {
            const rowName = row[nameColIndex]?.trim();
            isMatch = rowName === p.name;
          }
          
          if (isMatch) {
            const incomingProgress = extractProgressFromRow(row, headers, window.yuqueProgressColMap);
            if (incomingProgress.length > 0) {
              project.monthlyProgress = incomingProgress;
            }
            break;
          }
        }
      }
      
      // 只保留非默认的回款节点
      if (paymentNodes && Array.isArray(paymentNodes) && paymentNodes.length > 0) {
        const nonDefaultNodes = paymentNodes.filter(node => 
          node.condition !== '验收后结清' || node.ratio !== '100%'
        );
        if (nonDefaultNodes.length > 0) {
          project.paymentNodes = nonDefaultNodes;
        }
      }
      
      return project;
    });
    


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

  const prompt = `以下是项目管理表格的列名：\n${JSON.stringify(headers)}\n\n样本数据：\n${JSON.stringify(sampleRows)}\n\n请将列名映射到字段（不匹配跳过）：\n\n基本信息：\n- name: 项目名称\n- customer: 客户名称/客户\n- owner: 负责人/销售\n- product: 产品选型/方案\n- desc: 项目简介/描述\n- stageLabel: 项目阶段/状态\n- active: 项目状态（active或inactive）\n- projectCode: 项目编号\n- uniqueCode: 项目唯一代码/唯一代码\n- contractDate: 合同签署日期/合同时间/签单时间/签约日期（注意：不是对接时间、交付时间、开始时间等）\n\n财务信息：\n- quote: 报价金额（万元）\n- quote_yuan: 报价金额（元）\n- contract: 合同金额（万元）\n- contract_yuan: 合同金额（元）\n- cost: 成本评估（万元）\n- cost_yuan: 成本评估（元）\n- collected: 已回款（万元）\n\n只返回JSON对象，key是列名，value是字段名。`;

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

  // 确保唯一代码列映射
  if (!Object.values(mapping).includes('uniqueCode')) {
    const uniqueCol = headers.find(h => h?.includes('唯一代码') || h?.includes('项目唯一代码'));
    if (uniqueCol) mapping[uniqueCol] = 'uniqueCode';
  }

  const result = table.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      const field = mapping[h];
      if (!field) return;
      let val = String(row[i] || '').trim();
      if (field.endsWith('_yuan')) {
        const n = parseFloat(val);
        obj[field.replace('_yuan', '')] = isNaN(n) ? '' : (n / 10000).toFixed(4);
      } else if (['quote', 'contract', 'cost', 'collected'].includes(field)) {
        // 对于金额字段，保留4位小数
        const n = parseFloat(val);
        obj[field] = isNaN(n) ? val : n.toFixed(4);
      } else { 
        obj[field] = val; 
      }
    });
    return _parseRowObj(obj);
  }).filter(p => p.name);

  if (!result.length) throw new Error('未能从表格中识别到项目数据，请确保表格包含项目名称列');
  
  // 识别进度列
  const progressColMap = await identifyProgressColumns(headers);
  window.yuqueProgressColMap = progressColMap;
  
  return { projects: result, progressColMap };
}

// 识别进度列并标准化月份
async function identifyProgressColumns(headers) {
  if (!headers || !headers.length) return {};

  const currentYear = new Date().getFullYear();
  const prompt = `以下是一个项目管理表格的列名列表：\n${JSON.stringify(headers)}\n\n请识别其中属于"项目进度/项目动态/本月进展"类型的列，并将其对应的月份标准化为"YYYY年M月"格式。\n规则：\n- 如果列名中有完整年月（如"2026年3月"、"2025.6"、"25年3月"），直接提取\n- 如果列名中只有月份没有年份（如"3月进展"、"三月进度"），用当前年份 ${currentYear} 补全\n- 如果列名中只有年份（如"2025年及以前"、"2024年以前"），将其视为该年份的12月\n- 如果无法判断是进度列，返回 null\n- 只返回 JSON 对象，key 是原始列名，value 是标准化月份字符串或 null\n\n示例输出：\n{\n  "本月进展（2026年3月）": "2026年3月",\n  "本月进展（2025年6月）": "2025年6月",\n  "3月进度": "${currentYear}年3月",\n  "2025.2进展": "2025年2月",\n  "2025年及以前": "2025年12月",\n  "2024年以前": "2024年12月",\n  "负责人": null,\n  "项目名称": null\n}`;

  try {
    const data = await claudeCall({ task: '进度列识别', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] });
    const text = data._parsed?.text || data.content?.[0]?.text || '';
    const firstBrace = text.indexOf('{'), lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch(e) {
        const cb = text.match(/```json[\s\S]*?```/);
        if (cb) try {
          return JSON.parse(cb[0].replace(/```json|```/g,'').trim());
        } catch(e2) {}
      }
    }
  } catch(e) {
    if (DEBUG) console.error('识别进度列失败:', e);
  }

  // 回退：手动识别包含月份的列
  const result = {};
  const monthPatterns = /(20\d{2}|\d{2})[年\.]?\s*(\d{1,2})[月\.]?|(\d{1,2})[月\.]?/;
  const yearOnlyPatterns = /(20\d{2}|\d{2})年[\s\S]*?(及以前|以前|之前)/;
  headers.forEach(h => {
    if (!h) {
      result[h] = null;
      return;
    }
    // 先尝试匹配带月份的模式
    const match = h.match(monthPatterns);
    if (match) {
      let year, month;
      if (match[1]) {
        year = match[1].length === 2 ? `20${match[1]}` : match[1];
        month = match[2];
      } else {
        year = currentYear;
        month = match[3];
      }
      // 确保月份在1-12之间
      const monthNum = parseInt(month);
      if (monthNum >= 1 && monthNum <= 12) {
        result[h] = `${year}年${monthNum}月`;
      } else {
        result[h] = null;
      }
    } else {
      // 再尝试匹配只有年份的模式，如"2025年及以前"
      const yearMatch = h.match(yearOnlyPatterns);
      if (yearMatch) {
        const year = yearMatch[1].length === 2 ? `20${yearMatch[1]}` : yearMatch[1];
        // 将"2025年及以前"视为2025年12月
        result[h] = `${year}年12月`;
      } else {
        result[h] = null;
      }
    }
  });
  return result;
}

// 从行数据中提取进度记录
function extractProgressFromRow(row, headers, colMap) {
  const progress = [];
  if (!row || !headers || !colMap) return progress;

  headers.forEach((h, idx) => {
    const month = colMap[h];
    if (month && row[idx] && row[idx].trim()) {
      progress.push({ month, content: row[idx].trim() });
    }
  });
  return progress;
}

// 合并进度数据
function mergeMonthlyProgress(existing = [], incoming = []) {
  const merged = { ...Object.fromEntries(existing.map(p => [p.month, p])) };
  
  incoming.forEach(p => {
    merged[p.month] = p;
  });
  
  return Object.values(merged).sort((a, b) => {
    const [yearA, monthA] = a.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    const [yearB, monthB] = b.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    return yearA - yearB || monthA - monthB;
  });
}

// 模板模式解析 lakesheet body_sheet
function parseBodySheet(bodySheetStr, docTitle) {
  const sheetData = JSON.parse(bodySheetStr);
  const sheets    = sheetData.data || [];
  const results   = [];
  const LOCAL_COL_MAP = {
    '项目名称': 'name', '名称': 'name',
    '项目编号': 'projectCode', '编号': 'projectCode',
    '唯一代码': 'uniqueCode', '项目唯一代码': 'uniqueCode', '代码': 'uniqueCode',
    '项目来源': 'channel', '来源': 'channel', '客户来源': 'channel',
    '客户名称': 'customer', '客户': 'customer',
    '负责人': 'owner', '销售': 'owner', '业务员': 'owner',
    '产品选型': 'product', '产品': 'product', '方案': 'product',
    '项目简介': 'desc', '简介': 'desc', '描述': 'desc', '备注': 'desc',
    '项目阶段': 'stage', '阶段': 'stage', '状态': 'stage',
    '合同签署日期': 'contractDate', '合同日期': 'contractDate', '签署日期': 'contractDate', '合同时间': 'contractDate', '签单时间': 'contractDate', '签约日期': 'contractDate',
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
        } else if (['quote', 'contract', 'cost', 'collected'].includes(field)) {
          // 对于金额字段，保留4位小数
          const n = parseFloat(raw);
          p[field] = isNaN(n) ? raw : n.toFixed(4);
        } else { 
          p[field] = raw; 
        }
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
    messages: [{ role: 'user', content: `你是项目数据提取助手。从语雀文档内容中提取项目列表表格，返回 JSON 数组。\n字段：name, customer(客户名称), owner, product, desc, stage(洽谈中/已签单·执行中/已完结), quote(万元), contract(万元), cost(万元), collected(万元), monthlyProgress(项目进度，数组格式，每个元素包含month和content字段)。只返回JSON数组。\n\n文档：${title}\n\n${content.slice(0, 14000)}` }]
  });
  if (data.error) throw new Error('AI 解析失败：' + data.error.message);
  const text = (data._parsed?.text || data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || '').replace(/```json|```/g, '').trim();
  const projects = JSON.parse(text);
  // 确保每个项目都有monthlyProgress字段，并处理金额字段保留4位小数
  return projects.map(p => {
    const processedProject = {
      ...p,
      monthlyProgress: p.monthlyProgress || []
    };
    
    // 处理金额字段，保留4位小数
    const amountFields = ['quote', 'contract', 'cost', 'collected'];
    amountFields.forEach(field => {
      if (processedProject[field] !== undefined) {
        const num = parseFloat(processedProject[field]);
        if (!isNaN(num)) {
          processedProject[field] = num.toFixed(4);
        }
      }
    });
    
    return processedProject;
  });
}

function renderYuquePreview(docTitle) {
  if (!yuquePendingImport.length) { setYuqueStatus('⚠️ 未识别到项目数据', false, true); return; }
  setYuqueStatus(`✅ 从「${docTitle}」识别到 <b>${yuquePendingImport.length}</b> 个项目`, false);
  


  // 判断项目是新增还是更新：通过唯一代码或项目编号匹配
  const existCodes = new Set(projects.map(p => p.projectCode).filter(Boolean));
  const existUniqueCodes = new Set(projects.map(p => p.projectCode ? p.projectCode.slice(-4) : null).filter(Boolean));
  const existNames = new Set(projects.map(p => p.name).filter(Boolean));

  const stageNames  = ['洽谈中','已签单·执行中','已完结'];
  const fieldLabels = { name:'项目名称', stage:'阶段', channel:'项目来源', customer:'客户名称', owner:'负责人', product:'产品选型', desc:'项目简介', quote:'报价（万）', contract:'合同（万）', cost:'成本（万）', collected:'已回款（万）', projectCode:'项目编号', uniqueCode:'唯一代码', contractDate:'合同日期', deliveryBrief:'交付内容', deliveryNote:'交付详情', monthlyProgress:'项目进度', paymentNodes:'回款节点' };
  const SKIP = new Set(['id','todos','collectTasks','logs','active']);

  const fieldStats = {};
  yuquePendingImport.forEach(p => { 
    Object.keys(p).forEach(f => { 
      if (!SKIP.has(f)) {
        if (f === 'monthlyProgress') {
          if (p[f] && p[f].length > 0) {
            fieldStats[f] = (fieldStats[f] || 0) + 1;
          }
        } else if (f === 'paymentNodes') {
          if (p[f] && Array.isArray(p[f]) && p[f].length > 0) {
            // 检查是否是默认的回款节点（验收后结清，100%）
            const hasNonDefaultNode = p[f].some(node => 
              node.condition !== '验收后结清' || node.ratio !== '100%'
            );
            if (hasNonDefaultNode) {
              fieldStats[f] = (fieldStats[f] || 0) + 1;
            }
          }
        } else if (p[f] && String(p[f]).trim()) {
          fieldStats[f] = (fieldStats[f] || 0) + 1;
        }
      }
    }); 
  });
  const visibleFields = Object.keys(fieldStats).filter(f => fieldStats[f] > 0);
  if (visibleFields.includes('name')) { visibleFields.splice(visibleFields.indexOf('name'), 1); visibleFields.unshift('name'); }

  document.getElementById('yuqueHead').innerHTML = '<tr><th>状态</th>' + visibleFields.map(f => `<th>${fieldLabels[f] || f}</th>`).join('') + '</tr>';
  document.getElementById('yuqueBody').innerHTML = yuquePendingImport.map(p => {
    // 通过唯一代码、项目编号或项目名称判断是否已存在
    let isExisting = (p.uniqueCode && existUniqueCodes.has(p.uniqueCode)) ||
                     (p.projectCode && existCodes.has(p.projectCode)) ||
                     (p.name && existNames.has(p.name));
    let statusTag = '<span class="tag-new">＋ 新增</span>';

    if (isExisting) {
      // 找到现有项目，判断是否有实质变化
      const existingProject = projects.find(x =>
        (p.uniqueCode && x.projectCode && x.projectCode.endsWith(p.uniqueCode)) ||
        (p.projectCode && x.projectCode === p.projectCode) ||
        (p.name && x.name === p.name)
      );
      if (existingProject && hasProjectChanged(existingProject, p)) {
        statusTag = '<span class="tag-update">↻ 更新</span>';
      } else {
        statusTag = '<span class="tag-unchanged">＝ 无变化</span>';
      }
    }

    return '<tr><td>' + statusTag + '</td>'
      + visibleFields.map(f => {
          if (f === 'stage') {
            return `<td>${stageNames[p.stage] || '-'}</td>`;
          } else if (f === 'monthlyProgress') {
            const progress = p.monthlyProgress || [];
            if (progress.length === 0) {
              return '<td>-</td>';
            } else {
              const latestProgress = progress[progress.length - 1];
              return `<td style="font-size:.7rem;line-height:1.2">${latestProgress.month}: ${latestProgress.content.substring(0, 30)}${latestProgress.content.length > 30 ? '...' : ''}</td>`;
            }
          } else {
            return `<td>${String(p[f] || '').trim() || '-'}</td>`;
          }
        }).join('') + '</tr>';
  }).join('');
  document.getElementById('yuquePreview').style.display      = 'block';
  document.getElementById('btnConfirmYuque').style.display   = 'inline-block';
}

async function confirmYuqueImport() {
  if (!yuquePendingImport.length) return;
  let added = 0, updated = 0, progressUpdated = 0;
  let hasNewCodeGenerated = false; // 是否有新生成的唯一代码
  const importedNames = [];

  // 获取现有系统中已存在的项目（副本）
  const originalProjects = [...projects];

  // 本次导入中已生成的唯一代码集合（避免同一批次导入中重复）
  const usedCodesInThisImport = new Set();
  // 记录本次新增的项目id，用于活跃度分析时区分新旧项目
  const newYuqueProjectIds = new Set();
  // 记录本次更新的项目，用于后续收集 updatedProjects 数组
  const updatedProjectIds = new Set();
  // 记录更新项目的变化内容
  const projectChanges = new Map();
  // 记录项目的最新进度时间
  const projectLatestProgress = new Map();

  const ts = new Date();
  const currentTime = `${ts.getFullYear()}-${String(ts.getMonth()+1).padStart(2,'0')}-${String(ts.getDate()).padStart(2,'0')} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}`;

  yuquePendingImport.forEach(p => {
    let idx = -1;

    // 优先通过唯一代码匹配
    if (p.uniqueCode) {
      idx = originalProjects.findIndex(x => x.projectCode && x.projectCode.endsWith(p.uniqueCode));
    }
    // 其次通过完整项目编号匹配
    if (idx === -1 && p.projectCode) {
      idx = originalProjects.findIndex(x => x.projectCode === p.projectCode);
    }

    // 注意：没有唯一代码的项目视为新项目，不通过项目名称匹配
    if (idx >= 0) {
      // 找到当前系统中对应的项目进行更新
      const currentIdx = projects.findIndex(x => x.projectCode && x.projectCode.endsWith(originalProjects[idx].projectCode.slice(-4)));
      if (currentIdx >= 0) {
        const existingProject = projects[currentIdx];
        // 检查项目是否有变化
        if (hasProjectChanged(existingProject, p)) {
          // 记录项目变化内容
          const changes = getProjectChanges(existingProject, p);
          if (changes.length > 0) {
            projectChanges.set(projects[currentIdx].id, changes);
          }
          // 记录项目最新进度时间
          const latestProgress = getLatestProgressTime(p);
          if (latestProgress) {
            projectLatestProgress.set(projects[currentIdx].id, latestProgress);
          }
          // 更新时保留原有唯一代码
          const oldCode = originalProjects[idx].projectCode || '';
          const oldUniqueCode = oldCode.slice(-4);
          if (p.projectCode && !p.projectCode.endsWith(oldUniqueCode)) {
            p.projectCode = p.projectCode.slice(0, -4) + oldUniqueCode;
          }
          // 提取并合并进度数据
        if (window.yuqueProgressColMap && yuqueRawTableData) {
          const headers = yuqueRawTableData[0];
          // 动态找到项目名称列的索引
          const nameColIndex = headers.findIndex(h => h?.includes('项目') && h?.includes('名称'))
            || headers.findIndex(h => h?.includes('项目'))
            || headers.findIndex(h => h?.includes('名称'))
            || 0;
          
          // 找到当前项目在原始表格中的行
          for (let r = 1; r < yuqueRawTableData.length; r++) {
            const row = yuqueRawTableData[r];
            const rowName = row[nameColIndex]?.trim();
            
            // 优先使用唯一代码匹配，其次使用项目名称匹配
            let isMatch = false;
            if (p.uniqueCode) {
              // 查找唯一代码列
              const uniqueCodeColIndex = headers.findIndex(h => h?.includes('唯一代码'));
              if (uniqueCodeColIndex !== -1) {
                const rowUniqueCode = row[uniqueCodeColIndex]?.trim();
                isMatch = rowUniqueCode === p.uniqueCode;
              }
            }
            // 如果唯一代码匹配失败，使用项目名称匹配
            if (!isMatch) {
              isMatch = rowName === p.name;
            }
            
            if (isMatch) {
              const incomingProgress = extractProgressFromRow(row, headers, window.yuqueProgressColMap);
              if (incomingProgress.length > 0) {
                const existingProgress = existingProject.monthlyProgress || [];
                const mergedProgress = mergeMonthlyProgress(existingProgress, incomingProgress);
                p.monthlyProgress = mergedProgress;
                progressUpdated++;
              }
              break;
            }
          }
        }
          // 更新项目并设置 updatedAt 字段
          projects[currentIdx] = { ...projects[currentIdx], ...p, id: projects[currentIdx].id, updatedAt: currentTime };
          importedNames.push({ name: p.name, projectCode: projects[currentIdx].projectCode });
          updatedProjectIds.add(projects[currentIdx].id); // 记录更新的项目ID
          // 标记项目为已修改，确保数据被保存
          if (window.markProjectModified) {
            window.markProjectModified(projects[currentIdx].id);
          }
          updated++;
        }
      }
    } else {
      // 新项目：如果有 uniqueCode 则使用它，否则生成新的
      if (!p.projectCode) {
        const stage = p.stage || 0;
        const contractDate = p.contractDate || '';
        const now = new Date();
        let ym;
        if (stage === 0) {
          ym = String(now.getFullYear()).slice(2) + String(now.getMonth()+1).padStart(2,'0');
        } else {
          const d = contractDate ? new Date(contractDate) : now;
          ym = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,'0');
        }
        const prefix = stage === 0 ? 'C' : 'P';

        // 如果有 uniqueCode 则使用它，否则生成新的
        let uniqueCode = p.uniqueCode;
        if (!uniqueCode) {
          // 生成新代码
          hasNewCodeGenerated = true;
          // 检查系统中和本次导入中是否已存在相同代码
          let attempt = 0;
          do {
            uniqueCode = genIdCode();
            attempt++;
          } while (
            (projects.some(x => x.projectCode === prefix + ym + uniqueCode) ||
             usedCodesInThisImport.has(prefix + ym + uniqueCode)) &&
            attempt < 100
          );
          usedCodesInThisImport.add(prefix + ym + uniqueCode);
        }

        p.projectCode = prefix + ym + uniqueCode;
      } else if (p.uniqueCode && !usedCodesInThisImport.has(p.projectCode)) {
        // 有 uniqueCode 但没有完整 projectCode 的情况（使用已有代码）
        usedCodesInThisImport.add(p.projectCode);
      }

      // 使用唯一代码作为项目 id
      p.id = p.projectCode.slice(-4);
      
      // 提取并合并进度数据
      if (window.yuqueProgressColMap && yuqueRawTableData) {
        const headers = yuqueRawTableData[0];
        // 动态找到项目名称列的索引
        const nameColIndex = headers.findIndex(h => h?.includes('项目') && h?.includes('名称'))
          || headers.findIndex(h => h?.includes('项目'))
          || headers.findIndex(h => h?.includes('名称'))
          || 0;
        // 找到当前项目在原始表格中的行
        for (let r = 1; r < yuqueRawTableData.length; r++) {
          const row = yuqueRawTableData[r];
          
          // 优先使用唯一代码匹配，其次使用项目名称匹配
          let isMatch = false;
          if (p.uniqueCode) {
            // 查找唯一代码列
            const uniqueCodeColIndex = headers.findIndex(h => h?.includes('唯一代码'));
            if (uniqueCodeColIndex !== -1) {
              const rowUniqueCode = row[uniqueCodeColIndex]?.trim();
              isMatch = rowUniqueCode === p.uniqueCode;
            }
          }
          // 如果唯一代码匹配失败，使用项目名称匹配
          if (!isMatch) {
            const rowName = row[nameColIndex]?.trim();
            isMatch = rowName === p.name;
          }
          
          if (isMatch) {
            const incomingProgress = extractProgressFromRow(row, headers, window.yuqueProgressColMap);
            if (incomingProgress.length > 0) {
              p.monthlyProgress = incomingProgress;
              progressUpdated++;
            }
            break;
          }
        }
      } else if (p.monthlyProgress && p.monthlyProgress.length > 0) {
        // 非表格文档中已经提取了进度数据
        progressUpdated++;
      }
      
      // 初始化进度数据（如果没有提取到）
      if (!p.monthlyProgress) {
        p.monthlyProgress = [];
      }
      
      // 如果是执行中阶段，添加默认回款节点
      if (p.stage === 1) {
        addDefaultPaymentNode(p);
      }
      
      // 为新项目设置 updatedAt 字段
      p.updatedAt = currentTime;
      
      projects.push(p);
      newYuqueProjectIds.add(p.id); // 记录新增项目id
      importedNames.push({ name: p.name, projectCode: p.projectCode, id: p.id });
      // 标记项目为已修改，确保数据被保存
      if (window.markProjectModified) {
        window.markProjectModified(p.id);
      }
      added++;
    }
  });

  // 导入完成后，如果有新生成的唯一代码则导出
  if (hasNewCodeGenerated) {
    document.getElementById('btnExportProjectCodes').style.display = 'inline-block';
    const exportData = importedNames.map(item => ({
      '项目名称': item.name,
      '唯一代码': item.projectCode ? item.projectCode.slice(-4) : ''
    }));
    exportExcelWithProjectCodes(exportData);
  }

  // 导入完成后自动关联文件夹
  if (window.fsRootHandle) {
    const importedProjects = yuquePendingImport.map(p =>
      projects.find(x => x.projectCode === p.projectCode)
    ).filter(Boolean);

    const matches = [];
    for (const p of importedProjects) {  
      const existingDir = await getProjectDirById(p.id);
      if (existingDir) continue;
      const candidates = await matchExistingDirs(p.name, p.channel);
      if (candidates.length > 0) {
        matches.push({ projectId: p.id, projectName: p.name, candidates });
      } else {
        await createProjectDir(p);
      }
    }
    
    if (matches.length > 0) {
      openFolderMatch(matches);
    }
  }

  // 收集新增和更新的项目信息
  const addedProjects = [];
  const updatedProjects = [];
  const activeChanges = { activeAdded: 0, inactiveAdded: 0 };
  
  // 分析活跃度变化（新增项目传 isNew=true，已有项目传 false）
  projects.forEach(project => {
    const isNew = newYuqueProjectIds.has(project.id);
    const oldActive = project.active;
    window.updateProjectActivity(project, isNew);
    // 只有原有的项目（有 oldActive）才计入活跃度变化
    if (oldActive !== undefined && oldActive !== project.active) {
      if (project.active === 'active') {
        activeChanges.activeAdded++;
        project._justActivated = true;
      } else {
        activeChanges.inactiveAdded++;
        project._justDeactivated = true;
      }
    }
  });
  
  // 收集新增和更新的项目
  // 收集更新的项目
  projects.forEach(project => {
    if (updatedProjectIds.has(project.id)) {
      updatedProjects.push(project);
    }
  });
  
  // 收集新增的项目
  yuquePendingImport.forEach(p => {
    let idx = -1;
    
    // 优先通过唯一代码匹配
    if (p.uniqueCode) {
      idx = originalProjects.findIndex(x => x.projectCode && x.projectCode.endsWith(p.uniqueCode));
    }
    // 其次通过完整项目编号匹配
    if (idx === -1 && p.projectCode) {
      idx = originalProjects.findIndex(x => x.projectCode === p.projectCode);
    }
    
    if (idx === -1) {
      // 找到新增的项目
      const newProject = projects.find(x => x.projectCode === p.projectCode);
      if (newProject) {
        addedProjects.push(newProject);
      }
    }
  });
  
  // 显示确认弹窗
  await showImportConfirmation(added, updated, progressUpdated, addedProjects, updatedProjects, activeChanges, projectChanges, projectLatestProgress);
  
  closeImport(); save(); refreshView();
}

// 显示导入确认弹窗
function showImportConfirmation(added, updated, progressUpdated, addedProjects, updatedProjects, activeChanges, projectChanges = new Map(), projectLatestProgress = new Map()) {
  const modal = document.createElement('div');
  modal.className = 'import-confirmation-modal';
  
  const content = document.createElement('div');
  content.className = 'import-confirmation-content';
  
  // 收集活跃度变化的具体项目
  const activeProjects = [];
  const inactiveProjects = [];
  projects.forEach(project => {
    if (project.active === 'active' && project._justActivated) {
      activeProjects.push(project);
    } else if (project.active !== 'active' && project._justDeactivated) {
      inactiveProjects.push(project);
    }
  });
  
  // 为每个项目添加临时标记，用于跟踪活跃度变化
  projects.forEach(project => {
    project._justActivated = false;
    project._justDeactivated = false;
  });
  
  let html = `
    <div class="import-confirmation-header">
      <div class="import-confirmation-title">语雀导入完成</div>
    </div>

    <div class="import-stat-grid">
      <div class="import-stat-card added">
        <div class="stat-label">新增项目</div>
        <div class="stat-value">${added}</div>
      </div>
      <div class="import-stat-card updated">
        <div class="stat-label">更新项目</div>
        <div class="stat-value">${updated}</div>
      </div>
      <div class="import-stat-card progress">
        <div class="stat-label">进度更新</div>
        <div class="stat-value">${progressUpdated}</div>
      </div>
    </div>

    <div class="import-project-list">
  `;

  if (added > 0) {
    html += `
      <div class="import-project-section">
        <div class="import-section-title">新增项目 (${added})</div>
        <div class="import-project-items">
          ${addedProjects.map((p, index) => `
            <div class="import-project-item">
              <div class="import-project-header">
                <span class="import-project-tag added">${index + 1}</span>
                ${p.channel ? `<span class="import-project-channel">🌐 ${p.channel}</span>` : ''}
                <span class="import-project-name">${p.name}</span>
                ${p.projectCode ? `<span class="import-project-code">${p.projectCode}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (updated > 0) {
    html += `
      <div class="import-project-section">
        <div class="import-section-title">更新项目 (${updated})</div>
        <div class="import-project-items">
          ${updatedProjects.map((p, index) => {
            const changes = projectChanges.get(p.id) || [];
            return `
            <div class="import-project-item">
              <div class="import-project-header">
                <span class="import-project-tag updated">${index + 1}</span>
                ${p.channel ? `<span class="import-project-channel">🌐 ${p.channel}</span>` : ''}
                <span class="import-project-name">${p.name}</span>
                ${p.projectCode ? `<span class="import-project-code">${p.projectCode}</span>` : ''}
              </div>
              ${changes.length > 0 ? `
                <div class="import-project-changes">
                  <div class="import-changes-title">更新内容：</div>
                  <ul class="import-changes-list">
                    ${changes.map(change => `<li>${change}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if (activeChanges && (activeChanges.activeAdded > 0)) {
    html += `
      <div class="import-project-section">
        <div class="import-section-title">转为活跃 (${activeChanges.activeAdded})</div>
        <div class="import-project-items">
          ${activeProjects.map((p, index) => `
            <div class="import-project-item">
              <div class="import-project-header">
                <span class="import-project-tag active">${index + 1}</span>
                ${p.channel ? `<span class="import-project-channel">🌐 ${p.channel}</span>` : ''}
                <span class="import-project-name">${p.name}</span>
                ${p.projectCode ? `<span class="import-project-code">${p.projectCode}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (activeChanges && (activeChanges.inactiveAdded > 0)) {
    html += `
      <div class="import-project-section">
        <div class="import-section-title">转为非活跃 (${activeChanges.inactiveAdded})</div>
        <div class="import-project-items">
          ${inactiveProjects.map((p, index) => {
            const latestProgress = projectLatestProgress.get(p.id) || getLatestProgressTime(p);
            let reason = '';
            if (latestProgress) {
              // 计算月份差异
              const [latestYear, latestMonth] = latestProgress.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
              const now = new Date();
              const monthDiff = (now.getFullYear() - latestYear) * 12 + (now.getMonth() + 1 - latestMonth);
              reason = `（最新进度：${latestProgress}，超过1个月）`;
            } else {
              reason = '（无最新进展）';
            }
            return `
            <div class="import-project-item">
              <div class="import-project-header">
                <span class="import-project-tag inactive">${index + 1}</span>
                ${p.channel ? `<span class="import-project-channel">🌐 ${p.channel}</span>` : ''}
                <span class="import-project-name">${p.name}</span>
                ${p.projectCode ? `<span class="import-project-code">${p.projectCode}</span>` : ''}
                <span class="import-project-progress">${reason}</span>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  if (activeChanges && (activeChanges.activeAdded > 0)) {
    html += `
      <div class="import-project-section">
        <div class="import-section-title">转为活跃 (${activeChanges.activeAdded})</div>
        <div class="import-project-items">
          ${activeProjects.map((p, index) => {
            const latestProgress = projectLatestProgress.get(p.id) || getLatestProgressTime(p);
            let reason = '';
            if (latestProgress) {
              reason = `（最新进度：${latestProgress}，未超过1个月）`;
            } else {
              reason = '（新增项目或无最新进展）';
            }
            return `
            <div class="import-project-item">
              <div class="import-project-header">
                <span class="import-project-tag active">${index + 1}</span>
                ${p.channel ? `<span class="import-project-channel">🌐 ${p.channel}</span>` : ''}
                <span class="import-project-name">${p.name}</span>
                ${p.projectCode ? `<span class="import-project-code">${p.projectCode}</span>` : ''}
                <span class="import-project-progress">${reason}</span>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }

  html += `
    </div>

    <div class="import-confirmation-footer">
      <button id="confirm-import-btn" class="import-btn-confirm">确认完成</button>
    </div>
  `;
  
  content.innerHTML = html;
  modal.appendChild(content);
  document.body.appendChild(modal);
  
  return new Promise(resolve => {
    const confirmBtn = document.getElementById('confirm-import-btn');
    confirmBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve();
    });
    
    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        resolve();
      }
    });
  });
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
  // 进度相关
  identifyProgressColumns,
  extractProgressFromRow,
  mergeMonthlyProgress,
  // Excel 文本读取
  readExcelText
};
