# 调试指南 - 悬停没有显示定义

## 🐛 问题：单词高亮了，但点击/悬停没有显示定义

这个问题通常有以下几个原因：

### 1. 检查浏览器控制台错误

**步骤**:
1. 在有高亮单词的页面按 **F12**
2. 点击 **Console** 标签
3. 点击一个高亮的单词
4. 查看是否有红色错误信息

**常见错误**:

#### 错误 1: "Failed to fetch" 或 "net::ERR_CONNECTION_REFUSED"
```
Failed to fetch http://localhost:8000/word/...
```

**原因**: 后端未运行或端口错误

**解决**:
```bash
# 检查后端
curl http://localhost:8000/health

# 如果失败，重启后端
cd backend
source venv/bin/activate
python main.py
```

#### 错误 2: CORS 错误
```
Access to fetch at 'http://localhost:8000/...' from origin 'chrome-extension://...'
has been blocked by CORS policy
```

**原因**: 后端 CORS 配置问题

**解决**: 检查 `backend/main.py` 中的 CORS 配置（应该已经配置好）

#### 错误 3: "Cannot read property of undefined"
```
TypeError: Cannot read property 'definition' of undefined
```

**原因**: API 响应格式不匹配

**解决**: 检查 content.js 和 background.js 的数据处理

---

### 2. 检查事件绑定

content.js 中的点击事件可能没有正确绑定。

**快速测试**:
在浏览器控制台运行：
```javascript
// 检查高亮元素是否存在
document.querySelectorAll('.mixread-highlight').length
// 应该返回 > 0

// 检查事件监听器
document.querySelectorAll('.mixread-highlight')[0].onclick
// 应该返回一个函数
```

---

### 3. 检查后端 API

**测试后端是否返回数据**:
```bash
# 测试单个单词
curl http://localhost:8000/word/beautiful

# 应该返回类似:
# {
#   "word": "beautiful",
#   "found": true,
#   "cefr_level": "A1",
#   "pos": "adjective",
#   "definition": "...",
#   "example": "..."
# }
```

---

### 4. 检查 Service Worker

**步骤**:
1. 打开 `chrome://extensions`
2. 找到 MixRead
3. 点击 "检查视图：Service Worker"
4. 在新窗口的 Console 中查看错误

---

### 5. 常见修复方案

#### 方案 1: 重新加载扩展
```
chrome://extensions → 找到 MixRead → 点击刷新图标 🔄
刷新测试页面
```

#### 方案 2: 检查 content.js 是否正确注入
在页面控制台运行:
```javascript
// 应该看到 MixRead 的代码
console.log('MixRead loaded:', typeof showTooltip)
```

#### 方案 3: 清除缓存重试
```
Cmd+Shift+Delete → 清除缓存
重新加载页面
```

---

## 🔍 逐步调试流程

### Step 1: 验证后端运行
```bash
curl http://localhost:8000/health
# 必须返回: {"status":"ok","words_loaded":6860}
```

### Step 2: 测试 API 端点
```bash
curl http://localhost:8000/word/beautiful
# 必须返回单词信息
```

### Step 3: 检查页面控制台
- F12 → Console
- 点击高亮单词
- 看是否有错误

### Step 4: 检查 Service Worker 控制台
- chrome://extensions
- MixRead → 检查视图：Service Worker
- 看是否有错误

### Step 5: 检查网络请求
- F12 → Network 标签
- 点击高亮单词
- 看是否有请求发出
- 检查请求状态（应该是 200）

---

## 🛠️ 调试步骤（已添加日志）

**最新版本的 content.js 已经包含调试日志**。按照以下步骤查看：

### 步骤 1: 重新加载扩展
```
1. 打开 chrome://extensions
2. 找到 MixRead
3. 点击刷新图标 🔄
```

### 步骤 2: 打开测试页面并查看控制台
```
1. 打开 frontend/test.html（或任意英文网页）
2. 按 F12 打开开发者工具
3. 点击 Console 标签
4. 点击一个黄色高亮的单词
```

### 步骤 3: 分析控制台输出

你应该看到以下日志之一：

**情况 A: 点击事件没有触发**
- 没有任何 `[MixRead]` 日志
- **原因**: 事件监听器未绑定
- **解决**: 检查扩展是否正确加载

**情况 B: 点击事件触发，但没有响应**
```
[MixRead] Click event triggered for word: beautiful
[MixRead] showTooltip called with word: beautiful
```
- **原因**: chrome.runtime.sendMessage 可能失败
- **解决**: 检查 Service Worker（下一步）

**情况 C: 收到响应，但 success=false**
```
[MixRead] Click event triggered for word: beautiful
[MixRead] showTooltip called with word: beautiful
[MixRead] Received response: {success: false, error: "..."}
[MixRead] Error getting word info: ...
```
- **原因**: 后端 API 错误
- **解决**: 检查后端日志

**情况 D: 正常工作**
```
[MixRead] Click event triggered for word: beautiful
[MixRead] showTooltip called with word: beautiful
[MixRead] Received response: {success: true, word_info: {...}}
[MixRead] Creating tooltip with word info: {...}
```
- 应该看到 tooltip 弹窗

### 步骤 4: 检查 Service Worker 日志

如果步骤 3 显示没有收到响应：

```
1. chrome://extensions
2. 找到 MixRead
3. 点击 "检查视图: Service Worker"
4. 在新窗口的 Console 中查看错误
```

可能看到的错误：
```
Error in handleGetWordInfo: Failed to fetch
```
→ 后端未运行，回到第一步检查后端

---

## 💡 最可能的原因

根据经验，最常见的原因是：

1. **后端未运行** (80% 的情况)
   - 检查: `curl http://localhost:8000/health`
   - 修复: 重启后端

2. **扩展未重新加载** (15% 的情况)
   - 修复: chrome://extensions → 刷新扩展

3. **事件绑定问题** (5% 的情况)
   - 需要检查 content.js 代码

---

## 🚨 如果还是不行

请提供以下信息：

1. 浏览器控制台的完整错误信息
2. Service Worker 控制台的错误（如果有）
3. Network 标签中的请求状态
4. `curl http://localhost:8000/health` 的输出

这样我可以更准确地定位问题。
