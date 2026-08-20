---
title: Had a practical taste of the GitLab workflow and it was so nice.
description: Step-by-step flow of activities within this project from beginning to end showing end-to-end operations.
date: 2026-08-10
tags: [GitLab, CI/CD, Kubernets, Gitlab-runner]
---
# GitLab CI/CD with Kubernetes

## Overview

This documentation provides a detailed breakdown of the **GitLab CI/CD pipeline** setup that automates building, pushing, and deploying an application using **GitLab**, **Docker**, and **Kubernetes**. The project consists of two repositories:

- **Repo1 (SCM & Build):** Handles source code management, builds the Docker image, and triggers deployment.
- **Repo2 (K8s Deployment):** Manages Kubernetes manifests and performs deployments using GitLab Kubernetes Agent.

The workflow ensures a seamless **CI/CD process** with self-healing Kubernetes deployments.

---

## Project Workflow

### 1. Code Management & Build (Repo1)

1. Developers push changes to Repo1.
2. GitLab CI/CD builds a Docker image.
3. The image is pushed to GitLab’s container registry.
4. Repo1 triggers Repo2’s deployment pipeline.

### 2. Kubernetes Deployment (Repo2)

1. Repo2 pipeline receives the image tag from Repo1.
2. GitLab Kubernetes Agent establishes cluster access.
3. The deployment manifest updates the container image.
4. Kubernetes applies secrets, deployment, and service definitions.
5. Kubernetes performs a rolling update and ensures the rollout succeeds.

---

## Setup & Configuration

### **1. Clone the Repositories**

```
git clone https://gitlab.com/jerryben/url-shortener.git
git clone https://gitlab.com/jerryben/k8s-connect.git

```

### **2. Configure GitLab CI/CD Variables**

To enable cross-project pipeline triggering between Repo1 and Repo2, follow these steps:

### 1. Get Your Trigger Token from Repo2

- Navigate to **Repo2 → Settings → CI/CD → Pipeline triggers**
- Click **"Add new token"** (or copy an existing one)
- Give it a descriptive name (e.g., `repo1-deploy-trigger`)
- **Copy the token** (keep it secure!)

### 2. Add the Token to Repo1's CI/CD Variables (Recommended for Security)

- Go to **Repo1 → Settings → CI/CD → Variables**
- Click **"Add variable"**
    - **Key:** `REPO2_TRIGGER_TOKEN`
    - **Value:** Paste the token you copied
    - **Protect variable:** ✅ (Recommended)
    - **Mask variable:** ✅ (Hides it in logs)

### **3. Setup GitLab Kubernetes Agent**

Follow the GitLab Kubernetes Agent setup to connect the cluster:

1. Install GitLab Agent in the Kubernetes cluster.
2. Configure `.gitlab/agents/k8s-connect/config.yaml`.
3. Register the agent in GitLab.

---

## GitLab CI/CD Pipeline

### **Repo1 - Build & Trigger Deployment**

**.gitlab-ci.yml (Repo1 - URL Shortener)**

```yaml
---
stages:
  - build-and-push
  - deploy
variables:
  IMAGE_NAME: registry.gitlab.com/jerryben/url-shortener
  IMAGE_TAG: $CI_COMMIT_REF_SLUG
  DEPLOY_IMAGE: registry.gitlab.com/jerryben/url-shortener:$CI_COMMIT_REF_SLUG
build_and_push:
  stage: build-and-push
  image: docker
  services:
    - docker:dind
  script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER"
      --password-stdin $CI_REGISTRY
    - docker build -t $IMAGE_NAME:$IMAGE_TAG .
    - docker push $IMAGE_NAME:$IMAGE_TAG
  only:
    - main
trigger_deployment:
  stage: deploy
  image: curlimages/curl:latest
  script:
     - |
      echo "Triggering Repo2 pipeline with image: $IMAGE_NAME:$IMAGE_TAG"
      curl --fail --silent --show-error --request POST \
           --form "token=$REPO2_TRIGGER_TOKEN" \
           --form "ref=main" \
           --form "variables[DEPLOY_IMAGE]=$IMAGE_NAME:$IMAGE_TAG" \
           "https://gitlab.com/api/v4/projects/68091457/trigger/pipeline"
  only:
    - main
```

### **Repo2 - Kubernetes Deployment**

**.gitlab-ci.yml (Repo2 - K8s Deploy)**

```yaml
stages:
  - deploy

variables:
  DEPLOY_IMAGE: "${DEPLOY_IMAGE:-registry.gitlab.com/jerryben/url-shortener:latest}"

deploy_to_k8s:
  stage: deploy
  image:
    name: bitnami/kubectl:latest
    entrypoint: [""]
  script:
    - |
      echo "========== STARTING DEPLOYMENT =========="
      echo "Setting Kubernetes context..."
      kubectl config get-contexts
      kubectl config use-context "jerryben/k8s-connect:k8s-connect"
      kubectl config current-context

      echo "========== ENVIRONMENT VARIABLES =========="
      echo "All CI-related variables:"
      printenv | grep -E '^CI_' | sort
      echo ""
      echo "Trigger-specific variables:"
      printenv | grep -E '^DEPLOY_IMAGE|^TRIGGER_' | sort
      echo ""
      echo "Full environment:"
      printenv | sort

      echo "========== VERIFYING INPUTS =========="
      if [ -z "$DEPLOY_IMAGE" ]; then
        echo "❌ ERROR: DEPLOY_IMAGE is not set!"
        echo "Possible causes:"
        echo "1. Pipeline wasn't triggered properly from Repo1"
        echo "2. Variable wasn't passed correctly in the trigger"
        echo "3. Default value in variables section isn't working"
        exit 1
      else
        echo "✅ Using DEPLOY_IMAGE: $DEPLOY_IMAGE"
        echo "Image tag: ${DEPLOY_IMAGE##*:}" # Extract tag part
      fi

      echo "========== PREPARING KUBERNETES ENVIRONMENT =========="
      if ! kubectl get namespace my-gitlab-app > /dev/null 2>&1; then
        echo "Namespace 'my-gitlab-app' does not exist. Creating..."
        kubectl create namespace my-gitlab-app
      else
        echo "Namespace 'my-gitlab-app' already exists."
      fi

      echo "========== UPDATING MANIFESTS =========="
      echo "Replacing image placeholder in manifests..."
      find k8s-manifests -type f -name "*.yaml" -exec sed -i "s|IMAGE_PLACEHOLDER|$DEPLOY_IMAGE|g" {} \;
      
      echo "Updated manifests:"
      find k8s-manifests -type f -name "*.yaml" -exec echo "=== {} ===" \; -exec cat {} \;

      echo "========== APPLYING MANIFESTS =========="
      set -e
      echo "Applying secrets..."
      kubectl apply -f k8s-manifests/appsecret.yaml -n my-gitlab-app

      echo "Applying deployment..."
      kubectl apply -f k8s-manifests/deployment.yaml -n my-gitlab-app

      echo "Applying service..."
      kubectl apply -f k8s-manifests/appsvc.yaml -n my-gitlab-app

      echo "Applying additional manifests..."
      kubectl apply -f k8s-manifests/ingress.yaml -n my-gitlab-app || echo "No ingress.yaml found, skipping..."
      kubectl apply -f k8s-manifests/configmap.yaml -n my-gitlab-app || echo "No configmap.yaml found, skipping..."

      echo "========== VERIFYING DEPLOYMENT =========="
      echo "Current resources in namespace:"
      kubectl get all -n my-gitlab-app
      
      echo "Waiting for deployment to stabilize..."
      kubectl rollout status deployment/url-shortener -n my-gitlab-app --timeout=180s
      
      echo "========== DEPLOYMENT SUCCESSFUL =========="
      echo "Deployment completed successfully!"
  only:
    - main

```

---

### Process Screenshots

![trigger_deployment](/assets/images/gitlab-cicd/gitlab-ci1.png)


![deployment process](/assets/images/gitlab-cicd/gitlab-k8s.png)


![Gitlab-rollout successful](/assets/images/gitlab-cicd/Gitlab-rollout.png)

![deployment confirmation](/assets/images/gitlab-cicd/gitlab-deployment.png)

![deployed app running](/assets/images/gitlab-cicd/gitlab-ci4.png)

## Debugging & Troubleshooting

### **1. Pipeline Trigger Issues**

If Repo2 doesn’t trigger:

- Ensure `DEPLOY_TRIGGER_TOKEN` is correctly set in Repo1’s CI/CD Variables.
- Confirm that **Repo2’s trigger token** is used in Repo1’s `.gitlab-ci.yml`.

### **2. Deployment Fails Due to Image Placeholder**

- Confirm that `DEPLOY_IMAGE` is passed from Repo1 to Repo2.
- Check that `sed -i` is correctly replacing `IMAGE_PLACEHOLDER` in `deployment.yaml`.

### **3. Kubernetes Rollout Failure**

- Run:

```
kubectl rollout status deployment/url-shortener -n my-gitlab-app --timeout=180s

```

- Check Kubernetes logs:

```
kubectl logs -l app=url-shortener -n my-gitlab-app

```

---

## Conclusion

This CI/CD pipeline automates the entire deployment lifecycle, ensuring:

- Efficient **Docker image builds**
- **Automated Kubernetes deployments**
- **Self-healing** and rollback capabilities

For any issues, check GitLab pipeline logs, Kubernetes events, and image placeholders.

---

## References

- My Gitlab SCM Repository [Repo1](https://gitlab.com/jerryben/url-shortener/)
- My Gitlab Manifest Repository [Repo2](https://gitlab.com/jerryben/k8s-connect/)
- [GitLab CI/CD Documentation](https://docs.gitlab.com/ee/ci/)
- [Kubernetes Deployment Guide](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)