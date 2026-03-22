// ╔══════════════════════════════════════════╗
// ║  MODULE: render-board（看板视图层）       ║
// ╚══════════════════════════════════════════╝

// 卡片 HTML 缓存（key = projectId_colKey_updatedAt）
const renderCache = new Map();

// ── render() ──────────────────────────────────────
// 同步渲染四列看板，用 DocumentFragment 减少回流。
// 不使用 setTimeout / requestAnimationFrame 分批，
// 对几十个项目的规模一次性渲染反而更快。
function render() {
  // 筛选按钮高亮
  const buttons = document.querySelectorAll('.sb-stats-title button');
  buttons.forEach(btn => {
    const isActive = btn.onclick.toString().includes(statsFilter);
    btn.style.background = isActive ? 'var(--gold)' : 'none';
    btn.style.color      = isActive ? 'var(--ink)'  : 'rgba(255,255,255,.72)';
  });

  // 按列分组
  const cols = { '0':[], '1':[], '2':[], '3':[] };
  projects.forEach(p => cols[getBoardColumn(p)].push(p));

  // 渲染每列
  ['0','1','2','3'].forEach(key => {
    const body  = document.getElementById('col'   + key);
    const badge = document.getElementById('badge' + key);
    const pipe  = document.getElementById('pipe'  + key);

    if (badge) badge.textContent = cols[key].length;
    if (pipe)  pipe.textContent  = cols[key].length;

    if (!body) return;

    // 排序：活跃度 > 最新更新时间 > 项目名称
    const sortedProjects = cols[key].sort((a, b) => {
      // 1. 活跃度排序：活跃的排在前面
      if (a.active !== b.active) {
        return a.active === 'active' ? -1 : 1;
      }
      
      // 2. 最新更新时间排序：更新时间晚的排在前面
      if (a.updatedAt && b.updatedAt) {
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      } else if (a.updatedAt) {
        return -1;
      } else if (b.updatedAt) {
        return 1;
      }
      
      // 3. 项目名称排序：按字母顺序
      return a.name.localeCompare(b.name);
    });

    // DocumentFragment 批量写入，只触发一次回流
    const fragment = document.createDocumentFragment();
    const wrapper  = document.createElement('div');
    wrapper.innerHTML = sortedProjects.length
      ? sortedProjects.map(p => cardHTML(p, key)).join('')
      : '<div class="empty-state">暂无项目</div>';
    while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
    body.innerHTML = '';
    body.appendChild(fragment);
  });

  updateStats();
}

// ── updateStats() ─────────────────────────────────
function updateStats() {
  const statTotal    = document.getElementById('stat-total');
  const statQuote    = document.getElementById('stat-quote');
  const statContract = document.getElementById('stat-contract');
  const statTodo     = document.getElementById('stat-todo');
  if (!statTotal || !statQuote || !statContract || !statTodo) return;

  const thisYear = new Date().getFullYear();

  const filteredProjects = statsFilter === 'thisYear'
    ? projects.filter(p => {
        if (!p.contractDate) return false;
        return new Date(p.contractDate).getFullYear() === thisYear;
      })
    : projects.filter(p => {
        if (p.stage === STAGE.NEGOTIATING) return true;
        if (p.contractDate) return new Date(p.contractDate).getFullYear() === thisYear;
        return false;
      });

  const totalCount  = projects.length;
  const quoteSum    = projects.filter(p => p.stage === STAGE.NEGOTIATING)
                              .reduce((a, p) => a + (parseFloat(p.quote) || 0), 0);
  const contractSum = filteredProjects.reduce((a, p) => a + (parseFloat(p.contract) || 0), 0);
  const todoCount   = filteredProjects.reduce((a, p) => a + (p.todos || []).filter(t => !t.done).length, 0);

  statTotal.textContent    = totalCount;
  statQuote.textContent    = quoteSum.toFixed(2);
  statContract.textContent = contractSum.toFixed(2);
  statTodo.textContent     = todoCount;
}

// ── cardHTML() ────────────────────────────────────
function cardHTML(p, colKey) {
  // 缓存：同一项目、同一列、同一 updatedAt → 直接返回
  const cacheKey = `${p.id}_${colKey}_${p.updatedAt || ''}`;
  if (renderCache.has(cacheKey)) return renderCache.get(cacheKey);

  const sAttr = colKey === 'c' ? 'c' : STAGE_S_ATTR[p.stage];

  const metaHtml = (p.channel || p.source || p.owner || p.product || (p.stage === STAGE.NEGOTIATING && p.洽谈状态)) ? `
    <div class="card-meta">
      ${p.channel ? `<span class="card-tag">🌐 ${esc(p.channel)}</span>` : ''}
      ${p.source  ? `<span class="card-tag">📌 ${esc(p.source)}</span>`  : ''}
      ${p.owner   ? `<span class="card-tag">👤 ${esc(p.owner)}</span>`   : ''}
      ${p.product ? `<span class="card-tag">📦 ${esc(p.product)}</span>` : ''}
      ${p.stage === STAGE.NEGOTIATING && p.洽谈状态 ? `<span class="card-tag">💬 ${esc(p.洽谈状态)}</span>` : ''}
    </div>` : '';

  const amtHtml = (p.quote || p.contract || p.cost) && p.stage === STAGE.NEGOTIATING ? `
    <div class="card-amounts">
      ${p.quote    ? `<div class="amount-item"><div class="alabel">报价</div><div class="aval">¥${fmtWanShort(p.quote)}万</div></div>`             : ''}
      ${p.contract ? `<div class="amount-item"><div class="alabel">合同</div><div class="aval contract">¥${fmtWanShort(p.contract)}万</div></div>` : ''}
      ${p.cost     ? `<div class="amount-item"><div class="alabel">成本</div><div class="aval cost">¥${fmtWanShort(p.cost)}万</div></div>`         : ''}
    </div>` : '';

  // 交付中/已完结：合同签单信息（签单日期 + 合同金额）
  let contractInfoHtml = '';
  if ((p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) && p.contract) {
    const contractDateStr = p.contractDate 
      ? new Date(p.contractDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) 
      : '未填写';
    const isDelivering = p.stage === STAGE.DELIVERING;
    const collected = p.collected || (p.paymentNodes || []).reduce((sum, n) => sum + (parseFloat(n.actualAmount) || 0), 0);
    const pct = p.paymentPct || Math.round((collected / p.contract) * 100) || 0;
    
    contractInfoHtml = `
      <div class="card-amounts mt-sm">
        <div class="amount-item"><div class="alabel">📅 签单</div><div class="aval">${contractDateStr}</div></div>
        <div class="amount-item"><div class="alabel">合同额</div><div class="aval contract">¥${fmtWanShort(p.contract)}万</div></div>
        ${isDelivering ? `<div class="amount-item"><div class="alabel">已回款</div><div class="aval" style="color:var(--sc)">¥${fmtWanShort(collected)}万</div></div>` : ''}
        ${isDelivering ? `<div class="amount-item"><div class="alabel">回款率</div><div class="aval" style="color:${pct >= 100 ? 'var(--sc)' : '#e65100'}">${pct}%</div></div>` : ''}
      </div>`;
  }

  // 交付标签（交付中/已完结显示）
  const tags = p.deliveryTags || {};
  const tagItems = [
    tags.wireless_hardware && `<span class="delivery-chip wireless">📡 无线</span>`,
    tags.wired_hardware    && `<span class="delivery-chip wired">🔌 有线</span>`,
    tags.software          && `<span class="delivery-chip software">💻 软件</span>`,
    tags.other             && `<span class="delivery-chip other">📎 其他</span>`,
  ].filter(Boolean);
  const hasDelivery = tagItems.length || p.deliveryBrief || p.deliveryNote;
  const deliveryHtml = (p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) ? `
    <div class="delivery-preview">
      <div class="delivery-preview-header ${!hasDelivery ? 'no-margin' : ''}">
        <span class="delivery-preview-title">📦 交付内容</span>
      </div>
      ${tagItems.length ? `<div class="delivery-tags">${tagItems.join('')}</div>` : ''}
      ${!hasDelivery ? `<div class="delivery-empty">暂无交付信息，可通过文件面板识别技术协议自动提取</div>` : ''}
    </div>` : '';

  // 回款进度条 + 付款节点详情（仅交付中/已完结显示）
  let paymentHtml = '';
  const nodes = p.paymentNodes || [];
  if ((p.stage === STAGE.DELIVERING || p.stage === STAGE.COMPLETED) && p.contract && nodes.length > 0) {
    const pct = p.paymentPct || 0;
    const doneCount = nodes.filter(n => n.done).length;
    const nodePreview = nodes.slice(0, 3).map(n => `
      <div class="payment-node-row">
        <span class="node-status-dot ${n.done ? 'done' : ''}" style="border-color:${n.done ? 'var(--sc)' : '#ddd'};background:${n.done ? 'var(--sc)' : 'transparent'}">
          ${n.done ? '<span class="check-mark">✓</span>' : ''}
        </span>
        <span class="node-condition">${esc(n.condition || '付款节点')}</span>
        ${n.ratio ? `<span class="node-ratio">${n.ratio}</span>` : ''}
        ${n.contractAmountYuan
          ? `<span class="node-amount">${fmtYuan(n.contractAmountYuan)} 元</span>`
          : n.amount ? `<span class="node-amount">${n.amount}</span>` : ''}
      </div>`).join('');
    paymentHtml = `
    <div class="card-payment">
      <div class="card-payment-label">
        <span>💰 回款进度 · ${doneCount}/${nodes.length}节点</span>
        <span>${pct}%</span>
      </div>
      <div class="pbar-wrap"><div class="pbar-fill" style="width:${pct}%"></div></div>
      <div class="mt-sm">${nodePreview}${nodes.length > 3 ? `<div class="more-hint">…还有${nodes.length - 3}个节点</div>` : ''}</div>
    </div>`;
  }

  // 催款任务预览
  let collectHtml = '';
  const tasks = p.collectTasks || [];
  if (colKey === 'c' && tasks.length && p.stage === STAGE.NEGOTIATING) {
    const shown = tasks.filter(t => !t.done).slice(0, 3);
    collectHtml = `<div class="card-collect-preview">` +
      shown.map(t => `
      <div class="collect-mini">
        <div class="collect-mini-chk ${t.done ? 'done' : ''}"></div>
        <span style="color:var(--sc);font-weight:600">${t.date || '—'}</span>
        ${t.amount ? `<span>催 ${t.amount}万</span>` : ''}
        ${t.note   ? `<span class="text-muted">·${esc(t.note)}</span>` : ''}
      </div>`).join('') +
      (tasks.filter(t => !t.done).length > 3 ? `<div class="more-hint left">…还有更多</div>` : '') +
      `</div>`;
  }

  const descHtml    = p.desc      ? `<div class="card-desc">${esc(p.desc)}</div>`         : '';
  const updatedHtml = p.updatedAt ? `<div class="card-updated">🕐 ${p.updatedAt}</div>`   : '';
  const logHtml     = '';

  const todosShown = (p.todos || []).slice(0, 3);
  const todoHtml   = todosShown.length ? `
    <div class="todos-preview">
      ${todosShown.map(t => `
        <div class="todo-item-mini ${t.done ? 'done' : ''}">
          <div class="chk-mini ${t.done ? 'checked' : ''}"></div>
          <span>${esc(t.text)}</span>
        </div>`).join('')}
      ${(p.todos || []).length > 3 ? `<div class="more-hint left">…还有${p.todos.length - 3}项</div>` : ''}
    </div>` : '';

  let actionBtns = '';
  if (p.stage === STAGE.NEGOTIATING) actionBtns += `<button class="btn-sm btn-next" onclick="moveStage('${p.id}',${STAGE.DELIVERING})">→ 已签单执行中</button>`;
  if (p.stage === STAGE.DELIVERING)  actionBtns += `<button class="btn-sm btn-done" onclick="moveStage('${p.id}',${STAGE.COMPLETED})">→ 已完结</button>`;
  actionBtns += `<button class="btn-sm btn-del" onclick="deleteProject('${p.id}')">✕</button>`;

  // 提取项目来源标签（优先使用channel，其次使用source）
  const sourceValue = p.channel || p.source;
  const sourceTag = sourceValue ? `<span class="card-tag source-tag">🌐 ${esc(sourceValue)}</span>` : '';
  
  // 保留客户名称（source）的显示
  const filteredMetaHtml = (p.source || p.owner || p.product || (p.stage === STAGE.NEGOTIATING && p.洽谈状态)) ? `
    <div class="card-meta">
      ${p.source  ? `<span class="card-tag">📌 ${esc(p.source)}</span>`  : ''}
      ${p.owner   ? `<span class="card-tag">👤 ${esc(p.owner)}</span>`   : ''}
      ${p.product ? `<span class="card-tag">📦 ${esc(p.product)}</span>` : ''}
      ${p.stage === STAGE.NEGOTIATING && p.洽谈状态 ? `<span class="card-tag">💬 ${esc(p.洽谈状态)}</span>` : ''}
    </div>` : '';

  const html = `
  <div class="card" data-s="${sAttr}">
    <div class="card-top">
      <div class="card-header">
        <div class="card-header-left">
          <div class="card-header-row">
            ${sourceTag}
            <div class="card-name" onclick="editProject('${p.id}')">${esc(p.name)}</div>
          </div>
          ${updatedHtml}
        </div>
      </div>
      <span class="card-active ${p.active === 'inactive' ? 'off' : 'on'}">${p.active === 'inactive' ? '🔴 不活跃' : '🟢 活跃'}</span>
    </div>
    ${logHtml}${filteredMetaHtml}${amtHtml}${contractInfoHtml}${deliveryHtml}${paymentHtml}${descHtml}${todoHtml}
    <div class="card-actions">${actionBtns}</div>
  </div>`;

  renderCache.set(cacheKey, html);
  return html;
}

// ── 侧边栏 ────────────────────────────────────────
function toggleSidebar() {
  const sb  = document.getElementById('sidebar');
  const btn = sb.querySelector('.sb-toggle');
  sb.classList.toggle('collapsed');
  const collapsed = sb.classList.contains('collapsed');
  btn.textContent = collapsed ? '▶' : '◀';
  try { localStorage.setItem(STORAGE_KEY.SB_COLLAPSED, collapsed ? '1' : '0'); } catch(e) {}
}

function initSidebar() {
  try {
    if (localStorage.getItem(STORAGE_KEY.SB_COLLAPSED) === '1') {
      const sb  = document.getElementById('sidebar');
      const btn = sb?.querySelector('.sb-toggle');
      if (sb)  sb.classList.add('collapsed');
      if (btn) btn.textContent = '▶';
    }
  } catch(e) {}
}

// ── 缓存管理 ──────────────────────────────────────
function clearRenderCache() {
  renderCache.clear();
}

// ── refreshView() ─────────────────────────────────
// 清缓存 → 重渲染看板 → 按需刷新侧边面板。
// 调用方不需要关心面板是否打开，统一走这里。
function refreshView() {
  clearRenderCache();
  render();
  if (document.getElementById('todosPanel').classList.contains('open'))  renderTodosPanel();
  if (document.getElementById('ledgerPanel').classList.contains('open')) renderLedger();
}

// 设置统计筛选器
function setStatsFilter(filter) {
  statsFilter = filter;
  render();
  const buttons = document.querySelectorAll('.sb-stats-title button');
  buttons.forEach(btn => {
    const isActive = btn.onclick.toString().includes(filter);
    btn.style.background = isActive ? 'var(--gold)' : 'none';
    btn.style.color      = isActive ? 'var(--ink)'  : 'rgba(255,255,255,.72)';
  });
}

// ── 导出 ──────────────────────────────────────────
export {
  render,
  updateStats,
  cardHTML,
  toggleSidebar,
  initSidebar,
  clearRenderCache,
  refreshView,
  setStatsFilter
};
