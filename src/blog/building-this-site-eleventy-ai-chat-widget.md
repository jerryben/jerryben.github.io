---
title: Building this site with Eleventy, and adding an AI chat widget
description: How this portfolio is structured — a static Eleventy build for GitHub Pages, plus notes on wiring up an AI assistant that answers from the site's own content.
date: 2026-08-18
tags: [Eleventy, GitHub Pages, AI]
---
I wanted three things from this rebuild: a **blog I'd actually maintain**, a **projects section that scales past three cards**, and a small **AI chat widget** I could use as a real, working example of the pattern rather than a toy.

Here's how it's put together.

## Why a static site generator, not raw HTML

The original version of this site was a single hand-edited `index.html`. That's fine for one page. It stops being fine the moment you add a blog, because every post needs the same header, the same footer, the same typography — and copy-pasting that by hand is how sites rot.

So this rebuild uses [Eleventy](https://www.11ty.dev/), a static site generator that:

- Builds plain HTML — nothing to host except static files, which is exactly what GitHub Pages wants
- Uses **layouts** so a post or project page only has to define its own content; the surrounding shell is defined once
- Reads content from **Markdown files with front matter**, so publishing a post is "add a file," not "edit a template"

## The publishing model

Every post and every project is one Markdown file:

```markdown
---
title: My New Post
description: One sentence for the card and the meta tag.
date: 2026-09-01
tags: [DevOps]
---
Content goes here, in normal Markdown.
```

That front matter block drives the card on the blog index, the `<title>` and meta tags, and the post's own header — so the whole site stays visually consistent without anyone having to remember to update three places by hand.

Markdown here supports the things a technical blog actually needs:

- Fenced code blocks with syntax highlighting, computed at build time — no highlighting library shipped to the browser
- Tables, footnotes[^1], and blockquotes
- Headings get anchor links automatically, so I can link straight to a section

> A blockquote, for the record, looks like this.

| Approach | Hosting | Build step |
|---|---|---|
| Hand-written HTML | GitHub Pages | None |
| Eleventy (this site) | GitHub Pages | `npx eleventy` |
| Next.js / heavier framework | Vercel/Netlify | Yes, more complex |

## The chat widget, briefly

The floating `>_` button in the corner opens a small terminal-styled chat panel. On its own, GitHub Pages can only serve static files — it can't keep an API key secret or run server-side logic. So the widget is split in two:

1. **The front end** (this repo) — the button, the panel, the conversation logic, calling a configurable API endpoint.
2. **A small backend** (a Cloudflare Worker, in `/server/chat-worker`) — the piece that actually holds the API key, looks up relevant snippets from a small knowledge base about this site, and calls an LLM to answer.

That split — static front end, tiny serverless backend — is the same pattern behind most "chat with our docs" widgets you'll see on documentation sites today. I've written up the full version in [a follow-up post](/blog/local-llms-ollama-litellm-agentic-workflows/) and in `docs/CHATBOT.md` in the repo, including how the knowledge-base lookup works and how to swap in a proper vector search later.

[^1]: Footnotes work too, in case a post needs one.
