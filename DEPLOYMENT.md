# Bloom & Carry POS — Local Setup & Deployment Guide

This enterprise Point of Sale system is built with an offline-first architecture, local IndexedDB persistence, synchronous in-memory state, and real-time MongoDB Atlas cloud synchronization.

---

## 1. Running Locally on Your Computer in VS Code

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or higher
- [VS Code](https://code.visualstudio.com/)

### Steps:
1. **Open in VS Code**:
   Clone or download the project folder, open VS Code, and select **File > Open Folder**.
2. **Install Dependencies**:
   Open the built-in terminal (`Ctrl + ~` or `Cmd + ~`) and run:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Ensure `MONGODB_URI` and `MONGODB_DATABASE=bloomandcarry_pos_real` are present.
4. **Start Development Server**:
   ```bash
   npm run dev
   ```
5. **Open the Application**:
   Visit [http://localhost:3000](http://localhost:3000) in your web browser. Both the backend API and frontend Vite dev server run together on port 3000.

---

## 2. Deploying Backend to Render

Render hosts the Node.js Express server which interfaces with MongoDB Atlas.

1. **Push your code to GitHub / GitLab**.
2. In [Render Dashboard](https://dashboard.render.com/):
   - Click **New +** > **Web Service**.
   - Connect your repository.
   - **Name**: `bloom-and-carry-pos-api` (or your choice).
   - **Environment**: `Node`.
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. **Set Environment Variables in Render**:
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://bloomandcarrypk_db_user:ZihlEXQqFfMOXU2q@cluster0.p35gouf.mongodb.net/bloomandcarry_pos_real?appName=Cluster0&retryWrites=true&w=majority`
   - `MONGODB_DATABASE`: `bloomandcarry_pos_real`
4. Click **Create Web Service**.
5. Once deployed, Render will provide a public URL, for example:
   `https://bloom-and-carry-pos-api.onrender.com`

---

## 3. Deploying Frontend to Netlify

Netlify hosts the high-performance static React Single Page Application (SPA).

1. In [Netlify Dashboard](https://app.netlify.com/):
   - Click **Add new site** > **Import an existing project**.
   - Select your GitHub repository.
2. **Build Settings**:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. **Set Environment Variables in Netlify**:
   - `VITE_API_URL`: `https://bloom-and-carry-pos-api.onrender.com` *(Replace with your actual Render URL from Step 2)*
4. Click **Deploy Site**.
5. Netlify will build the frontend and serve it globally with automatic SSL and CDN caching. All SPA routes are routed through `public/_redirects`.

---

## 4. How Barcode-Unique Import & Offline Auto-Saving Work

- **Barcode as Unique Identifier**:
  - When re-uploading an inventory file (Excel `.xlsx`, CSV, or JSON), the system matches existing rows by **Barcode**.
  - If a barcode already exists, only changed cells/fields (such as price, stock quantity, shade, shelf location) are overwritten and updated, preserving existing product data.
  - If a barcode is new, a new row is appended to your catalog without altering any existing products.
  - If all rows in the file are new, all rows are added safely.
- **Offline-First Multi-Tier Architecture**:
  - **Instant Tier (0ms)**: Saved to browser LocalStorage & React state.
  - **Durable Vault Tier**: Persisted to browser **IndexedDB**, guaranteeing zero data loss even if browser cache is cleared or network drops.
  - **Cloud Tier**: Auto-synchronized in the background to **MongoDB Atlas (`bloomandcarry_pos_real`)**.
