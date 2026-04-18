// --- ANTIGRAVITY LUT DASHBOARD - PROXY VERSION ---

const AtgCache = {
    dbName: 'AtgLutCacheProxy_V2', store: 'luts',
    async init() {
        return new Promise((res, rej) => {
            const req = indexedDB.open(this.dbName, 1);
            req.onupgradeneeded = (e) => e.target.result.createObjectStore(this.store);
            req.onsuccess = (e) => res(e.target.result);
            req.onerror = rej;
        });
    },
    async get(id) {
        try {
            const db = await this.init();
            return new Promise(res => {
                const req = db.transaction(this.store).objectStore(this.store).get(id);
                req.onsuccess = () => res(req.result);
                req.onerror = () => res(null);
            });
        } catch(e) { return null; }
    },
    async set(id, data) {
        try {
            const db = await this.init();
            const tx = db.transaction(this.store, 'readwrite');
            tx.objectStore(this.store).put(data, id);
        } catch(e) {}
    }
};

let appData = [];
let gl, prog, imgTex, lutTex, activeImg = null;
let vao = null, isOriginal = false, currentLut = null;
let refIndex = 0;
let uniLocs = {};

function log(msg, isErr=false) { const st = document.getElementById('status'); st.innerText = msg; st.style.color = isErr ? '#f43f5e' : '#10b981'; }

function showCat(id, el) {
    if(el) { document.querySelectorAll('.category-link').forEach(l => l.classList.remove('active')); el.classList.add('active'); }
    const cat = appData[id]; document.getElementById('catTitle').innerText = cat.name;
    const grid = document.getElementById('grid'); grid.innerHTML = "";
    cat.files.forEach(f => {
        const card = document.createElement('div'); card.className = 'file-card';
        card.innerHTML = `<span>${f.name}</span> ${f.refs && f.refs.length ? '<div class="has-ref-badge">Có mẫu</div>' : ''} ${f.isLut ? '<div class="is-lut-icon"></div>' : ''}`;
        card.onclick = () => { document.querySelectorAll('.file-card').forEach(c => c.classList.remove('active')); card.classList.add('active'); selectLut(f); };
        grid.appendChild(card);
    });
}

async function selectLut(fInfo) {
    currentLut = fInfo;
    document.getElementById('activeLut').innerText = fInfo.name;
    const btn = document.getElementById('btnRef');
    
    if(fInfo.refs && fInfo.refs.length) { 
        btn.disabled = false; btn.style.opacity = "1";
    } else { 
        btn.disabled = true; btn.style.opacity = "0.3"; toggleMode(false); 
    }
    
    if(!fInfo.isLut) return;
    
    // --- CHẾ ĐỘ ƯU TIÊN CLOUD PROXY (SaaS Mode) ---
    try {
        log(`● Proxy Mode: Đang tải ${fInfo.name}...`);
        const cacheId = fInfo.rel;
        
        // Kiểm tra Cache nội bộ (đã giải mã) để tăng tốc
        let decryptedText = await AtgCache.get(cacheId);
        
        if (!decryptedText) {
            // Gọi Vercel Serverless Function (Proxy có check Referer)
            const url = `/api/get-lut?file=${encodeURIComponent(fInfo.rel)}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Lỗi Proxy (${res.status})`);
            
            // Xử lý ArrayBuffer thay vì text vì API trả về application/octet-stream
            const buffer = await res.arrayBuffer();
            const decoder = new TextDecoder('utf-8');
            decryptedText = decoder.decode(buffer);
            
            // Xóa rủi ro Vite trả về index.html (200 OK) thay vì proxy thực sự ở môi trường local
            if (!decryptedText.includes('LUT_3D_SIZE')) throw new Error('Dữ liệu Proxy không hợp lệ (Không phải file LUT)');
            
            await AtgCache.set(cacheId, decryptedText);
        }
        
        loadLut(decryptedText);
        log(`● Proxy OK (Cloud Decoding): ${fInfo.name}`);
        if(!isVideoPlaying && activeImg) render();
        return;
    } catch(e) { 
        log(`● Cloud thất bại: ${e.message}. Đang thử Local Fallback...`);
    }

    // --- CHẾ ĐỘ LOCAL FALLBACK ---
    try {
        const res = await fetch(`/${fInfo.rel}`);
        if (res.ok) {
            const t = await res.text();
            if (t.includes('LUT_3D_SIZE')) {
                loadLut(t);
                if(!isVideoPlaying && activeImg) render();
                log(`● Local Fallback OK: ${fInfo.name}`);
            }
        }
    } catch(e) { 
        log('Lỗi: Không thể nạp LUT từ bất kỳ nguồn nào.', true); 
    }
}

function toggleMode(showGallery) {
    const overlay = document.getElementById('galleryOverlay');
    if(showGallery) {
        if(!currentLut || !currentLut.refs || !currentLut.refs.length) return;
        refIndex = 0;
        overlay.style.display = 'flex';
        updateRefImage();
    } else {
        overlay.style.display = 'none';
    }
}

function updateRefImage() {
    const img = document.getElementById('galleryImg');
    const rel = currentLut.refs[refIndex];
    img.src = `/${rel}`; // Tự động load ảnh mẫu từ public/
    document.getElementById('refCounter').innerText = `Ảnh ${refIndex+1} / ${currentLut.refs.length} (${currentLut.name})`;
}

window.changeRef = (dir) => {
    refIndex = (refIndex + dir + currentLut.refs.length) % currentLut.refs.length;
    updateRefImage();
}

window.toggleMode = (showGallery) => toggleMode(showGallery);

let isVideoPlaying = false;
window.togglePlay = () => {
    const v = document.getElementById('vSource');
    if(v.paused) v.play(); else v.pause();
    document.getElementById('playIcon').innerText = v.paused ? '▶ Phát' : '⏸ Dừng';
}

const VS_SRC = `#version 300 es
in vec2 a_p; in vec2 a_t; out vec2 v_t;
void main() { gl_Position = vec4(a_p, 0, 1); v_t = a_t; }`;

const FS_SRC = `#version 300 es
precision highp float; precision highp sampler3D;
uniform sampler2D u_i; uniform sampler3D u_l; uniform float u_m;
in vec2 v_t; out vec4 o_c;
void main() {
    vec4 c = texture(u_i, v_t);
    vec4 p = texture(u_l, c.rgb);
    o_c = mix(c, vec4(p.rgb, c.a), u_m);
}`;

function initGL() {
    const c = document.getElementById('cvs'); gl = c.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });
    if(!gl) { log('WebGL 2 Not Supported', true); return; }
    const compile = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); return sh; };
    const vs = compile(gl.VERTEX_SHADER, VS_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FS_SRC);
    prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    gl.useProgram(prog); gl.uniform1i(gl.getUniformLocation(prog, 'u_i'), 0); gl.uniform1i(gl.getUniformLocation(prog, 'u_l'), 1);
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,0,1, 1,-1,1,1, -1,1,0,0, -1,1,0,0, 1,-1,1,1, 1,1,1,0]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, 'a_p')); gl.vertexAttribPointer(gl.getAttribLocation(prog, 'a_p'), 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(gl.getAttribLocation(prog, 'a_t')); gl.vertexAttribPointer(gl.getAttribLocation(prog, 'a_t'), 2, gl.FLOAT, false, 16, 8);
    
    lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, lutTex);
    const identityLut = new Uint8Array([0,0,0,255, 255,0,0,255, 0,255,0,255, 255,255,0,255, 0,0,255,255, 255,0,255,255, 0,255,255,255, 255,255,255,255]);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 2, 2, 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, identityLut);
    [10240, 10241].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 9729));
    [10242, 10243, 32882].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 33071));
    
    uniLocs = { m: gl.getUniformLocation(prog, 'u_m'), i: gl.getUniformLocation(prog, 'u_i'), l: gl.getUniformLocation(prog, 'u_l') };
    requestAnimationFrame(animLoop);
}

let lastFrameTime = -1;
function animLoop() {
    if(isVideoPlaying) {
        const v = document.getElementById('vSource');
        if(v.readyState >= 2 && v.currentTime !== lastFrameTime) { 
            lastFrameTime = v.currentTime;
            gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
            render();
        }
    }
    requestAnimationFrame(animLoop);
}

function render() {
    if(!gl || (!activeImg && !isVideoPlaying)) return;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(prog);
    gl.uniform1f(uniLocs.m, isOriginal ? 0 : (document.getElementById('intensity').value/100));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, imgTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_3D, lutTex);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
}

document.getElementById('photoInput').onchange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    document.getElementById('hint').style.display = 'none';
    const v = document.getElementById('vSource');
    const isVid = file.type.startsWith('video/');
    isVideoPlaying = false; 
    if(v.src) { URL.revokeObjectURL(v.src); v.src = ""; }
    if(isVid) {
        activeImg = null; document.getElementById('btnPlay').classList.remove('hidden');
        v.src = URL.createObjectURL(file);
        v.onloadedmetadata = () => {
            const maxDim = 850; let w = v.videoWidth, h = v.videoHeight; const scale = Math.min(1, maxDim / Math.max(w, h));
            document.getElementById('cvs').width = w * scale; document.getElementById('cvs').height = h * scale;
            if(imgTex) gl.deleteTexture(imgTex); imgTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, imgTex);
            [10240, 10241, 10242, 10243].forEach((p, idx) => gl.texParameteri(gl.TEXTURE_2D, p, idx < 2 ? 9729 : 33071));
            isVideoPlaying = true; v.play().catch(() => { document.getElementById('playIcon').innerText = '▶ Phát'; });
        };
    } else {
        document.getElementById('btnPlay').classList.add('hidden');
        const r = new FileReader(); r.onload = (ev) => {
            const i = new Image(); i.onload = () => {
                activeImg = i; const maxDim = 1600; let w = i.width, h = i.height; const scale = Math.min(1, maxDim / Math.max(w, h));
                document.getElementById('cvs').width = w * scale; document.getElementById('cvs').height = h * scale;
                if(imgTex) gl.deleteTexture(imgTex); imgTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, imgTex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, i);
                [10240, 10241, 10242, 10243].forEach((p, idx) => gl.texParameteri(gl.TEXTURE_2D, p, idx < 2 ? 9729 : 33071));
                render();
            };
            i.src = ev.target.result;
        };
        r.readAsDataURL(file);
    }
};

function loadLut(t) {
    if(!t) {
        const s = 2; const d = new Uint8Array([0,0,0,255, 255,0,0,255, 0,255,0,255, 255,255,0,255, 0,0,255,255, 255,0,255,255, 0,255,255,255, 255,255,255,255]);
        if(lutTex) gl.deleteTexture(lutTex); lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, lutTex);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, s, s, s, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
        [10240, 10241].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 9729));
        [10242, 10243, 32882].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 33071));
        render(); return;
    }
    const lines = t.split('\n'); let s=0; const d=[];
    const name = currentLut ? currentLut.name.toLowerCase() : "";
    document.getElementById('logWarning').style.display = (name.includes('log') || name.includes('slog') || name.includes('vlog')) ? 'inline' : 'none';
    for(let l of lines) { 
        l = l.trim(); if(l.startsWith('LUT_3D_SIZE')) s=parseInt(l.split(/\s+/)[1]); 
        else if(l && (l[0]==='-' || (l[0]>='0' && l[0]<='9'))) { 
            const p = l.split(/\s+/).map(x => parseFloat(x)); if(p.length >= 3) d.push(Math.max(0, Math.min(255, p[0]*255)), Math.max(0, Math.min(255, p[1]*255)), Math.max(0, Math.min(255, p[2]*255)), 255); 
        } 
    }
    if(s === 0 || d.length < s*s*s*4) { 
        if(s > 0) log(`Lỗi: LUT ${s}x${s}x${s} bị thiếu dữ liệu (Chỉ có ${d.length/4} điểm)`, true); 
        return; 
    }
    if(lutTex) gl.deleteTexture(lutTex); lutTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_3D, lutTex);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, s, s, s, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(d)); 
    [10240, 10241].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 9729));
    [10242, 10243, 32882].forEach(p => gl.texParameteri(gl.TEXTURE_3D, p, 33071));
    render();
    log(`● Đã nạp LUT ${s}x${s}x${s} (${d.length/4} points)`);
}

document.getElementById('intensity').oninput = () => { document.getElementById('intVal').innerText = document.getElementById('intensity').value + '%'; render(); };
const cvs = document.getElementById('cvs'); cvs.onmousedown = () => { isOriginal = true; render(); }; cvs.onmouseup = () => { isOriginal = false; render(); };

window.onload = async () => {
    initGL();
    try {
        const res = await fetch('/luts_config.json');
        if(res.ok) {
            appData = await res.json();
            if(appData.length) {
                const nav = document.getElementById('nav'); nav.innerHTML = "";
                appData.forEach((c, i) => { const d = document.createElement('div'); d.className = 'category-link'; d.innerText = c.name; d.onclick = () => showCat(i, d); nav.appendChild(d); });
                showCat(0, nav.firstChild);
            }
        }
    } catch(e) { log('Lỗi nạp luts_config.json', true); }
};
