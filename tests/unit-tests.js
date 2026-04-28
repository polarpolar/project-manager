// 项目管理工具 - 单元测试
// 运行方式：在浏览器控制台直接执行这些测试函数

// ═══════════════════════════════════════════════════════════════
// 测试工具函数
// ═══════════════════════════════════════════════════════════════

let testCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  testCount++;
  if (condition) {
    passCount++;
    if (window.DEBUG) console.log(`✅ ${testCount}. ${message}`);
    return true;
  } else {
    failCount++;
    console.error(`❌ ${testCount}. ${message}`);
    return false;
  }
}

function assertEqual(actual, expected, message) {
  testCount++;
  const passed = actual === expected;
  if (passed) {
    passCount++;
    if (window.DEBUG) console.log(`✅ ${testCount}. ${message}`);
  } else {
    failCount++;
    console.error(`❌ ${testCount}. ${message}`);
    console.error(`   预期: ${expected}`);
    console.error(`   实际: ${actual}`);
  }
  return passed;
}

function resetTests() {
  testCount = 0;
  passCount = 0;
  failCount = 0;
}

function printSummary() {
  console.log(`\n═══════════════════════════════════════`);
  console.log(`测试完成: ${testCount} 个测试`);
  console.log(`通过: ${passCount} | 失败: ${failCount}`);
  console.log(`═══════════════════════════════════════\n`);
}

// ═══════════════════════════════════════════════════════════════
// STAGE 常量测试
// ═══════════════════════════════════════════════════════════════

function testStageConstants() {
  console.log('\n--- STAGE 常量测试 ---');
  resetTests();

  if (typeof STAGE !== 'undefined') {
    assertEqual(STAGE.NEGOTIATING, 0, 'STAGE.NEGOTIATING 应为 0');
    assertEqual(STAGE.DELIVERING, 1, 'STAGE.DELIVERING 应为 1');
    assertEqual(STAGE.COMPLETED, 2, 'STAGE.COMPLETED 应为 2');
    assertEqual(STAGE.TERMINATED, 3, 'STAGE.TERMINATED 应为 3');
  } else {
    assert(false, 'STAGE 未定义');
  }

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// 项目数据结构测试
// ═══════════════════════════════════════════════════════════════

function testProjectDataStructure() {
  console.log('\n--- 项目数据结构测试 ---');
  resetTests();

  // 测试项目对象结构
  const mockProject = {
    id: 'test-001',
    projectCode: 'PM-20250101-0001',
    name: '测试项目',
    stage: 0,
    channel: '官网',
    customer: '测试客户',
    owner: '张三',
    product: 'G01',
    quote: 10.5,
    contract: 9.8,
    cost: 3.2,
    collected: 5.0,
    paymentPct: 51,
    active: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  assert(mockProject.id !== undefined, '项目应有 id 字段');
  assert(mockProject.name !== undefined, '项目应有 name 字段');
  assert(mockProject.stage !== undefined, '项目应有 stage 字段');
  assertEqual(mockProject.stage, 0, '项目 stage 应为 0 (洽谈中)');

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// 格式化函数测试
// ═══════════════════════════════════════════════════════════════

function testFormatFunctions() {
  console.log('\n--- 格式化函数测试 ---');
  resetTests();

  // 测试 fmtWan (万元格式化)
  if (typeof fmtWan === 'function') {
    assertEqual(fmtWan(10000), '1.00', 'fmtWan(10000) 应返回 "1.00"');
    assertEqual(fmtWan(10500), '1.05', 'fmtWan(10500) 应返回 "1.05"');
    assertEqual(fmtWan(0), '0.00', 'fmtWan(0) 应返回 "0.00"');
  } else {
    assert(false, 'fmtWan 函数未定义');
  }

  // 测试 fmtYuan (元格式化)
  if (typeof fmtYuan === 'function') {
    assertEqual(fmtYuan(100), '100.00', 'fmtYuan(100) 应返回 "100.00"');
    assertEqual(fmtYuan(10500), '10,500.00', 'fmtYuan(10500) 应返回 "10,500.00"');
  } else {
    assert(false, 'fmtYuan 函数未定义');
  }

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// getBoardColumn 测试
// ═══════════════════════════════════════════════════════════════

function testGetBoardColumn() {
  console.log('\n--- getBoardColumn 测试 ---');
  resetTests();

  if (typeof getBoardColumn !== 'undefined') {
    // 洽谈中项目应在第 0 列
    assertEqual(getBoardColumn({ stage: 0, active: 'active' }), 0, '洽谈中项目应在第 0 列');
    // 交付中项目应在第 1 列
    assertEqual(getBoardColumn({ stage: 1, active: 'active' }), 1, '交付中项目应在第 1 列');
    // 已完结项目应在第 2 列
    assertEqual(getBoardColumn({ stage: 2, active: 'active' }), 2, '已完结项目应在第 2 列');
    // 已终止项目应在第 3 列
    assertEqual(getBoardColumn({ stage: 3, active: 'inactive' }), 3, '已终止项目应在第 3 列');
  } else {
    assert(false, 'getBoardColumn 函数未定义');
  }

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// AI_PROVIDERS 测试
// ═══════════════════════════════════════════════════════════════

function testAIProviders() {
  console.log('\n--- AI_PROVIDERS 测试 ---');
  resetTests();

  if (typeof AI_PROVIDERS !== 'undefined') {
    assert(AI_PROVIDERS.claude !== undefined, 'AI_PROVIDERS 应包含 claude');
    assert(AI_PROVIDERS.openai !== undefined, 'AI_PROVIDERS 应包含 openai');
    assert(AI_PROVIDERS.gemini !== undefined, 'AI_PROVIDERS 应包含 gemini');
    assert(AI_PROVIDERS.custom !== undefined, 'AI_PROVIDERS 应包含 custom');

    // 测试各 provider 是否有必要的函数
    if (AI_PROVIDERS.claude) {
      assert(typeof AI_PROVIDERS.claude.buildHeaders === 'function', 'claude 应有 buildHeaders 函数');
      assert(typeof AI_PROVIDERS.claude.buildBody === 'function', 'claude 应有 buildBody 函数');
      assert(typeof AI_PROVIDERS.claude.parseResponse === 'function', 'claude 应有 parseResponse 函数');
    }
  } else {
    assert(false, 'AI_PROVIDERS 未定义');
  }

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// TASK_SLOT_DEFS 测试
// ═══════════════════════════════════════════════════════════════

function testTaskSlotDefs() {
  console.log('\n--- TASK_SLOT_DEFS 测试 ---');
  resetTests();

  if (typeof TASK_SLOT_DEFS !== 'undefined') {
    assert(TASK_SLOT_DEFS.default !== undefined, 'TASK_SLOT_DEFS 应包含 default');
    assert(TASK_SLOT_DEFS.document !== undefined, 'TASK_SLOT_DEFS 应包含 document');
    assert(TASK_SLOT_DEFS.contract !== undefined, 'TASK_SLOT_DEFS 应包含 contract');
    assert(TASK_SLOT_DEFS.vision !== undefined, 'TASK_SLOT_DEFS 应包含 vision');
    assert(TASK_SLOT_DEFS.advanced !== undefined, 'TASK_SLOT_DEFS 应包含 advanced');
  } else {
    assert(false, 'TASK_SLOT_DEFS 未定义');
  }

  printSummary();
  return failCount === 0;
}

// ═══════════════════════════════════════════════════════════════
// 运行所有测试
// ═══════════════════════════════════════════════════════════════

function runAllTests() {
  console.log('\n═══════════════════════════════════════');
  console.log('开始运行所有单元测试');
  console.log('═══════════════════════════════════════');

  const results = [];

  results.push({ name: 'STAGE 常量', passed: testStageConstants() });
  results.push({ name: '项目数据结构', passed: testProjectDataStructure() });
  results.push({ name: '格式化函数', passed: testFormatFunctions() });
  results.push({ name: 'getBoardColumn', passed: testGetBoardColumn() });
  results.push({ name: 'AI_PROVIDERS', passed: testAIProviders() });
  results.push({ name: 'TASK_SLOT_DEFS', passed: testTaskSlotDefs() });

  console.log('\n═══════════════════════════════════════');
  console.log('测试结果汇总');
  console.log('═══════════════════════════════════════');

  results.forEach(r => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.name}`);
  });

  const allPassed = results.every(r => r.passed);
  console.log('\n' + (allPassed ? '🎉 所有测试通过!' : '⚠️ 部分测试失败'));

  return allPassed;
}

// 导出到全局
window.runAllTests = runAllTests;
window.testStageConstants = testStageConstants;
window.testProjectDataStructure = testProjectDataStructure;
window.testFormatFunctions = testFormatFunctions;
window.testGetBoardColumn = testGetBoardColumn;
window.testAIProviders = testAIProviders;
window.testTaskSlotDefs = testTaskSlotDefs;

console.log('\n📋 单元测试已加载');
console.log('运行方式:');
console.log('  - runAllTests()  // 运行所有测试');
console.log('  - testStageConstants()  // 测试 STAGE 常量');
console.log('  - testAIProviders()  // 测试 AI_PROVIDERS');
console.log('  - testTaskSlotDefs()  // 测试 TASK_SLOT_DEFS');
console.log('');
