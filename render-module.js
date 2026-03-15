// 渲染相关功能模块

// 虚拟滚动配置
const VIRTUAL_SCROLL_CONFIG = {
  cardHeight: 200, // 卡片高度（px）
  bufferSize: 2,   // 缓冲区大小（卡片数量）
};

// 渲染缓存
const renderCache = new Map();

// 节流函数
function throttle(fn, delay) {
  let lastCall = 0;
  return function(...args) {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      return fn.apply(this, args);
    }
  };
}

// 防抖函数
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 初始化虚拟滚动
function initVirtualScroll() {
  ['0','1','2','3'].forEach(key => {
    const col = document.getElementById('col'+key);
    if (col) {
      col.style.overflowY = 'auto';
      col.style.position = 'relative';
      col.addEventListener('scroll', () => {
        const cols = { '0':[], '1':[], 'c':[], '2':[], '3':[] };
        projects.forEach(p => cols[getBoardColumn(p)].push(p));
        renderVirtualColumn(key, cols[key]);
      });
    }
  });
}

// 渲染虚拟列
function renderVirtualColumn(key, items) {
  const col = document.getElementById('col'+key);
  if (!col) return;
  
  // 计算可见区域
  const rect = col.getBoundingClientRect();
  const scrollTop = col.scrollTop;
  const visibleStart = Math.max(0, Math.floor(scrollTop / VIRTUAL_SCROLL_CONFIG.cardHeight) - VIRTUAL_SCROLL_CONFIG.bufferSize);
  const visibleEnd = Math.min(items.length, Math.ceil((scrollTop + rect.height) / VIRTUAL_SCROLL_CONFIG.cardHeight) + VIRTUAL_SCROLL_CONFIG.bufferSize);
  
  // 计算可见项目
  const visibleItems = items.slice(visibleStart, visibleEnd);
  
  // 设置容器高度
  col.style.height = '100%';
  
  // 创建虚拟滚动容器
  let virtualContainer = col.querySelector('.virtual-scroll-container');
  if (!virtualContainer) {
    virtualContainer = document.createElement('div');
    virtualContainer.className = 'virtual-scroll-container';
    virtualContainer.style.position = 'relative';
    col.innerHTML = '';
    col.appendChild(virtualContainer);
  }
  
  // 设置滚动容器高度
  virtualContainer.style.height = `${items.length * VIRTUAL_SCROLL_CONFIG.cardHeight}px`;
  
  // 清除现有内容
  const contentContainer = virtualContainer.querySelector('.virtual-scroll-content');
  if (contentContainer) {
    contentContainer.remove();
  }
  
  // 创建内容容器
  const newContentContainer = document.createElement('div');
  newContentContainer.className = 'virtual-scroll-content';
  newContentContainer.style.position = 'absolute';
  newContentContainer.style.top = `${visibleStart * VIRTUAL_SCROLL_CONFIG.cardHeight}px`;
  newContentContainer.style.width = '100%';
  
  // 使用DocumentFragment批量处理DOM操作
  const fragment = document.createDocumentFragment();
  
  if (visibleItems.length > 0) {
    // 预生成可见卡片HTML
    const cardsHtml = visibleItems.map(p => cardHTML(p, key)).join('');
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = cardsHtml;
    
    // 将所有卡片添加到fragment
    while (tempContainer.firstChild) {
      fragment.appendChild(tempContainer.firstChild);
    }
  }
  
  // 一次性更新DOM
  newContentContainer.appendChild(fragment);
  virtualContainer.appendChild(newContentContainer);
}

// 节流处理的渲染函数
const throttledRender = throttle(function() {
  // 初始化筛选按钮样式
  const buttons = document.querySelectorAll('.sb-stats-title button');
  buttons.forEach(btn => {
    if (btn.onclick.toString().includes(statsFilter)) {
      btn.style.background = 'var(--gold)';
      btn.style.color = 'var(--ink)';
    } else {
      btn.style.background = 'none';
      btn.style.color = 'rgba(255,255,255,.72)';
    }
  });
  
  const cols = { '0':[], '1':[], 'c':[], '2':[], '3':[] };
  projects.forEach(p => cols[getBoardColumn(p)].push(p));

  // 缓存DOM元素
  const badgeElements = {};
  const pipeElements = {};
  const colElements = {};
  ['0','1','2','3'].forEach(key => {
    badgeElements[key] = document.getElementById('badge'+key);
    pipeElements[key] = document.getElementById('pipe'+key);
    colElements[key] = document.getElementById('col'+key);
  });

  // 使用requestAnimationFrame优化渲染
  requestAnimationFrame(() => {
    // 更新数量
    ['0','1','2','3'].forEach(key => {
      const count = cols[key].length;
      if (badgeElements[key]) {
        badgeElements[key].textContent = count;
      }
      if (pipeElements[key]) {
        pipeElements[key].textContent = count;
      }
    });
    
    // 初始化虚拟滚动（如果尚未初始化）
    if (!window.virtualScrollInitialized) {
      initVirtualScroll();
      window.virtualScrollInitialized = true;
    }
    
    // 渲染虚拟列（使用requestAnimationFrame分批渲染）
    const keys = ['0','1','2','3'];
    let index = 0;
    
    function renderNextColumn() {
      if (index < keys.length) {
        const key = keys[index];
        if (colElements[key]) {
          renderVirtualColumn(key, cols[key]);
        }
        index++;
        requestAnimationFrame(renderNextColumn);
      }
    }
    
    renderNextColumn();
    
    // 更新统计信息
    requestAnimationFrame(() => {
      updateStats();
    });
  });
}, 100); // 100ms 节流

// 渲染看板
function render() {
  throttledRender();
}

// 更新统计信息
function updateStats() {
  const thisYear = new Date().getFullYear();
  
  // 缓存DOM元素
  const statTotal = document.getElementById('stat-total');
  const statQuote = document.getElementById('stat-quote');
  const statContract = document.getElementById('stat-contract');
  const statTodo = document.getElementById('stat-todo');
  
  if (!statTotal || !statQuote || !statContract || !statTodo) return;
  
  // 根据筛选条件过滤项目
  const filteredProjects = statsFilter === 'thisYear' ? 
    projects.filter(p => {
      if (!p.contractDate) return false;
      const y = new Date(p.contractDate).getFullYear();
      return y === thisYear;
    }) : 
    // 全部项目：包含洽谈中的项目和本年签单的项目
    projects.filter(p => {
      // 洽谈中的项目
      if (p.stage === STAGE.NEGOTIATING) return true;
      // 本年签单的项目
      if (p.contractDate) {
        const y = new Date(p.contractDate).getFullYear();
        return y === thisYear;
      }
      return false;
    });

  // 全部项目数量：始终显示所有项目的数量
  const totalCount = projects.length;
  // 报价总额：只包含所有洽谈中的项目，不受时间影响
  const quoteSum = projects.filter(p => p.stage === STAGE.NEGOTIATING).reduce((a,p)=>a+(parseFloat(p.quote)||0),0);
  const contractSum = filteredProjects.reduce((a,p)=>a+(parseFloat(p.contract)||0),0);
  const todoCount = filteredProjects.reduce((a,p)=>a+(p.todos||[]).filter(t=>!t.done).length,0);
  
  // 更新统计数字
  statTotal.textContent = totalCount;
  statQuote.textContent = quoteSum.toFixed(2);
  statContract.textContent = contractSum.toFixed(2);
  statTodo.textContent = todoCount;
}

// 生成卡片HTML
function cardHTML(p, colKey) {
  // 生成缓存键
  const cacheKey = `${p.id}_${colKey}_${p.updatedAt || ''}`;
  
  // 检查缓存
  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey);
  }
  
  const sAttr = colKey === 'c' ? 'c' : STAGE_S_ATTR[p.stage];

  const metaHtml = (p.channel||p.source||p.owner||p.product||(p.stage===STAGE.NEGOTIATING&&p.洽谈状态)) ? `
    <div class="card-meta">
      ${p.channel ? `<span class="card-tag">🌐 ${esc(p.channel)}</span>` : ''}
      ${p.source  ? `<span class="card-tag">📌 ${esc(p.source)}</span>` : ''}
      ${p.owner   ? `<span class="card-tag">👤 ${esc(p.owner)}</span>`   : ''}
      ${p.product ? `<span class="card-tag">📦 ${esc(p.product)}</span>` : ''}
      ${p.stage===STAGE.NEGOTIATING&&p.洽谈状态 ? `<span class="card-tag">💬 ${esc(p.洽谈状态)}</span>` : ''}
    </div>` : '';

  const amtHtml = (p.quote||p.contract||p.cost) && p.stage === STAGE.NEGOTIATING ? `
    <div class="card-amounts">
      ${p.quote    ? `<div class="amount-item"><div class="alabel">报价</div><div class="aval">¥${fmtWanShort(p.quote)}万</div></div>` : ''}
      ${p.contract ? `<div class="amount-item"><div class="alabel">合同</div><div class="aval contract">¥${fmtWanShort(p.contract)}万</div></div>` : ''}
      ${p.cost     ? `<div class="amount-item"><div class="alabel">成本</div><div class="aval cost">¥${fmtWanShort(p.cost)}万</div></div>` : ''}
    </div>` : '';

  // 交付标签（阶段1/2显示）
  const tags = p.deliveryTags || {};
  const tagItems = [
    tags.wireless_hardware && `<span style="font-size:.62rem;padding:2px 8px;border-radius:10px;background:rgba(21,101,192,.1);color:#1565c0;font-weight:600">📡 无线</span>`,
    tags.wired_hardware    && `<span style="font-size:.62rem;padding:2px 8px;border-radius:10px;background:rgba(46,125,50,.1);color:#2e7d32;font-weight:600">🔌 有线</span>`,
    tags.software          && `<span style="font-size:.62rem;padding:2px 8px;border-radius:10px;background:rgba(106,27,154,.1);color:#6a1b9a;font-weight:600">💻 软件</span>`,
    tags.other             && `<span style="font-size:.62rem;padding:2px 8px;border-radius:10px;background:rgba(230,81,0,.1);color:#e65100;font-weight:600">📎 其他</span>`,
  ].filter(Boolean);
  const hasDelivery = tagItems.length || p.deliveryBrief || p.deliveryNote;
  const deliveryHtml = (p.stage===STAGE.DELIVERING||p.stage===STAGE.COMPLETED) ? `
    <div style="margin:5px 0;padding:7px 10px;background:rgba(21,101,192,.04);border-radius:6px;border-left:2px solid var(--s1)">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:${hasDelivery?'5px':'0'}">
        <span style="font-size:.6rem;color:var(--s1);font-weight:600">📦 交付内容</span>
      </div>
      ${tagItems.length ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${tagItems.join('')}</div>` : ''}
      ${!hasDelivery ? `<div style="font-size:.65rem;color:#bbb">暂无交付信息，可通过文件面板识别技术协议自动提取</div>` : ''}
    </div>` : '';

  // 回款进度 + 节点摘要（阶段1/2显示）
  let paymentHtml = '';
  if ((p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) && p.contract) {
    const pct = p.paymentPct || 0;
    const nodes = p.paymentNodes || [];
    const doneCount = nodes.filter(n=>n.done).length;
    const nodePreview = nodes.slice(0,3).map(n => `
      <div style="display:flex;align-items:flex-start;gap:5px;padding:3px 0;border-bottom:1px solid var(--paper2);flex-wrap:wrap">
        <span style="width:12px;height:12px;border-radius:50%;border:1.5px solid ${n.done?'var(--sc)':'#ddd'};background:${n.done?'var(--sc)':'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;margin-top:2px">
          ${n.done ? '<span style="color:#fff;font-size:8px">✓</span>' : ''}
        </span>
        <span style="font-size:.65rem;color:#666;flex:1;min-width:0;word-wrap:break-word">${esc(n.condition||'付款节点')}</span>
        ${n.ratio ? `<span style="font-size:.63rem;color:var(--sc);font-weight:700;flex-shrink:0;margin-top:2px">${n.ratio}</span>` : ''}
        ${n.contractAmountYuan ? `<span style="font-size:.62rem;color:#888;flex-shrink:0;margin-top:2px">${fmtYuan(n.contractAmountYuan)} 元</span>` : n.amount ? `<span style="font-size:.62rem;color:#888;flex-shrink:0;margin-top:2px">${n.amount}</span>` : ''}
      </div>`).join('');
    paymentHtml = `
    <div class="card-payment">
      <div class="card-payment-label">
        <span>💰 回款进度</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span>${pct}%${nodes.length ? ` · ${doneCount}/${nodes.length}节点` : ''}</span>

        </span>
      </div>
      <div class="pbar-wrap"><div class="pbar-fill" style="width:${pct}%"></div></div>
      ${nodes.length ? `<div style="margin-top:5px">${nodePreview}${nodes.length>3?`<div style="font-size:.6rem;color:#bbb;text-align:center;padding-top:3px">…还有${nodes.length-3}个节点</div>`:''}</div>` : ''}
    </div>`;
  }

  // 催款任务预览（colKey=c 且阶段为0时显示未完成的，最多3条）
  let collectHtml = '';
  const tasks = (p.collectTasks||[]);
  if (colKey === 'c' && tasks.length && p.stage === STAGE.NEGOTIATING) {
    const shown = tasks.filter(t=>!t.done).slice(0,3);
    collectHtml = `<div class="card-collect-preview">` +
      shown.map(t => `
      <div class="collect-mini">
        <div class="collect-mini-chk ${t.done?'done':''}"></div>
        <span style="color:var(--sc);font-weight:600">${t.date||'—'}</span>
        ${t.amount ? `<span>催 ${t.amount}万</span>` : ''}
        ${t.note ? `<span style="color:#aaa">·${t.note}</span>` : ''}
      </div>`).join('') +
      (tasks.filter(t=>!t.done).length > 3 ? `<div style="font-size:.6rem;color:#bbb">…还有更多</div>` : '') +
      `</div>`;
  }

  const descHtml = p.desc ? `<div class="card-desc">${esc(p.desc)}</div>` : '';
  const updatedHtml = p.updatedAt ? `<div class="card-updated">🕐 ${p.updatedAt}</div>` : '';
  // 不显示更新日志
  const logHtml = '';

  const todosShown = (p.todos||[]).slice(0,3);
  const todoHtml = todosShown.length ? `
    <div class="todos-preview">
      ${todosShown.map(t=>`
        <div class="todo-item-mini ${t.done?'done':''}">
          <div class="chk-mini ${t.done?'checked':''}"></div>
          <span>${esc(t.text)}</span>
        </div>`).join('')}
      ${(p.todos||[]).length>3?`<div style="font-size:.6rem;color:#bbb">…还有${p.todos.length-3}项</div>`:''}
    </div>` : '';

  // 操作按钮
  let actionBtns = '';
  if (p.stage === STAGE.NEGOTIATING) actionBtns += `<button class="btn-sm btn-next" onclick="moveStage('${p.id}',${STAGE.DELIVERING})">→ 已签单执行中</button>`;
  if (p.stage === STAGE.DELIVERING) actionBtns += `<button class="btn-sm btn-done" onclick="moveStage('${p.id}',${STAGE.COMPLETED})">→ 已完结</button>`;

  actionBtns += `<button class="btn-sm btn-del" onclick="deleteProject('${p.id}')">✕</button>`;

  const html = `
  <div class="card" data-s="${sAttr}">
    <div class="card-top">
      <div class="card-name" onclick="editProject('${p.id}')">${esc(p.name)}</div>
      <span class="card-active ${p.active==='inactive'?'off':'on'}">${p.active==='inactive'?'🔴 不活跃':'🟢 活跃'}</span>
    </div>
    ${updatedHtml}${logHtml}${metaHtml}${amtHtml}${deliveryHtml}${paymentHtml}${descHtml}${todoHtml}
    <div class="card-actions">${actionBtns}</div>
  </div>`;
  
  // 缓存结果
  renderCache.set(cacheKey, html);
  
  return html;
}

// 侧边栏收起/展开
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const btn = sb.querySelector('.sb-toggle');
  sb.classList.toggle('collapsed');
  const collapsed = sb.classList.contains('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
  // 收起时保存状态
  try { localStorage.setItem(STORAGE_KEY.SB_COLLAPSED, collapsed ? '1' : '0'); } catch(e){}
}

// 初始化侧边栏状态
function initSidebar() {
  try {
    if (localStorage.getItem(STORAGE_KEY.SB_COLLAPSED) === '1') {
      const sb = document.getElementById('sidebar');
      if (sb) {
        sb.classList.add('collapsed');
        const btn = sb.querySelector('.sb-toggle');
        if (btn) btn.textContent = '▶';
      }
    }
  } catch(e){}
}

// 清理渲染缓存
function clearRenderCache() {
  renderCache.clear();
}

// 统一的视图刷新函数
const debouncedRefreshView = debounce(function() {
  // 清理缓存
  clearRenderCache();
  // 渲染看板
  render();
  // 渲染其他面板
  if (document.getElementById('todosPanel').classList.contains('open')) {
    requestAnimationFrame(() => {
      renderTodosPanel();
    });
  }
  if (document.getElementById('ledgerPanel').classList.contains('open')) {
    requestAnimationFrame(() => {
      renderLedger();
    });
  }
}, 100); // 100ms 防抖

// 统一的视图刷新函数
function refreshView() {
  debouncedRefreshView();
}

// 导出模块
export {
  render,
  updateStats,
  toggleSidebar,
  initSidebar,
  refreshView,
  clearRenderCache
};