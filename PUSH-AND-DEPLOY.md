# Push to GitHub and deploy on Cloud Run

## 1. Files that must be in the repo (for build to succeed)

- `Dockerfile.app` (repo root)
- `.dockerignore` (repo root)
- `cv_review/frontend/next.config.js` (with `output: "export"`)
- `cv_review/frontend/app/analysis/[id]/page.tsx` (with `generateStaticParams()`)
- `cv_review/frontend/app/analysis/[id]/AnalysisDetailClient.tsx`
- `cv_review/frontend/lib/api.ts` (same-origin when `NEXT_PUBLIC_API_URL` is empty)
- `cv_review/backend/main.py` (with static serve + catch-all)
- `cv_review/backend/requirements.txt`
- All other `cv_review/` source files (config, components, etc.)

## 2. Commit and push

From the **repo root** (folder that contains `cv_review/`, `Dockerfile.app`):

```bash
# Add all changes (respects .gitignore)
git add .
git status

# Commit
git commit -m "fix: static export + Cloud Run single deploy (generateStaticParams, Dockerfile.app)"

# Push to the branch your Cloud Run build uses (e.g. main)
git push origin main
```

If the branch has a different name (e.g. `master`), use that:

```bash
git push origin master
```

## 3. Deploy

- **Cloud Run (trigger)**: If the service is connected to the repo, a new build will start on push. Wait for it to finish, then open the service URL.
- **Manual**: Run `make deploy` from the repo root (needs Docker and gcloud configured).

## 4. If build still fails on "generateStaticParams"

Confirm these two files exist **in the repo you push to** (e.g. `jimenezcr-alt/google`):

1. `cv_review/frontend/app/analysis/[id]/page.tsx` — must export `generateStaticParams()` that returns `[]`.
2. `cv_review/frontend/app/analysis/[id]/AnalysisDetailClient.tsx` — the client component (full content).

Then:

```bash
git add cv_review/frontend/app/analysis/
git commit -m "fix: add generateStaticParams for Next.js static export"
git push origin main
```
