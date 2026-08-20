---
title: Athena AI with Voice Command
category: PERSONAL ASSISTANT AI
summary: Athena, a game of turning local quantized models into a privacy-first, tool-calling assistant that actually manages systems and acts as a second brain for all my notes in Joplin and Obsidian...
tools: [Ollama, Embedder, Python, Pytest, Uvicorn, Qdrant, Whisper, HTLM5, Node.js, FastAPI, Docker, PostgreSQL, Redis, TTS, Obsidian, Joplin ]
status: Exploring
featured: true
order: 3
link:
---
# Building Athena AI: A Local, Voice-Enabled Personal Chief of Staff

Cloud-hosted AI assistants are convenient, but they come with trade-offs: data privacy risks, recurring API subscription fees, and a complete lack of control over your underlying operating system. To bridge local LLM capabilities with my daily workflows, OS controls, and knowledge management systems, I built **Athena AI**—a self-hosted, voice-driven personal Chief of Staff.

---

### System Architecture & Stack

Athena runs entirely on local hardware using an asynchronous microservices architecture containerized with Docker.

| Component | Technology | Role |
| --- | --- | --- |
| **Backend API** | FastAPI (Python) | High-performance routing, tool dispatch, state orchestration |
| **Local LLM Engine** | Ollama (`Qwen`) | Low-latency local instruction following and function calling |
| **Vector Storage** | Qdrant + `nomic-embed-text` | Long-term semantic memory indexing and search |
| **Audio Pipeline** | Whisper / Ollama | Local voice-to-text transcription via browser media stream |
| **Databases** | PostgreSQL 17 + Redis 7 | State persistence, structured data, and context caching |
| **Frontend** | Vanilla HTML5 / CSS3 / JS | Lightweight, zero-framework web dashboard with mic control |

---

### Core Capabilities

* **System Orchestration & Tool Calling:** Athena moves beyond text completion by executing Python-backed tools. It monitors CPU/RAM loads, manages system processes, pulls/runs Docker containers, and executes shell scripts.
* **Dual 'Second Brain' Sync:**
* **Obsidian:** Interacts directly with local Markdown vaults to read, search, create, or modify notes.
* **Joplin:** Connects over Joplin's local REST API plugin to query notebooks and append context seamlessly.


* **Semantic Long-Term Memory:** Embeddings generated via `nomic-embed-text` are stored in Qdrant. Rather than flooding the LLM's active context window, Athena dynamically retrieves past conversations, facts, and user preferences on demand.
* **Voice-First Command Execution:** Integrates WebAudio capture directly in the web UI, sending raw audio to an onboard Whisper model for immediate local transcription and tool execution.

---

### Tool Execution Flow

Athena utilizes structured function calling to bridge natural language prompts with system endpoints.

```
User Prompt (Voice/Text) ──> FastAPI Orchestrator ──> Ollama (Qwen)
                                                             │
                                                     Emits Tool Call JSON
                                                             │
    Final Response <── FastAPI <── System Exec Driver <──────┘

```

1. **User Request:** *"Check system disk usage and list my running containers."*
2. **Model Decision:** The LLM parses available tool schemas and yields structured function calls for `get_disk_usage` and `docker_command`.
3. **Execution & Synthesis:** FastAPI executes the backend Python drivers, feeds raw terminal context back to the LLM, and presents a unified summary to the web UI.

---

### Key Takeaways & Lessons

* **Quantization & Performance:** Running a 4-bit quantized local model balances rapid tool-calling response times with low VRAM usage, making real-time voice interactions practical.
* **Decoupled Memory:** Keeping short-term context in Redis and long-term embeddings in Qdrant keeps token usage low while preserving past context across sessions.
* **Local Privacy:** Maintaining zero external network dependencies ensures sensitive system diagnostics, personal notes, and audio transcripts never leave the device.