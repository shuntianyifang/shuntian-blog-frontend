import { test, expect } from "@playwright/test";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { publicRoutes, validateSnapshot } from "../../shared/snapshot.mjs";

test("real administrator → immutable snapshot → static HTML through Nginx", async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  const credentialFile = process.env.E2E_ADMIN_FILE;
  const buildToken = process.env.E2E_BUILD_TOKEN;
  if (!credentialFile || !buildToken)
    throw new Error(
      "E2E_ADMIN_FILE and E2E_BUILD_TOKEN are required for real acceptance; no mock fallback.",
    );
  const credentials = JSON.parse(
    (await readFile(credentialFile, "utf8")).replace(/^\uFEFF/, ""),
  );
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  const initial = await page.goto("/admin/posts/1");
  expect(initial?.status()).toBe(200);
  await page.getByLabel("用户名", { exact: true }).fill(credentials.username);
  await page.getByLabel("密码", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "文章与草稿" })).toBeVisible();
  await page.getByRole("link", { name: "新建文章", exact: true }).click();
  const suffix = Date.now().toString(36);
  const title = `本地闭环验收 ${suffix}`;
  const slug = `acceptance-${suffix}`;
  const publicBody = `PUBLIC-BODY-${suffix}`;
  const privateMarker = `PRIVATE-DRAFT-${suffix}`;
  await page.getByLabel("标题", { exact: true }).fill(title);
  await page.getByLabel("文章地址", { exact: true }).fill(slug);
  await page.getByLabel("文章日期", { exact: true }).fill("2026-09-10");
  await page
    .getByLabel("摘要", { exact: true })
    .fill("从后台保存，经固定快照生成的真实数据库文章。");
  await page.getByRole("button", { name: "添加标签" }).click();
  await page.getByLabel("标签名称", { exact: true }).fill("Go");
  await page.getByLabel("标签地址", { exact: true }).fill("go");
  await page
    .getByLabel("Markdown 正文", { exact: true })
    .fill(
      `## 第一轮已经走通\n\n${publicBody}\n\n这是来自 PostgreSQL 的公开正文。\n\n\`\`\`go\nfmt.Println("hello")\n\`\`\`\n`,
    );
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  const primaryID = Number(page.url().split("/").pop());
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.locator(".preview")).toContainText(publicBody);
  await page.reload();
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("文章日期", { exact: true })).toHaveValue(
    "2026-09-10",
  );
  const me = await page.request.get("/api/v1/auth/me");
  const { csrf_token: csrf } = await me.json();
  const headers = { Origin: baseURL!, "X-CSRF-Token": csrf };
  const primary = await (
    await page.request.get(`/api/v1/admin/posts/${primaryID}`)
  ).json();
  // More than one page, two categories and two tags; all are disposable test articles.
  const extraTitles: string[] = [];
  for (let i = 0; i < 6; i++) {
    const extraTitle = `分页验收 ${suffix} ${i + 1}`;
    extraTitles.push(extraTitle);
    const response = await page.request.post("/api/v1/admin/posts", {
      headers,
      data: {
        slug: `page-${suffix}-${i + 1}`,
        title: extraTitle,
        summary: "分页与路由清单验收。",
        markdown: `公开分页正文 ${i + 1}`,
        published_at: new Date(Date.now() - 86400000 * (i + 1)).toISOString(),
        category: { slug: "notes", name: "随记" },
        tags: [{ slug: "vue", name: "Vue" }],
        base_revision_id: 0,
      },
    });
    expect(response.status()).toBe(201);
  }
  const draftResponse = await page.request.post("/api/v1/admin/posts", {
    headers,
    data: {
      slug: `private-${suffix}`,
      title: `未公开草稿 ${suffix}`,
      summary: privateMarker,
      markdown: privateMarker,
      published_at: new Date().toISOString(),
      category: { slug: "notes", name: "随记" },
      tags: [],
      base_revision_id: 0,
    },
  });
  expect(draftResponse.status()).toBe(201);
  await page.reload();
  await expect(page.getByLabel(`选择 ${title}`, { exact: true })).toBeVisible();
  for (const selectedTitle of [title, ...extraTitles])
    await page.getByLabel(`选择 ${selectedTitle}`, { exact: true }).check();
  await page
    .getByRole("button", { name: "生成本地构建快照", exact: true })
    .click();
  const snapshotField = page.getByLabel("快照编号", { exact: true });
  await expect(snapshotField).toBeVisible();
  const snapshotID = await snapshotField.inputValue();
  await page
    .getByRole("button", { name: "生成本地构建快照", exact: true })
    .click();
  await expect(snapshotField).toHaveValue(snapshotID);
  // A subsequent edit stays private while the old snapshot remains immutable.
  await page.getByLabel("Markdown 正文", { exact: true }).fill(privateMarker);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("草稿已保存");
  const conflict = await page.request.patch(
    `/api/v1/admin/posts/${primaryID}`,
    {
      headers,
      data: {
        slug: primary.slug,
        title: primary.title,
        summary: primary.summary,
        markdown: "stale editor",
        published_at: primary.published_at,
        category: primary.category,
        tags: primary.tags,
        base_revision_id: primary.revision_id,
      },
    },
  );
  expect(conflict.status()).toBe(409);
  await mkdir(".local", { recursive: true });
  await page.screenshot({
    path: ".local/admin-acceptance.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
  expect((await page.request.get("/api/v1/admin/posts")).status()).toBe(401);
  const deny = [privateMarker, credentials.password, buildToken, csrf];
  execFileSync(process.execPath, ["scripts/generate.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BUILD_API_URL: baseURL,
      SNAPSHOT_ID: snapshotID,
      BUILD_TOKEN: buildToken,
      DENY_MARKERS: deny.join(","),
    },
    stdio: "pipe",
    timeout: 120000,
  });
  const snapshot = validateSnapshot(
    JSON.parse(await readFile(".generated/snapshot.json", "utf8")),
  );
  expect(snapshot.posts).toHaveLength(7);
  for (const route of publicRoutes(snapshot))
    expect((await page.request.get(route)).status(), route).toBe(200);
  expect((await page.request.get(`/posts/private-${suffix}`)).status()).toBe(
    404,
  );
  expect((await page.request.get("/does-not-exist")).status()).toBe(404);
  expect((await page.request.get("/page/999")).status()).toBe(404);
  expect((await page.request.get("/api/health/ready")).status()).toBe(200);
  const noJS = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const reader = await noJS.newPage();
  await reader.goto(`/posts/${slug}`);
  await expect(reader.locator(".prose")).toContainText(publicBody);
  await expect(reader.locator("body")).not.toContainText(privateMarker);
  await reader.screenshot({ path: ".local/article-no-js.png", fullPage: true });
  await noJS.close();
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "写下思考，留下足迹。" }),
  ).toBeVisible();
  await page.screenshot({ path: ".local/home-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: ".local/home-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.locator(".prose")).toContainText(publicBody);
  const scriptURLs = await page
    .locator("script[src]")
    .evaluateAll((elements) =>
      elements.map((element) => (element as HTMLScriptElement).src),
    );
  for (const resource of scriptURLs)
    expect((await page.request.get(resource)).status()).toBe(200);
  const deep = await page.goto(`/admin/posts/${primaryID}`);
  expect(deep?.status()).toBe(200);
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(
    ".local/acceptance.json",
    JSON.stringify(
      {
        snapshot_id: snapshotID,
        article_path: `/posts/${slug}`,
        routes: publicRoutes(snapshot),
        public_posts: 7,
        checked_at: new Date().toISOString(),
        checks: [
          "browser login/edit/save/preview/logout",
          "real PostgreSQL snapshot",
          "revision conflict",
          "idempotency",
          "private marker and credential scan",
          "all explicit routes",
          "HTTP 404",
          "admin deep links",
          "JavaScript-disabled body",
          "mobile overflow",
          "static scripts",
          "no browser errors",
        ],
      },
      null,
      2,
    ),
  );
});
