import json
import os
import re
import unicodedata
import sys

# Windows terminal fix
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass # Older python

# --- CONFIG ---
CONFIG_FILE = 'luts_config.json'
BACKUP_FILE = 'luts_config_pre_rename.json'

# --- TRANSLATION DICTIONARY ---
# Ordered by priority (longer phrases first)
MAP = {
    'teal_orange': 'Xanh và Cam',
    'teal and orange': 'Xanh và Cam',
    'cinematic': 'Điện ảnh',
    'cinematics': 'Điện ảnh',
    'cine-lite': 'Điện ảnh Bản nhẹ',
    'cine2': 'Điện ảnh V2',
    'portrait': 'Chân dung',
    'landscape': 'Phong cảnh',
    'ancient': 'Cổ trang',
    'street': 'Đường phố',
    'wedding': 'Đám cưới',
    'am_thuc': 'Ẩm thực',
    'food': 'Ẩm thực',
    'night': 'Cảnh đêm',
    'canh_dem': 'Cảnh đêm',
    'retro': 'Hoài cổ',
    'vintage': 'Hoài cổ',
    'classic': 'Cổ điển',
    'cold': 'Lạnh',
    'warm': 'Ấm',
    'nature': 'Tự nhiên',
    'standard': 'Chuẩn',
    'std': 'Chuẩn',
    'light': 'Sáng',
    'dark': 'Tối',
    'film': 'Phim',
    'soft': 'Mềm mại',
    'clean': 'Trong trẻo',
    'neon': 'Nê-ông',
    'white': 'Trắng',
    'black': 'Đen',
    'blue': 'Xanh dương',
    'green': 'Xanh lá',
    'yellow': 'Vàng',
    'red': 'Đỏ',
    'purple': 'Tím',
    'orange': 'Cam',
    'restore': 'Khôi phục',
    'original': 'Gốc',
    'neutral': 'Trung tính',
    'identity': 'Trung tính',
    'intensity': 'Cường độ',
    'corrected': 'Đã chỉnh',
    'correction': 'Chỉnh màu',
    'style': 'Phong cách',
    'collection': 'Bộ sưu tập',
    'package': 'Gói',
    'bundle': 'Combo',
    'preset': 'Tiền thiết lập',
}

# Brands to keep
BRANDS = ['Kodak', 'Sony', 'Canon', 'Fuji', 'Apple', 'Blackmagic', 'Rec709', 'BMD', 'Log', 'S-Log', 'V-Log', 'C-Log', 'D-Log']

def remove_accents(input_str):
    if not input_str: return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    return "".join([c for c in nfkd_form if not unicodedata.combining(c)]).replace('đ', 'd').replace('Đ', 'D')

def sanitize_filename(name):
    # Keep only alphanumeric, _, and .
    name = remove_accents(name)
    name = re.sub(r'[^a-zA-Z0-9._]', '_', name)
    name = re.sub(r'_+', '_', name)
    return name.strip('_')

def translate_phrase(text):
    original_text = text
    # 1. Handle brands (case insensitive search, but keep original case in output)
    # We'll temporarily shield brands
    placeholders = {}
    for i, brand in enumerate(BRANDS):
        pattern = re.compile(re.escape(brand), re.IGNORECASE)
        matches = pattern.findall(text)
        for match in matches:
            id = f"__BRAND_{i}__"
            placeholders[id] = match # Keep the actual brand casing found (e.g. SONY -> SONY)
            text = text.replace(match, id)

    # 2. Cleanup common junk
    text = text.replace('Format_CUBE', '').replace('.cube', '').replace('_', ' ').replace('-', ' ')
    
    # 3. Apply dictionary translation
    for eng, vie in sorted(MAP.items(), key=lambda x: len(x[0]), reverse=True):
        pattern = re.compile(r'\b' + re.escape(eng) + r'\b', re.IGNORECASE)
        text = pattern.sub(vie, text)

    # 4. Restore brands
    for id, val in placeholders.items():
        text = text.replace(id, val)
    
    # 5. Final cleanup
    text = re.sub(r'\s+', ' ', text).strip()
    return text.capitalize() if text else original_text

def process():
    if not os.path.exists(CONFIG_FILE):
        print("Error: luts_config.json not found.")
        return

    with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Backup
    with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    rename_log = []

    for cat in data:
        print(f"Processing Category: {cat['name']}")
        cat['name'] = translate_phrase(cat['name'])
        
        for fInfo in cat['files']:
            old_name = fInfo['name']
            old_rel = fInfo['rel']
            
            # New UI Name
            new_name_ui = translate_phrase(old_name)
            
            # New Filename (No Accents)
            ext = old_name.split('.')[-1]
            base_translated = remove_accents(new_name_ui)
            new_filename = sanitize_filename(base_translated) + "." + ext
            
            # New Path
            dir_path = os.path.dirname(old_rel)
            # Translate directory parts too? Let's just keep structure for now but rename the leaf
            new_rel = os.path.join(dir_path, new_filename).replace('\\', '/')
            
            # Rename physical file if exists
            if os.path.exists(old_rel):
                try:
                    os.rename(old_rel, new_rel)
                    rename_log.append(f"RENAME: {old_rel} -> {new_rel}")
                except Exception as e:
                    print(f"Error renaming {old_rel}: {e}")
            
            # Update object
            fInfo['name'] = new_name_ui
            fInfo['rel'] = new_rel

    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Success! Processed {len(rename_log)} files.")
    with open('rename_history.log', 'w', encoding='utf-8') as f:
        f.write("\n".join(rename_log))

if __name__ == "__main__":
    process()
