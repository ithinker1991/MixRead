# 快速刷新问题验证 - 2分钟

## 🚀 快速测试步骤

### 准备 (30秒)

```
1. 重新加载扩展：chrome://extensions → 点击刷新按钮
2. 打开任意网页：https://medium.com
3. 打开 DevTools：F12 → Console 标签
4. 保持 Console 可见
```

### 测试1：F5刷新 (1分钟)

```
Action 1: 等待高亮加载
  预期：Sidebar 显示单词（例如 5 个）
  确认：[SidebarPanel] Adding X new words

Action 2: 按 F5 刷新
  预期：
    ✓ [SidebarPanel] Page loaded fresh - clearing wordState
    ✓ Sidebar 变空
    ✓ 新单词出现（数量可能不同）

实际结果：
[ ] Sidebar 清空了
[ ] 新单词出现了
[ ] 旧单词没有出现

问题症状（如果有）：
[ ] Sidebar 仍显示刷新前的单词 → FAIL
[ ] Sidebar 同时显示新旧单词混合 → FAIL
```

### 测试2：后退 (30秒)

```
准备：
1. 在刚才的页面点击任何链接
2. 等待新页面加载

Action: 点击后退按钮 ⬅️
  预期：
    ✓ [SidebarPanel] Page restored from bfcache - keeping wordState
    ✓ Sidebar 快速恢复为原来的单词
    ✓ 无闪烁

实际结果：
[ ] Sidebar 快速恢复（<1秒）
[ ] 显示之前的单词
[ ] 没有额外加载

问题症状：
[ ] Sidebar 清空了 → 检查 persisted 值
```

## 📊 关键 Console 输出

### 正确的 F5 刷新：

```
[SidebarPanel] Initialized cache key: tab_123 (tabId: 123)
[SidebarPanel] Ready to receive words from highlight API

[SidebarPanel] Received NEW_WORDS_HIGHLIGHTED: 5 words
[SidebarPanel] Adding 5 new words

[用户按 F5]

[SidebarPanel] beforeunload event - page is about to reload
[SidebarPanel] pagehide event: { persisted: false }
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState for fresh session

[新页面高亮完成]
[SidebarPanel] Received NEW_WORDS_HIGHLIGHTED: 4 words
[SidebarPanel] Adding 4 new words
```

### 正确的后退（BFCache）：

```
[SidebarPanel] pagehide event: { persisted: true }
[SidebarPanel] Page entering bfcache - state will be preserved

[用户点击后退]

[SidebarPanel] pageshow event: { persisted: true }
[SidebarPanel] Page restored from bfcache - keeping wordState
```

## ✅ Pass/Fail 判定

**PASS** if:
- ✓ F5 刷新后 sidebar 显示新单词（不是旧单词）
- ✓ 后退时 sidebar 快速恢复
- ✓ Console 显示 "Page loaded fresh" 或 "restored from bfcache"

**FAIL** if:
- ✗ F5 刷新后仍显示旧单词
- ✗ 后退时 sidebar 消失或加载缓慢
- ✗ 没有看到 pageshow 日志

## 🔧 故障排除

### 如果 F5 后仍有旧单词：

1. 检查 Console 是否显示：
   ```
   [SidebarPanel] Page loaded fresh - clearing wordState
   ```

   - 如果没有 → loadPageData() 可能有问题
   - 如果有 → 检查后续是否有新单词加载

2. 手动检查 wordState：
   ```javascript
   // 在 F5 后，在 Console 执行：
   console.log('wordState:', window.sidebarPanel?.wordState);
   // 应该显示 {} (空对象)
   // 如果显示有单词，说明清空没有工作
   ```

### 如果看不到 pageshow 日志：

1. 检查 setupURLChangeListener() 是否被调用
2. Verify attachEventListeners() 成功执行
3. 检查是否有 Chrome 扩展权限问题

## 📝 测试记录

**测试日期**: _______________
**浏览器版本**: _______________

**F5 刷新测试**:
- [ ] PASS
- [ ] FAIL
- 现象: _______________

**后退测试**:
- [ ] PASS
- [ ] FAIL
- 现象: _______________

**总体结论**:
- [ ] 修复成功，刷新问题解决
- [ ] 修复不完整，仍有问题

