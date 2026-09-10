<script setup lang="ts">
defineProps<{ error: { statusCode: number } }>();
</script>
<template>
  <main class="shell">
    <p class="eyebrow">SHUNTIAN / BLOG</p>
    <h1>
      {{ error.statusCode === 404 ? "这页还没有故事" : "页面暂时无法显示" }}
    </h1>
    <p>请检查地址，或回到首页继续阅读。</p>
    <a href="/">返回首页</a>
  </main>
</template>
