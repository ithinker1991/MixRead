# 批量标记面板增量更新 - 测试指南

## 功能描述

当Feed流加载新内容时，批量标记面板会自动增量更新，显示新高亮的单词，而不需要关闭和重新打开面板。

## 实现原理

### 数据流

```
Feed加载新内容
  ↓
MutationObserver检测到新DOM节点
  ↓
highlightDynamicContent() 处理新词汇
  ↓
notifyPanelOfNewWords() 发送 NEW_WORDS_HIGHLIGHTED 消息
  ↓
Panel监听消息 (startListeningForNewWords)
  ↓
addNewHighlightedWords() 增量更新panel
  ↓
重新分组、重新渲染、更新统计
```

### 核心改动

1. **content.js:1788** - 在highlightDynamicContent完成后调用notifyPanelOfNewWords()
2. **batch-marking-panel.js:565** - open()时启动消息监听
3. **batch-marking-panel.js:583** - close()时停止消息监听
4. **batch-marking-panel.js:591-630** - 新增监听器启动/停止方法
5. **batch-marking-panel.js:636-683** - 新增增量更新方法

## 测试步骤

### 准备工作
```bash
# 1. 启动后端服务
cd backend && python main.py

# 2. 加载未打包的扩展
chrome://extensions → Load unpacked → 选择frontend目录

# 3. 打开一个支持Feed流的网站
# 推荐使用Hacker News, Twitter, Medium等
```

### 测试场景1: 基础增量更新

1. **打开测试页面**
   - 访问任意English文章页面
   - 打开DevTools (F12) → Console

2. **打开批量标记面板**
   - 点击MixRead扩展图标
   - 点击"页面单词"按钮打开面板
   - 记录当前显示的单词总数（如：20个单词）

3. **模拟Feed加载新内容**
   - 在页面下方插入新内容（可以复制现有内容）
   - 或者滚动到页面底部加载更多内容

4. **验证增量更新**
   - 观察面板中的词汇列表是否自动增加
   - 检查"页面单词"统计数字是否更新
   - 查看Console日志：
     ```
     [MixRead] Notifying panel of X new highlighted words
     [BatchMarkingPanel] Received NEW_WORDS_HIGHLIGHTED with X words
     [BatchMarkingPanel] Panel updated: +X new words, Y updated, total Z
     ```

### 测试场景2: 重复词汇的计数更新

1. **打开面板**并记录某个词汇的出现次数（如："important" 出现3次）

2. **插入包含相同词汇的新内容**

3. **验证词汇计数更新**
   - 该词汇的计数应该增加
   - Console应显示：`Updated word "important" count from 3 to 5`
   - 词汇可能会从低频组移动到高频组

### 测试场景3: 打开面板后关闭再打开

1. **打开面板** → 记录词汇列表

2. **关闭面板** (点击×按钮)

3. **加载新内容** (这时面板已关闭)

4. **重新打开面板**
   - 应该看到所有词汇已更新（包括动态加载的）

### 测试场景4: 边界情况

#### 场景4a: 面板关闭时不应监听
- 关闭面板
- 加载新内容
- 重新打开面板
- 确认新词汇被正确加载（不会重复监听）

#### 场景4b: 快速连续加载多个内容块
- 面板保持打开
- 快速添加多个内容块（模拟快速滚动）
- 验证面板能正确处理多个NEW_WORDS_HIGHLIGHTED消息

## 验证清单

在提交前确保：

- [ ] Console中没有红色错误信息
- [ ] 面板打开时能看到"[MixRead] Notifying panel of X new highlighted words"日志
- [ ] 面板关闭时消息监听器被正确移除（无多重监听）
- [ ] 新词汇自动出现在面板中，无需刷新
- [ ] 词汇分组（高频/中频/低频）自动更新
- [ ] 统计数字（"X个高亮单词"）实时更新
- [ ] 面板不会闪烁或跳动（应该是平滑的增量更新）
- [ ] 在HTTPS和HTTP页面都能工作

## 故障排查

### 问题1: 面板没有更新

**原因排查：**
1. 检查Chrome DevTools → Console是否有错误
2. 确认highlightDynamicContent被调用：搜索"[MixRead] Dynamic query returned"
3. 检查notifyPanelOfNewWords是否被调用：搜索"[MixRead] Notifying panel"
4. 检查消息监听是否启动：搜索"startListeningForNewWords"

**解决方案：**
```javascript
// 在Console执行检查
batchMarkingPanel.isOpen  // 应该返回true
batchMarkingPanel.messageListener  // 应该是一个函数
Object.keys(batchMarkingPanel.wordFrequency).length  // 应该 > 0
```

### 问题2: 重复监听导致多次更新

**检查：**
```javascript
// 在Console执行
chrome.runtime.onMessage.hasListener(...)  // 检查是否有多个监听器
```

**解决方案：**
- 确保close()正确调用了stopListeningForNewWords()
- 检查messageListener是否被正确清空

### 问题3: 词汇计数不正确

**原因：**
- addNewHighlightedWords()中的去重逻辑有问题
- 词汇的大小写处理不一致

**调试：**
```javascript
// 在addNewHighlightedWords中添加临时日志
console.log('Before:', this.wordFrequency);
console.log('New words:', newWordsMap);
console.log('After:', this.wordFrequency);
```

## 性能考虑

- 每次动态加载只处理新词汇，不重新扫描整个DOM
- 消息监听仅在面板打开时启动
- 重新分组和渲染是必要的，但仅影响面板UI，不影响主页面

## 相关代码位置

| 文件 | 位置 | 功能 |
|------|------|------|
| content.js | 1803-1854 | notifyPanelOfNewWords() 函数 |
| content.js | 1788 | 调用通知函数 |
| batch-marking-panel.js | 591-613 | startListeningForNewWords() |
| batch-marking-panel.js | 618-630 | stopListeningForNewWords() |
| batch-marking-panel.js | 636-683 | addNewHighlightedWords() |
| batch-marking-panel.js | 565 | open()中的启动 |
| batch-marking-panel.js | 583 | close()中的停止 |
