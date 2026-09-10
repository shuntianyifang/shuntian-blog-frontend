# Shuntian Blog Frontend

新博客前端，已完成第一轮本地原型及真实浏览器验收：公开文章 SSG、CSR 后台登录/编辑/预览/快照选择。尚无 CI、生产部署、媒体上传、完整主题、RSS 或搜索。

## 技术与数据

采用 Nuxt + Vue + TypeScript。公开文章通过 SSG 生成完整 HTML；/admin 使用 CSR 调用独立 Go 后端。PostgreSQL 是权威内容来源，构建通过 Go 获取固定快照，不需要克隆文章仓库。

## 运行与验证

版本锁定：Node 22.20.0、pnpm 10.18.3、Nuxt 4.5.2、Vue 3.5.42、Vue Router 5.3.1、TypeScript 5.9.3。依赖及锁文件独立维护；以下从本仓库根目录执行。

```powershell
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm generate:fixture
```

默认开发页面使用 fixtures/snapshot.json，开发服务监听回环地址，/api/ 代理到 127.0.0.1:8080。后端 PUBLIC_ORIGIN 必须匹配浏览器 origin（开发时通常为 http://127.0.0.1:3000）。前端自身的类型、契约及夹具生成测试不需要相邻后端目录。

真实生成可设置 SNAPSHOT_FILE 指向已导出的 v1 公开快照，再运行 `pnpm generate`；或设置 BUILD_API_URL、SNAPSHOT_ID、BUILD_TOKEN 从 Go 只下载一次快照。缺少配置、校验失败或必要页面失败时停止，不自动退回夹具。凭据不要写到命令历史、代码或客户端配置；构建子进程会移除 token/password/database 环境变量。

输出在 `.output/public`，构建输入在 `.generated/snapshot.json`，均被 Git 忽略。显式生成文章、分类、标签、分页和 /admin，生成后核对正文及 404。可通过 DENY_MARKERS（逗号分隔）扫描额外测试标记；构建 token 自动加入扫描。

## 本地 Nginx 与浏览器验收

使用独立 Nginx 可执行文件。Windows 官方来源为 [Nginx 下载页](https://nginx.org/en/download.html)，本轮验证 1.30.4；本仓库不下载或安装系统服务。

```powershell
./scripts/nginx.ps1 check -Nginx 'C:/tools/nginx/nginx.exe'
./scripts/nginx.ps1 start -Nginx 'C:/tools/nginx/nginx.exe'
# 使用完毕
./scripts/nginx.ps1 stop -Nginx 'C:/tools/nginx/nginx.exe'
```

先生成页面再启动。默认 http://127.0.0.1:8081，API 转发到 8080；可用 -Port/-ApiPort 更改。配置、日志、PID、临时文件均在本仓库 `.local/nginx`。只给 /admin 深层路由回退；公开不存在页面返回 HTTP 404。此脚本仅供本地验收，不承担生产原子部署。

真实浏览器验收要求：专用开发 API 已运行、随机演示管理员已创建、Nginx 已启动。明确传入后端配置和管理员文件路径，不硬编码相邻目录：

```powershell
./scripts/acceptance.ps1 -BackendEnv 'C:/your/backend/.local/dev.env' -AdminFile 'C:/your/backend/.local/demo-admin.json'
```

默认使用本机 Chrome，可用 -BrowserPath 指定其他 Chromium 可执行文件。也可安装 Playwright Chromium 后直接使用 `pnpm test:browser`，但必须安全设置 E2E_ADMIN_FILE、E2E_BUILD_TOKEN、E2E_BASE_URL。

验收通过浏览器创建文章，另造分页测试数据，选定七篇生成快照，再保存含唯一私有标记的新草稿，验证公开构建不变。测试读取真实 Go 快照并重新生成当前本地站点；请使用专门的本地开发数据。截图和结果保存到 `.local/`，不记录密码或 token；每次运行追加少量测试文章，不自动删除数据。

API 契约由后端 docs/API.md 维护；本仓库 shared/types.ts、shared/snapshot.mjs 和 fixtures/snapshot.json 是可独立运行的 v1 消费方契约。后台界面显示已保存/快照已生成，不显示上线。

## 发布

未来流程：后台发布 → Go 保存快照 → GitHub Actions 构建 → 上传新版本 → 切换静态站点。当前只完成本地快照与构建；发布任务、失败保留旧站、乱序保护和回滚尚待实现与验收。VPS 无需常驻 Node。

Nginx 需要将 /api/ 转发给 Go，将 /admin 深层链接回退到管理入口；不存在的公开文章返回 404。后台显示“已保存”不代表文章已上线。

## 协作

参见 [AGENTS.md](AGENTS.md)。本项目独立私有仓库为 [shuntian-blog-frontend](https://github.com/shuntianyifang/shuntian-blog-frontend)，默认分支 main；后端仓库为 [shuntian-blog-backend](https://github.com/shuntianyifang/shuntian-blog-backend)。文章归档仓库 shuntian-blog-content 仍为规划，不在本次建仓范围。接口版本与部署须兼容，不能假设前后端同时上线。

## 版权与复用

本项目作者的原创代码、文章、图片和文档暂未授予开源或内容复用许可。未经作者明确许可，不授权他人复制、修改、转载、再分发或商业使用；依法允许的使用除外。第三方代码、引用和素材遵循各自原有许可，本说明不撤销或覆盖第三方已授予的权利。暂不新增 LICENSE，也不将项目标记为 MIT、Apache 或 Creative Commons 等许可。
