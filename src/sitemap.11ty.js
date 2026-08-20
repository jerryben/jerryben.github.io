export const data = {
  permalink: "/sitemap.xml",
  eleventyExcludeFromCollections: true,
};

const PATH_PREFIX = (process.env.PATH_PREFIX || "/").replace(/\/$/, "");
const withPrefix = (url) => PATH_PREFIX + url;

export function render({ collections, site }) {
  const staticPages = ["/", "/projects/", "/blog/", "/resume/"];
  const dynamicPages = [...(collections.projects || []), ...(collections.posts || [])];

  const staticUrls = staticPages.map((url) => `
  <url><loc>${site.url}${withPrefix(url)}</loc></url>`);

  const dynamicUrls = dynamicPages.map(
    (item) => `
  <url><loc>${site.url}${withPrefix(item.url)}</loc><lastmod>${item.date.toISOString().split("T")[0]}</lastmod></url>`
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls.join("")}${dynamicUrls.join("")}
</urlset>
`;
}
