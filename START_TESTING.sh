#!/bin/bash

# MixRead Review System - 快速启动测试脚本
# Usage: bash START_TESTING.sh

set -e

PROJECT_ROOT="/Users/yinshucheng/code/creo/MixRead"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 MixRead Review System - 快速启动测试                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function: 打印分隔线
print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Function: 打印成功信息
success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function: 打印警告信息
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function: 打印错误信息
error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function: 检查端口是否被占用
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# ============================================================
# 第一步：检查环境
# ============================================================

print_section "第一步：检查环境"

# 检查 Python
if ! command -v python &> /dev/null; then
    error "Python 未安装"
    exit 1
fi
success "Python 已安装: $(python --version)"

# 检查 curl (可选)
if command -v curl &> /dev/null; then
    success "curl 已安装"
else
    warning "curl 未安装（可选）"
fi

# ============================================================
# 第二步：启动后端
# ============================================================

print_section "第二步：启动后端服务 (http://localhost:8000)"

if check_port 8000; then
    warning "端口 8000 已被占用"
    warning "跳过启动后端（假设已在运行）"
else
    echo "启动后端..."
    cd "$BACKEND_DIR"
    python main.py > /tmp/mixread_backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > /tmp/mixread_backend.pid

    # 等待后端启动
    sleep 3

    if check_port 8000; then
        success "后端已启动 (PID: $BACKEND_PID)"
        success "日志文件: /tmp/mixread_backend.log"
    else
        error "后端启动失败"
        cat /tmp/mixread_backend.log | head -20
        exit 1
    fi
fi

# 检查后端是否响应
echo "检查后端连接..."
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    success "后端已连接"
else
    error "无法连接到后端"
    exit 1
fi

# ============================================================
# 第三步：启动前端
# ============================================================

print_section "第三步：启动前端服务 (http://localhost:8001)"

if check_port 8001; then
    warning "端口 8001 已被占用"
    warning "跳过启动前端（假设已在运行）"
else
    echo "启动前端..."
    cd "$FRONTEND_DIR"
    python -m http.server 8001 --bind localhost > /tmp/mixread_frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > /tmp/mixread_frontend.pid

    # 等待前端启动
    sleep 1

    if check_port 8001; then
        success "前端已启动 (PID: $FRONTEND_PID)"
        success "日志文件: /tmp/mixread_frontend.log"
    else
        error "前端启动失败"
        cat /tmp/mixread_frontend.log | head -20
        exit 1
    fi
fi

# ============================================================
# 第四步：添加测试数据
# ============================================================

print_section "第四步：准备测试数据"

cd "$BACKEND_DIR"

echo "检查测试数据..."

python << 'PYTHON_SCRIPT'
from infrastructure.database import init_db, SessionLocal
from infrastructure.models import VocabularyEntryModel
from datetime import datetime
import sys

init_db()
db = SessionLocal()

# 检查是否已有测试数据
existing = db.query(VocabularyEntryModel).filter_by(user_id='test_user').count()

if existing >= 5:
    print(f"✅ 已有 {existing} 个测试单词")
    sys.exit(0)

# 添加测试单词
test_words = [
    'serendipity', 'ephemeral', 'quintessential',
    'ubiquitous', 'eloquent', 'melancholy',
    'pragmatic', 'nuance', 'ambiguous', 'diligent'
]

added = 0
for word in test_words:
    existing_entry = db.query(VocabularyEntryModel).filter_by(
        user_id='test_user',
        word=word
    ).first()

    if not existing_entry:
        entry = VocabularyEntryModel(
            user_id='test_user',
            word=word
        )
        db.add(entry)
        added += 1

db.commit()
print(f"✅ 添加了 {added} 个新测试单词")
print(f"✅ 总共有 {existing + added} 个测试单词可用")

PYTHON_SCRIPT

# ============================================================
# 第五步：运行 API 测试
# ============================================================

print_section "第五步：运行 API 集成测试"

cd "$BACKEND_DIR"

echo "执行 API 测试套件..."
echo ""

python test_review_api.py

# ============================================================
# 完成
# ============================================================

print_section "✅ 测试环境已就绪"

echo ""
echo "📋 接下来的步骤："
echo ""
echo "1️⃣  在浏览器中打开 Review 页面:"
echo "   ${BLUE}http://localhost:8001/pages/review-session.html?user_id=test_user${NC}"
echo ""
echo "2️⃣  查看测试指南:"
echo "   - 快速参考: ${BLUE}TEST_GUIDE.md${NC}"
echo "   - 浏览器测试: ${BLUE}BROWSER_TEST_GUIDE.md${NC}"
echo ""
echo "3️⃣  手动测试步骤:"
echo "   • 点击 'Mixed' 按钮启动会话"
echo "   • 按 Space 显示答案"
echo "   • 按 1-4 提交评分"
echo "   • 完成所有卡片"
echo ""
echo "📊 系统状态:"
echo "   后端: ${GREEN}✅ 运行中 (http://localhost:8000)${NC}"
echo "   前端: ${GREEN}✅ 运行中 (http://localhost:8001)${NC}"
echo "   测试数据: ${GREEN}✅ 已准备${NC}"
echo "   API 测试: ${GREEN}✅ 已通过${NC}"
echo ""
echo "🛑 停止服务:"
echo "   • 后端: kill $(cat /tmp/mixread_backend.pid 2>/dev/null || echo '?')"
echo "   • 前端: kill $(cat /tmp/mixread_frontend.pid 2>/dev/null || echo '?')"
echo ""
echo "🚀 准备好了吗？现在就打开浏览器测试吧！"
echo ""

