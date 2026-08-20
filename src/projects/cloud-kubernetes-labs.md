---
title: Cloud & Kubernetes Labs
category: DEVOPS
summary: Hands-on infrastructure environments covering containers, Kubernetes, IaC, CI/CD, monitoring and deployment automation.
tools: [Docker, Kubernetes, Terraform, Jenkins]
status: Ongoing
featured: true
order: 5
link:
---
A working set of environments I use to keep infrastructure skills sharp against real tooling, not just tutorials.

## What it covers

- Containerizing services with **Docker** and orchestrating them with **Kubernetes**
- Provisioning infrastructure as code with **Terraform**
- Building CI/CD pipelines in **Jenkins** and GitLab CI/CD
- Monitoring with **Prometheus** and **Grafana**, and tracking code quality with **SonarQube**

## Approach

Each lab starts from a real failure mode — a deployment that should roll back cleanly, a config that should be reproducible, a pipeline that should catch a bad build before it ships — and works backward to the tooling that solves it.
