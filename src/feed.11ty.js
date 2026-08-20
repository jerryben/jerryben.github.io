export const data = {
  permalink: "/blog/feed.xml",
  eleventyExcludeFromCollections: true,
};

function escapeXml(str = "") {
  return str.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  }[c]));
}

// Collection item .url values are prefix-naive (the `url` Nunjucks filter
// is what normally adds pathPrefix in templates); since this is a plain JS
// template with no filter access, the prefix is applied by hand here so
// feed links stay correct on a GitHub project-page deployment.
const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/$/, "");
const withPrefix = (url) => PATH_PREFIX + url;

export function render({ collections, site }) {
  const posts = collections.posts || [];
  const items = posts
    .map(
      (post) => `
  <item>
    <title>${escapeXml(post.data.title)}</title>
    <link>${site.url}${withPrefix(post.url)}</link>
    <guid>${site.url}${withPrefix(post.url)}</guid>
    <pubDate>${post.date.toUTCString()}</pubDate>
    <description>${escapeXml(post.data.description || "")}</description>
  </item>`
    )
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(site.title)} — Blog</title>
  <link>${site.url}${withPrefix("/blog/")}</link>
  <description>${escapeXml(site.description)}</description>${items}
</channel>
</rss>
`;
}
