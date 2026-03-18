// ╔══════════════════════════════════════════╗
// ║  MODULE: file-analysis（文件识别分析）   ║
// ╚══════════════════════════════════════════╝

const AGREEMENT_ANALYZE_PROMPT = `你是技术协议分析助手。请阅读这份技术协议，提取交付内容并按以下格式返回JSON，不加任何说明文字：

{
  "brief": "不超过50字的交付内容概述",
  "wireless_hardware": true或false（是否包含无线硬件交付）,
  "wired_hardware": true或false（是否包含有线硬件交付）,
  "software": true或false（是否包含软件/系统交付）,
  "other": "其他交付内容描述，没有则为空字符串"
}

示例：{"brief":"无线振动传感器×20套，数据采集网关×2套，在线监测平台软件1套","wireless_hardware":true,"wired_hardware":false,"software":true,"other":"现场安装调试"}`;

const QUOTE_ANALYZE_PROMPT = `你是报价分析助手。请阅读这份方案报价，提取总报价金额（单位：万元）并按以下格式返回JSON，不加任何说明文字：

{
  "quote": "总报价金额，数字，单位万元"
}

示例：{"quote":"128.5"}`;

const CONTRACT_ANALYZE_PROMPT = `请分析这份合同，提取以下三部分内容，只返回JSON，不加说明：

1. contractAmount: 合同总金额（数字，单位元，如找不到则为null）

2. delivery: 交付内容分类（可多选）
   - wireless_hardware: 是否包含无线硬件交付（true/false）
   - wired_hardware: 是否包含有线硬件交付（true/false）
   - software: 是否包含软件定制交付（true/false）
   - other: 其他交付内容（字符串，不超过30字，没有则为空字符串）

3. payment: 回款节点列表，每项包含：
   - condition: 回款要求（如"完成验收后"）
   - ratio: 百分比（如"30%"）
   - amount: 金额（如有则填写，没有则为空）

返回格式：
{
  "contractAmount": 1705760,
  "delivery": {"wireless_hardware":true,"wired_hardware":false,"software":true,"other":""},
  "payment": [{"condition":"合同签订后","ratio":"30%","amount":""},{"condition":"设备到货验收","ratio":"40%","amount":""}]
}`;

// fsRootHandle 已在 main.js 中定义
let fsCurrentProjectId = null; // 当前打开的项目ID

// 加载项目编辑页面的文件
async function loadModalFilePanel(projectId) {
  console.log('loadModalFilePanel called with projectId:', projectId);
  const p = projects.find(x => x.id === projectId);
  if (!p) {
    console.log('项目未找到');
    return;
  }

  if (!window.fsRootHandle) {
    console.log('根目录未配置');
    // 根目录未配置，清空所有文件网格
    ['modalContractFileGrid', 'modalAgreementFileGrid', 'modalTechPlanFileGrid', 'modalQuoteFileGrid', 'modalOtherFileGrid'].forEach(id => {
      const grid = document.getElementById(id);
      if (grid) grid.innerHTML = '';
    });
    return;
  }

  const dir = await getProjectDirById(p.id);
  console.log('getProjectDirById result:', dir);
  if (!dir) {
    // 项目文件夹不存在，显示错误信息
    const dirName = await getProjectDirNameById(p.id);
    ['modalContractFileGrid', 'modalAgreementFileGrid', 'modalTechPlanFileGrid', 'modalQuoteFileGrid', 'modalOtherFileGrid'].forEach(id => {
      const grid = document.getElementById(id);
      if (grid) grid.innerHTML = '<div class="file-section-empty">项目文件夹不存在</div>';
    });
    showToast(`项目文件夹不存在`);
    return;
  }

  // 读取文件和文件夹列表
  const files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file') {
      try {
        const file = await handle.getFile();
        files.push({ name, handle, lastModified: file.lastModified, isDirectory: false });
      } catch(e) {
        files.push({ name, handle, lastModified: 0, isDirectory: false });
      }
    } else if (handle.kind === 'directory') {
      // 识别文件夹
      files.push({ name, handle, lastModified: 0, isDirectory: true });
    }
  }

  // 过滤排除备注.txt 和隐藏文件（以.开头）
  const displayFiles = files.filter(f => f.name !== '备注.txt' && !f.name.startsWith('.'));

  // 先用 AI 分类，再分区渲染
  const tagMap = displayFiles.length ? await classifyFileNames(displayFiles.map(f => f.name)) : {};

  // 按分类分组
  const contractFiles  = displayFiles.filter(f => !f.isDirectory && (tagMap[f.name]?.cat === '合同')).sort((a, b) => b.lastModified - a.lastModified);
  const agreementFiles = displayFiles.filter(f => !f.isDirectory && (tagMap[f.name]?.cat === '技术协议')).sort((a, b) => b.lastModified - a.lastModified);
  const techPlanFiles  = displayFiles.filter(f => !f.isDirectory && (tagMap[f.name]?.cat === '技术协议')).sort((a, b) => b.lastModified - a.lastModified);
  const quoteFiles     = displayFiles.filter(f => !f.isDirectory && (tagMap[f.name]?.cat === '报价')).sort((a, b) => b.lastModified - a.lastModified);
  const otherFiles     = displayFiles.filter(f => !['合同','技术协议','报价','发票'].includes(tagMap[f.name]?.cat)).sort((a, b) => {
    // 文件夹排在前面，然后按名称排序
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return b.lastModified - a.lastModified;
  });

  // 渲染文件网格
  renderModalFileSection('contract', contractFiles, p.id, tagMap);
  renderModalFileSection('agreement', agreementFiles, p.id, tagMap);
  renderModalFileSection('techPlan', techPlanFiles, p.id, tagMap);
  renderModalFileSection('quote', quoteFiles, p.id, tagMap);
  renderModalFileSection('other', otherFiles, p.id, tagMap);
  
  // 显示AI识别按钮
  const modalContractAnalyzeBtn = document.getElementById('modalContractAnalyzeBtn');
  const modalAgreementAnalyzeBtn = document.getElementById('modalAgreementAnalyzeBtn');
  
  if (modalContractAnalyzeBtn) {
    modalContractAnalyzeBtn.style.display = contractFiles.length ? 'inline-block' : 'none';
    modalContractAnalyzeBtn.dataset.projectId = p.id;
  }
  
  if (modalAgreementAnalyzeBtn) {
    modalAgreementAnalyzeBtn.style.display = agreementFiles.length ? 'inline-block' : 'none';
    modalAgreementAnalyzeBtn.dataset.projectId = p.id;
  }
  
  // 显示多选提示
  const modalContractSelectHint = document.getElementById('modalContractSelectHint');
  const modalAgreementSelectHint = document.getElementById('modalAgreementSelectHint');
  
  if (modalContractSelectHint) {
    modalContractSelectHint.style.display = contractFiles.length > 1 ? 'inline' : 'none';
  }
  
  if (modalAgreementSelectHint) {
    modalAgreementSelectHint.style.display = agreementFiles.length > 1 ? 'inline' : 'none';
  }
}

// 渲染项目编辑页面的文件网格
function renderModalFileSection(type, files, projectId, tagMap) {
  const gridId = `modal${type.charAt(0).toUpperCase() + type.slice(1)}FileGrid`;
  const emptyId = `modal${type.charAt(0).toUpperCase() + type.slice(1)}Empty`;
  const countId = `modal${type.charAt(0).toUpperCase() + type.slice(1)}Count`;
  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  const countEl = document.getElementById(countId);
  
  if (!grid || !empty) return;
  
  // 更新文件计数
  if (countEl) {
    countEl.textContent = `${files.length} 个文件`;
  }
  
  if (files.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
  } else {
    grid.innerHTML = files.map(f => `
      <div class="file-item file-item-selected" data-filename="${f.name}" data-lastmodified="${f.lastModified}">
        <div class="file-item-icon">${f.isDirectory ? '📁' : '📄'}</div>
        <div class="file-item-name">${f.name}</div>
        <div class="file-item-check">✓</div>
      </div>
    `).join('');
    
    // 添加点击事件，只用于选择/取消选择，不预览
    grid.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', function() {
        toggleFileSelection(this, this.dataset.filename);
      });
    });
    empty.style.display = 'none';
  }
}

// 切换文件选择状态
function toggleFileSelection(el, fileName) {
  el.classList.toggle('file-item-selected');
  
  // 更新多选提示
  const grid = el.closest('.file-list');
  if (grid) {
    const selectedCount = grid.querySelectorAll('.file-item-selected').length;
    const type = grid.id.replace('modal', '').replace('FileGrid', '').toLowerCase();
    const hintEl = document.getElementById(`modal${type.charAt(0).toUpperCase() + type.slice(1)}SelectHint`);
    if (hintEl) {
      hintEl.style.display = selectedCount > 1 ? 'inline' : 'none';
    }
  }
}

// 渲染回款节点
function renderPaymentNodes(p) {
  const list = document.getElementById('f-pn-list');
  const empty = document.getElementById('f-pn-empty');
  if (!list || !empty) return;
  
  if (!p.paymentNodes || !p.paymentNodes.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
  } else {
    list.innerHTML = p.paymentNodes.map((node, i) => `
      <div class="pn-row ${node.done ? 'done-row' : ''}" data-from-ai="${node._fromAi ? '1' : '0'}">
        <div class="pn-toolbar">
          <div class="pn-idx">${i+1}</div>
          <button class="pn-rm" onclick="removePaymentNode(${i})">×</button>
        </div>
        <div class="pn-task-area">
          <div class="pn-task-label">回款条件</div>
          <div class="pn-task-row">
            <textarea class="pn-condition" onchange="updatePaymentNode(${i}, 'condition', this.value)" oninput="this.style.height='auto'; this.style.height=(this.scrollHeight)+'px'">${node.condition || ''}</textarea>
            <div class="pn-deliver-toggle" onclick="onPnDeliverToggle(this)">
              <input type="checkbox" class="pn-deliver-chk" ${node.deliverDone?'checked':''}>
              <div class="pn-status-btn ${node.deliverDone?'active-deliver':''}">
                ${node.deliverDone?'✅ 交付任务完成':'○ 交付任务完成'}
              </div>
            </div>
          </div>
        </div>
        <div class="pn-body">
          <div class="pn-col">
            <div class="pn-col-title">回款目标</div>
            <div class="pn-field">
              <label>回款比例</label>
              <input type="text" class="pn-ratio" value="${node.ratio || ''}" onchange="updatePaymentNode(${i}, 'ratio', this.value)">
            </div>
            <div class="pn-field">
              <label>金额（万元）</label>
              <input type="text" class="pn-amount" value="${node.amount || ''}" onchange="updatePaymentNode(${i}, 'amount', this.value)">
            </div>
          </div>
          <div class="pn-col">
            <div class="pn-col-title">回款落实</div>
            <div class="pn-field">
              <label>实际到账（万元）</label>
              <input type="text" class="pn-actual" value="${node.actualAmount || ''}" oninput="onPnActualInput(this)">
            </div>
            <div class="pn-done-toggle" onclick="onPnDoneToggle(this)">
              <input type="checkbox" ${node.done?'checked':''}>
              <div class="pn-status-btn ${node.done?'active-done':''}">
                ${node.done?'✅ 回款已到账':'○ 回款已到账'}
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');
    empty.style.display = 'none';
  }
}

// 更新回款节点
function updatePaymentNode(index, field, value) {
  if (!currentEditProjectId) return;
  const p = projects.find(x => x.id === currentEditProjectId);
  if (!p || !p.paymentNodes) return;
  
  p.paymentNodes[index][field] = value;
  
  // 自动计算金额或百分比
  const node = p.paymentNodes[index];
  const contractAmount = parseFloat(p.contract) || 0;
  
  if (field === 'ratio' && value) {
    // 输入了百分比，自动计算金额
    const ratioValue = parseFloat(value.replace('%', '')) / 100;
    node.amount = String(contractAmount * ratioValue);
  } else if (field === 'amount' && value) {
    // 输入了金额，自动计算百分比
    const amountValue = parseFloat(value);
    if (contractAmount > 0) {
      const ratioValue = (amountValue / contractAmount) * 100;
      node.ratio = ratioValue.toFixed(0) + '%';
    }
  }
  
  // 检查合同金额与百分比是否一致
  if (node.ratio && node.amount && contractAmount > 0) {
    const ratioValue = parseFloat(node.ratio.replace('%', '')) / 100;
    const calculatedAmount = (contractAmount * ratioValue).toFixed(2);
    if (Math.abs(parseFloat(node.amount) - parseFloat(calculatedAmount)) > 0.01) {
      // 显示不一致提示
      showToast('⚠️ 回款节点金额与百分比不一致，请检查');
    }
  }
  
  // 检查已回款金额是否大于或等于应收金额
  const actualAmount = parseFloat(node.actualAmount) || 0;
  const amount = parseFloat(node.amount) || 0;
  
  if (actualAmount >= amount) {
    node.done = true;
  }
  
  // 重新渲染回款节点
  renderPaymentNodes(p);
  save();
  refreshView();
}

// 切换回款节点完成状态
function togglePaymentNodeDone(index) {
  if (!currentEditProjectId) return;
  const p = projects.find(x => x.id === currentEditProjectId);
  if (!p || !p.paymentNodes) return;
  
  p.paymentNodes[index].done = !p.paymentNodes[index].done;
  
  // 重新渲染回款节点
  renderPaymentNodes(p);
  save();
  refreshView();
}

// 切换回款节点任务完成状态
function togglePaymentNodeTaskCompleted(index) {
  if (!currentEditProjectId) return;
  const p = projects.find(x => x.id === currentEditProjectId);
  if (!p || !p.paymentNodes) return;
  
  p.paymentNodes[index].taskCompleted = !p.paymentNodes[index].taskCompleted;
  
  // 重新渲染回款节点
  renderPaymentNodes(p);
  save();
  refreshView();
}

// 移除回款节点
function removePaymentNode(index) {
  if (!currentEditProjectId) return;
  const p = projects.find(x => x.id === currentEditProjectId);
  if (!p || !p.paymentNodes) return;
  
  p.paymentNodes.splice(index, 1);
  
  // 重新渲染回款节点
  renderPaymentNodes(p);
  save();
  refreshView();
}

// 添加回款节点
function addPaymentNodeToProject() {
  if (!currentEditProjectId) return;
  const p = projects.find(x => x.id === currentEditProjectId);
  if (!p) return;
  
  if (!p.paymentNodes) {
    p.paymentNodes = [];
  }
  
  p.paymentNodes.push({
    condition: '',
    ratio: '',
    amount: '',
    actualAmount: '',
    done: false,
    deliverDone: false
  });
  
  // 重新渲染回款节点
  renderPaymentNodes(p);
  save();
  refreshView();
}

// 回款节点页面的合同识别
async function analyzeContractsForPayment() {
  // 优先使用currentEditProjectId，否则使用fsCurrentProjectId
  const projectId = currentEditProjectId || fsCurrentProjectId;
  if (!projectId) return;
  
  const p = projects.find(x => x.id === projectId);
  if (!p) return;
  
  if (!fsRootHandle) {
    showToast('请先选择根目录');
    return;
  }
  
  // 禁用按钮
  const btn = document.querySelector('[onclick="analyzeContractsForPayment()"]');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
  
  const dir = await getProjectDirById(p.id);
  if (!dir) {
    showToast('项目文件夹不存在');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  // 读取所有合同文件
  const files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && name !== '备注.txt' && !name.startsWith('.')) {
      try {
        const file = await handle.getFile();
        files.push({ name, lastModified: file.lastModified });
      } catch(e) {
        files.push({ name, lastModified: 0 });
      }
    }
  }
  
  // 过滤合同文件
  let contractFiles = files.filter(f => f.name.includes('合同') || f.name.includes('采购') || f.name.includes('销售'));
  if (!contractFiles.length) {
    showToast('没有找到合同文件');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  // 按文件类型分组，选择每种类型中最新的文件
  const contractFilesByType = {};
  contractFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!contractFilesByType[ext] || file.lastModified > contractFilesByType[ext].lastModified) {
      contractFilesByType[ext] = file;
    }
  });
  
  // 转换回数组
  contractFiles = Object.values(contractFilesByType).map(f => f.name);
  
  // 显示加载提示
  const pnAiHint = document.getElementById('pn-ai-hint');
  if (pnAiHint) {
    pnAiHint.textContent = '正在识别合同…';
  }
  
  // 获取分析结果显示区域
  const analysisDiv = document.getElementById('f-contract-analysis');
  
  try {
    // 读取合同文件内容
    let combinedText = '';
    for (const name of contractFiles) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await file.text();
        } else if (['doc','docx'].includes(ext)) {
          const text = await readDocxText(file);
          combinedText += `\n\n【文件：${name}】\n` + text;
        } else if (ext === 'pdf') {
          // PDF 处理逻辑
          const ab = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
          await analyzeContractFile(name, b64, 'pdf', analysisDiv, btn);
          return;
        }
      } catch(e) {
        if (DEBUG) console.error('读取文件失败:', e);
      }
    }
    
    if (!combinedText.trim()) {
      showToast('无法读取合同内容');
      // 启用按钮
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '1';
      }
      return;
    }
    
    // 使用全局AI模型分析合同
    await analyzeContractText(combinedText, analysisDiv);
    
    // 更新UI
    if (pnAiHint) {
      pnAiHint.textContent = '识别完成';
    }
    
  } catch(e) {
    if (DEBUG) console.error('合同识别失败:', e);
    showToast('合同识别失败：' + e.message);
  } finally {
    if (pnAiHint) {
      pnAiHint.textContent = '';
    }
    // 启用按钮
    const btn = document.querySelector('[onclick="analyzeContractsForPayment()"]');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

// 交付情况页面的合同和技术协议识别
async function analyzeContractsForDelivery() {
  // 禁用按钮
  const btn = document.querySelector('[onclick="analyzeContractsForDelivery()"]');
  if (btn) {
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
  
  // 优先使用currentEditProjectId，否则使用fsCurrentProjectId
  const projectId = currentEditProjectId || fsCurrentProjectId;
  if (!projectId) {
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  const p = projects.find(x => x.id === projectId);
  if (!p) {
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  if (!fsRootHandle) {
    showToast('请先选择根目录');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  const dir = await getProjectDirById(p.id);
  if (!dir) {
    showToast('项目文件夹不存在');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  // 读取所有文件
  const files = [];
  for await (const [name, handle] of dir.entries()) {
    if (handle.kind === 'file' && name !== '备注.txt' && !name.startsWith('.')) {
      try {
        const file = await handle.getFile();
        files.push({ name, lastModified: file.lastModified });
      } catch(e) {
        files.push({ name, lastModified: 0 });
      }
    }
  }
  
  // 过滤合同文件
  let contractFiles = files.filter(f => f.name.includes('合同') || f.name.includes('采购') || f.name.includes('销售'));
  // 按文件类型分组，选择每种类型中最新的文件
  const contractFilesByType = {};
  contractFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!contractFilesByType[ext] || file.lastModified > contractFilesByType[ext].lastModified) {
      contractFilesByType[ext] = file;
    }
  });
  contractFiles = Object.values(contractFilesByType).map(f => f.name);
  
  // 过滤技术协议文件
  let agreementFiles = files.filter(f => f.name.includes('技术协议') || f.name.includes('技术方案') || f.name.includes('需求文档'));
  // 按文件类型分组，选择每种类型中最新的文件
  const agreementFilesByType = {};
  agreementFiles.forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!agreementFilesByType[ext] || file.lastModified > agreementFilesByType[ext].lastModified) {
      agreementFilesByType[ext] = file;
    }
  });
  agreementFiles = Object.values(agreementFilesByType).map(f => f.name);
  
  if (!contractFiles.length && !agreementFiles.length) {
    showToast('没有找到合同或技术协议文件');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
  
  // 显示加载提示
  const dtAiHint = document.getElementById('dt-ai-hint');
  if (dtAiHint) {
    dtAiHint.textContent = '正在识别交付内容…';
  }
  
  // 获取分析结果显示区域
  const analysisDiv = document.getElementById('f-delivery-analysis');
  if (analysisDiv) {
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析交付内容…</div></div>`;
  }
  
  try {
    // 读取合同文件内容
    let contractText = '';
    for (const name of contractFiles) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          contractText += `\n\n【合同文件：${name}】\n` + await file.text();
        } else if (['doc','docx'].includes(ext)) {
          const text = await readDocxText(file);
          contractText += `\n\n【合同文件：${name}】\n` + text;
        }
      } catch(e) {
        if (DEBUG) console.error('读取合同文件失败:', e);
      }
    }
    
    // 读取技术协议文件内容
    let agreementText = '';
    for (const name of agreementFiles) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          agreementText += `\n\n【技术协议文件：${name}】\n` + await file.text();
        } else if (['doc','docx'].includes(ext)) {
          const text = await readDocxText(file);
          agreementText += `\n\n【技术协议文件：${name}】\n` + text;
        }
      } catch(e) {
        if (DEBUG) console.error('读取技术协议文件失败:', e);
      }
    }
    
    // 合并文本
  const combinedText = contractText + agreementText;
  if (!combinedText.trim()) {
    showToast('无法读取文件内容');
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
    return;
  }
    
    // 使用全局AI模型分析交付内容
    const data = await claudeCall({
      task: '交付内容解析',
      max_tokens: 4000,
      messages: [{ role: 'user', content: AGREEMENT_ANALYZE_PROMPT + '\n\n以下是合同和技术协议内容：\n' + combinedText.slice(0, 12000) }]
    });
    
    // 使用 renderAgreementAnalysis 显示分析结果
    renderAgreementAnalysis(data, analysisDiv, currentEditProjectId);
    
    // 更新UI提示
    if (dtAiHint) {
      dtAiHint.textContent = '识别完成';
    }
    
  } catch(e) {
    if (DEBUG) console.error('交付内容识别失败:', e);
    showToast('交付内容识别失败：' + e.message);
    if (analysisDiv) {
      analysisDiv.innerHTML = '';
    }
  } finally {
    if (dtAiHint) {
      dtAiHint.textContent = '';
    }
    // 启用按钮
    const btn = document.querySelector('[onclick="analyzeContractsForDelivery()"]');
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

// 拖拽事件处理
let draggedItem = null;





function toggleFileSelect(el, type) {
  el.classList.toggle('file-item-selected');
  // 确保至少一个选中
  const grid = document.getElementById(type + 'FileGrid');
  const selected = grid.querySelectorAll('.file-item-selected');
  if (selected.length === 0) el.classList.add('file-item-selected');
}

function getSelectedFileNames(type) {
  // 检查是在主文件面板还是项目编辑页面
  let grid = document.getElementById(type + 'FileGrid');
  
  // 如果在项目编辑页面
  if (!grid) {
    grid = document.getElementById('modal' + type.charAt(0).toUpperCase() + type.slice(1) + 'FileGrid');
  }
  
  if (!grid) return [];
  const selected = grid.querySelectorAll('.file-item-selected');
  if (selected.length) return Array.from(selected).map(el => el.dataset.filename);
  // fallback: 全部
  return Array.from(grid.querySelectorAll('.file-item')).map(el => el.dataset.filename);
}

// 合同识别：交付内容 + 回款节点
async function analyzeContracts() {
  if (DEBUG) console.log('开始识别合同');
  // 检查是在主文件面板还是项目编辑页面
  let btn = document.getElementById('contractAnalyzeBtn');
  let analysisDiv = document.getElementById('contractAnalysis');
  
  // 如果在项目编辑页面
  if (!btn) {
    if (DEBUG) console.log('在项目编辑页面');
    btn = document.getElementById('modalContractAnalyzeBtn');
    analysisDiv = document.getElementById('modalContractAnalysis');
  }
  
  if (DEBUG) console.log('btn:', btn);
  if (DEBUG) console.log('analysisDiv:', analysisDiv);
  
  if (!btn) {
    if (DEBUG) console.log('未找到按钮');
    return;
  }
  
  // 禁用按钮并显示加载提示
  btn.disabled = true;
  btn.style.opacity = '0.5';
  
  // 立即显示加载提示
  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在准备识别合同…</div></div>`;
  }
  
  // 获取项目ID - 优先使用currentEditProjectId（项目编辑页面），否则使用按钮的data-projectId（主文件面板）
  let projectId = currentEditProjectId || btn.dataset.projectId;
  if (DEBUG) console.log('projectId:', projectId);
  
  if (!projectId) {
    if (DEBUG) console.log('未找到项目ID');
    showToast('未找到项目ID');
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    return;
  }
  
  const p = projects.find(x => x.id === projectId);
  if (DEBUG) console.log('项目:', p);
  
  if (!p) {
    if (DEBUG) console.log('未找到项目');
    showToast('未找到项目');
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    return;
  }
  
  const dir = await getProjectDirById(p.id);
  if (DEBUG) console.log('项目目录:', dir);
  
  if (!dir) {
    if (DEBUG) console.log('未找到项目目录');
    showToast('项目文件夹不存在');
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    return;
  }
  if (DEBUG) console.log('获取项目目录成功');


  // 使用选中文件（默认第一个已选中）
  let fileNames = getSelectedFileNames('contract');
  if (DEBUG) console.log('选中的文件:', fileNames);
  
  if (!fileNames.length) { 
    if (DEBUG) console.log('没有选中文件，按文件类型分组选择最新文件');
    // 如果没有选中文件，按文件类型分组，选择每种类型中最新的文件
    const files = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && name !== '备注.txt' && !name.startsWith('.')) {
        try {
          const file = await handle.getFile();
          files.push({ name, lastModified: file.lastModified });
        } catch(e) {
          files.push({ name, lastModified: 0 });
        }
      }
    }
    
    if (DEBUG) console.log('所有文件:', files);
    
    const contractFiles = files.filter(f => f.name.includes('合同') || f.name.includes('采购') || f.name.includes('销售'));
    if (DEBUG) console.log('合同文件:', contractFiles);
    
    if (!contractFiles.length) {
      if (DEBUG) console.log('没有合同文件可识别');
      showToast('没有合同文件可识别'); 
      // 启用按钮
      btn.disabled = false;
      btn.style.opacity = '1';
      // 清除加载提示
      if (analysisDiv) {
        analysisDiv.style.display = 'none';
        analysisDiv.innerHTML = '';
      }
      return;
    }
    
    // 按文件类型分组，选择每种类型中最新的文件
    const contractFilesByType = {};
    contractFiles.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!contractFilesByType[ext] || file.lastModified > contractFilesByType[ext].lastModified) {
        contractFilesByType[ext] = file;
      }
    });
    
    fileNames = Object.values(contractFilesByType).map(f => f.name);
    if (DEBUG) console.log('最终选择的文件:', fileNames);
  }
  
  if (DEBUG) console.log('准备读取文件内容');


  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在读取合同文件…</div></div>`;
  }
  btn.disabled = true;

  try {
    // 读取所有合同文件文本内容
    let combinedText = '';
    let hasPdf = false;
    for (const name of fileNames) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await file.text();
        } else if (ext === 'pdf') {
          // PDF 转 base64 发给 Claude（单独处理，直接返回）
          const ab = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
          await analyzeContractFile(name, b64, 'pdf', analysisDiv, btn);
          btn.disabled = false;
          return;
        } else if (['doc','docx'].includes(ext)) {
          const text = await readDocxText(file);
          combinedText += `\n\n【文件：${name}】\n` + text;
        } else {
          combinedText += `\n\n【文件：${name}（格式不支持，建议上传 pdf/docx/txt）】`;
        }
      } catch(e) { combinedText += `\n\n【文件：${name}，读取失败：${e.message}】`; }
    }

    if (!combinedText.trim() || combinedText.includes('格式不支持')) {
      if (analysisDiv) {
        analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e65100;font-size:.75rem">⚠️ 无法读取合同内容，请确认文件为 PDF、docx 或 txt 格式</div>`;
      } else {
        showToast('无法读取合同内容，请确认文件为 PDF、docx 或 txt 格式');
      }
      // 启用按钮
      btn.disabled = false;
      btn.style.opacity = '1';
      return;
    }
    await analyzeContractText(combinedText, analysisDiv);
  } catch(e) {
    if (analysisDiv) {
      analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 识别失败：${e.message}</div>`;
    } else {
      showToast('识别失败：' + e.message);
    }
  } finally { 
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

async function analyzeAgreements() {
  // 检查是在主文件面板还是项目编辑页面
  let btn = document.getElementById('agreementAnalyzeBtn');
  let analysisDiv = document.getElementById('agreementAnalysis');
  
  // 如果在项目编辑页面
  if (!btn) {
    btn = document.getElementById('modalAgreementAnalyzeBtn');
    analysisDiv = document.getElementById('modalAgreementAnalysis');
  }
  
  if (!btn) return;
  
  // 禁用按钮并显示加载提示
  btn.disabled = true;
  btn.style.opacity = '0.5';
  
  // 立即显示加载提示
  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在准备识别技术协议…</div></div>`;
  }
  
  const projectId = currentEditProjectId || btn.dataset.projectId;
  const p = projects.find(x => x.id === projectId);
  if (!p) {
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    // 清除加载提示
    if (analysisDiv) {
      analysisDiv.style.display = 'none';
      analysisDiv.innerHTML = '';
    }
    return;
  }
  const dir = await getProjectDirById(p.id);
  if (!dir) {
    showToast('项目文件夹不存在');
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    // 清除加载提示
    if (analysisDiv) {
      analysisDiv.style.display = 'none';
      analysisDiv.innerHTML = '';
    }
    return;
  }

  let fileNames = getSelectedFileNames('agreement');
  if (!fileNames.length) { 
    // 如果没有选中文件，按文件类型分组，选择每种类型中最新的文件
    const files = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && name !== '备注.txt' && !name.startsWith('.')) {
        try {
          const file = await handle.getFile();
          files.push({ name, lastModified: file.lastModified });
        } catch(e) {
          files.push({ name, lastModified: 0 });
        }
      }
    }
    
    const agreementFiles = files.filter(f => f.name.includes('技术协议') || f.name.includes('技术方案') || f.name.includes('需求文档'));
    if (!agreementFiles.length) {
      showToast('没有技术协议文件可识别');
      // 启用按钮
      btn.disabled = false;
      btn.style.opacity = '1';
      // 清除加载提示
      if (analysisDiv) {
        analysisDiv.style.display = 'none';
        analysisDiv.innerHTML = '';
      }
      return;
    }
    
    // 按文件类型分组，选择每种类型中最新的文件
    const agreementFilesByType = {};
    agreementFiles.forEach(file => {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!agreementFilesByType[ext] || file.lastModified > agreementFilesByType[ext].lastModified) {
        agreementFilesByType[ext] = file;
      }
    });
    
    fileNames = Object.values(agreementFilesByType).map(f => f.name);
  }

  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在读取技术协议…</div></div>`;
  }
  btn.disabled = true;

  try {
    let combinedText = '';
    for (const name of fileNames) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await file.text();
        } else if (ext === 'pdf') {
          const ab = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
          await analyzeAgreementFile(name, b64, analysisDiv, btn);
          btn.disabled = false;
          return;
        } else if (['doc','docx'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await readDocxText(file);
        } else {
          combinedText += `\n\n【文件：${name}（格式不支持）】`;
        }
      } catch(e) { combinedText += `\n\n【文件：${name}，读取失败：${e.message}】`; }
    }
    if (!combinedText.trim()) {
      analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e65100;font-size:.75rem">⚠️ 无法读取文件内容</div>`;
      return;
    }
    await analyzeAgreementText(combinedText, projectId, analysisDiv);
  } catch(e) {
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 识别失败：${e.message}</div>`;
  } finally { btn.disabled = false; }
}

// 识别方案报价（报价金额）
async function analyzeQuotes() {
  const btn = document.getElementById('quoteAnalyzeBtn');
  if (!btn) return;
  
  // 禁用按钮并显示加载提示
  btn.disabled = true;
  btn.style.opacity = '0.5';
  
  // 立即显示加载提示
  const analysisDiv = document.getElementById('quoteAnalysis');
  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在准备识别方案报价…</div></div>`;
  }
  
  const projectId = currentEditProjectId || btn.dataset.projectId;
  const p = projects.find(x => x.id === projectId);
  if (!p) {
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    // 清除加载提示
    if (analysisDiv) {
      analysisDiv.style.display = 'none';
      analysisDiv.innerHTML = '';
    }
    return;
  }
  const dir = await getProjectDirById(p.id);
  if (!dir) {
    showToast('项目文件夹不存在');
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    // 清除加载提示
    if (analysisDiv) {
      analysisDiv.style.display = 'none';
      analysisDiv.innerHTML = '';
    }
    return;
  }

  const fileNames = getSelectedFileNames('quote');
  if (!fileNames.length) { 
    showToast('没有方案报价文件可识别'); 
    // 启用按钮
    btn.disabled = false;
    btn.style.opacity = '1';
    // 清除加载提示
    if (analysisDiv) {
      analysisDiv.style.display = 'none';
      analysisDiv.innerHTML = '';
    }
    return; 
  }

  if (analysisDiv) {
    analysisDiv.style.display = 'block';
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;正在读取方案报价…</div></div>`;
  }
  btn.disabled = true;

  try {
    let combinedText = '';
    for (const name of fileNames) {
      try {
        const fh = await dir.getFileHandle(name);
        const file = await fh.getFile();
        const ext = name.split('.').pop().toLowerCase();
        if (['txt','md'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await file.text();
        } else if (ext === 'pdf') {
          const ab = await file.arrayBuffer();
          const b64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
          await analyzeQuoteFile(name, b64, analysisDiv, btn);
          btn.disabled = false;
          return;
        } else if (['doc','docx'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await readDocxText(file);
        } else if (['xls','xlsx'].includes(ext)) {
          combinedText += `\n\n【文件：${name}】\n` + await readExcelText(file);
        } else {
          combinedText += `\n\n【文件：${name}（格式不支持）】`;
        }
      } catch(e) { combinedText += `\n\n【文件：${name}，读取失败：${e.message}】`; }
    }
    if (!combinedText.trim()) {
      analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e65100;font-size:.75rem">⚠️ 无法读取文件内容</div>`;
      return;
    }
    await analyzeQuoteText(combinedText, projectId, analysisDiv);
  } catch(e) {
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 识别失败：${e.message}</div>`;
  } finally { 
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

async function analyzeAgreementFile(name, b64, analysisDiv, btn) {
  analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析技术协议 PDF…</div></div>`;
  try {
    const data = await claudeCall({
      task: '技术协议PDF解析',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: AGREEMENT_ANALYZE_PROMPT }
        ]
      }]
    });
    renderAgreementAnalysis(data, analysisDiv, btn.dataset.projectId);
  } catch(e) {
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ PDF识别失败：${e.message}</div>`;
  }
}

async function analyzeQuoteFile(name, b64, analysisDiv, btn) {
  analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析方案报价 PDF…</div></div>`;
  try {
    const data = await claudeCall({
      task: '方案报价PDF解析',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: QUOTE_ANALYZE_PROMPT }
        ]
      }]
    });
    renderQuoteAnalysis(data, analysisDiv, btn.dataset.projectId);
  } catch(e) {
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ PDF识别失败：${e.message}</div>`;
  }
}

async function analyzeAgreementText(text, projectId, analysisDiv) {
  analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析交付内容…</div></div>`;
  try {
    const data = await claudeCall({
      task: '技术协议解析',
      max_tokens: 4000,
      messages: [{ role: 'user', content: AGREEMENT_ANALYZE_PROMPT + '\n\n以下是技术协议内容：\n' + text.slice(0, 12000) }]
    });
    // 诊断日志
    if (DEBUG) console.log('[技术协议] claudeCall返回:', JSON.stringify({
      has_parsed: !!data._parsed,
      parsed_text_len: data._parsed?.text?.length,
      parsed_text_preview: data._parsed?.text?.slice(0,200),
      parsed_error: data._parsed?.error,
      content_blocks: data.content?.length,
      choices: data.choices?.length,
    }));
    renderAgreementAnalysis(data, analysisDiv, projectId);
  } catch(e) {
    if (DEBUG) console.error('[技术协议] claudeCall异常:', e);
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ AI调用失败：${e.message}</div>`;
  }
}

async function analyzeQuoteText(text, projectId, analysisDiv) {
  analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析报价金额…</div></div>`;
  try {
    const data = await claudeCall({
      task: '方案报价解析',
      max_tokens: 1000,
      messages: [{ role: 'user', content: QUOTE_ANALYZE_PROMPT + '\n\n以下是方案报价内容：\n' + text.slice(0, 12000) }]
    });
    renderQuoteAnalysis(data, analysisDiv, projectId);
  } catch(e) {
    if (DEBUG) console.error('[方案报价] claudeCall异常:', e);
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ AI调用失败：${e.message}</div>`;
  }
}

function renderAgreementAnalysis(data, analysisDiv, projectId) {
  try {
    const rawText = (
      data._parsed?.text ||
      data.choices?.[0]?.message?.content ||
      data.content?.filter(b => b.type==='text').map(b => b.text).join('') || ''
    );
    const text = rawText.replace(/```json|```/g,'').trim();

    if (!text) throw new Error(`AI 返回空响应${data._parsed?.error ? '，错误：' + data._parsed.error : ''}`);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('未找到JSON，原始响应：\n' + text.slice(0,300));
    const result = JSON.parse(match[0]);

    const chips = [
      result.wireless_hardware && `<span class="ca-chip wireless">📡 无线硬件</span>`,
      result.wired_hardware    && `<span class="ca-chip wired">🔌 有线硬件</span>`,
      result.software          && `<span class="ca-chip software">💻 软件定制</span>`,
      result.other             && `<span class="ca-chip other-dev">📎 ${result.other}</span>`,
    ].filter(Boolean);

    if (analysisDiv) {
      // 存储识别结果到全局变量，供确认按钮使用
      window.aiAgreementAnalysisResult = {
        result: result,
        projectId: projectId
      };
      
      analysisDiv.innerHTML = `
        <div class="contract-analysis">
          <div style="font-size:.65rem;color:#7eccd8;margin-bottom:8px;display:flex;align-items:center;gap:5px">
            <span>✅ 识别完成</span><span style="color:#ddd">·</span><span style="color:#aaa">请确认识别结果后再写入项目</span>
          </div>
          ${result.brief ? `<div style="font-size:.76rem;color:var(--ink);font-weight:600;margin-bottom:8px;padding:6px 10px;background:rgba(21,101,192,.05);border-radius:6px;border-left:2px solid var(--s1)">${result.brief}</div>` : ''}
          <div class="ca-chips">${chips.length ? chips.join('') : '<span class="ca-chip none">未识别到具体类型</span>'}</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-cancel" style="padding:6px 16px;font-size:.75rem" onclick="cancelAgreementAIAnalysis()">取消</button>
            <button class="btn-save" style="padding:6px 16px;font-size:.75rem" onclick="confirmAgreementAIAnalysis()">确认写入项目</button>
          </div>
        </div>`;
    }
  } catch(e) {
    const rawText = data._parsed?.text || data.choices?.[0]?.message?.content || data.content?.filter(b=>b.type==='text').map(b=>b.text).join('') || '';
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 解析失败：${e.message}
      <details style="margin-top:8px"><summary style="cursor:pointer;color:#aaa;font-size:.6rem">🔍 诊断信息（点击展开）</summary>
      <div style="white-space:pre-wrap;color:#888;font-family:monospace;max-height:200px;overflow-y:auto;background:rgba(0,0,0,.05);padding:6px;border-radius:4px;margin-top:4px">
_parsed.error: ${data._parsed?.error || '无'}
_parsed.text长度: ${data._parsed?.text?.length ?? 'undefined'}
原始响应(前500字):
${rawText.slice(0,500) || '（空）'}
      </div></details>
    </div>`;
  }
}

// 确认技术协议AI分析结果并写入项目
function confirmAgreementAIAnalysis() {
  if (!window.aiAgreementAnalysisResult) return;
  
  const { result, projectId } = window.aiAgreementAnalysisResult;
  
  if (projectId) {
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      projects[idx].deliveryTags = {
        wireless_hardware: !!result.wireless_hardware,
        wired_hardware:    !!result.wired_hardware,
        software:          !!result.software,
        other:             result.other || '',
        _fromAi: true
      };
      if (result.brief) {
        projects[idx].deliveryBrief = result.brief;
        // 同步两个Tab的brief字段（如果Modal当前打开的是这个项目）
        const briefElements = document.querySelectorAll('#f-delivery-brief');
        briefElements.forEach(el => {
          if (el && editingId === projectId) {
            el.value = result.brief;
          }
        });
      }
      // 同步两个Tab的交付标签
      setDtags(projects[idx].deliveryTags);
      markProjectModified(projectId);
      save();
      refreshView();
      showToast('✅ 技术协议识别完成，交付内容已写入项目');
    }
  }
  
  // 清除全局变量
  delete window.aiAgreementAnalysisResult;
  
  // 清除临时分析结果显示区域
  const analysisDiv = document.getElementById('f-delivery-analysis') || 
                      document.getElementById('agreementAnalysis') || 
                      document.getElementById('modalAgreementAnalysis');
  if (analysisDiv) {
    analysisDiv.innerHTML = '';
  }
}

// 取消技术协议AI分析结果
function cancelAgreementAIAnalysis() {
  delete window.aiAgreementAnalysisResult;
  // 清除临时分析结果显示区域
  const analysisDiv = document.getElementById('f-delivery-analysis') || 
                      document.getElementById('agreementAnalysis') || 
                      document.getElementById('modalAgreementAnalysis');
  if (analysisDiv) {
    analysisDiv.innerHTML = '';
  }
  // 重新启用分析按钮
  const btn = document.getElementById('agreementAnalyzeBtn') || document.getElementById('modalAgreementAnalyzeBtn');
  if (btn) {
    btn.disabled = false;
  }
}

// 切换到交付情况标签页
function switchToDeliveryTab() {
  // 找到交付情况标签页并点击
  const deliveryTab = document.querySelector('.m-tab:nth-child(3)');
  if (deliveryTab) {
    deliveryTab.click();
  }
}

function renderQuoteAnalysis(data, analysisDiv, projectId) {
  try {
    const rawText = (
      data._parsed?.text ||
      data.choices?.[0]?.message?.content ||
      data.content?.filter(b => b.type==='text').map(b => b.text).join('') || ''
    );
    const text = rawText.replace(/```json|```/g,'').trim();

    if (!text) throw new Error(`AI 返回空响应${data._parsed?.error ? '，错误：' + data._parsed.error : ''}`);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('未找到JSON，原始响应：\n' + text.slice(0,300));
    const result = JSON.parse(match[0]);

    // 写回项目
    if (projectId) {
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        projects[idx].quote = result.quote;
        // 同步报价字段（如果Modal当前打开的是这个项目）
        const quoteEl = document.getElementById('f-quote');
        if (quoteEl && editingId === projectId) quoteEl.value = result.quote;
        save();
        refreshView();
        showToast('✅ 方案报价识别完成，报价金额已写入项目');
      }
    }

    analysisDiv.innerHTML = `
      <div class="contract-analysis">
        <div style="font-size:.65rem;color:#7eccd8;margin-bottom:8px">✅ 识别完成 · 数据已写入项目「基本信息」</div>
        <div style="font-size:.76rem;color:var(--ink);font-weight:600;margin-bottom:8px;padding:6px 10px;background:rgba(230,81,0,.05);border-radius:6px;border-left:2px solid var(--sc)">¥${result.quote}万</div>
      </div>`;
  } catch(e) {
    const rawText = data._parsed?.text || data.choices?.[0]?.message?.content || data.content?.filter(b=>b.type==='text').map(b=>b.text).join('') || '';
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 解析失败：${e.message}
      <details style="margin-top:8px"><summary style="cursor:pointer;color:#aaa;font-size:.6rem">🔍 诊断信息（点击展开）</summary>
      <div style="white-space:pre-wrap;color:#888;font-family:monospace;max-height:200px;overflow-y:auto;background:rgba(0,0,0,.05);padding:6px;border-radius:4px;margin-top:4px">
_parsed.error: ${data._parsed?.error || '无'}
_parsed.text长度: ${data._parsed?.text?.length ?? 'undefined'}
原始响应(前500字):
${rawText.slice(0,500) || '（空）'}
      </div></details>
    </div>`;
  }
}

async function analyzeContractFile(name, b64, type, analysisDiv, btn) {
  analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析合同 PDF…</div></div>`;
  try {
    const data = await claudeCall({
      task: '合同PDF解析',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: CONTRACT_ANALYZE_PROMPT }
        ]
      }]
    });
    renderContractAnalysis(data, analysisDiv);
  } catch(e) {
    analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ PDF解析失败：${e.message}</div>`;
  } finally {
    // 启用按钮
    if (btn) {
      btn.disabled = false;
      btn.style.opacity = '1';
    }
  }
}

async function analyzeContractText(text, analysisDiv) {
  if (analysisDiv) {
    analysisDiv.innerHTML = `<div class="contract-analysis"><div class="ca-loading"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 正在分析合同内容…</div></div>`;
  }
  try {
    const data = await claudeCall({
      task: '合同文本解析',
      max_tokens: 4000,
      messages: [{ role: 'user', content: CONTRACT_ANALYZE_PROMPT + '\n\n合同内容如下：\n' + text.slice(0, 12000) }]
    });
    if (analysisDiv) {
      renderContractAnalysis(data, analysisDiv);
    } else {
      renderContractAnalysis(data, null);
    }
  } catch(e) {
    if (analysisDiv) {
      analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 解析失败：${e.message}</div>`;
    } else {
      showToast('合同解析失败：' + e.message);
    }
  }
}

function renderContractAnalysis(data, analysisDiv) {
  try {
    const text = (
      data._parsed?.text ||
      data.choices?.[0]?.message?.content ||
      data.content?.filter(b => b.type==='text').map(b => b.text).join('') ||
      ''
    ).replace(/```json|```/g,'').trim();
    if (!text) throw new Error('AI 返回了空响应，请检查 AI 配置和模型是否正确');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('未找到 JSON，AI 原始响应：\n' + text.slice(0, 300));
    const result = JSON.parse(match[0]);
    const d = result.delivery || {};
    const payments = result.payment || [];
    const contractAmountYuan = (result.contractAmount != null) ? Number(result.contractAmount) : null;
    const contractAmountWan  = contractAmountYuan != null ? +(contractAmountYuan / 10000).toFixed(4).replace(/\.?0+$/, '') : null;

    // 交付内容chips
    const deliveryChips = [
      d.wireless_hardware ? `<span class="ca-chip wireless">📡 无线硬件</span>` : '',
      d.wired_hardware    ? `<span class="ca-chip wired">🔌 有线硬件</span>` : '',
      d.software          ? `<span class="ca-chip software">💻 软件定制</span>` : '',
      d.other             ? `<span class="ca-chip other-dev">📎 其他：${d.other}</span>` : '',
    ].filter(Boolean);
    const noDelivery = !deliveryChips.length;

    // 回款节点行
    const paymentRows = payments.map((row,i) => `
      <div class="ca-payment-row">
        <div class="ca-payment-label">📌 ${row.condition || '-'}</div>
        <div class="ca-payment-val">
          ${row.ratio  ? `<b style="color:var(--s1)">${row.ratio}</b>` : ''}
          ${row.amount ? `&nbsp;·&nbsp;${row.amount}` : ''}
        </div>
      </div>`).join('');

    // 合同金额提示行
    const contractHtml = contractAmountYuan != null ? `
      <div class="ca-section">
        <div class="ca-title">📝 合同金额</div>
        <div style="font-size:.76rem;color:var(--ink);font-weight:600">
          ¥${fmtYuan(contractAmountYuan)} 元
          <span style="font-size:.65rem;color:#888;font-weight:400">（${contractAmountWan} 万元）</span>
        </div>
      </div>` : '';

    if (analysisDiv) {
      // 存储识别结果到全局变量，供确认按钮使用
      window.aiAnalysisResult = {
        result: result,
        projectId: currentEditProjectId || fsCurrentProjectId
      };
      
      analysisDiv.innerHTML = `
        <div class="contract-analysis">
          <div style="font-size:.65rem;color:#7eccd8;margin-bottom:8px;display:flex;align-items:center;gap:5px">
            <span>✅ 识别完成</span><span style="color:#ddd">·</span><span style="color:#aaa">请确认识别结果后再写入项目</span>
          </div>
          ${contractHtml}
          <div class="ca-section">
            <div class="ca-title">📦 交付内容</div>
            <div class="ca-chips">
              ${noDelivery ? '<span class="ca-chip none">未识别到明确交付内容</span>' : deliveryChips.join('')}
            </div>
          </div>
          <div class="ca-section">
            <div class="ca-title">💰 回款节点（共 ${payments.length} 个）</div>
            ${payments.length ? paymentRows : '<div style="color:#ccc;font-size:.75rem">未识别到回款节点</div>'}
          </div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn-cancel" style="padding:6px 16px;font-size:.75rem" onclick="cancelAIAnalysis()">取消</button>
            <button class="btn-save" style="padding:6px 16px;font-size:.75rem" onclick="confirmAIAnalysis()">确认写入项目</button>
          </div>
        </div>`;
    }
  } catch(e) {
    if (analysisDiv) {
      analysisDiv.innerHTML = `<div class="contract-analysis" style="color:#e53935;font-size:.75rem">❌ 解析结果失败：${e.message}</div>`;
    } else {
      showToast('合同解析失败：' + e.message);
    }
  }
}

// 确认AI分析结果并写入项目
function confirmAIAnalysis() {
  if (!window.aiAnalysisResult) return;
  
  const { result, projectId } = window.aiAnalysisResult;
  const d = result.delivery || {};
  const payments = result.payment || [];
  const contractAmountYuan = (result.contractAmount != null) ? Number(result.contractAmount) : null;
  const contractAmountWan  = contractAmountYuan != null ? +(contractAmountYuan / 10000).toFixed(4).replace(/\.?0+$/, '') : null;
  
  if (projectId) {
    const idx = projects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      // 回款节点：标记为AI来源，完全重新创建，不保留原有数据
      const newNodes = payments.map((row, i) => {
        let ratio = row.ratio || '';
        let amount = row.amount || '';
        
        // 根据合同总金额和百分比自动计算金额，或根据金额自动计算百分比
        if (contractAmountYuan != null) {
          if (ratio && !amount) {
            // 有百分比无金额，自动计算金额
            const ratioValue = parseFloat(ratio.replace('%', '')) / 100;
            amount = String(contractAmountYuan * ratioValue / 10000);
          } else if (amount && !ratio) {
            // 有金额无百分比，自动计算百分比
            const amountValue = parseFloat(amount) * 10000;
            const ratioValue = (amountValue / contractAmountYuan) * 100;
            ratio = ratioValue.toFixed(0) + '%';
          }
        }
        
        return {
          condition:          row.condition || '',
          ratio:              ratio,
          amount:             amount,
          contractAmountYuan: contractAmountYuan != null && ratio ? Math.round(contractAmountYuan * parseFloat(ratio.replace('%', '')) / 100) : '',
          actualAmount:       '',
          done:               false,
          _fromAi:            true
        };
      });
      projects[idx].paymentNodes = newNodes;
      // 删除原有催款任务
      projects[idx].collectTasks = [];
      // 清空DOM中的催款任务
      const collectList = document.getElementById('f-collect-list');
      if (collectList) {
        collectList.innerHTML = '<button class="btn-add-row" onclick="addCollectRow({}, true)">+ 添加催款任务</button>';
      }
      // 交付标签
      projects[idx].deliveryTags = { ...d, _fromAi: true };
      // 交付内容：AI识别结果更新到项目数据
      const briefElements = document.querySelectorAll('#f-delivery-brief');
      const noteElements = document.querySelectorAll('#f-delivery-note');
      if (briefElements.length > 0) {
        const briefValue = briefElements[0].value.trim();
        if (briefValue) {
          projects[idx].deliveryBrief = briefValue;
        }
      }
      if (noteElements.length > 0) {
        const noteValue = noteElements[0].value.trim();
        if (noteValue) {
          projects[idx].deliveryNote = noteValue;
        }
      }
      // 合同金额：AI识别结果与已有记录不一致时自动更新
      let contractUpdated = false;
      if (contractAmountWan != null) {
        const existingContract = parseFloat(projects[idx].contract) || 0;
        const diff = Math.abs(existingContract - contractAmountWan);
        if (diff > 0.001) {
          projects[idx].contract = String(contractAmountWan);
          contractUpdated = true;
        }
      }
      // 已回款：从节点汇总
      projects[idx].collected = calcCollectedFromNodes(newNodes, projects[idx].contract);
      // 重算回款进度
      const c = parseFloat(projects[idx].contract) || 0;
      const r = parseFloat(projects[idx].collected) || 0;
      projects[idx].paymentPct = c > 0 ? Math.min(100, Math.round(r / c * 100)) : 0;
      save();
      refreshView();
      
      // 重新渲染相关UI
      if (currentEditProjectId) {
        const p = projects.find(x => x.id === currentEditProjectId);
        if (p) {
          renderPaymentNodes(p);
          // 刷新交付标签
          setDtags(p.deliveryTags || {});
          // 刷新交付内容
          briefElements.forEach(el => {
            el.value = p.deliveryBrief || '';
          });
          noteElements.forEach(el => {
            el.value = p.deliveryNote || '';
          });
          // 刷新合同金额
          if (document.getElementById('f-contract')) {
            document.getElementById('f-contract').value = p.contract || '';
          }
          // 刷新催款任务
          const collectList = document.getElementById('f-collect-list');
          if (collectList) {
            collectList.innerHTML = '';
            const collectTasks = p.collectTasks||[];
            if (collectTasks.length > 0) {
              // 添加标注行
              const labelRow = document.createElement('div');
              labelRow.style.display = 'flex';
              labelRow.style.gap = '6px';
              labelRow.style.padding = '6px 10px';
              labelRow.style.background = 'var(--paper2)';
              labelRow.style.borderRadius = '6px';
              labelRow.style.marginBottom = '6px';
              labelRow.innerHTML = `
                <div style="width: 14px;"></div>
                <div style="width: 130px; font-size: 0.68rem; color: #888;">日期</div>
                <div style="width: 120px; font-size: 0.68rem; color: #888;">金额</div>
                <div style="width: 80px; font-size: 0.68rem; color: #888;">负责人</div>
                <div style="flex: 1; font-size: 0.68rem; color: #888;">备注</div>
                <div style="width: 20px;"></div>
              `;
              collectList.appendChild(labelRow);
            }
            collectTasks.forEach(t=>addCollectRow(t, false));
            if (collectTasks.length === 0) {
              collectList.innerHTML = '<button class="btn-add-row" onclick="addCollectRow({}, true)">+ 添加催款任务</button>';
            }
          }
        }
      }
      
      const toastMsg = contractUpdated
        ? `✅ 合同识别完成，合同金额已更新为 ${contractAmountWan}万元`
        : '✅ 合同识别完成，数据已写入项目';
      showToast(toastMsg);
    }
  }
  
  // 清除全局变量
  delete window.aiAnalysisResult;
  
  // 清除临时分析结果显示区域
  const analysisDiv = document.getElementById('f-contract-analysis') || 
                      document.getElementById('contractAnalysis') || 
                      document.getElementById('modalContractAnalysis');
  if (analysisDiv) {
    analysisDiv.innerHTML = '';
  }
}

// 取消AI分析结果
function cancelAIAnalysis() {
  delete window.aiAnalysisResult;
  // 隐藏分析结果
  const analysisDiv = document.getElementById('contractAnalysis') || document.getElementById('modalContractAnalysis');
  if (analysisDiv) {
    analysisDiv.style.display = 'none';
  }
  // 重新启用分析按钮
  const btn = document.getElementById('contractAnalyzeBtn') || document.getElementById('modalContractAnalyzeBtn');
  if (btn) {
    btn.disabled = false;
  }
}

function getFileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📄';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  if (['zip','rar','7z'].includes(ext)) return '🗜️';
  if (['txt','md'].includes(ext)) return '📃';
  return '📎';
}

// 触发文件上传


function closePreview() {
  document.getElementById('filePreview').classList.remove('open');
  document.getElementById('filePreviewContent').innerHTML = '';
}

// 项目状态转换时的文件整理
async function organizeFilesForProjectStart(projectId) {
  const p = projects.find(x => x.id === projectId);
  if (!p) return;
  
  try {
    const dir = await getProjectDirById(p.id);
    if (!dir) return;
    
    // 创建立项材料子文件夹
    let projectMaterialsDir;
    try {
      projectMaterialsDir = await dir.getDirectoryHandle('立项材料', { create: true });
    } catch(e) {
      if (DEBUG) console.error('创建立项材料文件夹失败:', e);
      return;
    }
    
    // 读取所有文件
    const files = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind === 'file' && name !== '备注.txt') {
        try {
          const file = await handle.getFile();
          files.push({ name, handle, lastModified: file.lastModified });
        } catch(e) {
          files.push({ name, handle, lastModified: 0 });
        }
      }
    }
    
    // 分类文件
    const technicalFiles = files.filter(f => f.name.includes('技术') || f.name.includes('方案'));
    const quoteFiles = files.filter(f => f.name.includes('报价') || f.name.includes('预算'));
    const otherFiles = files.filter(f => !technicalFiles.includes(f) && !quoteFiles.includes(f));
    
    // 按修改时间排序，获取最新的技术方案和报价单
    technicalFiles.sort((a, b) => b.lastModified - a.lastModified);
    quoteFiles.sort((a, b) => b.lastModified - a.lastModified);
    
    const latestTechnicalFile = technicalFiles[0];
    const latestQuoteFile = quoteFiles[0];
    
    // 移动文件到立项材料文件夹
    for (const file of files) {
      // 保留最新的技术方案和报价单
      if (file === latestTechnicalFile || file === latestQuoteFile) {
        continue;
      }
      
      try {
          // 复制文件到新位置
          const newHandle = await projectMaterialsDir.getFileHandle(file.name, { create: true });
          const writable = await newHandle.createWritable();
          const fileContent = await (await file.handle.getFile()).arrayBuffer();
          await writable.write(fileContent);
          await writable.close();
          
          // 删除原文件
          await dir.removeEntry(file.name);
        } catch(e) {
          if (DEBUG) console.error(`移动文件 ${file.name} 失败:`, e);
        }
    }
    
    showToast('✅ 项目文件已整理到「立项材料」文件夹');
  } catch(e) {
    if (DEBUG) console.error('整理项目文件失败:', e);
    showToast('⚠️ 整理项目文件失败');
  }
}

// ══════════════════════════════════════════
export {
  // Modal 文件面板
  loadModalFilePanel,
  renderModalFileSection,
  toggleFileSelection,
  // 回款节点（项目数据直接操作版）
  renderPaymentNodes,
  updatePaymentNode,
  togglePaymentNodeDone,
  togglePaymentNodeTaskCompleted,
  removePaymentNode,
  addPaymentNodeToProject,
  // 文件识别入口
  analyzeContractsForPayment,
  analyzeContractsForDelivery,
  analyzeContracts,
  analyzeAgreements,
  analyzeQuotes,
  // 文件选择
  toggleFileSelect,
  getSelectedFileNames,
  // AI 分析核心
  analyzeContractFile,
  analyzeContractText,
  analyzeAgreementFile,
  analyzeAgreementText,
  analyzeQuoteFile,
  analyzeQuoteText,
  // 结果渲染 & 确认
  renderContractAnalysis,
  confirmAIAnalysis,
  cancelAIAnalysis,
  renderAgreementAnalysis,
  confirmAgreementAIAnalysis,
  cancelAgreementAIAnalysis,
  renderQuoteAnalysis,
  switchToDeliveryTab,
  // 工具函数
  getFileIcon,
  closePreview,
  organizeFilesForProjectStart
};