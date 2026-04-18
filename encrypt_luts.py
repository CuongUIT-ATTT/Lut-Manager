import os
import hashlib
import base64

def get_dynamic_key(secret, salt):
    """Tạo Dynamic XOR Key từ Secret và tên file."""
    combined = (secret + salt).encode()
    return hashlib.sha256(combined).digest()

def xor_crypt(data, key):
    """Thực hiện XOR dữ liệu với key."""
    key_len = len(key)
    # Dùng bytearray để tối ưu hiệu năng
    out = bytearray(len(data))
    for i in range(len(data)):
        out[i] = data[i] ^ key[i % key_len]
    return out

def encrypt_bulk(input_dir, output_dir, secret_key):
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    print(f"--- BẮT ĐẦU MÃ HÓA ATG (Secret: {'*' * len(secret_key)}) ---")
    
    count = 0
    for filename in os.listdir(input_dir):
        if filename.endswith(".cube"):
            input_path = os.path.join(input_dir, filename)
            output_filename = filename.replace(".cube", ".atg")
            output_path = os.path.join(output_dir, output_filename)

            # 1. Đọc file cube gốc
            with open(input_path, 'rb') as f:
                data = f.read()

            # 2. Tạo Dynamic Key (Dựa trên tên file làm Salt)
            # Quan trọng: Salt là path tương đối dùng trên Cloud
            # Ví dụ: "luts/xxx.atg" - Ở đây tạm dùng filename
            dynamic_key = get_dynamic_key(secret_key, output_filename)

            # 3. Mã hóa XOR
            encrypted_data = xor_crypt(data, dynamic_key)

            # 4. Lưu file .atg
            with open(output_path, 'wb') as f:
                f.write(encrypted_data)
            
            count += 1
            if count % 50 == 0:
                print(f"Đã xử lý {count} file...")

    print(f"--- HOÀN TẤT: {count} file đã được bảo mật ---")

if __name__ == "__main__":
    import sys
    print("PHẦN MỀM MÃ HÓA NỘI BỘ ANTIGRAVITY")
    print("----------------------------------")
    
    # Nhập Secret Key an toàn
    secret = input("Nhập Secret Key dự án (Giữ bí mật): ").strip()
    if not secret:
        print("Lỗi: Secret Key không được để trống.")
        sys.exit(1)

    in_dir = "LUT_ROOT" # Thư mục chứa file .cube
    out_dir = "LUT_ENCRYPTED" # Thư mục đầu ra
    
    # Cho phép người dùng chọn thư mục nếu muốn
    custom_in = input(f"Thư mục nguồn (Mặc định: {in_dir}): ").strip()
    if custom_in: in_dir = custom_in
    
    if not os.path.exists(in_dir):
        print(f"Lỗi: Thư mục '{in_dir}' không tồn tại.")
        sys.exit(1)

    encrypt_bulk(in_dir, out_dir, secret)
    print(f"\nThành công! Hãy upload các file trong '{out_dir}' lên Supabase Storage.")
