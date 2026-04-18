import crypto from 'crypto';

export default async function handler(req, res) {
    const fileName = req.query.file;

    // 1. Bảo mật: Chỉ cho phép gọi từ chính domain của mình
    const referer = req.headers.referer;
    // Bỏ qua check Referer khi ở môi trường test Local ('localhost')
    if (process.env.NODE_ENV === 'production' && referer && !referer.includes(req.headers.host)) {
        return res.status(403).json({ error: 'Access Denied: Invalid Referer' });
    }

    if (!fileName) {
        return res.status(400).json({ error: 'Missing file path' });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const SECRET_KEY = process.env.LUT_SECRET_KEY; // Lấy Secret Key giải mã từ biến môi trường Vercel

    if (!SUPABASE_URL) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing Supabase URL in Environment Variables.' });
    }

    if (!SECRET_KEY) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing LUT_SECRET_KEY in Environment Variables.' });
    }

    try {
        // Trích xuất file name gốc (bỏ qua mọi thư mục loằng ngoằng) vì encrypt_luts.py sinh ra file phẳng
        const baseName = fileName.split('/').pop().replace('.cube', '.atg');

        // Lấy file mã hóa (.atg) từ Supabase Storage (bên trong thư mục con LUT đã tạo trên Cloud)
        const url = `${SUPABASE_URL}/storage/v1/object/public/luts/LUT/${encodeURIComponent(baseName)}`;
        
        const response = await fetch(url, {
            headers: SUPABASE_KEY ? {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            } : {}
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: `File not found on Supabase: ${response.status} (${baseName})` });
        }

        const encryptedBuffer = Buffer.from(await response.arrayBuffer());

        // 2. XOR Decryption ngay tại Server
        // SALT được dùng lúc bạn chạy mã hóa python chính là tên file .atg
        const salt = baseName;
        const key = crypto.createHash('sha256').update(SECRET_KEY + salt).digest();

        const decryptedBuffer = Buffer.alloc(encryptedBuffer.length);
        for (let i = 0; i < encryptedBuffer.length; i++) {
            decryptedBuffer[i] = encryptedBuffer[i] ^ key[i % key.length];
        }

        // 3. Trả về Frontend dưới dạng application/octet-stream như yêu cầu
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

        return res.send(decryptedBuffer);

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
