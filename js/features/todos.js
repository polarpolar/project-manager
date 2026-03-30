// ╔══════════════════════════════════════════╗
// ║  MODULE: todos-panel（待办分析面板）      ║
// ╚══════════════════════════════════════════╝

const TODO_TYPES = [
  { key:'contract', label:'推进合同', icon:'📝', color:'#1565c0', keywords:['合同','签约','签订','盖章','协议','签署','报价','报批'] },
  { key:'payment',  label:'催收回款', icon:'💰', color:'#e65100', keywords:['回款','收款','打款','汇款','付款','催款','发票','开票','尾款','首款','定金'] },
  { key:'delivery', label:'交付执行', icon:'🚚', color:'#2e7d32', keywords:['交付','发货','安装','调试','验收','实施','部署','上线','提交','交稿','初稿','方案'] },
  { key:'followup', label:'客户跟进', icon:'📞', color:'#6a1b9a', keywords:['跟进','拜访','沟通','确认','联系','反馈','对接','会议','汇报','演示','洽谈'] },
  { key:'other',    label:'其他事项', icon:'📌', color:'#78909c', keywords:[] },
];

function classifyTodo(text) {
  for (const tp of TODO_TYPES) { if(tp.key!=='other'&&tp.keywords.some(k=>text.includes(k))) return tp; }
  return TODO_TYPES.find(t=>t.key==='other');
}

function openTodosPanel()  { renderTodosPanel(); document.getElementById('todosBackdrop').classList.add('show'); document.getElementById('todosPanel').classList.add('open'); }
function closeTodosPanel() { document.getElementById('todosBackdrop').classList.remove('show'); document.getElementById('todosPanel').classList.remove('open'); }

function todoRowHTML(t) {
  const sKey = getBoardColumn({stage:t.stage, collectTasks:[]});
  return `
  <div class="tp-todo-row" data-s="${sKey}">
    <div class="tp-chk ${t.done?'done':''}" onclick="toggleTodo('${t.projectId}',${t.todoIdx})"></div>
    <div>
      <div class="tp-todo-text ${t.done?'done':''}">${esc(t.text)}</div>
      <div class="tp-todo-meta">
        <span class="tp-chip" style="background:${STAGE_COLOR[t.stage]}">${STAGE_SHORT[t.stage]}</span>
        ${t.projectName}${t.owner?' · 👤'+t.owner:''}
      </div>
    </div>
  </div>`;
}

function toggleTodo(pid,ti) {
  const p=projects.find(x=>x.id===pid); if(!p||!p.todos[ti]) return;
  p.todos[ti].done=!p.todos[ti].done;
  markProjectModified(pid);
  save();
  refreshView();
}

function renderTodosPanel() {
  const all=[];
  projects.forEach(p=>(p.todos||[]).forEach((t,ti)=>all.push({...t,projectName:p.name,projectId:p.id,owner:p.owner||'未分配',stage:p.stage,todoIdx:ti})));
  const pending=all.filter(t=>!t.done), done=all.filter(t=>t.done);
  const rate=all.length?Math.round(done.length/all.length*100):0;
  const byType={};
  TODO_TYPES.forEach(tp=>byType[tp.key]=[]);
  pending.forEach(t=>{ const tp=classifyTodo(t.text); byType[tp.key].push(t); });
  const byOwner={};
  pending.forEach(t=>{ if(!byOwner[t.owner])byOwner[t.owner]=[]; byOwner[t.owner].push(t); });
  const byProject={};
  projects.filter(p=>(p.todos||[]).length).forEach(p=>{
    byProject[p.id]={name:p.name,stage:p.stage,todos:p.todos.map((t,ti)=>({...t,projectName:p.name,projectId:p.id,owner:p.owner||'未分配',stage:p.stage,todoIdx:ti}))};
  });

  // ── 收集所有未完成催款任务 ──
  const collectRows = [];
  const today = new Date(); today.setHours(0,0,0,0);
  projects.forEach(p => {
    (p.collectTasks||[]).filter(t=>!t.done).forEach(t => {
      const startDate = t.date ? new Date(t.date) : null;
      let daysDiff = 0, daysLabel = '—';
      if (startDate) {
        startDate.setHours(0,0,0,0);
        const ms = today - startDate;
        daysDiff = Math.floor(ms / 86400000);
        if (daysDiff < 0) { daysLabel = '未开始'; }
        else if (daysDiff < 30) { daysLabel = daysDiff + ' 天'; }
        else if (daysDiff < 365) {
          const mo = Math.floor(daysDiff/30), dy = daysDiff%30;
          daysLabel = mo+'月' + (dy>0?dy+'天':'');
        } else {
          const yr = Math.floor(daysDiff/365), rem = daysDiff%365;
          const mo = Math.floor(rem/30), dy = rem%30;
          daysLabel = yr+'年' + (mo>0?mo+'月':'') + (dy>0?dy+'天':'');
        }
      }
      const customerName = p.customer || p.source || '—';  // 兼容旧数据
collectRows.push({ projectName: p.name, client: customerName, startDate: t.date||'', amount: t.amount||'', owner: t.owner||'—', note: t.note||'', daysDiff, daysLabel, projectId: p.id });
    });
  });
  collectRows.sort((a,b) => b.daysDiff - a.daysDiff);

  const fragment = document.createDocumentFragment();

  // 催款任务部分
  if (collectRows.length) {
    const collectSection = document.createElement('div');
    collectSection.innerHTML = `
      <div class="tp-section" style="color:#e65100;border-left-color:#e65100">🔔 催款任务 <span class="tp-badge" style="background:rgba(230,81,0,.15);color:#e65100">${collectRows.length}</span></div>
      <div style="margin-bottom:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr 80px 90px;gap:4px 10px;padding:4px 10px 6px;font-size:.6rem;color:#bbb;font-weight:600;letter-spacing:.05em">
          <span>项目 / 客户</span><span>启动日期 / 金额</span><span>欠款时长</span><span>负责人</span>
        </div>
        ${collectRows.map(r => {
          const cls = r.daysDiff >= 30 ? 'danger' : r.daysDiff >= 14 ? 'warn' : 'normal';
          return '<div class="tp-collect-row" onclick="editProject(\'' + r.projectId + '\');closeTodosPanel()">'
            + '<div>'
            + '<div class="tp-cr-name">' + r.projectName + '</div>'
            + '<div class="tp-cr-client">📌 ' + r.client + '</div>'
            + '</div>'
            + '<div>'
            + '<div class="tp-cr-meta">📅 ' + (r.startDate||'—') + '</div>'
            + '<div class="tp-cr-meta" style="margin-top:2px">' + (r.amount ? '💰 '+parseFloat(r.amount).toFixed(2)+'万' : '') + (r.note ? ' · '+r.note : '') + '</div>'
            + '</div>'
            + '<div class="tp-cr-days ' + cls + '">' + r.daysLabel + '</div>'
            + '<div class="tp-cr-owner">👤 ' + r.owner + '</div>'
            + '</div>';
        }).join('')}
      </div>`;
    fragment.appendChild(collectSection);
  }

  // 统计部分
  const summarySection = document.createElement('div');
  summarySection.className = 'tp-summary';
  summarySection.innerHTML = `
    <div class="tp-stat" data-c="p"><div class="tp-stat-num">${all.length}</div><div class="tp-stat-lbl">总数</div></div>
    <div class="tp-stat" data-c="o"><div class="tp-stat-num">${pending.length}</div><div class="tp-stat-lbl">未完成</div></div>
    <div class="tp-stat" data-c="g"><div class="tp-stat-num">${done.length}</div><div class="tp-stat-lbl">已完成</div></div>
    <div class="tp-stat" data-c="b"><div class="tp-stat-num">${rate}%</div><div class="tp-stat-lbl">完成率</div></div>`;
  fragment.appendChild(summarySection);

  // 按类型分析
  const typeSection = document.createElement('div');
  typeSection.innerHTML = `
    <div class="tp-section">🗂 按类型分析（未完成）<span class="tp-badge">${pending.length}</span></div>
    <div>${TODO_TYPES.map(tp=>{ const items=byType[tp.key]; if(!items.length)return''; return `
      <div class="tp-type-card" id="tptype-${tp.key}">
        <div class="tp-type-header" onclick="this.closest('.tp-type-card').classList.toggle('open')">
          <div class="tp-type-label"><span>${tp.icon}</span><span style="color:${tp.color}">${tp.label}</span></div>
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.68rem;color:#aaa">${items.length}项</span><span class="tp-type-arrow">▶</span></div>
        </div>
        <div class="tp-type-body">${items.map(t=>todoRowHTML(t)).join('')}</div>
      </div>`; }).join('')}</div>`;
  fragment.appendChild(typeSection);

  // 按负责人
  const ownerSection = document.createElement('div');
  ownerSection.innerHTML = `
    <div class="tp-section">👤 按负责人（未完成）<span class="tp-badge">${Object.keys(byOwner).length}人</span></div>
    <div>${Object.entries(byOwner).map(([o,ts])=>`
      <div class="tp-owner-block">
        <div class="tp-owner-name">👤 ${o} <span style="font-weight:400;color:#aaa;font-size:.68rem">（${ts.length}项）</span></div>
        ${ts.map(t=>todoRowHTML(t)).join('')}
      </div>`).join('')||'<div style="color:#ccc;font-size:.78rem;padding:8px 0">暂无未完成待办</div>'}</div>`;
  fragment.appendChild(ownerSection);

  // 按项目列出
  const projectSection = document.createElement('div');
  projectSection.innerHTML = `
    <div class="tp-section">📋 按项目列出<span class="tp-badge">${Object.keys(byProject).length}个</span></div>
    ${Object.values(byProject).map(proj=>{ const d=proj.todos.filter(t=>t.done).length; const pct=Math.round(d/proj.todos.length*100); return `
      <div class="tp-project-block">
        <div class="tp-project-name">
          <span class="tp-chip" style="background:${STAGE_COLOR[proj.stage]}">${STAGE_SHORT[proj.stage]}</span>${proj.name}
          <span style="font-weight:400;color:#aaa;font-size:.66rem">（${d}/${proj.todos.length} · ${pct}%）</span>
        </div>
        <div style="background:var(--paper2);border-radius:4px;height:4px;margin-bottom:7px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--accent);border-radius:4px"></div></div>
        ${proj.todos.map(t=>todoRowHTML(t)).join('')}
      </div>`; }).join('')||'<div style="color:#ccc;font-size:.78rem">暂无项目待办</div>'}`;
  fragment.appendChild(projectSection);

  const panelBody = document.getElementById('todosPanelBody');
  panelBody.innerHTML = '';
  panelBody.appendChild(fragment);
}

export {
  TODO_TYPES,
  classifyTodo,
  openTodosPanel,
  closeTodosPanel,
  todoRowHTML,
  toggleTodo,
  renderTodosPanel
};
