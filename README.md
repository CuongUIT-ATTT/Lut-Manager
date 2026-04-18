# Antigravity LUT Dashboard (SaaS Migration)

Premium WebGL-powered LUT management and preview system.

## 🚀 Deployment Instructions

### 1. GitHub to Vercel Connection
1. Push this repository to your GitHub account.
2. Go to [Vercel](https://vercel.com/) and click **"New Project"**.
3. Select your repository from the list.
4. **Configuration**:
   - Vercel will automatically detect the static file structure.
   - The `vercel.json` file we've provided will handle the routing (redirecting `/` to `Antigravity_SaaS.html`) and security headers.
5. Click **Deploy**. Your dashboard will be live on HTTPS.

### 2. Supabase Storage Setup (Asset Hosting)
1. Create a project at [Supabase](https://supabase.com/).
2. Go to **Storage** and create a **Public Bucket** named `luts`.
3. **CORS**: Supabase automatically allows all domains (`*`) for Public Buckets, so no manual configuration is needed in the Dashboard.
4. **Policies**: Add a policy to allow `SELECT` (Read) access to everyone.

### 3. Bulk LUT Encryption & Upload
1. Run the encryption script locally:
   ```bash
   python encrypt_luts.py
   ```
2. Enter your `ATG_SECRET` and source folder. It will generate `.atg` files.
3. Upload the generated `.atg` files to your Supabase `luts` bucket (maintaining folder structure).
4. Upload `luts_config.json` to the root of your Vercel deployment.

### 4. Security Configuration
Open `Antigravity_SaaS.html` and update the following placeholders:
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_KEY`: Your Supabase Anon Key.
- `OBFUSCATED_SECRET`: The obfuscated version of your `ATG_SECRET`.
  *(To generate: Reverse the key, shift each char code by +1, then Base64 encode it).*

## 🛠 Troubleshooting & Logs

### How to check Logs on Vercel:
1. Go to your Vercel Dashboard.
2. Select your project -> **Deployments**.
3. Click on the latest deployment.
4. Click the **"Logs"** tab.
5. Check for:
   - `404` errors (missing `.atg` or `luts_config.json`).
   - `CORS` errors (Supabase blocking Vercel).
   - `WebGL` warnings (Browser compatibility).

### Browser Console:
- Press `F12` -> `Console` to see real-time error messages from `AtgSecurity` or `AtgCache`.

## 🛡 Security Features
- **Dynamic XOR**: Every LUT has a unique encryption key based on its filename.
- **RAM Decryption**: Raw `.cube` data is never stored in variables or local storage.
- **IndexedDB**: Optimized caching to minimize Supabase egress costs.
"# Lut-Manager" 
