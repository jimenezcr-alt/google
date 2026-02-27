# Developer workflow - prefer running via Makefile (e.g. make dev)
# Deploy full app (one link): make deploy

PROJECT_ID ?= telsalprofessors-dev
REGION    ?= europe-west1
REPO     ?= cv_review
SERVICE   ?= goog-demo-cv0

IMAGE = $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO)/app:latest

.PHONY: dev install backend frontend build deploy deploy-setup

dev:
	@echo "Run backend: make backend | frontend: make frontend"
	$(MAKE) backend

install:
	cd backend && uv sync 2>/dev/null || true
	cd cv_review/frontend && npm install

backend:
	cd cv_review/backend && pip install -r requirements.txt 2>/dev/null || true && uvicorn main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd cv_review/frontend && npm run dev

build:
	cd cv_review/frontend && npm run build

# One-time: create Artifact Registry repo and configure Docker
deploy-setup:
	gcloud artifacts repositories create $(REPO) --repository-format=docker --location=$(REGION) --project=$(PROJECT_ID) 2>/dev/null || true
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --project=$(PROJECT_ID)

# Build, push, deploy. Then open the link — no triggers.
deploy: deploy-setup
	docker build -t $(IMAGE) -f Dockerfile.app .
	docker push $(IMAGE)
	gcloud run deploy $(SERVICE) --image $(IMAGE) --region $(REGION) --platform managed --allow-unauthenticated --project $(PROJECT_ID)
	@echo ""
	@echo "Done. Open the link above to use the app."
