# DeepScan UI

AI-powered deepfake detection platform with a modern React SPA, Flask/TensorFlow backend, and a rich ecosystem of admin + community workflows. This README serves as the architectural deep dive for contributors and auditors.

---

## Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend Stack](#backend-stack)
4. [Frontend Stack](#frontend-stack)
5. [Database Schema](#database-schema)
6. [API Surface](#api-surface)
7. [Setup & Local Development](#setup--local-development)
8. [Model Training Pipeline](#model-training-pipeline)
9. [Testing & Tooling](#testing--tooling)
10. [Troubleshooting](#troubleshooting)

---

## System Overview

| Layer        | Stack / Services                                                                                                   |
|--------------|---------------------------------------------------------------------------------------------------------------------|
| Frontend     | Vite · React 18 · TypeScript · shadcn/ui · TailwindCSS · Radix UI · React Router · React Query · Lucide Icons      |
| Backend      | Flask · TensorFlow/Keras (Xception) · OpenCV · SQLite · ReportLab · Requests · Secrets                              |
| ML Assets    | XceptionNet fine-tuned on UADFV, stored under `backend/models/`                                                     |
| Auth         | Token based (random hex tokens) persisted in `localStorage`, server validation via `/api/auth/verify`              |
| Data Layer   | SQLite (`users.db`) with >15 tables (users, analyses, reports, forum, support center, blogs, notifications, etc.)  |
| Ops / UX     | Admin dashboards, PDF reporting, support center, awareness blogs, news proxy, community forum                      |
| Testing      | Selenium (Python) end-to-end suite                                                                                  |

---

## Architecture

```
Frontend (Vite React)                         Backend (Flask)
│                                              │
│  Routes (Protected/Admin) ───────────────▶   │  Auth endpoints (login/verify)
│  AuthContext (localStorage tokens)           │  Token verification hooks
│  React Query service hooks                   │  REST JSON APIs (history, reports, uploads, forum, etc.)
│  shadcn/ui components                        │  SQLite models & indexes
│                                              │
│  Upload / Dashboard / Reports UI             │  DeepfakeDetector (TensorFlow)
│        │                                     │        │
│        └─────────────── /api/predict ───────▶│  Frame extraction + model inference
│                                              │
│  Forum UI w/ search/filter/likes/inline      │  `forum_posts`, `forum_comments` + default seeding
│  Dashboard analytics                         │  Aggregated stats queries (analyses, notifications)
│  Report downloads (PDF) ────────────────▶    │  `/api/generate-report` (ReportLab streaming)
```

---

## Backend Stack

### Key Files

| Path                       | Description                                                                                          |
|----------------------------|------------------------------------------------------------------------------------------------------|
| `backend/app.py`           | Flask application, DB initialization, REST endpoints, admin utilities, report generation             |
| `backend/deepfake_detector.py` | TensorFlow Xception model builder, dataset loader, training/eval utilities                      |
| `backend/train_model.py`   | CLI for training with configurable dataset path, epochs, batch size                                  |
| `backend/models/*.h5`      | Saved weights (multiple checkpoints)                                                                 |
| `backend/requirements.txt` | Python dependencies (TensorFlow, OpenCV, ReportLab, etc.)                                            |

### Responsibilities

- **DB Initialization**: creates tables for users, history, reports, analyses, forum, support center entities, logs, tips, blogs, etc. Seeds demo data (admin/user accounts, blogs, tips, forum posts & comments).
- **Deepfake Inference**:
  - Upload video saved to `/uploads`.
  - Frames extracted (OpenCV), normalized, batched through Xception model.
  - Aggregates probabilities, real/fake confidences, frame counts.
  - Persists analyses/history/reports + PDF generation hook.
- **Support Center**: complaint tracking, expert verification requests, subscriptions, daily tips, notifications.
- **Admin Console**: endpoints for dashboards, user listing, resets, moderation (reports/analyses/forum).
- **News Proxy**: Wraps NewsAPI to bypass browser CORS.
- **Forum**: CRUD for posts/comments, likes, moderation, default content seeding.

---

## Frontend Stack

### Directory Layout

```
src/
├── main.tsx / App.tsx          # React entrypoint + router
├── contexts/AuthContext.tsx    # Session state (localStorage-backed)
├── components/                 # Layout (AppLayout/Header/Sidebar), theme provider, protected routes, UI primitives
├── pages/                      # Route views (Dashboard, Upload, Reports, History, Profile, Support, Forum, Admin modules, etc.)
├── services/                   # Fetch wrappers w/ typed responses (deepfakeApi, reportsApi, forumApi, etc.)
├── hooks/                      # Custom hooks (toast, media queries)
├── lib/utils.ts                # Helper utilities (class merging, formatting)
└── styles (App.css, index.css)
```

### UI Capabilities

- **Auth Flow**: `/login` issues tokens → stored in localStorage → verified on mount.
- **ProtectedRoute/AdminRoute** wrappers ensure user role enforcement.
- **AppLayout**: persistent sidebar, header, theme toggle, responsive collapse.
- **Dashboard**: analytics cards, upload CTA, notifications, safety tips, polling via `/api/dashboard/:userId`.
- **Upload**: drag/drop, multi-file queue, progress bars, result cards, PDF report generation, auto-history/report persistence.
- **Reports/History/Profile**: tables with filters, downloads, editing profile info.
- **Support Center**: multi-form wizard (expert request, complaint, tracking, newsletters).
- **Awareness**: News page (with proxy), blog listing/detail, daily tips.
- **Forum**: new posts/comments (topic tagging, likes, search/filter), inline replies, admin moderation, seeded content.
- **Admin Views**: user management (stats, resets, deletion), content moderation (reports), data reset utilities.

### Styling / Libraries

- **shadcn/ui** & Radix primitives (Select, Dialog, Dropdown, Tooltip, etc.)
- **TailwindCSS** for layout.
- **Lucide-react** icons.
- **React Query** for async caching (health checks, dashboards, forum feed).
- **React Router v6** for route definitions (protected, admin, 404).

---

## Database Schema

SQLite database `users.db` with the following core tables:

- `users`, `history`, `reports`, `analyses`
- `notifications`, `admin_logs`, `subscriptions`, `daily_tips`
- `expert_requests`, `complaints`, `blogs`
- `forum_posts`, `forum_comments`

Each table has indexes on FK columns and frequently filtered fields (`user_id`, `created_at`, `status`, etc.). Foreign keys enforced with `PRAGMA foreign_keys=ON`.

---

## API Surface

> Base URL: `http://localhost:5000/api`

| Domain          | Endpoint Examples                                                                                                          |
|-----------------|-----------------------------------------------------------------------------------------------------------------------------|
| Auth            | `POST /auth/login`, `POST /auth/verify`                                                                                    |
| Deepfake        | `GET /health`, `POST /predict`, `POST /train`, `POST /load-model`, `POST /evaluate`, `GET /model-info`, `POST /generate-report` |
| Reports         | `POST /reports`, `GET /reports/:userId`, `GET /reports?user_id=<admin>` (admin feed), `DELETE /reports/:id` (admin)         |
| History         | `POST /history`, `GET /history/:userId`                                                                                    |
| Dashboard       | `GET /dashboard/:userId`, `GET /notifications/:userId`, `PATCH /notifications/:notificationId`                              |
| Analyses        | `POST /analyses`                                                                                                           |
| Admin Users     | `GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id/reset`, `DELETE /admin/users/:id`, `POST /admin/reset-data` |
| Admin Reports   | `GET /admin/reports`, `DELETE /admin/reports/:id`                                                                          |
| Profile         | `GET /profile/:userId`, `PUT /profile/:userId`                                                                             |
| Support Center  | `POST /support/expert-request`, `POST /support/complaint`, `GET /support/track-complaint`, `POST /support/subscribe`, `GET /support/daily-tips` |
| Awareness       | `GET /blogs`, `GET /blogs/:id`, `GET /news` (NewsAPI proxy)                                                                |
| Forum           | `GET /forum/posts`, `POST /forum/posts`, `PUT /forum/posts/:id/like`, `DELETE /forum/posts/:id`, `GET/POST /forum/posts/:id/comments`, `DELETE /forum/comments/:id` |

The frontend `src/services/*.ts` files mirror these endpoints with typed responses and shared error handling.

---

## Setup & Local Development

### Frontend

```bash
npm install
npm run dev           # default Vite port 5173 (project config may use 8080)
```

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# (Optional) Train the model before inference
python train_model.py --dataset ../UADFV --epochs 30 --batch-size 32

# Run API
python app.py                # http://localhost:5000
```

> Default demo credentials are seeded: `admin@gmail.com / admin@123`, `apurva@gmail.com / apurva@29`.

---

## Model Training Pipeline

1. **Dataset**: Ensure UADFV videos/frames exist under `UADFV/real` and `UADFV/fake`.
2. **Frame Loader**: Limits to 10 frames per video to balance dataset size.
3. **Preprocessing**: Resize to 224×224, normalize to [0,1], convert to tensors.
4. **Model**: Xception backbone with frozen layers + dense head (512 → 256 → softmax) and dropout regularization.
5. **Training**: Adam optimizer (1e-4), categorical cross-entropy, metrics (accuracy, precision, recall). Early stopping + LR reduction.
6. **Evaluation**: classification report + confusion matrix saved to `backend/models/confusion_matrix.png`.
7. **Inference**: `/api/predict` accepts video, extracts frames, performs batch inference, aggregates predictions, returns probabilities, confidence, frame count, optionally triggers PDF report.

---

## Testing & Tooling

- **ESLint / TypeScript** ensure frontend quality (`npm run lint`).
- **Selenium** suite under `selenium-testing/` for login/upload/news flows (`python -m pytest` after installing requirements).
- **ReportLab** PDF outputs can be tested via Postman/cURL hitting `/api/generate-report`.
- **Vite Preview** (`npm run preview`) for prod-like frontend testing.

---

## Troubleshooting

| Symptom                                   | Resolution                                                                                                       |
|-------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| Forum Select error (“value cannot be empty”) | Already patched: ensure `SelectItem` values are non-empty (use `"all"` sentinel).                              |
| Blank forum page                          | Backend down or CORS issue → check browser console, verify `/api/forum/posts`.                                  |
| `Model not loaded` responses              | Run `python train_model.py` or call `/api/load-model` with existing `.h5` path.                                 |
| SQLite locks / schema mismatch            | Stop Flask server, delete `backend/users.db` (dev only) to re-init; confirm single running instance.            |
| Large uploads rejected                    | 500 MB limit enforced (HTTP 413). Compress or trim video.                                                        |
| News API errors                           | Provide valid `apiKey` query param; handle upstream rate limits/timeouts.                                       |
| TensorFlow GPU issues                     | Match CUDA/cuDNN versions or install CPU-only packages.                                                         |

---

## License

MIT — see `LICENSE`.

---

## Acknowledgments

- UADFV dataset contributors
- TensorFlow/Keras & XceptionNet authors
- shadcn/ui & Radix teams for accessible components
- Community efforts to improve deepfake awareness
