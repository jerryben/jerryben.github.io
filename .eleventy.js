import markdownItAnchor from "markdown-it-anchor";
import markdownItFootnote from "markdown-it-footnote";
import syntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";

export default function (eleventyConfig) {
  // ---------------------------------------------------------------------
  // Passthrough (static) assets — copied to _site as-is
  // ---------------------------------------------------------------------
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");
  eleventyConfig.setServerPassthroughCopyBehavior("copy");

  // ---------------------------------------------------------------------
  // Markdown: enable HTML in posts, auto-linked heading anchors,
  // footnotes, and build-time code syntax highlighting (no client JS).
  // ---------------------------------------------------------------------
  eleventyConfig.addPlugin(syntaxHighlight);

  eleventyConfig.amendLibrary("md", (mdLib) =>
    mdLib
      .set({ html: true, breaks: false, linkify: true, typographer: true })
      .use(markdownItAnchor, {
        permalink: markdownItAnchor.permalink.ariaHidden({
          placement: "after",
          symbol: "#",
          class: "header-anchor",
        }),
        level: [2, 3, 4],
      })
      .use(markdownItFootnote)
  );

  // ---------------------------------------------------------------------
  // Collections
  // ---------------------------------------------------------------------
  eleventyConfig.addCollection("projects", (api) =>
    api
      .getFilteredByGlob("src/projects/*.md")
      .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );

  eleventyConfig.addCollection("featuredProjects", (api) =>
    api
      .getFilteredByGlob("src/projects/*.md")
      .filter((item) => item.data.featured)
      .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  );

  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/blog/*.md")
      .filter((item) => !item.data.draft)
      .sort((a, b) => b.date - a.date)
  );

  // ---------------------------------------------------------------------
  // Filters & shortcodes
  // ---------------------------------------------------------------------
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));

  eleventyConfig.addFilter("readableDate", (dateObj) =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(dateObj)
  );

  eleventyConfig.addFilter("isoDate", (dateObj) =>
    new Date(dateObj).toISOString().split("T")[0]
  );

  eleventyConfig.addFilter("readingTime", (content) => {
    const text = (content || "").replace(/<[^>]*>/g, " ");
    const words = text.trim().length ? text.trim().split(/\s+/).length : 0;
    const minutes = Math.max(1, Math.round(words / 200));
    return `${minutes} min read`;
  });

  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());

  // ---------------------------------------------------------------------
  // Output
  // ---------------------------------------------------------------------
  return {
    pathPrefix: process.env.PATH_PREFIX || "/",
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "11ty.js"],
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site",
    },
  };
}
