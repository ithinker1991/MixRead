# 存储初始化失败诊断指南

**错误**: `初始化存储失败` / Storage initialization failed
**堆栈跟踪**: content.js 第 40, 1196, 1217 行
**状态**: 已改进错误日志记录，现在可以清晰诊断问题

---

## 🔍 问题概述

你看到的错误来自以下三个地方中的任何一个：

1. **设置初始化** (第 207-225 行)
   - 加载 difficultyLevel, vocabulary, showChinese

2. **单词保存** (第 763-779 行)
   - 保存新加入词汇表的单词

3. **阅读会话记录** (第 1196-1213 行)
   - 记录用户的阅读时间

---

## 📋 错误消息位置

打开 DevTools Console (F12) 后，查找以下日志：

### ✅ 成功的日志
```
[MixRead] Settings loaded successfully
[MixRead] Recorded X minutes of reading for 2025-12-02
[MixRead] Vocabulary saved for word: xxx
```

### ❌ 错误的日志
```
[MixRead ERROR] Error loading settings: ...
[MixRead ERROR] Error recording session: ...
[MixRead ERROR] Error saving vocabulary: ...
[MixRead] Chrome storage error: ...
[MixRead] Storage callback error: ...
```

---

## 🚀 诊断步骤

### 步骤 1: 重新加载扩展
```
1. 打开 chrome://extensions
2. 找到 MixRead
3. 点击"刷新"按钮
4. 重新访问任何网页
```

### 步骤 2: 打开 DevTools
```
1. 按 F12 打开 DevTools
2. 点击 "Console" 标签页
3. 清除之前的日志（可选）
```

### 步骤 3: 触发存储操作
根据你想诊断的操作：

**诊断设置初始化**:
- 刷新页面，观察日志
- 应该看到 `Settings loaded successfully` 或错误

**诊断单词保存**:
- 右键点击一个单词，选择 "Mark as unknown"
- 查看 Console 中是否有 `Vocabulary saved` 或错误

**诊断会话记录**:
- 浏览网页至少 1 分钟
- 关闭标签页或使用 beforeunload 触发
- 查看 Console 中是否有 `Recorded X minutes` 或错误

### 步骤 4: 查看完整错误信息

如果看到错误，右键点击错误消息，选择 "Show source" 或展开详情：

```
❌ [MixRead ERROR] Error loading settings:
   TypeError: Cannot read property 'difficultyLevel' of undefined
```

记下完整的错误信息。

---

## 🛠️ 常见错误及解决方案

### 错误 #1: "Cannot read property 'xxx' of undefined"

**原因**: ChromeAPI.storage.get() 返回了空对象或 undefined

**症状**:
```
[MixRead ERROR] Error loading settings: Cannot read property 'difficultyLevel' of undefined
```

**解决方案**:
1. 检查存储中是否有数据：
```javascript
// 在 DevTools Console 中运行：
chrome.storage.local.get(null, (result) => console.log(result));
```

2. 如果存储为空，这是正常的（首次使用）
3. 如果应该有数据，检查扩展权限

### 错误 #2: "Extension context invalidated"

**原因**: 扩展上下文在操作过程中失效（通常是扩展重新加载）

**症状**:
```
[MixRead] Extension context invalid, skipping storage.get
或
[MixRead ERROR] Storage callback error: Extension context invalidated
```

**解决方案**:
1. 检查是否在操作过程中刷新了扩展
2. 这是正常的行为，代码已经处理
3. 重新加载扩展或刷新页面

### 错误 #3: "Chrome storage error: ..."

**原因**: chrome.storage.local API 调用失败

**症状**:
```
[MixRead] Chrome storage error: QuotaExceededError
或
[MixRead] Chrome storage error: NotSupported
```

**解决方案**:

如果是 `QuotaExceededError`:
```javascript
// 检查存储大小（在 DevTools Console 中）：
chrome.storage.local.getBytesInUse((bytes) => {
  console.log('Storage used:', bytes, 'bytes');
  console.log('Storage limit: 10485760 bytes (~10MB)');
});

// 清理不需要的数据
chrome.storage.local.clear();
```

如果是 `NotSupported`:
- 检查浏览器是否在隐私模式
- 检查扩展是否有 `storage` 权限（manifest.json）

---

## 📊 存储数据格式

### 应该保存的数据结构

```javascript
{
  // 设置
  difficultyLevel: "B1",
  showChinese: true,

  // 词汇
  vocabulary: ["word1", "word2", ...],
  vocabulary_dates: {
    "word1": "2025-12-02",
    "word2": "2025-12-01"
  },

  // 用户和会话
  mixread_users: ["user1", "user2"],
  mixread_current_user: "user1",
  reading_sessions: {
    "2025-12-02": 45,  // 分钟
    "2025-12-01": 30
  }
}
```

### 检查存储内容
```javascript
// 在 DevTools Console 中运行：
chrome.storage.local.get(null, (result) => {
  console.table(result);
});
```

---

## 🐛 Debug 日志启用

启用详细的 DEBUG 日志：
```javascript
// 在 DevTools Console 中运行：
localStorage.setItem('mixread_debug', 'true');

// 然后刷新页面或重新打开 popup
```

这样会输出额外的 `[MixRead DEBUG]` 日志，帮助诊断问题。

---

## 🔧 改进的错误处理

最近的改进添加了以下三处的错误处理：

### 1️⃣ 设置初始化 (lines 210-223)
```javascript
ChromeAPI.storage.get(
  ["difficultyLevel", "vocabulary", "showChinese"],
  (result) => {
    try {
      // 加载逻辑
      console.log('[MixRead] Settings loaded successfully');
    } catch (error) {
      console.error('[MixRead] Error loading settings:', error);
    }
  }
);
```

### 2️⃣ 单词保存 (lines 764-778)
```javascript
ChromeAPI.storage.get(["vocabulary_dates"], (result) => {
  try {
    // 保存逻辑
    console.debug('[MixRead] Vocabulary saved for word:', wordLower);
  } catch (error) {
    console.error('[MixRead] Error saving vocabulary:', error);
  }
});
```

### 3️⃣ 会话记录 (lines 1197-1211)
```javascript
ChromeAPI.storage.get(["reading_sessions"], (result) => {
  try {
    // 记录逻辑
    console.log('[MixRead] Recorded X minutes of reading...');
  } catch (error) {
    console.error('[MixRead] Error recording session:', error);
  }
});
```

---

## 📈 检查清单

- [ ] 打开 DevTools Console (F12)
- [ ] 重新加载扩展 (chrome://extensions 刷新)
- [ ] 执行导致错误的操作
- [ ] 查找 `[MixRead ERROR]` 消息
- [ ] 记下完整的错误信息
- [ ] 检查存储内容 (`chrome.storage.local.get(null, ...)`)
- [ ] 检查存储使用量是否超过限制
- [ ] 确认扩展有 `storage` 权限

---

## 💾 手动清理存储（如果需要）

```javascript
// 在 DevTools Console 中运行：

// 清理所有存储
chrome.storage.local.clear(() => {
  console.log('Storage cleared');
});

// 或清理特定项
chrome.storage.local.remove(['vocabulary', 'reading_sessions'], () => {
  console.log('Specific items removed');
});
```

---

## 📞 获取帮助

如果问题仍未解决，请提供：

1. **完整的错误消息** (从 DevTools Console 复制)
2. **步骤 3 之前发生了什么**
3. **存储内容** (运行 `chrome.storage.local.get(null, console.log)`)
4. **扩展版本** (chrome://extensions)
5. **浏览器版本** (Chrome 菜单 → 关于 Chrome)

---

## 📝 相关文件

- `frontend/content.js` - 包含存储操作的主脚本
- `frontend/popup.js` - popup 中的存储操作
- `frontend/scripts/api-client.js` - API 调用
- `DOMAIN_BLACKLIST_TROUBLESHOOTING.md` - 域名相关问题

---

**最后更新**: 2025-12-02
**改进**: 添加了三处存储操作的错误处理
**状态**: 现在所有存储错误都会被正确记录和报告

