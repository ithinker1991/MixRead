# 架构更新说明

**更新日期**: 2025-12-02
**更新内容**: 从"ExcludedDomainModel"升级到"DomainManagementPolicy"架构
**目的**: 为未来的白名单、混合模式等功能预留扩展空间

---

## 🎯 关键变化

### ❌ 旧方案

```
ExcludedDomainModel
  └─ 只支持黑名单
  └─ 功能单一
  └─ 扩展时需要重构
```

### ✅ 新方案

```
DomainManagementPolicy
  ├─ policy_type (blacklist / whitelist / ...)
  ├─ domain
  ├─ is_active (便于禁用而不删除)
  └─ description (便于管理)

支持:
  ✅ Phase 1: 黑名单 (当前)
  ✅ Phase 2: 白名单 (无需改表结构)
  ✅ Phase 3: 混合模式 (无需改表结构)
```

---

## 📊 具体改变

### 数据库表

**旧表**: `excluded_domains`
```sql
id, user_id, domain, added_at
```

**新表**: `domain_management_policies`
```sql
id, user_id, policy_type, domain, is_active, added_at, updated_at, description
```

### Python 类

| 旧名 | 新名 | 说明 |
|------|------|------|
| `ExcludedDomainModel` | `DomainManagementPolicy` | 数据库模型 |
| `ExcludedDomainRepository` | `DomainManagementPolicyRepository` | 数据访问层 |
| `ExclusionApplicationService` | `DomainManagementService` | 业务逻辑层 |

### JavaScript 类

| 旧名 | 新名 | 说明 |
|------|------|------|
| `ExclusionStore` | `DomainPolicyStore` | 前端存储 |
| `ExclusionFilter` | `DomainPolicyFilter` | 前端过滤 |

### API Endpoints

| 用途 | 旧路径 | 新路径 |
|------|-------|-------|
| 获取黑名单 | `GET /users/{id}/excluded-domains` | `GET /users/{id}/domain-policies/blacklist` |
| 添加到黑名单 | `POST /users/{id}/excluded-domains` | `POST /users/{id}/domain-policies/blacklist` |
| 删除黑名单 | `DELETE /users/{id}/excluded-domains/{domain}` | `DELETE /users/{id}/domain-policies/blacklist/{domain}` |
| 批量添加 | `POST /users/{id}/excluded-domains/batch` | `POST /users/{id}/domain-policies/blacklist/batch` |
| **新增** | - | `GET /users/{id}/domain-policies` (获取所有策略) |
| **新增** | - | `GET /users/{id}/domain-policies/whitelist` (Phase 2) |

---

## 📋 迁移工作清单

### 后端改动

```
[ ] 更新 backend/infrastructure/models.py
    [ ] 删除 ExcludedDomainModel
    [ ] 添加 DomainPolicyType (Enum)
    [ ] 添加 DomainManagementPolicy
    [ ] 更新 UserModel 关系

[ ] 更新 backend/infrastructure/repositories.py
    [ ] 删除 ExcludedDomainRepository
    [ ] 添加 DomainManagementPolicyRepository

[ ] 更新 backend/application/services.py
    [ ] 删除 ExclusionApplicationService
    [ ] 添加 DomainManagementService
    [ ] 实现 should_exclude_domain 逻辑

[ ] 更新 backend/api/routes.py
    [ ] 更新所有 endpoint 路径
    [ ] 添加白名单 endpoints (暂未启用)
    [ ] 添加通用查询 endpoint

[ ] 数据库迁移
    [ ] 创建新表 domain_management_policies
    [ ] 迁移数据 (如果已有用户)
    [ ] 删除旧表 excluded_domains
```

### 前端改动

```
[ ] 更新 frontend/modules/exclusion/exclusion-store.js
    [ ] 重命名为 domain-policy-store.js
    [ ] 类改名: ExclusionStore → DomainPolicyStore
    [ ] 方法改名: addDomain → addToBlacklist
    [ ] 方法改名: removeDomain → removeFromBlacklist
    [ ] 更新 API 调用路径

[ ] 更新 frontend/modules/exclusion/exclusion-filter.js
    [ ] 重命名为 domain-policy-filter.js
    [ ] 类改名: ExclusionFilter → DomainPolicyFilter
    [ ] 更新方法实现

[ ] 更新 frontend/popup.js
    [ ] 导入新的 Store 和 Filter
    [ ] 更新方法调用

[ ] 更新 frontend/content.js
    [ ] 更新导入
    [ ] 更新初始化逻辑
```

---

## 🔄 向后兼容性

### 好消息 ✅

1. **功能完全相同** - Phase 1 中，黑名单的功能和旧方案一样
2. **API 语义更清晰** - 新的 API 路径更直观
3. **扩展无缝** - 添加白名单时无需改数据库结构
4. **数据迁移简单** - 只需简单的 SQL 迁移

### 需要更新的 ❌

1. **导入路径** - `ExclusionStore` → `DomainPolicyStore`
2. **方法名** - `addDomain` → `addToBlacklist`
3. **API 端点** - `/excluded-domains` → `/domain-policies/blacklist`
4. **类名** - 后端类也需要改名

---

## 📚 参考文档

新建文档: **DOMAIN_MANAGEMENT_ARCHITECTURE.md**

包含:
- ✅ 完整的数据库设计
- ✅ Repository 完整代码
- ✅ Service 完整代码 (含白名单逻辑预留)
- ✅ API endpoints 完整代码
- ✅ 前端 DomainPolicyStore 代码
- ✅ 扩展路径说明
- ✅ 数据库迁移 SQL

---

## 🚀 立即开始

### Day 1 任务更新

替换步骤:

**旧**: 创建 ExcludedDomainModel
**新**: 创建 DomainManagementPolicy

所有代码都在 **DOMAIN_MANAGEMENT_ARCHITECTURE.md** 中，可直接复制。

---

## 💡 为什么这个设计更好？

### 1. 面向扩展设计
```
黑名单 (Phase 1) → 可轻松添加白名单 (Phase 2) → 混合模式 (Phase 3)
```

### 2. 代码复用最大化
```
Repository: 8 个方法
Service: 所有逻辑已实现
前端: 轻松适配多种策略
```

### 3. 清晰的概念层次
```
DomainManagementPolicy (策略)
  ├─ 黑名单 (排除高亮)
  ├─ 白名单 (只有这些高亮)
  └─ 未来策略 (灰名单、优先级等)
```

### 4. 团队沟通更容易
```
"域名管理策略" 比 "排除域名" 更清晰
易于讨论未来的功能扩展
```

---

## 📊 三阶段扩展路径

### Phase 1 (当前) ✅
```
DomainManagementPolicy 表 (支持多种策略类型)
黑名单功能完整实现
前端管理界面
```

### Phase 2 (未来) - 添加白名单
```
启用白名单 API endpoints (已预留)
前端添加白名单切换
Service 中的 should_exclude_domain 已支持白名单逻辑
无需修改数据库结构
```

### Phase 3 (未来) - 混合模式
```
同时支持黑名单和白名单
用户可选择优先级
高级用户可选择策略组合
Repository 和 Service 已支持
```

---

## ✅ 总结

| 方面 | 旧方案 | 新方案 |
|------|-------|-------|
| **扩展性** | 低 (需要重构) | 高 (只需启用新策略) |
| **代码复用** | 低 | 高 |
| **概念清晰** | 低 | 高 |
| **Phase 1 工作量** | 相同 | 相同 |
| **Phase 2 工作量** | 高 (需要重构) | 低 (启用预留逻辑) |

---

**结论**: 这个架构设计虽然初期工作量相同，但为后续的功能扩展预留了充足的空间。强烈推荐！🎉

