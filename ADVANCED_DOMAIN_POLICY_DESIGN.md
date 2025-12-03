# 高级域名管理策略设计

**日期**: 2025-12-02
**需求**: 支持多层级、精细化的域名管理策略
**场景**: 在某个域名下允许，但某个具体 URL 在黑名单中

---

## 🎯 核心需求分析

### 场景示例

```
Phase 1 (当前):
  用户希望: 禁用 github.com 的高亮
  方式: 添加 github.com 到黑名单
  结果: github.com 下所有 URL 都无高亮

Phase 2 (未来):
  用户希望: github.com 下允许高亮，但 github.com/admin 的高亮禁用
  方式:
    1. github.com 添加到白名单 (允许)
    2. github.com/admin* 添加到黑名单 (禁用)
  结果:
    - github.com 及其子页面: 高亮
    - github.com/admin 及其下级: 无高亮

Phase 3 (未来):
  用户希望:
    - localhost:8000 的所有页面都不高亮 (黑名单)
    - localhost:3000 的所有页面允许高亮 (白名单)
    - localhost:3000/settings/* 的页面不高亮 (特定 URL 黑名单)
  方式: 支持域名级别、URL 级别的多层策略
```

---

## 📊 增强的数据库设计

### 策略级别定义

```python
from enum import Enum

class DomainPolicyLevel(str, Enum):
    """策略应用的级别"""
    DOMAIN = "domain"          # 整个域名 (例: github.com)
    PATH = "path"              # 特定路径 (例: github.com/admin)
    URL_PATTERN = "url_pattern" # URL 模式 (例: github.com/api/*)

class DomainPolicyType(str, Enum):
    """策略类型"""
    BLACKLIST = "blacklist"    # 黑名单: 禁用高亮
    WHITELIST = "whitelist"    # 白名单: 允许高亮
```

### 增强的表结构

```python
from sqlalchemy import Column, String, DateTime, Enum, Boolean, Integer, Index, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

class DomainManagementPolicy(Base):
    """
    域名管理策略表 (增强版)
    支持多层级、精细化的策略管理

    Examples:
      1. github.com (黑名单) → github.com 所有页面无高亮
      2. github.com (白名单) + github.com/admin (黑名单) → admin 页面无高亮
      3. github.com/api/* (黑名单) → 匹配模式的 URL 无高亮
    """
    __tablename__ = "domain_management_policies"

    # ========== 主键和关联 ==========
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)

    # ========== 策略类型 ==========
    policy_type = Column(
        Enum(DomainPolicyType),
        default=DomainPolicyType.BLACKLIST,
        index=True
    )

    # ========== 策略应用级别 ==========
    policy_level = Column(
        Enum(DomainPolicyLevel),
        default=DomainPolicyLevel.DOMAIN,
        index=True
    )

    # ========== 策略目标 ==========
    # 根据 policy_level 的含义不同:
    # - DOMAIN 级别: "github.com" (只是域名)
    # - PATH 级别: "github.com/admin" (域名 + 路径)
    # - URL_PATTERN 级别: "github.com/api/*" (支持通配符)
    target = Column(String(500), index=True)

    # ========== 优先级 ==========
    # 优先级更高的策略先匹配
    # 例: github.com/admin (优先级 2) 会覆盖 github.com (优先级 1)
    priority = Column(Integer, default=0, index=True)

    # ========== 其他字段 ==========
    is_active = Column(Boolean, default=True, index=True)
    added_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    description = Column(Text, nullable=True)

    # ========== 联合唯一约束 ==========
    __table_args__ = (
        # 同一用户不能有两个完全相同的策略
        Index(
            "ix_user_policy_target",
            "user_id",
            "policy_type",
            "policy_level",
            "target",
            unique=True
        ),
        # 优先级索引
        Index("ix_user_priority", "user_id", "policy_type", "priority"),
    )

    # 关系
    user = relationship("UserModel", back_populates="domain_management_policies")

    def __repr__(self):
        return f"<DomainManagementPolicy user={self.user_id} type={self.policy_type} level={self.policy_level} target={self.target} priority={self.priority}>"
```

---

## 🔍 核心匹配逻辑

```python
class DomainMatchingEngine:
    """
    域名匹配引擎

    匹配规则:
    1. 按优先级从高到低遍历策略
    2. 找到第一个匹配的策略即返回
    3. 如果有白名单，默认结果相反
    """

    @staticmethod
    def should_exclude_domain(user_id: str, url: str, policies: list) -> bool:
        """
        判断是否应该排除该 URL 的高亮

        Args:
            user_id: 用户 ID
            url: 当前 URL
            policies: 用户的所有策略 (按优先级排序)

        Returns:
            True: 排除高亮
            False: 不排除高亮

        逻辑:
        1. 按优先级从高到低遍历策略
        2. 找到第一个匹配的黑名单策略 → 返回 True (排除)
        3. 找到第一个匹配的白名单策略 → 继续寻找黑名单
        4. 如果找到白名单但没有黑名单匹配 → 返回 False (不排除)
        5. 如果没有白名单 → 默认返回 False (不排除)
        """

        # 按优先级排序 (高优先级先)
        sorted_policies = sorted(
            policies,
            key=lambda p: p['priority'],
            reverse=True
        )

        matched_blacklist = None
        matched_whitelist = None

        for policy in sorted_policies:
            if not policy['is_active']:
                continue

            # 检查是否匹配该策略
            if DomainMatchingEngine.matches_policy(url, policy):
                if policy['policy_type'] == DomainPolicyType.BLACKLIST:
                    matched_blacklist = policy
                    # 黑名单优先级最高，立即返回
                    return True

                elif policy['policy_type'] == DomainPolicyType.WHITELIST:
                    if not matched_whitelist:
                        matched_whitelist = policy

        # 逻辑总结:
        # 1. 如果找到黑名单匹配 → 排除 (已在上面返回)
        # 2. 如果有白名单但没有黑名单匹配 → 不排除
        # 3. 如果没有任何匹配 → 不排除 (默认行为)

        return False

    @staticmethod
    def matches_policy(url: str, policy: dict) -> bool:
        """
        检查 URL 是否匹配策略

        Args:
            url: 当前 URL
            policy: 策略字典

        Returns:
            True: 匹配
            False: 不匹配
        """
        from urllib.parse import urlparse

        try:
            parsed = urlparse(url)
            hostname = parsed.hostname or ''
            path = parsed.path or ''
            full_url = f"{hostname}{path}"

            target = policy['target']
            level = policy['policy_level']

            # ========== 域名级别匹配 ==========
            if level == DomainPolicyLevel.DOMAIN:
                # 精确匹配: github.com == github.com
                if hostname == target:
                    return True
                # 通配符: *.github.com 匹配 api.github.com
                if target.startswith('*.'):
                    domain_pattern = target[2:]  # 移除 *.
                    if hostname.endswith('.' + domain_pattern) or hostname == domain_pattern:
                        return True

            # ========== 路径级别匹配 ==========
            elif level == DomainPolicyLevel.PATH:
                # github.com/admin 匹配:
                # - github.com/admin (精确)
                # - github.com/admin/users (路径下级)
                if '/' in target:
                    target_domain, target_path = target.split('/', 1)
                    if hostname == target_domain:
                        # 检查路径是否匹配
                        if path.startswith('/' + target_path) or path == '/' + target_path:
                            return True

            # ========== URL 模式匹配 ==========
            elif level == DomainPolicyLevel.URL_PATTERN:
                # github.com/api/* 匹配:
                # - github.com/api/users
                # - github.com/api/repos/search
                import re
                pattern = target.replace('.', r'\.').replace('*', '.*')
                if re.match(f"^{pattern}$", full_url):
                    return True

            return False

        except Exception as e:
            print(f"[MixRead] Error in policy matching: {e}")
            return False
```

---

## 🏗️ 增强的 Repository

```python
class DomainManagementPolicyRepository:
    """域名管理策略仓储 (增强版)"""

    def __init__(self, db: Session):
        self.db = db

    # ========== 添加策略 ==========

    def add_policy(
        self,
        user_id: str,
        policy_type: DomainPolicyType,
        policy_level: DomainPolicyLevel,
        target: str,
        priority: int = 0,
        description: str = None
    ) -> DomainManagementPolicy:
        """添加策略"""
        policy = DomainManagementPolicy(
            user_id=user_id,
            policy_type=policy_type,
            policy_level=policy_level,
            target=target,
            priority=priority,
            description=description
        )
        self.db.add(policy)
        self.db.commit()
        self.db.refresh(policy)
        return policy

    # ========== 获取策略 ==========

    def get_user_policies(self, user_id: str, active_only: bool = True) -> list:
        """获取用户的所有策略 (按优先级排序)"""
        query = self.db.query(DomainManagementPolicy)\
            .filter(DomainManagementPolicy.user_id == user_id)

        if active_only:
            query = query.filter(DomainManagementPolicy.is_active == True)

        return query.order_by(
            DomainManagementPolicy.priority.desc(),
            DomainManagementPolicy.added_at.asc()
        ).all()

    def get_policies_by_type(
        self,
        user_id: str,
        policy_type: DomainPolicyType
    ) -> list:
        """获取特定类型的策略"""
        return self.db.query(DomainManagementPolicy)\
            .filter(
                DomainManagementPolicy.user_id == user_id,
                DomainManagementPolicy.policy_type == policy_type,
                DomainManagementPolicy.is_active == True
            )\
            .order_by(DomainManagementPolicy.priority.desc())\
            .all()

    # ========== 更新策略 ==========

    def update_priority(self, policy_id: int, new_priority: int) -> bool:
        """更新策略优先级"""
        policy = self.db.query(DomainManagementPolicy)\
            .filter(DomainManagementPolicy.id == policy_id)\
            .first()

        if policy:
            policy.priority = new_priority
            self.db.commit()
            return True
        return False

    # ========== 删除策略 ==========

    def soft_delete(self, policy_id: int) -> bool:
        """软删除策略 (禁用而不删除)"""
        policy = self.db.query(DomainManagementPolicy)\
            .filter(DomainManagementPolicy.id == policy_id)\
            .first()

        if policy:
            policy.is_active = False
            self.db.commit()
            return True
        return False
```

---

## 🎯 增强的 Service

```python
class DomainManagementService:
    """域名管理服务 (增强版)"""

    def __init__(self, repo: DomainManagementPolicyRepository):
        self.repo = repo
        self.matching_engine = DomainMatchingEngine()

    def should_exclude_domain(self, user_id: str, url: str) -> bool:
        """
        判断是否应该排除该 URL 的高亮

        支持的场景:
        1. 整个域名黑名单: github.com
        2. 路径级别黑名单: github.com/admin
        3. URL 模式黑名单: github.com/api/*
        4. 白名单优先级低于黑名单
        """
        policies = self.repo.get_user_policies(user_id)

        # 转换为字典列表便于处理
        policy_dicts = [
            {
                'policy_type': p.policy_type,
                'policy_level': p.policy_level,
                'target': p.target,
                'priority': p.priority,
                'is_active': p.is_active
            }
            for p in policies
        ]

        return self.matching_engine.should_exclude_domain(user_id, url, policy_dicts)

    # ========== 黑名单操作 ==========

    def add_to_blacklist(
        self,
        user_id: str,
        target: str,
        level: str = "domain",
        priority: int = 0,
        description: str = None
    ) -> dict:
        """添加黑名单"""
        try:
            self.repo.add_policy(
                user_id,
                DomainPolicyType.BLACKLIST,
                DomainPolicyLevel(level),
                target,
                priority,
                description
            )
            return {
                "success": True,
                "data": {"message": f"Added to blacklist: {target}"}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ========== 白名单操作 ==========

    def add_to_whitelist(
        self,
        user_id: str,
        target: str,
        level: str = "domain",
        priority: int = 0,
        description: str = None
    ) -> dict:
        """添加白名单"""
        try:
            self.repo.add_policy(
                user_id,
                DomainPolicyType.WHITELIST,
                DomainPolicyLevel(level),
                target,
                priority,
                description
            )
            return {
                "success": True,
                "data": {"message": f"Added to whitelist: {target}"}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ========== 通用操作 ==========

    def get_user_policies(self, user_id: str) -> dict:
        """获取用户的所有策略"""
        policies = self.repo.get_user_policies(user_id)

        result = {
            "blacklist": [],
            "whitelist": []
        }

        for policy in policies:
            policy_info = {
                "id": policy.id,
                "level": policy.policy_level.value,
                "target": policy.target,
                "priority": policy.priority,
                "description": policy.description,
                "added_at": policy.added_at.isoformat()
            }

            if policy.policy_type == DomainPolicyType.BLACKLIST:
                result["blacklist"].append(policy_info)
            else:
                result["whitelist"].append(policy_info)

        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "policies": result
            }
        }
```

---

## 🌐 使用示例

### Phase 1 (当前): 简单黑名单

```javascript
// 禁用整个域名
await service.add_to_blacklist(
  user_id="user123",
  target="github.com",
  level="domain"  // DOMAIN 级别
);

// 用户访问 github.com 的任何页面 → 都无高亮
```

### Phase 2 (未来): 多层策略

```javascript
// 设置 1: 白名单允许 github.com
await service.add_to_whitelist(
  user_id="user123",
  target="github.com",
  level="domain",
  priority=1  // 低优先级
);

// 设置 2: 黑名单禁用 github.com/admin
await service.add_to_blacklist(
  user_id="user123",
  target="github.com/admin",
  level="path",
  priority=2  // 高优先级 → 覆盖白名单
);

// 设置 3: 黑名单禁用 API
await service.add_to_blacklist(
  user_id="user123",
  target="github.com/api/*",
  level="url_pattern",
  priority=2
);

// 结果:
// - github.com → 有高亮 (白名单允许)
// - github.com/admin → 无高亮 (黑名单覆盖，优先级 2)
// - github.com/api/repos → 无高亮 (黑名单 URL 模式)
// - github.com/profile → 有高亮 (白名单允许)
```

---

## 📊 优先级逻辑详解

```
同一用户的策略评估流程:

URL: github.com/admin/users

第 1 步: 获取所有活跃策略，按优先级排序

优先级 3: github.com/admin/* (黑名单)
优先级 2: github.com/admin (黑名单)  ← 优先匹配
优先级 1: github.com (白名单)

第 2 步: 从高优先级开始匹配

优先级 3: github.com/admin/*
  URL: github.com/admin/users
  匹配: ✓ YES
  类型: 黑名单
  结果: EXCLUDE (不加载高亮)

返回结果: 排除高亮
```

---

## 💡 设计优势

1. **多层级支持**
   - 域名级别 (github.com)
   - 路径级别 (github.com/admin)
   - URL 模式级别 (github.com/api/*)

2. **优先级机制**
   - 高优先级策略覆盖低优先级
   - 黑名单优先于白名单
   - 灵活的优先级调整

3. **向前兼容**
   - Phase 1 只用黑名单 (域名级别)
   - Phase 2 可轻松添加白名单和路径级别
   - Phase 3 可支持更复杂的规则组合

4. **易于理解和管理**
   - 清晰的优先级体系
   - 直观的匹配逻辑
   - 支持备注和描述

---

## 🎯 实施建议

### Phase 1 (当前): 域名级别黑名单
```
✅ 只支持 DOMAIN 级别
✅ 只支持 BLACKLIST 类型
✅ 不需要优先级 (都是 0)
✅ 用户界面简洁
```

### Phase 2 (未来): 添加路径级别
```
✅ 支持 DOMAIN 和 PATH 级别
✅ 支持 BLACKLIST 和 WHITELIST
✅ 优先级开始发挥作用
✅ 用户界面添加"高级选项"
```

### Phase 3 (未来): 完整支持
```
✅ 支持所有级别
✅ 支持所有类型
✅ 灵活的优先级管理
✅ UI 升级，用户可看到优先级树
```

---

**总结**: 这个设计为未来的精细化域名管理预留了充足的空间，同时 Phase 1 保持简洁易用。完美！🎉

