/**
 * Reference chat backend for the site's chat widget — Gemini edition.
 *
 * Why this exists at all: GitHub Pages only serves static files — it
 * cannot hold a secret API key or run server-side code. This Worker is
 * the small piece that does: it looks up relevant snippets from the
 * site's knowledge base, hands them to Gemini as grounding context, and
 * returns a plain-text reply. The API key lives only here, as a Worker
 * secret, never in the front-end JS.
 *
 * Model: Gemini 2.5 Flash (gemini-2.5-flash) — fast, inexpensive, good
 * for short FAQ-style answers grounded in a small knowledge base.
 * Previous model gemini-2.0-flash was shut down 2026-06-01 (404).
 * Set GEMINI_MODEL env var / secret to override without redeploying code.
 * API docs: https://ai.google.dev/api/generate-content
 *
 * Deploy: see the README in this folder and docs/CHATBOT.md. Quick version:
 *   npx wrangler secret put GEMINI_API_KEY
 *   npx wrangler deploy
 * Then set CHAT_CONFIG.apiEndpoint in src/assets/js/chat-widget.js to the
 * deployed *.workers.dev URL (plus /chat) and CHAT_CONFIG.mode to "live".
 */

import KNOWLEDGE_BASE from "./knowledge-base.json";

// Site origin that is allowed to call this Worker (CORS).
// For the live site this is "https://jerryben.github.io" (user site).
// When testing locally, the Worker still responds but only sends CORS
// headers for this origin.
const ALLOWED_ORIGIN = "https://jerryben.github.io";

// Default model — override via env.GEMINI_MODEL without code change.
// gemini-2.0-flash shut down 2026-06-01; use gemini-2.5-flash (or
// gemini-2.5-flash-lite for same price as old 2.0-flash, or
// gemini-3.5-flash / gemini-3.1-flash-lite for newer GA).
const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_CONTEXT_CHUNKS = 6;
const MAX_TOKENS = 400;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// --- Retrieval step -------------------------------------------------
// Deliberately simple: keyword overlap, no embeddings or vector DB.
// It's enough for a small, hand-curated knowledge base, and it's the
// clearest way to learn the "retrieve, then generate" pattern before
// reaching for something heavier. See docs/CHATBOT.md for how to
// upgrade this to real vector search later.
function scoreChunk(query, chunk) {
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const text = (chunk.title + " " + chunk.content).toLowerCase();
  let score = 0;
  for (const w of words) {
    const stem = w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w;
    if (new RegExp(`\\b${stem}\\w*\\b`).test(text)) score += 1;
  }
  return score;
}

function retrieveContext(message) {
  return KNOWLEDGE_BASE.map((chunk) => ({ chunk, score: scoreChunk(message, chunk) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_CHUNKS)
    .map((entry) => `### ${entry.chunk.title}\n${entry.chunk.content}`)
    .join("\n\n");
}

function toGeminiContents(history, message) {
  const contents = [];
  for (const m of history) {
    // Gemini uses "user" and "model" roles (not "assistant")
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: m.content }] });
  }
  contents.push({ role: "user", parts: [{ text: message }] });
  return contents;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check / debug: GET / or GET /chat returns status without needing API key
    if (request.method === "GET") {
      return jsonResponse(
        {
          ok: true,
          service: "jerry-site-chat",
          model: env.GEMINI_MODEL || DEFAULT_MODEL,
          endpoints: ["/chat", "/api/chat", "/"],
          hint: 'POST JSON {"message":"..."} with Origin: https://jerryben.github.io',
        },
        200,
        origin,
      );
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders(origin) });
    }

    // Accept /chat, /api/chat, /api/chat/, and / (root) for convenience.
    // Worker previously handled any POST path; keep that but also validate.
    const pathname = url.pathname;
    if (
      pathname !== "/" &&
      pathname !== "/chat" &&
      pathname !== "/chat/" &&
      pathname !== "/api/chat" &&
      pathname !== "/api/chat/"
    ) {
      // Still handle unknown POST paths as chat for backwards compat, but log it
      console.warn("Unexpected POST pathname, handling as chat:", pathname);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400, origin);
    }

    const message = (body.message || "").toString().trim().slice(0, 2000);
    if (!message) {
      return jsonResponse({ error: "Message is required" }, 400, origin);
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))
      : [];

    const context = retrieveContext(message);

    const systemPrompt = [
      "You are the assistant embedded on Jerry's portfolio website (jerryben.github.io).",
      "Answer visitor questions using ONLY the knowledge base content below — do not invent facts about Jerry.",
      "If the answer isn't in the knowledge base, say you don't have that information and suggest using the site's Contact section.",
      "Keep answers short: two or three sentences, plain text, no markdown.",
      "",
      "KNOWLEDGE BASE:",
      context || "(no matching entries — nothing in the knowledge base looks relevant to this question)",
    ].join("\n");

    // Accept GEMINI_API_KEY (preferred) or GOOGLE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return jsonResponse({ error: "Server is not configured with a Gemini API key (GEMINI_API_KEY)" }, 500, origin);
    }

    const model = env.GEMINI_MODEL || DEFAULT_MODEL;
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    let geminiRes;
    try {
      geminiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: toGeminiContents(history, message),
          generationConfig: {
            maxOutputTokens: MAX_TOKENS,
            temperature: 0.3,
          },
        }),
      });
    } catch (err) {
      console.error("Network error calling Gemini API:", err);
      return jsonResponse({ error: "Could not reach the model provider" }, 502, origin);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText, "model:", model);
      // Don't leak full upstream body to client in production, but include status for debugging
      return jsonResponse({ error: "Upstream model call failed" }, 502, origin);
    }

    const data = await geminiRes.json();

    // Gemini response shape: { candidates: [{ content: { parts: [{text}] } }] }
    // Handle blocked / empty responses gracefully
    const candidate = (data.candidates || [])[0];
    const reply = candidate?.content?.parts
      ? candidate.content.parts
          .filter((p) => typeof p.text === "string")
          .map((p) => p.text)
          .join("\n")
          .trim()
      : "";

    // If the model was blocked by safety filters, candidates may be empty
    if (!reply) {
      const blockReason = candidate?.finishReason || data.promptFeedback?.blockReason;
      console.warn("Gemini returned no text. finishReason:", blockReason, JSON.stringify(data).slice(0, 800));
      return jsonResponse({ reply: "I don't have a good answer for that from this site's content yet. Try asking about Jerry's skills, projects, or use the Contact section." }, 200, origin);
    }

    return jsonResponse({ reply }, 200, origin);
  },
};
