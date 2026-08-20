/**
 * Chat widget — logic & API connection
 * ------------------------------------
 * Two modes, controlled by CHAT_CONFIG.mode below:
 *
 *  "demo" (default) — answers are matched locally against the small
 *      knowledge base in KNOWLEDGE_BASE, using simple keyword scoring.
 *      No backend required. This is what runs out of the box on GitHub
 *      Pages, so the widget is never broken/empty for a visitor.
 *
 *  "live" — messages are POSTed to CHAT_CONFIG.apiEndpoint, which should
 *      be a small backend you deploy yourself (see /server/chat-worker
 *      for a ready-to-deploy Cloudflare Worker example, and
 *      /docs/CHATBOT.md for the full write-up). GitHub Pages only
 *      serves static files, so it cannot hold an API key or run the
 *      real model call — that's what the separate backend is for.
 *
 * Switch modes by changing CHAT_CONFIG.mode to "live" and setting
 * apiEndpoint to your deployed backend's URL.
 */
(function () {
  "use strict";

  const CHAT_CONFIG = {
    mode: "demo", // "demo" | "live"
    apiEndpoint: "https://YOUR-WORKER-SUBDOMAIN.workers.dev/chat",
    maxHistoryMessages: 8,
    typingDelayMs: 550, // only used in demo mode, to feel like a real response
  };

  // Small, hand-written knowledge base. Edit this to keep the demo
  // assistant's answers in sync with the rest of the site. Each entry
  // is scored against the visitor's message by keyword overlap.
  const KNOWLEDGE_BASE = [
    {
      keywords: ["who", "jerry", "about", "background"],
      answer:
        "Jerry is a Cloud & DevOps Engineer with 20+ years across networking, systems administration, cloud engineering, security and DevOps — and more recently, AI infrastructure. You can read more in the About section on the homepage.",
    },
    {
      keywords: ["skill", "stack", "expertise", "technology", "tech", "tools"],
      answer:
        "Core areas are Cloud & DevOps (AWS, Kubernetes, Docker, Terraform, CI/CD), Networks & Systems (Linux, TCP/IP, VPN), Security, Automation (Python, Bash, Node.js), and AI & LLMs (Ollama, LiteLLM, AI agents). See the Expertise section for the full breakdown.",
    },
    {
      keywords: ["project", "build", "building", "working on", "portfolio"],
      answer:
        "Current projects include a Local LLM & AI Automation Lab, Cloud & Kubernetes Labs, and Igbo Voice AI. Check out the Projects page for full write-ups on each.",
    },
    {
      keywords: ["blog", "write", "writing", "article", "post"],
      answer:
        "There's a blog covering DevOps, cloud and AI infrastructure notes — including how this chat widget itself was built. Find it at /blog/.",
    },
    {
      keywords: ["hire", "contact", "email", "available", "availability", "work with", "freelance", "remote"],
      answer:
        "Jerry is open to remote Cloud, DevOps, infrastructure and AI-focused opportunities. The fastest way to reach him is the Email link in the Contact section, or LinkedIn.",
    },
    {
      keywords: ["education", "degree", "study", "certification", "certificate"],
      answer:
        "MSc Information Technology, National Open University of Nigeria (2013–2017), plus certifications including Google IT Support, Cloud Security, and the ALX Professional Foundation.",
    },
    {
      keywords: ["ai", "llm", "chatbot", "assistant", "ollama"],
      answer:
        "This chat widget is itself part of Jerry's AI work — a small front end connected to a backend that grounds answers in this site's own content. There's a full technical breakdown in the blog and in /docs/CHATBOT.md in the site's repository.",
    },
  ];

  const FALLBACK_ANSWER =
    "I don't have a good answer for that from this site's content yet. Try asking about Jerry's skills, projects, or how to get in touch — or reach him directly via the Contact section.";

  // ---------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------
  const widget = document.getElementById("chat-widget");
  const toggleBtn = document.getElementById("chat-toggle");
  const panel = document.getElementById("chat-panel");
  const log = document.getElementById("chat-log");
  const form = document.getElementById("chat-form");
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");

  if (!widget || !toggleBtn || !panel || !form) return;

  /** @type {{role: "user"|"assistant", content: string}[]} */
  const history = [];

  // ---------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------
  function openPanel() {
    widget.dataset.state = "open";
    panel.hidden = false;
    toggleBtn.setAttribute("aria-expanded", "true");
    input.focus();
  }

  function closePanel() {
    widget.dataset.state = "closed";
    panel.hidden = true;
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.focus();
  }

  toggleBtn.addEventListener("click", () => {
    if (widget.dataset.state === "open") closePanel();
    else openPanel();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && widget.dataset.state === "open") closePanel();
  });

  // Auto-grow the textarea a little, Enter to send / Shift+Enter for newline
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 90) + "px";
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  // ---------------------------------------------------------------------
  // Rendering helpers
  // ---------------------------------------------------------------------
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, text) {
    const el = document.createElement("div");
    el.className =
      "chat-msg " + (role === "user" ? "chat-msg--user" : role === "error" ? "chat-msg--error" : "chat-msg--bot");
    const p = document.createElement("p");
    p.innerHTML = escapeHtml(text).replace(/\n/g, "<br>");
    el.appendChild(p);
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function showTyping() {
    const el = document.createElement("div");
    el.className = "chat-typing";
    el.id = "chat-typing-indicator";
    el.innerHTML = "<span></span><span></span><span></span>";
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function hideTyping() {
    const el = document.getElementById("chat-typing-indicator");
    if (el) el.remove();
  }

  // ---------------------------------------------------------------------
  // Demo mode: local keyword-matched answers
  // ---------------------------------------------------------------------
  function getDemoAnswer(message) {
    const text = message.toLowerCase();
    let best = null;
    let bestScore = 0;

    for (const entry of KNOWLEDGE_BASE) {
      let score = 0;
      for (const kw of entry.keywords) {
        if (text.includes(kw)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = entry;
      }
    }

    return best ? best.answer : FALLBACK_ANSWER;
  }

  function askDemo(message) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(getDemoAnswer(message)), CHAT_CONFIG.typingDelayMs);
    });
  }

  // ---------------------------------------------------------------------
  // Live mode: call the configured backend
  // ---------------------------------------------------------------------
  async function askLive(message) {
    const res = await fetch(CHAT_CONFIG.apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: history.slice(-CHAT_CONFIG.maxHistoryMessages),
      }),
    });

    if (!res.ok) {
      throw new Error("Chat backend responded with status " + res.status);
    }

    const data = await res.json();
    if (!data || typeof data.reply !== "string") {
      throw new Error("Unexpected response shape from chat backend");
    }
    return data.reply;
  }

  // ---------------------------------------------------------------------
  // Submit handler
  // ---------------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    input.value = "";
    input.style.height = "auto";
    input.disabled = true;
    sendBtn.disabled = true;

    appendMessage("user", message);
    history.push({ role: "user", content: message });
    showTyping();

    try {
      const reply =
        CHAT_CONFIG.mode === "live" ? await askLive(message) : await askDemo(message);
      hideTyping();
      appendMessage("bot", reply);
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      hideTyping();
      appendMessage(
        "error",
        "Sorry, I couldn't reach the assistant just now. Please try again, or use the Contact section below."
      );
      console.error("[chat-widget]", err);
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });
})();
