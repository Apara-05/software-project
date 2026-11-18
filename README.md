# Smart Attendance Management System Using Face Recognition

A full-stack college project built with **React**, **Tailwind CSS**, **face-api.js**, **Recharts**, **Express**, **Firebase Authentication**, and **Cloud Firestore**.

## Project Architecture

- **Frontend (`src/`, `index.html`, `vite.config.ts`)**: React 19 + Vite + Tailwind CSS v4 SPA featuring Admin, Faculty, and Student portals, Recharts analytics, CSV export, and real-time browser-based facial recognition via `face-api.js`.
- **Face Recognition Models (`public/models/`)**: Local `tiny_face_detector`, `face_landmark_68`, and `face_recognition` weight manifests and shards served at `/models/*` (copied into `dist/models/` during build).
- **Backend (`server.ts`)**: Express server binding to `0.0.0.0` and `process.env.PORT` (default `3000`), serving the built frontend (`dist/`), model weights (`/models/*`), and `/api/health`.
- **Database & Auth (`firebase-applet-config.json`, `firestore.rules`)**: Firebase Authentication (Google Sign-In) and Cloud Firestore with schema-enforced security rules. No SQLite or local ephemeral file storage is used for attendance records.

---

## Deploying to Render (Free Web Service)

This repository is configured to deploy as **one Render Web Service** using either the Render Dashboard or `render.yaml`.

### 1. Push Code to GitHub
Ensure all files—including `public/models/`, `firebase-applet-config.json`, `server.ts`, and `package.json`—are committed and pushed to your GitHub repository (`.env*` secrets remain excluded by `.gitignore`).

### 2. Create a Web Service on Render
1. Log in to [Render](https://render.com) and click **New + → Web Service**.
2. Connect your GitHub repository.
3. Select the **Free** instance type and configure:
   - **Runtime / Environment**: `Node` (automatically uses Node `22.23.2` via `.node-version`)
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
   - **Health Check Path**: `/api/health`
4. Optional Environment Variables (Render sets `PORT` automatically):
   - `NODE_ENV=production`
   - `NODE_VERSION=22.23.2`
5. Click **Create Web Service**.

*(Alternatively, use **New + → Blueprint** on Render to import `render.yaml` automatically.)*

### 3. Authorize Your Render Domain in Firebase Authentication
Because Firebase Authentication uses `signInWithPopup` for Google Sign-In:
1. Open the [Firebase Console](https://console.firebase.google.com/) for your project (`gen-lang-client-0483931505`).
2. Go to **Authentication → Settings → Authorized domains**.
3. Click **Add domain** and add your deployed Render hostname (e.g., `smart-attendance-system.onrender.com`).

> Without adding your `.onrender.com` domain to Firebase Authorized Domains, Google Sign-In popups will be rejected by Firebase Auth.

---

## Local Development & Production Verification

```bash
# Install dependencies
npm install

# Run Vite development server on port 3000
npm run dev

# Type-check and build production bundle (dist/ + dist/models/)
npm run lint
npm run build

# Start production Express server on 0.0.0.0:$PORT
npm start
```

## Academic Demonstration Notice
Facial recognition runs locally in the browser using `face-api.js` 128-dimensional Euclidean descriptor matching for B.Tech project demonstration and does not include hardware liveness or anti-spoofing protection.
