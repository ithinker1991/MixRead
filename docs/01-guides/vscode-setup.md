# VSCode 开发环境完整配置指南

## 📋 快速检查清单

- [ ] VSCode 版本 1.80+
- [ ] Python 3.7+ 已安装
- [ ] Git 已安装
- [ ] 项目已克隆到本地
- [ ] 后端虚拟环境已创建

## 🚀 5 分钟快速启动

### 1. 打开项目文件夹
```bash
# 在终端中打开项目
code /path/to/MixRead

# 或从 VSCode 菜单: File > Open Folder
```

### 2. 安装推荐插件
VSCode 会弹出提示：
```
"MixRead" 建议安装一些扩展
```

点击 "Install All" 或手动安装（见下文）

### 3. 初始化后端环境
打开 VSCode 终端（Ctrl+` 或 View > Terminal）：

```bash
# VSCode 会自动提示，或手动运行
Cmd+Shift+P → "Tasks: Run Task" → "🔧 后端 - 首次设置"
```

等待完成（2-3分钟）。

### 4. 启动后端服务器
```bash
Cmd+Shift+P → "Tasks: Run Task" → "🚀 启动后端服务器"
```

应该看到：
```
INFO:     Started server process [12345]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 5. 测试后端
```bash
Cmd+Shift+P → "Tasks: Run Task" → "🧪 运行后端测试"
```

应该看到：
```
✓ Health check passed
✓ Word lookup works
✓ All tests passed
```

**完成！** 现在可以开发了。

---

## 🔧 详细配置说明

### VSCode 必需配置文件

项目中已包含 `.vscode/` 目录，包含：

#### 1. `settings.json` - 编辑器设置
- Python 路径：自动指向 `backend/venv/bin/python`
- 代码格式化：自动使用 Black (Python) 和 Prettier (JS)
- 保存时自动格式化
- 代码 Linting：Pylint (Python) + ESLint (JS)

**验证**:
- 打开任何 Python 文件
- 修改代码后保存
- 应该自动格式化

#### 2. `launch.json` - 调试配置
预配置了 4 种启动方式：

```json
"configurations": [
  "🚀 后端服务器 (Backend)",
  "🧪 后端测试 (Backend Tests)",
  "🧪 单个后端测试 (Single Test)",
  "🔌 附加到 Chrome (Attach to Chrome)"
]
```

#### 3. `tasks.json` - 快捷任务
预配置了 8 个常用任务：

```
🚀 启动后端服务器
🧪 运行后端测试
🔧 后端 - 首次设置
📦 后端 - 安装依赖
🧹 清理 - Python 缓存
✅ 完整测试
📊 生成测试报告
🐛 VSCode 问题诊断
```

#### 4. `extensions.json` - 推荐插件列表
列出了所有必需和推荐的 VSCode 扩展。

---

## 📦 必需插件安装

### 方式 1: 自动安装（推荐）
VSCode 启动时会显示：
```
"MixRead" 建议安装一些扩展
[安装所有]  [显示推荐]  [稍后]
```

点击 "[安装所有]"

### 方式 2: 手动安装关键插件

在 VSCode 中打开扩展市场 (Cmd+Shift+X)，搜索并安装：

**必需 (Required)**:
1. `ms-python.python` - Python 官方扩展
2. `ms-python.vscode-pylance` - Python 语言服务器
3. `esbenp.prettier-vscode` - JavaScript 格式化

**推荐 (Recommended)**:
4. `charliermarsh.ruff` - Python 快速 Linter
5. `dbaeumer.vscode-eslint` - JavaScript 质量检查
6. `eamodio.gitlens` - Git 增强
7. `GitHub.copilot` - AI 代码补全 (可选)

### 方式 3: 命令行安装

```bash
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension esbenp.prettier-vscode
code --install-extension charliermarsh.ruff
code --install-extension dbaeumer.vscode-eslint
```

---

## 🎯 常见开发任务

### 启动后端服务器

**方式 1: 按钮（最简单）**
- 左侧活动栏 > 运行和调试 (或 Cmd+Shift+D)
- 顶部下拉菜单选择 "🚀 后端服务器"
- 点击绿色 "Start" 按钮

**方式 2: 快捷键**
- `Cmd+Shift+P` 打开命令面板
- 输入 "Tasks: Run Task"
- 选择 "🚀 启动后端服务器"

**方式 3: 键盘快捷方式**
添加到 `~/.vscode/keybindings.json`:
```json
{
  "key": "cmd+alt+b",
  "command": "workbench.action.tasks.runTask",
  "args": "🚀 启动后端服务器"
}
```
然后 `Cmd+Alt+B` 启动

### 运行后端测试

**在测试文件中**:
1. 打开 `backend/test_api.py`
2. 右上角看到 "▶ Run | Debug" 按钮
3. 点击 "Debug" 运行单个测试

**运行所有测试**:
1. `Cmd+Shift+P` → "Tasks: Run Task"
2. 选择 "🧪 运行后端测试"

**调试单个测试**:
1. 打开 `backend/test_api.py`
2. 点击测试函数名称左侧的行号
3. 设置断点（F9）
4. `Cmd+Shift+P` → "Debug Python" 或按 F5

### 调试 Python 代码

**在后端服务器中设置断点**:
1. 打开 `backend/main.py`
2. 点击想要停止的代码行左侧
3. 应该显示红点（断点）
4. 启动服务器 (F5 或"运行和调试" > "后端服务器")
5. 当代码执行到断点时会暂停
6. 使用调试器工具栏单步执行

**检查变量**:
- 左侧 "Variables" 面板
- 或在 Debug Console 输入 `print(variable)`

### 编辑 Chrome 扩展

**打开扩展代码**:
1. 打开 `frontend/content.js`
2. 查看 JavaScript 代码

**修改后重新加载扩展**:
1. 打开 `chrome://extensions`
2. 找到 "MixRead"
3. 点击 "重新加载" 图标
4. 打开网页测试变更

**调试 JavaScript**:
1. 在 `frontend/content.js` 中设置断点
2. 打开 Chrome DevTools (F12)
3. 在 Console 中调试

---

## 🔍 VSCode 快捷键速查表

### 编辑快捷键
```
Cmd+D          - 选择当前单词的所有匹配
Cmd+Shift+L    - 为所有匹配选择添加光标
Cmd+/          - 切换行注释
Cmd+Alt+/      - 切换块注释
Cmd+K Cmd+C    - 添加行注释
Cmd+K Cmd+U    - 移除行注释
```

### 导航快捷键
```
Cmd+P          - 快速打开文件
Cmd+Shift+O    - 转到符号（函数、类）
Ctrl+G         - 转到行
Cmd+T          - 转到所有符号
F2             - 重命名符号
Cmd+Shift+H    - 在文件中替换
```

### 调试快捷键
```
F5             - 启动或继续调试
F6             - 暂停
F7             - 单步进入
F8             - 单步跳过
F9             - 设置/取消断点
F11            - 单步返回
Ctrl+Shift+D   - 打开运行和调试
```

### Python 相关
```
Cmd+Shift+P    - 打开命令面板
  > Python: Select Interpreter  - 选择 Python 版本
  > Python: Create Terminal     - 创建 Python 终端
```

---

## 🧪 测试工作流

### 完整测试流程

```
1. 启动后端服务器
   Cmd+Shift+P → "Tasks: Run Task" → "🚀 启动后端服务器"

2. 运行所有测试
   Cmd+Shift+P → "Tasks: Run Task" → "✅ 完整测试"

3. 查看测试结果
   终端会显示通过/失败

4. 如果失败，调试
   打开失败的测试文件
   在测试函数处设置断点
   F5 启动调试

5. 生成测试报告
   Cmd+Shift+P → "Tasks: Run Task" → "📊 生成测试报告"
   打开 backend/test_report.html
```

### Python 单元测试调试

在 VSCode 中直接调试单个测试：

```python
# backend/test_api.py

def test_get_word():
    """这个测试会被 VSCode 识别"""
    ...
```

你会看到在函数上方有 "▶ Run | Debug" 链接。点击 "Debug" 运行并暂停在断点处。

---

## 🐛 常见问题排查

### 问题 1: Python 解释器未找到
**症状**:
```
Python is not installed
```

**解决**:
1. 确保 Python 3.7+ 已安装: `python3 --version`
2. 在 VSCode 中: `Cmd+Shift+P` → "Python: Select Interpreter"
3. 选择系统 Python 或虚拟环境 Python

### 问题 2: 虚拟环境找不到
**症状**:
```
ModuleNotFoundError: No module named 'fastapi'
```

**解决**:
1. 确保 venv 已创建: `ls backend/venv/bin/python`
2. 运行: `Cmd+Shift+P` → "Tasks: Run Task" → "🔧 后端 - 首次设置"
3. 等待完成，然后重启 VSCode

### 问题 3: 后端启动但无法连接
**症状**:
```
Connection refused to localhost:8000
```

**解决**:
1. 检查服务器是否在运行: 在终端看 "Uvicorn running on..."
2. 检查端口 8000 是否被占用: `lsof -i :8000`
3. 如果被占用，杀死进程: `kill -9 <PID>`
4. 重新启动服务器

### 问题 4: 插件没有生效
**症状**:
```
代码没有格式化，没有自动补全
```

**解决**:
1. 检查插件是否安装: `Cmd+Shift+X` 搜索
2. 检查是否启用: 看插件列表中是否有禁用标记
3. 重启 VSCode: `Cmd+Q` 然后重新打开
4. 查看输出日志: "View" > "Output" > 选择扩展名

### 问题 5: 调试断点不工作
**症状**:
```
设置断点但程序不停止
```

**解决**:
1. 确保用 F5 或调试按钮启动（不是直接运行）
2. 检查调试器是否正在运行（左侧调试面板应该有变量）
3. 尝试 `Cmd+Shift+P` → "Debug: Toggle Auto-Attach"
4. 确保没有设置 `skipFiles` 来跳过该文件

### 问题 6: 诊断任何问题
运行诊断任务：
```
Cmd+Shift+P → "Tasks: Run Task" → "🐛 VSCode 问题诊断"
```

---

## 📝 推荐工作流

### 每日开发流程

```
1. 早上启动
   ├─ 打开 VSCode
   ├─ 安装推荐插件（如果是首次）
   └─ 运行 "🚀 启动后端服务器"

2. 开发中
   ├─ 编辑代码（自动格式化）
   ├─ 保存文件
   ├─ 看到格式化完成
   └─ 代码自动检查错误

3. 测试
   ├─ 运行 "✅ 完整测试"
   ├─ 查看测试结果
   └─ 如需调试，在断点调试

4. 提交前
   ├─ 运行完整测试
   ├─ 检查没有错误/警告
   ├─ 查看 Git 变更 (GitLens)
   └─ 提交代码

5. 下班
   └─ 关闭 VSCode（后端自动停止）
```

---

## ⚙️ 高级配置

### 自定义代码片段

创建 `~/.vscode/snippets/python.json`:
```json
{
  "FastAPI Endpoint": {
    "prefix": "fastapiep",
    "body": [
      "@app.get(\"/$1\")",
      "async def $2($3):",
      "    \"\"\"$4\"\"\"",
      "    return {\"$5\": \"$6\"}"
    ]
  }
}
```

### 自定义快捷键

打开 `Cmd+K Cmd+S` (Preferences: Open Keyboard Shortcuts)

添加自定义绑定到 `keybindings.json`:
```json
[
  {
    "key": "cmd+shift+t",
    "command": "workbench.action.tasks.runTask",
    "args": "✅ 完整测试"
  }
]
```

### 工作区设置

为特定项目自定义设置。`.vscode/settings.json` 已配置好，优先于全局设置。

---

## 🎓 学习资源

- VSCode 官方文档: https://code.visualstudio.com/docs
- Python 扩展文档: https://github.com/microsoft/vscode-python
- Pylance 文档: https://github.com/microsoft/pylance-release

---

## ✅ 配置验证清单

完成以下步骤确保一切就绪：

- [ ] VSCode 已打开 MixRead 项目
- [ ] 推荐插件已安装
- [ ] Python 解释器已选择 (`backend/venv/bin/python`)
- [ ] 后端虚拟环境已初始化
- [ ] 后端服务器可以启动
- [ ] 后端测试可以运行
- [ ] 代码保存时自动格式化
- [ ] 可以设置断点并调试

**全部完成？恭喜！现在可以开始开发了！** 🚀

---

**版本**: VSCode 1.80+
**更新**: 2024年11月28日
**维护者**: MixRead 开发团队
