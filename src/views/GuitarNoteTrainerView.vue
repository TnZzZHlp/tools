<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Activity,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  Guitar,
  Lightbulb,
  RefreshCcw,
  RotateCcw,
  Target,
  Trophy,
  XCircle,
} from 'lucide-vue-next'

type Mode = 'reference' | 'quiz' | 'fretboard'
type IntervalKind = 'whole' | 'half'
type QuestionKind = 'A' | 'B' | 'C' | 'D'
type AnswerStatus = 'idle' | 'correct' | 'wrong'
type FretAnswer = 1 | 2 | 3

interface NoteItem {
  id: string
  number: string
  letter: string
  solfege: string
  hint: string
}

interface IntervalItem {
  id: string
  fromIndex: number
  toIndex: number
  kind: IntervalKind
  frets: 1 | 2
}

interface QuizOption {
  id: string
  label: string
  value: string
}

interface QuizQuestion {
  id: string
  kind: QuestionKind
  title: string
  prompt: string
  promptBadge: string
  options: QuizOption[]
  answer: string
  answerLabel: string
  explanation: string
  interval?: IntervalItem
}

interface QuizStats {
  total: number
  correct: number
  currentStreak: number
  bestStreak: number
}

interface FretMarker {
  fret: number
  label: string
  type: 'start' | 'end'
}

const STORAGE_KEY = 'tools:guitar-note-trainer:stats'

const notes: NoteItem[] = [
  {
    id: 'c-low',
    number: '1',
    letter: 'C',
    solfege: 'do',
    hint: 'C 大调主音',
  },
  {
    id: 'd',
    number: '2',
    letter: 'D',
    solfege: 're',
    hint: '从 1 上行全音',
  },
  {
    id: 'e',
    number: '3',
    letter: 'E',
    solfege: 'mi',
    hint: '紧挨 4，是半音起点',
  },
  {
    id: 'f',
    number: '4',
    letter: 'F',
    solfege: 'fa',
    hint: '3-4 是半音',
  },
  {
    id: 'g',
    number: '5',
    letter: 'G',
    solfege: 'sol',
    hint: '稳定的属音',
  },
  {
    id: 'a',
    number: '6',
    letter: 'A',
    solfege: 'la',
    hint: '常见调弦参考音',
  },
  {
    id: 'b',
    number: '7',
    letter: 'B',
    solfege: 'si',
    hint: '紧挨高音 1，是半音起点',
  },
  {
    id: 'c-high',
    number: '1̇',
    letter: 'C',
    solfege: 'do',
    hint: '高八度主音',
  },
]

const intervals: IntervalItem[] = [
  {
    id: 'c-d',
    fromIndex: 0,
    toIndex: 1,
    kind: 'whole',
    frets: 2,
  },
  {
    id: 'd-e',
    fromIndex: 1,
    toIndex: 2,
    kind: 'whole',
    frets: 2,
  },
  {
    id: 'e-f',
    fromIndex: 2,
    toIndex: 3,
    kind: 'half',
    frets: 1,
  },
  {
    id: 'f-g',
    fromIndex: 3,
    toIndex: 4,
    kind: 'whole',
    frets: 2,
  },
  {
    id: 'g-a',
    fromIndex: 4,
    toIndex: 5,
    kind: 'whole',
    frets: 2,
  },
  {
    id: 'a-b',
    fromIndex: 5,
    toIndex: 6,
    kind: 'whole',
    frets: 2,
  },
  {
    id: 'b-c',
    fromIndex: 6,
    toIndex: 7,
    kind: 'half',
    frets: 1,
  },
]

const modes: Array<{
  id: Mode
  label: string
  description: string
  icon: Component
}> = [
  {
    id: 'reference',
    label: '对照学习',
    description: '看表记忆映射',
    icon: BookOpen,
  },
  {
    id: 'quiz',
    label: '盲听/盲看测试',
    description: '多维随机刷题',
    icon: Brain,
  },
  {
    id: 'fretboard',
    label: '指板大闯关',
    description: '把距离落到品格',
    icon: Guitar,
  },
]

const frets = [0, 1, 2, 3, 4, 5]
const fretAnswerOptions: FretAnswer[] = [1, 2, 3]

const currentMode = ref<Mode>('reference')
const selectedNoteIndex = ref<number | null>(2)
const selectedIntervalId = ref('e-f')
const currentQuestion = ref<QuizQuestion>(createQuestion())
const selectedAnswer = ref<string | null>(null)
const answerStatus = ref<AnswerStatus>('idle')
const quizCardKey = ref(0)
const selectedFretAnswer = ref<FretAnswer | null>(null)
const fretAnswerStatus = ref<AnswerStatus>('idle')

const stats = ref<QuizStats>({
  total: 0,
  correct: 0,
  currentStreak: 0,
  bestStreak: 0,
})

const accuracy = computed(() => {
  if (stats.value.total === 0) return 0
  return Math.round((stats.value.correct / stats.value.total) * 100)
})

const selectedInterval = computed(() => {
  return intervals.find((item) => item.id === selectedIntervalId.value) ?? intervals[2]!
})

const selectedIntervalFromNote = computed(() => noteByIndex(selectedInterval.value.fromIndex))
const selectedIntervalToNote = computed(() => noteByIndex(selectedInterval.value.toIndex))

const fretboardInterval = computed(() => {
  if (currentMode.value === 'quiz' && currentQuestion.value.kind === 'D') {
    return currentQuestion.value.interval ?? selectedInterval.value
  }

  return selectedInterval.value
})

const fretboardFromNote = computed(() => noteByIndex(fretboardInterval.value.fromIndex))
const fretboardToNote = computed(() => noteByIndex(fretboardInterval.value.toIndex))

const fretboardMarkers = computed<FretMarker[]>(() => {
  return [
    {
      fret: 0,
      label: noteDisplayName(fretboardFromNote.value),
      type: 'start',
    },
    {
      fret: fretboardInterval.value.frets,
      label: noteDisplayName(fretboardToNote.value),
      type: 'end',
    },
  ]
})

const fretboardTitle = computed(() => {
  return `${noteDisplayName(fretboardFromNote.value)} 到 ${noteDisplayName(fretboardToNote.value)}`
})

const fretboardDescription = computed(() => {
  return `${noteSignature(fretboardFromNote.value)} 到 ${noteSignature(
    fretboardToNote.value,
  )} 是${intervalLabel(fretboardInterval.value)}，所以在吉他同一根弦上相差 ${
    fretboardInterval.value.frets
  } 个品格。`
})

const feedbackTitle = computed(() => {
  if (answerStatus.value === 'correct') return '回答正确，连击继续'
  return `正确答案：${currentQuestion.value.answerLabel}`
})

const fretFeedbackTitle = computed(() => {
  if (fretAnswerStatus.value === 'correct') return '过关，品格距离记对了'
  return `正确答案：${selectedInterval.value.frets} 个品格`
})

onMounted(() => {
  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) return

    const savedStats = JSON.parse(rawValue) as Partial<QuizStats>

    stats.value = {
      total: toSafeNumber(savedStats.total),
      correct: toSafeNumber(savedStats.correct),
      currentStreak: 0,
      bestStreak: toSafeNumber(savedStats.bestStreak),
    }
  } catch {
    stats.value = {
      total: 0,
      correct: 0,
      currentStreak: 0,
      bestStreak: 0,
    }
  }
})

watch(
  stats,
  (value) => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          total: value.total,
          correct: value.correct,
          bestStreak: value.bestStreak,
        }),
      )
    } catch {
      // LocalStorage 不可用时，保留内存状态即可。
    }
  },
  { deep: true },
)

watch(
  currentQuestion,
  (question) => {
    if (question.interval) {
      selectedIntervalId.value = question.interval.id
    }
  },
  { immediate: true },
)

function selectMode(mode: Mode) {
  currentMode.value = mode
}

function selectNote(index: number) {
  selectedNoteIndex.value = index

  const forwardInterval = intervals.find((item) => item.fromIndex === index)
  const backwardInterval = intervals.find((item) => item.toIndex === index)

  selectedIntervalId.value = forwardInterval?.id ?? backwardInterval?.id ?? selectedIntervalId.value
}

function selectInterval(interval: IntervalItem) {
  selectedIntervalId.value = interval.id
  selectedNoteIndex.value = null
  resetFretChallengeAnswer()
}

function isIntervalHighlighted(interval: IntervalItem) {
  if (selectedIntervalId.value === interval.id) return true
  if (selectedNoteIndex.value === null) return false

  return (
    interval.fromIndex === selectedNoteIndex.value || interval.toIndex === selectedNoteIndex.value
  )
}

function isNoteInActiveInterval(index: number) {
  const interval = selectedInterval.value
  return interval.fromIndex === index || interval.toIndex === index
}

function noteByIndex(index: number) {
  return notes[index] ?? notes[0]!
}

function intervalLabel(interval: IntervalItem) {
  return interval.kind === 'half' ? '半音 / 1品格' : '全音 / 2品格'
}

function intervalShortLabel(interval: IntervalItem) {
  return interval.kind === 'half' ? '半音' : '全音'
}

function noteDisplayName(note: NoteItem) {
  return note.id === 'c-high' ? '高音 C' : note.letter
}

function noteSignature(note: NoteItem) {
  return `${note.number} - ${note.letter} - ${note.solfege}`
}

function intervalTheory(interval: IntervalItem) {
  const from = noteByIndex(interval.fromIndex)
  const to = noteByIndex(interval.toIndex)

  if (interval.kind === 'half') {
    return `错误时请先找特殊规则：${from.number}-${to.number}，也就是 ${from.letter}-${to.letter}，属于自然音阶里的半音关系。因此在吉他同一根弦上只相差 1 个品格。`
  }

  return `判断方法：${from.number}-${to.number}，也就是 ${from.letter}-${to.letter}，不是 3-4 或 7-1̇ 这两个特殊半音，所以是全音关系。在吉他同一根弦上需要移动 2 个品格。`
}

function markerForFret(fret: number) {
  return fretboardMarkers.value.find((marker) => marker.fret === fret)
}

function chooseAnswer(option: QuizOption) {
  if (answerStatus.value !== 'idle') return

  selectedAnswer.value = option.value
  const isCorrect = option.value === currentQuestion.value.answer

  answerStatus.value = isCorrect ? 'correct' : 'wrong'
  recordAnswer(isCorrect)
}

function nextQuestion() {
  currentQuestion.value = createQuestion()
  selectedAnswer.value = null
  answerStatus.value = 'idle'
  quizCardKey.value += 1
}

function answerFretChallenge(answer: FretAnswer) {
  if (fretAnswerStatus.value !== 'idle') return

  selectedFretAnswer.value = answer
  const isCorrect = answer === selectedInterval.value.frets

  fretAnswerStatus.value = isCorrect ? 'correct' : 'wrong'
  recordAnswer(isCorrect)
}

function nextFretChallenge() {
  selectedIntervalId.value = randomItem(intervals).id
  selectedNoteIndex.value = null
  resetFretChallengeAnswer()
}

function resetFretChallengeAnswer() {
  selectedFretAnswer.value = null
  fretAnswerStatus.value = 'idle'
}

function recordAnswer(isCorrect: boolean) {
  stats.value.total += 1

  if (isCorrect) {
    stats.value.correct += 1
    stats.value.currentStreak += 1
    stats.value.bestStreak = Math.max(stats.value.bestStreak, stats.value.currentStreak)
    return
  }

  stats.value.currentStreak = 0
}

function resetStats() {
  stats.value = {
    total: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
  }

  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // LocalStorage 不可用时无需处理。
  }
}

function optionButtonClass(option: QuizOption) {
  return {
    'border-primary bg-primary text-primary-foreground hover:bg-primary/90':
      answerStatus.value !== 'idle' && option.value === currentQuestion.value.answer,
    'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10':
      answerStatus.value === 'wrong' &&
      selectedAnswer.value === option.value &&
      option.value !== currentQuestion.value.answer,
    'ring-2 ring-ring/50': answerStatus.value === 'idle' && selectedAnswer.value === option.value,
  }
}

function fretOptionButtonClass(answer: FretAnswer) {
  return {
    'border-primary bg-primary text-primary-foreground hover:bg-primary/90':
      fretAnswerStatus.value !== 'idle' && answer === selectedInterval.value.frets,
    'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10':
      fretAnswerStatus.value === 'wrong' &&
      selectedFretAnswer.value === answer &&
      answer !== selectedInterval.value.frets,
  }
}

function createQuestion(): QuizQuestion {
  const questionKind = randomItem<QuestionKind>(['A', 'B', 'C', 'D'])

  if (questionKind === 'A') return createTypeAQuestion()
  if (questionKind === 'B') return createTypeBQuestion()
  if (questionKind === 'C') return createTypeCQuestion()
  return createTypeDQuestion()
}

function createTypeAQuestion(): QuizQuestion {
  const note = randomItem(notes)
  const targetField = randomItem<'letter' | 'solfege'>(['letter', 'solfege'])
  const isLetterQuestion = targetField === 'letter'
  const answer = isLetterQuestion ? note.letter : note.solfege
  const source = isLetterQuestion
    ? ['C', 'D', 'E', 'F', 'G', 'A', 'B']
    : ['do', 're', 'mi', 'fa', 'sol', 'la', 'si']

  return {
    id: createId(),
    kind: 'A',
    title: '类型 A：简谱映射',
    prompt: `简谱 ${note.number} 对应的${isLetterQuestion ? '音名' : '唱名'}是什么？`,
    promptBadge: note.number,
    options: createOptions(source, answer, 4),
    answer,
    answerLabel: answer,
    explanation: `简谱 ${note.number} 对应音名 ${note.letter}，唱名是 ${note.solfege}。先记住 1-C-do，再顺序推出 2-D-re、3-E-mi。`,
  }
}

function createTypeBQuestion(): QuizQuestion {
  const note = randomItem(notes.slice(0, 7))
  const source = notes.slice(0, 7).map((item) => item.number)

  return {
    id: createId(),
    kind: 'B',
    title: '类型 B：音名反推',
    prompt: `音名 ${note.letter} 对应的简谱是什么？`,
    promptBadge: note.letter,
    options: createOptions(source, note.number, 4),
    answer: note.number,
    answerLabel: note.number,
    explanation: `音名 ${note.letter} 对应简谱 ${note.number}，唱名是 ${note.solfege}。可以按 C-D-E-F-G-A-B 对应 1-2-3-4-5-6-7 来记。`,
  }
}

function createTypeCQuestion(): QuizQuestion {
  const interval = randomItem(intervals)
  const from = noteByIndex(interval.fromIndex)
  const to = noteByIndex(interval.toIndex)
  const answer = interval.kind === 'half' ? '半音' : '全音'

  return {
    id: createId(),
    kind: 'C',
    title: '类型 C：音程判断',
    prompt: `${noteDisplayName(from)} 和 ${noteDisplayName(to)} 是全音还是半音？`,
    promptBadge: `${from.letter} → ${to.letter}`,
    options: [
      {
        id: 'whole',
        label: '全音',
        value: '全音',
      },
      {
        id: 'half',
        label: '半音',
        value: '半音',
      },
    ],
    answer,
    answerLabel: answer,
    explanation: intervalTheory(interval),
    interval,
  }
}

function createTypeDQuestion(): QuizQuestion {
  const interval = randomItem(intervals)
  const from = noteByIndex(interval.fromIndex)
  const to = noteByIndex(interval.toIndex)
  const answer = String(interval.frets)

  return {
    id: createId(),
    kind: 'D',
    title: '类型 D：吉他实战题',
    prompt: `在吉他同一根弦上，从 ${noteDisplayName(from)} 到 ${noteDisplayName(
      to,
    )} 需要移动几个品格？`,
    promptBadge: `${from.letter} → ${to.letter}`,
    options: [
      {
        id: 'one-fret',
        label: '1 个品',
        value: '1',
      },
      {
        id: 'two-frets',
        label: '2 个品',
        value: '2',
      },
      {
        id: 'three-frets',
        label: '3 个品',
        value: '3',
      },
    ],
    answer,
    answerLabel: `${answer} 个品`,
    explanation: intervalTheory(interval),
    interval,
  }
}

function createOptions(source: string[], answer: string, count: number) {
  const uniqueSource = Array.from(new Set(source))
  const distractors = shuffle(uniqueSource.filter((item) => item !== answer)).slice(0, count - 1)
  const labels = shuffle([answer, ...distractors])

  return labels.map((label, index) => ({
    id: `${label}-${index}`,
    label,
    value: label,
  }))
}

function randomItem<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)]
  if (item === undefined) {
    throw new Error('randomItem received an empty array')
  }

  return item
}

function shuffle<T>(items: readonly T[]) {
  return [...items].sort(() => Math.random() - 0.5)
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toSafeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}
</script>

<template>
  <section class="h-full min-h-0 w-full overflow-hidden">
    <div class="visible-scrollbar h-full overflow-auto pr-1">
      <div class="mx-auto max-w-7xl space-y-4 pb-8 sm:space-y-6">
        <Card class="overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardHeader class="gap-5 lg:grid-cols-[1fr_auto]">
            <div class="space-y-3">
              <Badge variant="secondary" class="gap-1.5">
                <Guitar class="size-3.5" />
                Guitar Note Memory Trainer
              </Badge>
              <div class="space-y-2">
                <CardTitle class="text-2xl tracking-tight sm:text-3xl lg:text-4xl">
                  吉他简谱、音名、唱名记忆训练
                </CardTitle>
                <CardDescription class="max-w-3xl text-sm leading-6 sm:text-base">
                  把 1-C-do 到 7-B-si 的映射关系和「全音 2 品、半音 1
                  品」的物理距离放在同一个训练页面里。
                </CardDescription>
              </div>
            </div>

            <div class="grid gap-2 sm:grid-cols-3 lg:min-w-[460px]">
              <Card class="gap-2 rounded-2xl border-border/70 py-4 shadow-none">
                <CardContent class="flex items-center gap-3 px-4">
                  <Activity class="size-5 text-orange-500" />
                  <div>
                    <p class="text-xs text-muted-foreground">正确率</p>
                    <p class="text-2xl font-semibold">{{ accuracy }}%</p>
                    <p class="text-xs text-muted-foreground">
                      {{ stats.correct }} / {{ stats.total }}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card class="gap-2 rounded-2xl border-border/70 py-4 shadow-none">
                <CardContent class="flex items-center gap-3 px-4">
                  <Target class="size-5 text-sky-500" />
                  <div>
                    <p class="text-xs text-muted-foreground">当前连击</p>
                    <p class="text-2xl font-semibold">{{ stats.currentStreak }}</p>
                    <p class="text-xs text-muted-foreground">Streak</p>
                  </div>
                </CardContent>
              </Card>

              <Card class="gap-2 rounded-2xl border-border/70 py-4 shadow-none">
                <CardContent class="flex items-center gap-3 px-4">
                  <Trophy class="size-5 text-amber-500" />
                  <div>
                    <p class="text-xs text-muted-foreground">最高连击</p>
                    <p class="text-2xl font-semibold">{{ stats.bestStreak }}</p>
                    <p class="text-xs text-muted-foreground">Best</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="grid gap-2 lg:grid-cols-[1fr_auto] lg:items-center">
              <div class="grid gap-2 sm:grid-cols-3">
                <button
                  v-for="mode in modes"
                  :key="mode.id"
                  type="button"
                  class="group rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/60 active:scale-[0.99]"
                  :class="
                    currentMode === mode.id
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border bg-background'
                  "
                  @click="selectMode(mode.id)"
                >
                  <div class="flex items-center gap-2 font-medium">
                    <component :is="mode.icon" class="size-4" />
                    <span>{{ mode.label }}</span>
                  </div>
                  <p
                    class="mt-2 text-xs"
                    :class="
                      currentMode === mode.id
                        ? 'text-primary-foreground/75'
                        : 'text-muted-foreground'
                    "
                  >
                    {{ mode.description }}
                  </p>
                </button>
              </div>

              <Button
                variant="outline"
                class="justify-self-start lg:justify-self-end"
                @click="resetStats"
              >
                <RotateCcw class="size-4" />
                重置统计
              </Button>
            </div>
          </CardContent>
        </Card>

        <Transition name="mode-fade" mode="out-in">
          <section v-if="currentMode === 'reference'" key="reference" class="space-y-4">
            <Card>
              <CardHeader class="gap-3 lg:grid-cols-[1fr_auto]">
                <div class="space-y-2">
                  <Badge variant="secondary" class="w-fit">Reference Board</Badge>
                  <CardTitle class="text-xl sm:text-2xl">对照学习面板</CardTitle>
                  <CardDescription class="max-w-2xl leading-6">
                    点击任意音符卡片或音程胶囊，高亮它和相邻音之间的全音、半音关系。
                  </CardDescription>
                </div>
                <div
                  class="rounded-2xl border bg-muted/35 p-4 text-sm leading-6 text-muted-foreground"
                >
                  <strong class="text-foreground">核心规则：</strong>
                  3-4（E-F）和 7-1̇（B-C）是半音；其余相邻自然音都是全音。
                </div>
              </CardHeader>

              <CardContent class="space-y-6">
                <div class="visible-scrollbar -mx-1 overflow-x-auto px-1 pb-2">
                  <div class="flex min-w-max items-stretch gap-2">
                    <template v-for="(note, index) in notes" :key="note.id">
                      <button
                        type="button"
                        class="note-card group w-[8.5rem] rounded-2xl border bg-background p-4 text-left transition-all hover:-translate-y-1 hover:shadow-md active:scale-[0.98] sm:w-[9.5rem]"
                        :class="{
                          'border-primary ring-2 ring-primary/20': selectedNoteIndex === index,
                          'border-orange-400 bg-orange-50/70 dark:bg-orange-950/20':
                            isNoteInActiveInterval(index),
                        }"
                        @click="selectNote(index)"
                      >
                        <span class="block text-4xl font-black tracking-tight">{{
                          note.number
                        }}</span>
                        <span class="mt-3 block text-2xl font-semibold">{{ note.letter }}</span>
                        <span
                          class="block text-sm font-medium text-orange-600 dark:text-orange-400"
                        >
                          {{ note.solfege }}
                        </span>
                        <span class="mt-3 block text-xs leading-5 text-muted-foreground">
                          {{ note.hint }}
                        </span>
                      </button>

                      <button
                        v-if="index < intervals.length"
                        :key="intervals[index]?.id"
                        type="button"
                        class="interval-pill self-center rounded-full border px-3 py-2 text-center text-xs font-semibold transition-all hover:-translate-y-0.5 active:scale-95 sm:px-4"
                        :class="[
                          intervals[index]?.kind === 'half'
                            ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-300'
                            : 'border-border bg-muted/50 text-muted-foreground',
                          intervals[index] && isIntervalHighlighted(intervals[index])
                            ? 'scale-105 shadow-md ring-2 ring-orange-500/25'
                            : '',
                        ]"
                        @click="intervals[index] && selectInterval(intervals[index])"
                      >
                        <span class="block whitespace-nowrap">{{
                          intervals[index] ? intervalShortLabel(intervals[index]) : ''
                        }}</span>
                        <span class="block whitespace-nowrap opacity-80">
                          {{ intervals[index]?.frets }} 品格
                        </span>
                      </button>
                    </template>
                  </div>
                </div>

                <div
                  class="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[auto_1fr] sm:items-center"
                  :class="
                    selectedInterval.kind === 'half'
                      ? 'border-orange-300 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/20'
                      : 'bg-muted/30'
                  "
                >
                  <div class="flex flex-wrap items-center gap-3 text-lg font-semibold">
                    <span>{{ noteSignature(selectedIntervalFromNote) }}</span>
                    <ArrowRight class="size-5 text-muted-foreground" />
                    <span>{{ noteSignature(selectedIntervalToNote) }}</span>
                  </div>
                  <div class="space-y-1">
                    <Badge :variant="selectedInterval.kind === 'half' ? 'default' : 'outline'">
                      {{ intervalLabel(selectedInterval) }}
                    </Badge>
                    <p class="text-sm leading-6 text-muted-foreground">
                      {{ intervalTheory(selectedInterval) }}
                    </p>
                  </div>
                </div>

                <div class="overflow-hidden rounded-2xl border">
                  <div
                    class="grid grid-cols-4 bg-muted/60 px-4 py-3 text-sm font-medium text-muted-foreground"
                  >
                    <span>简谱 N</span>
                    <span>音名 L</span>
                    <span>唱名 S</span>
                    <span>记忆提示</span>
                  </div>
                  <div
                    v-for="note in notes"
                    :key="note.id"
                    class="grid grid-cols-4 border-t px-4 py-3 text-sm"
                  >
                    <span class="font-semibold">{{ note.number }}</span>
                    <span>{{ note.letter }}</span>
                    <span>{{ note.solfege }}</span>
                    <span class="text-muted-foreground">{{ note.hint }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section
            v-else-if="currentMode === 'quiz'"
            key="quiz"
            class="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"
          >
            <Transition name="card-flip" mode="out-in">
              <Card
                :key="quizCardKey"
                class="quiz-card overflow-hidden"
                :class="{
                  'border-green-500': answerStatus === 'correct',
                  'border-destructive': answerStatus === 'wrong',
                  'animate-correct-flash': answerStatus === 'correct',
                  'animate-wrong-shake': answerStatus === 'wrong',
                }"
              >
                <CardHeader class="gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                  <div class="space-y-2">
                    <Badge variant="secondary" class="w-fit">Smart Quiz</Badge>
                    <CardTitle class="text-xl sm:text-2xl">盲听 / 盲看测试</CardTitle>
                    <CardDescription class="leading-6">
                      {{ currentQuestion.title }}。答错后会立即显示正确答案和推导逻辑。
                    </CardDescription>
                  </div>
                  <Badge variant="outline" class="text-base">{{
                    currentQuestion.promptBadge
                  }}</Badge>
                </CardHeader>

                <CardContent class="space-y-6">
                  <div class="rounded-2xl bg-muted/50 p-5 sm:p-6">
                    <p class="text-sm text-muted-foreground">题目</p>
                    <h2 class="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      {{ currentQuestion.prompt }}
                    </h2>
                  </div>

                  <div class="grid gap-3 sm:grid-cols-2">
                    <Button
                      v-for="option in currentQuestion.options"
                      :key="option.id"
                      type="button"
                      variant="outline"
                      class="h-auto min-h-16 justify-center rounded-2xl px-4 py-4 text-lg font-semibold transition-all hover:-translate-y-0.5"
                      :class="optionButtonClass(option)"
                      :disabled="answerStatus !== 'idle'"
                      @click="chooseAnswer(option)"
                    >
                      {{ option.label }}
                    </Button>
                  </div>

                  <Transition name="feedback">
                    <div
                      v-if="answerStatus !== 'idle'"
                      class="flex gap-3 rounded-2xl border p-4"
                      :class="
                        answerStatus === 'correct'
                          ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
                          : 'border-destructive/40 bg-destructive/10 text-destructive'
                      "
                      role="status"
                      aria-live="polite"
                    >
                      <CheckCircle2
                        v-if="answerStatus === 'correct'"
                        class="mt-0.5 size-5 shrink-0"
                      />
                      <XCircle v-else class="mt-0.5 size-5 shrink-0" />
                      <div class="space-y-1">
                        <p class="font-semibold">{{ feedbackTitle }}</p>
                        <p class="text-sm leading-6 opacity-90">
                          {{ currentQuestion.explanation }}
                        </p>
                      </div>
                    </div>
                  </Transition>

                  <div class="flex flex-wrap items-center justify-between gap-3">
                    <p class="text-sm text-muted-foreground">
                      当前连击 {{ stats.currentStreak }}，最高连击 {{ stats.bestStreak }}。
                    </p>
                    <Button @click="nextQuestion">
                      <RefreshCcw class="size-4" />
                      {{ answerStatus === 'idle' ? '换一题' : '下一题' }}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Transition>

            <div class="space-y-4">
              <Card>
                <CardHeader>
                  <Badge variant="secondary" class="w-fit">Memory Tip</Badge>
                  <CardTitle class="flex items-center gap-2 text-lg">
                    <Lightbulb class="size-5 text-orange-500" />
                    两个特殊半音
                  </CardTitle>
                </CardHeader>
                <CardContent class="space-y-3 text-sm leading-6 text-muted-foreground">
                  <p>只要记住 3-4 是 E-F，7-1̇ 是 B-C，就能快速判断所有相邻自然音。</p>
                  <p>半音等于 1 个品格，全音等于 2 个品格。</p>
                </CardContent>
              </Card>

              <Card v-if="currentQuestion.kind === 'D'">
                <CardHeader>
                  <Badge variant="outline" class="w-fit">Mini Fretboard</Badge>
                  <CardTitle class="text-lg">本题指板提示</CardTitle>
                  <CardDescription>假设起点音在 0 品，观察目标音落在哪个品格。</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="fretboard-track">
                    <div
                      v-for="fret in frets"
                      :key="fret"
                      class="fret-cell"
                      :class="{ marked: Boolean(markerForFret(fret)) }"
                    >
                      <span class="fret-number">{{ fret }}品</span>
                      <span
                        v-if="markerForFret(fret)"
                        class="fret-marker"
                        :class="markerForFret(fret)?.type"
                      >
                        {{ markerForFret(fret)?.label }}
                      </span>
                    </div>
                  </div>
                  <p class="text-sm leading-6 text-muted-foreground">{{ fretboardDescription }}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          <section v-else key="fretboard" class="space-y-4">
            <Card>
              <CardHeader class="gap-3 lg:grid-cols-[1fr_auto]">
                <div class="space-y-2">
                  <Badge variant="secondary" class="w-fit">Mini Fretboard Layout</Badge>
                  <CardTitle class="text-xl sm:text-2xl">指板大闯关</CardTitle>
                  <CardDescription class="max-w-2xl leading-6">
                    选择或随机生成一个相邻自然音关系，把抽象音程转化成同一根弦上的品格距离。
                  </CardDescription>
                </div>
                <Button variant="outline" @click="nextFretChallenge">
                  <RefreshCcw class="size-4" />
                  随机一关
                </Button>
              </CardHeader>

              <CardContent class="space-y-6">
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  <button
                    v-for="interval in intervals"
                    :key="interval.id"
                    type="button"
                    class="rounded-2xl border p-3 text-left transition-all hover:-translate-y-0.5 hover:bg-muted/60 active:scale-[0.98]"
                    :class="[
                      selectedInterval.id === interval.id
                        ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                        : 'border-border bg-background',
                      interval.kind === 'half' && selectedInterval.id !== interval.id
                        ? 'border-orange-300 bg-orange-50/70 text-orange-800 dark:border-orange-900 dark:bg-orange-950/20 dark:text-orange-300'
                        : '',
                    ]"
                    @click="selectInterval(interval)"
                  >
                    <p class="font-semibold">
                      {{ noteByIndex(interval.fromIndex).letter }} →
                      {{ noteDisplayName(noteByIndex(interval.toIndex)) }}
                    </p>
                    <p
                      class="mt-1 text-xs"
                      :class="
                        selectedInterval.id === interval.id
                          ? 'text-primary-foreground/75'
                          : 'text-muted-foreground'
                      "
                    >
                      {{ intervalLabel(interval) }}
                    </p>
                  </button>
                </div>

                <div class="grid gap-4 lg:grid-cols-[1fr_360px]">
                  <div class="space-y-4 rounded-2xl border bg-muted/20 p-4">
                    <div class="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p class="text-sm text-muted-foreground">当前关卡</p>
                        <h3 class="text-2xl font-semibold tracking-tight">{{ fretboardTitle }}</h3>
                      </div>
                      <Badge :variant="fretboardInterval.kind === 'half' ? 'default' : 'outline'">
                        {{ intervalLabel(fretboardInterval) }}
                      </Badge>
                    </div>

                    <div class="fretboard-track large">
                      <div
                        v-for="fret in frets"
                        :key="fret"
                        class="fret-cell"
                        :class="{ marked: Boolean(markerForFret(fret)) }"
                      >
                        <span class="fret-number">{{ fret }}品</span>
                        <span
                          v-if="markerForFret(fret)"
                          class="fret-marker"
                          :class="markerForFret(fret)?.type"
                        >
                          {{ markerForFret(fret)?.label }}
                        </span>
                      </div>
                    </div>

                    <p class="text-sm leading-6 text-muted-foreground">
                      {{ fretboardDescription }}
                    </p>
                  </div>

                  <Card class="shadow-none">
                    <CardHeader>
                      <Badge variant="outline" class="w-fit">Challenge</Badge>
                      <CardTitle class="text-lg">从起点到目标要移动几品？</CardTitle>
                      <CardDescription>先根据 3-4、7-1̇ 判断半音，再换算成品格。</CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-4">
                      <div class="grid grid-cols-3 gap-2">
                        <Button
                          v-for="answer in fretAnswerOptions"
                          :key="answer"
                          type="button"
                          variant="outline"
                          class="h-14 rounded-2xl text-base font-semibold"
                          :class="fretOptionButtonClass(answer)"
                          :disabled="fretAnswerStatus !== 'idle'"
                          @click="answerFretChallenge(answer)"
                        >
                          {{ answer }} 品
                        </Button>
                      </div>

                      <Transition name="feedback">
                        <div
                          v-if="fretAnswerStatus !== 'idle'"
                          class="rounded-2xl border p-4 text-sm leading-6"
                          :class="
                            fretAnswerStatus === 'correct'
                              ? 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-300'
                              : 'border-destructive/40 bg-destructive/10 text-destructive'
                          "
                          role="status"
                          aria-live="polite"
                        >
                          <p class="font-semibold">{{ fretFeedbackTitle }}</p>
                          <p class="mt-1 opacity-90">{{ intervalTheory(selectedInterval) }}</p>
                        </div>
                      </Transition>

                      <Button class="w-full" @click="nextFretChallenge">
                        <RefreshCcw class="size-4" />
                        下一关
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </section>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.visible-scrollbar {
  scrollbar-width: thin;
}

.visible-scrollbar::-webkit-scrollbar {
  display: block;
  width: 8px;
  height: 8px;
}

.visible-scrollbar::-webkit-scrollbar-thumb {
  background-color: color-mix(in oklab, var(--foreground) 20%, transparent);
  border-radius: 9999px;
}

.visible-scrollbar::-webkit-scrollbar-track {
  background-color: transparent;
}

.note-card {
  transform-style: preserve-3d;
}

.note-card:hover {
  transform: translateY(-0.25rem) rotateX(4deg);
}

.interval-pill {
  min-width: 5.75rem;
}

.fretboard-track {
  display: grid;
  grid-template-columns: repeat(6, minmax(4.5rem, 1fr));
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1rem;
  background:
    linear-gradient(90deg, color-mix(in oklab, var(--muted) 72%, transparent), transparent),
    color-mix(in oklab, var(--card) 92%, var(--muted));
}

.fretboard-track.large {
  grid-template-columns: repeat(6, minmax(5.75rem, 1fr));
}

.fret-cell {
  position: relative;
  min-height: 7rem;
  border-right: 3px solid color-mix(in oklab, var(--foreground) 20%, transparent);
}

.fret-cell:last-child {
  border-right: 0;
}

.fret-cell::before {
  position: absolute;
  top: 52%;
  right: 0;
  left: 0;
  height: 4px;
  content: '';
  background: linear-gradient(
    90deg,
    color-mix(in oklab, var(--foreground) 34%, transparent),
    color-mix(in oklab, var(--foreground) 54%, transparent)
  );
  transform: translateY(-50%);
}

.fret-cell.marked {
  background: color-mix(in oklab, orange 13%, transparent);
}

.fret-number {
  position: absolute;
  top: 0.65rem;
  left: 0.65rem;
  color: var(--muted-foreground);
  font-size: 0.75rem;
  font-weight: 700;
}

.fret-marker {
  position: absolute;
  top: 52%;
  left: 50%;
  z-index: 2;
  display: grid;
  min-width: 3.25rem;
  min-height: 3.25rem;
  place-items: center;
  padding: 0.5rem;
  border: 3px solid var(--background);
  border-radius: 9999px;
  color: var(--primary-foreground);
  background: var(--primary);
  box-shadow: 0 18px 32px color-mix(in oklab, var(--foreground) 18%, transparent);
  font-size: 0.75rem;
  font-weight: 800;
  transform: translate(-50%, -50%);
}

.fret-marker.end {
  color: white;
  background: #f97316;
}

.mode-fade-enter-active,
.mode-fade-leave-active,
.feedback-enter-active,
.feedback-leave-active,
.card-flip-enter-active,
.card-flip-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.mode-fade-enter-from,
.mode-fade-leave-to,
.feedback-enter-from,
.feedback-leave-to {
  opacity: 0;
  transform: translateY(0.5rem);
}

.card-flip-enter-from,
.card-flip-leave-to {
  opacity: 0;
  transform: rotateX(8deg) translateY(0.5rem);
}

.animate-correct-flash {
  animation: correct-flash 0.65s ease;
}

.animate-wrong-shake {
  animation: wrong-shake 0.42s ease;
}

@keyframes correct-flash {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab, #22c55e 0%, transparent);
  }

  45% {
    box-shadow: 0 0 0 8px color-mix(in oklab, #22c55e 22%, transparent);
  }
}

@keyframes wrong-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  20% {
    transform: translateX(-8px);
  }

  40% {
    transform: translateX(8px);
  }

  60% {
    transform: translateX(-5px);
  }

  80% {
    transform: translateX(5px);
  }
}

@media (max-width: 640px) {
  .fretboard-track,
  .fretboard-track.large {
    grid-template-columns: repeat(6, minmax(4.75rem, 1fr));
    overflow-x: auto;
  }

  .fret-cell {
    min-height: 6.5rem;
  }
}
</style>
