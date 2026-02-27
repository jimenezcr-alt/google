# Deploy and run the app — no triggers

**Deploy from your machine. One link shows the full app.** No Cloud Build triggers.

---

## 1. One-time setup

Install **Docker** and **gcloud**, and log in:

```bash
gcloud auth login
gcloud config set project telsalprofessors-dev
```

Create the Artifact Registry repo (once):

```bash
gcloud artifacts repositories create cv_review \
  --repository-format=docker \
  --location=europe-west1 \
  --project=telsalprofessors-dev
```

Configure Docker to push to Artifact Registry:

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev --project=telsalprofessors-dev
```

---

## 2. Deploy (whenever you want a new version)

From the **repo root** (where the Makefile and `Dockerfile.app` are):

```bash
make deploy
```

Or without Make:

```bash
export PROJECT_ID=telsalprofessors-dev REGION=europe-west1 REPO=cv_review SERVICE=goog-demo-cv0
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app:latest -f Dockerfile.app .
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app:latest
gcloud run deploy $SERVICE --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app:latest --region $REGION --platform managed --allow-unauthenticated --project $PROJECT_ID
```

At the end, gcloud prints the service URL. Open it — you get the full app (frontend + API).

**Example link:** https://goog-demo-cv0-464316124240.europe-west1.run.app

---

## 3. Fuelix API key (once per service)

So the app can call the API, set the key on the Cloud Run service:

```bash
gcloud run services update goog-demo-cv0 \
  --region=europe-west1 \
  --set-env-vars="FUELIX_API_KEY=your-actual-key" \
  --project=telsalprofessors-dev
```

Or in the console: **Cloud Run** → **goog-demo-cv0** → **Edit** → **Variables & secrets** → add `FUELIX_API_KEY`.

---

## Summary

| Step | Command |
|------|--------|
| One-time setup | `make deploy-setup` or run the gcloud commands above |
| Deploy & run | `make deploy` |
| App link | The URL gcloud prints, or https://goog-demo-cv0-464316124240.europe-west1.run.app |

No triggers. Deploy when you want, click the link to use the app.
