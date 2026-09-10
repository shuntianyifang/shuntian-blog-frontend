import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { validateSnapshot } from "../shared/snapshot.mjs";
import { verifyOutput } from "./verify-output.mjs";

try {
  let value;
  if (process.argv.includes("--fixture"))
    value = JSON.parse(
      await readFile(
        new URL("../fixtures/snapshot.json", import.meta.url),
        "utf8",
      ),
    );
  else if (process.env.SNAPSHOT_FILE)
    value = JSON.parse(
      (await readFile(process.env.SNAPSHOT_FILE, "utf8")).replace(
        /^\uFEFF/,
        "",
      ),
    );
  else {
    const { BUILD_API_URL, SNAPSHOT_ID, BUILD_TOKEN } = process.env;
    if (!BUILD_API_URL || !SNAPSHOT_ID || !BUILD_TOKEN)
      throw new Error(
        "Set SNAPSHOT_FILE or BUILD_API_URL, SNAPSHOT_ID and BUILD_TOKEN; use --fixture only for fixture checks.",
      );
    const base = new URL(BUILD_API_URL);
    if (
      base.username ||
      base.password ||
      !(
        base.protocol === "https:" ||
        (base.protocol === "http:" &&
          ["127.0.0.1", "[::1]"].includes(base.hostname))
      )
    )
      throw new Error("Build API requires HTTPS or loopback HTTP");
    const response = await fetch(
      new URL(
        `/api/v1/build/snapshots/${encodeURIComponent(SNAPSHOT_ID)}`,
        base,
      ),
      {
        headers: { Authorization: `Bearer ${BUILD_TOKEN}` },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw new Error(`Snapshot download failed (${response.status})`);
    value = await response.json();
  }
  const snapshot = validateSnapshot(value);
  await mkdir(".generated", { recursive: true });
  const file = resolve(".generated/snapshot.json");
  await writeFile(file, JSON.stringify(snapshot));
  const env = { ...process.env, NUXT_SNAPSHOT_FILE: file };
  // The bundler receives only the public snapshot, never the build credential.
  for (const key of Object.keys(env))
    if (/TOKEN|PASSWORD|DATABASE_URL|DENY_MARKERS/.test(key)) delete env[key];
  delete env.BUILD_API_URL;
  const result = spawnSync(
    process.execPath,
    ["node_modules/nuxt/bin/nuxt.mjs", "generate"],
    { stdio: "inherit", env },
  );
  if (result.status !== 0) throw new Error("Nuxt static generation failed");
  await verifyOutput(
    snapshot,
    [
      process.env.BUILD_TOKEN,
      ...(process.env.DENY_MARKERS || "").split(","),
    ].filter(Boolean),
  );
  console.log(
    `Verified snapshot ${snapshot.id}: ${snapshot.posts.length} public posts.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Build failed");
  process.exit(1);
}
