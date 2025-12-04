# CORS 问题解决方案详解

## 问题现象

```
Access to fetch at 'http://localhost:8000/users/...' from origin
'https://www.claude.com' has been blocked by CORS policy:
The value of the 'Access-Control-Allow-Origin' header in the response
must not be the wildcard '*' when the request's credentials mode is 'include'.
```

---

## 根本原因分析

### 什么是 CORS？

CORS (Cross-Origin Resource Sharing) 是浏览器的安全机制，用于控制来自不同域名的请求。

```
域名A (https://www.claude.com)
        ↓ 发送请求
域名B (http://localhost:8000)
```

### CORS 的三种模式

| 模式 | 发送凭证 | CORS 响应头 | 用途 |
|------|--------|----------|------|
| **no-credentials** (默认) | ❌ 不发送 cookie | 可以用 `*` | 公开 API |
| **same-origin** | ✅ 发送 cookie | 必须明确指定源 | 同域请求 |
| **include** | ✅ 发送 cookie | 必须明确指定源 | 跨域认证 |

### 问题的发生

**原始代码**：

```javascript
const options = {
  mode: 'cors',
  credentials: 'include',  // ← 告诉浏览器：发送 cookie
};
```

**后端的 CORS 配置**：

```python
CORSMiddleware(
    allow_origins=["*"],  # ← 通配符，表示允许任何域名
    allow_credentials=True,
)
```

**浏览器的反应**：

```
❌ 错误！你说要发送凭证 (credentials: 'include')
但又说允许任何域名 (allow_origins: ["*"])
这两个不兼容！
```

**原因**：出于安全考虑，浏览器规定：
- 如果要发送凭证（cookie），必须明确指定允许哪些域名
- 不能使用通配符 `*`（因为通配符意味着"任何域名都可以"）

---

## 解决方案对比

### 方案 A: 移除凭证标记 ✅ (我采用的)

**修改代码**：

```javascript
// 删除这一行：
// credentials: 'include',

const options = {
  mode: 'cors',
  // 凭证模式默认为 'omit'（不发送）
};
```

**后端无需修改**：

```python
CORSMiddleware(
    allow_origins=["*"],  # 保持不变
    allow_credentials=True,  # 保持不变
)
```

**原理**：

```
前端: 不发送凭证 (credentials: omit/default)
      ↓
后端: 可以使用通配符 (allow_origins: ["*"])
      ↓
浏览器: ✅ 兼容！
```

**优点**：
- ✅ 简单、快速
- ✅ 不需要修改后端
- ✅ 适用于无认证的 API（大多数情况）
- ✅ 可在任何域名上工作

**缺点**：
- ❌ 如果将来需要发送 cookie，需要重新配置

**适用场景**：
- ✅ 公开 API（不需要认证）
- ✅ 使用 token 认证（Authorization header）
- ✅ 本地开发
- ✅ 跨域公开资源

---

### 方案 B: 后端指定具体域名

**修改后端**（不动前端）：

```python
CORSMiddleware(
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:8001",
        "https://www.claude.com",
        "https://claude.com",
        # ... 其他允许的域名
    ],
    allow_credentials=True,  # 这样就可以发送凭证了
)
```

**原理**：

```
前端: 发送凭证 (credentials: 'include')
      ↓
后端: 明确指定允许的域名 (allow_origins=[...])
      ↓
浏览器: ✅ 兼容！
```

**优点**：
- ✅ 保留发送凭证的能力
- ✅ 更安全（只允许特定域名）
- ✅ 支持带 cookie 的认证

**缺点**：
- ❌ 需要修改后端代码
- ❌ 需要事先列出所有允许的域名
- ❌ 每次添加新域名都要修改后端

**适用场景**：
- ✅ 需要发送 cookie 的 API
- ✅ 生产环境（明确知道哪些域名可以访问）
- ✅ 需要高级安全控制

---

### 方案 C: 环境变量配置

**动态配置** - 根据环境决定：

```python
from os import getenv

if getenv("ENV") == "production":
    allowed_origins = [
        "https://mixread.example.com",
        "https://app.mixread.com",
    ]
else:
    # 开发环境允许所有
    allowed_origins = ["*"]

CORSMiddleware(
    allow_origins=allowed_origins,
    allow_credentials=getenv("ENV") == "production",
)
```

**优点**：
- ✅ 灵活配置
- ✅ 开发简单，生产安全

**缺点**：
- ❌ 需要修改后端
- ❌ 需要管理环境变量

---

## 我为什么选择方案 A？

### 原因 1: 无认证需求

当前 MixRead 的 API 不需要发送 cookie：
- ✅ 用户身份通过 `user_id` 参数传递（在 URL 或 body 中）
- ✅ 不使用 cookie 认证
- ✅ 不需要浏览器自动发送凭证

### 原因 2: 跨平台兼容性

移除 `credentials: 'include'` 后：
- ✅ 可在 Claude.com 上工作（https）
- ✅ 可在本地 HTTP 页面工作（http://localhost:8001）
- ✅ 可在任何域名上工作

### 原因 3: 简洁高效

- ✅ 一行代码修复
- ✅ 无需改动后端
- ✅ 不增加复杂性

---

## CORS 请求流程详解

### 带凭证的请求流程

```
前端代码:
┌─────────────────────────────────────┐
│ fetch(url, {                        │
│   mode: 'cors',                     │
│   credentials: 'include'  ← 关键！   │
│ })                                  │
└─────────────────────────────────────┘
        ↓
浏览器预检（OPTIONS 请求）
┌─────────────────────────────────────┐
│ OPTIONS /api/endpoint               │
│ Origin: https://www.claude.com      │
│ Access-Control-Request-Credentials: │
│   include  ← 询问：可以发送凭证吗？  │
└─────────────────────────────────────┘
        ↓
后端响应:
┌─────────────────────────────────────┐
│ HTTP/1.1 200 OK                     │
│ Access-Control-Allow-Origin:        │
│   必须是明确的域名！不能是 *        │
│ Access-Control-Allow-Credentials:   │
│   true                              │
└─────────────────────────────────────┘
        ↓
浏览器判断:
┌─────────────────────────────────────┐
│ ✅ 允许 - 如果后端指定了具体域名    │
│ ❌ 拒绝 - 如果后端返回了 *          │
└─────────────────────────────────────┘
```

### 不带凭证的请求流程（我采用的）

```
前端代码:
┌─────────────────────────────────────┐
│ fetch(url, {                        │
│   mode: 'cors'                      │
│   // credentials 默认: 'omit'       │
│ })                                  │
└─────────────────────────────────────┘
        ↓
浏览器发送简单请求（无预检）
┌─────────────────────────────────────┐
│ GET /api/endpoint                   │
│ Origin: https://www.claude.com      │
│ (无 Access-Control-Request-*)       │
└─────────────────────────────────────┘
        ↓
后端响应:
┌─────────────────────────────────────┐
│ HTTP/1.1 200 OK                     │
│ Access-Control-Allow-Origin: *      │
│ (通配符可以！)                      │
└─────────────────────────────────────┘
        ↓
浏览器判断:
┌─────────────────────────────────────┐
│ ✅ 允许 - 没有凭证，通配符 OK      │
└─────────────────────────────────────┘
```

---

## 关键要点总结

### CORS 的核心规则

| 规则 | 说明 |
|------|------|
| **通配符 `*` + 凭证** | ❌ **不允许** - 出于安全原因 |
| **通配符 `*` + 无凭证** | ✅ **允许** - 这就是公开 API |
| **明确域名 + 凭证** | ✅ **允许** - 安全的跨域认证 |
| **明确域名 + 无凭证** | ✅ **允许** - 限制域名的公开 API |

### 何时使用哪个模式

| 场景 | credentials | allow_origins | 需要后端改动 |
|------|------------|---------------|-----------|
| 公开 API（无认证） | omit | `["*"]` | ❌ 否 |
| Cookie 认证 | include | 明确域名列表 | ✅ 是 |
| Token 认证（HTTP header） | omit | `["*"]` | ❌ 否 |
| 生产环境 | 根据环境 | 根据环境 | ✅ 推荐 |

---

## 代码变更

### 前端（api-client.js）

**删除**：
```javascript
credentials: 'include',  // ← 这一行
```

**原因**：
- 当前 API 不需要发送 cookie
- 使用 `user_id` 参数传递用户身份
- 移除后可兼容所有域名

### 后端

**无需修改** ✅

当前配置完全正确：
```python
CORSMiddleware(
    allow_origins=["*"],  # 可以保持
    allow_credentials=True,  # 可以保持
)
```

---

## 验证修复

### 在 Chrome DevTools 中查看

打开 F12 → Network 标签 → 点击一个 API 请求

**查看请求头**：
```
Headers:
  Origin: https://www.claude.com
  (无 Access-Control-Request-Credentials)
```

**查看响应头**：
```
Response Headers:
  Access-Control-Allow-Origin: *  ✅
```

### 在 Console 中查看

成功的日志：
```
✅ [MixRead] Loaded unknown words from backend
```

失败的日志（修复前）：
```
❌ Access to fetch... has been blocked by CORS policy
```

---

## 未来考虑

### 如果需要 Cookie 认证

当项目进入 Phase 3+ 并需要真正的用户认证时：

1. **后端改动**：
```python
CORSMiddleware(
    allow_origins=[
        "http://localhost:8000",
        "http://localhost:8001",
        "https://mixread.example.com",
    ],
    allow_credentials=True,
)
```

2. **前端恢复**：
```javascript
credentials: 'include',  // 再加回来
```

3. **验证**：确保后端 `allow_origins` 包含了所有需要的域名

---

## 相关资源

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [CORS 规范](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [浏览器 CORS 详解](https://www.html5rocks.com/en/tutorials/cors/in-action/)

---

**总结**：通过移除 `credentials: 'include'`，我们移除了对"发送凭证"的需求，这样后端就可以使用通配符 `*` 来允许任何域名的请求。这是一个简洁、安全、高效的解决方案。
