// ╔══════════════════════════════════════════╗
// ║  MODULE: ledger（台账）                  ║
// ╚══════════════════════════════════════════╝

// 台账筛选状态
let ledgerFilter = { type:'all', aiMatchIds:null };

// AI 搜索并发保护 & 防抖 & 缓存
let ledgerAiPending = false;
let ledgerAiDebounceTimer = null;
const ledgerAiCache = new Map();
const LEDGER_AI_DEBOUNCE_DELAY = 500;

function openLedger() {
  ledgerFilter = { type:'all', aiMatchIds:null };
  document.getElementById('ledgerAiInput').value = '';
  document.getElementById('ledgerFilterBar').innerHTML = '';
  document.querySelectorAll('.qf-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  document.getElementById('ledgerSort').value = 'default';
  document.getElementById('ledgerBackdrop').classList.add('show');
  document.getElementById('ledgerPanel').classList.add('open');
  renderLedger();
}

function closeLedger() {
  document.getElementById('ledgerBackdrop').classList.remove('show');
  document.getElementById('ledgerPanel').classList.remove('open');
}

function ledgerQF(btn, type) {
  ledgerFilter = { type, aiMatchIds:null };
  document.getElementById('ledgerAiInput').value = '';
  document.getElementById('ledgerFilterBar').innerHTML = '';
  document.querySelectorAll('.qf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLedger();
}

function getLedgerRows() {
  let rows = [...projects];
  if (ledgerFilter.aiMatchIds) {
    rows = rows.filter(p => ledgerFilter.aiMatchIds.includes(p.id));
  } else if (ledgerFilter.type !== 'all') {
    const t = ledgerFilter.type;
    if      (t === 0)         rows = rows.filter(p => p.stage === STAGE.NEGOTIATING);
    else if (t === 1)         rows = rows.filter(p => p.stage === STAGE.DELIVERING && !hasOpenCollect(p));
    else if (t === 'collect') rows = rows.filter(p => hasOpenCollect(p));
    else if (t === 2)         rows = rows.filter(p => p.stage === STAGE.COMPLETED);
    else if (t === 'todo')    rows = rows.filter(p => (p.todos||[]).some(t => !t.done));
  }
  const s = document.getElementById('ledgerSort')?.value || 'default';
  const n = v => parseFloat(v) || 0;
  if      (s === 'stage')         rows.sort((a,b) => a.stage - b.stage);
  else if (s === 'quote-desc')    rows.sort((a,b) => n(b.quote) - n(a.quote));
  else if (s === 'contract-desc') rows.sort((a,b) => n(b.contract) - n(a.contract));
  else if (s === 'collected-asc') rows.sort((a,b) => (a.paymentPct||0) - (b.paymentPct||0));
  else if (s === 'profit-desc')   rows.sort((a,b) => (n(b.contract)-n(b.cost)) - (n(a.contract)-n(a.cost)));
  return rows;
}

function renderLedger() {
  const rows = getLedgerRows();
  document.getElementById('ledgerCount').innerHTML = `共 <b>${rows.length}</b> 条 / 全部 ${projects.length} 个`;
  const tbody = document.getElementById('ledgerBody');

  const fragment = document.createDocumentFragment();

  if (!rows.length) {
    const emptyRow = document.createElement('tr');
    emptyRow.innerHTML = `<td colspan="10"><div class="ledger-empty">🔍<br>没有符合条件的项目</div></td></tr>`;
    fragment.appendChild(emptyRow);
  } else {
    const isAi = !!ledgerFilter.aiMatchIds;
    const rowsHtml = rows.map(p => {
      const col = getBoardColumn(p);
      const stageLabel = col === 'c'
        ? '<span class="l-stage" style="background:var(--sc)">💰 催款中</span>'
        : `<span class="l-stage" style="background:${STAGE_COLOR[p.stage]}">${STAGE_LABEL[p.stage]}</span>`;
      const pending = (p.todos||[]).filter(t => !t.done).length;
      const allT    = (p.todos||[]).length;
      const contract = parseFloat(p.contract) || 0;
      const cost     = parseFloat(p.cost) || 0;
      const profit   = contract && cost ? contract - cost : null;
      const pct      = profit !== null ? Math.round(profit / contract * 100) : null;
      const profitHtml = profit !== null
        ? `<span class="l-profit ${profit>=0?'pos':'neg'}">${profit>=0?'+':''}${profit.toFixed(2)}万 <span style="font-size:.6rem;font-weight:400">(${pct}%)</span></span>`
        : '<span class="l-profit na">—</span>';
      const payPct       = p.paymentPct || 0;
      const payHtml      = p.stage === STAGE.DELIVERING ? `<span style="color:var(--sc);font-weight:600">${payPct}%</span>` : '-';
      const collectedHtml = p.collected ? `${fmtWanShort(p.collected)} 万` : '-';
      const todoHtml     = allT
        ? `<span class="l-todo ${pending?'pending':''}">${pending?'⏳'+pending+'项':'✅全完成'}</span>`
        : '<span class="l-todo">—</span>';
      return `<tr class="${isAi?'ai-match':''}">
        <td class="l-name"><div class="l-name-inner" title="${esc(p.name)}" onclick="editProject('${p.id}');closeLedger()">${esc(p.name)}</div></td>
        <td>${stageLabel}</td>
        <td style="color:#888;font-size:.7rem">${p.channel||'—'}</td>
        <td style="color:#888;font-size:.7rem">${p.source||'—'}</td>
        <td style="font-size:.73rem">${p.owner||'—'}</td>
        <td class="l-amt q">${p.quote?fmtWanShort(p.quote)+' 万':'<span class="l-empty">—</span>'}</td>
        <td class="l-amt c">${p.contract?fmtWanShort(p.contract)+' 万':'<span class="l-empty">—</span>'}</td>
        <td style="font-size:.7rem;color:#888;white-space:nowrap">${p.contractDate||'<span class="l-empty">—</span>'}</td>
        <td style="color:var(--sc);font-weight:600;font-size:.73rem">${collectedHtml}</td>
        <td>${payHtml}</td>
        <td>${profitHtml}</td>
        <td>${todoHtml}</td>
      </tr>`;
    }).join('');

    const tempContainer = document.createElement('tbody');
    tempContainer.innerHTML = rowsHtml;
    while (tempContainer.firstChild) fragment.appendChild(tempContainer.firstChild);
  }

  tbody.innerHTML = '';
  tbody.appendChild(fragment);
}

function ledgerAiSearchDebounced() {
  if (ledgerAiDebounceTimer) clearTimeout(ledgerAiDebounceTimer);
  ledgerAiDebounceTimer = setTimeout(async () => {
    await ledgerAiSearch();
  }, LEDGER_AI_DEBOUNCE_DELAY);
}

async function ledgerAiSearch() {
  if (ledgerAiPending) return;

  const query = document.getElementById('ledgerAiInput').value.trim();
  if (!query) return;

  const btn = document.getElementById('ledgerAiBtn');

  // 检查缓存
  const cacheKey = query + JSON.stringify(projects.map(p => p.id));
  if (ledgerAiCache.has(cacheKey)) {
    applyAiSearchResult(ledgerAiCache.get(cacheKey), query);
    return;
  }

  ledgerAiPending = true;
  btn.disabled = true;
  btn.style.opacity = '0.5';
  const bar = document.getElementById('ledgerFilterBar');
  bar.innerHTML = `<div class="ai-thinking"><div class="ai-dot"></div><div class="ai-dot"></div><div class="ai-dot"></div>&nbsp;AI 理解中…</div>`;

  const summary = projects.map(p => ({
    id: p.id, name: p.name, stage: STAGE_LABEL[p.stage],
    hasPendingCollect: hasOpenCollect(p),
    channel: p.channel||'', source: p.source||'', owner: p.owner||'',
    quote: parseFloat(p.quote)||0, contract: parseFloat(p.contract)||0,
    cost: parseFloat(p.cost)||0, paymentPct: p.paymentPct||0,
    pendingTodos: (p.todos||[]).filter(t=>!t.done).length
  }));

  try {
    const data = await claudeCall({
      task: '台账AI筛选',
      max_tokens: 800,
      messages: [{ role:'user', content:`项目台账筛选。从列表中找出符合条件的项目ID，只返回JSON不加说明。\n项目列表：${JSON.stringify(summary)}\n条件：「${query}」\n格式：{"matchIds":["id1"],"explanation":"一句话","tags":["标签"]}` }]
    });
    const text = (data._parsed?.text || data.content?.map(c=>c.text||'').join('') || '').replace(/```json|```/g,'').trim();
    const result = JSON.parse(text);
    ledgerAiCache.set(cacheKey, result);
    applyAiSearchResult(result, query);
  } catch(e) {
    bar.innerHTML = `<span style="color:#e57373;font-size:.7rem">⚠️ AI筛选失败</span><span style="margin-left:auto;cursor:pointer;font-size:.7rem;color:#aaa" onclick="clearAiFilter()">✕</span>`;
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
    ledgerAiPending = false;
  }
}

function applyAiSearchResult(result, query) {
  ledgerFilter.aiMatchIds = result.matchIds || [];
  document.querySelectorAll('.qf-btn').forEach(b => b.classList.remove('active'));
  const bar = document.getElementById('ledgerFilterBar');
  bar.innerHTML = (result.tags||[query]).map(t=>`<span class="filter-tag">🤖 ${t}</span>`).join('')
    + `<span style="margin-left:6px;font-size:.68rem;color:rgba(255,255,255,.4)">${result.explanation||''}</span>`
    + `<span style="margin-left:auto;font-size:.68rem;color:#7eccd8;cursor:pointer" onclick="clearAiFilter()">✕ 清除</span>`;
  renderLedger();
}

function clearAiFilter() {
  ledgerFilter = { type:'all', aiMatchIds:null };
  document.getElementById('ledgerAiInput').value = '';
  document.getElementById('ledgerFilterBar').innerHTML = '';
  document.querySelectorAll('.qf-btn').forEach((b,i) => b.classList.toggle('active', i===0));
  renderLedger();
}

export {
  ledgerFilter,
  openLedger,
  closeLedger,
  ledgerQF,
  getLedgerRows,
  renderLedger,
  ledgerAiSearchDebounced,
  ledgerAiSearch,
  applyAiSearchResult,
  clearAiFilter
};
