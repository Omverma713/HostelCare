# HostelCare Full-Stack Deployment & CORS Resolution Report

**Project**: HostelCare  
**Frontend**: React + Vite (Cloudflare Workers/Pages)  
**Backend**: Express + Node.js (Render - Dockerized)  
**Database**: MongoDB Atlas  
**Production Frontend URL**: https://hostelcare.omverma-dev.workers.dev  
**Production Backend URL**: https://hostelcare-9od3.onrender.com/api/v1  

---

## 1. Problem Statement

During production deployment, attempting to log in from the Cloudflare frontend failed with two sequential issues:

1. **405 Method Not Allowed (Cloudflare)**:
   Initially, the frontend made API requests to relative paths (`/api/v1/users/login`). This hit the Cloudflare static hosting layer (`https://hostelcare.omverma-dev.workers.dev/api/v1/users/login`), which does not handle `POST` requests and returned `405 Method Not Allowed`.

2. **CORS Preflight Failure (Render)**:
   When configured to target Render (`https://hostelcare-9od3.onrender.com/api/v1`), the browser initiated an automatic cross-origin `OPTIONS` preflight request. The backend returned `200 OK` but omitted essential CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`). As a result, the browser aborted the `POST` request with `"Failed to fetch"`.

---

## 2. Root Cause Analysis

### Backend Root Cause
- The `cors` package was not installed in `package.json`.
- `app.js` lacked CORS middleware, leaving cross-origin preflight requests unhandled.

### Frontend & Git Root Cause
- The root `.gitignore` contained `.env.*`, which prevented `frontend/.env.production` from being tracked in Git.
- During Cloudflare's build, `import.meta.env.VITE_API_BASE_URL` was `undefined`, causing the frontend to default to `'/api/v1'` (the Cloudflare origin).

---

## 3. Solutions Implemented

### Backend (`hostelcare`)

1. **Installed `cors@2.8.6`**:
   Added to `package.json` dependencies.

2. **Configured CORS Middleware in `app.js`**:
   Positioned as the first middleware in the stack (before compression, body parser, rate limiters, and routes):
   ```javascript
   const corsOptions = {
       origin: [
           "https://hostelcare.omverma-dev.workers.dev",
           "http://localhost:5173",
       ],
       methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
       allowedHeaders: ["Content-Type", "Authorization"],
       credentials: false,
       optionsSuccessStatus: 200,
   };
   app.use(cors(corsOptions));
   ```
   *Express 5 automatically handles `OPTIONS` preflights through `app.use(cors())`.*

---

### Frontend (`frontend/`)

1. **Bulletproof `API_BASE` Resolution (`frontend/src/services/api.js`)**:
   ```javascript
   const API_BASE = 
     import.meta.env.VITE_API_BASE_URL || 
     (import.meta.env.PROD 
       ? 'https://hostelcare-9od3.onrender.com/api/v1' 
       : '/api/v1');
   ```
   - **Production (`PROD === true`)**: Defaults to Render URL even if environment variables are absent at build time.
   - **Development (`npm run dev`)**: Falls back to `'/api/v1'` to leverage Vite dev proxy (`http://localhost:3000`).

2. **Updated `.gitignore`**:
   Allowed tracking of `.env.production`:
   ```gitignore
   .env
   .env.*
   !.env.production
   !frontend/.env.production
   ```

3. **Created `frontend/.env.production`**:
   ```env
   VITE_API_BASE_URL=https://hostelcare-9od3.onrender.com/api/v1
   ```

---

## 4. Verification Results

| Test Scenario | Method / Tool | Expected Result | Actual Result | Status |
|---|---|---|---|---|
| Admin Login (`SUP001`) | Direct HTTP POST | 200 + JWT (`role: superintendent`) | 200 + JWT | PASS |
| Student Login (`STU011`) | Direct HTTP POST | 200 + JWT (`role: student`) | 200 + JWT | PASS |
| Browser Preflight | Browser Fetch | 200 + `Access-Control-Allow-Origin` | 200 + CORS Headers | PASS |
| Frontend Production Build | `npm run build` | Zero syntax/bundler errors | Bundled cleanly | PASS |
| Live Cloudflare Auth | End-to-End Browser | Successful login & dashboard redirect | Authenticated to `/student` | PASS |

---

## 5. Summary of Modified Files

1. `app.js` - Added CORS middleware configuration.
2. `package.json` & `package-lock.json` - Added `cors` dependency.
3. `frontend/src/services/api.js` - Hardened production API base URL resolution.
4. `frontend/.env.production` - Added Vite production environment file.
5. `.gitignore` - Permitted tracking of `.env.production`.
