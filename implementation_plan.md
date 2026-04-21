# Architecture & Security Upgrade Plan

We need to resolve fundamental architectural flaws—specifically client-exposed API keys, unpaginated Firestore queries, and a tightly-coupled matching engine block. This plan provides the exact roadmap and code to surgically elevate the system's evaluation score to 95+ without a full rewrite.

## User Review Required
> [!IMPORTANT]
> The current system allows any client to see the `VITE_GEMINI_API_KEY`, posing a high security risk. We will shift this entirely to the backend. We will also refactor `getVolunteers` to enable scalable pagination. 
> 
> Please review this plan. Upon approval, I can execute these surgical changes.

---

## Refactored Architecture Diagram

```mermaid
flowchart TD
    subgraph Client [Frontend UI (React/Vite)]
        UI[Pages & Components]
        API[API Service wrapper]
        UI --> API
    end

    subgraph API_Layer [Backend API (Node/Express)]
        Route1[/api/match]
        Route2[/api/ai/incident-analyze]
        Auth[Auth & Rate Limiting Middleware]
        Route1 --> Auth
        Route2 --> Auth
    end

    subgraph Data_Layer [Data & External Services]
        Firebase[(Firestore)]
        Gemini[Gemini AI]
    end

    API -- JWT Token --> API_Layer
    Auth --> Firebase : "Paginated Queries & Writes"
    Auth --> Gemini : "Secure API Key Server-to-Server"
```

---

## Proposed Changes

### 1. SECURITY: Protect Secrets & Move AI to Backend

#### [DELETE] `src/services/gemini.js`
- Removing client-side Gemini logic entirely.

#### [MODIFY] `server/index.js`
- Expose a new `/api/ai/parse` endpoint.
- Add `express-rate-limit` for basic rate limiting.
- Validate incoming Authentication headers.

#### [MODIFY] `.env` & Configuration
- Remove `VITE_GEMINI_API_KEY` and `VITE_FIREBASE_API_KEY`.
- Backend utilizes `process.env.GEMINI_API_KEY`. (If Firebase client is strictly needed, use locked-down domain-restricted API keys).

### 2. SCALABILITY: Firestore Pagination & Indexing

#### [MODIFY] `src/services/api.js`
- Update `getVolunteers` to support cursor-based pagination using Firestore `startAfter` and `limit`.
- Update frontend calls (e.g., `Volunteers.jsx`) to fetch batches rather than dumping the entire collection into memory.

### 3. ARCHITECTURE: Matching Engine Offloading

#### [MODIFY] `src/engine/matchingEngine.js`
- Currently synchronous on the UI thread (`rankVolunteersForTask`).
- We will limit the ranking dataset using the new paginated pulls, sorting initially via a query (e.g., matching the required region or skills first) to reduce memory overhead.

---

## Code Snippets for Key Fixes

### Fix 1: API Key Protection & Backend Offload

**Backend `server/index.js` addition:**
```javascript
import rateLimit from 'express-rate-limit';

// 1. Rate Limiter Strategy
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// 2. Token Validation Middleware (Pseudo-code for Firebase Auth)
const requireAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  // In production, verify with firebase-admin
  // const decoded = await admin.auth().verifyIdToken(token);
  // req.user = decoded;
  next();
};

// 3. New Secure AI Endpoint
app.post("/api/ai/parse-document", requireAuth, async (req, res) => {
    // Only the backend has access to GEMINI_API_KEY
    const { fileContent, fileType } = req.body;
    // ... logic ported from src/services/gemini.js
    // fetch to `https://generativelanguage.googleapis.com/v1beta/models/...`
    res.json({ result: parsedData });
});
```

### Fix 2: Paginated Firestore Queries

**Frontend `src/services/api.js` fix:**
```javascript
import { collection, query, limit, startAfter, getDocs, orderBy, where } from 'firebase/firestore';

// Store the last document cursor for the next page
let lastNavigatedVolunteer = null;

export const api = {
  // ...
  getVolunteersPaginated: async (filters = {}, pageSize = 20) => {
    const volsRef = collection(db, "volunteers");
    
    // Construct indexing strategy
    let qArgs = [volsRef, orderBy("rating", "desc")];
    
    if (filters.region) qArgs.push(where("region", "==", filters.region));
    if (filters.available) qArgs.push(where("available", "==", true));
    
    qArgs.push(limit(pageSize));
    if (lastNavigatedVolunteer) {
      qArgs.push(startAfter(lastNavigatedVolunteer));
    }

    const q = query(...qArgs);
    const snap = await getDocs(q);
    
    lastNavigatedVolunteer = snap.docs[snap.docs.length - 1];
    
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
};
```

---

## Open Questions
1. Should we enforce Firebase Authentication (JWT validation) for the backend API right now, or simply rely on CORS/Origin restrictions for the current release?
2. Are you ready for me to apply these specific code changes to the backend and API layer?

## Verification Plan
1. Delete client-exposed Gemini logic and verify the app compiles and Vite env no longer bundles the keys.
2. Hit the new `/api/ai/parse-document` securely via Node server.
3. Test loading the `/volunteers` route and verify only `pageSize = 20` volunteers are pulled instead of a massive payload.
