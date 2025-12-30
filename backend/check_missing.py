import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from infrastructure.dictionary import dictionary_service

words = ["app", "usa", "vp", "doc", "jan", "cm", "ie", "fyi"]

print(f"{'Word':<10} | {'Found':<6} | {'MRS':<5} | {'Level':<5} | {'Source':<10} | {'Translation'}")
print("-" * 90)

for word in words:
    info = dictionary_service.lookup(word)
    mrs = info.get('mrs')
    level = info.get('level')
    source = info.get('source', 'None')
    found = info.get('found', False)
    trans = info.get('translation', '') or ''
    # Handle None translation
    if trans is None: trans = ""
    trans = trans.replace('\n', ' ')
    print(f"{word:<10} | {str(found):<6} | {str(mrs):<5} | {str(level):<5} | {source:<10} | {trans[:40]}")
