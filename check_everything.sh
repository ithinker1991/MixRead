#!/bin/bash

echo "🔍 MixRead 完整检查"
echo "===================="
echo ""

# 1. 后端
echo "1️⃣ 后端检查"
if curl -s http://localhost:8000/health > /dev/null; then
    echo "   ✅ 后端运行中"

    # 测试中文API
    chinese=$(curl -s http://localhost:8000/word/beautiful | python3 -c "import sys,json; print(json.load(sys.stdin).get('chinese', 'NULL'))" 2>/dev/null)
    if [ "$chinese" != "NULL" ] && [ "$chinese" != "None" ]; then
        echo "   ✅ 中文API: $chinese"
    else
        echo "   ❌ 中文API返回: $chinese"
        echo "      问题：后端没有加载中文词典"
        exit 1
    fi
else
    echo "   ❌ 后端未运行"
    echo "      解决：cd backend && source venv/bin/activate && python main.py"
    exit 1
fi

echo ""

# 2. 前端文件
echo "2️⃣ 前端文件检查"

critical_files=(
    "frontend/manifest.json"
    "frontend/content.js"
    "frontend/content.css"
    "frontend/background.js"
    "frontend/popup.html"
    "frontend/popup.js"
)

for file in "${critical_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file 不存在"
        exit 1
    fi
done

# 检查关键代码
if grep -q "showChinese" frontend/content.js; then
    echo "   ✅ content.js 包含 showChinese 逻辑"
else
    echo "   ❌ content.js 缺少 showChinese"
    exit 1
fi

if grep -q "mixread-chinese" frontend/content.css; then
    echo "   ✅ content.css 包含中文样式"
else
    echo "   ❌ content.css 缺少中文样式"
    exit 1
fi

if grep -q "toggle-chinese" frontend/popup.html; then
    echo "   ✅ popup.html 包含中文开关"
else
    echo "   ❌ popup.html 缺少中文开关"
    exit 1
fi

echo ""

# 3. 词典
echo "3️⃣ 词典检查"
if [ -f "backend/chinese_dict.json" ]; then
    word_count=$(cat backend/chinese_dict.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null)
    echo "   ✅ 词典存在：$word_count 个单词"
else
    echo "   ❌ 词典文件不存在"
    exit 1
fi

echo ""

# 4. 扩展状态提示
echo "4️⃣ Chrome 扩展检查"
echo "   ⚠️  无法自动检查，请手动确认："
echo ""
echo "   A. 打开 chrome://extensions"
echo "   B. 确认 MixRead 扩展已加载"
echo "   C. 如果代码有更新，必须："
echo "      1. 点击扩展的 '移除' 按钮"
echo "      2. 重新 '加载已解压的扩展程序'"
echo "      3. 选择 frontend 文件夹"
echo ""

# 5. 测试建议
echo "5️⃣ 测试步骤"
echo ""
echo "   打开: file://$(pwd)/frontend/test.html"
echo ""
echo "   应该看到："
echo "   - 部分单词黄色高亮"
echo "   - 高亮单词后有灰色小字中文，例如："
echo "     beautiful(美丽的) difficult(困难的)"
echo ""
echo "   如果没有中文："
echo "   1. 点击扩展图标"
echo "   2. 确认 '显示中文释义' 开关是开启的（蓝色）"
echo "   3. 调整难度到 A1 或 B1"
echo "   4. 刷新页面"
echo ""

echo "✅ 所有自动检查通过！"
echo ""
echo "📌 下一步："
echo "   1. 完全重新加载 Chrome 扩展（移除后重新加载）"
echo "   2. 打开测试页面"
echo "   3. 查看是否显示中文"
