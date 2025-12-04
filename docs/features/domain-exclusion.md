# Domain Exclusion Feature (域名排除功能)

**Status**: Phase 1 MVP - Under Improvement
**Last Updated**: 2025-12-04
**Revision**: 2.0 - 改进方案

---

## 1. Problem Analysis (问题分析)

### Current Problems (当前问题)

#### Problem 1: 黑名单无法有效过滤域名 ❌

**主要问题**:
- **表现**: 添加域名到黑名单后，该域名的页面仍然显示高亮单词
- **根本原因**:
  - `domainPolicyStore.initialize()` 在 content.js 中的调用时序不正确
  - 初始化完成前就已经检查了 `shouldExcludeDomain()`
  - 导致加载时黑名单为空，检查失败
- **影响**: 黑名单功能完全不工作

**子问题 1.1: 端口号处理不正确** ⚠️ (FIXED v2.1)
- **问题**: 包含端口号的域名（如 `localhost:8002`）无法被正确识别
- **原因**:
  - `extractDomain()` 使用 `URL.hostname` 会自动去掉端口
  - 当黑名单包含 `localhost:8002`，但提取的域名为 `localhost`
  - 导致 `localhost` ≠ `localhost:8002`，匹配失败
- **示例**:
  ```
  黑名单: ["localhost:8002"]
  访问页面: http://localhost:8002/library-viewer.html
  提取域名（旧）: localhost  → 不匹配 ❌
  提取域名（新）: localhost:8002 → 匹配 ✅
  ```
- **解决方案** (v2.1):
  - 改用 `URL.host` 代替 `URL.hostname` 来保留端口号
  - 优化 `shouldExcludeDomain()` 进行大小写不敏感的比较
  - 添加 20+ 个测试用例验证修复
  - **状态**: ✅ 已修复，所有测试通过

#### Problem 2: 缺少内置默认黑名单 ❌
- **表现**: 新用户没有任何预设的敏感域名需要手动逐个添加
- **问题**:
  - 开发环境 (localhost, 127.0.0.1) 需要手动添加
  - 金融/支付网站 (banking, paypal) 容易被遗忘
  - 用户体验差
- **解决方案**: 在后端为新用户创建默认黑名单

#### Problem 3: UI 操作不便利 ⚠️
- **手动输入不便**: 需要知道完整的域名，容易出错
- **缺少快速操作**: 无法在当前页面快速添加/删除该域名
- **无右键菜单**: 不支持 AdBlock 风格的快速操作
- **用户体验**:
  ```
  当前流程 (3步):
  1. 打开 Popup
  2. 切换到 Domains Tab
  3. 手动输入域名

  期望流程 (1步):
  1. 右键点击 → "Exclude this domain"
  ```

#### Problem 4: 匹配策略过于简单 ⚠️
- **现状**: 只支持精确匹配和子域名匹配
- **缺陷**: 无法过滤特定路径下的页面
  ```
  例如:
  - 想排除 github.com/settings/* 但保留 github.com/user/*
  - 现在只能全部排除 github.com
  ```

---

## 2. Improved Design (改进设计)

### 2.1 Core Features (核心功能)

1. **内置默认黑名单** ✅
   - 预定义敏感域名
   - 新用户自动导入
   - 用户可选择性保留

2. **多级匹配策略** ✅
   - `exact`: 精确匹配
   - `subdomain`: 子域名匹配
   - `path`: 路径级别匹配

3. **快速添加当前页面** ✅
   - Popup 显示当前域名
   - 一键快速排除
   - 添加后自动刷新

4. **上下文菜单** ✅
   - 右键快速添加/删除
   - AdBlock 风格操作

5. **预设管理对话框** ✅
   - 首次使用显示默认黑名单
   - 允许批量添加/跳过

### 2.2 Backend Model (后端数据模型)

#### Database Schema 改进

添加 `match_type` 列支持不同匹配策略：

```sql
CREATE TABLE domain_management_policies (
  id INTEGER PRIMARY KEY,
  user_id STRING NOT NULL,
  policy_type ENUM('blacklist', 'whitelist') DEFAULT 'blacklist',
  domain STRING NOT NULL,          -- e.g., "github.com" or "github.com/settings"
  match_type ENUM('exact', 'subdomain', 'path') DEFAULT 'subdomain',
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  UNIQUE(user_id, policy_type, domain)
);
```

#### Default Blacklist (内置黑名单)

新用户首次登录时自动创建：

```python
DEFAULT_BLACKLIST = [
    # Development/Testing
    {
        "domain": "localhost",
        "match_type": "subdomain",
        "description": "Local development server"
    },
    {
        "domain": "127.0.0.1",
        "match_type": "exact",
        "description": "Local loopback (127.0.0.1)"
    },
    {
        "domain": "192.168.1.1",
        "match_type": "exact",
        "description": "Local router"
    },

    # Learning Tools (vocabulary platforms)
    {
        "domain": "quizlet.com",
        "match_type": "subdomain",
        "description": "Quizlet flashcards - disable when studying"
    },
    {
        "domain": "anki.deskew.com",
        "match_type": "subdomain",
        "description": "Anki web - disable during review"
    },

    # Financial/Sensitive
    {
        "domain": "mail.google.com",
        "match_type": "exact",
        "description": "Gmail inbox - privacy sensitive"
    },
    {
        "domain": "banking.icbc.com.cn",
        "match_type": "subdomain",
        "description": "Banking platform - no highlighting"
    },

    # Admin Panels
    {
        "domain": "localhost/admin",
        "match_type": "path",
        "description": "Admin panel - disable on localhost/admin/*"
    },
]
```

### 2.3 API Endpoints (改进的 API)

Base URL: `/users/{user_id}/domain-policies`

#### 获取黑名单
```
GET /blacklist
  返回: {
    success: true,
    blacklist_domains: ["github.com", "localhost", ...],
    count: 10
  }

GET /blacklist/detailed
  返回: {
    success: true,
    policies: [
      {
        id: 1,
        domain: "github.com",
        match_type: "subdomain",
        description: "Development platform",
        is_active: true,
        added_at: "2025-12-04T10:00:00Z"
      },
      ...
    ],
    count: 10
  }
```

#### 添加黑名单
```
POST /blacklist
  请求: {
    domain: "example.com",
    match_type: "subdomain",          // 可选，默认 "subdomain"
    description: "My custom domain"  // 可选
  }
  返回: {
    success: true,
    domain: "example.com",
    message: "Domain added to blacklist"
  }

POST /blacklist/batch
  请求: { domains: ["github.com", "localhost", ...] }
  返回: {
    success: true,
    count: 10,
    message: "10 domains added to blacklist"
  }
```

#### 删除黑名单
```
DELETE /blacklist/{domain}
  返回: { success: true, domain: "example.com" }

POST /blacklist/batch-remove
  请求: { domains: ["github.com", ...] }
  返回: { success: true, count: 2 }
```

#### 切换黑名单状态 (新增)
```
POST /blacklist/toggle/{domain}
  请求: { is_active: false }
  返回: {
    success: true,
    domain: "example.com",
    is_active: false
  }
```

#### 检查当前 URL (新增)
```
POST /blacklist/check-current
  请求: {
    url: "https://github.com/user/repo",
    user_id: "user123"
  }
  返回: {
    success: true,
    domain: "github.com",
    is_excluded: true,
    match_type: "subdomain",
    reason: "domain_in_blacklist",
    description: "Development platform"
  }
```

---

## 3. Frontend Implementation (前端实现)

### 3.1 匹配算法改进

#### DomainPolicyFilter - 改进的匹配逻辑

```javascript
class DomainPolicyFilter {
  /**
   * 检查 URL 是否应该被排除
   * @param {string} url - 完整 URL
   * @param {Array<Object>} policies - 黑名单策略数组
   * @returns {Object} { isExcluded: boolean, matchType: string, policy: Object }
   */
  static shouldExcludeUrl(url, policies) {
    if (!url || !policies || policies.length === 0) {
      return { isExcluded: false, matchType: null, policy: null };
    }

    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const path = urlObj.pathname;

    // 检查每个策略
    for (const policy of policies) {
      if (!policy.is_active) continue;

      const matched = this.matchPolicy(domain, path, policy);
      if (matched) {
        return {
          isExcluded: true,
          matchType: policy.match_type,
          policy: policy
        };
      }
    }

    return { isExcluded: false, matchType: null, policy: null };
  }

  /**
   * 检查策略是否匹配当前 URL
   */
  static matchPolicy(domain, path, policy) {
    const policyDomain = policy.domain;
    const matchType = policy.match_type || 'subdomain';

    switch (matchType) {
      case 'exact':
        // 精确匹配: example.com 只匹配 example.com
        return domain.toLowerCase() === policyDomain.toLowerCase();

      case 'subdomain':
        // 子域名匹配: example.com 匹配 example.com 和 *.example.com
        const normalizedDomain = domain.toLowerCase();
        const normalizedPolicy = policyDomain.toLowerCase();
        return normalizedDomain === normalizedPolicy ||
               normalizedDomain.endsWith('.' + normalizedPolicy);

      case 'path':
        // 路径匹配: example.com/admin 匹配 example.com/admin/*
        const [policyHost, policyPath] = policyDomain.split('/');
        const isDomainMatch = domain.toLowerCase() === policyHost.toLowerCase() ||
                              domain.toLowerCase().endsWith('.' + policyHost.toLowerCase());
        if (!isDomainMatch) return false;

        // 检查路径前缀
        if (!policyPath) return true;
        return path.startsWith('/' + policyPath);

      default:
        return false;
    }
  }
}
```

### 3.1.1 端口号处理修复 (v2.1新增)

**问题背景**: 之前发现包含端口号的域名（如 `localhost:8002`）无法被正确过滤。

**根本原因**:
- 旧代码在 `extractDomain()` 中使用 `URL.hostname` 自动去掉端口
- 匹配时无法识别带端口的黑名单条目

**改进方案**:

#### 方案对比

| 方面 | 旧实现 | 新实现 |
|------|--------|--------|
| 提取方式 | `URL.hostname` | `URL.host` |
| localhost:8002 结果 | `"localhost"` | `"localhost:8002"` ✅ |
| 大小写处理 | 直接比较 | 不敏感比较 ✅ |
| 测试覆盖 | 8 个用例 | 28+ 个用例 ✅ |

#### 实现代码

```javascript
// domain-policy-store.js
extractDomain(urlOrDomain) {
  if (!urlOrDomain) return "";

  try {
    // If it's a full URL, extract domain
    if (urlOrDomain.includes("://")) {
      const url = new URL(urlOrDomain);
      // 关键改进：使用 url.host 而非 url.hostname
      // url.host 会保留端口号
      return url.host;
    }
    // Otherwise assume it's already a domain
    return urlOrDomain.toLowerCase();
  } catch (error) {
    logger.warn("[DomainPolicy] Failed to extract domain from:", urlOrDomain);
    return urlOrDomain.toLowerCase();
  }
}

shouldExcludeDomain(domain) {
  if (!domain) return false;

  // Extract domain from URL if needed
  const domainName = this.extractDomain(domain).toLowerCase();

  // Check if domain is in blacklist (case-insensitive)
  // 改进：使用 .some() 和 toLowerCase() 确保大小写不敏感
  return this.blacklist.some(
    (blacklistedDomain) => blacklistedDomain.toLowerCase() === domainName
  );
}
```

#### 测试结果

✅ **All 28 Tests Passed** in `/frontend/test_domain_logic.js`

主要测试场景:
- 精确提取 (8 个): URL with/without port, with query params, plain domain
- 黑名单匹配 (12 个): Port exact match, port mismatch, case insensitivity, mixed blacklist
- 边界情况 (5 个): Empty URL, invalid URL, null domain, empty blacklist
- 兼容性 (3 个): 与现有的 github.com 等无端口域名兼容

#### 使用示例

```javascript
// 黑名单包含带端口的域名
store.blacklist = ["localhost:8002", "github.com", "example.com:3000"];

// ✅ 现在可以正确处理
store.shouldExcludeDomain("http://localhost:8002/page?id=1") → true
store.shouldExcludeDomain("https://github.com/user/repo") → true
store.shouldExcludeDomain("http://example.com:3000/api") → true

// ❌ 不同端口的页面不会被误匹配
store.shouldExcludeDomain("http://localhost:8001/page") → false
store.shouldExcludeDomain("http://example.com:8080/page") → false
```

---

### 3.2 快速添加 UI (新增)

#### Popup 中的当前页面快速操作

在 `popup.html` 的 `domain-tab` 中添加：

```html
<!-- 当前页面快速操作 -->
<div class="popup-section current-page-section">
  <h4 style="margin: 0 0 8px 0; font-size: 12px; color: #333">
    Current Page
  </h4>
  <div style="margin-bottom: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
    <p style="margin: 0 0 8px 0; font-size: 11px; color: #666">
      Website: <strong id="current-domain-display">loading...</strong>
    </p>
    <div style="display: flex; gap: 5px;">
      <button
        id="btn-exclude-current-domain"
        style="flex: 1; padding: 6px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;"
      >
        🚫 Exclude Domain
      </button>
      <button
        id="btn-exclude-current-path"
        style="flex: 1; padding: 6px; background: #ffc107; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;"
      >
        🚫 Exclude Path
      </button>
    </div>
  </div>
</div>
```

#### popup.js 中的逻辑

```javascript
/**
 * 初始化当前页面快速操作
 */
async function initializeCurrentPageSection() {
  try {
    // 获取当前 Tab 信息
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (!tab || !tab.url) {
      document.getElementById('current-domain-display').textContent = 'N/A';
      return;
    }

    const urlObj = new URL(tab.url);
    const currentDomain = urlObj.hostname;
    const currentPath = urlObj.pathname;

    // 显示当前域名
    document.getElementById('current-domain-display').textContent = currentDomain;

    // 快速排除域名
    document.getElementById('btn-exclude-current-domain').addEventListener('click', async () => {
      const success = await domainPolicyStore.addBlacklistDomain(
        currentUser,
        currentDomain,
        `Excluded on ${new Date().toLocaleDateString()}`
      );
      if (success) {
        alert(`✓ Excluded: ${currentDomain}`);
        renderBlacklist();
        chrome.tabs.reload(tab.id); // 刷新页面应用
      }
    });

    // 快速排除路径
    document.getElementById('btn-exclude-current-path').addEventListener('click', async () => {
      const pathPart = currentPath.split('/').filter(Boolean)[0]; // 取第一级路径
      const pathDomain = `${currentDomain}/${pathPart}`;

      const success = await domainPolicyStore.addBlacklistDomain(
        currentUser,
        pathDomain,
        `Path excluded on ${new Date().toLocaleDateString()}`
      );
      if (success) {
        alert(`✓ Excluded path: ${pathDomain}/*`);
        renderBlacklist();
        chrome.tabs.reload(tab.id);
      }
    });

  } catch (error) {
    logger.error('[Popup] Failed to initialize current page section', error);
  }
}
```

### 3.3 上下文菜单 (新增)

#### content.js 中添加

```javascript
/**
 * 初始化上下文菜单
 */
function initializeContextMenu() {
  // 创建右键菜单
  chrome.contextMenus.create({
    id: 'exclude-current-domain',
    title: 'Exclude this domain from MixRead',
    contexts: ['selection', 'page'],
    documentUrlPatterns: ['http://*/*', 'https://*/*']
  });

  // 监听菜单点击
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'exclude-current-domain') {
      handleContextMenuExclude(tab);
    }
  });
}

/**
 * 处理右键菜单排除操作
 */
async function handleContextMenuExclude(tab) {
  try {
    const urlObj = new URL(tab.url);
    const domain = urlObj.hostname;

    // 发送消息给 popup 或 service worker 执行添加操作
    chrome.runtime.sendMessage({
      action: 'add-blacklist-domain',
      domain: domain,
      userId: currentUser,
      url: tab.url
    }, (response) => {
      if (response && response.success) {
        // 刷新当前页面
        chrome.tabs.reload(tab.id);
      }
    });

  } catch (error) {
    logger.error('[ContextMenu] Failed to exclude domain', error);
  }
}
```

#### background.js 中添加处理

```javascript
/**
 * 监听来自 content.js 的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'add-blacklist-domain') {
    handleAddBlacklistDomain(request.domain, request.userId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 异步响应
  }
});

/**
 * 添加黑名单域名
 */
async function handleAddBlacklistDomain(domain, userId) {
  try {
    const store = new DomainPolicyStore();
    await store.initialize(userId);
    const success = await store.addBlacklistDomain(userId, domain);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 3.4 初始化时序修复

#### content.js 中的修复

```javascript
// 确保初始化顺序正确
async function initializeExtension() {
  try {
    // 第一步：获取用户ID
    const userId = await getUserId();
    console.log("[MixRead] User ID:", userId);

    // 第二步：初始化 Domain Policy Store（必须在检查前完成！）
    domainPolicyStore = new DomainPolicyStore();
    await domainPolicyStore.initialize(userId);  // 等待完成
    console.log("[MixRead] Domain Policy Store initialized");

    // 第三步：现在才检查当前页面是否应该被排除
    shouldExcludeCurrentPage = DomainPolicyFilter.shouldExcludeCurrentPage(
      window.location.href,
      domainPolicyStore
    );

    if (shouldExcludeCurrentPage) {
      console.log("[MixRead] ✓ Current domain is in blacklist - highlighting disabled");
      return; // 退出，不做任何高亮
    }

    // 第四步：继续初始化其他模块
    const unknownWordsStore = new UnknownWordsStore();
    // ... 其他初始化代码 ...

  } catch (error) {
    console.error("[MixRead] Initialization failed", error);
  }
}
```

---

## 4. Implementation Roadmap (实现路线图)

### Phase 1: Backend (后端改进)
- [ ] 添加 `match_type` 列到数据库
- [ ] 实现默认黑名单初始化 (新用户自动导入)
- [ ] 增强 API 支持 `match_type` 参数
- [ ] 实现 `/check-current` 端点

### Phase 2: Frontend (前端改进)
- [x] **修复端口号处理** (v2.1 ✅ 已完成)
  - 改用 `URL.host` 保留端口号
  - 28+ 个测试全部通过
  - 可现在使用 localhost:8002 等带端口的黑名单
- [ ] 修复 content.js 初始化时序
- [ ] 更新 DomainPolicyStore 支持详细策略数据
- [ ] 改进 DomainPolicyFilter 匹配算法
- [ ] 添加快速添加当前页面的 UI
- [ ] 实现上下文菜单

### Phase 3: 测试 & 打磨
- [ ] 单元测试：匹配算法 (exact, subdomain, path)
- [ ] 集成测试：端到端黑名单流程
- [ ] 用户体验测试：快速添加流程
- [ ] 性能测试：百个域名的匹配性能

---

## 5. Data Flow (数据流)

### 流程图：用户操作黑名单

```
┌─────────────────────┐
│   用户操作方式      │
├─────────────────────┤
│ 1. 手动输入域名     │
│ 2. 快速添加当前页  │
│ 3. 右键菜单        │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────────┐
│ Popup.js 或 ContentMenu  │
│ 验证域名格式             │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ DomainPolicyStore        │
│ addBlacklistDomain()     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ API: POST /blacklist     │
│ { domain, match_type }   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Backend Service          │
│ 数据库保存               │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 返回成功响应             │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Popup UI 刷新             │
│ renderBlacklist()         │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Chrome.tabs.reload()      │
│ 刷新当前页面应用策略     │
└──────────────────────────┘
```

### 流程图：内容脚本应用黑名单

```
┌──────────────────────────┐
│ content.js 加载           │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 创建 DomainPolicyStore   │
│ await initialize()       │
│ (加载所有黑名单+match_type)│
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ DomainPolicyFilter       │
│ shouldExcludeUrl()       │
│ 根据 match_type 匹配    │
└──────────┬───────────────┘
           │
      ┌────┴────┐
      │          │
      ▼          ▼
  ✓ 排除      ✗ 不排除
      │          │
      │          ▼
      │      ┌──────────────┐
      │      │ 继续加载高亮 │
      │      │ 模块         │
      │      └──────────────┘
      │
      ▼
  ┌──────────────┐
  │ 跳过所有高亮 │
  │ 逻辑         │
  └──────────────┘
```

---

## 6. Testing Strategy (测试策略)

### 单元测试

```javascript
// test_domain_filter.js
describe('DomainPolicyFilter', () => {
  describe('exact match', () => {
    test('should match exact domain', () => {
      const policy = { domain: 'github.com', match_type: 'exact', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('github.com', '/', policy)).toBe(true);
    });

    test('should not match subdomain', () => {
      const policy = { domain: 'github.com', match_type: 'exact', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('api.github.com', '/', policy)).toBe(false);
    });
  });

  describe('subdomain match', () => {
    test('should match exact domain', () => {
      const policy = { domain: 'github.com', match_type: 'subdomain', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('github.com', '/', policy)).toBe(true);
    });

    test('should match subdomain', () => {
      const policy = { domain: 'github.com', match_type: 'subdomain', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('api.github.com', '/', policy)).toBe(true);
    });

    test('should not match different domain', () => {
      const policy = { domain: 'github.com', match_type: 'subdomain', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('gitlab.com', '/', policy)).toBe(false);
    });
  });

  describe('path match', () => {
    test('should match path prefix', () => {
      const policy = { domain: 'github.com/admin', match_type: 'path', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('github.com', '/admin/users', policy)).toBe(true);
    });

    test('should not match different path', () => {
      const policy = { domain: 'github.com/admin', match_type: 'path', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('github.com', '/public', policy)).toBe(false);
    });

    test('should match subdomain with path', () => {
      const policy = { domain: 'github.com/settings', match_type: 'path', is_active: true };
      expect(DomainPolicyFilter.matchPolicy('api.github.com', '/settings/profile', policy)).toBe(true);
    });
  });
});
```

### 集成测试

```javascript
// test_domain_blacklist_e2e.js
describe('Domain Blacklist E2E', () => {
  test('should disable highlighting after adding domain', async () => {
    // 1. 添加域名到黑名单
    const success = await domainPolicyStore.addBlacklistDomain(userId, 'test.com');
    expect(success).toBe(true);

    // 2. 刷新 Store（模拟页面刷新）
    const store2 = new DomainPolicyStore();
    await store2.initialize(userId);

    // 3. 检查当前 URL
    const isExcluded = DomainPolicyFilter.shouldExcludeCurrentPage(
      'https://test.com/page',
      store2
    );
    expect(isExcluded).toBe(true);
  });

  test('should support quick add from current page', async () => {
    // 1. 获取当前页面的域名
    const domain = extractDomain('https://example.com/path');

    // 2. 快速添加
    const success = await domainPolicyStore.addBlacklistDomain(userId, domain);
    expect(success).toBe(true);

    // 3. 验证确实被添加了
    const blacklist = domainPolicyStore.getBlacklistDomains();
    expect(blacklist).toContain('example.com');
  });
});
```

---

## 7. FAQ (常见问题)

### Q1: 为什么要添加 match_type？
**A**: 不同场景需要不同的匹配策略：
- `exact`: 排除特定子域名（如 mail.google.com）
- `subdomain`: 排除整个域名及所有子域名（如 *.github.com）
- `path`: 排除特定路径（如 github.com/admin/*）

### Q2: 默认黑名单会不会太多？
**A**: 不会。默认黑名单只包含：
- 明显的开发环境 (localhost)
- 广泛使用的学习工具 (quizlet, anki)
- 金融/隐私敏感网站

用户可以在预设对话框中选择性保留或删除。

### Q3: 右键菜单在所有网站都有效吗？
**A**: 否。不支持：
- Chrome 内置页面 (chrome://*)
- Chrome Web Store 页面
- 某些 HTTPS 网站的完整访问权限

### Q4: 快速添加会刷新页面，造成数据丢失吗？
**A**: 是的。建议在刷新前显示确认对话框。

---

## 8. References (参考)

- [Domain Management Service](../../backend/application/services.py) - 后端服务实现
- [DomainPolicyStore](../../frontend/modules/domain-policy/domain-policy-store.js) - 前端 Store
- [DomainPolicyFilter](../../frontend/modules/domain-policy/domain-policy-filter.js) - 匹配逻辑
- [Popup UI](../../frontend/popup.html) - 用户界面

