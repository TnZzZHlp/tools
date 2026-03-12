<template>
    <div class="min-h-screen bg-slate-950 text-slate-50">
        <div class="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-6 py-10 lg:px-8">
            <header class="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <p class="text-sm font-medium uppercase tracking-[0.3em] text-cyan-300">Tools</p>
                        <h1 class="mt-2 text-3xl font-semibold tracking-tight text-white">个人工具集</h1>
                    </div>
                    <nav class="flex items-center gap-3 text-sm text-slate-300">
                        <RouterLink
                            class="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 transition hover:border-cyan-300/50 hover:bg-cyan-400/15 hover:text-white"
                            to="/">
                            Rust tracing → LogQL
                        </RouterLink>
                    </nav>
                </div>
                <p class="max-w-3xl text-sm leading-6 text-slate-400">
                    把常用的小工具先摆上台面，今天这位主角负责把 Rust 的 <code>tracing</code> 宏整理成可直接复制的 LogQL 模板。
                </p>
            </header>

            <main class="flex-1">
                <RouterView />
            </main>
        </div>
    </div>
</template>
