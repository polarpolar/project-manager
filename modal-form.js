// ╔══════════════════════════════════════════╗
// ║  MODULE: modal-form（Modal 表单控制器）    ║
// ╚══════════════════════════════════════════╝

// ═══════════════════════════════════════════════════
// Modal Tab 切换
// ═══════════════════════════════════════════════════
// 阶段切换时：控制合同签署日期字段和洽谈状态字段显隐
function onStageChange() {
  const stage = parseInt(document.getElementById('f-stage').value);
  if (DEBUG) console.log('项目阶段变更为:', stage);
  
  const cdGroup = document.getElementById('f-contract-date-group');
  const dsGroup = document.getElementById('f-discuss-status-group');
  const activeGroup = document.getElementById('f-active-group');
  const terminationReasonGroup = document.getElementById('f-termination-reason-group');
  const contractAmountGroup = document.getElementById('f-contract-amount-group');
  const collectedAmountGroup = document.getElementById('f-collected-amount-group');
  const quoteAmountGroup = document.getElementById('f-quote-amount-group');
  const deliveryContentGroup = document.getElementById('f-delivery-content-group');
  const deliveryBriefGroup = document.getElementById('f-delivery-brief-group');
  
  // 显示/隐藏合同签署日期字段
  if (cdGroup) {
    cdGroup.style.display = (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none';
    if (DEBUG) console.log('合同签署日期字段显示状态:', (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none');
  }
  
  // 显示/隐藏洽谈状态字段
  if (dsGroup) {
    dsGroup.style.display = (stage === STAGE.NEGOTIATING) ? 'block' : 'none';
    if (DEBUG) console.log('洽谈状态字段显示状态:', (stage === STAGE.NEGOTIATING) ? 'block' : 'none');
  }
  
  // 显示/隐藏活跃度字段（已终止项目不显示）
  if (activeGroup) {
    activeGroup.style.display = (stage !== STAGE.TERMINATED) ? 'block' : 'none';
    if (DEBUG) console.log('活跃度字段显示状态:', (stage !== STAGE.TERMINATED) ? 'block' : 'none');
  }
  
  // 显示/隐藏终止原因字段（仅已终止项目显示）
  if (terminationReasonGroup) {
    terminationReasonGroup.style.display = (stage === STAGE.TERMINATED) ? 'block' : 'none';
    if (DEBUG) console.log('终止原因字段显示状态:', (stage === STAGE.TERMINATED) ? 'block' : 'none');
  }
  
  // 显示/隐藏合同金额和回款金额字段（洽谈中和已终止项目不显示）
  if (contractAmountGroup) {
    contractAmountGroup.style.display = (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none';
    if (DEBUG) console.log('合同金额字段显示状态:', (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none');
  }
  if (collectedAmountGroup) {
    collectedAmountGroup.style.display = (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none';
    if (DEBUG) console.log('回款金额字段显示状态:', (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none');
  }
  
  // 显示/隐藏报价/预算金额字段（洽谈中和已终止项目显示）
  if (quoteAmountGroup) {
    quoteAmountGroup.style.display = (stage === STAGE.NEGOTIATING || stage === STAGE.TERMINATED) ? 'block' : 'none';
    if (DEBUG) console.log('报价/预算金额字段显示状态:', (stage === STAGE.NEGOTIATING || stage === STAGE.TERMINATED) ? 'block' : 'none');
  }
  
  // 显示/隐藏交付内容和内容简介字段（已终止项目不显示）
  if (deliveryContentGroup) {
    deliveryContentGroup.style.display = (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none';
    if (DEBUG) console.log('交付内容字段显示状态:', (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none');
  }
  if (deliveryBriefGroup) {
    deliveryBriefGroup.style.display = (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none';
    if (DEBUG) console.log('内容简介字段显示状态:', (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'block' : 'none');
  }
  
  // 显示/隐藏回款管理、交付情况tab页（洽谈中和已终止项目显示交付情况，不显示回款管理）
  const paymentTab = document.querySelector('.m-tab[onclick="switchModalTab(\'payment\',this)"]');
  const deliveryTab = document.querySelector('.m-tab[onclick="switchModalTab(\'delivery\',this)"]');
  const progressTab = document.querySelector('.m-tab[onclick="switchModalTab(\'progress\',this)"]');
  
  if (paymentTab) {
    paymentTab.style.display = (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'flex' : 'none';
    if (DEBUG) console.log('回款管理tab显示状态:', (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'flex' : 'none');
  }
  if (deliveryTab) {
    deliveryTab.style.display = (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'flex' : 'none';
    if (DEBUG) console.log('交付情况tab显示状态:', (stage === STAGE.NEGOTIATING || stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) ? 'flex' : 'none');
  }
  if (progressTab) {
    progressTab.style.display = 'flex'; // 项目进度Tab在所有阶段都显示
    if (DEBUG) console.log('项目进度tab显示状态: flex');
  }
  
  // 根据项目阶段调整Tab顺序
  const modalTabs = document.querySelector('.modal-tabs');
  if (modalTabs) {
    // 先获取所有标签页元素
    const basicTab = document.querySelector('.m-tab[onclick="switchModalTab(\'basic\',this)"]');
    const paymentTab = document.querySelector('.m-tab[onclick="switchModalTab(\'payment\',this)"]');
    const deliveryTab = document.querySelector('.m-tab[onclick="switchModalTab(\'delivery\',this)"]');
    const progressTab = document.querySelector('.m-tab[onclick="switchModalTab(\'progress\',this)"]');
    const filesTab = document.querySelector('.m-tab[onclick="switchModalTab(\'files\',this)"]');
    const logTab = document.querySelector('.m-tab[onclick="switchModalTab(\'log\',this)"]');
    
    if (basicTab && deliveryTab && progressTab && filesTab && logTab) {
      // 移除所有Tab
      while (modalTabs.firstChild) {
        modalTabs.removeChild(modalTabs.firstChild);
      }
      
      if (stage === STAGE.NEGOTIATING) {
        // 洽谈中：基本信息 / 交付情况 / 项目进度 / 本地文件 / 更新日志
        modalTabs.appendChild(basicTab);
        modalTabs.appendChild(deliveryTab);
        modalTabs.appendChild(progressTab);
        modalTabs.appendChild(filesTab);
        modalTabs.appendChild(logTab);
      } else if (stage === STAGE.DELIVERING || stage === STAGE.COMPLETED) {
        // 执行中/已完结：基本信息 / 回款管理 / 交付情况 / 项目进度 / 本地文件 / 更新日志
        if (paymentTab) {
          modalTabs.appendChild(basicTab);
          modalTabs.appendChild(paymentTab);
          modalTabs.appendChild(deliveryTab);
          modalTabs.appendChild(progressTab);
          modalTabs.appendChild(filesTab);
          modalTabs.appendChild(logTab);
        }
      } else {
        // 已终止：基本信息 / 交付情况 / 项目进度 / 本地文件 / 更新日志
        modalTabs.appendChild(basicTab);
        modalTabs.appendChild(deliveryTab);
        modalTabs.appendChild(progressTab);
        modalTabs.appendChild(filesTab);
        modalTabs.appendChild(logTab);
      }
      
      // 激活第一个Tab
      const firstTab = modalTabs.querySelector('.m-tab');
      if (firstTab) {
        firstTab.classList.add('active');
      }
    }
  }
}

// 合同签署日期变化时：更新编号尾部年月（预览）
function onContractDateChange() {
  const cdEl   = document.getElementById('f-contract-date');
  const codeEl = document.getElementById('f-code-display');
  if (!cdEl) return;
  const stage = parseInt(document.getElementById('f-stage').value);
  const contractDate = cdEl.value;

  // 更新编号预览（编辑模式下更新项目数据但不保存）
  if (editingId) {
    const idx = projects.findIndex(p => p.id === editingId);
    if (idx !== -1) {
      const p = projects[idx];
      const oldDirName = getProjectDirName(p);
      const oldCode = p.projectCode;
      const newCode = oldCode
        ? updateCodePrefix(oldCode, stage, contractDate)
        : genProjectCode(stage, contractDate);
      
      if (newCode !== oldCode || p.contractDate !== contractDate) {
        p.projectCode  = newCode;
        p.contractDate = contractDate;
        
        // 仅更新UI，不保存和写日志
        if (codeEl) codeEl.value = newCode || '';
        
        // 重命名目录（如果需要）
        const newDirName = getProjectDirName(p);
        if (oldDirName !== newDirName) renameProjectDir(oldDirName, newDirName);
      } else {
        p.contractDate = contractDate;
        if (codeEl) codeEl.value = newCode || '';
      }
    }
  } else if (codeEl && codeEl.value) {
    // 新建模式：仅预览
    const updated = updateCodePrefix(codeEl.value, stage, contractDate);
    codeEl.value = updated || codeEl.value;
  }
}

function switchModalTab(tab, el) {
  console.log('switchModalTab called:', tab, 'currentEditProjectId:', currentEditProjectId);
  document.querySelectorAll('.m-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.m-tab-body').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('mtab-' + tab).classList.add('active');
  
  // 切换到本地文件标签页时更新目录显示和模块显示
  if (tab === 'files' && currentEditProjectId) {
    console.log('切换到文件标签页，准备加载文件面板');
    updateRootBar(currentEditProjectId);
    
    const p = projects.find(x => x.id === currentEditProjectId);
    if (!p) return;
    
    // 根据项目阶段显示或隐藏不同的文件模块
    const contractSection = document.getElementById('modalContractSection');
    const agreementSection = document.getElementById('modalAgreementSection');
    const techPlanSection = document.getElementById('modalTechPlanSection');
    const quoteSection = document.getElementById('modalQuoteSection');
    
    if (p.stage === STAGE.NEGOTIATING || p.stage === STAGE.TERMINATED) {
      // 洽谈中项目和已终止项目：显示技术方案、方案报价和其他文件模块
      if (contractSection) contractSection.style.display = 'none';
      if (agreementSection) agreementSection.style.display = 'none';
      if (techPlanSection) techPlanSection.style.display = 'block';
      if (quoteSection) quoteSection.style.display = 'block';
    } else if (p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) {
      // 执行中项目和已完结项目：显示合同、技术协议和其他文件模块
      if (contractSection) contractSection.style.display = 'block';
      if (agreementSection) agreementSection.style.display = 'block';
      if (techPlanSection) techPlanSection.style.display = 'none';
      if (quoteSection) quoteSection.style.display = 'none';
    }
    
    // 加载项目文件
    loadModalFilePanel(p.id);
  } else if (tab === 'progress' && currentEditProjectId) {
    // 切换到进度标签页时渲染进度内容
    console.log('切换到进度标签页，准备渲染进度内容');
    const p = projects.find(x => x.id === currentEditProjectId);
    if (p) {
      renderMonthlyProgress(p);
    }
  }
}

function switchModalTabById(tab) {
  const tabs = document.querySelectorAll('.m-tab');
  const bodies = document.querySelectorAll('.m-tab-body');
  const tabMap = ['basic','payment','delivery','progress','files','log'];
  const i = tabMap.indexOf(tab);
  if (i < 0) return;
  tabs.forEach((t,j) => t.classList.toggle('active', j===i));
  bodies.forEach((b,j) => b.classList.toggle('active', j===i));
  
  // 如果切换到进度标签页，渲染进度内容
  if (tab === 'progress' && currentEditProjectId) {
    const p = projects.find(x => x.id === currentEditProjectId);
    if (p) {
      renderMonthlyProgress(p);
    }
  }
}

// 简单的进度类型识别函数
window.getProgressType = function(content) {
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes('技术') || lowerContent.includes('软件') || lowerContent.includes('硬件') || lowerContent.includes('调试')) {
    return { type: '技术', color: '#4CAF50' };
  } else if (lowerContent.includes('商务') || lowerContent.includes('合同') || lowerContent.includes('报价') || lowerContent.includes('客户')) {
    return { type: '商务', color: '#2196F3' };
  } else if (lowerContent.includes('交付') || lowerContent.includes('发货') || lowerContent.includes('安装') || lowerContent.includes('验收')) {
    return { type: '交付', color: '#FF9800' };
  } else if (lowerContent.includes('回款') || lowerContent.includes('付款') || lowerContent.includes('财务')) {
    return { type: '财务', color: '#9C27B0' };
  } else {
    return { type: '其他', color: '#9E9E9E' };
  }
};

// 全局变量，用于存储当前正在编辑的项目
let currentProgressProject = null;

// 渲染项目进度
function renderMonthlyProgress(project, filterType = 'all') {
  const container = document.getElementById('project-progress-content');
  if (!container) return;

  currentProgressProject = project;

  const progress = project.monthlyProgress || [];

  if (progress.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#bbb;font-size:.82rem">
        暂无进度记录，请从语雀导入
      </div>
    `;
    return;
  }

  const sortedProgress = [...progress].sort((a, b) => {
    const [yearA, monthA] = a.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    const [yearB, monthB] = b.month.match(/(\d{4})年(\d+)月/).slice(1).map(Number);
    return yearB - yearA || monthB - monthA;
  });

  const filteredProgress = filterType === 'all' ? sortedProgress : sortedProgress.filter(item =>
    getProgressType(item.content).type === filterType
  );

  const tagTypes = [
    { type: 'all',  name: '全部', color: '#888' },
    { type: '技术', name: '技术', color: '#4CAF50' },
    { type: '商务', name: '商务', color: '#2196F3' },
    { type: '交付', name: '交付', color: '#FF9800' },
    { type: '财务', name: '财务', color: '#9C27B0' },
    { type: '其他', name: '其他', color: '#9E9E9E' }
  ];

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:.72rem;color:#aaa">${progress.length} 条记录</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        ${tagTypes.map(tag => `
          <span onclick="filterProgressByType('${tag.type}')"
            style="cursor:pointer;font-size:.68rem;padding:2px 9px;border-radius:10px;
                   border:1px solid ${filterType === tag.type ? tag.color : '#ddd'};
                   background:${filterType === tag.type ? tag.color : 'transparent'};
                   color:${filterType === tag.type ? 'white' : '#888'};
                   transition:all 0.15s">
            ${tag.name}
          </span>
        `).join('')}
      </div>
    </div>

    ${filteredProgress.length > 0 ? filteredProgress.map(item => {
      const progressType = getProgressType(item.content);
      const isLong = item.content.length > 100 || item.content.split('\n').length > 3;

      return `
        <div style="display:flex;align-items:flex-start;gap:8px;
                    padding:4px 8px;background:var(--paper);border-radius:6px;
                    margin-bottom:4px;border-left:2px solid ${progressType.color}">
          <div style="display:flex;align-items:flex-start;gap:32px;
                      min-width:124px;width:124px;flex-shrink:0;padding-top:1px">
            <span style="font-size:.82rem;color:#888;white-space:nowrap;line-height:1.65">
              ${item.month}
            </span>
            <span style="font-size:.72rem;padding:0 2px;border-radius:8px;
                        background:${progressType.color}20;color:${progressType.color};
                        border:1px solid ${progressType.color}50;white-space:nowrap;
                        line-height:1.6;display:inline-block;flex-shrink:0;margin-top:1px">
              ${progressType.type}
            </span>
          </div>
          <div style="flex:1;min-width:0;padding-top:1px">
            <div class="progress-content"
              style="font-size:.82rem;line-height:1.65;color:#444;white-space:pre-wrap;
                    display:block;margin:0;${isLong ? 'max-height:80px;overflow:hidden' : ''}">${item.content.trim()}</div>
            ${isLong ? `
              <span class="progress-toggle" onclick="toggleProgress(this)"
                style="font-size:.7rem;color:var(--accent);cursor:pointer;
                      display:inline-block;margin-top:4px">
                展开 ↓
              </span>
            ` : ''}
          </div>
        </div>
      `;
    }).join('') : `
      <div style="text-align:center;padding:30px 20px;color:#bbb;font-size:.82rem">
        暂无「${filterType}」类型的进度记录
      </div>
    `}
  `;
}

// 根据标签类型筛选进度
window.filterProgressByType = function(type) {
  if (DEBUG) {
    console.log('filterProgressByType called:', type, 'currentEditProjectId:', currentEditProjectId);
  }
  if (currentEditProjectId) {
    const p = projects.find(x => x.id === currentEditProjectId);
    if (p) {
      renderMonthlyProgress(p, type);
    } else {
      if (DEBUG) {
        console.log('Project not found:', currentEditProjectId);
      }
    }
  } else {
    if (DEBUG) {
      console.log('currentEditProjectId is null');
    }
  }
};

// 切换进度内容的展开/收起
window.toggleProgress = function(element) {
  const content = element.previousElementSibling;
  const isExpanded = content.style.maxHeight !== '120px';
  
  if (isExpanded) {
    content.style.maxHeight = '120px';
    content.style.overflow = 'hidden';
    element.textContent = '展开 ↓';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.overflow = 'visible';
    element.textContent = '收起 ↑';
  }
};

// 同步镜像字段（基本信息Tab中的合同金额/回款总金额 ↔ 金额Tab）
function syncMirrorFields() {
  const c = document.getElementById('f-contract').value;
  const r = document.getElementById('f-collected').value;
  const cm = document.getElementById('f-contract-mirror');
  const rm = document.getElementById('f-collected-mirror');
  if (cm) cm.value = c;
  if (rm) rm.value = r;
}

// 同步交付内容描述字段（交付情况Tab ↔ 基本信息Tab）
function syncDeliveryBrief(value) {
  const briefElements = document.querySelectorAll('#f-delivery-brief');
  briefElements.forEach(el => {
    if (el.value !== value) {
      el.value = value;
    }
  });
}

// 合同金额变化后重算所有节点比例→金额
function syncPnFromContract() {
  document.querySelectorAll('#f-pn-list .pn-row').forEach(row => {
    const amtInput = row.querySelector('.pn-amount');
    // 只重算有比例、金额为空或原本由比例算出来的节点
    if (row.dataset.calcFromRatio === '1' || !amtInput.value) {
      calcPnAmountFromRatio(row);
    }
  });
}

function updatePaymentPct() {
  const c = parseFloat(document.getElementById('f-contract').value)||0;
  const r = parseFloat(document.getElementById('f-collected').value)||0;
  const pct = c>0 ? Math.min(100,Math.round(r/c*100)) : 0;
  document.getElementById('f-pct-label').textContent = pct+'%';
  document.getElementById('f-pct-bar').style.width = pct+'%';
  document.getElementById('f-pct-hint').textContent = c>0 ? `合同 ${c.toFixed(2)}万 · 已回款 ${r.toFixed(2)}万` : '填写合同金额和已回款金额后自动计算';
  syncMirrorFields();
}

// ╔══════════════════════════════════════════╗
// ║  MODULE: payment（回款节点子模块）       ║
// ╚══════════════════════════════════════════╝
function addPaymentNode(node={}, fromAi=false) {
  const list = document.getElementById('f-pn-list');
  document.getElementById('f-pn-empty').style.display = 'none';
  const idx = list.children.length + 1;
  const row = document.createElement('div');
  row.className = 'pn-row' + (node.done ? ' done-row' : '');
  // 使用万元单位显示金额
  const amtDisplay = node.amount || '';
  row.innerHTML = `
    <!-- 顶部工具栏：序号 / AI标签 / 删除 -->
    <div class="pn-toolbar">
      <span class="pn-idx">${idx}</span>
      ${fromAi ? `<span class="pn-ai-badge">AI</span>` : ''}
      <button type="button" class="pn-rm" onclick="removePaymentNode(this)" title="删除">×</button>
    </div>
    <!-- 交付任务目标区：标题描述 + 紧跟的完成勾选 -->
    <div class="pn-task-area">
      <div class="pn-task-label">📋 交付任务目标</div>
      <div class="pn-task-row" style="display:flex;align-items:center;gap:10px;">
        <input class="pn-condition" type="text" style="flex:1;"
          placeholder="描述需完成的交付任务，如：合同签订后收到保函及发票"
          value="${(node.condition||'').replace(/"/g,'&quot;')}">
        <div class="pn-deliver-toggle" onclick="onPnDeliverToggle(this)" style="flex-shrink:0;">
          <input type="checkbox" class="pn-deliver-chk" ${node.deliverDone?'checked':''}>
          <div class="pn-status-btn ${node.deliverDone?'active-deliver':''}">
            ${node.deliverDone?'✅ 交付完成':'○ 交付完成'}
          </div>
        </div>
      </div>
    </div>
    <!-- 主体：左=回款目标  右=回款落实 -->
    <div class="pn-body">
      <div class="pn-col">
        <div class="pn-col-title">🎯 回款目标</div>
        <div class="pn-field">
          <label>回款比例</label>
          <input class="pn-ratio" type="text" placeholder="如 30%"
            value="${node.ratio||''}" oninput="onPnRatioInput(this)">
        </div>
        <div class="pn-field">
          <label>金额（万元）</label>
          <input class="pn-amount" type="text" placeholder="0" 
            value="${amtDisplay}" onchange="updatePaymentNode(${idx-1}, 'amount', this.value)">
        </div>
      </div>
      <div class="pn-col">
        <div class="pn-col-title">💰 回款落实</div>
        <div class="pn-field">
          <label>实际到账（万元）</label>
          <input class="pn-actual" type="text" placeholder="0" 
              value="${node.actualAmount||''}" oninput="onPnActualInput(this)">
        </div>
        <div class="pn-done-toggle" onclick="onPnDoneToggle(this)">
          <input type="checkbox" ${node.done?'checked':''}>
          <div class="pn-status-btn ${node.done?'active-done':''}">
            ${node.done?'✅ 回款已到账':'○ 回款已到账'}
          </div>
        </div>
      </div>
    </div>`;
  list.appendChild(row);
  row.dataset.contractAmountYuan = node.contractAmountYuan || '';

  // 如果有比例但没有金额，根据合同金额自动计算
  const amtInput = row.querySelector('.pn-amount');
  if (!amtInput.value && node.ratio) {
    calcPnAmountFromRatio(row);
  }
}

// 从回款节点汇总已回款金额（万元字符串）
// 规则：节点 done=true 取 actualAmount（元），否则取 actualAmount（如有填写也计入）
// 最终转为万元，保留4位小数去零尾
function calcCollectedFromNodes(nodes, contractWanStr) {
  if (!nodes || !nodes.length) return '';
  let totalWan = 0;
  let hasAny = false;
  nodes.forEach(n => {
    const actual = parseFloat(n.actualAmount);
    if (!isNaN(actual) && actual > 0) {
      totalWan += actual;
      hasAny = true;
    }
  });
  if (!hasAny) return '';
  return +totalWan.toFixed(4) === 0 ? '' : String(+totalWan.toFixed(4));
}

// 解析金额字符串为元（数字）：支持"万元"、"元"、纯数字
function parseContractAmt(str) {
  if (!str) return '';
  const s = String(str).replace(/,/g,'').trim();
  const wan = s.match(/([\d.]+)\s*万/);
  if (wan) return Math.round(parseFloat(wan[1]) * 10000);
  const yuan = s.match(/([\d.]+)/);
  if (yuan) return Math.round(parseFloat(yuan[1]));
  return '';
}

// 实时汇总所有节点已回款 → 更新 f-collected 和镜像字段
function syncCollectedFromNodes() {
  const nodes = getPaymentNodes();
  const collected = calcCollectedFromNodes(nodes);
  if (collected !== '') {
    document.getElementById('f-collected').value = collected;
    const rm = document.getElementById('f-collected-mirror');
    if (rm) rm.value = collected;
    updatePaymentPct();
  }
}

// 已回款金额变化 → 检查是否 >= 回款金额，自动勾选；同步汇总到 f-collected
function onPnActualInput(input) {
  const row = input.closest('.pn-row');
  const amtInput = row.querySelector('.pn-amount');
  const actual = parseFloat(input.value) || 0;
  const target = parseFloat(amtInput.value) || 0;
  const done = target > 0 && actual >= target;
  const doneToggle = row.querySelector('.pn-done-toggle');
  const btn  = doneToggle?.querySelector('.pn-status-btn');
  const chk  = doneToggle?.querySelector('input[type=checkbox]');
  if (btn) { btn.classList.toggle('active-done', done); btn.textContent = done ? '✅ 回款已到账' : '○ 回款已到账'; }
  if (chk)  chk.checked = done;
  row.classList.toggle('done-row', done);
  input.classList.toggle('pn-actual-done', done);
  syncCollectedFromNodes();
}

// 回款金额手动修改 → 清除比例自动计算标记，重新评估完成状态
function onPnAmountInput(input) {
  const row = input.closest('.pn-row');
  row.dataset.calcFromRatio = '0';  // 手动修改，不再跟随比例
  onPnActualInput(row.querySelector('.pn-actual'));
}

// 解析比例字符串为小数（"30%" → 0.3，"30" → 0.3）
function parsePnRatio(str) {
  if (!str) return null;
  const s = String(str).replace(/\s/g, '');
  const m = s.match(/([\d.]+)\s*%/);
  if (m) return parseFloat(m[1]) / 100;
  const n = parseFloat(s);
  if (!isNaN(n) && n > 0) return n > 1 ? n / 100 : n;
  return null;
}

// 根据比例 × 合同金额（万元→元）计算节点回款金额
function calcPnAmountFromRatio(row) {
  const ratioInput = row.querySelector('.pn-ratio');
  const amtInput   = row.querySelector('.pn-amount');
  const pct = parsePnRatio(ratioInput.value);
  if (pct === null) return;
  const contractWan = parseFloat(document.getElementById('f-contract').value) || 0;
  if (!contractWan) return;
  const computed = contractWan * pct;
  amtInput.value = String(computed);
  row.dataset.contractAmountYuan = Math.round(computed * 10000);
  row.dataset.calcFromRatio = '1';
  onPnActualInput(row.querySelector('.pn-actual'));
}

// 比例输入 → 自动计算回款金额
function onPnRatioInput(input) {
  calcPnAmountFromRatio(input.closest('.pn-row'));
}

// 交付任务完成toggle
function onPnDeliverToggle(wrap) {
  const row   = wrap.closest('.pn-row');
  const chk   = wrap.querySelector('.pn-deliver-chk');
  const btn   = wrap.querySelector('.pn-status-btn');
  const newDone = !chk.checked;
  chk.checked = newDone;
  if (btn) {
    btn.classList.toggle('active-deliver', newDone);
    btn.textContent = newDone ? '✅ 交付任务完成' : '○ 交付任务完成';
  }
  // 写日志
  if (newDone) {
    _appendPendingLog(`📦 节点「${row.querySelector('.pn-condition')?.value||'回款节点'}」交付任务已完成`);
  }
}

// 回款完成toggle → 标记对应催款完成 + 写日志
function onPnDoneToggle(wrap) {
  const row = wrap.closest('.pn-row');
  const chk  = wrap.querySelector('input[type=checkbox]');
  const btn  = wrap.querySelector('.pn-status-btn');
  const amtInput    = row.querySelector('.pn-amount');
  const actualInput = row.querySelector('.pn-actual');
  const newDone = !chk.checked;
  chk.checked = newDone;
  if (btn) {
    btn.classList.toggle('active-done', newDone);
    btn.textContent = newDone ? '✅ 回款已到账' : '○ 回款已到账';
  }
  row.classList.toggle('done-row', newDone);
  if (newDone) {
    const target = parseFloat(amtInput.value) || 0;
    const actual = parseFloat(actualInput.value) || 0;
    // 如果实际到账小于目标金额，自动填充目标金额
    if (target > 0 && actual < target) {
      actualInput.value = target;
    }
    actualInput.classList.add('pn-actual-done');
    // 写日志
    const condition = row.querySelector('.pn-condition')?.value || '';
    const amtYuan = parseFloat(amtInput.value)||0;
    const amtWan = amtYuan?(amtYuan/10000).toFixed(2)+'万':'';
    _appendPendingLog(`💰 节点「${condition||'回款节点'}」回款已到账${amtWan?' · '+amtWan:''}`);
  } else {
    actualInput.classList.remove('pn-actual-done');
  }
  syncCollectedFromNodes();
}

// 催款任务完成change → 写日志
function onCollectDoneChange(chk) {
  if (chk.checked) {
    const row = chk.closest('.collect-row');
    const amountEl = row.querySelector('.ct-amount');
    const noteEl   = row.querySelector('.ct-note');
    const amt = amountEl?.value;
    _appendPendingLog(`🔔 催款任务完成${amt?' · '+amt+'万':''}${noteEl?.value?' · '+noteEl.value:''}`);
    showToast('✅ 催款任务已完成');
  }
}

// 暂存待写入日志（保存时批量写入）
let _pendingLogs = [];
function _appendPendingLog(text) {
  _pendingLogs.push(text);
  // 同时追加到更新日志输入框（方便用户确认）
  const el = document.getElementById('f-update-log');
  if (el) {
    const existing = el.value.trim();
    el.value = existing ? existing + '\n' + text : text;
  }
}

function removePaymentNode(btn) {
  btn.closest('.pn-row').remove();
  document.querySelectorAll('#f-pn-list .pn-row').forEach((r,i) => {
    const idx = r.querySelector('.pn-idx');
    if(idx) idx.textContent = i+1;
  });
  const list = document.getElementById('f-pn-list');
  document.getElementById('f-pn-empty').style.display = list.children.length ? 'none' : 'block';
}

function getPaymentNodes() {
  const nodes = [];
  const rows = document.querySelectorAll('#f-pn-list .pn-row');
  const rowCount = rows.length;
  
  for (let i = 0; i < rowCount; i++) {
    const r = rows[i];
    
    // 缓存DOM查询结果
    const conditionEl = r.querySelector('.pn-condition');
    const ratioInput = r.querySelector('.pn-ratio');
    const amountInput = r.querySelector('.pn-amount');
    const actualInput = r.querySelector('.pn-actual');
    const doneToggle = r.querySelector('.pn-done-toggle input[type=checkbox]');
    const deliverToggle = r.querySelector('.pn-deliver-chk');
    
    // 提取值
    const condition = conditionEl?.value?.trim() || '';
    const ratio = ratioInput?.value?.trim() || '';
    const amount = amountInput?.value?.trim() || '';
    
    if (condition || ratio || amount) {
      nodes.push({
        condition: condition,
        ratio: ratio,
        amount: amount,
        actualAmount: actualInput?.value?.trim() || '',
        done: doneToggle?.checked || false,
        deliverDone: deliverToggle?.checked || false,
        _fromAi: r.dataset.fromAi === '1'
      });
    }
  }
  return nodes;
}

// ── 交付标签 ──
function toggleDtag(key) {
  const el1 = document.getElementById('dtag-'  + key);
  const el2 = document.getElementById('dtag2-' + key);
  const nowOff = el1.classList.toggle('off');
  if (el2) el2.classList.toggle('off', nowOff);
}

function toggleDtag2(key) {
  const el1 = document.getElementById('dtag-'  + key);
  const el2 = document.getElementById('dtag2-' + key);
  const nowOff = el2.classList.toggle('off');
  if (el1) el1.classList.toggle('off', nowOff);
}

function setDtags(tags={}) {
  const map = {wl:'wireless_hardware', wd:'wired_hardware', sw:'software', ot:'other'};
  const aiHint = tags._fromAi ? '（AI识别）' : '';
  ['wl','wd','sw','ot'].forEach(k => {
    const active = !!tags[map[k]];
    const el1 = document.getElementById('dtag-'  + k);
    const el2 = document.getElementById('dtag2-' + k);
    if (el1) el1.classList.toggle('off', !active);
    if (el2) el2.classList.toggle('off', !active);
  });
  const h1 = document.getElementById('dt-ai-hint');
  const h2 = document.getElementById('dt-ai-hint2');
  if (h1) h1.textContent = aiHint;
  if (h2) h2.textContent = aiHint;
}

function getDtags() {
  const map = {wl:'wireless_hardware', wd:'wired_hardware', sw:'software', ot:'other'};
  const result = {};
  ['wl','wd','sw','ot'].forEach(k => {
    result[map[k]] = !document.getElementById('dtag-'+k).classList.contains('off');
  });
  return result;
}

function addCollectRow(task={}, isNew=false) {
  const list = document.getElementById('f-collect-list');
  const row = document.createElement('div');
  row.className = 'collect-row';
  row.innerHTML = `
    <input type="checkbox" class="ct-done" ${task.done?'checked':''} onchange="onCollectDoneChange(this)">
    <input type="date" class="ct-date" value="${task.date||''}">
    <div style="display: flex; align-items: center; gap: 4px; width: 120px;">
      <input type="number" class="ct-amount" placeholder="金额" value="${task.amount||''}" step="0.01" min="0" style="width: 80px;">
      <span style="font-size: 0.72rem; color: #888;">万元</span>
    </div>
    <input type="text" class="ct-owner" placeholder="负责人" value="${task.owner||''}" style="width: 80px;">
    <input type="text" class="ct-note"  placeholder="备注（可选）" value="${esc(task.note||'')}" style="flex: 1;">
    <button type="button" class="btn-rm-row" onclick="this.parentElement.remove()">×</button>`;
  list.appendChild(row);
  // 新增催款任务时添加系统提示
  if (isNew && !task.done) {
    _appendPendingLog(`🔔 新增催款任务${task.amount?' · '+task.amount+'万':''}${task.note?' · '+esc(task.note):''}`);
    showToast('✅ 催款任务已新增');
  }
}

function getCollectTasks() {
  const tasks = [];
  const rows = document.querySelectorAll('.collect-row');
  const rowCount = rows.length;
  
  for (let i = 0; i < rowCount; i++) {
    const r = rows[i];
    
    // 缓存DOM查询结果
    const doneEl = r.querySelector('.ct-done');
    const dateEl = r.querySelector('.ct-date');
    const amountEl = r.querySelector('.ct-amount');
    const ownerEl = r.querySelector('.ct-owner');
    const noteEl = r.querySelector('.ct-note');
    
    const date = dateEl?.value || '';
    const amount = amountEl?.value || '';
    
    if (date || amount) {
      tasks.push({
        done: doneEl?.checked || false,
        date: date,
        amount: amount,
        owner: ownerEl?.value?.trim() || '',
        note: noteEl?.value?.trim() || ''
      });
    }
  }
  return tasks;
}

function addTodoRow(text='', done=false) {
  const list = document.getElementById('todos-list');
  const row = document.createElement('div');
  row.className='todo-row';
  row.innerHTML = `
    <input type="checkbox" ${done?'checked':''}>
    <input type="text" placeholder="待办内容…" value="${esc(text)}">
    <button class="btn-remove-todo">×</button>`;
  list.appendChild(row);
}

// 为待办事项列表添加事件委托
function setupTodoEventDelegation() {
  const todosList = document.getElementById('todos-list');
  if (todosList) {
    todosList.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-remove-todo')) {
        e.target.parentElement.remove();
      }
    });
  }
}

function getTodos() {
  const todos = [];
  const rows = document.querySelectorAll('#todos-list .todo-row');
  const rowCount = rows.length;
  
  for (let i = 0; i < rowCount; i++) {
    const r = rows[i];
    
    // 缓存DOM查询结果
    const textEl = r.querySelector('input[type=text]');
    const doneEl = r.querySelector('input[type=checkbox]');
    
    const text = textEl?.value?.trim() || '';
    if (text) {
      todos.push({
        text: text,
        done: doneEl?.checked || false
      });
    }
  }
  return todos;
}

function renderLogHistory(logs) {
  const box = document.getElementById('f-log-history');
  if (!box) return;
  if (!logs||!logs.length) { box.innerHTML=''; return; }
  box.innerHTML = `<div style="font-size:.68rem;color:#aaa;margin-bottom:6px">历史记录（${logs.length}条）</div>`
    + [...logs].reverse().map(l=>`
    <div class="log-history-item">
      <div class="log-time">${l.time}</div>
      <div class="log-text">${l.text}</div>
    </div>`).join('');
}

// 清空项目更新日志
function clearProjectLogs() {
  if (!editingId) return;
  
  showConfirm({
    icon: '🗑️',
    title: '清空更新日志',
    msg: '确定要清空该项目的所有更新日志吗？此操作需要点击"保存"按钮后生效。',
    okText: '清空',
    onOk: () => {
      const idx = projects.findIndex(p => p.id === editingId);
      if (idx !== -1) {
        // 清空日志
        projects[idx].logs = [];
        // 标记项目为已修改
        markProjectModified(editingId);
        // 更新 UI
        renderLogHistory([]);
        showToast('更新日志已清空，请点击"保存"按钮以持久化变更');
      }
    }
  });
}

// ╔══════════════════════════════════════════╗
// ║  MODULE: modal-form（Modal 表单控制器）  ║
// ╚══════════════════════════════════════════╝

function openModal() {
  editingId = null;
  _pendingLogs = [];
  document.getElementById('modal-title').textContent = '新建项目';
  ['f-name','f-source','f-owner','f-product','f-desc','f-quote','f-contract','f-cost','f-collected','f-update-log','f-delivery-note','f-delivery-brief','f-contract-mirror','f-collected-mirror','f-termination-reason']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('f-stage').value = '0';
  document.getElementById('f-active').value = 'active';
  document.getElementById('f-collect-list').innerHTML = '';
  document.getElementById('f-pn-list').innerHTML = '';
  document.getElementById('f-pn-empty').style.display = 'block';
  document.getElementById('f-pct-label').textContent = '0%';
  document.getElementById('f-pct-bar').style.width = '0%';
  document.getElementById('f-pct-hint').textContent = '填写合同金额和已回款金额后自动计算';
  document.getElementById('f-log-history').innerHTML = '';
  document.getElementById('todos-list').innerHTML = '';
  document.getElementById('pn-ai-hint').textContent = '';
  document.getElementById('dt-ai-hint').textContent = '';
  document.getElementById('dt-ai-hint2').textContent = '';
  setDtags({});
  addTodoRow();
  document.querySelectorAll('.m-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('.m-tab-body').forEach((b,i)=>b.classList.toggle('active',i===0));
  // 新建：清空编号相关字段
  const _codeEl = document.getElementById('f-code-display');
  if (_codeEl) _codeEl.value = '';
  const _cdEl = document.getElementById('f-contract-date');
  if (_cdEl) _cdEl.value = '';
  const _cdGroup = document.getElementById('f-contract-date-group');
  if (_cdGroup) _cdGroup.style.display = 'none';
  const _dsGroup = document.getElementById('f-discuss-status-group');
  if (_dsGroup) _dsGroup.style.display = 'none';
  document.getElementById('overlay').classList.add('show');
}

let originalProjectData = null;

function editProject(id) {
  const p = projects.find(x=>String(x.id)===String(id));
  if (!p) return;
  
  // 使用requestAnimationFrame优化渲染时机
  requestAnimationFrame(() => {
    editingId = id;
    _pendingLogs = [];
    // 保存原始项目数据，用于比较是否有更新
    originalProjectData = JSON.parse(JSON.stringify(p));
    
    // 1. 缓存DOM元素引用，减少重复查找
    const elements = {
      modalTitle: document.getElementById('modal-title'),
      fName: document.getElementById('f-name'),
      fChannel: document.getElementById('f-channel'),
      fSource: document.getElementById('f-source'),
      fOwner: document.getElementById('f-owner'),
      fProduct: document.getElementById('f-product'),
      fDesc: document.getElementById('f-desc'),
      fStage: document.getElementById('f-stage'),
      fActive: document.getElementById('f-active'),
      fQuote: document.getElementById('f-quote'),
      fContract: document.getElementById('f-contract'),
      fCost: document.getElementById('f-cost'),
      fCollected: document.getElementById('f-collected'),
      fContractMirror: document.getElementById('f-contract-mirror'),
      fCollectedMirror: document.getElementById('f-collected-mirror'),
      fDeliveryNote: document.getElementById('f-delivery-note'),
      fTerminationReason: document.getElementById('f-termination-reason'),
      fUpdateLog: document.getElementById('f-update-log'),
      fContractDate: document.getElementById('f-contract-date'),
      fCodeDisplay: document.getElementById('f-code-display'),
      fContractDateGroup: document.getElementById('f-contract-date-group'),
      fDiscussStatusGroup: document.getElementById('f-discuss-status-group'),
      fDiscussStatus: document.getElementById('f-discuss-status'),
      fPnList: document.getElementById('f-pn-list'),
      fPnEmpty: document.getElementById('f-pn-empty'),
      pnAiHint: document.getElementById('pn-ai-hint'),
      fCollectList: document.getElementById('f-collect-list'),
      todosList: document.getElementById('todos-list'),
      fLogHistory: document.getElementById('f-log-history'),
      overlay: document.getElementById('overlay')
    };
    
    // 2. 批量更新表单字段
    if (elements.modalTitle) elements.modalTitle.textContent = p.name;
    if (elements.fName) elements.fName.value = p.name||'';
    if (elements.fChannel) elements.fChannel.value = p.channel||'';
    if (elements.fSource) elements.fSource.value = p.source||'';
    if (elements.fOwner) elements.fOwner.value = p.owner||'';
    if (elements.fProduct) elements.fProduct.value = p.product||'';
    if (elements.fDesc) elements.fDesc.value = p.desc||'';
    if (elements.fStage) elements.fStage.value = p.stage;
    if (elements.fActive) elements.fActive.value = p.active||'active';
    if (elements.fQuote) elements.fQuote.value = p.quote||'';
    if (elements.fContract) elements.fContract.value = p.contract||'';
    if (elements.fCost) elements.fCost.value = p.cost||'';
    if (elements.fCollected) elements.fCollected.value = p.collected||'';
    
    // 3. 调用onStageChange来更新UI元素的显示状态
    onStageChange();
    
    // 4. 同步基本信息Tab的镜像字段
    if (elements.fContractMirror) elements.fContractMirror.value = p.contract||'';
    if (elements.fCollectedMirror) elements.fCollectedMirror.value = p.collected||'';
    if (elements.fDeliveryNote) elements.fDeliveryNote.value = p.deliveryNote||'';
    
    // 5. 更新交付说明字段
    const briefElements = document.querySelectorAll('#f-delivery-brief');
    briefElements.forEach(el => {
      if (el) el.value = p.deliveryBrief||'';
    });
    
    if (elements.fTerminationReason) elements.fTerminationReason.value = p.terminationReason||'';
    if (elements.fUpdateLog) elements.fUpdateLog.value = '';
    
    // 6. 合同签署日期 & 项目编号
    if (elements.fContractDate) elements.fContractDate.value = p.contractDate || '';
    if (elements.fCodeDisplay) elements.fCodeDisplay.value = p.projectCode || '';
    
    // 7. 合同签署日期字段显隐
    if (elements.fContractDateGroup) {
      elements.fContractDateGroup.style.display = (p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) ? 'block' : 'none';
    }
    
    // 8. 洽谈状态字段显隐
    if (elements.fDiscussStatusGroup) {
      elements.fDiscussStatusGroup.style.display = (p.stage === STAGE.NEGOTIATING) ? 'block' : 'none';
    }
    if (elements.fDiscussStatus) {
      elements.fDiscussStatus.value = p.洽谈状态 || '需求沟通';
    }
    
    // 9. 回款节点
    if (elements.fPnList) {
      elements.fPnList.innerHTML = '';
      const nodes = p.paymentNodes || [];
      if (nodes.length > 0) {
        const pnFragment = document.createDocumentFragment();
        nodes.forEach((n, index) => {
          const row = document.createElement('div');
          row.className = 'pn-row' + (n.done ? ' done-row' : '');
          const idx = index + 1;
          const amtDisplay = n.amount || '';
          row.innerHTML = `
            <!-- 顶部工具栏：序号 / AI标签 / 删除 -->
            <div class="pn-toolbar">
              <span class="pn-idx">${idx}</span>
              ${!!n._fromAi ? `<span class="pn-ai-badge">AI</span>` : ''}
              <button type="button" class="pn-rm" onclick="removePaymentNode(this)" title="删除">×</button>
            </div>
            <!-- 交付任务目标区：标题描述 + 紧跟的完成勾选 -->
            <div class="pn-task-area">
              <div class="pn-task-label">📋 交付任务目标</div>
              <div class="pn-task-row" style="display:flex;align-items:center;gap:10px;">
                <input class="pn-condition" type="text" style="flex:1;" 
                  placeholder="描述需完成的交付任务，如：合同签订后收到保函及发票"
                  value="${(n.condition||'').replace(/"/g,'&quot;')}">
                <div class="pn-deliver-toggle" onclick="onPnDeliverToggle(this)" style="flex-shrink:0;">
                  <input type="checkbox" class="pn-deliver-chk" ${n.deliverDone?'checked':''}>
                  <div class="pn-status-btn ${n.deliverDone?'active-deliver':''}">
                    ${n.deliverDone?'✅ 交付完成':'○ 交付完成'}
                  </div>
                </div>
              </div>
            </div>
            <!-- 主体：左=回款目标  右=回款落实 -->
            <div class="pn-body">
              <div class="pn-col">
                <div class="pn-col-title">🎯 回款目标</div>
                <div class="pn-field">
                  <label>回款比例</label>
                  <input class="pn-ratio" type="text" placeholder="如 30%"
                    value="${n.ratio||''}" oninput="onPnRatioInput(this)">
                </div>
                <div class="pn-field">
                  <label>金额（万元）</label>
                  <input class="pn-amount" type="text" placeholder="0" 
                    value="${amtDisplay}" onchange="updatePaymentNode(${idx-1}, 'amount', this.value)">
                </div>
              </div>
              <div class="pn-col">
                <div class="pn-col-title">💰 回款落实</div>
                <div class="pn-field">
                  <label>实际到账（万元）</label>
                  <input class="pn-actual" type="text" placeholder="0" 
                      value="${n.actualAmount||''}" oninput="onPnActualInput(this)">
                </div>
                <div class="pn-done-toggle" onclick="onPnDoneToggle(this)">
                  <input type="checkbox" ${n.done?'checked':''}>
                  <div class="pn-status-btn ${n.done?'active-done':''}">
                    ${n.done?'✅ 回款已到账':'○ 回款已到账'}
                  </div>
                </div>
              </div>
            </div>`;
          row.dataset.contractAmountYuan = n.contractAmountYuan || '';
          pnFragment.appendChild(row);
          
          // 如果有比例但没有金额，根据合同金额自动计算
          const amtInput = row.querySelector('.pn-amount');
          if (!amtInput.value && n.ratio && elements.fContract) {
            const ratioInput = row.querySelector('.pn-ratio');
            const contract = parseFloat(elements.fContract.value) || 0;
            if (contract > 0) {
              const ratio = parsePnRatio(n.ratio);
              if (ratio) {
                const amount = (contract * ratio).toFixed(4).replace(/\.?0+$/, '');
                amtInput.value = amount;
              }
            }
          }
        });
        elements.fPnList.appendChild(pnFragment);
      }
      if (elements.fPnEmpty) {
        elements.fPnEmpty.style.display = nodes.length ? 'none' : 'block';
      }
      if (elements.pnAiHint) {
        elements.pnAiHint.textContent = nodes.some(n=>n._fromAi) ? '（含AI识别数据）' : '';
      }
    }
    
    // 10. 交付标签
    setDtags(p.deliveryTags || {});
    
    // 11. 催款任务
    if (elements.fCollectList) {
      elements.fCollectList.innerHTML = '';
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
        elements.fCollectList.appendChild(labelRow);
        
        const collectFragment = document.createDocumentFragment();
        collectTasks.forEach(t => {
          const row = document.createElement('div');
          row.className = 'collect-row';
          row.innerHTML = `
            <input type="checkbox" class="ct-done" ${t.done?'checked':''} onchange="onCollectDoneChange(this)">
            <input type="date" class="ct-date" value="${t.date||''}">
            <div style="display: flex; align-items: center; gap: 4px; width: 120px;">
              <input type="number" class="ct-amount" placeholder="金额" value="${t.amount||''}" step="0.01" min="0" style="width: 80px;">
              <span style="font-size: 0.72rem; color: #888;">万元</span>
            </div>
            <input type="text" class="ct-owner" placeholder="负责人" value="${t.owner||''}" style="width: 80px;">
            <input type="text" class="ct-note"  placeholder="备注（可选）" value="${esc(t.note||'')}" style="flex: 1;">
            <button type="button" class="btn-rm-row" onclick="this.parentElement.remove()">×</button>`;
          collectFragment.appendChild(row);
        });
        elements.fCollectList.appendChild(collectFragment);
      }
    }
    
    // 12. 更新回款百分比
    updatePaymentPct();
    
    // 13. 待办
    if (elements.todosList) {
      elements.todosList.innerHTML='';
      const todos = p.todos||[];
      if (todos.length > 0) {
        const todosFragment = document.createDocumentFragment();
        todos.forEach(t => {
          const row = document.createElement('div');
          row.className='todo-row';
          row.innerHTML = `
            <input type="checkbox" ${t.done?'checked':''}>
            <input type="text" placeholder="待办内容…" value="${esc(t.text)}">
            <button class="btn-remove-todo" onclick="this.parentElement.remove()">×</button>`;
          todosFragment.appendChild(row);
        });
        elements.todosList.appendChild(todosFragment);
      } else {
        addTodoRow();
      }
    }
    
    // 14. 渲染日志历史
    renderLogHistory(p.logs||[]);
    
    // 15. 切换到第一个标签页
    document.querySelectorAll('.m-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
    document.querySelectorAll('.m-tab-body').forEach((b,i)=>b.classList.toggle('active',i===0));
    
    // 16. 显示模态框
    if (elements.overlay) {
      elements.overlay.classList.add('show');
    }
    
    // 17. 设置当前编辑项目ID并更新本地文件目录显示
    currentEditProjectId = id;
    updateRootBar(currentEditProjectId);
  });
}

function closeModal() { 
  document.getElementById('overlay').classList.remove('show'); 
  editingId = null; 
  currentEditProjectId = null; 
}

async function saveProject() {
  // 显示加载状态
  const saveBtn = document.getElementById('btn-save');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.5';
    saveBtn.innerHTML = '<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div></div> 保存中…';
  }
  
  const name = document.getElementById('f-name').value.trim();
  if (!name) { 
    // 恢复按钮状态
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
      saveBtn.innerHTML = '保存';
    }
    alert('项目名称不能为空'); 
    return; 
  }
  const logText  = document.getElementById('f-update-log').value.trim();
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const stage    = parseInt(document.getElementById('f-stage').value);
  const contract = parseFloat(document.getElementById('f-contract').value)||0;
  const paymentNodes = getPaymentNodes();

  // 从回款节点自动汇总已回款金额
  const collectedFromNodes = calcCollectedFromNodes(paymentNodes, document.getElementById('f-contract').value);
  if (collectedFromNodes !== '') {
    document.getElementById('f-collected').value = collectedFromNodes;
    const rm = document.getElementById('f-collected-mirror');
    if (rm) rm.value = collectedFromNodes;
  }
  const collected = parseFloat(document.getElementById('f-collected').value)||0;
  const paymentPct = contract>0 ? Math.min(100,Math.round(collected/contract*100)) : 0;
  const deliveryTags = getDtags();
  
  // 处理催款任务逻辑
  const collectTasks = getCollectTasks();
  const owner = document.getElementById('f-owner')?.value || '';
  const todayStr = new Date().toISOString().slice(0,10);
  
  // 1. 检查是否有"交付任务已完成"但"回款未足额到账"的节点，生成催款任务
  paymentNodes.forEach(node => {
    if (node.deliverDone && !node.done) {
      // 交付任务已完成但回款未足额到账
      const targetAmount = parseFloat(node.amount) || 0;
      const actualAmount = parseFloat(node.actualAmount) || 0;
      if (targetAmount > 0 && actualAmount < targetAmount) {
        // 检查是否已存在相同条件的催款任务
        const existingTask = collectTasks.find(t => 
          t.note && t.note.includes(node.condition) && !t.done
        );
        if (!existingTask) {
          // 生成新的催款任务
          const amtWan = targetAmount ? targetAmount.toFixed(4).replace(/\.?0+$/, '') : '';
          collectTasks.push({
            date: todayStr,
            amount: amtWan,
            owner: owner,
            note: `待催：${node.condition}`,
            done: false
          });
        }
      }
    }
  });
  
  // 2. 检查已有催款任务对应的节点是否已足额到账，如果是，则自动勾选催款任务
  collectTasks.forEach(task => {
    if (!task.done && task.note) {
      // 查找对应的回款节点
      const matchingNode = paymentNodes.find(node => 
        task.note.includes(node.condition)
      );
      if (matchingNode && matchingNode.done) {
        task.done = true;
      }
    }
  });
  
  // 获取交付内容简要，优先使用交付情况页面的值
  let deliveryBrief = '';
  const briefElements = document.querySelectorAll('#f-delivery-brief');
  briefElements.forEach(el => {
    if (el && el.value.trim()) {
      deliveryBrief = el.value.trim();
    }
  });

  const data = {
    name, stage,
    channel:      document.getElementById('f-channel').value.trim(),
    source:       document.getElementById('f-source').value.trim(),
    owner:        document.getElementById('f-owner').value.trim(),
    product:      document.getElementById('f-product').value.trim(),
    desc:         document.getElementById('f-desc').value.trim(),
    active:       document.getElementById('f-active').value,
    quote:        document.getElementById('f-quote').value,
    contract:     document.getElementById('f-contract').value,
    cost:         document.getElementById('f-cost').value,
    collected:    document.getElementById('f-collected').value,
    deliveryNote: document.getElementById('f-delivery-note').value.trim(),
    deliveryBrief: deliveryBrief,
    terminationReason: document.getElementById('f-termination-reason')?.value.trim() || '',
    paymentPct, paymentNodes, deliveryTags,
    collectTasks: collectTasks,
    todos:        getTodos(),
   洽谈状态:     document.getElementById('f-discuss-status')?.value || '需求沟通',
    updatedAt:    ts};
  // 合同签署日期
  const contractDate = document.getElementById('f-contract-date')?.value || '';

  let autoLogs = [];
  
  if (editingId) {
    const idx = projects.findIndex(p=>p.id===editingId);
    const old = projects[idx];
    // 自动日志：合同签署日期首次填写或变更
    const newContractDate = document.getElementById('f-contract-date')?.value || '';
    if (newContractDate && !old.contractDate) {
      autoLogs.push(`📝 签订合同，签署日期 ${newContractDate}`);
    } else if (newContractDate && newContractDate !== old.contractDate) {
      autoLogs.push(`📝 合同签署日期更新为 ${newContractDate}`);
    }
    // 合并手动日志 + 交互触发的pending日志 + 自动日志
    const allLogTexts = [
      ..._pendingLogs,
      ...autoLogs,
      ...(logText ? [logText] : [])
    ].filter(Boolean);
    _pendingLogs = [];  // 清空
    const newEntries = allLogTexts.map(t => ({time:ts, text:t}));
    data.logs = [...(old.logs||[]), ...newEntries];
    const oldDirName = getProjectDirName(old);
    // 保留或更新编号
    let projectCode = old.projectCode || null;
    if (!projectCode) {
      projectCode = genProjectCode(stage, contractDate);
    } else {
      projectCode = updateCodePrefix(projectCode, stage, contractDate);
    }
    data.projectCode  = projectCode;
    data.contractDate = contractDate;
    projects[idx] = {...old, ...data};
    // 标记项目为已修改
    markProjectModified(editingId);
    // 目录重命名（编号或名称变了）
    const newDirName = getProjectDirName(projects[idx]);
    if (oldDirName !== newDirName) renameProjectDir(oldDirName, newDirName);
  } else {
    data.logs = logText ? [{time:ts,text:logText}] : [];
    data.projectCode  = genProjectCode(stage, contractDate);
    data.contractDate = contractDate;
    data.monthlyProgress = [];
    // 使用唯一代码作为项目 id
    data.id = data.projectCode.slice(-4);
    projects.push(data);
    // 标记新项目为已修改
    markProjectModified(data.id);

    // 新建项目时自动创建或关联文件夹
    if (window.fsRootHandle) {
      // 先尝试匹配已有文件夹
      const candidates = await matchExistingDirs(data.name, data.channel);
      if (candidates.length > 0) {
        // 有匹配的文件夹，询问用户
        const choice = confirm(`检测到可能匹配的文件夹「${candidates[0].dirName}」，是否关联？\n\n确定：关联现有文件夹\n取消：新建文件夹`);
        if (choice) {
          await linkProjectDir(data.id, candidates[0].dirHandle);
        } else {
          await createProjectDir(data);
        }
      } else {
        // 没有匹配的文件夹，直接创建
        await createProjectDir(data);
      }
    }
  }
  
  const isEditing = !!editingId;
  let hasChanges = !isEditing; // 新建项目默认为有变化
  
  if (isEditing && originalProjectData) {
    // 快速比较基本字段
    const name = document.getElementById('f-name').value.trim();
    const stage = parseInt(document.getElementById('f-stage').value);
    const channel = document.getElementById('f-channel').value.trim();
    const source = document.getElementById('f-source').value.trim();
    const owner = document.getElementById('f-owner').value.trim();
    const product = document.getElementById('f-product').value.trim();
    const desc = document.getElementById('f-desc').value.trim();
    const active = document.getElementById('f-active').value;
    const quote = document.getElementById('f-quote').value;
    const contract = document.getElementById('f-contract').value;
    const cost = document.getElementById('f-cost').value;
    const collected = document.getElementById('f-collected').value;
    const deliveryNote = document.getElementById('f-delivery-note').value.trim();
    const terminationReason = document.getElementById('f-termination-reason')?.value.trim() || '';
    const discussStatus = document.getElementById('f-discuss-status')?.value || '需求沟通';
    const contractDate = document.getElementById('f-contract-date')?.value || '';
    
    // 比较基本字段
    hasChanges = 
      name !== (originalProjectData.name || '') ||
      stage !== originalProjectData.stage ||
      channel !== (originalProjectData.channel || '') ||
      source !== (originalProjectData.source || '') ||
      owner !== (originalProjectData.owner || '') ||
      product !== (originalProjectData.product || '') ||
      desc !== (originalProjectData.desc || '') ||
      active !== (originalProjectData.active || 'active') ||
      quote !== (originalProjectData.quote || '') ||
      contract !== (originalProjectData.contract || '') ||
      cost !== (originalProjectData.cost || '') ||
      collected !== (originalProjectData.collected || '') ||
      deliveryNote !== (originalProjectData.deliveryNote || '') ||
      deliveryBrief !== (originalProjectData.deliveryBrief || '') ||
      terminationReason !== (originalProjectData.terminationReason || '') ||
      discussStatus !== (originalProjectData.洽谈状态 || '需求沟通') ||
      contractDate !== (originalProjectData.contractDate || '');
    
    // 比较回款节点
    if (!hasChanges) {
      const currentPaymentNodes = getPaymentNodes();
      const originalPaymentNodes = originalProjectData.paymentNodes || [];
      if (currentPaymentNodes.length !== originalPaymentNodes.length) {
        hasChanges = true;
      } else {
        for (let i = 0; i < currentPaymentNodes.length; i++) {
          const current = currentPaymentNodes[i];
          const original = originalPaymentNodes[i];
          if (current.condition !== original.condition ||
              current.ratio !== original.ratio ||
              current.amount !== original.amount ||
              current.actualAmount !== original.actualAmount ||
              current.deliverDone !== original.deliverDone ||
              current.done !== original.done) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    
    // 比较交付标签
    if (!hasChanges) {
      const currentDeliveryTags = getDtags();
      const originalDeliveryTags = originalProjectData.deliveryTags || {};
      const keys = [...new Set([...Object.keys(currentDeliveryTags), ...Object.keys(originalDeliveryTags)])];
      for (const key of keys) {
        if (currentDeliveryTags[key] !== originalDeliveryTags[key]) {
          hasChanges = true;
          break;
        }
      }
    }
    
    // 比较待办事项
    if (!hasChanges) {
      const currentTodos = getTodos();
      const originalTodos = originalProjectData.todos || [];
      if (currentTodos.length !== originalTodos.length) {
        hasChanges = true;
      } else {
        for (let i = 0; i < currentTodos.length; i++) {
          const current = currentTodos[i];
          const original = originalTodos[i];
          if (current.text !== original.text || current.done !== original.done) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    
    // 比较催款任务
    if (!hasChanges) {
      const currentCollectTasks = getCollectTasks();
      const originalCollectTasks = originalProjectData.collectTasks || [];
      if (currentCollectTasks.length !== originalCollectTasks.length) {
        hasChanges = true;
      } else {
        for (let i = 0; i < currentCollectTasks.length; i++) {
          const current = currentCollectTasks[i];
          const original = originalCollectTasks[i];
          if (current.date !== original.date ||
              current.amount !== original.amount ||
              current.owner !== original.owner ||
              current.note !== original.note ||
              current.done !== original.done) {
            hasChanges = true;
            break;
          }
        }
      }
    }
    
    // 检查是否有日志
    if (!hasChanges) {
      const logText = document.getElementById('f-update-log').value.trim();
      const hasAutoLogs = autoLogs.length > 0;
      const hasPendingLogs = _pendingLogs.length > 0;
      hasChanges = logText || hasAutoLogs || hasPendingLogs;
    }
  }
  
  closeModal();
  if (hasChanges) {
    save();
    refreshView();
    showToast(isEditing ? '项目已更新' : '新项目已创建');
  }
  // 清空原始项目数据
  originalProjectData = null;
  
  // 恢复按钮状态
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.innerHTML = '保存';
  }
}


// ══════════════════════════════════════════
export {
  // Modal 开关
  openModal,
  editProject,
  closeModal,
  saveProject,
  // Tab 切换
  switchModalTab,
  switchModalTabById,
  // 阶段 & 日期
  onStageChange,
  onContractDateChange,
  // 字段同步
  syncMirrorFields,
  syncDeliveryBrief,
  syncPnFromContract,
  updatePaymentPct,
  // 回款节点
  addPaymentNode,
  removePaymentNode,
  getPaymentNodes,
  calcCollectedFromNodes,
  parseContractAmt,
  syncCollectedFromNodes,
  onPnActualInput,
  onPnAmountInput,
  parsePnRatio,
  calcPnAmountFromRatio,
  onPnRatioInput,
  onPnDeliverToggle,
  onPnDoneToggle,
  // 催款任务
  addCollectRow,
  getCollectTasks,
  onCollectDoneChange,
  // 交付标签
  toggleDtag,
  toggleDtag2,
  setDtags,
  getDtags,
  // 待办
  addTodoRow,
  setupTodoEventDelegation,
  getTodos,
  // 日志
  renderLogHistory,
  clearProjectLogs,
  _appendPendingLog
};
