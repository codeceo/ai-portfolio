# AI 个人作品集

统一的个人 AI 产品展厅：展示、分类、介绍与链接 AI 创作的网站、效率工具、自动化工作流、视觉与交互实验。后台表单驱动，无须改前端代码即可新增作品。

> 上线与 Supabase 配置请看 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)（环境变量、
> 迁移顺序、Storage 与 RLS、首次创建管理员、上线清单）；数据库与安全
> 专项审查见 [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md)。

## 本地运行（演示模式，无需 Supabase）
```bash
npm install
npm run dev
# 打开 http://localhost:3000
```
未配置 Supabase 时页面顶部会显示“演示模式”提示，数据保存在 `data/works.json`，后台操作刷新后仍保留。

演示后台登录（**仅限本地演示，不是生产认证**）：
- 地址：`/admin/login`
- 账号：`admin@demo.local`
- 密码：`demo1234`

## 从后台新增作品（无需改代码）
1. 打开 `/admin/login` 登录。
2. 「新建作品」填写标题、别名、简介、分类、标签、封面（先用上方上传区上传图片，复制 URL 填入，或直接填图片 URL）、体验链接。
3. 状态选「已发布」保存 → 公开页 `/works` 与首页即出现；选「草稿」则不展示。
4. 作品列表里可发布 / 下架 / 重新上架、设精选、改排序、编辑、删除；「分类管理」可新增/删除分类。

## Supabase 配置（生产模式）
1. 在 Supabase 新建项目。
2. SQL Editor 中依次运行迁移（顺序不能乱，都是增量式）：
   - `supabase/migrations/001_init.sql`（建表、RLS、触发器、种子分类）
   - `supabase/migrations/002_highlights.sql`（新增可选的 highlights 亮点字段）
   - `supabase/migrations/003_admin_and_fields.sql`（新增 source_url、external_links、published_at、started_at、SEO 字段；新建 `public.admins` 管理员白名单；把 001 的“任何已登录用户可写”策略替换为白名单策略）
   - `supabase/migrations/004_indexes_and_checks.sql`（与真实查询匹配的索引：status、status+sort_order、status+created_at、status+category、已发布+精选部分索引、tags GIN 索引；external_links 必须是数组的 NOT VALID 约束；见文件头部的分类/标签设计说明）
3. Storage 新建公开桶 `portfolio-images`，并按迁移文件末尾注释配置 storage.objects 策略（公开读、管理员白名单写）。
4. Auth 设置：**关闭公开注册（Enable email signups OFF）**，在 Authentication > Users 中邀请/创建唯一的管理员账号；**禁止公开注册成为管理员**——后台没有任何注册入口。邀请完成后，在 SQL Editor 里把该管理员加入白名单（把 `<uuid>` 换成 Users 表里该账号的 UUID）：
   ```sql
   insert into public.admins (user_id, email)
   values ('<uuid>', 'admin@example.com');
   ```
   只有白名单里的账号才能通过 `/admin/login` 后台与服务端写入；已登录但不在白名单的账号会被拒绝。
5. 复制 `.env.example` 为 `.env.local`，填入：
   ```
   NEXT_PUBLIC_SUPABASE_URL=你的项目 URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon key
   NEXT_PUBLIC_SITE_URL=你的生产域名（用于详情页 canonical、Open Graph 与 sitemap；未设置时默认占位域名）
   ```
   不要把 service-role key 放进浏览器代码或提交到仓库。
6. 重新运行 `npm run dev`，顶部演示提示消失即为 Supabase 模式；用邀请的管理员账号在 `/admin/login` 登录。

## 部署到 Vercel
1. 把代码推送到 Git 仓库（不要提交 `.env.local`）。
2. Vercel 导入该仓库，Framework 选择 Next.js。
3. 在 Vercel 环境变量中设置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
4. 部署后访问域名，检查首页、`/works`、作品详情与 `/admin`。

## 后台功能说明
- **认证与保护**：`/admin/*`（登录页除外）由中间件 + 管理后台布局 + 每个服务端写入操作三层检查；未登录访问后台会跳转到 `/admin/login`。Supabase 模式要求会话 + `public.admins` 白名单；登录失败只显示“邮箱或密码错误，请重试”，不泄露邮箱是否存在；退出登录会清除演示 Cookie 与 Supabase 会话。
- **仪表盘**：作品总数、已发布、草稿、已下架、精选均来自数据层实时统计；快捷入口有新建作品、查看公开网站、查看全部作品、最近更新（按更新时间倒序前 5 条）。
- **作品列表**：封面缩略图、标题、分类名、状态、精选、创建/更新时间、排序值；支持标题搜索、状态筛选、分类筛选、按更新时间排序；每行可编辑、预览（新标签打开公开详情）、发布、下架、重新上架、删除；删除用弹窗二次确认，下架不删除记录。
- **批量操作**：勾选后可批量下架或批量删除，弹窗会列出件数与标题；每件单独执行并上报成功/失败，部分失败不会静默当作全部成功。
- **表单**：分基本信息 / 作品媒体 / 作品链接 / 展示设置 / SEO 五节；字段级错误、长度计数、slug 自动生成（手动改动后停止自动生成）与“检查可用性”、保存草稿 / 发布作品 / 取消（有未保存更改时提醒）、保存失败后表单内容保留；首次发布自动记录 `published_at`，后续编辑与重新上架不重置；精选作品必须是已发布作品，否则保存会报错。
- **图片**：仅管理员可用上传接口（`/api/admin/upload`，未登录返回 401）；只接受 JPEG、PNG、WebP、GIF、AVIF，单张 ≤5MB，文件名带时间戳与随机串不覆盖他人图片，上传用 XHR 显示真实进度；删除作品时只清理不被其他作品引用的文件，被共享的文件会保留。
- **缓存**：首页为 force-dynamic、作品列表与详情页为动态渲染，发布、下架、重新上架、删除、创建、更新还会刷新 `/`、`/works` 与对应详情页；草稿与已下架作品公开页仍返回 404 页面。

## 验证
```bash
npm install
npx tsc --noEmit
npm run build
npm run start   # 然后访问 / /works /about /works/ai-portfolio-site
```

## 后台验收（演示模式）
```bash
npm run build
node scripts/acceptance-demo.mjs   # 自行启动 3100 端口生产服务器，跑完 12 步后清理测试数据并恢复 data/*.json
node --import ./scripts/acceptance-loader.mjs scripts/security-check.mts   # 数据库与安全专项检查（演示模式）：危险协议 URL、图片魔数嗅探、下架全路径不可见、重新上架 published_at 不变、共享文件不误删、分类删除拦截、密钥与迁移文件检查；27 项
```
验收覆盖：未登录访问后台跳转登录、未登录上传被拒、演示 Cookie 上传成功、创建草稿、编辑并设置封面、发布、公开首页/列表/详情出现、下架后公开页消失且详情正文不泄露标题、重新上架且首次发布时间不重置、重启服务器后数据仍在、删除与共享文件清理保护。浏览器点击流程未用自动化驱动（本环境无浏览器自动化），表单的服务器动作路径通过同一数据层与共享规则函数验证，详见脚本注释。

## Supabase live verification still pending（尚未实测，勿宣称已连通）
本环境不存在任何 Supabase 凭据，因此以下内容**未在真实 Supabase 上验证**，只完成了代码与迁移文件，需要用户配置后复测：Supabase Auth 登录 + 白名单检查、Storage 上传与清理、RLS 白名单策略、Vercel 部署。演示模式是目前唯一已验证的模式。

## 未连接说明
本仓库默认不含任何真实 Supabase 凭据。未配置环境变量时即为演示模式，**不要宣称数据库已连接**。
