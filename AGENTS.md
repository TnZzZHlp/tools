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

## UI 组件库
- 使用 **P0seid0n** (`https://p0seid0n.tnzzzhlp.workers.dev/`) 作为全站 UI 组件库与设计令牌体系
- **优先复用 `src/components/ui/` 中的 P0seid0n 组件与 `--p0seid0n-*` 语义颜色变量**（遵循 `light-dark()` 单值双模式规范，避免手写 `dark:` 变体）
- 安装 P0seid0n 组件命令:
  ```bash
  pnpm dlx shadcn-vue@latest add https://p0seid0n.tnzzzhlp.workers.dev/r/<component-name>.json
  ```

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

## 添加新工具页面
1. 在 `src/views/` 创建新的 Vue 组件
2. 在 `src/router/index.ts` 添加路由
3. 在 `src/lib/tools.ts` 的 `TOOLS` 中注册工具条目
