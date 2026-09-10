const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function assert(ok, message) {
  if (!ok) throw new Error(`Invalid snapshot: ${message}`);
}
function keys(value, allowed) {
  assert(
    value && typeof value === "object" && !Array.isArray(value),
    "object required",
  );
  assert(
    Object.keys(value).every((key) => allowed.includes(key)) &&
      allowed.every((key) => Object.hasOwn(value, key)),
    "unexpected/missing fields",
  );
}
function text(value, max = 1000000) {
  return typeof value === "string" && value.length <= max;
}
function taxon(value) {
  keys(value, ["slug", "name"]);
  assert(
    text(value.slug, 100) &&
      slug.test(value.slug) &&
      text(value.name, 100) &&
      value.name.trim(),
    "taxonomy",
  );
}
export function validateSnapshot(value) {
  keys(value, [
    "schema_version",
    "id",
    "created_at",
    "site_title",
    "page_size",
    "posts",
  ]);
  assert(
    value.schema_version === 1 &&
      text(value.id, 128) &&
      value.id.length > 0 &&
      text(value.created_at) &&
      Number.isFinite(Date.parse(value.created_at)),
    "version/id/date",
  );
  assert(
    text(value.site_title, 200) &&
      value.site_title.trim() &&
      Number.isInteger(value.page_size) &&
      value.page_size > 0 &&
      value.page_size <= 100,
    "site configuration",
  );
  assert(Array.isArray(value.posts) && value.posts.length <= 1000, "posts");
  const seen = new Set(),
    names = new Map();
  for (const post of value.posts) {
    keys(post, [
      "slug",
      "title",
      "summary",
      "html",
      "published_at",
      "category",
      "tags",
    ]);
    assert(
      text(post.slug, 100) && slug.test(post.slug) && !seen.has(post.slug),
      "unique slug",
    );
    seen.add(post.slug);
    assert(
      text(post.title, 300) &&
        post.title.trim() &&
        text(post.summary, 1500) &&
        text(post.html) &&
        text(post.published_at) &&
        Number.isFinite(Date.parse(post.published_at)),
      "post content",
    );
    // Go is the trusted renderer. Reject obvious unsafe HTML as an additional build check.
    assert(
      !/<\s*(script|iframe|object|embed|base|form|style)\b|\son\w+\s*=|(?:javascript|vbscript)\s*:/i.test(
        post.html,
      ),
      "unsafe HTML",
    );
    taxon(post.category);
    assert(Array.isArray(post.tags) && post.tags.length <= 20, "tags");
    const tags = new Set();
    for (const tag of post.tags) {
      taxon(tag);
      assert(!tags.has(tag.slug), "duplicate tag");
      tags.add(tag.slug);
    }
    for (const t of [post.category, ...post.tags]) {
      assert(
        !names.has(t.slug) || names.get(t.slug) === t.name,
        "inconsistent taxonomy",
      );
      names.set(t.slug, t.name);
    }
  }
  return value;
}
export function publicRoutes(snapshot) {
  const routes = new Set(["/", "/tags"]);
  for (
    let page = 1;
    page <= Math.max(1, Math.ceil(snapshot.posts.length / snapshot.page_size));
    page++
  )
    routes.add(`/page/${page}`);
  for (const p of snapshot.posts) {
    routes.add(`/posts/${p.slug}`);
    routes.add(`/categories/${p.category.slug}`);
    for (const t of p.tags) routes.add(`/tags/${t.slug}`);
  }
  return [...routes];
}
