# Jerry — portfolio, blog & projects

Built with [Eleventy](https://www.11ty.dev/) (a static site generator). Plain HTML/CSS/JS output — no client-side framework, works on GitHub Pages with no server.

## What's here

- **Home page** — hero, about, expertise, journey, 3 featured projects, latest posts, education, contact
- **`/projects/`** — every project, each with its own page (`/projects/<slug>/`)
- **`/blog/`** — every post, each with its own page (`/blog/<slug>/`), plus an RSS feed at `/blog/feed.xml`
- **Chat widget** — floating button on every page, opens a small assistant panel. Works out of the box in a local "demo" mode; see `docs/CHATBOT.md` to connect it to a real AI backend.

## Run it locally

Requires [Node.js](https://nodejs.org) 18+.

```bash
npm install
npm run dev
```

Open the URL it prints (`http://localhost:8080`). Editing any file under `src/` reloads the browser automatically.

To produce the static output without a dev server run:

```bash
npm run build
```

Output goes to `_site/`.

## Editing content

Everything editable lives under `src/`, mostly as Markdown files with a small metadata block ("front matter") at the top.

### Add a blog post

Copy any file in `src/blog/` to a new filename (the filename becomes the URL, e.g. `my-post.md` → `/blog/my-post/`), then edit the front matter and write the post below it in Markdown:

```markdown
---
title: My New Post
description: One sentence — used on the card and in page meta tags.
date: 2026-09-01
tags: [DevOps, AWS]
---
Normal Markdown from here: **bold**, *italic*, lists, > blockquotes,
`inline code`, fenced code blocks with syntax highlighting, tables,
images, and even raw HTML if you need it.
```

The post automatically appears on `/blog/`, the RSS feed, and (if recent enough) the homepage's "From the blog" section — no template editing needed.

### Add a project

Same idea, in `src/projects/`. Extra front matter fields:

```yaml
category: DEVOPS        # short label shown on the card
summary: One sentence for the card.
tools: [Docker, Terraform]
status: In progress      # optional
featured: true            # show on the homepage (only the first 3, by `order`)
order: 4                  # sort position
link: https://github.com/you/repo   # optional external link ("Visit ↗")
```

### Change site-wide info

Edit `src/_data/site.json` — name, email, LinkedIn/GitHub, location, availability, and the nav menu. It's used everywhere (nav, footer, contact section, meta tags), so it only needs updating in one place.

Before publishing, replace the placeholder `YOUR_EMAIL@example.com`, `YOUR_USERNAME`, and LinkedIn URL in that file.

### Change the look

- `src/assets/css/style.css` — layout, nav, hero, cards, general site styling
- `src/assets/css/blog.css` — blog/project post typography, code blocks, tables
- `src/assets/css/chat.css` — the chat widget

## Deploying to GitHub Pages

This repo includes `.github/workflows/deploy.yml`, which builds the site with Eleventy and deploys it automatically on every push to `main`.

1. Push this project to a GitHub repository.
2. In the repo, go to **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**.
3. Push to `main`. The Actions tab will show the build; once it finishes, your site is live at `https://<your-username>.github.io/<repo-name>/`.

The workflow sets a `PATH_PREFIX` automatically so internal links work under that `/repo-name/` subpath. If you're using a **custom domain** (via a `CNAME` file) or a repo literally named `<your-username>.github.io` (a root user-page, no subpath), open `.github/workflows/deploy.yml` and delete the `PATH_PREFIX:` line.

Also update `url` in `src/_data/site.json` to your real domain (origin only, e.g. `https://yourname.github.io` — no trailing repo path, the workflow handles that part) so canonical links, Open Graph tags, and the RSS feed are correct.

## The chat widget

Works immediately with no setup, answering from a small built-in knowledge base. To connect it to a real AI backend that can answer more flexibly, see **[`docs/CHATBOT.md`](docs/CHATBOT.md)** — it walks through why a static site needs a small separate backend for this, and how to deploy the included reference implementation (`server/chat-worker/`).

## Project structure

```
src/
  _data/site.json          site-wide info (name, links, nav)
  _includes/
    layouts/                base.njk (every page), post.njk, project.njk
    partials/                nav, footer, head, project-card, post-card, chat-widget
  assets/{css,js,images}/
  projects/                 one .md file per project
  blog/                      one .md file per post
  index.njk                 home page
  projects.njk               full projects listing
  blog.njk                    full blog listing
server/chat-worker/          reference AI backend (Cloudflare Worker)
docs/CHATBOT.md               chat widget architecture write-up
```

No build step is required to *read* this project — but `npm run build` (via Eleventy) is what turns the Markdown + templates into the static HTML that actually gets hosted.
