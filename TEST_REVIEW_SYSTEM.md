# MixRead 复习系统 - 快速测试指南

## 🚀 三步启动完整系统

### Step 1: 启动后端（必须）

```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python main.py
```

**预期输出：**
```
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://127.0.0.1:8000
```

✅ 看到这个输出后继续下一步

---

### Step 2: 启动前端服务（新终端）

```bash
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost
```

**预期输出：**
```
Serving HTTP on localhost:8001 (http://127.0.0.1:8001)
```

✅ 看到这个输出后打开浏览器

---

### Step 3: 打开浏览器

访问以下 URL：
```
http://localhost:8001/pages/review-session.html?user_id=test_user
```

---

## ✨ 完整的测试流程

### A. 前端 UI 功能测试

#### 1. 页面加载
- [ ] 看到"Choose Review Type"标题
- [ ] 看到 3 个按钮：Mixed / New Words / Review Due
- [ ] 没有控制台错误（F12 打开开发者工具）

#### 2. 启动会话
- [ ] 点击"Mixed (New + Due)"按钮
- [ ] 等待 1-2 秒
- [ ] 看到第一张卡片（单词）
- [ ] 看到进度条（1 / N）

#### 3. 卡片翻转
- [ ] 看到单词"serendipity"或其他单词
- [ ] 点击"Show Answer"按钮
- [ ] 卡片翻转显示定义
- [ ] 看到例句（Example）

#### 4. 答题评分
- [ ] 看到 4 个按钮（Again, Hard, Good, Easy）
- [ ] 点击"Easy"按钮
- [ ] 进度条更新（2 / N）
- [ ] 看到下一张卡片

#### 5. 快捷键测试
- [ ] 按 Space 显示答案
- [ ] 按 4 键提交"Easy"评分
- [ ] 进度继续更新

#### 6. 会话统计
- [ ] 右侧显示"Correct"计数增加
- [ ] "Streak"计数显示当前连续数
- [ ] "Accuracy"百分比实时更新
- [ ] "Time"显示经过的时间

#### 7. 会话完成
- [ ] 所有卡片完成后显示完成屏幕
- [ ] 显示总统计（Cards Reviewed, Correct, Accuracy, Max Streak, Duration）
- [ ] 看到"Back to Library"和"Start Another"按钮

---

### B. API 功能测试（后端）

#### 使用 curl 测试

**1. 启动会话**

```bash
curl -X POST http://localhost:8000/users/test_user/review/session \
  -H "Content-Type: application/json" \
  -d '{"session_type": "mixed"}' | jq
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid-here",
    "total_cards": 5,
    "first_card": {
      "id": "word_1",
      "front": "serendipity",
      "back": {
        "definition": "The occurrence of events by chance...",
        "example": "A fortunate stroke of serendipity...",
        "cefr": "C1"
      }
    },
    "progress": {
      "current": 1,
      "total": 5,
      "percentage": 20.0,
      "correct": 0,
      "accuracy": 0.0
    }
  }
}
```

✅ 如果看到这个，继续下一个测试

**2. 提交答案**

```bash
# 替换 {SESSION_ID} 为上一个响应的 session_id
SESSION_ID="replace-with-actual-id"

curl -X POST http://localhost:8000/users/test_user/review/answer \
  -H "Content-Type: application/json" \
  -d "{\"session_id\": \"$SESSION_ID\", \"quality\": 5}" | jq
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "result": {
      "item_id": "word_1",
      "quality": 5,
      "new_interval": 24,
      "new_ease": 2.6,
      "next_review_time": "2025-12-05T..."
    },
    "next_card": {
      "id": "word_2",
      "front": "ephemeral",
      ...
    },
    "progress": {
      "current": 2,
      "total": 5,
      "percentage": 40.0,
      "correct": 1,
      "accuracy": 1.0
    },
    "session_complete": false
  }
}
```

✅ 完美！API 工作正常

---

## 🧪 Python 集成测试脚本

创建文件 `backend/test_review_api.py`：

```python
#!/usr/bin/env python3
"""
MixRead Review System - API Integration Test

使用方法:
  python test_review_api.py
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"
USER_ID = "test_user"

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def test_session_creation():
    """测试会话创建"""
    print_section("1️⃣ 测试：启动复习会话")

    try:
        response = requests.post(
            f"{BASE_URL}/users/{USER_ID}/review/session",
            json={"session_type": "mixed"},
            timeout=10
        )

        if response.status_code != 200:
            print(f"❌ 错误：HTTP {response.status_code}")
            print(response.text)
            return None

        data = response.json()

        if not data.get("success"):
            print(f"❌ 错误：{data.get('error', '未知错误')}")
            return None

        session = data["data"]
        print(f"✅ 会话创建成功")
        print(f"   - Session ID: {session['session_id'][:8]}...")
        print(f"   - Total Cards: {session['total_cards']}")
        print(f"   - First Card: {session['first_card']['front']}")

        return session

    except Exception as e:
        print(f"❌ 异常：{e}")
        return None

def test_answer_submission(session):
    """测试答题提交"""
    print_section("2️⃣ 测试：提交答案")

    if not session:
        print("❌ 没有活跃的会话")
        return None

    try:
        # 测试不同的质量评分
        for quality in [5, 3, 1]:
            quality_label = {5: "Easy", 3: "Good", 1: "Hard"}[quality]

            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/answer",
                json={
                    "session_id": session["session_id"],
                    "quality": quality
                },
                timeout=10
            )

            if response.status_code != 200:
                print(f"❌ 质量 {quality} ({quality_label}): HTTP {response.status_code}")
                continue

            data = response.json()

            if not data.get("success"):
                print(f"❌ 质量 {quality} ({quality_label}): {data.get('error')}")
                continue

            result = data["data"]["result"]
            print(f"✅ 质量 {quality} ({quality_label})")
            print(f"   - 新间隔: {result['new_interval']} 小时")
            print(f"   - 新难度因子: {result['new_ease']:.2f}")
            print(f"   - 下次复习: {result['next_review_time'][:10]}")

            # 如果会话已完成，停止
            if data["data"].get("session_complete"):
                print(f"✅ 会话已完成")
                return data["data"]["session_summary"]

            # 等待一下再提交下一个
            time.sleep(0.5)

        return data["data"].get("session_summary")

    except Exception as e:
        print(f"❌ 异常：{e}")
        return None

def test_session_types():
    """测试不同的会话类型"""
    print_section("3️⃣ 测试：不同的会话类型")

    for session_type in ["mixed", "new", "review"]:
        try:
            response = requests.post(
                f"{BASE_URL}/users/{USER_ID}/review/session",
                json={"session_type": session_type},
                timeout=10
            )

            if response.status_code == 204:
                print(f"⚠️  会话类型 '{session_type}': 没有卡片可用")
            elif response.status_code == 200:
                data = response.json()
                total = data["data"]["total_cards"]
                print(f"✅ 会话类型 '{session_type}': {total} 张卡片")
            else:
                print(f"❌ 会话类型 '{session_type}': HTTP {response.status_code}")

        except Exception as e:
            print(f"❌ 会话类型 '{session_type}': {e}")

def main():
    print("\n" + "🧪 MixRead Review System - API 集成测试".center(60))

    # 检查连接
    print("\n📡 检查后端连接...")
    try:
        requests.get(f"{BASE_URL}/", timeout=5)
    except:
        print("❌ 无法连接到后端")
        print(f"   请确保后端已启动: cd backend && python main.py")
        return

    print("✅ 已连接到后端")

    # 运行测试
    session = test_session_creation()

    if session:
        test_answer_submission(session)
        test_session_types()

    # 总结
    print_section("测试完成 ✅")
    print("\n后续步骤:")
    print("1. 在浏览器中测试前端: http://localhost:8001/pages/review-session.html")
    print("2. 查看 TESTING.md 了解完整的测试指南")
    print("3. 进行用户 beta 测试")

if __name__ == "__main__":
    main()
```

**运行测试：**

```bash
cd /Users/yinshucheng/code/creo/MixRead/backend
python test_review_api.py
```

---

## 📊 检查清单

完成所有测试后，勾选：

- [ ] **后端启动成功**
  - [ ] 看到"Uvicorn running"
  - [ ] 没有错误信息

- [ ] **前端启动成功**
  - [ ] 看到"Serving HTTP"
  - [ ] 没有错误信息

- [ ] **浏览器访问成功**
  - [ ] 页面加载正常
  - [ ] 看到"Choose Review Type"
  - [ ] 没有 404 或 CORS 错误

- [ ] **会话创建成功**
  - [ ] 点击"Mixed"后看到卡片
  - [ ] 进度条显示
  - [ ] 显示单词和定义

- [ ] **答题功能**
  - [ ] 按 Space 显示答案
  - [ ] 点击按钮或按快捷键提交
  - [ ] 进度更新
  - [ ] 统计增加

- [ ] **API 测试**
  - [ ] curl 请求成功
  - [ ] 返回正确的 JSON 格式
  - [ ] 数据库更新正确

---

## 🎯 可能遇到的问题

### 问题 1: 浏览器显示"Cannot GET /pages/review-session.html"

**解决：**
```bash
# 确保前端服务启动在正确的目录
cd /Users/yinshucheng/code/creo/MixRead/frontend
python -m http.server 8001 --bind localhost
```

### 问题 2: 后端返回 404 错误

**解决：** 检查 `backend/main.py` 是否添加了：
```python
from api.review import router as review_router
app.include_router(review_router)
```

### 问题 3: CORS 错误

**解决：** 这是正常的，后端已配置 CORS。刷新页面即可。

### 问题 4: 卡片不显示

**检查：** 数据库中是否有测试数据（至少 5 个单词）

---

## 📞 快速支持

遇到问题？按这个顺序排查：

1. **检查终端输出** - 是否有错误信息
2. **查看浏览器控制台** - F12 → Console
3. **查看网络请求** - F12 → Network
4. **参考 TESTING.md** - 更详细的故障排除

---

## ✅ 完成后的下一步

✨ 系统测试成功后：

1. **运行完整的集成测试**
   ```bash
   cd backend
   python test_review_api.py
   ```

2. **实现统计端点**
   - 参考 `docs/features/vocabulary-review/QUICK_START.md`
   - 实现 GET /users/{user_id}/review/stats
   - 实现 GET /users/{user_id}/review/schedule

3. **进行用户 beta 测试**
   - 邀请 3-5 个用户
   - 收集反馈
   - 迭代改进

4. **准备上线**
   - 性能测试
   - 安全审计
   - 部署到生产环境

---

**现在开始吧！🚀**

记住：启动顺序很重要！

1. 先启动后端
2. 再启动前端（可选）
3. 最后打开浏览器

祝你测试愉快！ 😊