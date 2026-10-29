# 部署指南

> 本文件是上线与 Supabase 配置的唯一权威步骤。安全方面的完整审查见
> [docs/SECURITY_REVIEW.md](./SECURITY_REVIEW.md)。
> **不要宣称网站已部署或 Supabase 已连通，除非你已按下面步骤实际完成并验证。**
> 本环境没有 Supabase 凭据，因此演示模式是唯一已验证的模式。

## 环境变量清单

只用这 3 个变量。**没有任何地方使用 service-role key**，不要添加它——
它会绕过全部 RLS，一旦进入浏览器包或日志即构成泄露。

| 变量 | 必填 | 用途 | 读取位置 |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 生产必填；留空 = 演示模式 | Supabase 项目 URL（REST + Auth + Storage） | `lib/supabase/client.ts`、`lib/supabase/server.ts`、`lib/data/repository.ts`（模式判断） |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 生产必填；留空 = 演示模式 | Supabase anon（公开）key；仅因 RLS + `public.admins` 白名单才可安全进浏览器 | `lib/supabase/client.ts`（浏览器登录）、`lib/supabase/server.ts`（服务端会话） |
| `NEXT_PUBLIC_SITE_URL` | 可选，但上线前必须设真实域名 | canonical 域名，用于元数据、Open Graph、sitemap、robots | `lib/site.ts` 的 `siteUrl()`；未设置时回退到占位域名 `https://ai-lab.example`（仅本地演示正确） |

`.env.example` 里每个变量都有同样的注释说明；复制为 `.env.local` 后填写，
不要提交 `.env.local`（`.gitignore` 已覆盖）。

## 1. 本地运行步骤

```bash
cd ai-portfolio
npm install
# 演示模式：不需要任何环境变量，直接运行
npm run dev
# 打开 http://localhost:3000
```

- 未配置 Supabase 时页面顶部显示黄色“演示模式”提示，数据保存在
  `data/works.json`，刷新后仍保留。
- 演示后台登录（**仅限本地演示，不是生产认证**）：
  地址 `/admin/login`，账号 `admin@demo.local`，密码 `demo1234`。
- 生产构建验证：
  ```bash
  npm run typecheck
  npm run build
  npm run start   # 然后访问 / /works /about /works/ai-portfolio-site
  ```
- 自动化验收（演示模式，跑完清理测试数据并恢复 `data/*.json`）：
  ```bash
  node scripts/acceptance-demo.mjs
  node --import ./scripts/acceptance-loader.mjs scripts/security-check.mts
  ```

## 2. 生产部署步骤（Vercel）

1. 把代码推送到 Git 仓库，**不要提交 `.env.local`**。
2. Vercel 导入该仓库，Framework 选择 Next.js，构建命令默认
   `npm run build`（不要改成跳过类型检查的命令）。
3. 在 Vercel → Project → Settings → Environment Variables 中设置上面 3 个
   变量（`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、
   `NEXT_PUBLIC_SITE_URL` = 真实域名）。不要添加 service-role key。
4. 部署后逐项验证：
   - 首页、`/works`、一篇已发布作品详情、`/about` 正常打开；
   - 顶部**没有**演示模式提示（有提示 = 环境变量未生效，仍在演示模式）；
   - `/admin` 未登录时跳转到 `/admin/login`；
   - `/sitemap.xml` 只含已发布作品，`/robots.txt` 禁止 `/admin`；
   - 用第 4 节的管理员账号登录后台，走一遍“新建草稿 → 发布 →
     公开页出现 → 下架 → 公开页消失 → 重新上架”的完整流程。
5. 只有上面全部通过，才可以对外说“已部署”。部署成功不等于 Supabase
   已验证——Supabase 部分必须单独按第 3 节完成并复测。

## 3. Supabase 配置步骤（按顺序，不可跳步）

1. 在 Supabase 新建项目。
2. SQL Editor 中依次运行迁移（顺序不能乱，都是增量式）：
   - `supabase/migrations/001_init.sql`（建表、RLS、触发器、种子分类）
   - `supabase/migrations/002_highlights.sql`（highlights 亮点字段）
   - `supabase/migrations/003_admin_and_fields.sql`（source_url、
     external_links、published_at、started_at、SEO 字段；`public.admins`
     白名单；把 001 的“任何已登录用户可写”策略替换为白名单策略）
   - `supabase/migrations/004_indexes_and_checks.sql`（与真实查询匹配的
     索引：status、status+sort_order、status+created_at、status+category、
     已发布+精选部分索引、tags GIN 索引；external_links 数组约束）
3. Storage 新建**公开**桶 `portfolio-images`。
4. **只应用 003 文件末尾注释里的白名单 Storage 策略**（公开读、
   管理员白名单写），并检查：**删除任何残留的 001 版“所有已登录用户
   可写”Storage 策略**。RLS 策略是取并集的，残留的宽松策略会让
   白名单失效——这是最容易踩错的一步。
5. Auth 设置：**关闭公开注册（Enable email signups OFF）**。后台没有
   任何注册入口，公开注册一旦开启即等于向所有人开放注册路径。
6. 按第 4 节创建第一个管理员并写入白名单。
7. 设置环境变量（本地 `.env.local` 或 Vercel），重启应用；顶部演示
   提示消失即为 Supabase 模式。
8. 在 Supabase 模式下手动重跑验收：登录、上传（含一张伪装格式文件，
   应被拒绝）、草稿 → 发布 → 公开可见 → 下架（首页 / 列表 / 搜索 /
   详情 / sitemap 均不可见）→ 重新上架（`published_at` 不变）→
   删除（共享文件保留）。**演示模式的通过不能代替这一步。**

## 4. 首次创建管理员的方法

Supabase Dashboard → Authentication → Users → Add user（或 Invite），
创建唯一的管理员账号（建议用一个专用邮箱，不要用个人常用邮箱混用）。
记下该账号在 Users 表里的 UUID，然后在 SQL Editor 执行：

```sql
insert into public.admins (user_id, email)
values ('<管理员在 Authentication > Users 里的 UUID>', 'admin@example.com');
```

把 `<...>` 换成真实 UUID，把邮箱换成管理员邮箱。验证方法：

- 该账号在 `/admin/login` 能登录并进入后台、能保存作品；
- 一个已登录但**不在** `public.admins` 里的账号登录后，访问后台与
  任何写入操作都应被拒绝（与未登录用户同等对待）；
- SQL 检查白名单里只有目标管理员：
  ```sql
  select user_id, email, created_at from public.admins;
  ```

如果白名单为空或写错 UUID，症状是“登录成功但一进后台就被踢回
登录页”——先查这张表，不要怀疑密码。

## 5. 上线前必须完成的检查清单

- [ ] 迁移 001–004 已按顺序应用；`pg_policies` 里只有白名单写策略 +
  仅已发布读策略，没有残留宽松策略；Storage 写策略仅白名单。
- [ ] 公开注册已关；`public.admins` 只有目标管理员；已登录非管理员
  在数据库层写操作被拒。
- [ ] 仓库里没有任何 service-role key、没有 `.env` / `.env.local`。
- [ ] `npm run typecheck` 与 `npm run build` 通过；验收脚本与安全
  检查脚本通过（演示模式）。
- [ ] Supabase 模式下手动重跑第 3 节第 8 步的完整流程。
- [ ] `lib/site.ts` 里的联系邮箱、社交链接占位（`hello@ai-lab.example`、
  github.com / x.com 首页）已换成真实信息；`NEXT_PUBLIC_SITE_URL`
  已设真实域名；生产环境无演示提示。
- [ ] 手动浏览器点一遍：后台表单保存草稿 / 发布、图片上传进度、
  未保存取消提醒、被引用分类删除拦截、移动端菜单开合、浅色 /
  深色主题切换后刷新仍保持。
- [ ] 对外口径：草稿 / 下架详情页渲染 404 内容，但 HTTP 状态是 200
  （Next 14 流式 not-found 行为），**不要宣称 HTTP 404**；严格 404
  需要另起任务（升级 Next 或代理层规则）。
- [ ] 已知未验证项已如实告知：真实浏览器点击流程、Supabase 线上
  RLS / Storage 行为（无凭据环境无法验证）。
