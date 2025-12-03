# 架构设计：后端DDD + 前端模块化

## 第一部分：后端架构（DDD方式）

### 总体结构
```
backend/
├── main.py                 # FastAPI应用入口
├── requirements.txt        # 依赖
├── data/                   # 词汇数据
│   └── cefr_words.json
│   └── chinese_dict.json
│
├── domain/                 # 🔴 Domain Layer（业务核心）
│   ├── models/
│   │   ├── word.py         # Word实体
│   │   ├── vocabulary.py   # Vocabulary实体
│   │   └── user.py         # User实体
│   │
│   └── services/
│       ├── word_service.py         # 单词难度判断逻辑
│       ├── vocabulary_service.py   # 词汇库业务逻辑
│       └── highlight_service.py    # 高亗过滤逻辑
│
├── application/            # 🟡 Application Layer（用例/编排）
│   └── services/
│       ├── user_application.py     # 用户相关用例
│       ├── vocabulary_application.py # 词汇库相关用例
│       └── highlight_application.py  # 高亗相关用例
│
├── infrastructure/         # 🟢 Infrastructure Layer（数据持久化）
│   ├── database.py         # SQLAlchemy配置和初始化
│   ├── models.py           # SQLAlchemy ORM模型定义
│   └── repositories/
│       └── user_repository.py      # 用户数据持久化（ORM方式）
│
└── api/                    # 🔵 Presentation Layer（API接口）
    └── routes/
        ├── users.py        # 用户相关路由
        ├── vocabulary.py   # 词汇库路由
        └── highlight.py    # 高亗路由
```

### 核心概念划分

#### Domain Layer（业务逻辑的核心）

**什么应该在这里**：
- 与单词、词汇库相关的**业务规则**
- 与CEFR难度判断相关的**业务逻辑**
- 与"高亗过滤"相关的**核心算法**

**实现示例**：

`domain/models/word.py`:
```python
# 单词实体
class Word:
    def __init__(self, text: str, cefr_level: str, pos: str = None):
        self.text = text
        self.cefr_level = cefr_level
        self.pos = pos

    def get_difficulty_rank(self) -> int:
        """获取难度排序值，用于比较"""
        rank_map = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
        return rank_map.get(self.cefr_level, 0)
```

`domain/models/vocabulary.py`:
```python
from enum import Enum
from datetime import datetime

class VocabularyStatus(Enum):
    LEARNING = "learning"
    REVIEWING = "reviewing"
    MASTERED = "mastered"

class VocabularyEntry:
    def __init__(self, word: str, added_at: datetime = None):
        self.word = word
        self.added_at = added_at or datetime.now()
        self.status = VocabularyStatus.LEARNING
        self.attempt_count = 0
        self.last_reviewed = None

    def mark_reviewed(self):
        """标记为已复习"""
        self.last_reviewed = datetime.now()
        self.attempt_count += 1
```

`domain/models/user.py`:
```python
class User:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.known_words: set = set()        # 已认识的单词
        self.vocabulary: dict = {}           # 词汇库
        self.created_at = datetime.now()
```

`domain/services/highlight_service.py`:
```python
class HighlightService:
    """核心业务逻辑：决定哪些单词应该被高亗"""

    @staticmethod
    def should_highlight(word: Word, user_difficulty: str, user_known_words: set) -> bool:
        """
        判断单词是否应该被高亗

        规则：
        1. 不在"已认识"列表中
        2. 难度级别 >= 用户难度级别
        3. 在CEFR数据库中
        4. 有中文翻译
        """
        # 规则1：已认识的单词不高亗
        if word.text.lower() in user_known_words:
            return False

        # 规则2：难度比较
        difficulty_rank = {"A1": 1, "A2": 2, "B1": 3, "B2": 4, "C1": 5, "C2": 6}
        word_rank = difficulty_rank.get(word.cefr_level, 0)
        user_rank = difficulty_rank.get(user_difficulty, 3)

        if word_rank < user_rank:
            return False

        return True
```

#### Application Layer（用例编排）

**什么应该在这里**：
- **流程编排**：多个Domain Service的组合
- **用例实现**：具体的用户操作（如"用户标记已认识单词"）
- **数据转换**：将Domain Model转换为DTO
- **事务管理**：协调多个操作

`application/services/user_application.py`:
```python
class UserApplicationService:
    def __init__(self, user_repository):
        self.user_repository = user_repository

    def mark_word_as_known(self, user_id: str, word: str):
        """
        用例：用户标记单词为已认识

        步骤：
        1. 加载用户数据
        2. 添加单词到known_words集合
        3. 保存用户数据
        """
        user = self.user_repository.get_user(user_id)
        user.known_words.add(word.lower())
        self.user_repository.save_user(user)
        return {"success": True}

    def add_to_vocabulary(self, user_id: str, word: str):
        """用例：用户添加单词到词汇库"""
        user = self.user_repository.get_user(user_id)
        vocab_entry = VocabularyEntry(word)
        user.vocabulary[word.lower()] = vocab_entry
        self.user_repository.save_user(user)
        return {"success": True}
```

`application/services/highlight_application.py`:
```python
class HighlightApplicationService:
    def __init__(self, user_repository, highlight_service, cefr_data):
        self.user_repository = user_repository
        self.highlight_service = highlight_service
        self.cefr_data = cefr_data

    def get_highlighted_words(self, user_id: str, words: list, difficulty_level: str):
        """
        用例：获取应该被高亗的单词

        步骤：
        1. 加载用户的known_words
        2. 对每个单词，调用highlight_service判断
        3. 返回应高亗的单词
        """
        user = self.user_repository.get_user(user_id)
        highlighted = []

        for word_text in words:
            if word_text.lower() not in self.cefr_data:
                continue

            word = Word(
                text=word_text,
                cefr_level=self.cefr_data[word_text.lower()]["cefr_level"]
            )

            if self.highlight_service.should_highlight(
                word, difficulty_level, user.known_words
            ):
                highlighted.append(word_text)

        return {"highlighted_words": highlighted}
```

#### Infrastructure Layer（数据持久化 - 使用ORM）

**什么应该在这里**：
- **ORM配置**：SQLAlchemy数据库连接
- **数据模型**：SQLAlchemy模型定义（映射到数据库）
- **Repository**：使用ORM实现的数据访问层

`infrastructure/database.py`:
```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 数据库配置（支持SQLite/PostgreSQL/MySQL）
DATABASE_URL = "sqlite:///./mixread.db"
# 生产环境: "postgresql://user:password@localhost/mixread"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """获取数据库session（依赖注入）"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

`infrastructure/models.py`:
```python
from sqlalchemy import Column, String, DateTime, Text, Integer, Enum
from sqlalchemy.dialects.postgresql import ARRAY
from datetime import datetime
import json

class UserModel(Base):
    """用户表"""
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # 存储已认识单词列表（JSON格式）
    known_words = Column(Text, default="[]")

    def get_known_words_set(self):
        """获取已认识单词的Set"""
        return set(json.loads(self.known_words) or [])

    def set_known_words_set(self, words_set):
        """设置已认识单词"""
        self.known_words = json.dumps(list(words_set))

class VocabularyEntryModel(Base):
    """词汇库表"""
    __tablename__ = "vocabulary_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True)
    word = Column(String, index=True)
    status = Column(Enum(VocabularyStatus), default=VocabularyStatus.LEARNING)
    added_at = Column(DateTime, default=datetime.now)
    last_reviewed = Column(DateTime, nullable=True)
    attempt_count = Column(Integer, default=0)

class KnownWordModel(Base):
    """已认识单词表（用于快速查询）"""
    __tablename__ = "known_words"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("users.user_id"), index=True)
    word = Column(String, index=True)
    marked_at = Column(DateTime, default=datetime.now)
```

`infrastructure/repositories/user_repository.py`:
```python
from sqlalchemy.orm import Session
from domain.models.user import User
from domain.models.vocabulary import VocabularyEntry
from infrastructure.models import UserModel, VocabularyEntryModel, KnownWordModel

class UserRepository:
    """使用SQLAlchemy ORM的用户仓储"""

    def __init__(self, db: Session):
        self.db = db

    def get_user(self, user_id: str) -> User:
        """从数据库获取用户"""
        # 查询用户记录
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user_id
        ).first()

        if not user_model:
            # 新用户，创建并保存
            user_model = UserModel(user_id=user_id)
            self.db.add(user_model)
            self.db.commit()

        # 构建Domain Model
        user = User(user_id)
        user.known_words = user_model.get_known_words_set()

        # 加载词汇库
        vocab_models = self.db.query(VocabularyEntryModel).filter(
            VocabularyEntryModel.user_id == user_id
        ).all()

        for vocab_model in vocab_models:
            entry = VocabularyEntry(vocab_model.word)
            entry.status = vocab_model.status
            entry.attempt_count = vocab_model.attempt_count
            entry.last_reviewed = vocab_model.last_reviewed
            user.vocabulary[vocab_model.word.lower()] = entry

        return user

    def save_user(self, user: User):
        """保存用户数据到数据库"""
        # 更新用户记录
        user_model = self.db.query(UserModel).filter(
            UserModel.user_id == user.user_id
        ).first()

        if not user_model:
            user_model = UserModel(user_id=user.user_id)
            self.db.add(user_model)

        # 保存已认识单词
        user_model.set_known_words_set(user.known_words)

        # 保存/更新词汇库
        for word, entry in user.vocabulary.items():
            vocab_model = self.db.query(VocabularyEntryModel).filter(
                VocabularyEntryModel.user_id == user.user_id,
                VocabularyEntryModel.word == word
            ).first()

            if not vocab_model:
                vocab_model = VocabularyEntryModel(
                    user_id=user.user_id,
                    word=word,
                    status=entry.status,
                    added_at=entry.added_at
                )
                self.db.add(vocab_model)
            else:
                vocab_model.status = entry.status
                vocab_model.attempt_count = entry.attempt_count
                vocab_model.last_reviewed = entry.last_reviewed

        self.db.commit()

    def add_known_word(self, user_id: str, word: str):
        """快速添加已认识单词"""
        # 先添加到known_words表（快速查询）
        existing = self.db.query(KnownWordModel).filter(
            KnownWordModel.user_id == user_id,
            KnownWordModel.word == word.lower()
        ).first()

        if not existing:
            known = KnownWordModel(user_id=user_id, word=word.lower())
            self.db.add(known)
            self.db.commit()

    def is_word_known(self, user_id: str, word: str) -> bool:
        """快速检查单词是否已认识"""
        exists = self.db.query(KnownWordModel).filter(
            KnownWordModel.user_id == user_id,
            KnownWordModel.word == word.lower()
        ).first()
        return exists is not None
```

#### Presentation Layer（API接口）

**什么应该在这里**：
- **路由定义**：HTTP端点
- **请求验证**：输入验证
- **响应格式化**：统一的响应格式
- **HTTP特定逻辑**：状态码、headers等

`api/routes/users.py`:
```python
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/users/{user_id}")

@router.get("")
def get_user(user_id: str, user_app: UserApplicationService):
    """获取用户数据"""
    try:
        user = user_app.user_repository.get_user(user_id)
        return {
            "success": True,
            "data": {
                "user_id": user.user_id,
                "known_words": list(user.known_words),
                "vocabulary": list(user.vocabulary.keys())
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/known-words")
def mark_as_known(user_id: str, word: str, user_app: UserApplicationService):
    """标记单词为已认识"""
    result = user_app.mark_word_as_known(user_id, word)
    return {"success": result["success"]}

@router.get("/vocabulary")
def get_vocabulary(user_id: str, user_app: UserApplicationService):
    """获取词汇库"""
    user = user_app.user_repository.get_user(user_id)
    return {
        "success": True,
        "data": list(user.vocabulary.keys())
    }
```

### 依赖注入方式（简化版）

`main.py`:
```python
from fastapi import FastAPI, Depends
from domain.services.highlight_service import HighlightService
from application.services.user_application import UserApplicationService
from infrastructure.repositories.user_repository import UserRepository
from api.routes import users, vocabulary, highlight

app = FastAPI()

# 初始化Repository和Service
user_repo = UserRepository()
user_app = UserApplicationService(user_repo)
highlight_service = HighlightService()

# 依赖注入
def get_user_app():
    return user_app

def get_highlight_app():
    return HighlightApplicationService(user_repo, highlight_service, cefr_data)

app.include_router(users.router)
app.include_router(highlight.router)
```

---

## 第二部分：前端架构（模块化方式）

### 总体结构
```
frontend/
├── manifest.json           # 扩展配置
│
├── scripts/                # 🔴 Shared Utilities（共享工具）
│   ├── logger.js           # 统一日志系统
│   ├── constants.js        # 常量定义
│   ├── api-client.js       # API客户端
│   └── storage.js          # 本地存储管理
│
├── modules/                # 🟡 Feature Modules（功能模块）
│   ├── user/
│   │   ├── user-store.js          # 用户状态管理
│   │   ├── user-service.js        # 用户业务逻辑
│   │   └── user-repository.js     # 本地数据持久化
│   │
│   ├── vocabulary/
│   │   ├── vocabulary-store.js    # 词汇库状态
│   │   ├── vocabulary-service.js  # 词汇库逻辑
│   │   └── vocabulary-repository.js
│   │
│   ├── known-words/
│   │   ├── known-words-store.js   # 已认识单词状态
│   │   ├── known-words-service.js # 标记逻辑
│   │   └── known-words-repository.js
│   │
│   └── highlight/
│       ├── highlight-filter.js    # 高亗过滤逻辑
│       ├── highlight-renderer.js  # DOM高亗渲染
│       └── highlight-store.js     # 高亗状态
│
├── components/             # 🟢 UI Components（界面组件）
│   ├── tooltip.js          # 单词提示框
│   ├── difficulty-slider.js # 难度滑块
│   ├── known-words-list.js # 已认识词列表
│   └── vocabulary-list.js  # 词汇库列表
│
├── content.js              # 内容脚本入口
├── popup.js                # Popup脚本入口
├── background.js           # 后台脚本入口
│
├── popup.html              # Popup UI
├── content.css             # 样式
└── popup.css
```

### 核心模块详解

#### 1. 共享工具层（Utilities）

`scripts/api-client.js` - 统一API客户端：
```javascript
class ApiClient {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  async request(method, path, data = null) {
    const userId = await this.getUserId();
    const url = `${this.baseURL}${path}`;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      const json = await response.json();
      return json;
    } catch (error) {
      logger.error(`API Error: ${method} ${path}`, error);
      throw error;
    }
  }

  // 便捷方法
  get(path) { return this.request('GET', path); }
  post(path, data) { return this.request('POST', path, data); }
  delete(path) { return this.request('DELETE', path); }
}

const apiClient = new ApiClient();
```

`scripts/storage.js` - 本地存储管理：
```javascript
class StorageManager {
  static async getItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get([key], (result) => {
        resolve(result[key]);
      });
    });
  }

  static async setItem(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  static async removeItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove([key], resolve);
    });
  }
}
```

#### 2. 用户模块（User Module）

`modules/user/user-store.js` - 用户状态管理：
```javascript
class UserStore {
  constructor() {
    this.user = {
      id: null,
      knownWords: [],
      vocabulary: []
    };
    this.listeners = [];
  }

  async initialize() {
    this.user.id = await StorageManager.getItem('user_id');
    if (!this.user.id) {
      this.user.id = this.generateUserId();
      await StorageManager.setItem('user_id', this.user.id);
    }
  }

  generateUserId() {
    return `mixread-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 订阅模式：发布状态变化
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(listener => listener(this.user));
  }

  setUser(user) {
    this.user = user;
    this.notify();
  }
}

const userStore = new UserStore();
```

`modules/user/user-service.js` - 用户业务逻辑：
```javascript
class UserService {
  constructor(userStore, apiClient) {
    this.userStore = userStore;
    this.apiClient = apiClient;
  }

  async switchDevice(newUserId) {
    // 验证user_id是否有效
    try {
      const response = await this.apiClient.get(`/users/${newUserId}`);
      if (response.success) {
        await StorageManager.setItem('user_id', newUserId);
        this.userStore.user.id = newUserId;
        this.userStore.notify();
        return true;
      }
    } catch (error) {
      logger.warn('Invalid user_id:', newUserId);
      return false;
    }
  }

  getUserId() {
    return this.userStore.user.id;
  }
}

const userService = new UserService(userStore, apiClient);
```

#### 3. 已认识单词模块（Known Words Module）

`modules/known-words/known-words-store.js`:
```javascript
class KnownWordsStore {
  constructor() {
    this.knownWords = new Set();
    this.listeners = [];
  }

  async load() {
    const cached = await StorageManager.getItem('known_words');
    this.knownWords = new Set(cached || []);
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  notify() {
    this.listeners.forEach(listener => listener(this.knownWords));
  }

  add(word) {
    this.knownWords.add(word.toLowerCase());
    this.notify();
  }

  has(word) {
    return this.knownWords.has(word.toLowerCase());
  }

  async sync() {
    // 与后端同步
    const userId = userStore.user.id;
    await StorageManager.setItem('known_words', Array.from(this.knownWords));
  }
}

const knownWordsStore = new KnownWordsStore();
```

`modules/known-words/known-words-service.js`:
```javascript
class KnownWordsService {
  constructor(knownWordsStore, apiClient, userStore) {
    this.knownWordsStore = knownWordsStore;
    this.apiClient = apiClient;
    this.userStore = userStore;
  }

  async markAsKnown(word) {
    const userId = this.userStore.user.id;

    try {
      // 1. 添加到本地
      this.knownWordsStore.add(word);

      // 2. 同步到后端
      await this.apiClient.post(
        `/users/${userId}/known-words`,
        { word }
      );

      // 3. 触发重新高亗
      window.dispatchEvent(new Event('known-words-updated'));

      return true;
    } catch (error) {
      logger.error('Failed to mark as known:', word, error);
      return false;
    }
  }
}

const knownWordsService = new KnownWordsService(
  knownWordsStore, apiClient, userStore
);
```

#### 4. 高亗模块（Highlight Module）

`modules/highlight/highlight-filter.js` - 高亗过滤逻辑：
```javascript
class HighlightFilter {
  constructor(knownWordsStore, difficultyStore) {
    this.knownWordsStore = knownWordsStore;
    this.difficultyStore = difficultyStore;
  }

  // 在发送到后端前的本地过滤（性能优化）
  filterWords(words) {
    return words.filter(word => {
      // 规则：已认识的词不发送到后端
      return !this.knownWordsStore.has(word);
    });
  }

  async getHighlightedWords(words) {
    // 1. 本地过滤
    const filteredWords = this.filterWords(words);

    // 2. 后端查询（已认识的词已过滤）
    const response = await apiClient.post('/highlight-words', {
      words: filteredWords,
      difficulty_level: this.difficultyStore.getCurrentLevel()
    });

    return response.highlighted_words;
  }
}

const highlightFilter = new HighlightFilter(knownWordsStore, difficultyStore);
```

`modules/highlight/highlight-renderer.js` - DOM高亗渲染：
```javascript
class HighlightRenderer {
  constructor() {
    this.highlightedWordsMap = {};
  }

  async highlight(words) {
    this.highlightedWordsMap = {};
    words.forEach(word => {
      this.highlightedWordsMap[word.toLowerCase()] = true;
    });

    // 遍历DOM并高亗匹配的单词
    this.highlightInDOM(document.body);
  }

  highlightInDOM(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      this.highlightTextNode(node);
    } else {
      node.childNodes.forEach(child => this.highlightInDOM(child));
    }
  }

  highlightTextNode(textNode) {
    const regex = /\b[a-z''-]+\b/gi;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(textNode.textContent)) !== null) {
      const word = match[0];

      // 添加高亗前的文本
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(
            textNode.textContent.substring(lastIndex, match.index)
          )
        );
      }

      // 创建高亗元素
      if (this.highlightedWordsMap[word.toLowerCase()]) {
        const span = document.createElement('span');
        span.className = 'mixread-highlight';
        span.textContent = word;
        span.dataset.word = word.toLowerCase();
        fragment.appendChild(span);
      } else {
        fragment.appendChild(document.createTextNode(word));
      }

      lastIndex = regex.lastIndex;
    }

    // 添加剩余的文本
    if (lastIndex < textNode.textContent.length) {
      fragment.appendChild(
        document.createTextNode(
          textNode.textContent.substring(lastIndex)
        )
      );
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

const highlightRenderer = new HighlightRenderer();
```

#### 5. 内容脚本入口（Content Script）

`content.js` - 模块化入口：
```javascript
// 初始化流程
async function init() {
  try {
    // 1. 初始化用户
    await userStore.initialize();

    // 2. 加载本地数据
    await knownWordsStore.load();

    // 3. 监听事件
    window.addEventListener('known-words-updated', async () => {
      const textNodes = getTextNodes(document.body);
      const allWords = extractWords(textNodes);
      const highlighted = await highlightFilter.getHighlightedWords(allWords);
      await highlightRenderer.highlight(highlighted);
    });

    // 4. 首次高亗页面
    const textNodes = getTextNodes(document.body);
    const allWords = extractWords(textNodes);
    const highlighted = await highlightFilter.getHighlightedWords(allWords);
    await highlightRenderer.highlight(highlighted);

    // 5. 添加事件监听（tooltip、Mark as Known等）
    setupHighlightClickHandlers();

  } catch (error) {
    logger.error('Content script initialization failed:', error);
  }
}

function setupHighlightClickHandlers() {
  document.addEventListener('click', async (e) => {
    const span = e.target.closest('.mixread-highlight');
    if (span) {
      const word = span.dataset.word;

      // 显示tooltip
      showTooltip(word, e);

      // Tooltip中的"Mark as Known"按钮点击
      document.addEventListener('mark-as-known', async (e2) => {
        await knownWordsService.markAsKnown(word);
      });
    }
  });
}

// 启动初始化
init();
```

### 关键设计原则

#### 1. **分离关注点**
- `*-store.js`: 状态管理
- `*-service.js`: 业务逻辑
- `*-repository.js`: 数据持久化
- Components: 纯UI

#### 2. **事件驱动通信**
```javascript
// 模块间通信用事件，而不是直接调用
window.dispatchEvent(new CustomEvent('known-words-updated', {
  detail: { word: 'beautiful' }
}));
```

#### 3. **依赖注入**
```javascript
// 高内聚，低耦合
const service = new KnownWordsService(store, apiClient, userStore);
```

#### 4. **缓存和同步策略**
```javascript
// 1. 本地优先（localStorage）
// 2. 后台同步到服务器
// 3. 服务器数据为真实来源
```

---

## 总结：不过度设计的关键

### 后端
✅ 层次清晰：Domain → Application → Infrastructure → Presentation
✅ 每层职责明确，不混淆
✅ 简化：没有ORM、没有复杂的Event Bus、没有CQRS
✅ 实用：基于磁盘文件存储，可后期升级到数据库

### 前端
✅ 模块化：按功能划分，而不是按文件类型
✅ 关注点分离：Store(状态) → Service(逻辑) → Component(UI)
✅ 简化：没有Router（extension不需要）、没有Redux、没有复杂的中间件
✅ 实用：Event驱动通信，易于理解和扩展

---

## 下一步

确认此架构设计是否合适，我会按照此设计开始实现具体代码。
