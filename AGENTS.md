# 项目规则

## 项目概述
这是一个个人工具集网页项目，用于开发和部署各种实用小工具。

## 技术栈
- Vue 3 + TypeScript + Vite
- Tailwind CSS 4
- Pinia (状态管理)
- Vue Router
- P0seid0n UI (`https://p0seid0n.tnzzzhlp.workers.dev/`)
- lucide-vue-next (图标库)

## 依赖管理
- **必须使用 pnpm** 进行依赖管理
- 安装依赖: `pnpm install`
- 添加依赖: `pnpm add <package>`
- 添加开发依赖: `pnpm add -D <package>`

## UI 组件库 (P0seid0n UI)
- 站点与注册表：使用 **P0seid0n** (`https://p0seid0n.tnzzzhlp.workers.dev/`，索引 `https://p0seid0n.tnzzzhlp.workers.dev/r/registry.json`) 作为全站 UI 组件库与设计令牌体系；`components.json` 已注册 `@p0seid0n` 命名空间。
- 安装或更新组件：
  ```bash
  pnpm dlx shadcn-vue@latest add @p0seid0n/<component-name>
  # 或指定完整 URL：
  pnpm dlx shadcn-vue@latest add https://p0seid0n.tnzzzhlp.workers.dev/r/<component-name>.json
  ```
- **设计令牌与双模式规范** (`src/styles/p0seid0n.css`、`src/styles/p0seid0n-shadcn.css`)：
  - 基于 CSS `color-scheme: light dark` 与 `light-dark()` 单值双模式变量，由 `App.vue` 根部的 `ThemeProvider`（`@/components/ui/theme-provider`，配套 `ThemeSwitcher` 与 `useTheme()`）统一切换 `:root.light` / `:root.dark`。
  - **严禁手写 Tailwind `dark:` 变体或硬编码黑白灰十六进制色值**，统一使用 P0seid0n 语义工具类与 CSS 变量：
    - 表面与层级：`bg-surface` (`--p0seid0n-surface`)、`bg-raised` (`--p0seid0n-raised`)、`bg-control` (`--p0seid0n-control`)
    - 文本层级：`text-ink` (`--p0seid0n-ink`)、`text-ink-muted` (`--p0seid0n-ink-muted`)、`text-ink-faint` (`--p0seid0n-ink-faint`)
    - 边框与状态色：`border-line` (`--p0seid0n-line`)、`text-accent` / `bg-accent` (`--p0seid0n-download`)、`text-accent-alt` / `bg-accent-alt` (`--p0seid0n-upload`)、`text-danger` / `bg-danger` (`--p0seid0n-danger`)
    - 圆角、阴影与字体：`rounded-control` (12px)、`rounded-panel` (16px)、`rounded-panel-lg` (20px)、`shadow-popup`、`font-sans`、`font-condensed`
- **已内置组件清单** (`src/components/ui/`，共 35 个模块，开发时优先从 `@/components/ui/<name>` 导入复用)：
  - 基础与表单：`button`、`input`、`textarea`、`label`、`checkbox`、`switch`、`radio-group`、`select`、`slider`、`toggle`
  - 布局与展示：`card`、`separator`、`badge`、`stat`、`sparkline`、`area-chart`、`table`、`avatar`、`skeleton`、`progress`
  - 导航与浮层：`dialog`、`alert-dialog`、`sheet`、`popover`、`tooltip`、`dropdown-menu`、`tabs`、`accordion`、`breadcrumb`、`pagination`、`command`
  - 反馈与主题：`alert`、`toast`、`theme-provider`、`theme-switcher`
- **关键 API 约定（区别于通用 shadcn-vue）**：
  - `Button`：`variant` 为 `'primary' | 'secondary' | 'ghost' | 'danger'`，`size` 为 `'sm' | 'md' | 'lg'`；支持 `loading` 属性与 `#leading`、`#trailing`、`#progress` 插槽。
  - `Card`：导出 `Card`、`CardHeader`、`CardContent`、`CardFooter`（无 `CardTitle`/`CardDescription` 子组件）；`CardHeader` 通过具名插槽 `#title`、`#description`、`#action` 渲染标题区。
  - `Badge` / `Alert`：`Badge` 的 `variant` 为 `'neutral' | 'accent' | 'accent-alt' | 'outline'`；`Alert` 的 `variant` 为 `'neutral' | 'accent' | 'danger'`。
  - `Dialog`：`DialogContent` 支持 `hide-close` 属性；内部直接使用 `DialogTitle` 与 `DialogDescription`（无 `DialogHeader` 包装器）。
  - `Tooltip`：内部已内置 `TooltipProvider`，使用时无需在外层额外包裹 `TooltipProvider`。
  - `Toast`：`App.vue` 已在全局挂载 `ToastProvider`（内含 `Toaster`），业务组件直接调用 `@/components/ui/toast` 的 `useToast()`。
  - 表单校验态：`Input`、`Textarea`、`SelectTrigger` 使用布尔属性 `invalid` 标记错误态。

## 常用命令
- 开发服务器: `pnpm dev`
- 构建项目: `pnpm build`
- 类型检查: `pnpm type-check`
- 代码检查: `pnpm lint`
- 代码格式化: `pnpm format`
- 运行测试: `pnpm test:unit`

## 项目结构
```
src/
├── components/     # 组件目录
│   └── ui/        # P0seid0n UI 组件
├── lib/           # 工具函数与领域模块
│   ├── tools.ts   # 工具注册表与面包屑路由解析
│   └── utils.ts   # cn() 函数用于合并 Tailwind 类名
├── router/        # 路由配置
├── stores/        # Pinia 状态管理
├── styles/        # P0seid0n 令牌样式与页面专属样式
├── views/         # 页面视图
├── main.css       # 全局样式入口 (Tailwind + P0seid0n CSS 变量)
└── main.ts        # 应用入口
```

## 代码规范
- 使用 TypeScript
- 遵循 Vue 3 Composition API 风格
- 使用 oxlint + eslint 进行代码检查
- 使用 oxfmt 进行代码格式化

## 组件开发规范
1. 优先使用 P0seid0n UI 组件与 `--p0seid0n-*` 设计令牌
2. 组件使用 `<script setup lang="ts">` 语法
3. 使用 `cn()` 函数合并 Tailwind 类名
4. 图标使用 lucide-vue-next
5. 同步或新增 `src/components/ui/` 下的单词命名 `.vue` 组件（如 `Button.vue`、`Card.vue`、`Input.vue`）时，需保留 `defineOptions({ name: 'Ui...' })`，以符合 ESLint `vue/multi-word-component-names` 规则
6. 本项目 `tsconfig.app.json` 开启 `"noUncheckedIndexedAccess": true`，且 `oxlint` 启用 `unicorn/no-new-array`：同步上游 TS 工具代码时需补充数组索引空值守卫，并使用 `Array.from({ length })` 替代 `new Array(n)`
7. 涉及浏览器媒体查询的组件逻辑（如 `theme-provider`）需守卫 `typeof window.matchMedia === 'function'`，确保 Vitest (`jsdom`) 测试环境兼容

## 添加新工具页面
1. 在 `src/views/` 创建新的 Vue 组件
2. 在 `src/router/index.ts` 添加路由
3. 在 `src/lib/tools.ts` 的 `TOOLS` 中注册工具条目
