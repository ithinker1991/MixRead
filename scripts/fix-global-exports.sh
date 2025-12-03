#!/bin/bash
# Fix global exports for all modules in the frontend/modules directory

echo "🔧 Fixing global exports for MixRead modules..."

MODULES_DIR="/Users/yinshucheng/code/creo/MixRead/frontend/modules"

# List of module files that need global exports
modules=(
    "user/user-store.js:UserStore"
    "unknown-words/unknown-words-store.js:UnknownWordsStore"
    "unknown-words/unknown-words-service.js:UnknownWordsService"
    "domain-policy/domain-policy-store.js:DomainPolicyStore"
    "domain-policy/domain-policy-filter.js:DomainPolicyFilter"
    "domain-policy/preset-dialog.js:PresetDialog"
    "highlight/context-menu.js:ContextMenu"
    "highlight/highlight-filter.js:HighlightFilter"
    "panel/batch-marking-panel.js:BatchMarkingPanel"
    "panel/word-cache-manager.js:WordCacheManager"
)

fix_module_export() {
    local file_path="$1"
    local class_name="$2"
    
    echo "🔧 Fixing $file_path..."
    
    # Check if file exists
    if [ ! -f "$file_path" ]; then
        echo "❌ File not found: $file_path"
        return 1
    fi
    
    # Check if already has global export
    if grep -q "window\.$class_name\s*=" "$file_path"; then
        echo "✅ $file_path already has global export"
        return 0
    fi
    
    # Find the last line (usually just the closing brace)
    local last_line=$(tail -1 "$file_path")
    
    # If file ends with module.exports, replace it
    if grep -q "module.exports" "$file_path"; then
        # Replace existing module.exports
        sed -i '' "s/module\.exports = $class_name;/module.exports = $class_name;\n} else if (typeof window !== 'undefined') {\n  window.$class_name = $class_name;\n}/" "$file_path"
        echo "✅ Updated module.exports in $file_path"
    elif [[ "$last_line" == "}" ]]; then
        # Add export before the last closing brace
        sed -i '' '$i\
// Export for use in both module and global scope\
if (typeof module !== '\''undefined'\'' && module.exports) {\
  module.exports = '$class_name';\
} else if (typeof window !== '\''undefined'') {\
  window.'$class_name' = '$class_name';\
}
' "$file_path"
        echo "✅ Added export to $file_path"
    else
        echo "⚠️  Could not automatically fix $file_path"
        return 1
    fi
}

# Process each module
for module_info in "${modules[@]}"; do
    IFS=':' read -r file_path class_name <<< "$module_info"
    full_path="$MODULES_DIR/$file_path"
    fix_module_export "$full_path" "$class_name"
done

echo ""
echo "✅ Module export fixes complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Test the extension in Chrome"
echo "   2. Check console for any remaining errors"
echo "   3. Verify sidebar loads words correctly"
