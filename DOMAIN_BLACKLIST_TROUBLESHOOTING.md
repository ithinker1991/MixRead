# 域名黑名单功能 - 故障排除指南

**问题**: 插件显示 `[DomainPolicy] Initialization failed` 错误

**状态**: 后端 API 正常运作 ✅，需要诊断前端问题

---

## 1️⃣ 查看详细错误日志

### 步骤 1: 打开 DevTools
```
1. 点击 MixRead 扩展图标，打开 popup
2. 按 F12 打开 DevTools
3. 点击 "Console" 标签页
```

### 步骤 2: 查找详细错误信息
```
在 Console 中寻找这些日志：
✓ [MixRead] [DomainPolicy] Store created...
✓ [MixRead] [DomainPolicy] Starting initialization...
✓ [MixRead] [DomainPolicy] Initialization result...
✓ [MixRead ERROR] [DomainPolicy] Initialization error... (错误信息会在这里)
```

### 步骤 3: 记下完整的错误信息
```
特别注意：
- currentUser 的值是什么？
- 错误是什么？
```

---

## 2️⃣ Logger 的日志位置

Logger 把所有日志打到浏览器的 **DevTools Console**，不是在其他地方。

**日志格式**:
```
[ISO-TIME] [MixRead] 消息内容
[ISO-TIME] [MixRead INFO] 信息
[ISO-TIME] [MixRead WARN] 警告
[ISO-TIME] [MixRead ERROR] 错误
[ISO-TIME] [MixRead DEBUG] 调试 (需要在localStorage中设置 mixread_debug)
```

**启用 DEBUG 日志** (可选):
```javascript
// 在 DevTools Console 中运行：
localStorage.setItem('mixread_debug', 'true')
// 然后刷新页面或重新点击扩展
```

---

## 3️⃣ 可能的问题和解决方案

### 问题 A: "currentUser is empty"
**症状**: 初始化时 currentUser 为空

**原因**: 用户还没有被创建或加载

**解决**:
1. 确保已创建至少一个用户
2. 在 popup 中选择一个用户
3. 重新打开 popup

### 问题 B: "HTTP 404" 或类似错误
**症状**: API 请求返回 404 或其他 HTTP 错误

**原因**: 后端没有正确的用户数据

**解决**:
```bash
# 检查用户是否存在
curl http://localhost:8000/users/user123

# 检查用户的黑名单
curl http://localhost:8000/users/user123/domain-policies/blacklist
```

### 问题 C: "apiClient is not defined"
**症状**: 错误提示 apiClient 未定义

**原因**: scripts/api-client.js 加载失败

**解决**:
1. 检查 popup.html 中是否加载了 api-client.js
2. 确保加载顺序正确（api-client.js 必须在 popup.js 之前）

### 问题 D: "DomainPolicyStore is not a constructor"
**症状**: 无法创建 DomainPolicyStore 实例

**原因**: 模块没有被正确加载

**解决**:
1. 检查 popup.html 中是否加载了 domain-policy-store.js
2. 确保在 popup.js 之前加载

---

## 4️⃣ 检查清单

### 代码加载
- [ ] popup.html 中加载了 api-client.js
- [ ] popup.html 中加载了 domain-policy-store.js
- [ ] popup.html 中加载了 popup.js
- [ ] 加载顺序正确（依赖项在前）

### 后端状态
- [ ] 后端运行在 http://localhost:8000
- [ ] 可以访问 `/health` 端点
- [ ] 存在用户数据

### 用户和存储
- [ ] 至少有一个用户被创建
- [ ] 选择了当前用户
- [ ] currentUser 不为空

### API 端点
- [ ] GET `/users/{user_id}/domain-policies/blacklist` 返回 200
- [ ] 响应包含 `success: true` 和 `blacklist_domains` 数组

---

## 5️⃣ 测试 API 端点

### 检查黑名单 API
```bash
curl http://localhost:8000/users/test_user/domain-policies/blacklist | jq .
```

**预期输出**:
```json
{
  "success": true,
  "blacklist_domains": [],
  "count": 0
}
```

### 添加测试域名
```bash
curl -X POST http://localhost:8000/users/test_user/domain-policies/blacklist \
  -H "Content-Type: application/json" \
  -d '{"domain": "github.com", "description": "Test domain"}'
```

**预期输出**:
```json
{
  "success": true,
  "message": "Domain added to blacklist"
}
```

---

## 6️⃣ 提高日志的详细程度

我已经改进了 popup.js 中的日志记录。现在你应该看到：

```
[MixRead] [DomainPolicy] Store created, currentUser: user123
[MixRead] [DomainPolicy] Starting initialization with userId: user123
[MixRead] [DomainPolicy] Initialization result: true
```

或者如果有错误：

```
[MixRead ERROR] [DomainPolicy] Initialization error: <detailed error message>
```

---

## 7️⃣ 常见错误消息解读

### "fetch failed"
- 后端没有运行
- 网络连接问题
- CORS 配置不对

### "Cannot read property 'blacklist_domains' of undefined"
- API 返回的数据格式不对
- API 端点返回 null 或错误响应

### "userId is undefined"
- currentUser 值为空
- 用户还没有被初始化

### "SyntaxError: Unexpected token"
- JSON 解析失败
- 后端返回的不是 JSON

---

## 8️⃣ 调试步骤

1. **重新加载扩展**:
   - chrome://extensions
   - 找到 MixRead
   - 点击"刷新"按钮

2. **清除存储和缓存**:
   ```javascript
   // 在 DevTools Console 中运行：
   localStorage.clear()
   ```

3. **检查网络请求**:
   - 打开 DevTools
   - 切换到 "Network" 标签
   - 打开 popup
   - 查看是否有 domain-policies 的 API 请求

4. **启用调试日志**:
   ```javascript
   localStorage.setItem('mixread_debug', 'true')
   ```

---

## 9️⃣ 获取帮助

如果问题仍未解决，请提供：

1. **完整的错误消息** (从 DevTools Console 复制)
2. **currentUser 的值** (是什么？是空吗？)
3. **后端日志** (如果有的话)
4. **网络请求的详情** (DevTools Network 标签)
5. **步骤 1-3 的结果** (什么时候开始出现错误?)

---

## 🔟 已知问题和修复

### 修复 #1: 改进初始化日志
- **提交**: 2c039db
- **改进**: 添加了更详细的初始化日志，便于诊断
- **效果**: 现在可以清楚地看到初始化的每个步骤

### 修复 #2: 添加错误处理包装
- **提交**: 2c039db
- **改进**: 在 initializeDomainManagement() 中添加 try-catch
- **效果**: 任何未被捕获的错误都会被记录

---

## 总结

**Logger 日志位置**: DevTools Console (F12)

**问题根源**: 通常是以下之一
- 后端 API 返回错误
- 用户 ID 为空
- 模块加载失败

**下一步**:
1. 打开 DevTools Console
2. 查看 `[DomainPolicy]` 相关的日志
3. 告诉我看到的具体错误
4. 我会根据错误内容提供针对性的修复

---

**更新时间**: 2025-12-02
**最后改进**: 添加详细的初始化日志和错误处理
