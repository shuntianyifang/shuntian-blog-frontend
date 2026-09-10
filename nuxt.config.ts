import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateSnapshot, publicRoutes } from "./shared/snapshot.mjs";

const snapshotFile =
  process.env.NUXT_SNAPSHOT_FILE ||
  fileURLToPath(new URL("./fixtures/snapshot.json", import.meta.url));
const snapshot = validateSnapshot(
  JSON.parse(readFileSync(snapshotFile, "utf8").replace(/^\uFEFF/, "")),
);

export default defineNuxtConfig({
  compatibilityDate: "2026-09-10",
  devtools: { enabled: false },
  ssr: true,
  css: ["~/assets/main.css"],
  alias: { "#content-snapshot": snapshotFile },
  runtimeConfig: { public: { contentRoutes: publicRoutes(snapshot) } },
  app: { head: { htmlAttrs: { lang: "zh-CN" }, title: snapshot.site_title } },
  routeRules: { "/admin": { ssr: false }, "/admin/**": { ssr: false } },
  nitro: {
    prerender: {
      crawlLinks: false,
      failOnError: true,
      routes: [...publicRoutes(snapshot), "/admin"],
    },
    devProxy: {
      "/api/": { target: "http://127.0.0.1:8080/api/", changeOrigin: false },
    },
  },
  typescript: { strict: true },
});
