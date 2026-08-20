---
title: "Chatbot, RAG-Powered Site Assistant"
category: AI CHATBOT
summary: "A self-contained, open-source chatbot widget that turns any static portfolio into an intelligent Q&A interface. Built with Retrieval Augmented Generation (RAG) - ground every response in real knowledge, not web-hallucination..."
tools: [Python, FastAPI, Uvicorn, Docker, HTML5 + CSS, ChromaDB, LLM]
status: Exploring
featured: true
order: 6
link:
---
# Building a RAG-Powered Chatbot for Your Portfolio Site (No API Keys Required)

## The Problem With Generic Chatbots

Every portfolio site needs a way to engage visitors. The typical solution? Drop in a chat widget. But most of those widgets are just shallow wrappers around expensive cloud APIs — they don't actually know anything about *you*, your projects, or your skills. They guess. And when they guess wrong, you look bad.

I built something different: a **Retrieval-Augmented Generation (RAG) chatbot** that lives on my portfolio, answers questions about my work accurately, and runs entirely on my own machine with zero API costs.

Here's how it works, and how you can build one too.

---

## What Is RAG, Anyway?

RAG stands for **Retrieval-Augmented Generation**. It's a technique that solves one fundamental problem with chatbots: **they make things up**.

Traditional chatbots take your question, throw it at a large language model (LLM), and hope for the best. The LLM has seen all kinds of data during training, but it doesn't know what's *current* in your life, what projects you're working on this week, or how to reach you.

RAG fixes that by adding a retrieval step:

1. **Store** your knowledge in a searchable database (I use a simple JSON file + a vector store)
2. **Embed** that knowledge into numerical vectors (dense representations that capture meaning)
3. **When a question arrives**, convert it to a vector too, find the closest matches in your knowledge base
4. **Feed those matches** to the LLM as context, along with the question
5. **The LLM generates** a response grounded in *your* actual data

The result: accurate answers, no hallucinations, full ownership.

---

## The Architecture

```
Visitor → Browser (chat widget)
            │
            │  fetch POST /api/chat { "message": "What are your skills?" }
            ▼
        FastAPI Backend (:8000)
            │
            ├── Step 1: Embed query → Ollama (nomic-embed-text)
            │
            ├── Step 2: Query ChromaDB → find top-1 matching document
            │
            ├── Step 3: Build prompt = system + context + question
            │
            └── Step 4: Generate response → Ollama (llama3.2:3b)
                          │
                          ▼
              { "reply": "You can reach me at..." }
                          │
                          ▼
              Chat UI displays the answer
```

Everything happens in real-time. The whole round-trip takes roughly a second on a modest machine.

---

## The Tech Stack — And Why Each Piece Matters

### Frontend: Vanilla HTML/CSS/JS

No React, no Vue, no build step. Just `indext.html`, `style.css`, and `chat.js`.

**Why?** Portability. This chatbot can be dropped onto *any* static site — GitHub Pages, Netlify, a personal domain, whatever. No framework lock-in. If your site isn't built with a JS framework, you don't need one just for the chatbot.

The chat widget itself is a floating button (`position: fixed` bottom-right) that toggles a chat window. Messages flow as simple `fetch()` calls to the backend. That's it.

### Backend: FastAPI (Python)

FastAPI gives us:
- Automatic OpenAPI docs at `/docs`
- CORS middleware for cross-origin requests from the browser
- Pydantic models for request validation
- Async-compatible request handling

The core endpoint is `POST /api/chat`. It takes a `message` string and returns `{ "reply": "..." }`.

### Ollama — Local LLM Server

Ollama runs LLMs locally on your machine. No API keys, no rate limits, no data leaving your computer.

We use two Ollama models:
- **`nomic-embed-text`** — converts text to 768-dimensional vectors for semantic search
- **`llama3.2:3b-instruct-q5_K_M`** — the 3-billion-parameter instruct model, quantized for speed

Both run as a local HTTP server on `localhost:11434`. The API is straightforward:

```python
# Embed a document
requests.post("http://localhost:11434/api/embeddings", json={
    "model": "nomic-embed-text",
    "prompt": "I am a cloud/devops engineer..."
})

# Generate a response
requests.post("http://localhost:11434/api/generate", json={
    "model": "llama3.2:3b-instruct-q5_K_M",
    "prompt": "Context: ...\n\nQuestion: What are your skills?",
    "stream": False
})
```

### ChromaDB — Lightweight Vector Database

ChromaDB is an embedded vector database that runs as a Docker container. It stores documents as vectors and supports similarity search out of the box.

Key properties:
- REST API accessible from any language
- Collections with automatic embedding management (or manual, as we do)
- Cosine similarity by default — perfect for finding the "closest" knowledge document
- Zero config: one Docker command, done

### knowledge.json — The Source of Truth

The entire knowledge base is a single JSON file:

```json
[
  {"id": "bio", "text": "I am a cloud/devops engineer specializing in Python, k8s..."},
  {"id": "contact", "text": "You can reach me via email at onwohjeremiah@gmail.com..."},
  {"id": "skills", "text": "Linux, Docker, Python, Ollama, Kubernetes, AWS, GCP..."}
]
```

This is intentional. The knowledge base is:
- **Human-readable** — edit it in any text editor
- **Version-controllable** — track changes in git
- **Easy to extend** — add new documents as you ship new projects

---

## How Ingestion Works (`ingest.py`)

When you run `ingest.py`, three things happen:

1. Load `knowledge.json`
2. For each document, call Ollama's embedding endpoint to get a vector
3. Upsert the document + vector into ChromaDB

```python
for item in knowledge_data:
    # Convert text to embedding
    embedding = requests.post(OLLAMA_URL, json={
        "model": "nomic-embed-text",
        "prompt": item["text"]
    }).json()["embedding"]

    # Store in ChromaDB
    requests.post(upsert_url, json={
        "ids": [item["id"]],
        "embeddings": [embedding],
        "documents": [item["text"]]
    })
```

Run this once when you set up, and again whenever you update your knowledge base. ChromaDB persists to disk automatically.

---

## How the Chat Flow Works (`main.py`)

Each time a visitor sends a message:

```python
@app.post("/api/chat")
def chat(request: ChatRequest):
    # 1. Embed the user's question
    query_embedding = embed(request.message)

    # 2. Retrieve the best matching document from ChromaDB
    results = chroma.query(query_embedding, n_results=1)
    context = results["documents"][0][0]

    # 3. Build the RAG prompt
    prompt = f"""You are a helpful portfolio AI assistant.
    Answer using ONLY the provided context.

    Context:
    {context}

    Question: {request.message}

    Answer:"""

    # 4. Generate response with Llama 3.2
    response = generate(prompt)
    return {"reply": response}
```

The critical insight: **the LLM never answers from its training data alone**. It *must* use the retrieved context. If the context doesn't contain the answer, it says so. That's the RAG guarantee.

---

## Deployment

This project is designed to be **self-hosted and private**:

- Ollama runs on your machine (or a VPS you control)
- ChromaDB stores everything locally
- No data leaves your infrastructure
- Zero recurring costs beyond electricity

For a live portfolio, host the static files on GitHub Pages or Netlify, and run the FastAPI backend + Ollama + ChromaDB on a cheap VPS (or your home server). Update the JS `fetch()` URL to point to your backend.

---

## Extending This

This is a minimal viable implementation. Here's where you can go next:

| Extension | How |
|-----------|-----|
| **Multi-document retrieval** | Change `n_results` from 1 to 3-5 in the query |
| **Richer knowledge** | Scrape your GitHub repos, blog posts, or documentation into ChromaDB |
| **Streaming responses** | Set `"stream": true` and pipe chunks to the frontend |
| **Conversation history** | Maintain a session array and include past messages in the prompt |
| **Better embeddings** | Swap to `snowflake-arctic-embed` or `mxbai-embed-large` |
| **Persistent memory** | Add a conversation store (Redis, SQLite) for long-term context |
| **UI polish** | Add typing indicators, markdown rendering, dark mode |

---

## Why I Built This

I wanted a portfolio chatbot that *actually knows what my page is about*. Not a generic assistant that gives generic answers. The RAG approach forces every response to be grounded in real information I provide. It's honest, it's private, and it costs nothing to run.

If you're building your own service or product page, this pattern is worth considering. The technology is mature, the tooling is open-source, and the result is something that feels genuinely useful to visitors.

---

*Code available on GitHub. Fork it, make it yours.*