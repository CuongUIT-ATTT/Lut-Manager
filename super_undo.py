import json
import os
import sys
import shutil

# Windows terminal fix
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

CURRENT_CONF = 'luts_config.json'
ORIGINAL_CONF = 'luts_config_pre_rename.json'

if not os.path.exists(ORIGINAL_CONF):
    print("Error: Original backup not found!")
    sys.exit(1)

with open(CURRENT_CONF, 'r', encoding='utf-8') as f:
    current_data = json.load(f)

with open(ORIGINAL_CONF, 'r', encoding='utf-8') as f:
    original_data = json.load(f)

count = 0
for i, cat in enumerate(current_data):
    for j, fInfo in enumerate(cat['files']):
        current_rel = fInfo['rel']
        original_rel = original_data[i]['files'][j]['rel']
        
        if os.path.exists(current_rel) and current_rel != original_rel:
            try:
                if os.path.exists(original_rel) and current_rel != original_rel:
                    os.rename(original_rel, original_rel + ".bak_undo")
                
                os.rename(current_rel, original_rel)
                count += 1
            except Exception as e:
                pass

shutil.copy(ORIGINAL_CONF, CURRENT_CONF)
print(f"Successfully restored {count} files.")
