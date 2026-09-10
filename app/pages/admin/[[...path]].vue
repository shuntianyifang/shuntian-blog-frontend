<script setup lang="ts">
import type { AdminPost, Draft } from "../../../shared/types";
definePageMeta({ key: "admin-workspace" });
const route = useRoute();
const user = ref(""),
  csrf = ref(""),
  username = ref(""),
  password = ref("");
const ready = ref(false),
  busy = ref(false),
  message = ref(""),
  error = ref(""),
  preview = ref(""),
  snapshotID = ref("");
const posts = ref<AdminPost[]>([]),
  offset = ref(0),
  activeID = ref(0);
const selected = ref<Record<number, number>>({});
const requestKey = ref("");
const emptyDraft = (): Draft => ({
  slug: "",
  title: "",
  summary: "",
  markdown: "",
  published_at: new Date().toISOString(),
  category: { slug: "development", name: "开发记录" },
  tags: [],
  base_revision_id: 0,
});
const form = ref<Draft>(emptyDraft());
const dateInput = computed({
  get: () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(form.value.published_at));
    const part = (type: string) =>
      parts.find((p) => p.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  },
  set: (date: string) => {
    if (date) form.value.published_at = `${date}T00:00:00+08:00`;
  },
});
async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
  extra: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`/api/v1/${path}`, {
    method,
    credentials: "same-origin",
    headers: {
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(csrf.value ? { "X-CSRF-Token": csrf.value } : {}),
      ...extra,
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      user.value = "";
      csrf.value = "";
      posts.value = [];
      selected.value = {};
      form.value = emptyDraft();
      preview.value = "";
    }
    const messages: Record<string, string> = {
      conflict:
        "文章已被其他窗口修改，或请求标识重复。请重新打开文章后再保存。",
      invalid_credentials: "用户名或密码不正确。",
      csrf_rejected: "会话验证失败，请刷新页面后重试。",
      rate_limited: "登录尝试过多，请五分钟后再试。",
      invalid_input: "请检查文章地址、标题、日期及分类标签。",
      unauthorized: "请先登录。",
    };
    throw new Error(
      messages[result.error?.code] || `操作失败（${response.status}）`,
    );
  }
  return result as T;
}
async function action(task: () => Promise<void>) {
  busy.value = true;
  error.value = "";
  message.value = "";
  try {
    await task();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "操作失败";
  } finally {
    busy.value = false;
  }
}
async function loadPosts() {
  posts.value = (
    await api<{ posts: AdminPost[] }>(`admin/posts?offset=${offset.value}`)
  ).posts;
}
async function openRoute() {
  const match = route.path.match(/^\/admin\/posts\/(\d+)\/?$/);
  if (match) {
    const post = await api<AdminPost>(`admin/posts/${match[1]}`);
    edit(post);
  } else {
    activeID.value = 0;
    form.value = emptyDraft();
    preview.value = "";
  }
}
function edit(post: AdminPost) {
  activeID.value = post.id;
  form.value = {
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    markdown: post.markdown,
    published_at: post.published_at,
    category: { ...post.category },
    tags: post.tags.map((t) => ({ ...t })),
    base_revision_id: post.revision_id,
  };
  preview.value = "";
}
async function login() {
  await action(async () => {
    const result = await api<{ username: string; csrf_token: string }>(
      "auth/login",
      "POST",
      { username: username.value, password: password.value },
    );
    password.value = "";
    user.value = result.username;
    csrf.value = result.csrf_token;
    await loadPosts();
    await openRoute();
  });
}
async function logout() {
  await action(async () => {
    await api("auth/logout", "POST", {});
    user.value = "";
    csrf.value = "";
    posts.value = [];
    selected.value = {};
    form.value = emptyDraft();
    preview.value = "";
    snapshotID.value = "";
    await navigateTo("/admin");
  });
}
async function save() {
  await action(async () => {
    const post = await api<AdminPost>(
      activeID.value ? `admin/posts/${activeID.value}` : "admin/posts",
      activeID.value ? "PATCH" : "POST",
      form.value,
    );
    edit(post);
    await loadPosts();
    await navigateTo(`/admin/posts/${post.id}`);
    message.value = "草稿已保存。公开快照未改变。";
  });
}
async function showPreview() {
  await action(async () => {
    preview.value = (
      await api<{ html: string }>(
        `admin/posts/${activeID.value}/preview`,
        "POST",
        { markdown: form.value.markdown },
      )
    ).html;
  });
}
function toggle(post: AdminPost, checked: boolean) {
  if (checked) selected.value[post.id] = post.revision_id;
  else delete selected.value[post.id];
  requestKey.value = "";
}
async function freeze() {
  await action(async () => {
    requestKey.value ||= crypto.randomUUID();
    const result = await api<{ snapshot_id: string }>(
      "admin/snapshots",
      "POST",
      {
        selections: Object.entries(selected.value).map(([id, revision]) => ({
          post_id: Number(id),
          revision_id: revision,
        })),
      },
      { "Idempotency-Key": requestKey.value },
    );
    snapshotID.value = result.snapshot_id;
    message.value = "快照已生成。可使用此编号在本地构建静态站点。";
  });
}
async function paginate(delta: number) {
  await action(async () => {
    offset.value = Math.max(0, offset.value + delta);
    await loadPosts();
  });
}
onMounted(async () => {
  try {
    const result = await api<{ username: string; csrf_token: string }>(
      "auth/me",
    );
    user.value = result.username;
    csrf.value = result.csrf_token;
    await loadPosts();
    await openRoute();
  } catch (e) {
    if (user.value) error.value = String(e);
  } finally {
    ready.value = true;
  }
});
watch(
  () => route.path,
  () => {
    if (user.value) void action(openRoute);
  },
);
useHead({
  title: "内容工作台 · 顺天的博客",
  meta: [{ name: "robots", content: "noindex,nofollow" }],
});
</script>
<template>
  <div class="admin-shell">
    <header class="site-header">
      <a href="/" class="brand">顺天<span>内容工作台</span></a
      ><button v-if="user" class="secondary" :disabled="busy" @click="logout">
        退出登录
      </button>
    </header>
    <p v-if="!ready">正在检查会话…</p>
    <form v-else-if="!user" class="login panel" @submit.prevent="login">
      <p class="eyebrow">WELCOME BACK</p>
      <h1>回到书桌前</h1>
      <p>登录后继续整理你的文字。</p>
      <label
        >用户名<input
          v-model="username"
          autocomplete="username"
          required
          maxlength="100" /></label
      ><label
        >密码<input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          maxlength="72" /></label
      ><button :disabled="busy">登录</button>
    </form>
    <template v-else>
      <div class="admin-title">
        <div>
          <p class="eyebrow">YOUR WRITING SPACE</p>
          <h1>文章与草稿</h1>
        </div>
        <NuxtLink class="button secondary" to="/admin">新建文章</NuxtLink>
      </div>
      <div class="workspace">
        <aside class="panel">
          <h2>文章列表</h2>
          <p class="hint">
            勾选要放入快照的已保存修订。每个快照包含本次选择的全部文章。
          </p>
          <div v-for="post in posts" :key="post.id" class="draft-row">
            <input
              :id="`select-${post.id}`"
              type="checkbox"
              :checked="selected[post.id] !== undefined"
              :aria-label="`选择 ${post.title}`"
              @change="
                toggle(post, ($event.target as HTMLInputElement).checked)
              "
            />
            <div>
              <NuxtLink :to="`/admin/posts/${post.id}`">{{
                post.title
              }}</NuxtLink
              ><small
                >草稿修订 {{ post.revision_id
                }}<span v-if="selected[post.id]">
                  · 已选 {{ selected[post.id] }}</span
                ></small
              >
            </div>
          </div>
          <p v-if="!posts.length" class="hint">写下第一篇文章吧。</p>
          <div class="actions">
            <button
              class="secondary"
              :disabled="busy || offset === 0"
              @click="paginate(-50)"
            >
              上一页</button
            ><button
              class="secondary"
              :disabled="busy || posts.length < 50"
              @click="paginate(50)"
            >
              下一页
            </button>
          </div>
          <hr />
          <p class="hint">
            已选
            {{
              Object.keys(selected).length
            }}
            篇。之后编辑草稿不会改变已生成的快照。
          </p>
          <button
            :disabled="busy || !Object.keys(selected).length"
            @click="freeze"
          >
            生成本地构建快照</button
          ><label v-if="snapshotID"
            >快照编号<input :value="snapshotID" readonly aria-label="快照编号"
          /></label>
        </aside>
        <section class="panel editor">
          <form @submit.prevent="save">
            <h2>{{ activeID ? "编辑文章" : "新建文章" }}</h2>
            <label
              >标题<input v-model="form.title" required maxlength="100"
            /></label>
            <div class="form-grid">
              <label
                >文章地址<input
                  v-model="form.slug"
                  :disabled="!!activeID"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  placeholder="my-first-post" /></label
              ><label
                >文章日期<input v-model="dateInput" type="date" required
              /></label>
            </div>
            <label
              >摘要<textarea v-model="form.summary" rows="2" maxlength="500" />
            </label>
            <div class="form-grid">
              <label
                >分类名称<input
                  v-model="form.category.name"
                  required
                  maxlength="30" /></label
              ><label
                >分类地址<input
                  v-model="form.category.slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
              /></label>
            </div>
            <fieldset>
              <legend>标签</legend>
              <div
                v-for="(tag, index) in form.tags"
                :key="index"
                class="form-grid tag-edit"
              >
                <label
                  >标签名称<input
                    v-model="tag.name"
                    required
                    maxlength="30" /></label
                ><label
                  >标签地址<input
                    v-model="tag.slug"
                    required
                    pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label
                ><button
                  type="button"
                  class="secondary"
                  @click="form.tags.splice(index, 1)"
                >
                  移除
                </button>
              </div>
              <button
                type="button"
                class="secondary"
                :disabled="form.tags.length >= 20"
                @click="form.tags.push({ slug: '', name: '' })"
              >
                添加标签
              </button>
            </fieldset>
            <label
              >Markdown 正文<textarea
                v-model="form.markdown"
                class="markdown"
                rows="14"
                maxlength="60000"
                placeholder="从这里开始写…"
              />
            </label>
            <div class="actions">
              <button :disabled="busy">保存草稿</button
              ><button
                type="button"
                class="secondary"
                :disabled="busy || !activeID"
                @click="showPreview"
              >
                预览</button
              ><small v-if="!activeID">首次保存后可预览</small>
            </div>
          </form>
          <section v-if="preview" class="preview">
            <h3>文章预览</h3>
            <div class="prose" v-html="preview" />
          </section>
        </section>
      </div>
    </template>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <p v-if="message" role="status" class="notice">{{ message }}</p>
  </div>
</template>
