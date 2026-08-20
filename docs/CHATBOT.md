# The chat widget: how it works, and how to make it "live"

This site's chat widget is built in two halves on purpose:

```
Visitor's browser                         Your backend (you deploy this)
┌─────────────────────────┐   fetch()    ┌────────────────────────────────┐
│  assets/js/chat-widget.js│ ───────────▶ │  server/chat-worker/worker.js  │
│  (this repo, static)     │ ◀─────────── │  (Cloudflare Worker)           │
└─────────────────────────┘   { reply }   └────────────────────────────────┘
                                                     │
                                                     ▼
                                        1. keyword-match the question
                                           against knowledge-base.json
                                        2. call api.anthropic.com/v1/messages
                                           with the matched snippets as
                                           context + a secret API key
```

## Why it's split like this

**GitHub Pages only serves static files.** It has no server to run code on, and — critically — no safe place to store a secret API key. If you put an Anthropic API key directly in `chat-widget.js`, anyone who views the page source could copy it and rack up charges on your account.

So the front end (this repo) never talks to an AI API directly. It talks to a small backend you deploy separately, and that backend holds the key.

## The two widget modes

`assets/js/chat-widget.js` has a `CHAT_CONFIG` object at the top:

```js
const CHAT_CONFIG = {
  mode: "demo", // "demo" | "live"
  apiEndpoint: "https://YOUR-WORKER-SUBDOMAIN.workers.dev/chat",
  ...
};
```

- **`demo`** (the default): answers come from a small hard-coded knowledge base *inside the browser* (`KNOWLEDGE_BASE` in the same file), matched by simple keyword scoring. Zero setup — this is what makes the widget work the moment you open the site, even before you've deployed anything.
- **`live`**: messages are POSTed to `apiEndpoint`. Switch to this once you've deployed the backend below.

## Deploying the reference backend (Cloudflare Workers)

The example in `server/chat-worker/` is a working backend using [Cloudflare Workers](https://developers.cloudflare.com/workers/) — free to start, no server to manage, and it plays well with a GitHub Pages front end on a different domain.

1. **Get an Anthropic API key** from the [Claude Platform console](https://platform.claude.com) if you don't have one.
2. **Edit `server/chat-worker/worker.js`**: set `ALLOWED_ORIGIN` to your GitHub Pages URL (e.g. `https://yourname.github.io`).
3. **Edit `server/chat-worker/knowledge-base.json`** if you want to add or correct facts the assistant can draw on.
4. From `server/chat-worker/`, install and deploy:
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # paste your key when prompted
   npm run deploy
   ```
5. Wrangler prints a URL like `https://jerry-site-chat.YOUR-SUBDOMAIN.workers.dev`. Copy it.
6. Back in `src/assets/js/chat-widget.js`, set:
   ```js
   mode: "live",
   apiEndpoint: "https://jerry-site-chat.YOUR-SUBDOMAIN.workers.dev/chat",
   ```
7. Rebuild and redeploy the site (see the main README).

Prefer a different platform? The same `worker.js` logic — read the body, retrieve context, call the Messages API, return JSON — ports easily to a Vercel/Netlify serverless function, an AWS Lambda behind API Gateway, or a small Express server. The Worker just happens to be the least setup for a static-site project like this one.

## The retrieval step, and how to grow it

The Worker's `retrieveContext()` function is intentionally simple: it lower-cases the question, checks which knowledge-base entries share the most words with it, and hands the top few to Claude as context. This is a real (if minimal) version of **retrieval-augmented generation (RAG)** — retrieve relevant facts first, then generate an answer grounded in them, instead of asking the model to answer from general knowledge alone.

It's a good starting point because it's easy to read end-to-end. Two natural upgrades once you outgrow it:

- **More content, same approach**: split `knowledge-base.json` into more, smaller entries (one per FAQ or project detail) — keyword matching gets better simply from having more granular chunks to choose from.
- **Semantic search**: swap the keyword scorer for embeddings — generate an embedding per knowledge-base chunk once, embed the incoming question, and retrieve by vector similarity instead of word overlap. [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) pairs naturally with Workers if you go this route; a hosted vector DB (Pinecone, Qdrant, etc.) works too from any backend.

## Security notes worth keeping

- Never put an API key in front-end JS — it will end up in the page source.
- Set `ALLOWED_ORIGIN` (CORS) to your real site origin so other sites can't quietly call your backend and spend your API budget.
- Add rate limiting before sharing the site widely — Cloudflare's dashboard has a built-in rate-limiting rule you can point at the Worker's route, which is the least code to write.
- The system prompt tells the model to answer only from the knowledge base and to decline otherwise — this keeps a visitor from turning the widget into a general-purpose chatbot, and keeps answers about *you* accurate.
