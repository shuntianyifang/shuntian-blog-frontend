import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateSnapshot, publicRoutes } from "../shared/snapshot.mjs";
const fixture = JSON.parse(
  await readFile(new URL("../fixtures/snapshot.json", import.meta.url), "utf8"),
);
test("public contract and explicit taxonomy/pagination routes", () => {
  const value = structuredClone(fixture);
  for (let i = 0; i < 11; i++)
    value.posts.push({
      ...structuredClone(value.posts[0]),
      slug: `article-${i}`,
    });
  validateSnapshot(value);
  const routes = publicRoutes(value);
  for (const path of [
    "/",
    "/page/1",
    "/page/2",
    "/page/3",
    "/posts/article-10",
    "/categories/development",
    "/tags/go",
    "/tags/vue",
  ])
    assert.ok(routes.includes(path));
  assert.equal(new Set(routes).size, routes.length);
});
test("reject private fields, duplicate slugs and executable HTML", () => {
  for (const mutate of [
    (s) => (s.admin = "secret"),
    (s) => (s.posts[0].markdown = "draft"),
    (s) => s.posts.push(s.posts[0]),
    (s) => (s.posts[0].html = '<img onerror="bad()">'),
    (s) => (s.posts[0].slug = "../admin"),
    (s) => (s.schema_version = 2),
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    assert.throws(() => validateSnapshot(value));
  }
});
test("empty snapshot is valid and still has index routes", () => {
  const value = { ...fixture, posts: [] };
  validateSnapshot(value);
  assert.deepEqual(publicRoutes(value), ["/", "/tags", "/page/1"]);
});
