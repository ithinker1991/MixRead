# MixRead - 智能英语阅读助手

English Reading Assistant with Chinese Translation Support

## 项目简介 Project Overview

MixRead 是一个 Chrome 浏览器扩展，帮助英语学习者在阅读网页时：
- 自动识别和高亮难度词汇（基于 CEFR 分级）
- 在单词旁边显示中文释义
- 提供详细的单词定义和例句
- 支持个性化词汇库

MixRead is a Chrome extension that helps English learners by:
- Auto-detecting and highlighting difficult words (based on CEFR levels)
- Displaying Chinese translations next to words
- Providing detailed definitions and example sentences
- Supporting personalized vocabulary library

## 功能特性 Features

### 1. 智能单词高亮 Smart Word Highlighting
- 基于 CEFR (A1-C2) 难度等级自动高亮
- 可调节难度级别
- 实时页面分析

### 2. 中文释义显示 Chinese Translation Display
- 内联显示中文翻译（不影响原文阅读）
- 299+ 常用词汇库
- 可通过设置开关控制

### 3. 详细词汇信息 Detailed Word Information
- 点击单词查看完整定义
- CEFR 等级标注
- 例句展示
- 添加到个人词汇库

## 快速开始 Quick Start

### 1. 后端启动 Backend Setup

\`\`\`bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
\`\`\`

### 2. 前端安装 Frontend Installation

1. 打开 Chrome 浏览器
2. 访问 chrome://extensions
3. 开启 "开发者模式"
4. 点击 "加载已解压的扩展程序"
5. 选择 MixRead/frontend 文件夹

### 3. 使用说明 Usage

1. 确保后端正在运行（localhost:8000）
2. 访问任意英文网页
3. 扩展会自动高亮难度词汇并显示中文
4. 点击扩展图标调整设置

## 当前状态 Current Status

### ✅ 已完成
- CEFR 词汇分级系统
- 智能单词高亮
- 中文释义内联显示
- 299 词中文词典（覆盖率 83.6%）
- 词汇详情弹窗
- 难度级别和中文显示开关

### 📋 规划中
- 词干提取（自动匹配词形变化）
- 扩展词典到 500+ 词
- 词汇学习统计

## 故障排查 Troubleshooting

### 中文不显示？
1. 确认后端显示 "Loaded 299 Chinese translations"
2. 完全重新加载扩展（移除后重新加载）
3. 确认设置中 "显示中文释义" 已开启

### 后端无法启动？
\`\`\`bash
lsof -ti:8000 | xargs kill -9
cd backend && source venv/bin/activate && python main.py
\`\`\`

## 文档 Documentation

- [中文显示修复文档](CHINESE_DISPLAY_FIX.md)
- [完整检查脚本](check_everything.sh)

---

**Happy Reading! 快乐阅读！📚**
