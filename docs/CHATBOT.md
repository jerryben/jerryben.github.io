# The chat widget: how it works, and how to make it "live"

This site's chat widget is built in two halves on purpose:

```
Visitor's browser                         Your backend (you deploy this)
┌─────────────────────────┐   fetch()    ┌────────────────────────────────┐
│  assets/js/chat-widget.js│ ───────────▶ │  server/chat-worker/worker.js  │
│  (this repo, static)     │ ◀─────────── │  (Cloudflare Worker → Gemini)  │
└─────────────────────────┘   { reply }   └────────────────────────────────┘
                                                     │
                                                     ▼
                                        1. keyword-match the question
                                           against knowledge-base.json
                                        2. call generativelanguage.googleapis.com
                                           (Gemini 2.0 Flash) with the matched
                                           snippets as context + a secret API key
```

## Why it's split like this

**GitHub Pages only serves static files.** It has no server to run code on, and — critically — no safe place to store a secret API key. If you put a Gemini API key directly in `chat-widget.js`, anyone who views the page source could copy it and rack up charges on your account.

So the front end (this repo) never talks to an AI API directly. It talks to a small backend you deploy separately, and that backend holds the key.

## The two widget modes

`src/assets/js/chat-widget.js` has a `CHAT_CONFIG` object at the top:

```js
const CHAT_CONFIG = {
  mode: "demo", // "demo" | "live"
  apiEndpoint: "https://YOUR-WORKER-SUBDOMAIN.workers.dev/chat",
  ...
};
```

- **`demo`** (the default): answers come from a small hard-coded knowledge base *inside the browser* (`KNOWLEDGE_BASE` in the same file), matched by simple keyword scoring. Zero setup — this is what makes the widget work the moment you open the site, even before you've deployed anything.
- **`live`**: messages are POSTed to `apiEndpoint`. Switch to this once you've deployed the backend below.

## Deploying the reference backend (Cloudflare Workers + Gemini 2.0 Flash)

The example in `server/chat-worker/` is a working backend using [Cloudflare Workers](https://developers.cloudflare.com/workers/) calling **Gemini 2.0 Flash** (`gemini-2.0-flash`) — free tier available, fast, and inexpensive.

1. **Get a Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey) (free to start, pay-as-you-go after). Create a key and copy it.
2. **Confirm `ALLOWED_ORIGIN`** in `server/chat-worker/worker.js` is `https://jerryben.github.io` (already set). If you use a project site `https://jerryben.github.io/newportfolio` the Origin is still `https://jerryben.github.io`, so this is correct. For a custom domain, change it to that domain.
3. **Edit `server/chat-worker/knowledge-base.json`** if you want to add or correct facts the assistant can draw on.
4. From `server/chat-worker/`, install and deploy:
   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY   # paste your Gemini key when prompted
   npm run deploy
   ```
   Wrangler prints a URL like `https://jerry-site-chat.YOUR-SUBDOMAIN.workers.dev`. The Worker responds on that origin + `/chat` (or at root if you add a route — see step 6 note).
5. **Test the Worker directly** before wiring the site:
   ```bash
   curl -X POST https://jerry-site-chat.YOUR-SUBDOMAIN.workers.dev/chat \
     -H "Content-Type: application/json" \
     -H "Origin: https://jerryben.github.io" \
     -d '{"message":"How do I contact Jerry?"}'
   # expect: {"reply":"..."}
   ```
   If you get `{"error":"Server is not configured..."}` you forgot the secret. If CORS error, check `ALLOWED_ORIGIN`.
6. Back in `src/assets/js/chat-widget.js`, set:
   ```js
   mode: "live",
   apiEndpoint: "https://jerry-site-chat.YOUR-SUBDOMAIN.workers.dev/chat",
   ```
   **Note:** Cloudflare Workers deployed without a custom route respond on `https://<worker>.<subdomain>.workers.dev/` . This Worker handles all `POST` paths, so `/chat` works even without an explicit route config. If you prefer root, set `apiEndpoint` to the workers.dev URL without `/chat`.
7. Rebuild and redeploy the site (see the main README):
   ```bash
   npm run build   # or push to main — GitHub Actions deploys automatically
   ```
8. **Verify live mode on https://jerryben.github.io**: open the chat widget, ask "How do I contact Jerry?" — you should get the contact-specific answer (email/LinkedIn), and "Available for work?" should give the availability answer. Check DevTools Network tab for a POST to your workers.dev URL returning `200` and `{reply}`.

### Why Gemini 2.0 Flash

- `gemini-2.0-flash` endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
- Auth: `x-goog-api-key: <GEMINI_API_KEY>` header (see `worker.js:toGeminiContents` and `systemInstruction` mapping)
- `generationConfig.maxOutputTokens: 400` and `temperature: 0.3` keep answers short and grounded
- History mapping: `assistant` → `model` role for Gemini's `contents` array
- Prior model was `claude-haiku-4-5` via `api.anthropic.com` — all Anthropic references have been removed; rotate/delete that key if you had one

Prefer a different platform? The same `worker.js` logic — read the body, retrieve context, call Gemini `generateContent`, return JSON — ports easily to a Vercel/Netlify serverless function, an AWS Lambda behind API Gateway, or a small Express server. Only the fetch URL and secret handling change.

## The retrieval step, and how to grow it

The Worker's `retrieveContext()` function is intentionally simple: it lower-cases the question, checks which knowledge-base entries share the most words with it, and hands the top few to Gemini as context (via `systemInstruction`). This is a real (if minimal) version of **retrieval-augmented generation (RAG)** — retrieve relevant facts first, then generate an answer grounded in them, instead of asking the model to answer from general knowledge alone.

It's a good starting point because it's easy to read end-to-end. Two natural upgrades once you outgrow it:

- **More content, same approach**: split `knowledge-base.json` into more, smaller entries (one per FAQ or project detail) — keyword matching gets better simply from having more granular chunks to choose from.
- **Semantic search**: swap the keyword scorer for embeddings — generate an embedding per knowledge-base chunk once, embed the incoming question, and retrieve by vector similarity instead of word overlap. [Cloudflare Vectorize](https://developers.cloudflare.com/vectorize/) pairs naturally with Workers if you go this route; a hosted vector DB (Pinecone, Qdrant, etc.) works too from any backend.

## Security notes worth keeping

- Never put an API key in front-end JS — it will end up in the page source.
- Set `ALLOWED_ORIGIN` (CORS) to your real site origin (`https://jerryben.github.io`) so other sites can't quietly call your backend and spend your API budget.
- Add rate limiting before sharing the site widely — Cloudflare's dashboard has a built-in rate-limiting rule you can point at the Worker's route, which is the least code to write.
- The system prompt tells the model to answer only from the knowledge base and to decline otherwise — this keeps a visitor from turning the widget into a general-purpose chatbot, and keeps answers about *you* accurate.
- For Gemini free tier, set quotas/budgets in Google Cloud Console → Generative Language API to avoid surprise usage.

## Activating on jerryben.github.io (checklist)

- [ ] `worker.js` `MODEL = "gemini-2.0-flash"` and `ALLOWED_ORIGIN = "https://jerryben.github.io"` — done in repo
- [ ] `wrangler secret put GEMINI_API_KEY` set on Cloudflare
- [ ] `wrangler deploy` succeeds and URL noted
- [ ] `src/assets/js/chat-widget.js` `CHAT_CONFIG.mode = "live"` and `apiEndpoint` points to that workers.dev URL
- [ ] `npm run build` + push to `main` (Actions → Pages deploy)
- [ ] Test live chat on https://jerryben.github.io (and locally with `npm run dev` + CORS Origin header)
- [ ] (Optional) Add custom domain to Worker and update `apiEndpoint` to that domain for cleaner URL
