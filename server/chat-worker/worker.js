/**
 * Reference chat backend for the site's chat widget.
 *
 * Why this exists at all: GitHub Pages only serves static files — it
 * cannot hold a secret API key or run server-side code. This Worker is
 * the small piece that does: it looks up relevant snippets from the
 * site's knowledge base, hands them to Claude as grounding context, and
 * returns a plain-text reply. The API key lives only here, as a Worker
 * secret, never in the front-end JS.
 *
 * Deploy: see the README in this folder. Quick version:
 *   npx wrangler secret put ANTHROPIC_API_KEY
 *   npx wrangler deploy
 * Then set CHAT_CONFIG.apiEndpoint in assets/js/chat-widget.js to the
 * deployed *.workers.dev URL (plus /chat) and CHAT_CONFIG.mode to "live".
 */

import KNOWLEDGE_BASE from "./knowledge-base.json";

// Set this to your GitHub Pages origin, e.g. "https://yourname.github.io"
const ALLOWED_ORIGIN = "https://YOUR_USERNAME.github.io";

// Haiku is fast and inexpensive — a good fit for short, FAQ-style answers
// grounded in a small knowledge base. Swap for "claude-sonnet-5" if you
// need stronger reasoning over more complex questions.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_CONTEXT_CHUNKS = 4;
const MAX_TOKENS = 400;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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
  const words = query.toLowerCase().split(/\W+/).filter(Boolean);
  const text = (chunk.title + " " + chunk.content).toLowerCase();
  return words.reduce((score, w) => score + (w.length > 2 && text.includes(w) ? 1 : 0), 0);
}

function retrieveContext(message) {
  return KNOWLEDGE_BASE.map((chunk) => ({ chunk, score: scoreChunk(message, chunk) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_CHUNKS)
    .map((entry) => `### ${entry.chunk.title}\n${entry.chunk.content}`)
    .join("\n\n");
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
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
      "You are the assistant embedded on Jerry's portfolio website.",
      "Answer visitor questions using ONLY the knowledge base content below — do not invent facts about Jerry.",
      "If the answer isn't in the knowledge base, say you don't have that information and suggest using the site's Contact section.",
      "Keep answers short: two or three sentences, plain text, no markdown.",
      "",
      "KNOWLEDGE BASE:",
      context || "(no matching entries — nothing in the knowledge base looks relevant to this question)",
    ].join("\n");

    if (!env.ANTHROPIC_API_KEY) {
      return jsonResponse({ error: "Server is not configured with an API key" }, 500, origin);
    }

    let anthropicRes;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: [...history, { role: "user", content: message }],
        }),
      });
    } catch (err) {
      console.error("Network error calling Anthropic API:", err);
      return jsonResponse({ error: "Could not reach the model provider" }, 502, origin);
    }

    if (!anthropicRes.ok) {
      console.error("Anthropic API error:", anthropicRes.status, await anthropicRes.text());
      return jsonResponse({ error: "Upstream model call failed" }, 502, origin);
    }

    const data = await anthropicRes.json();
    const reply = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return jsonResponse({ reply: reply || "I'm not sure how to answer that." }, 200, origin);
  },
};
