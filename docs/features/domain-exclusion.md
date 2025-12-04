# Domain Exclusion Feature (域名排除功能)

**Status**: Phase 1 MVP (Implemented)
**Last Updated**: 2025-12-03

---

## 1. Overview (概述)

MixRead 插件允许用户控制哪些网站启动插件，哪些网站禁用（黑名单模式）。
该功能采用 **后端存储 (Self-hosted Backend)** 架构，支持多策略扩展（如未来的白名单）。

### Core Features (核心功能)

1.  **排除列表管理**: 用户可以添加/删除域名到黑名单。
2.  **快速切换**: 在 Popup 中一键禁用/启用当前页面。
3.  **预设列表**: 新用户首次使用时，推荐排除 `localhost`, `127.0.0.1` 等开发环境。
4.  **多端同步**: 数据存储在后端数据库，用户登录后自动同步。

---

## 2. Technical Architecture (技术架构)

### Backend Model (后端模型)

采用 `DomainManagementPolicy` 通用模型，支持多种策略类型。

**Table**: `domain_management_policies`

| Column        | Type    | Description                                 |
| :------------ | :------ | :------------------------------------------ |
| `id`          | Integer | Primary Key                                 |
| `user_id`     | String  | Foreign Key to Users                        |
| `policy_type` | Enum    | `blacklist` (current), `whitelist` (future) |
| `domain`      | String  | e.g., "github.com", "localhost:8000"        |
| `is_active`   | Boolean | Soft delete / toggle                        |
| `description` | String  | Optional notes                              |

### API Endpoints

Base URL: `/users/{user_id}/domain-policies`

- `GET /blacklist` - 获取黑名单列表
- `POST /blacklist` - 添加域名
  - Body: `{ "domain": "example.com" }`
- `DELETE /blacklist/{domain}` - 删除域名
- `POST /blacklist/batch` - 批量添加 (用于预设)
- `POST /check` - 检查某域名是否被排除

---

## 3. Frontend Implementation (前端实现)

### DomainPolicyStore

负责与后端 API 通信，并维护本地缓存。

- **Location**: `frontend/modules/domain-policy/domain-policy-store.js`
- **Key Methods**:
  - `initialize(userId)`: 从后端加载策略
  - `addBlacklistDomain(userId, domain)`: 调用 API 添加
  - `removeBlacklistDomain(userId, domain)`: 调用 API 删除
  - `getBlacklistDomains()`: 获取缓存的列表

### DomainPolicyFilter

负责判断当前 URL 是否匹配策略。

- **Location**: `frontend/modules/domain-policy/domain-policy-filter.js`
- **Matching Logic**:
  - Exact match: `example.com`
  - Subdomain match: `api.example.com` matches `example.com` (if implemented)
  - Wildcard: `localhost:*` matches `localhost:3000`
  - Protocol: `file://`

---

## 4. User Interface (UI)

### Popup

- **Current Page Status**: 显示当前域名是否被排除，提供 Toggle 按钮。
- **Management Tab**: 列表展示黑名单，支持手动添加和删除。

### Preset Dialog

- 首次加载时弹出。
- 提供常用开发环境 (`localhost`, `127.0.0.1`) 和生产工具 (`jenkins`, `gitlab`) 的快速排除选项。
- 批量调用 `POST /blacklist/batch` 接口。

---

## 5. Future Roadmap (Phase 2+)

由于采用了 `DomainManagementPolicy` 架构，未来扩展非常容易：

1.  **Whitelist Mode (白名单模式)**:
    - 只需启用 `policy_type = 'whitelist'`。
    - 无需修改数据库结构。
2.  **Mixed Mode (混合模式)**:
    - 同时支持黑白名单，按优先级处理。
3.  **Statistics**:
    - 统计哪些域名被排除最多。

```javascript
class ExclusionStore {
  async getExcludedDomains() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(["mixread_excluded_domains"], (result) => {
        resolve(result.mixread_excluded_domains || []);
      });
    });
  }

  matchesDomain(url, excludedDomains) {
    const urlObj = new URL(url);
    const currentHost =
      urlObj.hostname + (urlObj.port ? ":" + urlObj.port : "");

    for (let excluded of excludedDomains) {
      if (excluded === urlObj.hostname || excluded === currentHost) return true;
      if (excluded.includes("*")) {
        const pattern = excluded.replace("*", ".*");
        if (new RegExp("^" + pattern + "$").test(currentHost)) return true;
      }
    }
    return false;
  }
}
```

    - 无需修改数据库结构。

2.  **Mixed Mode (混合模式)**:
    - 同时支持黑白名单，按优先级处理。
3.  **Statistics**:
    - 统计哪些域名被排除最多。
