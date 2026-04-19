This folder is a Vercel bridge only.

Vercel is currently configured with `frontend` as the project root, so this folder exists only to:
- run the repo-root Vite build
- expose `/api/analyze` from the repo-root proxy

Do not treat `frontend/` as a second app.
Use the repo-root `src/` and `api/` folders as the single source of truth.
