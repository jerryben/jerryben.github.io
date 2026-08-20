---
title: Learn Igbo AI
category: LANGUAGE AI
summary: A local-first language app solving low-resource NLP for Standard Igbo with context injection and NLLB-200 local AI—running 100% cloud-free..
tools: [Ollama, Embedder, Python, qdrant, Node.js, FastAPI, Docker, TTS, PyTorch, AI]
status: Exploring
featured: true
order: 4
link:
---
**IgboAmaka** is an open-source, local-first language learning platform engineered to preserve and teach Standard Igbo through intelligent translation, flashcards, and native audio playback. Driven by a cascading architecture—combining a curated 8,485-word dictionary, custom user overrides, and a CPU-optimized NLLB-200 AI fallback—it delivers precise, context-aware translation and homophone disambiguation without relying on heavy cloud infrastructure.

---

# Building IgboAmaka: Engineering a Local-First, AI-Powered Igbo Language Platform

Major language platforms often neglect low-resource African languages, offering limited vocabularies, inaccurate grammar models, and robotic audio. To tackle this challenge for Standard Igbo (*Asụsụ Igbo Izugbe*), I built **IgboAmaka** - a privacy-first, full-stack language learning application designed to run entirely on local hardware while delivering production-grade translation, native audio playback, and contextual learning.

Here is an insider look into the architecture, technical decisions, and engineering trade-offs behind IgboAmaka.

---

## The Core Challenge: Low-Resource NLP and Homophones

Building an AI assistant for Igbo presents two main engineering hurdles:

* **Scarcity of Training Data:** Traditional machine learning translation models struggle with dialectal nuances, tone diacritics, and compound verb structures.
* **Homophone Ambiguity:** Igbo relies heavily on tones and context. A single spelling like *eze* can mean **king** or **teeth**; *egbe* can mean **gun** or **kite**; and *angwa/akwa* can mean **egg**, **cry**, or **bed**. Standard translation pipelines break down when stripped of context.

---

## Architectural Blueprint: Cascading Engines

To guarantee high speed, local execution, and high accuracy, IgboAmaka uses a deterministic, three-tier fallback architecture for both text translation and audio generation.

```text
USER QUERY: "teeth" (Context: "body parts")
                   │
                   ▼
     ┌───────────────────────────┐
     │ 1. User Corrections Check │  ──────> (Manual Overrides)
     └───────────────────────────┘
                   │
                   ▼
     ┌───────────────────────────┐
     │  2. Local Dictionary DB   │  ──────> (8,485 Indexed Entries)
     └───────────────────────────┘
                   │
                   ▼
     ┌───────────────────────────┐
     │   3. NLLB-200 AI Engine   │  ──────> (CPU-Optimized Fallback)
     └───────────────────────────┘

```

### 1. The Translation Cascade

* **Tier 1 (User Corrections):** A lightweight JSON-backed override layer (`data/translation_corrections.json`). If a user or native speaker manually adjusts a phrase, the engine intercepts and returns this immediately.
* **Tier 2 (Local Dictionary Database):** An indexed 8,485-word JSON dictionary providing instant (<5ms) lookups for standard vocabulary, grammatical tags, and tonal diacritics.
* **Tier 3 (NLLB AI Engine):** If a complex phrase isn't in the local database, the backend falls back to Meta’s **NLLB-200-distilled-600M** model (`ibo_Latn`), running locally via PyTorch on standard x86 CPU hardware.

### 2. Context-Aware Audio Engine

To deliver authentic audio without consuming gigabytes of storage, the system routes requests through an audio cascade:

* **Native Human Recordings:** Looks for high-quality, pre-recorded MP3s in `data/audio_records/` (recorded at 8 kHz mono, 32 kbps to keep file sizes under 15 KB).
* **TTS Cache:** Checks local disk cache for previously synthesized words.
* **Microsoft Edge-TTS Synthesizer:** Dynamically generates natural speech on demand using the native Nigerian voice model (`en-NG-EzinneNeural`).

---

## Solving Homophones with Context Injection

IgboAmaka handles homophones at both the API and database levels. Every word in the dictionary includes explicit `context` and `tones` metadata fields.

When requesting a translation or audio asset, clients can pass optional context parameters:

```json
// POST /api/translate
{
  "text": "eze",
  "context": "body parts"
}

```

The audio pipeline maps these requests to context-aware filenames on disk—such as `eze_teeth.mp3` vs. `eze_king.mp3`—preventing audio collisions and ensuring the user learns the exact tonal variation meant for that setting.

---

## Tech Stack & Edge Optimization

* **Backend:** Python 3.12 + FastAPI / Custom Server serving NLLB-200 and Edge-TTS integration.
* **Frontend:** React 18 + Vite, featuring responsive flashcard interfaces, interactive search, and live voice recognition.
* **Storage:** Portable JSON-based flat files ensuring zero database server overhead (no external PostgreSQL or Redis process required).
* **Containerization:** Flexible deployment supporting both lightweight bare-metal execution (`./start.sh`) and Docker Compose isolation.

By running the distilled NLLB-200 model directly on CPU, the entire system consumes **under 4 GB of RAM** and requires no discrete GPU, making it deployable on low-cost single-board computers, edge servers, or personal laptops.

---

## What’s Next for IgboAmaka

IgboAmaka bridges heritage language preservation with modern AI engineering. Future updates focus on expanding the native speaker audio repository via crowd-sourced community recording scripts, fine-tuning lightweight local LLMs for conversational chat scenarios, and building an offline-first mobile client.