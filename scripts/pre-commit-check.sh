#!/bin/bash
# Pre-commit Code Quality Check Script
# Run this before committing to ensure code quality

echo "🔍 Running pre-commit code quality checks..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall success
OVERALL_SUCCESS=true

# Function to check file for issues
check_file() {
    local file=$1
    local issues=0
    
    echo "🔍 Checking $file..."
    
    # Check for console.log in JavaScript files
    if [[ $file == *.js ]]; then
        # Count console.log statements (excluding the ones we intentionally kept)
        console_count=$(grep -c "console.log" "$file" 2>/dev/null || echo 0)
        if [ $console_count -gt 50 ]; then
            echo -e "${RED}❌ Too many console.log statements ($console_count) in $file${NC}"
            issues=$((issues + 1))
        else
            echo -e "${GREEN}✅ Console.log count acceptable ($console_count)${NC}"
        fi
        
        # Check for functions longer than 100 lines
        long_functions=$(awk '/^function|^const.*=.*function|^[[:space:]]*[a-zA-Z_$][a-zA-Z0-9_$]*[[:space:]]*\([^)]*\)[[:space:]]*[{]/ {
            func_name = $0
            gsub(/^[[:space:]]*/, "", func_name)
            gsub(/function.*/, "function", func_name)
            gsub(/const.*/, "function", func_name)
            bracket_count = 0
            line_count = 0
            in_function = 1
        }
        in_function {
            line_count++
            bracket_count += gsub(/{/, "{", $0)
            bracket_count -= gsub(/}/, "}", $0)
            if (bracket_count == 0 && in_function) {
                if (line_count > 100) {
                    print "Function at line " NR - line_count + 1 " is " line_count " lines"
                    long_function_count++
                }
                in_function = 0
            }
        }
        END {
            if (long_function_count > 0) print long_function_count
        }' "$file" 2>/dev/null)
        
        if [ -n "$long_functions" ] && [ "$long_functions" -gt 0 ]; then
            echo -e "${RED}❌ Found $long_functions function(s) longer than 100 lines${NC}"
            issues=$((issues + 1))
        else
            echo -e "${GREEN}✅ No excessively long functions${NC}"
        fi
    fi
    
    # Check CSS files for issues
    if [[ $file == *.css ]]; then
        # Check for unused CSS selectors (basic check)
        selector_count=$(grep -c "^[[:space:]]*[^@]" "$file" 2>/dev/null || echo 0)
        if [ $selector_count -gt 500 ]; then
            echo -e "${YELLOW}⚠️  Large CSS file ($selector_count selectors) - consider splitting${NC}"
        fi
    fi
    
    # Check for TODO/FIXME comments
    todo_count=$(grep -c -i "TODO\|FIXME\|HACK" "$file" 2>/dev/null || echo 0)
    if [ $todo_count -gt 5 ]; then
        echo -e "${YELLOW}⚠️  Found $todo_count TODO/FIXME comments in $file${NC}"
    elif [ $todo_count -gt 0 ]; then
        echo -e "${GREEN}✅ Found $todo_count TODO/FIXME comments (acceptable)${NC}"
    else
        echo -e "${GREEN}✅ No TODO/FIXME comments found${NC}"
    fi
    
    if [ $issues -gt 0 ]; then
        OVERALL_SUCCESS=false
    fi
    
    echo ""
}

# Check modified files
echo "📁 Checking modified files..."
modified_files=$(git diff --cached --name-only 2>/dev/null || git diff --name-only)
if [ -z "$modified_files" ]; then
    echo "📝 No files to check"
    exit 0
fi

for file in $modified_files; do
    if [ -f "$file" ]; then
        check_file "$file"
    fi
done

# Check for large documentation files
echo "📚 Checking documentation files..."
for file in *.md; do
    if [ -f "$file" ]; then
        line_count=$(wc -l < "$file")
        if [ $line_count -gt 500 ]; then
            echo -e "${YELLOW}⚠️  Large documentation file: $file ($line_count lines)${NC}"
        fi
    fi
done

# Summary
echo "================================"
if [ "$OVERALL_SUCCESS" = true ]; then
    echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
    echo ""
    echo "📝 Commit suggestions:"
    echo "   - Use a clear commit message"
    echo "   - Keep changes focused and atomic"
    echo "   - Add tests for new functionality"
    exit 0
else
    echo -e "${RED}❌ Pre-commit checks failed!${NC}"
    echo ""
    echo "🔧 Please fix the issues above before committing."
    echo "💡 Run 'npm run lint' or 'npm run format' if available"
    exit 1
fi
