# 开始开发 - Domain Exclusion 功能

**现在就开始吧！** 🚀

---

## ⚡ 快速概览

**功能**: 用户可以禁用某些网站的高亮功能

**架构**: 所有数据存放在自有数据库 (简单、可靠、快速)

**预计**: 3 周完成 (Week 1-3)

```
Week 1: 后端 (模型 + API)
Week 2: 前端 UI (Popup + 预设)
Week 3: 集成测试 (content.js)
```

---

## 📍 文档导航

### 必读 (开发必看)
1. **IMPLEMENTATION_PLAN_SIMPLIFIED.md** ⭐ 核心文档
   - 完整的 Week 1-3 实现步骤
   - 所有代码示例（可直接复制）
   - 测试场景清单

### 参考 (遇到问题时查看)
2. **DATA_STORAGE_STRATEGY.md** - 为什么选数据库而不是 Google？
3. **FUTURE_OPTIMIZATION_ROADMAP.md** - 后续怎么优化？
4. **QUICK_REFERENCE_PRESET_FEATURE.md** - 预设功能快速参考

### 已完成 (不用看，除非需要深入了解)
- CLOUD_SYNC_IMPLEMENTATION_GUIDE.md (用了 Google 方案时参考)
- PRD_EXCLUDE_DOMAINS_FEATURE.md (完整需求文档)

---

## 🎯 这周要做什么？

### 今天 (Day 1):
```
[ ] 阅读 IMPLEMENTATION_PLAN_SIMPLIFIED.md 第一部分
[ ] 创建 ExcludedDomainModel (5 分钟，复制即可)
[ ] 运行数据库迁移
[ ] 单元测试通过
```

### 明天 (Day 2-3):
```
[ ] 创建 Repository + Service
[ ] 添加 API endpoints (4 个 CRUD)
[ ] 单元测试通过
[ ] 手动测试 API (curl 或 Postman)
```

### 后天 (Day 4+):
```
[ ] 创建前端 exclusion-store.js
[ ] 创建前端 exclusion-filter.js
[ ] 创建 Popup UI
[ ] 集成 content.js
```

---

## 🔧 快速开发步骤

### Step 1: 后端数据库 (Day 1)

**文件**: `backend/infrastructure/models.py`

复制这段代码到 `UserModel` 之后：

```python
from sqlalchemy import Column, String, DateTime, Integer, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class ExcludedDomainModel(Base):
    """Excluded domains table"""
    __tablename__ = "excluded_domains"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)
    domain = Column(String(255), index=True)
    added_at = Column(DateTime, default=datetime.now)

    __table_args__ = (
        Index("ix_user_domain_excluded", "user_id", "domain", unique=True),
    )

    user = relationship("UserModel", back_populates="excluded_domains")

    def __repr__(self):
        return f"<ExcludedDomainModel user_id={self.user_id} domain={self.domain}>"
```

更新 `UserModel` 添加关系：
```python
class UserModel(Base):
    # ... existing fields ...
    excluded_domains = relationship("ExcludedDomainModel",
                                   back_populates="user",
                                   cascade="all, delete-orphan")
```

**创建迁移**:
```bash
cd backend
# 如果用 Alembic
alembic revision --autogenerate -m "Add excluded_domains table"
alembic upgrade head

# 或手动
sqlite3 mixread.db << EOF
CREATE TABLE excluded_domains (
    id INTEGER PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(user_id),
    UNIQUE(user_id, domain)
);
CREATE INDEX ix_user_domain_excluded ON excluded_domains(user_id, domain);
EOF
```

---

### Step 2: 后端 Repository (Day 2)

**文件**: `backend/infrastructure/repositories.py`

添加这个类（或扩展现有的 Repository）：

```python
class ExcludedDomainRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: str) -> list[str]:
        domains = self.db.query(ExcludedDomainModel.domain)\
            .filter(ExcludedDomainModel.user_id == user_id)\
            .all()
        return [d[0] for d in domains]

    def add_domain(self, user_id: str, domain: str):
        existing = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id, domain=domain)\
            .first()
        if existing:
            return existing
        excluded = ExcludedDomainModel(user_id=user_id, domain=domain)
        self.db.add(excluded)
        self.db.commit()
        self.db.refresh(excluded)
        return excluded

    def remove_domain(self, user_id: str, domain: str) -> bool:
        result = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id, domain=domain)\
            .delete()
        self.db.commit()
        return result > 0

    def clear_all(self, user_id: str) -> int:
        count = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id)\
            .delete()
        self.db.commit()
        return count
```

---

### Step 3: 后端 Service (Day 2)

**文件**: `backend/application/services.py`

添加这个类：

```python
class ExclusionApplicationService:
    def __init__(self, repo: ExcludedDomainRepository):
        self.repo = repo

    def get_excluded_domains(self, user_id: str) -> dict:
        domains = self.repo.get_by_user(user_id)
        return {
            "success": True,
            "data": {
                "user_id": user_id,
                "excluded_domains": domains,
                "count": len(domains)
            }
        }

    def add_domain(self, user_id: str, domain: str) -> dict:
        if not domain or not domain.strip():
            return {"success": False, "error": "Domain cannot be empty"}
        try:
            self.repo.add_domain(user_id, domain.strip())
            return {
                "success": True,
                "data": {"message": f"Domain '{domain}' added"}
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def remove_domain(self, user_id: str, domain: str) -> dict:
        if self.repo.remove_domain(user_id, domain):
            return {
                "success": True,
                "data": {"message": f"Domain '{domain}' removed"}
            }
        return {"success": False, "error": f"Domain '{domain}' not found"}

    def add_multiple_domains(self, user_id: str, domains: list[str]) -> dict:
        added = []
        failed = []
        for domain in domains:
            try:
                self.repo.add_domain(user_id, domain.strip())
                added.append(domain)
            except:
                failed.append(domain)
        return {
            "success": True,
            "data": {"added": added, "failed": failed, "total_added": len(added)}
        }
```

---

### Step 4: 后端 API (Day 2-3)

**文件**: `backend/api/routes.py`

添加这些端点：

```python
from pydantic import BaseModel

class AddDomainRequest(BaseModel):
    domain: str

class AddMultipleDomainsRequest(BaseModel):
    domains: list[str]

@router.get("/{user_id}/excluded-domains")
async def get_excluded_domains(user_id: str, db: Session = Depends(get_db)):
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.get_excluded_domains(user_id)

@router.post("/{user_id}/excluded-domains")
async def add_excluded_domain(user_id: str, request: AddDomainRequest, db: Session = Depends(get_db)):
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.add_domain(user_id, request.domain)

@router.post("/{user_id}/excluded-domains/batch")
async def add_multiple_excluded_domains(user_id: str, request: AddMultipleDomainsRequest, db: Session = Depends(get_db)):
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.add_multiple_domains(user_id, request.domains)

@router.delete("/{user_id}/excluded-domains/{domain}")
async def remove_excluded_domain(user_id: str, domain: str, db: Session = Depends(get_db)):
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.remove_domain(user_id, domain)
```

**测试 API**:
```bash
# 获取排除列表
curl http://localhost:8000/users/test_user/excluded-domains

# 添加域名
curl -X POST http://localhost:8000/users/test_user/excluded-domains \
  -H "Content-Type: application/json" \
  -d '{"domain": "localhost:8002"}'

# 删除域名
curl -X DELETE http://localhost:8000/users/test_user/excluded-domains/localhost:8002
```

---

### Step 5: 前端 Store (Week 2, Day 1)

**文件**: `frontend/modules/exclusion/exclusion-store.js`

```javascript
class ExclusionStore {
  constructor(apiClient, userId) {
    this.apiClient = apiClient;
    this.userId = userId;
    this.cachedDomains = null;
  }

  async getExcludedDomains() {
    if (this.cachedDomains !== null) {
      return this.cachedDomains;
    }
    try {
      const response = await this.apiClient.get(`/users/${this.userId}/excluded-domains`);
      if (response.success) {
        this.cachedDomains = response.data.excluded_domains || [];
        return this.cachedDomains;
      }
    } catch (error) {
      console.error('[MixRead] Failed to get excluded domains:', error);
    }
    return [];
  }

  async addDomain(domain) {
    if (!domain || !domain.trim()) return false;
    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/excluded-domains`,
        { domain: domain.trim() }
      );
      if (response.success && !this.cachedDomains.includes(domain.trim())) {
        this.cachedDomains.push(domain.trim());
      }
      return response.success;
    } catch (error) {
      console.error('[MixRead] Failed to add domain:', error);
      return false;
    }
  }

  async removeDomain(domain) {
    try {
      const response = await this.apiClient.delete(
        `/users/${this.userId}/excluded-domains/${domain}`
      );
      if (response.success) {
        this.cachedDomains = this.cachedDomains.filter(d => d !== domain);
      }
      return response.success;
    } catch (error) {
      console.error('[MixRead] Failed to remove domain:', error);
      return false;
    }
  }

  async addMultipleDomains(domains) {
    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/excluded-domains/batch`,
        { domains: domains }
      );
      if (response.success) {
        this.cachedDomains = null;
        await this.getExcludedDomains();
      }
      return response.success;
    } catch (error) {
      console.error('[MixRead] Failed to add domains:', error);
      return false;
    }
  }

  async isDomainExcluded(url) {
    const domains = await this.getExcludedDomains();
    return this.matchesDomain(url, domains);
  }

  matchesDomain(url, excludedDomains) {
    try {
      const urlObj = new URL(url);
      const currentHost = urlObj.hostname + (urlObj.port ? ':' + urlObj.port : '');
      for (let excluded of excludedDomains) {
        if (excluded === urlObj.hostname || excluded === currentHost) return true;
        if (excluded.includes('*')) {
          const pattern = excluded.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
          if (new RegExp('^' + pattern + '$').test(currentHost)) return true;
        }
        if (excluded === 'file://' && urlObj.protocol === 'file:') return true;
      }
      return false;
    } catch (e) {
      console.error('[MixRead] Domain matching error:', e);
      return false;
    }
  }

  clearCache() {
    this.cachedDomains = null;
  }
}
```

---

### Step 6: 前端 Filter (Week 2, Day 1)

**文件**: `frontend/modules/exclusion/exclusion-filter.js`

```javascript
class ExclusionFilter {
  constructor(exclusionStore) {
    this.exclusionStore = exclusionStore;
  }

  async shouldExcludeDomain(url) {
    try {
      const isExcluded = await this.exclusionStore.isDomainExcluded(url);
      if (isExcluded) {
        console.log('[MixRead] Website excluded:', url);
      }
      return isExcluded;
    } catch (error) {
      console.error('[MixRead] Error checking exclusion:', error);
      return false;
    }
  }
}
```

---

### Step 7: 集成 content.js (Week 3)

**文件**: `frontend/content.js` (顶部添加)

```javascript
async function checkAndInitialize() {
  try {
    const userId = localStorage.getItem('user_id') || 'default_user';
    const exclusionStore = new ExclusionStore(apiClient, userId);
    const filter = new ExclusionFilter(exclusionStore);

    const isExcluded = await filter.shouldExcludeDomain(window.location.href);
    if (isExcluded) {
      console.log('[MixRead] Plugin disabled for this website');
      return;
    }

    // 继续加载其他功能...
    initializeHighlight();
  } catch (error) {
    console.error('[MixRead] Initialization failed:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInitialize);
} else {
  checkAndInitialize();
}
```

---

## ✅ 检查清单

### Day 1 (后端模型):
```
[ ] ExcludedDomainModel 创建
[ ] 数据库迁移成功
[ ] 检查表是否创建
```

### Day 2-3 (后端 API):
```
[ ] Repository 实现
[ ] Service 实现
[ ] 4 个 API endpoints 添加
[ ] API 测试通过 (curl)
```

### Day 4-5 (前端 Store):
```
[ ] exclusion-store.js 创建
[ ] exclusion-filter.js 创建
[ ] 浏览器控制台测试
```

### Day 6-7 (content.js 集成):
```
[ ] 集成到 content.js
[ ] 测试：访问 localhost:8002 → 无高亮
[ ] 测试：访问 github.com → 有高亮
```

---

## 🐛 常见问题

**Q: 代码在哪里找？**
A: 全部在 `IMPLEMENTATION_PLAN_SIMPLIFIED.md` 里，复制即可

**Q: 数据库怎么迁移？**
A: 用 Alembic (如果有) 或手动 SQL

**Q: API 怎么测试？**
A: 用 curl 或 Postman，见上面的 Step 4

**Q: 怎么调试前端？**
A: Chrome DevTools Console，会输出 `[MixRead]` 日志

**Q: 出错了怎么办？**
A: 查看 `IMPLEMENTATION_PLAN_SIMPLIFIED.md` 的测试章节

---

## 📞 需要帮助？

查看这些文档：
1. **出错时**: 查看 IMPLEMENTATION_PLAN_SIMPLIFIED.md 的测试部分
2. **架构问题**: 查看 DATA_STORAGE_STRATEGY.md
3. **功能细节**: 查看 QUICK_REFERENCE_PRESET_FEATURE.md
4. **深度了解**: 查看 PRD_EXCLUDE_DOMAINS_FEATURE.md

---

## 🚀 现在就开始！

打开 `IMPLEMENTATION_PLAN_SIMPLIFIED.md`，从 **Day 1: 数据库 + Repository + Service** 开始！

**预计 3 周完成。** 加油！ 💪

