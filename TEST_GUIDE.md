# MixRead 复习系统 - 完整测试指南

## 🚀 快速开始 (5 分钟)

### Step 1: 验证后端已启动

```bash
curl http://localhost:8000/health
```

**预期响应:**
```json
{
  "status": "ok",
  "version": "0.2.0",
  "words_loaded": 9151,
  "chinese_translations": 6545
}
```

### Step 2: 验证前端已启动

在浏览器中打开：
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

**预期看到:**
- 页面标题："MixRead - Vocabulary Review"
- 三个按钮：Mixed / New Words / Review Due
- 没有错误信息

### Step 3: 运行自动化测试

```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```

---

## 📋 手动测试清单

### A. 后端 API 测试 (使用 curl)

#### 1. 创建复习会话

```bash
curl -X POST http://localhost:8000/users/test_user/review/session \
  -H "Content-Type: application/json" \
  -d '{"session_type": "mixed"}' | jq
```

**预期响应:**
```json
{
  "success": true,
  "session_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "total_cards": 5,
  "first_card": {
    "id": "1",
    "content": { "word": "serendipity", ... },
    ...
  },
  "progress": { "current": 1, "total": 5, ... }
}
```

**关键检查:**
- ✅ 返回状态 200
- ✅ session_id 不为空
- ✅ total_cards > 0
- ✅ first_card 包含单词信息

#### 2. 提交答案 (重要: 使用查询参数)

```bash
# 替换 {SESSION_ID} 为上面获得的 session_id
SESSION_ID="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

curl -X POST "http://localhost:8000/users/test_user/review/answer?session_id=${SESSION_ID}&quality=4" \
  | jq
```

**预期响应:**
```json
{
  "success": true,
  "result": {
    "item_id": "1",
    "new_interval": 24,
    "new_ease": 2.6,
    ...
  },
  "progress": { "current": 2, "total": 5, "correct": 1, ... }
}
```

**关键检查:**
- ✅ 返回状态 200
- ✅ result.new_interval > 0
- ✅ progress.correct 增加

#### 3. 测试不同的质量评分

```bash
# 测试所有质量评分 (0-5)
for quality in 0 1 2 3 4 5; do
  echo "Testing quality=$quality..."
  curl -s -X POST "http://localhost:8000/users/test_user/review/answer?session_id=${SESSION_ID}&quality=${quality}" \
    | jq '.success'
done
```

---

### B. 前端功能测试 (浏览器手动测试)

#### 打开页面
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

#### 测试清单

- [ ] **页面加载**
  - 看到标题 "Choose Review Type"
  - 看到3个按钮：Mixed / New Words / Review Due
  - 按 F12 打开开发者工具 → Console 标签，没有红色错误

- [ ] **启动会话**
  - 点击 "Mixed (New + Due)" 按钮
  - 等待 1-2 秒
  - 看到第一张卡片（正面显示单词，例如 "serendipity"）
  - 看到进度条：1 / N
  - 看到右侧统计信息

- [ ] **卡片翻转**
  - 按 **Space 键** 或点击 "Show Answer" 按钮
  - 卡片翻转
  - 看到背面内容：
    - 单词定义
    - 例句
    - CEFR 等级 (如 "C1")

- [ ] **提交答案**
  - 看到4个评分按钮：
    - Again (红色)
    - Hard (橙色)
    - Good (蓝色)
    - Easy (绿色)
  - 点击 "Easy" 按钮 (或按 **4 键**)
  - 卡片消失，进度条更新为 2 / N
  - 看到下一张卡片

- [ ] **快捷键**
  - 按 **Space** 显示答案
  - 按 **1** 提交 "Again"
  - 按 **2** 提交 "Hard"
  - 按 **3** 提交 "Good"
  - 按 **4** 提交 "Easy"
  - 验证答案都被提交

- [ ] **统计显示**
  - 左侧显示"Correct"计数（每次提交都增加）
  - 显示"Streak"（连续正确数）
  - 显示"Accuracy"百分比
  - 显示"Time"经过的时间

- [ ] **暂停/继续** (如果实现)
  - 点击"Pause"按钮
  - 计时器停止
  - 按钮变为"Resume"
  - 点击"Resume"继续

- [ ] **会话完成**
  - 完成所有卡片后，看到完成屏幕
  - 显示总统计：
    - Cards Reviewed: N
    - Correct: X
    - Accuracy: Y%
    - Max Streak: Z
    - Duration: MM:SS
  - 显示按钮："Back to Library" 和 "Start Another"

---

## 🐛 控制台日志检查

按 **F12** 打开浏览器开发者工具 → **Console** 标签

### 应该看到的日志

```
[Review] Starting mixed session for user test_user
[Review] Session started: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx, 5 cards
[Review] Current card: 1/5
[Review] Submitting answer: quality=4, time=2345ms
[Review] Answer recorded. Correct: 1, Streak: 1
[Review] Next card: 2/5
...
[Review] Session ended: { cards_reviewed: 5, correct: 5, ... }
```

### 不应该看到

- ❌ `Uncaught TypeError`
- ❌ `ReferenceError: ReviewManager is not defined`
- ❌ `Failed to fetch`
- ❌ `CORS error`
- ❌ `404 Not Found`

---

## 📊 自动化测试运行

### 运行完整测试套件

```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```

### 预期输出

```
🧪 MixRead Review System - API 集成测试
======================================================================

===============================================================
  Step 1: 检查后端连接
===============================================================

✅ 后端已连接

===============================================================
  Step 2: 测试会话创建
===============================================================

ℹ️  创建 'mixed' 类型的会话...
✅ 会话创建成功
  • Session ID: xxxxxxxx...
  • Total Cards: 5
  • First Card: serendipity
  • Progress: 1 / 5

===============================================================
  Step 3: 测试答题提交
===============================================================

ℹ️  测试质量评分 5: Easy (完美记忆)...
✅ 质量 5 (Easy (完美记忆))
  • 新间隔: 24 小时
  • 新难度因子: 2.60
  • 下次复习: 2025-12-05

...

===============================================================
  测试总结
===============================================================

✅ 会话创建
✅ 答题提交
✅ 会话类型
✅ 质量评分
✅ 统计端点

总体: 5/5 通过

✅ 所有测试通过! ✨
```

---

## 🔧 故障排除

### 问题 1: 后端连接失败

```
❌ 无法连接到后端
请运行: cd backend && python main.py
```

**解决:**
```bash
# 终端1：启动后端
cd /Users/yinshucheng/code/creo/MixRead/backend
python main.py
```

### 问题 2: 前端页面显示空白

**可能原因:**
1. 前端服务未启动
2. 访问了错误的 URL
3. JavaScript 加载失败

**解决:**
```bash
# 终端2：启动前端
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost

# 然后打开浏览器访问
http://localhost:8001/pages/review-session.html?user_id=test_user
```

### 问题 3: 浏览器控制台显示 404 错误

```
Failed to fetch http://localhost:8000/users/test_user/review/session
```

**解决:**
- 确保后端运行在 http://localhost:8000
- 检查 backend/main.py 是否包含 `include_router(review_router)`
- 清除浏览器缓存（Ctrl+Shift+Delete）并重新加载页面

### 问题 4: "No cards available"

```
⚠️ 没有可用的卡片 (204 No Content)
请确保数据库中有至少 5 个单词用于 test_user
```

**解决:**

使用 Python 脚本添加测试数据：

```python
from infrastructure.database import init_db, SessionLocal
from infrastructure.models import VocabularyEntryModel
from datetime import datetime

init_db()
db = SessionLocal()

test_words = [
    'serendipity', 'ephemeral', 'quintessential',
    'ubiquitous', 'eloquent', 'melancholy',
    'pragmatic', 'nuance', 'ambiguous', 'diligent'
]

for word in test_words:
    entry = VocabularyEntryModel(
        user_id='test_user',
        word=word,
        status='learning',
        added_at=datetime.now()
    )
    db.add(entry)

db.commit()
print(f"✅ Added {len(test_words)} test words for test_user")
db.close()
```

运行：
```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python -c "
from infrastructure.database import init_db, SessionLocal
from infrastructure.models import VocabularyEntryModel
from datetime import datetime

init_db()
db = SessionLocal()

test_words = ['serendipity', 'ephemeral', 'quintessential', 'ubiquitous', 'eloquent']
for word in test_words:
    db.add(VocabularyEntryModel(user_id='test_user', word=word))
db.commit()
print('✅ Added test words')
"
```

---

## ✅ 完整测试检查清单

完成以下所有检查后，系统可视为 **完全就绪**：

### 后端验证
- [ ] curl health 返回 200
- [ ] 可以创建 review session (返回 session_id)
- [ ] 可以提交答案 (返回 result 和 next_card)
- [ ] 所有质量评分 (0-5) 都能被接受
- [ ] 会话完成后返回 summary

### 前端验证
- [ ] 页面正常加载（无 404）
- [ ] 浏览器控制台无红色错误
- [ ] 可以选择会话类型
- [ ] 卡片正常显示和翻转
- [ ] 所有快捷键正常工作 (Space, 1-4)
- [ ] 进度条和统计实时更新
- [ ] 会话完成屏幕显示正确

### API 验证
- [ ] POST /users/{user_id}/review/session 返回 200
- [ ] POST /users/{user_id}/review/answer 返回 200 (使用查询参数)
- [ ] GET /users/{user_id}/review/stats 返回 200
- [ ] GET /users/{user_id}/review/schedule 返回 200

### 数据验证
- [ ] 数据库有测试数据
- [ ] SRS 字段正确更新 (review_interval, ease_factor 等)
- [ ] 用户数据正确保存

---

## 📝 测试报告模板

完成测试后，填写此报告：

```
测试日期：2025-12-04
测试用户：test_user
测试环境：MacOS / Python 3.9 / SQLite

后端状态：✅ 正常
前端状态：✅ 正常
API 状态：✅ 正常

测试结果：
- 页面加载：✅ 通过
- 会话创建：✅ 通过
- 卡片翻转：✅ 通过
- 答题提交：✅ 通过
- 快捷键：✅ 通过
- 统计显示：✅ 通过
- 完成屏幕：✅ 通过

遇到的问题：
(无 / 描述任何问题)

建议：
(列出任何需要改进的地方)
```

---

## 🎯 后续步骤

测试完成后：

1. **代码审核** - 检查是否有 bug 需要修复
2. **性能测试** - 验证响应时间 < 500ms
3. **并发测试** - 多用户同时进行
4. **数据验证** - 检查数据库是否正确更新
5. **用户反馈** - 邀请真实用户测试

---

## 📞 快速支持

遇到问题？按这个顺序排查：

1. **检查日志** - 查看终端输出是否有错误信息
2. **检查浏览器控制台** - F12 → Console
3. **查看网络请求** - F12 → Network
4. **重启服务** - 停止并重新启动后端/前端
5. **清除数据库** - 删除 backend/mixread.db 并重新启动

---

**准备好了吗？现在就开始测试吧！** 🚀
