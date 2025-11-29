# MixRead 真实安装和测试指南

**重要**: Chrome 扩展必须手动加载，无法自动安装。这是 Chrome 的安全限制。

## ⚠️ 关键事实

1. **Chrome 扩展不能自动安装** - 必须手动在 Chrome 中加载
2. **需要后端运行** - 扩展依赖本地后端 API
3. **需要图标文件** - 已创建 (frontend/images/)
4. **测试需要真实网页** - 在实际英文网站上测试

---

## 🚀 完整安装流程（15分钟）

### 第一步：启动后端服务器 ⏱️ 5分钟

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境（首次）
python3 -m venv venv

# 3. 激活虚拟环境
source venv/bin/activate

# 4. 安装依赖
pip install -r requirements.txt

# 5. 下载词库数据
python download_cefr_data.py

# 6. 启动服务器
python main.py
```

**验证后端正常**:
```bash
# 在新终端窗口运行
curl http://localhost:8000/health

# 应该看到:
# {"status":"ok","words_loaded":6860}
```

**保持这个终端窗口开着**，后端需要一直运行！

---

### 第二步：手动加载 Chrome 扩展 ⏱️ 3分钟

#### 2.1 打开 Chrome 扩展页面

```
方式 1: 在地址栏输入
chrome://extensions

方式 2: 菜单导航
Chrome 菜单 → 更多工具 → 扩展程序
```

#### 2.2 启用开发者模式

在页面右上角，找到并**打开** "开发者模式" 开关。

```
┌─────────────────────────────────────┐
│ 扩展程序                 开发者模式 ○│  ← 点击这里
└─────────────────────────────────────┘
```

#### 2.3 加载扩展

点击左上角的 **"加载已解压的扩展程序"** 按钮。

```
┌────────────────┐
│ 加载已解压的扩展程序 │  ← 点击这里
└────────────────┘
```

#### 2.4 选择目录

在文件选择器中:
1. 导航到 MixRead 项目目录
2. 选择 **`frontend`** 文件夹
3. 点击 "选择"

```
/Users/你的用户名/code/creo/MixRead/frontend  ← 选择这个文件夹
```

#### 2.5 验证加载成功

你应该看到 MixRead 出现在扩展列表中：

```
┌──────────────────────────────────────┐
│ MixRead                         v0.1.0│
│ 已启用                               │
│ Improve your English reading...     │
│                                      │
│ [详细信息] [移除] [刷新]              │
└──────────────────────────────────────┘
```

**如果看到错误**，检查：
- ✓ 是否选择了 `frontend` 文件夹（不是根目录）
- ✓ `manifest.json` 文件是否存在
- ✓ 图标文件是否存在（`images/icon-*.png`）

---

### 第三步：测试扩展 ⏱️ 5分钟

#### 3.1 打开测试页面

**方式 1: 使用项目自带的测试页面**

```bash
# 在浏览器中打开
open frontend/test.html

# 或者直接拖拽文件到 Chrome
```

**方式 2: 使用真实英文网站**

推荐网站：
- https://www.bbc.com/news
- https://www.theguardian.com
- https://en.wikipedia.org/wiki/Main_Page

#### 3.2 验证功能

**检查清单**:

- [ ] 页面上的英文单词被黄色高亮
- [ ] 点击高亮单词显示定义弹窗
- [ ] 弹窗包含：定义、CEFR等级、例句
- [ ] 点击扩展图标打开设置弹窗
- [ ] 难度滑杆可以调节（A1-C2）
- [ ] 调节后页面重新高亮
- [ ] "Add to Library" 可以保存单词
- [ ] "View Vocabulary" 显示已保存单词

#### 3.3 如果没有单词高亮

**可能原因**:

1. **后端未运行**
   ```bash
   # 检查后端
   curl http://localhost:8000/health
   # 如果失败，回到第一步重新启动后端
   ```

2. **难度设置太高**
   - 点击扩展图标
   - 将滑杆调到 A1 或 B1
   - 刷新页面

3. **网页不是英文**
   - 确保访问的是英文网站
   - 尝试 test.html

4. **浏览器控制台有错误**
   - 按 F12 打开开发者工具
   - 查看 Console 标签
   - 如果看到红色错误，记下错误信息

---

## 🐛 常见问题和解决方案

### 问题 1: "无法加载清单"

**错误信息**:
```
Could not load icon 'images/icon-16.png' specified in 'icons'.
无法加载清单。
```

**解决**:
```bash
# 检查图标是否存在
ls -la frontend/images/

# 应该看到:
# icon-16.png
# icon-48.png
# icon-128.png

# 如果没有，重新创建
cd frontend/images
python3 create_icons.py
```

---

### 问题 2: "Failed to fetch" 或网络错误

**错误信息** (在浏览器控制台):
```
Failed to fetch http://localhost:8000/...
```

**解决**:

1. **检查后端是否运行**:
   ```bash
   curl http://localhost:8000/health
   ```

2. **重启后端**:
   ```bash
   # 在后端终端按 Ctrl+C
   # 然后重新运行
   python main.py
   ```

3. **检查端口是否被占用**:
   ```bash
   lsof -i :8000
   # 如果被占用，杀死进程
   kill -9 <PID>
   ```

---

### 问题 3: 单词没有高亮

**可能原因**:

1. **检查难度设置**
   - 点击扩展图标
   - 确保滑杆不在 C2（最难）
   - 调到 B1 试试

2. **刷新页面**
   - 加载扩展后需要刷新页面
   - 按 Ctrl+R 或 Cmd+R

3. **检查是否是英文网页**
   - 扩展只标注英文单词
   - 中文网页不会有效果

4. **查看控制台错误**
   - F12 打开开发者工具
   - Console 标签查看错误

---

### 问题 4: 点击单词没有反应

**检查**:

1. **单词是否被高亮**
   - 只有黄色高亮的单词可以点击
   - 普通文字不会有反应

2. **后端API是否工作**
   ```bash
   curl http://localhost:8000/word/beautiful
   # 应该返回单词信息
   ```

3. **浏览器控制台错误**
   - F12 → Console
   - 看是否有红色错误信息

---

### 问题 5: 扩展图标不显示或显示空白

**解决**:

1. **检查图标文件**:
   ```bash
   ls frontend/images/
   ```

2. **重新加载扩展**:
   - chrome://extensions
   - 找到 MixRead
   - 点击刷新图标 🔄

3. **删除并重新加载**:
   - 点击 "移除"
   - 重新 "加载已解压的扩展程序"

---

## 🧪 完整测试流程

### 测试 1: 基础功能测试

```bash
# 1. 启动后端
cd backend && source venv/bin/activate && python main.py

# 2. 在 Chrome 中加载扩展
# chrome://extensions → 开发者模式 → 加载已解压

# 3. 打开测试页面
open frontend/test.html

# 4. 验证
- 看到黄色高亮单词 ✓
- 点击单词显示定义 ✓
- 定义包含 CEFR 等级 ✓
```

### 测试 2: 难度调节测试

```bash
# 1. 点击扩展图标
# 2. 将滑杆调到 A1（最简单）
#    → 应该看到很多单词高亮
# 3. 将滑杆调到 C2（最难）
#    → 高亮单词应该大幅减少
# 4. 调回 B1（中等）
```

### 测试 3: 词库功能测试

```bash
# 1. 点击一个高亮单词
# 2. 在弹窗中点击 "Add to Library"
# 3. 点击扩展图标
# 4. 点击 "View Vocabulary"
#    → 应该看到刚才添加的单词
# 5. 点击 "Clear All"
#    → 词库清空
```

### 测试 4: 真实网站测试

```bash
# 1. 访问 https://www.bbc.com/news
# 2. 选择任意英文新闻
# 3. 应该看到部分单词被高亮
# 4. 点击测试定义查询
# 5. 调整难度看效果
```

---

## 📝 调试技巧

### 查看扩展日志

1. 打开任意网页
2. 按 F12 打开开发者工具
3. Console 标签
4. 看 MixRead 相关的日志

### 查看后台脚本日志

1. chrome://extensions
2. 找到 MixRead
3. 点击 "检查视图: Service Worker"
4. 在新窗口查看后台日志

### 重新加载扩展

每次修改代码后：
1. chrome://extensions
2. 找到 MixRead
3. 点击刷新图标 🔄
4. 刷新测试页面

---

## ✅ 验证清单

完成以下步骤确保一切正常：

**后端**:
- [ ] 后端服务器启动成功
- [ ] `curl http://localhost:8000/health` 返回 OK
- [ ] `curl http://localhost:8000/word/beautiful` 返回数据

**扩展**:
- [ ] 扩展成功加载到 Chrome
- [ ] 扩展图标显示在工具栏
- [ ] 没有加载错误（manifest, icons）

**功能**:
- [ ] 打开英文网页看到高亮
- [ ] 点击单词显示定义
- [ ] 难度滑杆可以调节
- [ ] 可以添加单词到词库
- [ ] 统计数字正确更新

**全部完成？恭喜！扩展正常工作了！** 🎉

---

## 🎯 快速重启流程

每次开发时：

```bash
# 终端 1: 启动后端
cd backend
source venv/bin/activate
python main.py

# 终端 2: 验证
curl http://localhost:8000/health

# Chrome:
# 1. 刷新扩展 (如果修改了代码)
# 2. 刷新测试页面
# 3. 开始测试
```

---

## 📞 需要帮助？

如果遇到问题：

1. **检查后端日志** - 后端终端窗口
2. **检查浏览器控制台** - F12 → Console
3. **检查扩展错误** - chrome://extensions
4. **查看详细文档** - GETTING_STARTED.md

---

**记住**: Chrome 扩展必须手动加载，这不是 bug，是 Chrome 的设计！

**版本**: 1.0
**更新**: 2024年11月28日
