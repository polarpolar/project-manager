// ╔══════════════════════════════════════════════════════════════╗
// ║  cost-analysis.js — 项目采购成本分析模块                      ║
// ║  依赖：ai-module.js, file-system-module.js, SheetJS(CDN)     ║
// ╚══════════════════════════════════════════════════════════════╝

// ── 采购文件识别关键词 ───────────────────────────────────────────
const PROCUREMENT_KEYWORDS = ['采购', '清单', 'BOM', '物料', '供应商', '材料', '配件', '询价'];
const PROCUREMENT_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.pdf', '.docx', '.doc'];

// ── 确保 SheetJS 已加载 ──────────────────────────────────────────
async function _ensureSheetJS() {
  if (window.XLSX) return;
  await new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ── 扫描项目文件夹，找采购候选文件 ──────────────────────────────
async function scanProcurementFiles(projectId) {
  const dirHandle = window.projectDirMap?.[projectId];
  if (!dirHandle) return [];

  const candidates = [];
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'file') continue;
      const lower = name.toLowerCase();
      const ext   = '.' + lower.split('.').pop();
      if (!PROCUREMENT_EXTENSIONS.includes(ext)) continue;
      // 关键词匹配
      const hasKeyword = PROCUREMENT_KEYWORDS.some(kw => name.includes(kw));
      if (!hasKeyword) continue;

      const file = await handle.getFile();
      candidates.push({
        name,
        handle,
        ext,
        modified: file.lastModified,
        modifiedStr: new Date(file.lastModified).toLocaleDateString('zh-CN')
      });
    }
  } catch (e) {
    console.warn('[cost-analysis] 扫描文件夹失败:', e);
  }

  // 按修改时间降序排列
  candidates.sort((a, b) => b.modified - a.modified);
  return candidates;
}

// ── 读取文件内容（根据格式） ─────────────────────────────────────
async function _readFileContent(fileHandle) {
  const file = await fileHandle.getFile();
  const name = file.name.toLowerCase();

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    await _ensureSheetJS();
    const ab = await file.arrayBuffer();
    // .xls 需要指定 bookType，否则 SheetJS 可能解析失败
    const wb = XLSX.read(ab, { type: 'arraybuffer', bookType: name.endsWith('.xls') ? 'xls' : undefined });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    // 转为二维数组，过滤掉全空行，只保留有效内容列
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    // 过滤掉全空行
    const filtered = rows.filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined));
    // 限制最多60行，避免token超出
    const limited = filtered.slice(0, 60);
    // 转为简洁文本：每行用 | 分隔
    const text = limited.map(row =>
      row.map(c => String(c).replace(/\n/g, ' ').trim().slice(0, 30)).join(' | ')
    ).join('\n');
    return { type: 'excel', text, sheetName: wb.SheetNames[0] };
  }

  if (name.endsWith('.csv')) {
    const text = await file.text();
    return { type: 'csv', text };
  }

  if (name.endsWith('.docx') || name.endsWith('.doc')) {
    const text = await window.readDocxText(file); // 复用 file-system-module 里的函数
    return { type: 'word', text };
  }

  if (name.endsWith('.pdf')) {
    // PDF 交给 AI 视觉识别（复用现有视觉槽位）
    const ab     = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
    return { type: 'pdf', base64, mimeType: 'application/pdf' };
  }

  return null;
}

// ── 调用 AI 解析采购清单 ─────────────────────────────────────────
async function _parseWithAI(fileContent, fileName) {
  const prompt = `你是一个采购数据解析专家。以下是一份采购清单文件（${fileName}）的内容，请提取所有采购物料信息。

要求：
1. 第一行通常是标题，第二行通常是表头，从第三行开始是数据行
2. 识别表头，找到品名/物料名称、数量、单价、参考总价/金额 对应的列
3. 提取所有有效数据行，跳过：含"总价""合计"字样的行、全空行、备注行
4. 如果没有品类列，根据品名自动归类（传感器/变送器/采集模块/网关/线缆/机柜/耗材/服务器/其他）
5. 金额单位判断：如果数据中最大金额超过1000，说明单位是元，所有金额和单价除以10000转为万元；否则直接用
6. 只返回JSON，不要有任何其他文字、解释或markdown代码块

{
  "unit": "万元",
  "totalCost": 数字,
  "items": [
    { "category": "品类", "name": "品名", "qty": 数量或null, "unitPrice": 万元单价或null, "amount": 万元金额 }
  ]
}

采购清单内容（每行用|分隔列）：
\${fileContent}`;

  const result = await window.claudeCall({
    task: '合同文本解析',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const text = result._parsed?.text || '';
  if (!text) throw new Error('AI 返回了空响应，请检查 AI 配置或稍后重试');
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    // 返回AI原始回复的前200字，便于调试
    const preview = text.slice(0, 200);
    throw new Error('AI 未返回有效的 JSON 数据。AI回复：' + preview);
  }
  try {
    return JSON.parse(match[0]);
  } catch(e) {
    throw new Error('JSON 解析失败：' + e.message);
  }
}

// ── 调用 AI 视觉识别（PDF 扫描件） ──────────────────────────────
async function _parseWithVision(base64, mimeType, fileName) {
  const result = await window.claudeCallWithVision({
    task: '合同扫描件识别',
    max_tokens: 3000,
    images: [{ base64, mimeType }],
    textPrompt: `这是一份采购清单文件（${fileName}），请提取所有采购物料信息。
只返回如下JSON，不要有任何其他文字：
{
  "unit": "万元",
  "totalCost": 数字,
  "items": [
    { "category": "品类", "name": "品名", "qty": 数量或null, "unitPrice": 单价或null, "amount": 金额 }
  ]
}`
  });

  const text = result._parsed?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 视觉识别未返回有效数据');
  return JSON.parse(match[0]);
}

// ── 主识别函数 ───────────────────────────────────────────────────
async function analyzeProcurement(projectId, fileHandle) {
  const file    = await fileHandle.getFile();
  const content = await _readFileContent(fileHandle);
  if (!content) throw new Error('不支持的文件格式');

  let parsed;
  if (content.type === 'pdf') {
    parsed = await _parseWithVision(content.base64, content.mimeType, file.name);
  } else {
    parsed = await _parseWithAI(content.text, file.name);
  }

  // 重新计算 totalCost（以 items 为准，防止 AI 算错）
  const totalCost = parsed.items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);

  const procurement = {
    sourceFile:          file.name,
    sourceFileModified:  new Date(file.lastModified).toLocaleDateString('zh-CN'),
    analyzedAt:          new Date().toLocaleString('zh-CN', { hour12: false }),
    totalCost:           +totalCost.toFixed(4),
    items:               parsed.items
  };

  // 写入项目数据
  const idx = window.projects.findIndex(p => String(p.id) === String(projectId));
  if (idx === -1) throw new Error('项目不存在');
  window.projects[idx].procurement = procurement;
  window.projects[idx].cost        = +totalCost.toFixed(2); // 同步旧字段

  // 标记为已修改并保存
  if (typeof window.markProjectModified === 'function') window.markProjectModified(projectId);
  if (typeof window.save === 'function') window.save();

  return { project: window.projects[idx], procurement };
}

// ── 渲染成本分析 Tab ─────────────────────────────────────────────
async function renderCostAnalysisTab(projectId) {
  const root = document.getElementById('cost-analysis-root');
  if (!root) return;

  const p = window.projects?.find(pr => String(pr.id) === String(projectId));
  if (!p) return;

  // 扫描候选文件
  root.innerHTML = `<div style="color:#bbb;font-size:.75rem;text-align:center;padding:30px 0">正在扫描文件夹…</div>`;
  const candidates = await scanProcurementFiles(projectId);

  if (!candidates.length && !p.procurement) {
    root.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:#bbb">
        <div style="font-size:2rem;margin-bottom:12px">📦</div>
        <div style="font-size:.78rem;line-height:1.7">
          未在项目文件夹中找到采购清单<br>
          请将采购清单（Excel/PDF/Word）放入项目文件夹<br>
          文件名需包含：采购、清单、BOM、物料 等关键词
        </div>
      </div>`;
    return;
  }

  root.innerHTML = _buildTabHTML(p, candidates);
  _bindTabEvents(projectId, candidates);
}

// ── 构建 Tab HTML ────────────────────────────────────────────────
function _buildTabHTML(p, candidates) {
  const proc = p.procurement;

  // 文件选择区
  const fileListHTML = candidates.length ? `
    <div style="margin-bottom:16px">
      <div style="font-size:.72rem;font-weight:700;color:var(--ink-light);margin-bottom:8px">
        检测到 ${candidates.length} 个采购文件
      </div>
      <div style="display:flex;flex-direction:column;gap:6px" id="ca-file-list">
        ${candidates.map((f, i) => `
          <label style="display:flex;align-items:center;gap:10px;padding:8px 12px;
            background:${i===0 ? 'rgba(123,31,162,0.08)' : 'var(--paper)'};
            border:1.5px solid ${i===0 ? 'rgba(123,31,162,0.3)' : 'var(--paper2)'};
            border-radius:8px;cursor:pointer;transition:all .15s">
            <input type="radio" name="ca-file" value="${i}" ${i===0 ? 'checked' : ''}
              style="accent-color:var(--accent)">
            <div style="flex:1;min-width:0">
              <div style="font-size:.75rem;font-weight:600;color:var(--ink);
                white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
              <div style="font-size:.62rem;color:#999;margin-top:2px">修改于 ${f.modifiedStr}</div>
            </div>
            <span style="font-size:.6rem;padding:2px 7px;border-radius:10px;
              background:rgba(21,101,192,0.1);color:#1565c0;flex-shrink:0">
              ${f.ext.replace('.', '').toUpperCase()}
            </span>
          </label>`).join('')}
      </div>
      <button id="ca-analyze-btn" style="margin-top:12px;width:100%;padding:10px;
        background:linear-gradient(135deg,var(--accent),#4a0080);color:#fff;
        border:none;border-radius:9px;font-size:.78rem;font-weight:700;
        cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;
        transition:opacity .15s">
        🔍 识别选中文件
      </button>
    </div>` : '';

  // 识别结果区（如已有数据）
  const resultHTML = proc ? _buildResultHTML(p) : '';

  return `<div style="padding:4px 0">${fileListHTML}${resultHTML}</div>`;
}

function _buildResultHTML(p) {
  const proc     = p.procurement;
  const contract = parseFloat(p.contract) || 0;
  const cost     = parseFloat(proc.totalCost) || 0;
  const gross    = contract - cost;
  const grossPct = contract > 0 ? Math.round((gross / contract) * 100) : null;
  const color    = grossPct === null ? '#888' : grossPct >= 30 ? 'var(--s2)' : grossPct >= 15 ? '#e65100' : '#e53935';

  // 品类汇总
  const categoryMap = {};
  (proc.items || []).forEach(item => {
    const cat = item.category || '其他';
    categoryMap[cat] = (categoryMap[cat] || 0) + (parseFloat(item.amount) || 0);
  });
  const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
  const COLORS = ['var(--accent)', 'var(--s1)', 'var(--s2)', 'var(--sc)', '#9c27b0', '#00796b', '#f57c00'];

  const categoryRows = categories.map(([cat, amt], i) => {
    const pct = cost > 0 ? Math.round((amt / cost) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <span style="width:8px;height:8px;border-radius:50%;background:${COLORS[i % COLORS.length]};flex-shrink:0"></span>
        <span style="flex:1;font-size:.72rem;color:var(--ink)">${cat}</span>
        <span style="font-size:.72rem;color:#888;width:60px;text-align:right">${amt.toFixed(2)}万</span>
        <div style="width:80px;background:var(--paper2);border-radius:4px;height:6px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${COLORS[i % COLORS.length]};border-radius:4px"></div>
        </div>
        <span style="font-size:.68rem;color:#999;width:32px;text-align:right">${pct}%</span>
      </div>`;
  }).join('');

  // 明细表
  const detailRows = (proc.items || []).slice(0, 50).map(item => `
    <tr>
      <td style="color:#888">${item.category || '—'}</td>
      <td style="font-weight:500">${item.name || '—'}</td>
      <td style="text-align:right;color:#666">${item.qty ?? '—'}</td>
      <td style="text-align:right;color:#666">${item.unitPrice != null ? item.unitPrice.toFixed(4) : '—'}</td>
      <td style="text-align:right;font-weight:600;color:var(--sc)">${(parseFloat(item.amount)||0).toFixed(2)}</td>
    </tr>`).join('');

  return `
    <div style="border-top:1px solid var(--paper2);padding-top:14px;margin-top:4px">
      <!-- 来源信息 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div style="font-size:.68rem;color:#999">
          📄 ${proc.sourceFile} &nbsp;·&nbsp; ${proc.analyzedAt} 识别
        </div>
        <button id="ca-reanalyze-btn" style="font-size:.62rem;padding:3px 10px;
          background:none;border:1px solid var(--paper3);border-radius:6px;
          color:var(--ink-light);cursor:pointer">重新识别</button>
      </div>

      <!-- 核心数字 -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px">
        ${_statCard('采购成本', cost.toFixed(2) + ' 万', 'var(--sc)')}
        ${_statCard('合同金额', contract > 0 ? contract.toFixed(2) + ' 万' : '—', 'var(--s1)')}
        ${_statCard('毛利率', grossPct !== null ? grossPct + '%' : '—', color)}
      </div>

      ${contract > 0 && grossPct !== null ? `
      <div style="margin-bottom:16px;font-size:.72rem;color:var(--ink-light);
        background:var(--paper);border-radius:8px;padding:10px 12px;
        border-left:3px solid ${color}">
        毛利 <strong style="color:${color}">${gross.toFixed(2)} 万</strong>，
        毛利率 <strong style="color:${color}">${grossPct}%</strong>
        ${grossPct < 15 ? '&nbsp;⚠️ 偏低，请注意成本控制' : grossPct >= 30 ? '&nbsp;✅ 健康' : ''}
      </div>` : ''}

      <!-- 品类占比 -->
      ${categories.length > 1 ? `
      <div style="margin-bottom:16px">
        <div style="font-size:.7rem;font-weight:700;color:var(--ink-light);margin-bottom:10px">品类成本占比</div>
        ${categoryRows}
      </div>` : ''}

      <!-- 采购明细 -->
      <div>
        <div style="font-size:.7rem;font-weight:700;color:var(--ink-light);margin-bottom:8px">
          采购明细（${proc.items?.length || 0} 项）
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:.68rem">
            <thead>
              <tr style="border-bottom:1px solid var(--paper2)">
                <th style="text-align:left;padding:5px 6px;color:#999;font-weight:600">品类</th>
                <th style="text-align:left;padding:5px 6px;color:#999;font-weight:600">品名</th>
                <th style="text-align:right;padding:5px 6px;color:#999;font-weight:600">数量</th>
                <th style="text-align:right;padding:5px 6px;color:#999;font-weight:600">单价(万)</th>
                <th style="text-align:right;padding:5px 6px;color:#999;font-weight:600">金额(万)</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
            <tfoot>
              <tr style="border-top:1px solid var(--paper2)">
                <td colspan="4" style="padding:6px;font-weight:700;color:var(--ink)">合计</td>
                <td style="padding:6px;text-align:right;font-weight:700;color:var(--sc)">
                  ${cost.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>`;
}

function _statCard(label, value, color) {
  return `
    <div style="background:var(--paper);border-radius:10px;padding:12px;
      border:1px solid var(--paper2);text-align:center">
      <div style="font-size:.62rem;color:#999;margin-bottom:5px">${label}</div>
      <div style="font-size:1rem;font-weight:700;color:${color}">${value}</div>
    </div>`;
}

// ── 绑定 Tab 事件 ────────────────────────────────────────────────
function _bindTabEvents(projectId, candidates) {
  // 文件选择项高亮
  const radios = document.querySelectorAll('input[name="ca-file"]');
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('#ca-file-list label').forEach((label, i) => {
        const selected = parseInt(radio.value) === i;
        label.style.background = selected ? 'rgba(123,31,162,0.08)' : 'var(--paper)';
        label.style.border     = `1.5px solid ${selected ? 'rgba(123,31,162,0.3)' : 'var(--paper2)'}`;
      });
    });
  });

  // 识别按钮
  const btn = document.getElementById('ca-analyze-btn');
  if (btn) btn.addEventListener('click', () => _triggerAnalysis(projectId, candidates));

  // 重新识别按钮
  const reBtn = document.getElementById('ca-reanalyze-btn');
  if (reBtn) reBtn.addEventListener('click', () => _triggerAnalysis(projectId, candidates));
}

async function _triggerAnalysis(projectId, candidates) {
  const root    = document.getElementById('cost-analysis-root');
  const checked = document.querySelector('input[name="ca-file"]:checked');
  const idx     = checked ? parseInt(checked.value) : 0;
  const target  = candidates[idx];
  if (!target) return;

  // 显示进度
  root.innerHTML = `
    <div style="padding:30px 20px;text-align:center">
      <div style="font-size:.78rem;font-weight:600;color:var(--ink-light);margin-bottom:20px">
        正在识别：${target.name}
      </div>
      <div id="ca-progress-steps" style="text-align:left;max-width:280px;margin:0 auto">
        ${['读取文件内容…', 'AI 理解表格结构…', '提取采购明细…', '计算成本汇总…']
          .map((s, i) => `<div id="ca-step-${i}" style="font-size:.72rem;color:#ccc;padding:5px 0;
            display:flex;align-items:center;gap:8px">
            <span id="ca-step-icon-${i}">○</span> ${s}
          </div>`).join('')}
      </div>
    </div>`;

  const setStep = (i, done = false, err = false) => {
    const el = document.getElementById(`ca-step-${i}`);
    const ic = document.getElementById(`ca-step-icon-${i}`);
    if (!el || !ic) return;
    el.style.color  = err ? '#e53935' : done ? 'var(--s2)' : 'var(--ink)';
    ic.textContent  = err ? '✕' : done ? '✓' : '●';
  };

  try {
    setStep(0);
    await new Promise(r => setTimeout(r, 100)); // 让UI渲染

    const content = await _readFileContent(target.handle);
    setStep(0, true);
    setStep(1);

    const p = window.projects?.find(pr => String(pr.id) === String(projectId));
    const { procurement } = await analyzeProcurement(projectId, target.handle);
    setStep(1, true);
    setStep(2, true);
    setStep(3, true);

    await new Promise(r => setTimeout(r, 400));

    // 刷新 Tab 内容
    await renderCostAnalysisTab(projectId);

    // 同步基本信息 Tab 的只读显示
    const updatedP = window.projects?.find(pr => String(pr.id) === String(projectId));
    if (updatedP && typeof window.updateProcurementSummary === 'function') {
      window.updateProcurementSummary(updatedP);
    }

    // 刷新看板卡片
    if (typeof window.refreshView === 'function') window.refreshView();

    if (typeof window.showToast === 'function') window.showToast('✅ 采购成本识别完成');

  } catch (e) {
    console.error('[cost-analysis]', e);
    root.innerHTML = `
      <div style="text-align:center;padding:30px 20px;color:#e53935;font-size:.75rem">
        ❌ 识别失败：${e.message}<br>
        <button onclick="renderCostAnalysisTab('${projectId}')"
          style="margin-top:12px;padding:6px 16px;background:none;border:1px solid var(--paper3);
          border-radius:6px;color:var(--ink-light);cursor:pointer;font-size:.7rem">
          返回重试
        </button>
      </div>`;
  }
}

export {
  renderCostAnalysisTab,
  analyzeProcurement,
  scanProcurementFiles
};
