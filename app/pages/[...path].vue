<script setup lang="ts">
import snapshot from "#content-snapshot";
import type { PublicPost } from "../../shared/types";
const route = useRoute();
const path = computed(() => route.path.replace(/\/$/, "") || "/");
const routes = useRuntimeConfig().public.contentRoutes;
const valid = computed(() => routes.includes(path.value));
if (!valid.value)
  throw createError({ statusCode: 404, statusMessage: "Not found" });
watch(valid, (value) => {
  if (!value) showError({ statusCode: 404, statusMessage: "Not found" });
});
const article = computed(() =>
  snapshot.posts.find((post) => path.value === `/posts/${post.slug}`),
);
const tags = [
  ...new Map(
    snapshot.posts.flatMap((post) => post.tags).map((tag) => [tag.slug, tag]),
  ).values(),
];
const category = computed(
  () =>
    snapshot.posts.find(
      (post) => path.value === `/categories/${post.category.slug}`,
    )?.category,
);
const tag = computed(() =>
  tags.find((tag) => path.value === `/tags/${tag.slug}`),
);
const page = computed(() =>
  path.value.startsWith("/page/") ? Number(path.value.split("/")[2]) : 1,
);
const isIndex = computed(
  () => path.value === "/" || path.value.startsWith("/page/"),
);
const posts = computed<PublicPost[]>(() =>
  category.value
    ? snapshot.posts.filter((p) => p.category.slug === category.value!.slug)
    : tag.value
      ? snapshot.posts.filter((p) =>
          p.tags.some((t) => t.slug === tag.value!.slug),
        )
      : snapshot.posts.slice(
          (page.value - 1) * snapshot.page_size,
          page.value * snapshot.page_size,
        ),
);
const title = computed(
  () =>
    article.value?.title ||
    category.value?.name ||
    tag.value?.name ||
    (path.value === "/tags" ? "标签" : "写下思考，留下足迹。"),
);
const pages = Math.max(
  1,
  Math.ceil(snapshot.posts.length / snapshot.page_size),
);
function date(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
  }).format(new Date(value));
}
useHead(() => ({
  title: `${article.value?.title || category.value?.name || tag.value?.name || "首页"} · ${snapshot.site_title}`,
  meta: [
    {
      name: "description",
      content: article.value?.summary || "关于开发、学习和生活的记录。",
    },
  ],
}));
</script>
<template>
  <div class="shell">
    <header class="site-header">
      <NuxtLink to="/" class="brand">顺天<span>的博客</span></NuxtLink>
      <nav>
        <NuxtLink to="/">文章</NuxtLink><NuxtLink to="/tags">标签</NuxtLink
        ><a href="/admin">管理</a>
      </nav>
    </header>
    <main>
      <section class="hero">
        <p class="eyebrow">NOTES ON BUILDING & LIVING</p>
        <h1>{{ title }}</h1>
        <p v-if="isIndex" class="intro">
          关于开发、学习，以及生活中值得记下的小事。
        </p>
        <p v-if="article" class="meta">
          {{ date(article.published_at) }} ·
          <NuxtLink :to="`/categories/${article.category.slug}`">{{
            article.category.name
          }}</NuxtLink>
        </p>
      </section>
      <article v-if="article" class="prose" v-html="article.html" />
      <div v-else-if="path === '/tags'" class="tag-cloud">
        <NuxtLink
          v-for="item in tags"
          :key="item.slug"
          :to="`/tags/${item.slug}`"
          class="pill"
          >{{ item.name }}</NuxtLink
        >
        <p v-if="!tags.length">暂时没有标签。</p>
      </div>
      <section v-else class="post-list">
        <article v-for="post in posts" :key="post.slug" class="post-card">
          <div class="meta">
            {{ date(post.published_at) }}
            <span> / {{ post.category.name }}</span>
          </div>
          <h2>
            <NuxtLink :to="`/posts/${post.slug}`">{{ post.title }}</NuxtLink>
          </h2>
          <p>{{ post.summary }}</p>
          <div class="tags">
            <NuxtLink
              v-for="item in post.tags"
              :key="item.slug"
              :to="`/tags/${item.slug}`"
              ># {{ item.name }}</NuxtLink
            >
          </div>
        </article>
        <p v-if="!posts.length">还没有公开文章。</p>
      </section>
      <nav v-if="isIndex && pages > 1" class="pagination" aria-label="分页">
        <NuxtLink
          v-for="n in pages"
          :key="n"
          :to="`/page/${n}`"
          :aria-current="n === page ? 'page' : undefined"
          >{{ n }}</NuxtLink
        >
      </nav>
    </main>
    <footer>
      慢慢写，慢慢生长。<span>{{ snapshot.site_title }}</span>
    </footer>
  </div>
</template>
