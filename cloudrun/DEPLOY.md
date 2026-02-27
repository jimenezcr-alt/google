# Cloud Run deployment (GitHub connection)

Deploy **goog-demo-cv0** to **europe-west1** using a GitHub-connected Cloud Build trigger. All builds and deploys are driven by the config in this directory.

---

## 1. Prerequisites

- Google Cloud project with **Cloud Run**, **Artifact Registry**, and **Cloud Build** enabled.
- GitHub repo: **goog-ac/cv_review** (or your fork; adjust `_REPO_NAME` / trigger repo).

---

## 2. One-time setup

### 2.1 Create Artifact Registry repository

```bash
gcloud artifacts repositories create cv_review \
  --repository-format=docker \
  --location=europe-west1 \
  --description="CV review app images"
```

### 2.2 Connect GitHub to Cloud Build

1. Open **Cloud Build** → **Triggers** in the Google Cloud Console.
2. Click **Connect repository** (or **Manage connected repositories**).
3. Choose **GitHub (Cloud Build GitHub App)** or **GitHub (Mirror)**.
4. Authenticate and select the **goog-ac/cv_review** repository (or the org/repo where the code lives).
5. Complete the connection so the repo appears under “Connected repositories”.

### 2.3 Create the Cloud Build trigger

Create a trigger that runs `cloudrun/cloudbuild.yaml` on push (e.g. `main`):

| Field | Value |
|--------|--------|
| **Name** | `deploy-goog-demo-cv0` (or any name) |
| **Event** | Push to a branch |
| **Source** | **goog-ac/cv_review** (your connected repo) |
| **Branch** | `^main$` (or your default branch) |
| **Configuration** | Cloud Build configuration file (repo) |
| **Location** | `cloudrun/cloudbuild.yaml` |
| **Substitution variables** | See below |

**Substitution variables** (required):

| Variable | Value |
|----------|--------|
| `_PROJECT_ID` | Your GCP project ID |
| `_REGION` | `europe-west1` |
| `_SERVICE_NAME` | `goog-demo-cv0` |
| `_REPO_NAME` | `cv_review` (Artifact Registry repo name) |

Save the trigger.

### 2.4 Service account permissions

The Cloud Build service account (e.g. `PROJECT_NUMBER@cloudbuild.gserviceaccount.com`) needs:

- **Cloud Run Admin** (`roles/run.admin`)
- **Service Account User** (`roles/iam.serviceAccountUser`) on the default Compute Engine or Cloud Run runtime SA
- **Artifact Registry Writer** (`roles/artifactregistry.writer`) on the `europe-west1` Artifact Registry repo

Grant in IAM or via:

```bash
PROJECT_ID=your-gcp-project-id
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
REPO=europe-west1-docker.pkg.dev/$PROJECT_ID/cv_review

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
gcloud artifacts repositories add-iam-policy-binding cv_review \
  --location=europe-west1 \
  --member="serviceAccount:${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

---

## 3. Build configuration (exact)

All deployment is forced through Cloud Run and the config in this directory.

| Item | Value |
|------|--------|
| **Cloud Build config file** | `cloudrun/cloudbuild.yaml` |
| **Backend Dockerfile path** | `backend/Dockerfile` |
| **Backend build context** | `backend/` (directory) |
| **Frontend Dockerfile path** | `frontend/Dockerfile` |
| **Frontend build context** | `frontend/` (directory) |
| **Region** | `europe-west1` |
| **Backend service name** | `goog-demo-cv0` |
| **Frontend service name** | `goog-demo-cv0-frontend` |
| **Artifact Registry repo** | `cv_review` in `europe-west1` |
| **Backend image** | `europe-west1-docker.pkg.dev/PROJECT_ID/cv_review/backend:SHORT_SHA` and `:latest` |
| **Frontend image** | `europe-west1-docker.pkg.dev/PROJECT_ID/cv_review/frontend:SHORT_SHA` and `:latest` |

Backend container listens on **$PORT** (Cloud Run sets this; default 8080). Base image: **python:3.12-slim**.

---

## 3.1 Set Fuelix API key (and other env vars) in Cloud Run

The backend reads **FUELIX_API_KEY** (or **FUELIX_SECRET_TOKEN**) from the environment. Set it on the Cloud Run service so the API can call Fuelix.

1. Open **Cloud Run** in Google Cloud Console.
2. Click the service **goog-demo-cv0**.
3. Open the **Edit & deploy new revision** tab (or **Edit**).
4. Expand **Variables & secrets** (or **Container, Variables & secrets**).
5. Under **Environment variables**, add:
   - **Name**: `FUELIX_API_KEY`
   - **Value**: your Fuelix API key (or use **Reference a secret** if you store it in Secret Manager).
6. Optionally add:
   - `FUELIX_MODEL` (default: gemini-3-pro)
   - `FUELIX_FAST_MODEL` (default: gemini-2.0-flash)
   - `FUELIX_BASE_URL` (default: https://api.fuelix.ai/v1)
7. Deploy the new revision.

**gcloud (one-off):**

```bash
gcloud run services update goog-demo-cv0 \
  --region=europe-west1 \
  --set-env-vars="FUELIX_API_KEY=your-secret-key-here"
```

---

## 4. Deploy via GitHub

1. Push to the branch that the trigger watches (e.g. `main`).
2. Cloud Build runs `cloudrun/cloudbuild.yaml`: builds both images, pushes to Artifact Registry, deploys both services to **europe-west1**.
3. Backend URL: `https://goog-demo-cv0-<hash>-ew.a.run.app` (see Cloud Run console).

To run the trigger manually: Cloud Build → Triggers → select trigger → **Run**.

---

## 5. Deploy with local YAML (optional)

If you build images elsewhere and want to deploy using the service YAMLs:

1. Replace `PROJECT_ID` in `backend-service.yaml` / `frontend-service.yaml` with your project ID and set the correct image URLs.
2. Deploy:

```bash
gcloud run services replace cloudrun/backend-service.yaml --region=europe-west1
gcloud run services replace cloudrun/frontend-service.yaml --region=europe-west1
```

---

## 6. Summary

- **Repository (GitHub)**: goog-ac/cv_review  
- **Config that forces Cloud Run deployment**: `cloudrun/cloudbuild.yaml` + `cloudrun/*-service.yaml`  
- **Dockerfile locations**: `backend/Dockerfile`, `frontend/Dockerfile`  
- **Region**: europe-west1  
- **Backend service**: goog-demo-cv0  
- **Frontend service**: goog-demo-cv0-frontend  

All builds and deploys use the above; no SQL, state via Pydantic and local `agents.json` only.
