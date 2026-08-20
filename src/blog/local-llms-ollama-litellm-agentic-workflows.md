---
title: What I've learned running local LLMs with Ollama and LiteLLM
description: Notes from the AI Automation Lab project — running open models locally, routing between them, and where that connects to the chat widget on this site.
date: 2026-08-10
tags: [AI, Ollama, Automation]
---
Notes from working on the [Local LLM & AI Automation Lab](/projects/local-llm-ai-automation-lab/) project — the practical side of running open models locally rather than only calling a hosted API.

## Why bother running models locally at all

Three reasons kept coming up for me:

1. **Cost control** during heavy iteration — testing a prompt fifty times against a hosted API adds up
2. **Understanding the request/response cycle** properly, instead of treating an API as a black box
3. **Data that shouldn't leave the machine** — some experiments involve content I don't want to send anywhere

None of that means local models replace hosted ones for production work. It means local-first is a good place to *learn* the mechanics before reaching for a hosted API in something user-facing — like the chat widget on this site's homepage.

## The stack

- **Ollama** to pull and run open models locally with a simple API surface
- **LiteLLM** to route requests to whichever backend makes sense — a local model for cheap iteration, a hosted model when I need more capability — behind one consistent interface
- **n8n** to wire the model into an actual workflow (trigger → fetch → summarize → deliver), rather than a one-off script

## Where this connects to the site's chat widget

The chat assistant on this site's homepage answers questions using a small, hand-written knowledge base about my skills, projects, and availability — not the open internet. That's the same "retrieval before generation" idea from the automation lab, just scoped down: look up the relevant snippet first, then hand it to the model as context, so answers stay grounded in what's actually true rather than invented.

The full breakdown of how that's wired up — the front-end widget, the serverless backend, and the retrieval step — is in `docs/CHATBOT.md` in this site's repository.
