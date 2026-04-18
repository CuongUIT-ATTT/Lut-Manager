import os
import shutil
import sys

# Windows terminal fix
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError: pass

def fix_extensions():
    # Force absolute root from current execution context
    root_dir = os.path.dirname(os.path.abspath(__file__))
    print(f"--- DANG QUET VA SUA LOI DUOI FILE TAI: {root_dir} ---")
    
    count = 0
    EXTS = ['.cube', '.zip', '.png', '.jpg', '.jpeg', '.xmp', '.vlt', '.mov', '.mp4', '.pdf', '.txt', '.7z']

    for root, dirs, files in os.walk(root_dir):
        # Skip .git directory
        if '.git' in root: continue
        
        for filename in files:
            old_path = os.path.join(root, filename)
            new_filename = filename
            
            # 1. Fix double extensions
            for ext in EXTS:
                if filename.lower().endswith(ext + ext):
                    new_filename = filename[:-len(ext)]
                    break
            
            # 2. Fix mangled CUBE extensions
            if "Format_CUBE" in root and not new_filename.lower().endswith('.cube'):
                base, _ = os.path.splitext(new_filename)
                new_filename = base + ".cube"

            # 3. Artifact cleanup (.709, .2383 etc)
            if not any(new_filename.lower().endswith(e) for e in EXTS):
                if any(x in new_filename for x in [".709", ".2383", ".3513", ".5213"]):
                    base = new_filename.split('.')[0]
                    new_filename = base + ".cube"

            if new_filename != filename:
                new_path = os.path.join(root, new_filename)
                if os.path.exists(new_path):
                    base, ext = os.path.splitext(new_filename)
                    new_path = os.path.join(root, f"{base}_restored{ext}")
                
                try:
                    os.rename(old_path, new_path)
                    count += 1
                except: pass

    # Restore config to last known good state
    if os.path.exists('luts_config_pre_rename.json'):
        shutil.copy('luts_config_pre_rename.json', 'luts_config.json')
        print("--- DA KHOI PHUC FILE luts_config.json ---")

    print(f"\n--- HOAN TAT! DA SUA {count} FILE ---")

if __name__ == "__main__":
    fix_extensions()
