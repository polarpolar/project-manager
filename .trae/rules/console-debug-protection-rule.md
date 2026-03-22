# console.log 统一由 DEBUG 开关控制

## 触发条件

当代码中出现任何 console.log、console.error、console.warn、console.info 调用时强制应用本规范。

## 规范内容

文件中必须在 constants 模块顶部定义 const DEBUG = false。所有 console.\* 调用必须包裹在 if (DEBUG) 条件内，不允许裸写。

### 禁止示例

```javascript
console.log('数据加载成功', data);
console.error('请求失败', e);
```

### 正确示例

```javascript
if (DEBUG) console.log('数据加载成功', data);
if (DEBUG) console.error('请求失败', e);
```

## 实施要求

- 新增功能、修复 Bug、重构代码时，如果涉及到调试输出，必须检查所有新增和修改的 console.\* 是否都被 if (DEBUG) 包裹
- Review 时发现裸 console.\* 视为不通过

## 例外情况

面向用户的错误提示不使用 console，改用 showToast() 等 UI 反馈函数

## 检查方法

1. 搜索代码中的 console.\* 调用
2. 验证是否都被 if (DEBUG) 包裹
3. 确保 DEBUG 常量已在文件顶部定义

## 修复方法

1. 在文件顶部的 constants 模块中添加 DEBUG 常量定义
2. 为所有裸 console.\* 调用添加 if (DEBUG) 包裹
3. 对于面向用户的错误提示，改用 UI 反馈函数

