# Domain Exclusion 功能 - 简化实现计划

**策略**: 所有数据存放在自有数据库，使用现有 API 模式

**预计周期**: 3 周 (Week 1-3)

**难度**: ⭐ (简单，复制现有代码模式)

---

## 📊 总体架构

```
Chrome Extension (前端)
    ↓
FastAPI Backend (现有)
    ↓
SQLAlchemy ORM
    ↓
SQLite/MySQL Database (现有)

所有数据:
  ├─ excluded_domains (新增)
  ├─ known_words (现有)
  ├─ unknown_words (现有)
  ├─ vocabulary_entries (现有)
  └─ library_entries (现有)
```

**为什么简单**:
- ✅ 数据库设计已验证 (ORM 模式成熟)
- ✅ API 模式已存在 (可直接复制)
- ✅ 前端调用方式已熟悉
- ✅ 无需处理 Google Storage 复杂性
- ✅ 无需处理跨设备同步冲突

---

## 🔧 Week 1: 后端开发

### Day 1: 数据库 + Repository + Service

#### 1. 添加数据库表模型

**文件**: `backend/infrastructure/models.py`

```python
from sqlalchemy import Column, String, DateTime, Integer, Index, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

class ExcludedDomainModel(Base):
    """Excluded domains table - domains where extension is disabled"""
    __tablename__ = "excluded_domains"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(255), ForeignKey("users.user_id"), index=True)
    domain = Column(String(255), index=True)
    added_at = Column(DateTime, default=datetime.now)

    # Unique constraint: one domain per user
    __table_args__ = (
        Index("ix_user_domain_excluded", "user_id", "domain", unique=True),
    )

    # Relationship
    user = relationship("UserModel", back_populates="excluded_domains")

    def __repr__(self):
        return f"<ExcludedDomainModel user_id={self.user_id} domain={self.domain}>"
```

**更新** `UserModel`:
```python
class UserModel(Base):
    # ... existing fields ...

    # Add relationship
    excluded_domains = relationship("ExcludedDomainModel",
                                   back_populates="user",
                                   cascade="all, delete-orphan")
```

**迁移数据库**:
```bash
# 如果使用 Alembic
alembic revision --autogenerate -m "Add excluded_domains table"
alembic upgrade head

# 或手动创建
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

#### 2. 创建 Repository

**文件**: `backend/infrastructure/repositories.py`

```python
from infrastructure.models import ExcludedDomainModel
from sqlalchemy.orm import Session

class ExcludedDomainRepository:
    """Repository for excluded domains"""

    def __init__(self, db: Session):
        self.db = db

    def get_by_user(self, user_id: str) -> list[str]:
        """Get all excluded domains for a user"""
        domains = self.db.query(ExcludedDomainModel.domain)\
            .filter(ExcludedDomainModel.user_id == user_id)\
            .all()
        return [d[0] for d in domains]

    def add_domain(self, user_id: str, domain: str) -> ExcludedDomainModel:
        """Add a domain to user's exclusion list"""
        # Check if already exists
        existing = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id, domain=domain)\
            .first()

        if existing:
            return existing

        # Create new
        excluded = ExcludedDomainModel(user_id=user_id, domain=domain)
        self.db.add(excluded)
        self.db.commit()
        self.db.refresh(excluded)
        return excluded

    def remove_domain(self, user_id: str, domain: str) -> bool:
        """Remove a domain from user's exclusion list"""
        result = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id, domain=domain)\
            .delete()
        self.db.commit()
        return result > 0

    def clear_all(self, user_id: str) -> int:
        """Clear all excluded domains for a user"""
        count = self.db.query(ExcludedDomainModel)\
            .filter_by(user_id=user_id)\
            .delete()
        self.db.commit()
        return count
```

#### 3. 创建 Service (Application Layer)

**文件**: `backend/application/services.py`

```python
from infrastructure.repositories import ExcludedDomainRepository

class ExclusionApplicationService:
    """Business logic for domain exclusion"""

    def __init__(self, repo: ExcludedDomainRepository):
        self.repo = repo

    def get_excluded_domains(self, user_id: str) -> dict:
        """Get list of excluded domains"""
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
        """Add a domain to exclusion list"""
        if not domain or not domain.strip():
            return {"success": False, "error": "Domain cannot be empty"}

        try:
            self.repo.add_domain(user_id, domain.strip())
            return {
                "success": True,
                "data": {
                    "message": f"Domain '{domain}' added to exclusion list",
                    "domain": domain
                }
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def remove_domain(self, user_id: str, domain: str) -> dict:
        """Remove a domain from exclusion list"""
        if self.repo.remove_domain(user_id, domain):
            return {
                "success": True,
                "data": {
                    "message": f"Domain '{domain}' removed from exclusion list",
                    "domain": domain
                }
            }
        else:
            return {
                "success": False,
                "error": f"Domain '{domain}' not found"
            }

    def add_multiple_domains(self, user_id: str, domains: list[str]) -> dict:
        """Add multiple domains (for preset initialization)"""
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
            "data": {
                "added": added,
                "failed": failed,
                "total_added": len(added)
            }
        }
```

#### 4. 添加 API Endpoints

**文件**: `backend/api/routes.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from infrastructure.database import get_db
from infrastructure.repositories import ExcludedDomainRepository
from application.services import ExclusionApplicationService

# Request models
class AddDomainRequest(BaseModel):
    domain: str

class AddMultipleDomainsRequest(BaseModel):
    domains: list[str]

# Routes
@router.get("/{user_id}/excluded-domains")
async def get_excluded_domains(user_id: str, db: Session = Depends(get_db)):
    """Get user's excluded domains list"""
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.get_excluded_domains(user_id)

@router.post("/{user_id}/excluded-domains")
async def add_excluded_domain(
    user_id: str,
    request: AddDomainRequest,
    db: Session = Depends(get_db)
):
    """Add a domain to exclusion list"""
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.add_domain(user_id, request.domain)

@router.post("/{user_id}/excluded-domains/batch")
async def add_multiple_excluded_domains(
    user_id: str,
    request: AddMultipleDomainsRequest,
    db: Session = Depends(get_db)
):
    """Add multiple domains (for preset initialization)"""
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.add_multiple_domains(user_id, request.domains)

@router.delete("/{user_id}/excluded-domains/{domain}")
async def remove_excluded_domain(
    user_id: str,
    domain: str,
    db: Session = Depends(get_db)
):
    """Remove a domain from exclusion list"""
    repo = ExcludedDomainRepository(db)
    service = ExclusionApplicationService(repo)
    return service.remove_domain(user_id, domain)
```

#### 5. 单元测试

**文件**: `backend/tests/test_exclusion.py`

```python
import pytest
from fastapi.testclient import TestClient
from main import app
from infrastructure.database import get_db
from infrastructure.models import UserModel, ExcludedDomainModel

client = TestClient(app)

def test_get_excluded_domains_empty(db_session):
    """Test getting excluded domains for user with no exclusions"""
    # Create user
    user = UserModel(user_id="test_user_1")
    db_session.add(user)
    db_session.commit()

    response = client.get("/users/test_user_1/excluded-domains")
    assert response.status_code == 200
    assert response.json()["data"]["count"] == 0

def test_add_excluded_domain(db_session):
    """Test adding a domain to exclusion list"""
    user = UserModel(user_id="test_user_2")
    db_session.add(user)
    db_session.commit()

    response = client.post("/users/test_user_2/excluded-domains", json={
        "domain": "localhost:8002"
    })
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify it was added
    response = client.get("/users/test_user_2/excluded-domains")
    assert "localhost:8002" in response.json()["data"]["excluded_domains"]

def test_remove_excluded_domain(db_session):
    """Test removing a domain from exclusion list"""
    user = UserModel(user_id="test_user_3")
    db_session.add(user)
    excluded = ExcludedDomainModel(user_id="test_user_3", domain="localhost:8002")
    db_session.add(excluded)
    db_session.commit()

    response = client.delete("/users/test_user_3/excluded-domains/localhost:8002")
    assert response.status_code == 200
    assert response.json()["success"] is True

def test_add_multiple_domains(db_session):
    """Test adding multiple domains at once"""
    user = UserModel(user_id="test_user_4")
    db_session.add(user)
    db_session.commit()

    response = client.post("/users/test_user_4/excluded-domains/batch", json={
        "domains": ["localhost:8002", "localhost:3000", "127.0.0.1:8000"]
    })
    assert response.status_code == 200
    assert response.json()["data"]["total_added"] == 3

def test_duplicate_domain(db_session):
    """Test adding duplicate domain (should be idempotent)"""
    user = UserModel(user_id="test_user_5")
    db_session.add(user)
    db_session.commit()

    # Add first time
    client.post("/users/test_user_5/excluded-domains", json={
        "domain": "localhost:8002"
    })

    # Add same domain again
    response = client.post("/users/test_user_5/excluded-domains", json={
        "domain": "localhost:8002"
    })
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify only one exists
    response = client.get("/users/test_user_5/excluded-domains")
    assert response.json()["data"]["count"] == 1
```

**运行测试**:
```bash
cd backend
pytest tests/test_exclusion.py -v
```

### Day 2-3: 前端基础模块

#### 1. ExclusionStore (调用 API)

**文件**: `frontend/modules/exclusion/exclusion-store.js`

```javascript
/**
 * ExclusionStore - 管理排除域名列表
 * 所有数据通过后端 API 存储在数据库中
 */

class ExclusionStore {
  constructor(apiClient, userId) {
    this.apiClient = apiClient;
    this.userId = userId;
    this.cachedDomains = null; // 本地缓存，加快查询
  }

  /**
   * 获取排除域名列表
   */
  async getExcludedDomains() {
    // 先返回缓存（快速）
    if (this.cachedDomains !== null) {
      return this.cachedDomains;
    }

    // 从服务器获取
    try {
      const response = await this.apiClient.get(
        `/users/${this.userId}/excluded-domains`
      );

      if (response.success) {
        this.cachedDomains = response.data.excluded_domains || [];
        return this.cachedDomains;
      }
    } catch (error) {
      console.error('[MixRead] 获取排除列表失败:', error);
    }

    return [];
  }

  /**
   * 添加排除域名
   */
  async addDomain(domain) {
    if (!domain || !domain.trim()) {
      console.error('[MixRead] 域名不能为空');
      return false;
    }

    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/excluded-domains`,
        { domain: domain.trim() }
      );

      if (response.success) {
        // 更新缓存
        if (!this.cachedDomains.includes(domain.trim())) {
          this.cachedDomains.push(domain.trim());
        }
        console.log('[MixRead] 域名已添加:', domain);
        return true;
      }
    } catch (error) {
      console.error('[MixRead] 添加域名失败:', error);
    }

    return false;
  }

  /**
   * 删除排除域名
   */
  async removeDomain(domain) {
    try {
      const response = await this.apiClient.delete(
        `/users/${this.userId}/excluded-domains/${domain}`
      );

      if (response.success) {
        // 更新缓存
        this.cachedDomains = this.cachedDomains.filter(d => d !== domain);
        console.log('[MixRead] 域名已删除:', domain);
        return true;
      }
    } catch (error) {
      console.error('[MixRead] 删除域名失败:', error);
    }

    return false;
  }

  /**
   * 批量添加域名（用于预设初始化）
   */
  async addMultipleDomains(domains) {
    try {
      const response = await this.apiClient.post(
        `/users/${this.userId}/excluded-domains/batch`,
        { domains: domains }
      );

      if (response.success) {
        // 刷新缓存
        this.cachedDomains = null;
        await this.getExcludedDomains();
        console.log('[MixRead] 批量添加域名成功:', response.data.total_added);
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
    const domains = await this.getExcludedDomains();
    return this.matchesDomain(url, domains);
  }

  /**
   * 域名匹配逻辑
   * 支持: 精确匹配、通配符、IP 地址、文件协议
   */
  matchesDomain(url, excludedDomains) {
    try {
      const urlObj = new URL(url);
      const currentHost = urlObj.hostname +
        (urlObj.port ? ':' + urlObj.port : '');

      for (let excluded of excludedDomains) {
        // 精确匹配: github.com === github.com
        if (excluded === urlObj.hostname || excluded === currentHost) {
          return true;
        }

        // 通配符: localhost:* 匹配 localhost:8000, localhost:8001 等
        if (excluded.includes('*')) {
          const pattern = excluded
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\*/g, '.*');
          if (new RegExp('^' + pattern + '$').test(currentHost)) {
            return true;
          }
        }

        // 文件协议: file://
        if (excluded === 'file://' && urlObj.protocol === 'file:') {
          return true;
        }
      }

      return false;
    } catch (e) {
      console.error('[MixRead] 域名匹配错误:', e);
      return false;
    }
  }

  /**
   * 清空本地缓存（刷新数据）
   */
  clearCache() {
    this.cachedDomains = null;
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExclusionStore;
}
```

#### 2. ExclusionFilter（域名检查）

**文件**: `frontend/modules/exclusion/exclusion-filter.js`

```javascript
/**
 * ExclusionFilter - 检查 URL 是否应该被排除
 */

class ExclusionFilter {
  constructor(exclusionStore) {
    this.exclusionStore = exclusionStore;
  }

  /**
   * 判断当前 URL 是否应该排除
   */
  async shouldExcludeDomain(url) {
    try {
      const isExcluded = await this.exclusionStore.isDomainExcluded(url);
      if (isExcluded) {
        console.log('[MixRead] 此网站被排除:', url);
      }
      return isExcluded;
    } catch (error) {
      console.error('[MixRead] 检查排除列表出错:', error);
      // 失败时默认不排除（允许加载）
      return false;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExclusionFilter;
}
```

---

## 🎨 Week 2: 前端 UI

### Day 1-2: Popup 界面

**文件**: `frontend/popup.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>MixRead - Domain Exclusion</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f9f9f9;
      color: #333;
    }

    .container {
      padding: 15px;
    }

    .section {
      background: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Current Page Control */
    #current-page {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }

    #current-page .label {
      font-size: 12px;
      opacity: 0.9;
      margin-bottom: 5px;
    }

    #current-domain {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 10px;
      word-break: break-all;
    }

    #current-status {
      font-size: 12px;
      padding: 4px 8px;
      background: rgba(255,255,255,0.2);
      border-radius: 4px;
      display: inline-block;
      margin-bottom: 10px;
    }

    #toggle-current {
      width: 100%;
      padding: 10px;
      background: rgba(255,255,255,0.2);
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
    }

    #toggle-current:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Excluded Domains List */
    .domains-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    #domains-count {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    #domains-list {
      list-style: none;
      max-height: 200px;
      overflow-y: auto;
    }

    .domain-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 4px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .domain-item:hover {
      background: #eee;
    }

    .domain-item .domain-name {
      flex: 1;
      word-break: break-all;
    }

    .domain-item .delete-btn {
      background: #ff6b6b;
      color: white;
      border: none;
      border-radius: 3px;
      padding: 4px 8px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }

    .domain-item .delete-btn:hover {
      background: #ff5252;
    }

    /* Add Domain Form */
    .add-domain-form {
      display: flex;
      gap: 8px;
    }

    #new-domain {
      flex: 1;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 12px;
    }

    #new-domain:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
    }

    #add-btn {
      padding: 8px 15px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }

    #add-btn:hover {
      background: #5568d3;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 20px;
      color: #999;
      font-size: 13px;
    }

    .empty-state p {
      margin: 10px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Current Page Control -->
    <div id="current-page">
      <div class="label">当前页面</div>
      <div id="current-domain">加载中...</div>
      <div id="current-status">✓ 启用</div>
      <button id="toggle-current">禁用此网站</button>
    </div>

    <!-- Excluded Domains List -->
    <div class="section">
      <div class="domains-header">
        <span class="section-title">被排除的网站</span>
        <span id="domains-count">0</span>
      </div>
      <ul id="domains-list"></ul>
      <div id="empty-domains" class="empty-state">
        <p>暂无排除的网站</p>
      </div>
    </div>

    <!-- Add Domain Form -->
    <div class="section">
      <div class="section-title">添加网站</div>
      <div class="add-domain-form">
        <input
          type="text"
          id="new-domain"
          placeholder="输入域名 (例: localhost:8002)"
          autocomplete="off"
        />
        <button id="add-btn">添加</button>
      </div>
    </div>
  </div>

  <script src="/scripts/api-client.js"></script>
  <script src="/modules/exclusion/exclusion-store.js"></script>
  <script src="/popup.js"></script>
</body>
</html>
```

**文件**: `frontend/popup.js`

```javascript
let exclusionStore;
let currentTabUrl;

/**
 * 初始化 Popup
 */
async function initializePopup() {
  try {
    // 获取当前标签页信息
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabUrl = tabs[0]?.url || '';

    // 获取用户 ID (从 localStorage)
    const userId = localStorage.getItem('user_id') || 'default_user';

    // 初始化 ExclusionStore
    exclusionStore = new ExclusionStore(apiClient, userId);

    // 更新 UI
    updateCurrentPageUI();
    updateDomainsList();

    // 绑定事件
    bindEvents();

  } catch (error) {
    console.error('[MixRead] Popup 初始化失败:', error);
  }
}

/**
 * 更新当前页面的 UI
 */
async function updateCurrentPageUI() {
  const domain = extractDomain(currentTabUrl);
  const domains = await exclusionStore.getExcludedDomains();
  const isExcluded = domains.includes(domain) || domains.includes(domain.split(':')[0]);

  document.getElementById('current-domain').textContent = domain || '(无法识别)';
  document.getElementById('current-status').textContent =
    isExcluded ? '✗ 已禁用' : '✓ 启用';
  document.getElementById('current-status').style.background =
    isExcluded ? 'rgba(255,107,107,0.2)' : 'rgba(76,175,80,0.2)';

  const toggleBtn = document.getElementById('toggle-current');
  toggleBtn.textContent = isExcluded ? '启用此网站' : '禁用此网站';
}

/**
 * 更新排除列表 UI
 */
async function updateDomainsList() {
  const domains = await exclusionStore.getExcludedDomains();
  const listEl = document.getElementById('domains-list');
  const countEl = document.getElementById('domains-count');
  const emptyEl = document.getElementById('empty-domains');

  countEl.textContent = domains.length;

  if (domains.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
  } else {
    emptyEl.style.display = 'none';
    listEl.innerHTML = domains.map(domain => `
      <li class="domain-item">
        <span class="domain-name">${domain}</span>
        <button class="delete-btn" data-domain="${domain}">删除</button>
      </li>
    `).join('');
  }
}

/**
 * 提取域名（从 URL）
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const port = urlObj.port;
    return port ? `${hostname}:${port}` : hostname;
  } catch (e) {
    return '';
  }
}

/**
 * 显示通知
 */
function showNotification(message) {
  // 简单的通知（可以改进为 Toast）
  console.log('[MixRead]', message);
  alert(message);
}

/**
 * 绑定事件
 */
function bindEvents() {
  // 切换当前网站
  document.getElementById('toggle-current').addEventListener('click', async () => {
    const domain = extractDomain(currentTabUrl);
    if (!domain) {
      showNotification('无法识别网站');
      return;
    }

    const domains = await exclusionStore.getExcludedDomains();
    const isExcluded = domains.includes(domain);

    if (isExcluded) {
      await exclusionStore.removeDomain(domain);
      showNotification('已移除排除，刷新页面后生效');
    } else {
      await exclusionStore.addDomain(domain);
      showNotification('已添加到排除列表，刷新页面后生效');
    }

    updateCurrentPageUI();
    updateDomainsList();
  });

  // 添加新域名
  document.getElementById('add-btn').addEventListener('click', async () => {
    const input = document.getElementById('new-domain');
    const domain = input.value.trim();

    if (!domain) {
      showNotification('请输入域名');
      return;
    }

    const success = await exclusionStore.addDomain(domain);
    if (success) {
      input.value = '';
      updateDomainsList();
    }
  });

  // 回车添加
  document.getElementById('new-domain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('add-btn').click();
    }
  });

  // 删除域名
  document.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
      const domain = e.target.dataset.domain;
      const success = await exclusionStore.removeDomain(domain);
      if (success) {
        updateDomainsList();
        updateCurrentPageUI();
      }
    }
  });
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', initializePopup);
```

### Day 3: 预设对话框

**文件**: `frontend/modules/exclusion/preset-dialog.js`

```javascript
/**
 * PresetDialog - 首次使用时的预设建议对话框
 */

const PRESET_EXCLUSIONS = {
  // 本地开发 (默认勾选)
  "localhost:8002": "MixRead 库页面",
  "localhost:3000": "React/Vue 开发服务器",
  "127.0.0.1:8000": "本地后端 API",
  "localhost:5173": "Vite 开发服务器",

  // 生产工具 (可选)
  "jenkins.company.com": "Jenkins",
  "gitlab.company.com": "GitLab",
  "jira.company.com": "Jira",

  // 通用 (可选)
  "file://": "本地文件",
  "mail.google.com": "Gmail"
};

class PresetDialog {
  constructor(exclusionStore) {
    this.exclusionStore = exclusionStore;
  }

  /**
   * 显示预设对话框（仅首次）
   */
  async showDialog() {
    // 检查是否已经初始化过
    const isFirstTime = !localStorage.getItem('mixread_preset_initialized');

    if (!isFirstTime) {
      return; // 不是首次，不显示
    }

    // 渲染对话框
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'preset-dialog-overlay';
      overlay.innerHTML = this.getDialogHTML();
      document.body.appendChild(overlay);

      // 绑定事件
      this.bindDialogEvents(overlay, resolve);
    });
  }

  /**
   * 获取对话框 HTML
   */
  getDialogHTML() {
    const groups = {
      'local': {
        title: '本地开发 (推荐)',
        items: [
          'localhost:8002',
          'localhost:3000',
          '127.0.0.1:8000',
          'localhost:5173'
        ],
        checked: true
      },
      'production': {
        title: '生产工具',
        items: [
          'jenkins.company.com',
          'gitlab.company.com',
          'jira.company.com'
        ],
        checked: false
      },
      'other': {
        title: '其他',
        items: ['file://', 'mail.google.com'],
        checked: false
      }
    };

    let html = `
      <div class="preset-dialog">
        <h2>👋 欢迎使用 MixRead</h2>
        <p class="preset-description">要排除这些网站的高亮吗？</p>
    `;

    for (const [key, group] of Object.entries(groups)) {
      html += `<div class="preset-group"><h4>${group.title}</h4>`;
      for (const domain of group.items) {
        const checked = group.checked ? 'checked' : '';
        html += `
          <label class="preset-item">
            <input
              type="checkbox"
              class="preset-checkbox"
              value="${domain}"
              ${checked}
            />
            <span class="preset-label">${domain}</span>
            <span class="preset-desc">${PRESET_EXCLUSIONS[domain]}</span>
          </label>
        `;
      }
      html += '</div>';
    }

    html += `
        <div class="preset-buttons">
          <button class="preset-apply">✓ 应用</button>
          <button class="preset-skip">× 跳过</button>
        </div>
      </div>
    `;

    return html;
  }

  /**
   * 绑定对话框事件
   */
  bindDialogEvents(overlay, resolve) {
    const applyBtn = overlay.querySelector('.preset-apply');
    const skipBtn = overlay.querySelector('.preset-skip');
    const checkboxes = overlay.querySelectorAll('.preset-checkbox');

    applyBtn.addEventListener('click', async () => {
      // 收集选中的域名
      const selected = [];
      checkboxes.forEach(cb => {
        if (cb.checked) {
          selected.push(cb.value);
        }
      });

      // 批量添加到数据库
      if (selected.length > 0) {
        await this.exclusionStore.addMultipleDomains(selected);
      }

      // 标记已初始化
      localStorage.setItem('mixread_preset_initialized', 'true');

      // 关闭对话框
      overlay.remove();
      resolve(true);
    });

    skipBtn.addEventListener('click', () => {
      localStorage.setItem('mixread_preset_initialized', 'true');
      overlay.remove();
      resolve(false);
    });
  }
}

// 对话框样式
const presetDialogStyles = `
<style>
.preset-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.preset-dialog {
  background: white;
  border-radius: 12px;
  padding: 30px;
  max-width: 450px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.preset-dialog h2 {
  font-size: 24px;
  margin-bottom: 8px;
  color: #333;
}

.preset-description {
  color: #666;
  margin-bottom: 20px;
  font-size: 14px;
}

.preset-group {
  margin-bottom: 20px;
}

.preset-group h4 {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  text-transform: uppercase;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.preset-item {
  display: flex;
  align-items: center;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 6px;
}

.preset-item:hover {
  background: #f5f5f5;
}

.preset-item input[type="checkbox"] {
  margin-right: 10px;
  cursor: pointer;
}

.preset-label {
  font-weight: 500;
  color: #333;
  flex: 1;
}

.preset-desc {
  font-size: 12px;
  color: #999;
  margin-left: 5px;
}

.preset-buttons {
  display: flex;
  gap: 10px;
  margin-top: 25px;
}

.preset-apply,
.preset-skip {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-apply {
  background: #667eea;
  color: white;
}

.preset-apply:hover {
  background: #5568d3;
}

.preset-skip {
  background: #f0f0f0;
  color: #333;
}

.preset-skip:hover {
  background: #e0e0e0;
}
</style>
`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PresetDialog;
}
```

更新 `popup.js` 以包含预设对话框：

```javascript
async function initializePopup() {
  try {
    // ... 现有代码 ...

    // 显示预设对话框（仅首次）
    const presetDialog = new PresetDialog(exclusionStore);
    await presetDialog.showDialog();

    // ... 其他初始化代码 ...
  } catch (error) {
    console.error('[MixRead] Popup 初始化失败:', error);
  }
}
```

---

## 🔗 Week 3: 集成与测试

### Day 1: content.js 集成

**文件**: `frontend/content.js`

在脚本顶部添加排除检查：

```javascript
// 在任何高亮初始化之前检查排除列表
async function checkAndInitialize() {
  try {
    // 1. 获取用户 ID
    const userId = localStorage.getItem('user_id') || 'default_user';

    // 2. 初始化 ExclusionStore
    const exclusionStore = new ExclusionStore(apiClient, userId);

    // 3. 检查当前 URL 是否被排除
    const filter = new ExclusionFilter(exclusionStore);
    const isExcluded = await filter.shouldExcludeDomain(window.location.href);

    if (isExcluded) {
      console.log('[MixRead] 此网站被排除，不加载插件');
      return; // 完全退出，不加载任何功能
    }

    // 4. 继续加载其他功能
    console.log('[MixRead] 加载插件功能');
    // ... 原有的高亮加载代码 ...

  } catch (error) {
    console.error('[MixRead] 初始化失败:', error);
    // 失败时继续加载（安全默认）
  }
}

// 等待 DOM 准备后开始
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAndInitialize);
} else {
  checkAndInitialize();
}
```

### Day 2-3: 完整测试

#### 测试场景 1: 基础功能

```javascript
[ ] 后端 API 测试
    [ ] POST /users/{id}/excluded-domains → 添加成功
    [ ] GET /users/{id}/excluded-domains → 返回列表
    [ ] DELETE /users/{id}/excluded-domains/{domain} → 删除成功
    [ ] POST /users/{id}/excluded-domains/batch → 批量添加成功

[ ] 前端 ExclusionStore 测试
    [ ] addDomain() → 成功调用 API
    [ ] getExcludedDomains() → 返回列表
    [ ] removeDomain() → 成功删除
    [ ] addMultipleDomains() → 批量添加

[ ] 域名匹配测试
    [ ] 精确匹配: localhost:8002
    [ ] 通配符: localhost:*
    [ ] IP 地址: 127.0.0.1:8000
    [ ] 文件协议: file://
```

#### 测试场景 2: UI 功能

```javascript
[ ] Popup 打开
    [ ] 显示当前域名
    [ ] 显示状态（启用/已禁用）
    [ ] 显示排除列表

[ ] 预设对话框（首次）
    [ ] 显示 9 个预设
    [ ] 用户可勾选/取消
    [ ] 点击应用 → 添加到列表
    [ ] 下次打开不再显示

[ ] 添加域名
    [ ] 输入域名 + 点击添加
    [ ] 域名出现在列表
    [ ] 支持回车快速添加

[ ] 删除域名
    [ ] 点击删除按钮
    [ ] 域名从列表移除

[ ] 切换当前网站
    [ ] 点击"禁用此网站"
    [ ] 添加到列表
    [ ] 点击"启用此网站"
    [ ] 从列表删除
```

#### 测试场景 3: content.js 集成

```javascript
[ ] 访问被排除的网站
    [ ] localhost:8002 → 不加载高亮
    [ ] 控制台显示 "[MixRead] 此网站被排除"

[ ] 访问未被排除的网站
    [ ] github.com → 正常加载高亮
    [ ] 显示高亮单词

[ ] 动态更新
    [ ] 从 Popup 添加排除
    [ ] 刷新页面
    [ ] 验证排除生效
```

#### 测试场景 4: 性能

```javascript
[ ] 域名检查速度 < 50ms
[ ] 列表加载 < 100ms
[ ] 无内存泄漏
[ ] 无控制台错误
```

---

## 📦 部署清单

```javascript
[ ] 所有 API 测试通过
[ ] Popup UI 测试通过
[ ] content.js 集成测试通过
[ ] 预设对话框工作正常
[ ] 数据库迁移成功
[ ] 没有 Console 错误
[ ] API 响应时间在预期内
[ ] 多浏览器测试 (Chrome, Edge, Brave)
[ ] 更新 manifest.json 版本号
[ ] 提交 git commit
[ ] 准备发布！
```

---

## 🎯 总结

**这个方案的优点**:
- ✅ 简单直接（复制现有代码模式）
- ✅ 安全可靠（单一数据源）
- ✅ 易于维护（统一的 API 调用）
- ✅ 快速上线（代码量少）
- ✅ 为未来优化预留空间

**后续优化机会**:
- Phase 2: 评估性能和成本，决定是否迁移部分数据到 Google
- Phase 3: 添加高级功能（统计、推荐等）

---

**准备好开发了吗？** 🚀

