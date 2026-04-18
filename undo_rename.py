import os
import sys
import json
import shutil

# Windows terminal fix
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

log_file = 'rename_history.log'
if not os.path.exists(log_file):
    print("Error: rename_history.log not found.")
    sys.exit(1)

with open(log_file, 'r', encoding='utf-8') as f:
    lines = f.readlines()

count = 0
for line in reversed(lines):
    if 'RENAME: ' in line:
        try:
            content = line.strip().split('RENAME: ')[1]
            old_path, new_path = content.split(' -> ')
            
            if os.path.exists(new_path) and new_path != old_path:
                os.rename(new_path, old_path)
                count += 1
        except Exception as e:
            print(f"Error restoring line: {line.strip()} - {e}")

if os.path.exists('luts_config_pre_rename.json'):
    shutil.copy('luts_config_pre_rename.json', 'luts_config.json')
    print("Restored luts_config.json from backup.")

print(f"Successfully restored {count} files to original names.")
