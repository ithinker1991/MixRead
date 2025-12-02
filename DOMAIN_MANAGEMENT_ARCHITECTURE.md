# 域名管理策略 - 架构设计文档

**日期**: 2025-12-02
**概念**: 灵活的域名管理系统，支持黑名单、白名单等多种策略
**设计目标**: 为未来的功能扩展预留空间

---

## 🎯 核心理念

从"排除域名"扩展到"域名管理策略"的思路：

```
Phase 1 (当前): 黑名单 (Blacklist)
  └─ 指定的网站不高亮

Phase 2 (未来): 白名单 (Whitelist)
  └─ 只有指定的网站才高亮

Phase 3 (未来): 混合模式
  └─ 同时支持黑名单和白名单

架构设计: 统一的 DomainManagementPolicy 表
  └─ 通过 policy_type 字段区分
  └─ 所有逻辑复用同一套系统
```

---

## 📊 数据库设计

### 策略类型定义

```python
from enum import Enum

class DomainPolicyType(str, Enum):
    """域名管理策略类型"""
    BLACKLIST = "blacklist"  # 黑名单: 这些网站不高亮
    WHITELIST = "whitelist"  # 白名单: 只有这些网站高亮
```

### 核心表结构

```python
from sqlalchemy import Column, String, DateTime, Enum, Boolean, Integer, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class DomainManagementPolicy(Base):
    """
    域名管理策略表
    支持黑名单、白名单等多种策略
    """
    __tablename__ = "domain_management_policies"

    # 主键
    id = Column(Integer, primary_key=True, index=True)

    # 用户关联
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)

    # 策略类型 (黑名单/白名单)
    policy_type = Column(Enum(DomainPolicyType), default=DomainPolicyType.BLACKLIST, index=True)

    # 域名
    domain = Column(String(255), index=True)

    # 是否启用 (便于禁用而不删除)
    is_active = Column(Boolean, default=True, index=True)

    # 添加时间
    added_at = Column(DateTime, default=datetime.now)

    # 修改时间
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 备注 (便于管理)
    description = Column(String(500), nullable=True)

    # 联合唯一约束: 同一用户的同一策略类型中，域名不重复
    __table_args__ = (
        Index("ix_user_policy_domain", "user_id", "policy_type", "domain", unique=True),
        Index("ix_user_policy_active", "user_id", "policy_type", "is_active"),
    )

    # 关系
    user = relationship("UserModel", back_populates="domain_management_policies")

    def __repr__(self):
        return f"<DomainManagementPolicy user={self.user_id} type={self.policy_type} domain={self.domain}>"
```

### 更新 UserModel

```python
class UserModel(Base):
    """User table"""
    __tablename__ = "users"

    # ... existing fields ...

    # Add relationship to domain management policies
    domain_management_policies = relationship(
        "DomainManagementPolicy",
        back_populates="user",
        cascade="all, delete-orphan"
    )
```

---

## 🏗️ Repository 设计

```python
from infrastructure.models import DomainManagementPolicy, DomainPolicyType
from sqlalchemy.orm import Session
from typing import List

class DomainManagementPolicyRepository:
    """域名管理策略仓储"""

    def __init__(self, db: Session):
        self.db = db

    # ========== 基础 CRUD ==========

    def get_by_user_and_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType
    ) -> List[str]:
        """获取用户指定类型的所有域名"""
        domains = self.db.query(DomainManagementPolicy.domain)\
            .filter(
                DomainManagementPolicy.user_id == user_id,
                DomainManagementPolicy.policy_type == policy_type,
                DomainManagementPolicy.is_active == True
            )\
            .all()
        return [d[0] for d in domains]

    def add_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST,
        description: str = None
    ) -> DomainManagementPolicy:
        """添加域名到指定策略"""
        # 检查是否已存在
        existing = self.db.query(DomainManagementPolicy)\
            .filter_by(
                user_id=user_id,
                policy_type=policy_type,
                domain=domain
            )\
            .first()

        if existing:
            # 如果已存在但被禁用，则启用它
            if not existing.is_active:
                existing.is_active = True
                self.db.commit()
            return existing

        # 创建新策略
        policy = DomainManagementPolicy(
            user_id=user_id,
            domain=domain,
            policy_type=policy_type,
            description=description
        )
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    def remove_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST
    ) -> bool:
        """删除域名 (软删除，设置为不活跃)"""
        policy = self.db.query(DomainManagementPolicy)\
            .filter_by(
                user_id=user_id,
                policy_type=policy_type,
                domain=domain
            )\
            .first()

        if policy:
            policy.is_active = False
            self.db.commit()
            return True
        return False

    def hard_delete_domain(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST
    ) -> bool:
        """硬删除域名 (完全删除记录)"""
        result = self.db.query(DomainManagementPolicy)\
            .filter_by(
                user_id=user_id,
                policy_type=policy_type,
                domain=domain
            )\
            .delete()
        self.db.commit()
        return result > 0

    # ========== 批量操作 ==========

    def add_multiple_domains(
        self,
        user_id: str,
        domains: List[str],
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST
    ) -> dict:
        """批量添加域名"""
        added = []
        failed = []

        for domain in domains:
            try:
                self.add_domain(user_id, domain.strip(), policy_type)
                added.append(domain)
            except Exception as e:
                failed.append({"domain": domain, "error": str(e)})

        return {"added": added, "failed": failed}

    def clear_by_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType
    ) -> int:
        """清空指定类型的所有域名"""
        count = self.db.query(DomainManagementPolicy)\
            .filter_by(user_id=user_id, policy_type=policy_type)\
            .delete()
        self.db.commit()
        return count

    # ========== 查询操作 ==========

    def get_all_by_user(self, user_id: str) -> dict:
        """获取用户的所有策略 (按类型分组)"""
        policies = self.db.query(DomainManagementPolicy)\
            .filter(
                DomainManagementPolicy.user_id == user_id,
                DomainManagementPolicy.is_active == True
            )\
            .all()

        result = {
            "blacklist": [],
            "whitelist": []
        }

        for policy in policies:
            result[policy.policy_type.value].append({
                "domain": policy.domain,
                "description": policy.description,
                "added_at": policy.added_at
            })

        return result

    def get_policy(
        self,
        user_id: str,
        domain: str,
        policy_type: DomainPolicyType = DomainPolicyType.BLACKLIST
    ) -> DomainManagementPolicy:
        """获取单个策略"""
        return self.db.query(DomainManagementPolicy)\
            .filter_by(
                user_id=user_id,
                policy_type=policy_type,
                domain=domain
            )\
            .first()
```

---

## 🎯 Service 设计

```python
from infrastructure.repositories import DomainManagementPolicyRepository
from infrastructure.models import DomainPolicyType

class DomainManagementService:
    """域名管理业务逻辑服务"""

    def __init__(self, repo: DomainManagementPolicyRepository):
        self.repo = repo

    # ========== 黑名单操作 (Phase 1) ==========

    def get_blacklist(self, user_id: str) -> dict:
        """获取用户的黑名单"""
        domains = self.repo.get_by_user_and_type(user_id, DomainPolicyType.BLACKLIST)
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "policy_type": "blacklist",
                "domains": domains,
                "count": len(domains)
            }
        }

    def add_to_blacklist(self, user_id: str, domain: str, description: str = None) -> dict:
        """添加域名到黑名单"""
        if not domain or not domain.strip():
            return {"success": False, "error": "Domain cannot be empty"}

        try:
            self.repo.add_domain(
                user_id,
                domain.strip(),
                DomainPolicyType.BLACKLIST,
                description
            )
            return {
                "success": True,
                "data": {"message": f"Domain '{domain}' added to blacklist"}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def remove_from_blacklist(self, user_id: str, domain: str) -> dict:
        """从黑名单移除域名"""
        if self.repo.remove_domain(user_id, domain, DomainPolicyType.BLACKLIST):
            return {
                "success": True,
                "data": {"message": f"Domain '{domain}' removed from blacklist"}
            }
        return {"success": False, "error": "Domain not found"}

    # ========== 白名单操作 (Phase 2) ==========

    def get_whitelist(self, user_id: str) -> dict:
        """获取用户的白名单"""
        domains = self.repo.get_by_user_and_type(user_id, DomainPolicyType.WHITELIST)
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "policy_type": "whitelist",
                "domains": domains,
                "count": len(domains)
            }
        }

    def add_to_whitelist(self, user_id: str, domain: str, description: str = None) -> dict:
        """添加域名到白名单"""
        if not domain or not domain.strip():
            return {"success": False, "error": "Domain cannot be empty"}

        try:
            self.repo.add_domain(
                user_id,
                domain.strip(),
                DomainPolicyType.WHITELIST,
                description
            )
            return {
                "success": True,
                "data": {"message": f"Domain '{domain}' added to whitelist"}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ========== 通用操作 ==========

    def get_all_policies(self, user_id: str) -> dict:
        """获取用户的所有策略"""
        policies = self.repo.get_all_by_user(user_id)
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "policies": policies
            }
        }

    def add_multiple_to_blacklist(self, user_id: str, domains: list) -> dict:
        """批量添加到黑名单 (预设初始化)"""
        result = self.repo.add_multiple_domains(
            user_id,
            domains,
            DomainPolicyType.BLACKLIST
        )
        return {
            "success": True,
            "data": result
        }

    # ========== 应用逻辑 (核心) ==========

    def should_exclude_domain(self, user_id: str, url: str) -> bool:
        """
        判断是否应该排除该域名的高亮

        逻辑:
        1. 首先检查黑名单 (Phase 1)
           - 如果在黑名单中 → 排除

        2. 检查白名单 (Phase 2+)
           - 如果有白名单且URL不在白名单中 → 排除
           - 如果有白名单且URL在白名单中 → 不排除

        3. 默认行为
           - 无白名单且不在黑名单 → 不排除 (正常加载)
        """
        try:
            from urllib.parse import urlparse

            parsed_url = urlparse(url)
            current_host = parsed_url.hostname
            current_port = parsed_url.port
            current_full_host = f"{current_host}:{current_port}" if current_port else current_host

            # 获取黑名单
            blacklist = self.repo.get_by_user_and_type(user_id, DomainPolicyType.BLACKLIST)

            # 检查黑名单
            if self._matches_domain_list(current_full_host, blacklist):
                return True  # 在黑名单中，应该排除

            # 获取白名单
            whitelist = self.repo.get_by_user_and_type(user_id, DomainPolicyType.WHITELIST)

            # 如果有白名单，检查是否在白名单中
            if whitelist:
                if not self._matches_domain_list(current_full_host, whitelist):
                    return True  # 有白名单但不在其中，应该排除

            # 默认: 不排除
            return False

        except Exception as e:
            print(f"[MixRead] Error checking domain exclusion: {e}")
            return False  # 出错时默认不排除

    def _matches_domain_list(self, current_host: str, domain_list: list) -> bool:
        """检查主机是否匹配域名列表"""
        for domain in domain_list:
            # 精确匹配
            if current_host == domain:
                return True

            # 通配符匹配
            if '*' in domain:
                import re
                pattern = domain.replace('.', r'\.').replace('*', '.*')
                if re.match(f"^{pattern}$", current_host):
                    return True

        return False
```

---

## 🔌 API Endpoints 设计

```python
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from infrastructure.database import get_db
from infrastructure.repositories import DomainManagementPolicyRepository
from application.services import DomainManagementService
from infrastructure.models import DomainPolicyType

router = APIRouter(prefix="/users", tags=["domain-management"])

# ========== 请求模型 ==========

class AddDomainRequest(BaseModel):
    domain: str
    description: str = None

class AddMultipleDomainsRequest(BaseModel):
    domains: list[str]

class DomainPolicyRequest(BaseModel):
    domain: str
    policy_type: str = "blacklist"  # "blacklist" 或 "whitelist"
    description: str = None

# ========== Phase 1: 黑名单 API ==========

@router.get("/{user_id}/domain-policies/blacklist")
async def get_blacklist(user_id: str, db: Session = Depends(get_db)):
    """获取用户的黑名单"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.get_blacklist(user_id)

@router.post("/{user_id}/domain-policies/blacklist")
async def add_to_blacklist(
    user_id: str,
    request: AddDomainRequest,
    db: Session = Depends(get_db)
):
    """添加域名到黑名单"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.add_to_blacklist(user_id, request.domain, request.description)

@router.delete("/{user_id}/domain-policies/blacklist/{domain}")
async def remove_from_blacklist(
    user_id: str,
    domain: str,
    db: Session = Depends(get_db)
):
    """从黑名单移除域名"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.remove_from_blacklist(user_id, domain)

@router.post("/{user_id}/domain-policies/blacklist/batch")
async def add_multiple_to_blacklist(
    user_id: str,
    request: AddMultipleDomainsRequest,
    db: Session = Depends(get_db)
):
    """批量添加到黑名单 (用于预设初始化)"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.add_multiple_to_blacklist(user_id, request.domains)

# ========== Phase 2: 白名单 API (保留，暂未启用) ==========

@router.get("/{user_id}/domain-policies/whitelist")
async def get_whitelist(user_id: str, db: Session = Depends(get_db)):
    """获取用户的白名单"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.get_whitelist(user_id)

@router.post("/{user_id}/domain-policies/whitelist")
async def add_to_whitelist(
    user_id: str,
    request: AddDomainRequest,
    db: Session = Depends(get_db)
):
    """添加域名到白名单"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.add_to_whitelist(user_id, request.domain, request.description)

# ========== 通用 API ==========

@router.get("/{user_id}/domain-policies")
async def get_all_policies(user_id: str, db: Session = Depends(get_db)):
    """获取用户的所有域名管理策略"""
    repo = DomainManagementPolicyRepository(db)
    service = DomainManagementService(repo)
    return service.get_all_policies(user_id)
```

---

## 🎯 前端适配

### ExclusionStore (重命名为 DomainPolicyStore)

```javascript
class DomainPolicyStore {
  constructor(apiClient, userId) {
    this.apiClient = apiClient;
    this.userId = userId;
    this.cachedBlacklist = null;
    this.cachedWhitelist = null;
  }

  /**
   * 获取黑名单
   */
  async getBlacklist() {
    if (this.cachedBlacklist !== null) {
      return this.cachedBlacklist;
    }

    try {
      const response = await this.apiClient.get(
        `/users/${this.userId}/domain-policies/blacklist`
      );

      if (response.success) {
        this.cachedBlacklist = response.data.domains || [];
        return this.cachedBlacklist;
      }
    } catch (error) {
      console.error('[MixRead] 获取黑名单失败:', error);
    }

    return [];
  }

  /**
   * 添加到黑名单
   */
  async addToBlacklist(domain) {
    if (!domain || !domain.trim()) return false;

    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/domain-policies/blacklist`,
        { domain: domain.trim() }
      );

      if (response.success) {
        if (!this.cachedBlacklist.includes(domain.trim())) {
          this.cachedBlacklist.push(domain.trim());
        }
        return true;
      }
    } catch (error) {
      console.error('[MixRead] 添加到黑名单失败:', error);
    }

    return false;
  }

  /**
   * 从黑名单移除
   */
  async removeFromBlacklist(domain) {
    try {
      const response = await this.apiClient.delete(
        `/users/${this.userId}/domain-policies/blacklist/${domain}`
      );

      if (response.success) {
        this.cachedBlacklist = this.cachedBlacklist.filter(d => d !== domain);
        return true;
      }
    } catch (error) {
      console.error('[MixRead] 从黑名单移除失败:', error);
    }

    return false;
  }

  /**
   * 批量添加到黑名单
   */
  async addMultipleToBlacklist(domains) {
    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/domain-policies/blacklist/batch`,
        { domains: domains }
      );

      if (response.success) {
        this.cachedBlacklist = null;
        await this.getBlacklist();
        return true;
      }
    } catch (error) {
      console.error('[MixRead] 批量添加失败:', error);
    }

    return false;
  }

  /**
   * 检查域名是否被排除
   */
  async isDomainExcluded(url) {
    const blacklist = await this.getBlacklist();
    return this.matchesDomainList(url, blacklist);
  }

  /**
   * 域名匹配逻辑
   */
  matchesDomainList(url, domainList) {
    try {
      const urlObj = new URL(url);
      const currentHost = urlObj.hostname +
        (urlObj.port ? ':' + urlObj.port : '');

      for (let domain of domainList) {
        if (domain === urlObj.hostname || domain === currentHost) {
          return true;
        }

        if (domain.includes('*')) {
          const pattern = domain
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*');
          if (new RegExp('^' + pattern + '$').test(currentHost)) {
            return true;
          }
        }

        if (domain === 'file://' && urlObj.protocol === 'file:') {
          return true;
        }
      }

      return false;
    } catch (e) {
      console.error('[MixRead] 域名匹配错误:', e);
      return false;
    }
  }

  clearCache() {
    this.cachedBlacklist = null;
    this.cachedWhitelist = null;
  }
}
```

---

## 📈 扩展路径

### Phase 1 (当前): 黑名单
```
✅ DomainManagementPolicy 表 (支持多种策略)
✅ 黑名单 API endpoints
✅ 前端黑名单管理
```

### Phase 2 (未来): 添加白名单
```
✅ 重用 DomainManagementPolicy 表
✅ 添加白名单 API endpoints
✅ 前端添加白名单切换
✅ Service 中 should_exclude_domain 已支持白名单逻辑
```

### Phase 3 (未来): 混合模式
```
✅ 同时支持黑名单和白名单
✅ 用户可选择策略类型
✅ Service 中的逻辑已支持混合判断
```

---

## 🎯 迁移说明

### Phase 1 中使用黑名单

**API 调用**: (完全向后兼容，只是endpoint改名)
```
旧: GET /users/{id}/excluded-domains
新: GET /users/{id}/domain-policies/blacklist

旧: POST /users/{id}/excluded-domains
新: POST /users/{id}/domain-policies/blacklist
```

**前端代码**: (只需改类名和方法名)
```javascript
// 旧
const store = new ExclusionStore(apiClient, userId);
await store.addDomain("localhost:8002");

// 新
const store = new DomainPolicyStore(apiClient, userId);
await store.addToBlacklist("localhost:8002");
```

---

## 💡 设计优势

1. **向前兼容**: Phase 1 只使用黑名单，Phase 2 轻松添加白名单
2. **代码复用**: 同一张表，同一套 Repository，轻松支持多种策略
3. **灵活扩展**: 未来可添加更多策略类型（灰名单、优先级等）
4. **清晰架构**: DomainManagementPolicy 概念更通用，便于团队理解
5. **易于维护**: 集中的策略管理，避免重复代码

---

## 📝 数据库迁移

```sql
-- 创建策略类型枚举
CREATE TYPE domain_policy_type AS ENUM ('blacklist', 'whitelist');

-- 创建域名管理策略表
CREATE TABLE domain_management_policies (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(user_id),
    policy_type domain_policy_type NOT NULL DEFAULT 'blacklist',
    domain VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description VARCHAR(500),
    UNIQUE(user_id, policy_type, domain)
);

CREATE INDEX ix_user_policy_domain ON domain_management_policies(user_id, policy_type, domain);
CREATE INDEX ix_user_policy_active ON domain_management_policies(user_id, policy_type, is_active);
```

---

**设计总结**: 使用通用的"域名管理策略"架构，为未来的白名单、混合模式等功能预留空间，同时 Phase 1 只实现黑名单功能。这是一个很有前瞻性的设计！

