# 快速诊断参考指南

## 🚀 5 秒快速诊断

```
1. 按 F12 打开 DevTools
2. 点击 Console 标签页
3. 查找 [MixRead] 日志
4. 看是否有 ERROR 信息
5. 告诉我错误消息
```

---

## 📊 常见问题及日志

| 问题 | 你会看到 | 位置 | 原因 |
|------|---------|------|------|
| 设置初始化失败 | `[MixRead ERROR] Error loading settings: ...` | content.js:210-223 | 存储读取失败 |
| 单词保存失败 | `[MixRead ERROR] Error saving vocabulary: ...` | content.js:764-778 | 存储写入失败 |
| 会话记录失败 | `[MixRead ERROR] Error recording session: ...` | content.js:1197-1211 | 存储操作失败 |
| 域名初始化失败 | `[DomainPolicy] Initialization failed` | popup.js:691-716 | API 请求失败 |
| 扩展上下文失效 | `Extension context invalid` | 任何地方 | 扩展被重新加载 |

---

## ✅ 成功的日志示例

```
[MixRead] Settings loaded successfully
[MixRead] Vocabulary saved for word: example
[MixRead] Recorded 5 minutes of reading for 2025-12-02
[DomainPolicy] Store created, currentUser: user123
[DomainPolicy] Loaded 0 blacklist domains
```

---

## ❌ 失败的日志示例

```
[MixRead ERROR] Error loading settings: QuotaExceededError
[MixRead ERROR] Error saving vocabulary: Cannot read property 'xxx'
[MixRead ERROR] Error recording session: Extension context invalidated
[DomainPolicy] Initialization failed
[MixRead] Chrome storage error: NotSupported
```

---

## 🔍 诊断流程

### 如果看到 "[MixRead ERROR]"：

1. **记下完整错误信息**（冒号后面的内容）
2. **查看是哪一类错误**：
   - `QuotaExceededError` → 存储满了
   - `NotSupported` → 浏览器不支持
   - `Cannot read property` → 数据格式问题
   - `Extension context invalidated` → 扩展被重新加载

3. **告诉我**：
   - 完整的错误消息
   - 是在什么操作时出现的
   - 是否在操作过程中刷新了扩展

### 如果看到 "[DomainPolicy] Initialization failed"：

1. 查找详细错误日志（应该在附近）
2. 记下 currentUser 的值
3. 检查 API 是否返回 404 或其他错误

### 如果什么都看不到：

1. 重新加载扩展 (chrome://extensions 刷新)
2. 刷新网页
3. 打开 F12 DevTools
4. 再看一遍 Console

---

## 🛠️ 快速解决方案

### 问题：存储满了 (QuotaExceededError)

```javascript
// 在 DevTools Console 中运行：
chrome.storage.local.clear();
// 然后刷新页面
```

### 问题：数据格式不对 (Cannot read property)

```javascript
// 检查存储内容：
chrome.storage.local.get(null, console.log);

// 如果有问题，清理：
chrome.storage.local.clear();
```

### 问题：扩展被重新加载

```
这是正常的，重新加载扩展或刷新页面即可
```

---

## 📋 检查清单

- [ ] 重新加载扩展 (chrome://extensions 刷新)
- [ ] 打开 DevTools (F12)
- [ ] 查看 Console 标签页
- [ ] 搜索 "[MixRead" 查找日志
- [ ] 记下任何 ERROR 信息
- [ ] 如果没有 ERROR，说明初始化成功了

---

## 📂 完整诊断指南位置

1. **存储初始化问题**：`STORAGE_INITIALIZATION_DEBUG.md`
2. **域名黑名单问题**：`DOMAIN_BLACKLIST_TROUBLESHOOTING.md`
3. **扩展上下文问题**：`CRITICAL_CALLBACK_ERROR_FIX.md`

---

## 💬 告诉我信息的模板

请按这个格式告诉我你看到的内容：

```
错误信息：[完整的 [MixRead] 日志]
操作：[你在做什么时看到的]
时机：[重新加载后立即看到/操作时看到/没有看到]
其他：[任何其他有用的信息]
```

---

## ⏱️ 预期的初始化时间

1. **扩展加载**：< 1 秒
2. **页面加载时的设置初始化**：< 100 ms
3. **popup 加载**：< 500 ms
4. **域名黑名单初始化**：< 1 秒

如果超过这些时间，可能有问题。

---

**最后更新**：2025-12-02
**用处**：快速诊断和参考
**相关文件**：content.js, popup.js, STORAGE_INITIALIZATION_DEBUG.md

