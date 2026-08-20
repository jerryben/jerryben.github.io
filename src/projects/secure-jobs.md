---
title: Job Hunter Agent, An AI-Powered Career Engine
category: AI AGENT
summary: An open-source, local-first system that scrapes ATS job boards, scores candidate matches deterministically, and uses local LLMs to generate tailored resumes and alerts.
tools: [Ollama, Python, FastAPI, Uvicorn, Async HTTPX, APScheduler, Docker, PostgreSQL, Telegram Bot, Streamlit, SMTP Email Engine, Pytest]
status: Exploring
featured: true
order: 2
link:
---
# Building Job Hunter Agent: Engineering a Local-First, AI-Powered Career Engine

Finding a high-fit technical role—specifically within Cloud Infrastructure, DevOps, and Systems Engineering—is often an exercise in dealing with repetitive manual overhead. Software engineers spend countless hours refreshing ATS job boards, reading identical job descriptions, filtering out non-eligible roles (visa, location, or degree mismatches), and manually tailoring resumes.

To automate this workflow without exposing personal profile data to third-party scrapers or incurring cloud API subscription costs, I built **Job Hunter Agent** (`securejobs`).

It is an open-source, local-first automation platform that ingests job postings directly from primary applicant tracking systems (Greenhouse, Lever, Ashby), filters and scores them against a user profile using deterministic matching, persists jobs with semantic vector embeddings, and leverages local LLMs to generate tailored application materials.

---

## Technical Stack & Infrastructure

The platform uses a decoupled microservices architecture containerized with Docker Compose to ensure zero external cloud dependencies.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Streamlit     │     │   FastAPI       │     │   PostgreSQL    │
│   Dashboard     │◄───►│   Backend       │◄───►│   + pgvector    │
│   (:8501)       │     │   (:8001)       │     │   (:5432)       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌─────────┐ ┌─────────┐ ┌──────────┐
              │ATS      │ │LLM      │ │Notifiers │
              │Adapters │ │(Ollama) │ │(Telegram/│
              │         │ │         │ │ Email)   │
              └─────────┘ └─────────┘ └──────────┘
                    │
                    ▼
              ┌─────────────────┐
              │   Company       │
              │   ATS Boards    │
              │   (Live APIs)   │
              └─────────────────┘

```

* **Backend Service:** Python 3.11+ / FastAPI providing async REST endpoints, scheduled discovery workers, and pipeline orchestration.
* **Frontend UI:** Streamlit for live dashboarding, job inspection, scoring visualizations, and interview preparation workflows.
* **Database Layer:** PostgreSQL 17 augmented with `pgvector` for storing 1536-dimensional embeddings and performing fast semantic similarity searches.
* **Local Inference:** Ollama orchestrating `llama3.2:3b-instruct-q5_K_M` (for structured extraction and filtering) and `qwen3.5:4b` (for long-form Markdown resume and cover letter synthesis).
* **Scheduling & Alerts:** APScheduler for automated discovery cycles alongside Telegram Bot API and SMTP handlers for immediate notifications.

---

## Core Pipeline Architecture

The application operates as an event-driven ingestion and evaluation pipeline, executing sequentially across six distinct stages.

```text
[ ATS Endpoint ] ──> [ Discovery Engine ] ──> [ SHA256 Deduplication ]
                                                       │
                                                       ▼
[ Telegram / Email ] <── [ Scoring & Alerts ] <── [ Eligibility Filters ]
                                │
                                ▼
                   [ PostgreSQL + pgvector ]
                                │
                                ▼
                   [ Local LLM Applications ]

```

### 1. Multi-ATS Ingestion & Deduplication

Job listings are ingested directly from native ATS endpoints rather than relying on unreliable third-party aggregators:

* **Greenhouse Adapter:** Queries public JSON board endpoints.
* **Lever Adapter:** Ingests posting arrays via Lever's REST structure.
* **Ashby Adapter:** Parses structured job board payloads.
* **Generic Fallback:** Uses HTML parsing combined with local LLM extraction for non-standard career pages.

To prevent duplicate job entries across multiple discovery cycles or cross-posted boards, the system computes a unique SHA256 content hash based on the normalized job title, company ID, and core job body before database insertion.

### 2. Deterministic Filtering vs. LLM Hallucinations

A common flaw in modern AI pipelines is relying entirely on LLMs to decide candidate eligibility. LLMs can be slow, expensive, and prone to hallucinating qualifications.

Job Hunter Agent employs a **deterministic filter engine** first. Jobs are evaluated against strict rules prior to any AI processing:

* **Location & Remote Policy:** Rejects roles outside target geographical boundaries.
* **Work Authorization & Citizenship:** Filters out explicit security clearance or citizenship constraints.
* **Degree & Core Stack Requirements:** Flags hard disqualifiers based on missing mandatory technical prerequisites.

### 3. Weighted 6-Category Scoring Engine

Jobs that pass the eligibility filter are evaluated by a 6-category weighted scoring algorithm ($0 - 100$ scale). Each category awards points based on exact keyword, phrase, and tech-stack matches derived from the candidate's active profile:

| Category | Description |
| --- | --- |
| **Target Role Alignment** | Exact and fuzzy title matches (e.g., *Cloud Engineer*, *DevOps Specialist*). |
| **Core Technical Stack** | Direct overlap with candidate's primary languages, frameworks, and cloud platforms. |
| **Secondary Technical Skills** | Matches against secondary tools, CI/CD pipelines, and monitoring suites. |
| **Experience Level** | Alignment between listed job seniority requirements and profile history. |
| **Domain & Industry** | Preference weighting for specific domains (e.g., Infrastructure, FinTech, Security). |
| **Bonus Qualifications** | Points for preferred certifications (e.g., AWS Solutions Architect, CKA). |

Jobs reaching a composite score above the configurable threshold (default: $\ge 75$) trigger instant notification pathways.

---

## AI Workflows with Local Models

By integrating local LLM inference via Ollama, sensitive resume data and unreleased target application materials remain isolated on the host machine.

```
                  +-------------------------+
                  |    User Base Profile    |
                  +-------------------------+
                               |
                               v
+------------------+     +------------------+     +-------------------+
| Target Job Specs | --> |  Ollama Engine   | --> | Tailored Markdown |
|  (PostgreSQL)    |     | (qwen3.5 / Llama) |     | Resumes & Covers  |
+------------------+     +------------------+     +-------------------+
                               |
                               v
                  +-------------------------+
                  |  Interview Prep Package |
                  |  (STAR & Company Q&A)   |
                  +-------------------------+

```

### 1. Semantic Vector Search (`pgvector`)

The platform generates vector embeddings for every ingested job description using `nomic-embed-text`. Stored inside PostgreSQL via `pgvector`, users can perform natural language semantic queries directly from the Streamlit interface:

```sql
-- Semantic search query over job embeddings
SELECT id, title, company_id, 1 - (embedding <=> :query_vector) AS similarity
FROM jobs
WHERE status = 'ACTIVE'
ORDER BY similarity DESC
LIMIT 5;

```

### 2. Tailored Application & Interview Generation

When a user selects a high-scoring job, the system feeds the candidate's base profile and the job's requirements into `qwen3.5:4b` to produce:

* **Targeted Markdown Resumes:** Highlights relevant projects and tools matching the job description without inventing experience.
* **Tailored Cover Letters:** Synthesizes company research and profile accomplishments into concise cover letters.
* **Interview Preparation Packages:** Formulates job-specific technical questions, company background research, and structured STAR-framework (Situation, Task, Action, Result) interview responses.

---

## Database Architecture & Data Model

The PostgreSQL database manages five core entities designed to handle everything from initial web discovery to historical application tracking:

```
┌──────────────┐       ┌──────────────┐       ┌─────────────────┐
│   Company    │1    N │     Job      │1    N │   Application   │
│──────────────│◄─────┤──────────────│◄─────┤─────────────────│
│ id           │       │ id           │       │ id              │
│ name         │       │ company_id   │       │ job_id          │
│ careers_url  │       │ title        │       │ resume_id       │
│ ats_type     │       │ score        │       │ status          │
└──────────────┘       │ embedding    │       └─────────────────┘
                       └──────────────┘                │
                                                       │ N
                                                       ▼ 1
                       ┌──────────────┐       ┌─────────────────┐
                       │   Profile    │       │     Resume      │
                       │──────────────│       │─────────────────│
                       │ id           │       │ id              │
                       │ skills[]     │       │ markdown        │
                       │ experience[] │       │ is_base         │
                       └──────────────┘       └─────────────────┘

```

---

## Automated Background Scheduler & Notifications

System background operations run via APScheduler within the FastAPI application instance.

```python
# System Discovery Scheduling Configuration
DISCOVERY_INTERVAL_HOURS = 4
ALERT_SCORE_THRESHOLD = 75
DIGEST_HOUR = 07  # 7:00 AM Daily

```

1. **Periodic Discovery:** Every 4 hours, the scheduler queries all active company endpoints, runs new listings through the filter and scoring pipelines, and updates the database.
2. **Real-time Telegram Alerts:** If a newly discovered job scores $\ge 75$, the backend instantly dispatches a formatted message containing the job title, company, score breakdown, and direct application URL to a designated Telegram chat.
3. **Daily Email Digest:** At 7:00 AM daily, the system aggregates the top-scoring jobs discovered over the last 24 hours and sends a summarized HTML email digest via SMTP.

---

## Verification & Test Coverage

To ensure reliability across dynamic web pages and JSON APIs, the project maintains an extensive automated test suite covering all ingestion adapters, filter conditions, and scoring algorithms:

```text
============================= test session starts ==============================
tests/test_adapters.py   ........................               [ 47% ]
tests/test_filters.py    ........................               [ 66% ]
tests/test_scoring.py    ........................               [ 80% ]
tests/test_scheduler.py  ........................               [ 100%]

============================== 87 passed in 4.12s ==============================

```

---

## Summary & Key Engineering Takeaways

1. **Deterministic Logic + Local LLMs = High Efficiency:** Using rule-based filtering for hard constraints before calling an LLM keeps processing speeds fast and eliminates unnecessary inference costs.
2. **Direct ATS Ingestion Prevents Stale Data:** Bypassing third-party job boards in favor of direct Greenhouse, Lever, and Ashby endpoint queries drastically reduces dead or expired job listings.
3. **Local-First Privacy:** Operating local LLM inference alongside a self-hosted vector database guarantees complete control over personal career data and application materials.

---

### Source Code & Project Repository

* **GitHub Repository:** [jerryben/securejobs](https://www.google.com/search?q=https://github.com/jerryben/securejobs)
* **License:** Open-source under the MIT License.