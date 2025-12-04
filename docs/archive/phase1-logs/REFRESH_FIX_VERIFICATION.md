# 刷新后单词仍在问题 - 修复验证

## ❌ 问题原因

之前的实现有执行顺序问题：

```
init() 执行
  1. loadPageData() → 从缓存恢复单词 ✓
  2. attachEventListeners() → 注册 pageshow 监听器
  ↓
后来 pageshow 触发
  3. pageshow (persisted=false) → 尝试清空单词

问题：单词已经在步骤1恢复了，步骤3清空无效！
```

## ✅ 修复方案

改变 `loadPageData()` 的逻辑：

```
修复前：
loadPageData() {
  从缓存恢复单词 → 问题源头
}

修复后：
loadPageData() {
  只初始化缓存键，不恢复单词
  wordState = {} (空)
}

然后 pageshow 决定：
pageshow (persisted=true) {
  // BFCache: 变量本身被保留，renderWordList()即可
  this.renderWordList();
}

pageshow (persisted=false) {
  // 新加载: 清空（其实已经是空的）
  this.wordState = {};
  this.renderWordList();
}
```

## 🔑 关键理解

### BFCache 时变量的保留

当页面进入 BFCache：
```javascript
// 在 Tab A 上：
this.wordState = { word1: {...}, word2: {...} }

// 用户后退到 Tab A
// pageshow (persisted=true)
→ this.wordState 仍然在内存中！
  本来还是 { word1: {...}, word2: {...} }
→ 无需从存储恢复
→ 只需 renderWordList() 重新渲染
```

### F5 刷新时的流程

```
F5刷新 → beforeunload
  ↓
页面卸载 → JavaScript 全部清理
  ↓
新页面加载 → init() 执行
  ↓
loadPageData() → this.wordState = {} (此时为空，正确)
  ↓
pageshow (persisted=false) → 确认清空
  → this.wordState = {}; renderWordList();
  ↓
结果：sidebar 为空 ✓
```

## 🧪 验证步骤

### 测试1: F5刷新（关键）

```
1. 访问 https://medium.com
2. 等待高亮，记录 sidebar 单词数 (例: 5)
3. 按 F5 刷新

预期结果：
✓ Console 显示: "[SidebarPanel] Page loaded fresh - clearing wordState"
✓ Sidebar 显示为空
✓ 新页面加载后，显示新的单词（不是之前的5个）

验证：
[ ] Console 显示 pageshow (persisted=false)
[ ] Sidebar 先清空后显示新单词
[ ] 新单词数不同（证明是新内容）
```

### 测试2: 后退（BFCache）

```
1. 访问 https://medium.com
2. 等待高亮，记录单词数 (例: 7)
3. 点击链接去新页面
4. 点击后退

预期结果：
✓ Console 显示: "[SidebarPanel] Page restored from bfcache"
✓ Sidebar 显示回原来的 7 个单词（无需重新加载）
✓ 转换速度非常快 (<100ms)

验证：
[ ] Console 显示 pageshow (persisted=true)
[ ] Sidebar 立即显示之前的单词（没有闪烁）
[ ] 速度很快（秒级恢复）
```

### 测试3: 后退无BFCache

```
某些网站可能不支持BFCache，此时：

1. 访问页面
2. 导航走
3. 后退

预期结果：
✓ Console 显示: "[SidebarPanel] Page loaded fresh"
✓ pageshow (persisted=false)
✓ Sidebar 清空然后重新加载
✓ 速度较慢（1-2秒）

验证：
[ ] Console 显示 pageshow (persisted=false)
[ ] 页面完整重新加载（不是从缓存）
```

### 测试4: SPA 导航

```
1. 访问 https://twitter.com
2. 等待高亮，记录单词数 (例: 8)
3. 点击推文（SPA导航）

预期结果：
✓ Console 显示: "pushState detected"
✓ Console 显示: "SPA navigation detected - continuing to accumulate"
✓ Sidebar 显示更多单词（例: 12）
✓ 之前的 8 个单词仍然存在

验证：
[ ] Console 显示 pushState detected
[ ] Sidebar 单词数增加（不是清空）
[ ] 旧单词仍可见
```

## 📊 预期的 Console 输出

### 场景：F5刷新

```
[SidebarPanel] Initialized cache key: tab_123 (tabId: 123)
[SidebarPanel] Ready to receive words from highlight API
[SidebarPanel] pageshow event: { persisted: false }
[SidebarPanel] Page loaded fresh - clearing wordState for fresh session

[当新单词高亮时]
[SidebarPanel] Adding 4 new words
```

### 场景：后退（BFCache）

```
[SidebarPanel] pageshow event: { persisted: true }
[SidebarPanel] Page restored from bfcache - keeping wordState
```

### 场景：SPA导航

```
[SidebarPanel] pushState detected - marking as SPA navigation
[SidebarPanel] SPA navigation detected - continuing to accumulate words
[SidebarPanel] Adding 3 new words
```

## ✅ 验证清单

```
[ ] F5刷新时，sidebar 从有单词 → 空 → 新单词
[ ] 后退（BFCache）时，sidebar 立即显示之前的单词
[ ] 后退（无BFCache）时，sidebar 清空后重新加载
[ ] SPA导航时，sidebar 累积单词
[ ] Console 日志符合预期
[ ] 执行速度正确（BFCache 快，全加载 慢）
```

## 🔍 如果仍有问题

### 症状：F5 后单词仍在

**调试步骤**：
```javascript
// 在 DevTools Console 执行
console.log('Current wordState:', window.sidebarPanel?.wordState);
// 应该显示 {}（空对象）而不是有单词
```

**检查项**：
1. `pageshow` 事件是否真的触发了？
   - 在 F12 Console 中查找 "pageshow event"
   - 确认 persisted 值

2. `loadPageData()` 是否在 `pageshow` 之前执行？
   - 查看日志顺序
   - 如果看不到 "Ready to receive words"，说明 loadPageData 没执行

3. `attachEventListeners()` 是否在 `loadPageData()` 之前？
   - 检查 init() 方法中的顺序
   - 应该是：attachEventListeners → loadPageData

### 症状：后退（BFCache）时单词消失

**问题分析**：
```javascript
// BFCache 时，this.wordState 应该在内存中保持
// 如果消失了，说明：
1. BFCache 没有工作（查看 persisted=false）
2. 有代码清空了 wordState
3. 页面完整重新加载（应该看到 persisted=false）
```

## 💡 设计思路总结

新的设计完全依赖 `pageshow` 事件的 `persisted` 标志：

```
persisted=true  → BFCache 恢复
  ↓
JavaScript 变量完整保留在内存
  ↓
只需 renderWordList() 刷新 UI
  ↓
无需从存储恢复（已经在内存中）

---

persisted=false → 新加载
  ↓
JavaScript 从零开始
  ↓
this.wordState = {} (自动为空)
  ↓
等待 highlight API 返回新单词
```

这样设计的好处：
- ✅ 简洁：不需要缓存恢复逻辑
- ✅ 准确：100% 信任 BFCache 机制
- ✅ 可靠：不会有时序问题

