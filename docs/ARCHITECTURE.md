# 架构规划

## 目录结构
```
ai-portfolio/
  app/            # App Router：layout, page, works/, works/[slug]/, about/, not-found.tsx, admin/
  app/admin/      # login, dashboard, works/, works/new, works/[id]/edit, categories
  components/     # Header, Footer, WorkCard, WorkGrid, FilterBar, EmptyState,
                  # WorkForm, AdminRowActions, AdminNav, CategoryForm, CategoryRowActions,
                  # DemoLoginForm, SupabaseLoginForm
  lib/            # types.ts, validation.ts (zod), utils.ts, auth.ts, admin-actions.ts (Server Actions)
  lib/data/       # repository.ts (factory), demo-repo.ts, supabase-repo.ts, seed.ts
  lib/supabase/   # client.ts (browser, anon key only), server.ts (ssr + cookies)
  data/           # works.json, categories.json — 仅演示模式的本地持久化存储（服务端读写）
  public/covers/  # 种子封面 SVG；public/uploads/ 演示模式上传目录
  supabase/migrations/001_init.sql
  docs/ARCHITECTURE.md, README.md
```

## 数据流
- 公共页（Server Components）→ `getRepository()` → 仓库 → 渲染。展示组件不直接写死作品，也不直接读 JSON。
- 后台表单 → zod 校验 → Server Action（`requireAdmin()`）→ 仓库写入 → `revalidatePath` 刷新公开页。
- 图片：演示模式写 `public/uploads/`；Supabase 模式写 Storage 桶 `portfolio-images`，返回公开 URL。

## 数据库设计（Supabase PostgreSQL）
- `works`: id uuid PK, slug unique, title, summary, description, category text,
  tags text[], cover_image_url, gallery_images text[], demo_url, repo_url,
  status draft|published|archived, featured bool, sort_order int,
  created_at, updated_at（触发器自动更新）。
- `categories`: id uuid PK, name, slug unique, description, sort_order, created_at。
- 演示模式的 JSON 字段与上述字段一一对应。

## RLS 与权限
- 启用 RLS。anon 只能 SELECT `status='published'` 的 works 和全部 categories。
- 只有 authenticated 角色可写 works/categories。**必须在 Supabase Auth 设置中关闭公开注册**，只通过邀请创建管理员账号；否则任何注册用户都可写。
- Storage：`portfolio-images` 公开桶，公开读；authenticated 可上传/更新/删除。
- 绝不在浏览器代码中使用 service-role key；浏览器只用 anon key。

## 认证流程
- 演示模式：Server Action 校验本地演示账号，设置 httpOnly Cookie `ai-portfolio-demo-admin=1`；`isAdmin()` 读 Cookie。
- Supabase 模式：登录页用浏览器 Supabase 客户端 `signInWithPassword`；服务端用 `@supabase/ssr` + cookies 校验 `auth.getUser()`；退出时清除 Cookie 并 `signOut()`。

## 演示模式 vs Supabase 模式
- 判断：`NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 同时存在 → Supabase，否则演示。
- 选择点只在 `lib/data/repository.ts` 的 `getRepository()` 工厂里，页面与组件不感知模式。
- 演示数据持久化：服务端 `data/works.json` / `data/categories.json`，首次读取缺失时由 `lib/data/seed.ts` 播种；后台增删改会写回文件，刷新后保留。
- 演示登录不是生产认证：仅用于本地体验，生产务必配置 Supabase 并关闭公开注册。

## 设计
深色优先；墨黑/深灰/雾白/低饱和蓝紫；玻璃材质只用于导航、筛选、浮动控件与提示层（`.glass` 类：backdrop-filter + 半透明 + 柔和边框/高光/阴影），作品卡片本身为低对比实色面，避免全站玻璃卡片化；背景为低强度渐变光晕，无霓虹与粒子；动画克制并遵循 `prefers-reduced-motion`。
