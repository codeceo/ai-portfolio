# 数据库与安全架构审查（2026-10-29）

范围：`~/workspace/ai-portfolio` 现有项目。审查后**直接修复**了可修复项，
本文件只记录结果，不代替修复。**没有做任何 Supabase 线上验证**——本环境
不存在 Supabase 凭据，演示模式（本地 `data/*.json`）是唯一已验证的模式，
Supabase 相关结论均为代码与迁移文件审查结论，见第 4 节。

## 0. 设计前提（先说清楚，否则后面的结论会被误读）

- **单管理员产品，无多租户。** 整个站只有一个管理员身份：演示模式是
  本地演示 cookie，Supabase 模式是 Auth 会话 + `public.admins` 白名单。
  因此“URL 里的作品 id 不能越权访问别人的数据”这一项的答案是：不存在
  “别人的数据”——任何管理员操作的是同一份作品集；防护重点是**非管理员
  一律拒绝**，而不是管理员之间的隔离。非管理员已登录用户在每一条写入
  路径上得到的拒绝与匿名用户完全相同（`requireAdmin()` 不区分原因，
  只返回通用错误；上传路由返回 401）。
- **分类与标签的选择（已在迁移 004 文件头中同样注明）：**
  - 分类是独立表 `public.categories`（管理员维护，有名称、别名、排序），
    `works.category` 存的是分类 **slug**。分类是小而稳定的受控词表，
    需要独立的列表页、排序和删除保护，自由文本列给不了这些。
  - 标签是 `works.tags text[]` 数组。标签是自由、多值、从不集中编辑
    的属性，只用于筛选和搜索；为它建联结表会多出一整套 CRUD 界面
    而无实际收益。数组的代价是：关键词搜索不能只用一条 `ilike`
    完成——本次修复把标签筛选推到数据库（`tags @> ARRAY[tag]`，由
    004 的 GIN 索引支撑），关键词搜索用三列 `ilike` + 一个只取
    `(id, tags)` 的轻量查询做标签子串匹配再并集取行，**不改变公开
    查询语义**（演示模式与 Supabase 模式对同一数据返回同一结果集，
    由 `scripts/security-check.mts` 覆盖演示侧语义）。
  - 刻意**没有**加 `works.category → categories(slug)` 外键：004 之前
    的版本删除分类是不设防的，线上库可能已存在孤儿 slug，加可验证
    外键会让迁移直接失败。孤儿防护改由应用层执行（见第 2 节），
    004 文件末尾附有只读的孤儿检查 SQL，加外键前必须先跑它并清零。

## 1. 发现的问题

按严重程度排序。标 ★ 的是本次审查前真实存在的安全/正确性缺口，
其余为已确认无问题或仅需说明的项。

1. ★ **管理员布局守卫可被绕过（fail-open）。** 旧 `app/admin/layout.tsx`
   只有在中间件设置了 `x-admin-path` 请求头时才检查权限
   （`if (path && path !== '/admin/login' && ...)`）。一旦请求没带该头
   （中间件匹配器缺口、代理剥离请求头、未来路由调整），后台页面会
   在无任何检查的情况下渲染。
2. ★ **危险协议 URL 可入库并渲染。** zod 的 `.url()` 接受任意协议，
   `javascript:`、`data:text/html` 链接可通过表单存入 `demo_url` /
   `source_url` / `external_links`，并在详情页以 `<a href>` 原样渲染；
   `javascript:` / `data:` 封面同样可进入 `<img>`。
3. ★ **上传只信客户端声明的 MIME。** 旧 `validateImageFile` 只检查
   `file.type`、大小和扩展名缺失与否，不检查扩展名与 MIME 是否匹配，
   更不检查文件内容。curl 可把 HTML/SVG 伪装成 PNG 上传并存入
   `public/uploads/` 或 Storage 桶；Storage 的 `contentType` 直接取
   自 `file.type`。
4. ★ **Supabase 侧标签/关键词搜索全表拉取。** 旧 `supabase-repo`
   先取全部已发布作品再在内存中过滤 tag/q；作品量上来后每次搜索
   都是一次全表读。
5. ★ **删除分类会产生孤儿作品。** 旧 `deleteCategoryAction` 不检查
   引用，删掉分类后引用它的作品的分类名再也解析不出来；分类表单的
   确认文案还写着“已有作品不会自动改分类”，误导管理员以为这是安全行为。
6. ★ **客户端可伪造 `published_at`。** `saveWorkFormAction` 直接解析
   含 `published_at` 的 `workSchema` 并传给 `saveWorkCore`，旧代码把
   客户端值作为回退值——从未发布过的作品提交草稿时可带上伪造的首次
   发布时间（仅限管理员可调用，但仍是“客户端说了算”的字段）。
7. ★ **删除清理的上报失真。** 旧 `cleanupWorkFiles` 对非存储 URL
   （如种子作品的 `/covers/*.svg`、外链）也计入 `removed`，即使什么
   都没删；管理员看到的清理报告不可信。
8. ★ **分类创建不查重、删除后缓存刷新不全。** 旧 `createCategoryAction`
   不检查 slug 重复（Supabase 侧会抛原始数据库错误；演示侧会静默建
   出重复分类）；分类删除只刷新 `/admin/categories`，不刷新 `/`、
   `/works`、`/sitemap.xml`。
9. ★ **`.env.example` 留着 service-role 占位行。** 没有任何代码读取它，
   但一行 `# SUPABASE_SERVICE_ROLE_KEY=` 是在教后来者“这里可以填”，
   一旦填入并误提交或误入浏览器代码，等于绕过全部 RLS。
10. ★ **`target="_blank"` 缺 `noopener`。** 全部 8 处只写了
    `rel="noreferrer"`（现代浏览器下 noreferrer 蕴含 noopener，但显式
    写出才是可审计的状态）。
11. **已确认无问题（逐项核查过，不用再怀疑）：**
    - 作品表字段齐全：001 有 uuid 主键、唯一 slug、标题、简介、详情、
      分类、标签数组、封面、截图数组、demo_url、repo_url、status
      CHECK、featured、sort_order、created_at、updated_at（含触发器）；
      002 加 highlights；003 加 source_url、external_links、
      published_at、started_at、seo_title、seo_description、og_image_url。
      本次不需要补字段，004 只加索引与约束。
    - 浏览器 Supabase 客户端只用于登录：`lib/supabase/client.ts` 仅被
      `components/SupabaseLoginForm.tsx` 调用 `auth.signInWithPassword`，
      无任何浏览器端数据读写；数据读写全部走服务端（anon key + RLS）。
    - 公开路径只读已发布：首页、`/works`、`/api/works`、详情页、sitemap
      全部走 `listPublished` / `listPublishedPaged`；详情页与
      `generateMetadata` 对未发布作品只返回通用标题，不泄露标题、
      简介、详情、封面。`listAll` / `getById` / `getBySlug` 未过滤的
      调用只出现在后台页面与服务端操作中。
    - 全部写入路径先鉴权：`saveWorkCore`、`checkSlugAction`、
      `setStatusAction`、`toggleFeaturedAction`、`setSortAction`、
      `batchStatusAction`、`deleteWorkAction`、`batchDeleteAction`、
      分类创建/删除、上传路由、上传 Server Action 都在触碰数据前调用
      `requireAdmin()`；上传路由未登录返回 401（验收 1c）。
    - slug 唯一性在创建与更新两路都查（`slugTaken(all, slug, excludeId)`，
      演示仓与服务端操作双重把关），不会静默覆盖。
    - 下架不删记录、不动 `published_at`；重新上架恢复可见且
      `published_at` 不变；下架精选作品在同一次更新里取消精选。
    - 删除文件用 `planCleanup` 做引用计数，覆盖封面 + 截图 + OG 图，
      单删与批量删都走同一路径（批量是逐项调单删，引用计数每次重算，
      共享文件在最后一个引用者被删时才删除）。
    - `.gitignore` 覆盖 `.env`、`.env*.local`；仓库内无 `.env` /
      `.env.local` 文件；`data/*.json` 与 `public/uploads/` 无真实凭据。
    - 服务端 Supabase 客户端用 anon key，不用 service role（grep 全仓：
      service-role 只剩本文件与检查脚本里的文字说明，无密钥、无占位赋值）。

## 2. 已经修复的问题（附文件）

| # | 修复 | 文件 |
|---|---|---|
| 1 | 布局守卫改为 fail-closed：除 `/admin/login` 外一律先验权；中间件匹配器显式加上裸 `/admin` | `app/admin/layout.tsx`、`middleware.ts` |
| 2 | 新增安全 URL 层：链接只接受 http(s)，图片只接受 http(s) 或站内 `/` 路径；zod 校验与详情页渲染、封面渲染三处同时把关，旧数据/直接写库的脏值在渲染时也会被过滤掉 | `lib/safe-url.ts`（新增）、`lib/validation.ts`、`app/works/[slug]/page.tsx`、`components/CoverImage.tsx` |
| 3 | 上传三层校验：MIME 白名单 + 扩展名与 MIME 匹配 + 魔数嗅探（JPEG/PNG/GIF/WebP/AVIF，SVG/HTML 无入口即拒绝）；嗅探在写入前执行；Storage `contentType` 改用嗅探出的 MIME；两条上传路径（路由与 Server Action）同款校验；`uniqueFileName` 压缩连续点、去首点、无斜杠 | `lib/upload.ts`、`app/api/admin/upload/route.ts`、`lib/admin-actions.ts`（`uploadImageAction`） |
| 4 | Supabase 搜索下推数据库：tag 用 `@>` 包含、category 用 `eq`、关键词用三列 `ilike` + 轻量 tags 查询并集；无关键词时保持原单查询 + `range/count` 快路径；公开语义不变 | `lib/data/supabase-repo.ts` |
| 5 | 删除分类改为**拦截**：有作品引用时抛明确错误（含前 3 个作品名与总数），不删、不孤儿；UI 确认文案与错误展示同步改掉 | `lib/admin-actions.ts`（`deleteCategoryAction`）、`lib/work-rules.ts`（`worksReferencingCategory`）、`components/CategoryRowActions.tsx` |
| 6 | `published_at` 改为纯服务端计算：`saveWorkCore` 不再接受客户端传来的值，只按 `applyPublishedAt(existing, {status})` 生成 | `lib/admin-actions.ts`（`saveWorkCore`） |
| 7 | 清理上报只计真实删除：非存储 URL 直接跳过，不再谎报 `removed` | `lib/admin-actions.ts`（`cleanupWorkFiles`） |
| 8 | 分类创建查重（明确中文错误，不再抛原始数据库错误）；分类创建/删除刷新 `/`、`/works`、`/sitemap.xml`；全部作品变更刷新新增 `/sitemap.xml`；保存作品时校验分类确实存在（防孤儿 slug） | `lib/admin-actions.ts` |
| 9 | 删掉 `.env.example` 里的 service-role 占位行，改为明文说明：本项目故意不用 service-role，服务端用 anon key + RLS + 白名单，不要添加 | `.env.example` |
| 10 | 全部 `target="_blank"` 改为 `rel="noreferrer noopener"` | `app/works/[slug]/page.tsx`、`components/Footer.tsx`、`components/WorkForm.tsx`、`components/AdminRowActions.tsx`、`app/about/page.tsx`、`app/admin/page.tsx` |
| 11 | 新增迁移 004：status、status+sort_order、status+created_at DESC、status+category、category、已发布+精选部分索引、tags GIN 索引；`external_links` 数组 NOT VALID 约束；分类/标签设计说明与孤儿检查 SQL 写进文件头 | `supabase/migrations/004_indexes_and_checks.sql`（新增，001–003 未动） |
| 12 | 新增专项检查脚本 + 扩展验收：27 项安全检查；验收新增 HTTP 层面的伪造上传拒绝（HTML 冒充 PNG、MIME/扩展名不一致均 400）与下架后搜索/sitemap 不可见 | `scripts/security-check.mts`（新增）、`scripts/acceptance-demo.mjs`、README 验收说明 |

## 3. 仍需手动配置的内容（上线前必须做，代码改不了）

1. Supabase SQL Editor 按顺序运行 001 → 002 → 003 → **004**（004 是本次新增）。
2. 新建公开桶 `portfolio-images`，并按 003 文件末尾注释应用 Storage
   白名单策略（公开读、仅 `public.admins` 成员写）。**注意：003 里的
   Storage 策略仍是注释块**——因为建桶前无法执行它，执行前必须先把
   001 里旧的“任何已登录用户可写” Storage 策略说明作废（不要同时留
   两套 Storage 写策略；见第 4 节第 2 条的核对方法）。
3. Auth 里关闭公开注册（Enable email signups OFF）；应用内无注册入口。
4. 在 Authentication → Users 邀请/创建唯一管理员后执行：
   `insert into public.admins (user_id, email) values ('<UUID>', 'admin@example.com');`
5. `.env.local`（及 Vercel 环境变量）填 `NEXT_PUBLIC_SUPABASE_URL`、
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`、`NEXT_PUBLIC_SITE_URL`（真实域名）。
   **不要**添加 service-role 密钥。
6. 跑一次 004 末尾的孤儿检查 SQL；如有孤儿行，先把它们的 `category`
   改成真实分类，再考虑将来加外键。
7. 把 `lib/site.ts` 里的占位联系方式/社交链接换成真实的（与本次审查
   无关，但仍是上线前未完成项）。

## 4. 不能自动验证的项目（没有凭据/没有浏览器自动化，诚实列出）

1. **全部 Supabase 线上行为**：RLS 白名单策略是否真正生效、非管理员
   已登录用户是否确实被数据库层拒绝、Storage 上传/删除、Auth 登录 +
   白名单检查。迁移文件已逐行核对：003 用 `drop policy if exists
   "admin write works"` / `"admin write categories"` 删掉了 001 的宽松
   写策略并建了同作用域的 allowlist 策略，公开读策略未动，
   `admins` 表仅自读；但**策略是否真实落库，只能在有凭据的 Supabase
   项目里用 SQL 验证**，例如：
   `select policyname, cmd, qual from pg_policies where tablename in ('works','categories','admins');`
   以及用非管理员账号实际调一次写操作看是否被拒绝。
2. **Storage 新旧策略共存风险**：001 里 Storage 策略本身就是注释
   （建桶后手动执行），如果部署者按 001 注释建了“已登录可写”策略
   又按 003 注释建了白名单策略，两条策略是“或”关系，宽松的那条会
   让白名单失效。上线时必须只保留白名单那条，并用
   `select policyname from pg_policies where tablename = 'objects';`
   核对。
3. **浏览器里的表单提交点击**：受控表单的保存/发布按钮在真实浏览器
   里的点击路径没有自动化覆盖（与上一阶段相同）；服务端逻辑与已测的
   `saveWorkCore` 是同一套，但上线前值得手动点一次。
4. **演示登录 Server Action 本身**：验收用带 cookie 的上传接口验证了
   演示鉴权，未用浏览器驱动 `demoLoginAction` 的 RSC 提交（同上）。
5. **草稿/下架详情页的 HTTP 状态**：本次复测确认仍是 **HTTP 200**
   （Next 14.2.33 流式 not-found 行为，自定义 404 页 + 通用元数据标题，
   正文与元数据均不含作品标题/简介/详情/封面）。**不要对外宣称它是
   HTTP 404。** 在 App Router 页面层没有干净的修复办法：中间件无法
   在 Edge 运行时读演示 JSON 或可靠地查库，路由处理器无法与同路径
   页面共存，升级 Next 大版本超出本次审查范围。如需严格 404，应
   作为单独任务评估（升级 Next 或在反向代理层按规则返回 404）。
6. **历史遗留上传文件**：本次之前已上传、但不再被任何作品引用的文件
   （如表单里上传后未保存的图）没有追踪机制，不会被删除清理覆盖；
   属于孤儿文件风险低（仅占存储），上线前可人工扫一遍 Storage 桶。
7. **演示模式的“管理员”本质上是本地弱凭证**：演示 cookie + 固定演示
   账号只是本地开发手段，绝不能把演示模式暴露到公网生产环境；
   生产必须走 Supabase 模式（演示横幅消失为准）。

## 5. 发布前的最终检查清单

- [ ] 迁移 001 → 002 → 003 → 004 已在目标 Supabase 项目按顺序执行，
      无报错；`pg_policies` 核对：works/categories 无残留的
      “admin write”宽松策略，只有 allowlist 写策略 + 已发布读策略。
- [ ] Storage 桶 `portfolio-images` 已建且公开读；`storage.objects`
      写策略**只有** allowlist 那一条；用非管理员账号上传一次，确认被拒。
- [ ] 公开注册已关闭；`public.admins` 里只有预期的管理员 UUID；
      用一个已登录但**不在**白名单的账号调一次写入，确认数据库层拒绝。
- [ ] `.env.local` / Vercel 环境变量只有 URL、ANON_KEY、SITE_URL 三项，
      无 service-role；仓库内无 `.env`、`.env.local` 文件。
- [ ] `npm run typecheck` 与 `npm run build` 通过（本次已通过，见下）。
- [ ] 演示模式验收：`node scripts/acceptance-demo.mjs` 18/18；
      安全检查：`node --import ./scripts/acceptance-loader.mjs scripts/security-check.mts` 27/27。
- [ ] Supabase 模式下手动重跑一遍：登录、上传（含一张伪造格式图应被拒）、
      新建草稿、发布、公开可见、下架后首页/列表/搜索/详情/sitemap 均不可见、
      重新上架（`published_at` 不变）、删除（共享文件不误删）。
- [ ] `lib/site.ts` 占位联系方式/社交链接已换成真实值；`NEXT_PUBLIC_SITE_URL`
      已是真实域名；演示横幅在生产环境不再出现。
- [ ] 浏览器里手动点一次后台表单：新建、上传带进度、保存草稿、发布、
      取消时的未保存提醒、删除分类被引用时的拦截提示。
- [ ] 对外口径：下架详情页返回自定义 404 内容但 HTTP 状态为 200
      （已知 Next 14 行为），不要写成“返回 404 状态码”。

## 验证命令与结果（本次审查，演示模式）

- `npm run typecheck`：通过（修复过程中出现 4 个类型错误，均已修复，
  终态通过）。
- `npm run build`：通过（14 路由 + middleware，含 `/api/admin/upload`）。
- `node --import ./scripts/acceptance-loader.mjs scripts/security-check.mts`：
  **27/27 通过**（中途 1 次失败是检查脚本自身把公开读策略错写进了
  003 的断言，已修正检查脚本而非迁移文件，复跑通过）。
- `node scripts/acceptance-demo.mjs`：**18/18 通过**（中途 1 次失败是
  新检查把搜索框回显的查询词误判为标题泄露，已把断言改为检查作品
  详情链接，复跑通过）。测试数据已清理，`data/works.json` 恢复为
  5 条种子作品，`public/uploads/` 仅剩 `.gitkeep`。
- 迁移语法检查：001–004 按顺序通读——全部增量（`if not exists` /
  `NOT VALID` / 先删后建同名策略），无列重定义、无冲突的策略删除；
  **线上应用未执行**（无凭据），见第 4 节第 1 条。
- curl 复测（生产服务器）：草稿 slug 与不存在的 slug 均返回 HTTP 200
  + 自定义 404 内容（第 4 节第 5 条的已知行为，非泄露）。
