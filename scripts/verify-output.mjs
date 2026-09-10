import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { publicRoutes } from "../shared/snapshot.mjs";
export async function verifyOutput(
  snapshot,
  denied = [],
  root = ".output/public",
) {
  for (const route of [...publicRoutes(snapshot), "/admin"]) {
    const html = await readFile(join(root, route, "index.html"), "utf8");
    if (!html.includes("<html")) throw new Error(`Missing HTML: ${route}`);
    const post = snapshot.posts.find((post) => route === `/posts/${post.slug}`);
    if (post && !html.includes(post.html.trim()))
      throw new Error(`Article body missing: ${route}`);
  }
  const fallback = await readFile(join(root, "404.html"), "utf8");
  if (!fallback.includes("<html")) throw new Error("Missing 404 HTML");
  async function scan(dir) {
    for (const item of await readdir(dir, { withFileTypes: true })) {
      const file = join(dir, item.name);
      if (item.isDirectory()) await scan(file);
      else {
        const body = await readFile(file);
        for (const marker of denied)
          if (body.includes(Buffer.from(marker)))
            throw new Error(`Sensitive marker found in ${file}`);
      }
    }
  }
  await scan(root);
}
