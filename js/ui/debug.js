// ── Tab Debug 工具，在控制台输入 debugTabs() 运行 ──
window.debugTabs = function() {
  console.group('=== Tab Debug ===');
  
  // 1. 检查HTML里的tab按钮
  const tabBtns = document.querySelectorAll('.modal-tabs .m-tab');
  console.log('当前modal-tabs里的Tab按钮数量:', tabBtns.length);
  tabBtns.forEach((t, i) => {
    const onclick = t.getAttribute('onclick') || '';
    const match = onclick.match(/switchModalTab\('(\w+)'/);
    const id = t.id || '(无id)';
    console.log(`  按钮[${i}]: tab=${match?.[1] || '?'} id=${id} display=${t.style.display} active=${t.classList.contains('active')}`);
  });
  
  // 2. 检查tab-cost按钮
  const costBtn = document.getElementById('tab-cost');
  console.log('tab-cost按钮:', costBtn ? `找到，display=${costBtn.style.display}，在DOM中=${document.body.contains(costBtn)}` : '❌ 未找到');
  
  // 3. 检查mtab-cost body
  const costBody = document.getElementById('mtab-cost');
  console.log('mtab-cost body:', costBody ? `找到，display=${getComputedStyle(costBody).display}，active=${costBody.classList.contains('active')}` : '❌ 未找到');
  
  // 4. 检查所有mtab-body
  const bodies = document.querySelectorAll('.m-tab-body');
  console.log('全部.m-tab-body数量:', bodies.length);
  bodies.forEach((b, i) => {
    console.log(`  body[${i}]: id=${b.id} active=${b.classList.contains('active')} display=${getComputedStyle(b).display}`);
  });
  
  // 5. 检查getTabNodes返回值
  if (typeof getTabNodes === 'function') {
    const nodes = getTabNodes();
    console.log('getTabNodes()返回:', Object.entries(nodes).map(([k,v]) => `${k}=${v ? '✅' : '❌'}`).join(', '));
  } else {
    console.log('getTabNodes: ❌ 函数不存在');
  }
  
  // 6. 检查currentEditProjectId
  console.log('currentEditProjectId:', window.currentEditProjectId);
  
  // 7. 检查renderCostAnalysisTab
  console.log('renderCostAnalysisTab:', typeof window.renderCostAnalysisTab);
  
  console.groupEnd();
};

// 自动在每次打开modal时运行
const _origEditProject = window.editProject;
if (_origEditProject && !_origEditProject._debugWrapped) {
  window.editProject = async function(id) {
    const result = await _origEditProject.call(this, id);
    setTimeout(() => {
      console.log('[debug] editProject完成后的Tab状态:');
      window.debugTabs();
    }, 300);
    return result;
  };
  window.editProject._debugWrapped = true;
}

console.log('✅ Tab Debug工具已加载，可以手动运行 debugTabs()');
