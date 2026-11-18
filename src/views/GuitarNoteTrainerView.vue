<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'

import ToolPageHeader from '@/components/ToolPageHeader.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Volume2,
  XCircle,
} from 'lucide-vue-next'

type Mode = 'reference' | 'quiz' | 'ear' | 'fretboard'
type IntervalKind = 'whole' | 'half'
type QuestionKind = 'A' | 'B' | 'C' | 'D'
type AnswerStatus = 'idle' | 'correct' | 'wrong'
type FretAnswer = 1 | 2 | 3
type EarAnswerMode = 'letter' | 'number' | 'solfege'

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

interface EarOption {
  id: string
  label: string
  value: string
}

interface EarQuestion {
  id: string
  noteIndex: number
  answerMode: EarAnswerMode
  options: EarOption[]
  answer: string
  answerLabel: string
}

const STORAGE_KEY = 'tools:guitar-note-trainer:stats'
const NOTE_ROOT_MIDI = 60
const GUITAR_NOTE_DURATION_SECONDS = 1.15
const SCALE_MIDI_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12] as const
const NOTE_OPTION_OFFSETS: Record<string, number> = {
  '1': 0,
  '2': 2,
  '3': 4,
  '4': 5,
  '5': 7,
  '6': 9,
  '7': 11,
  '1̇': 12,
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
  do: 0,
  re: 2,
  mi: 4,
  fa: 5,
  sol: 7,
  la: 9,
  si: 11,
}

type AudioContextConstructor = new () => AudioContext

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: AudioContextConstructor
  }

let audioContext: AudioContext | null = null

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
    id: 'ear',
    label: '听音识别',
    description: '听吉他音选答案',
    icon: Volume2,
  },
  {
    id: 'fretboard',
    label: '指板大闯关',
    description: '把距离落到品格',
    icon: Guitar,
  },
]

const earAnswerModes: Array<{
  id: EarAnswerMode
  label: string
  description: string
}> = [
  {
    id: 'letter',
    label: '音名 CDEFGABC',
    description: '听吉他音，选择 C D E F G A B 或高音 C。',
  },
  {
    id: 'number',
    label: '简谱 12345671̇',
    description: '听吉他音，选择 1 2 3 4 5 6 7 或高音 1̇。',
  },
  {
    id: 'solfege',
    label: '唱名 do...si',
    description: '听吉他音，选择 do re mi fa sol la si 或高音 do。',
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
const earAnswerMode = ref<EarAnswerMode>('letter')
const earQuestion = ref<EarQuestion>(createEarQuestion('letter'))
const selectedEarAnswer = ref<string | null>(null)
const earAnswerStatus = ref<AnswerStatus>('idle')
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

const earQuestionNote = computed(() => noteByIndex(earQuestion.value.noteIndex))

const earFeedbackTitle = computed(() => {
  if (earAnswerStatus.value === 'correct') return `听对了：${earQuestion.value.answerLabel}`
  return `正确答案：${earQuestion.value.answerLabel}`
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

function selectMode(mode: string | number) {
  const nextMode = (['reference', 'quiz', 'ear', 'fretboard'] as const).find((m) => m === mode)
  if (!nextMode) return
  currentMode.value = nextMode

  if (nextMode === 'ear') {
    void playEarQuestion()
  }
}

function selectNote(index: number) {
  selectedNoteIndex.value = index
  void playGuitarNote(noteIndexFrequency(index))

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

function playQuizOptionSound(option: QuizOption) {
  const frequency = quizOptionFrequency(option, currentQuestion.value)
  if (frequency === null) return

  void playGuitarNote(frequency)
}

function playFretAnswerSound(answer: FretAnswer) {
  const frequency = midiToFrequency(midiForNoteIndex(selectedInterval.value.fromIndex) + answer)

  void playGuitarNote(frequency)
}

function playEarOptionSound(option: EarOption) {
  const noteIndex = Number.parseInt(option.value, 10)
  if (!Number.isInteger(noteIndex)) return

  void playGuitarNote(noteIndexFrequency(noteIndex))
}

function quizOptionFrequency(option: QuizOption, question: QuizQuestion) {
  if (question.kind === 'C') {
    const semitones = intervalOptionSemitones(option.value)
    if (semitones === null) return null

    const interval = question.interval ?? selectedInterval.value
    return midiToFrequency(midiForNoteIndex(interval.fromIndex) + semitones)
  }

  if (question.kind === 'D') {
    const frets = fretOptionValue(option.value)
    if (frets === null) return null

    const interval = question.interval ?? selectedInterval.value
    return midiToFrequency(midiForNoteIndex(interval.fromIndex) + frets)
  }

  return noteOptionFrequency(
    option.value,
    question.kind === 'A' && question.promptBadge === '1̇' ? 12 : 0,
  )
}

function noteOptionFrequency(value: string, octaveOffset: number) {
  const scaleOffset = NOTE_OPTION_OFFSETS[value]
  if (scaleOffset === undefined) return null

  const effectiveOctaveOffset = value === '1̇' ? 0 : octaveOffset
  return midiToFrequency(NOTE_ROOT_MIDI + scaleOffset + effectiveOctaveOffset)
}

function intervalOptionSemitones(value: string) {
  if (value === '半音') return 1
  if (value === '全音') return 2
  return null
}

function fretOptionValue(value: string) {
  const frets = Number.parseInt(value, 10)
  return frets >= 1 && frets <= 3 ? frets : null
}

function midiForNoteIndex(index: number) {
  return NOTE_ROOT_MIDI + (SCALE_MIDI_OFFSETS[index] ?? SCALE_MIDI_OFFSETS[0])
}

function noteIndexFrequency(index: number) {
  return midiToFrequency(midiForNoteIndex(index))
}

function midiToFrequency(midi: number) {
  return 440 * 2 ** ((midi - 69) / 12)
}

async function playGuitarNote(frequency: number) {
  try {
    const context = getAudioContext()
    if (!context) return

    if (context.state === 'suspended') {
      await context.resume()
    }

    const startTime = context.currentTime
    const source = context.createBufferSource()
    const bodyFilter = context.createBiquadFilter()
    const resonanceFilter = context.createBiquadFilter()
    const gain = context.createGain()

    source.buffer = createGuitarPluckBuffer(context, frequency, GUITAR_NOTE_DURATION_SECONDS)

    bodyFilter.type = 'lowpass'
    bodyFilter.frequency.setValueAtTime(Math.min(5200, frequency * 14), startTime)
    bodyFilter.Q.setValueAtTime(0.85, startTime)

    resonanceFilter.type = 'peaking'
    resonanceFilter.frequency.setValueAtTime(190, startTime)
    resonanceFilter.Q.setValueAtTime(0.75, startTime)
    resonanceFilter.gain.setValueAtTime(3.2, startTime)

    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.62, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + GUITAR_NOTE_DURATION_SECONDS)

    source.connect(bodyFilter)
    bodyFilter.connect(resonanceFilter)
    resonanceFilter.connect(gain)
    gain.connect(context.destination)

    source.start(startTime)
    source.stop(startTime + GUITAR_NOTE_DURATION_SECONDS)
  } catch {
    // 音频播放失败时，不影响答题流程。
  }
}

function getAudioContext() {
  if (audioContext) return audioContext

  const AudioContextClass =
    window.AudioContext ?? (window as WindowWithWebkitAudioContext).webkitAudioContext
  if (!AudioContextClass) return null

  audioContext = new AudioContextClass()
  return audioContext
}

function createGuitarPluckBuffer(
  context: AudioContext,
  frequency: number,
  durationSeconds: number,
) {
  const sampleRate = context.sampleRate
  const length = Math.floor(sampleRate * durationSeconds)
  const buffer = context.createBuffer(1, length, sampleRate)
  const data = buffer.getChannelData(0)
  const period = Math.max(2, Math.round(sampleRate / frequency))
  const stringBuffer = new Float32Array(period)
  const damping = Math.min(0.997, Math.max(0.985, 0.995 - frequency / 90000))

  for (let index = 0; index < period; index += 1) {
    stringBuffer[index] = Math.random() * 2 - 1
  }

  for (let index = 0; index < length; index += 1) {
    const stringIndex = index % period
    const nextStringIndex = (stringIndex + 1) % period
    const sample = stringBuffer[stringIndex] ?? 0
    const averagedSample = (sample + (stringBuffer[nextStringIndex] ?? 0)) * 0.5
    const pickNoiseEnvelope = index < period ? 1 - index / period : 0
    const pickNoise = (Math.random() * 2 - 1) * pickNoiseEnvelope * 0.16

    stringBuffer[stringIndex] = averagedSample * damping
    data[index] = (sample * 0.82 + pickNoise) * 0.75
  }

  return buffer
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

  void playQuizOptionSound(option)
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

function selectEarAnswerMode(mode: EarAnswerMode) {
  if (earAnswerMode.value === mode) return

  earAnswerMode.value = mode
  nextEarQuestion(true)
}

function playEarQuestion() {
  void playGuitarNote(noteIndexFrequency(earQuestion.value.noteIndex))
}

function chooseEarAnswer(option: EarOption) {
  if (earAnswerStatus.value !== 'idle') return

  playEarOptionSound(option)
  selectedEarAnswer.value = option.value
  const isCorrect = option.value === earQuestion.value.answer

  earAnswerStatus.value = isCorrect ? 'correct' : 'wrong'
  recordAnswer(isCorrect)
}

function nextEarQuestion(shouldPlay = false) {
  earQuestion.value = createEarQuestion(earAnswerMode.value)
  selectedEarAnswer.value = null
  earAnswerStatus.value = 'idle'

  if (shouldPlay) {
    void playEarQuestion()
  }
}

function answerFretChallenge(answer: FretAnswer) {
  if (fretAnswerStatus.value !== 'idle') return

  void playFretAnswerSound(answer)
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
    'border-ink bg-ink text-surface hover:bg-ink':
      answerStatus.value !== 'idle' && option.value === currentQuestion.value.answer,
    'border-danger bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))] text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))]':
      answerStatus.value === 'wrong' &&
      selectedAnswer.value === option.value &&
      option.value !== currentQuestion.value.answer,
    'ring-2 ring-ink': answerStatus.value === 'idle' && selectedAnswer.value === option.value,
  }
}

function fretOptionButtonClass(answer: FretAnswer) {
  return {
    'border-ink bg-ink text-surface hover:bg-ink':
      fretAnswerStatus.value !== 'idle' && answer === selectedInterval.value.frets,
    'border-danger bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))] text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))]':
      fretAnswerStatus.value === 'wrong' &&
      selectedFretAnswer.value === answer &&
      answer !== selectedInterval.value.frets,
  }
}

function earOptionButtonClass(option: EarOption) {
  return {
    'border-ink bg-ink text-surface hover:bg-ink':
      earAnswerStatus.value !== 'idle' && option.value === earQuestion.value.answer,
    'border-danger bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))] text-danger hover:bg-[color-mix(in_oklab,var(--color-danger)_12%,var(--color-raised))]':
      earAnswerStatus.value === 'wrong' &&
      selectedEarAnswer.value === option.value &&
      option.value !== earQuestion.value.answer,
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

function createEarQuestion(answerMode: EarAnswerMode): EarQuestion {
  const noteIndex = Math.floor(Math.random() * notes.length)

  return {
    id: createId(),
    noteIndex,
    answerMode,
    options: createEarOptions(answerMode),
    answer: String(noteIndex),
    answerLabel: earOptionLabel(noteByIndex(noteIndex), noteIndex, answerMode),
  }
}

function createEarOptions(answerMode: EarAnswerMode) {
  return notes.map((note, index) => ({
    id: `${answerMode}-${note.id}`,
    label: earOptionLabel(note, index, answerMode),
    value: String(index),
  }))
}

function earOptionLabel(note: NoteItem, index: number, answerMode: EarAnswerMode) {
  if (answerMode === 'letter') return index === notes.length - 1 ? '高音 C' : note.letter
  if (answerMode === 'number') return note.number
  return index === notes.length - 1 ? '高音 do' : note.solfege
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

const modeModel = computed({
  get: () => currentMode.value,
  set: (val: string | number | undefined) => {
    if (val !== undefined) selectMode(val)
  },
})
</script>

<template>
  <div class="space-y-5 pb-8">
    <ToolPageHeader
      title="吉他简谱记忆训练"
      description="对照记忆 1-C-do 到 7-B-si，结合吉他拨弦音色与「全音 2 品、半音 1 品」距离强化肌肉记忆。"
      :icon="Guitar"
    >
      <template #actions>
        <div class="flex flex-wrap items-center gap-2">
          <div
            class="inline-flex items-center gap-1.5 rounded-control border border-line bg-raised px-2.5 py-1.5 text-[12px]"
          >
            <Activity class="size-3.5 text-[var(--p0seid0n-upload)]" />
            <span class="text-ink-muted">正确率</span>
            <strong class="font-condensed tabular-nums font-medium text-ink"
              >{{ accuracy }}%</strong
            >
            <span class="text-ink-muted tabular-nums">({{ stats.correct }}/{{ stats.total }})</span>
          </div>

          <div
            class="inline-flex items-center gap-1.5 rounded-control border border-line bg-raised px-2.5 py-1.5 text-[12px]"
          >
            <Target class="size-3.5 text-accent" />
            <span class="text-ink-muted">连击</span>
            <strong class="font-condensed tabular-nums font-medium text-ink">{{
              stats.currentStreak
            }}</strong>
          </div>

          <div
            class="inline-flex items-center gap-1.5 rounded-control border border-line bg-raised px-2.5 py-1.5 text-[12px]"
          >
            <Trophy class="size-3.5 text-[var(--p0seid0n-upload)]" />
            <span class="text-ink-muted">最高</span>
            <strong class="font-condensed tabular-nums font-medium text-ink">{{
              stats.bestStreak
            }}</strong>
          </div>

          <Button
            v-if="stats.total > 0"
            variant="ghost"
            size="sm"
            class="text-ink-muted hover:text-ink"
            @click="resetStats"
          >
            <RotateCcw class="size-3.5" />
            重置
          </Button>
        </div>
      </template>
    </ToolPageHeader>

    <!-- Mode Switcher Tabs -->
    <Tabs v-model="modeModel">
      <TabsList class="flex-wrap">
        <TabsTrigger v-for="mode in modes" :key="mode.id" :value="mode.id">
          <component :is="mode.icon" class="size-4 shrink-0" />
          <span>{{ mode.label }}</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>

    <Transition name="mode-fade" mode="out-in">
      <section v-if="currentMode === 'reference'" key="reference" class="space-y-4">
        <Card>
          <CardHeader class="flex-col gap-3 lg:flex-row lg:items-start">
            <template #title>
              <span class="inline-flex items-center gap-2 text-lg">
                <span>对照学习面板</span>
                <Badge variant="neutral">点击卡片试听音高</Badge>
              </span>
            </template>
            <template #description>
              <p class="max-w-2xl text-[14px] leading-6 text-ink-muted">
                点击任意音符卡片试听吉他拨弦音高，或点击音程胶囊查看相邻音之间的全音、半音关系。
              </p>
            </template>
            <template #action>
              <div
                class="rounded-control border border-line bg-surface px-4 py-3 text-[13px] leading-6 text-ink-muted"
              >
                <strong class="text-ink">核心口诀：</strong>
                3-4（E-F）和 7-1̇（B-C）是半音（1 品）；其余相邻自然音都是全音（2 品）。
              </div>
            </template>
          </CardHeader>

          <CardContent class="space-y-6">
            <div class="-mx-1 overflow-x-auto px-1 pb-2">
              <div class="flex min-w-max items-stretch gap-2">
                <template v-for="(note, index) in notes" :key="note.id">
                  <button
                    type="button"
                    class="note-card group w-[8.25rem] rounded-panel border border-line bg-surface p-4 text-left transition-all hover:-translate-y-1 active:scale-[0.98] sm:w-[9rem]"
                    :class="{
                      'border-ink ring-2 ring-ink/20': selectedNoteIndex === index,
                      'border-[var(--p0seid0n-upload)] bg-[color-mix(in_oklab,var(--p0seid0n-upload)_10%,var(--color-surface))]':
                        isNoteInActiveInterval(index),
                    }"
                    @click="selectNote(index)"
                  >
                    <div class="flex items-start justify-between">
                      <span
                        class="block font-condensed text-3xl font-medium tracking-tight text-ink sm:text-4xl"
                      >
                        {{ note.number }}
                      </span>
                      <Volume2
                        class="size-3.5 text-ink-faint transition-colors group-hover:text-[var(--p0seid0n-upload)]"
                      />
                    </div>
                    <span class="mt-2.5 block text-xl font-semibold text-ink sm:text-2xl">{{
                      note.letter
                    }}</span>
                    <span class="block text-[14px] font-medium text-[var(--p0seid0n-upload)]">
                      {{ note.solfege }}
                    </span>
                    <span class="mt-2.5 block text-[12px] leading-5 text-ink-muted">
                      {{ note.hint }}
                    </span>
                  </button>

                  <button
                    v-if="index < intervals.length"
                    :key="intervals[index]?.id"
                    type="button"
                    class="interval-pill self-center rounded-full border px-3 py-2 text-center text-[12px] font-semibold transition-all hover:-translate-y-0.5 active:scale-95 sm:px-4"
                    :class="[
                      intervals[index]?.kind === 'half'
                        ? 'border-[var(--p0seid0n-upload)] bg-[color-mix(in_oklab,var(--p0seid0n-upload)_12%,var(--color-surface))] text-danger'
                        : 'border-line bg-control text-ink-muted',
                      intervals[index] && isIntervalHighlighted(intervals[index])
                        ? 'scale-105 ring-2 ring-[var(--p0seid0n-upload)]'
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
              class="grid gap-4 rounded-panel border p-4 sm:grid-cols-[auto_1fr] sm:items-center"
              :class="
                selectedInterval.kind === 'half'
                  ? 'border-[var(--p0seid0n-upload)] bg-[color-mix(in_oklab,var(--p0seid0n-upload)_10%,var(--color-surface))]'
                  : 'border-line bg-surface'
              "
            >
              <div class="flex flex-wrap items-center gap-3 text-lg font-semibold text-ink">
                <span>{{ noteSignature(selectedIntervalFromNote) }}</span>
                <ArrowRight class="size-5 text-ink-muted" />
                <span>{{ noteSignature(selectedIntervalToNote) }}</span>
              </div>
              <div class="space-y-1">
                <Badge :variant="selectedInterval.kind === 'half' ? 'accent-alt' : 'outline'">
                  {{ intervalLabel(selectedInterval) }}
                </Badge>
                <p class="text-[14px] leading-6 text-ink-muted">
                  {{ intervalTheory(selectedInterval) }}
                </p>
              </div>
            </div>

            <div class="overflow-hidden rounded-panel border border-line">
              <Table>
                <TableHeader class="bg-control">
                  <TableRow class="hover:bg-transparent">
                    <TableHead>简谱</TableHead>
                    <TableHead>音名</TableHead>
                    <TableHead>唱名</TableHead>
                    <TableHead>记忆提示</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="note in notes" :key="note.id">
                    <TableCell class="font-semibold">{{ note.number }}</TableCell>
                    <TableCell>{{ note.letter }}</TableCell>
                    <TableCell>{{ note.solfege }}</TableCell>
                    <TableCell class="text-ink-muted">{{ note.hint }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
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
              'border-accent': answerStatus === 'correct',
              'border-danger': answerStatus === 'wrong',
              'animate-correct-flash': answerStatus === 'correct',
              'animate-wrong-shake': answerStatus === 'wrong',
            }"
          >
            <CardHeader>
              <template #title>
                <span class="flex flex-col gap-1.5">
                  <Badge variant="neutral" class="w-fit">随机问答</Badge>
                  <span class="text-lg">盲听 / 盲看测试</span>
                </span>
              </template>
              <template #description>
                <p class="text-[14px] leading-6 text-ink-muted">
                  {{ currentQuestion.title }}。答错后会立即显示正确答案与推导逻辑。
                </p>
              </template>
              <template #action>
                <Badge variant="outline" class="text-[14px]">{{
                  currentQuestion.promptBadge
                }}</Badge>
              </template>
            </CardHeader>

            <CardContent class="space-y-5">
              <div class="rounded-panel border border-line bg-surface p-5">
                <p class="text-[12px] text-ink-muted">题目</p>
                <h2 class="mt-1.5 text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                  {{ currentQuestion.prompt }}
                </h2>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <Button
                  v-for="option in currentQuestion.options"
                  :key="option.id"
                  type="button"
                  variant="secondary"
                  class="min-h-14 justify-center rounded-panel border border-line px-4 py-3.5 text-[16px] font-semibold sm:text-[17px]"
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
                  class="flex gap-3 rounded-panel border p-4"
                  :class="
                    answerStatus === 'correct'
                      ? 'border-accent bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))] text-ink'
                      : 'border-danger bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface))] text-danger'
                  "
                  role="status"
                  aria-live="polite"
                >
                  <CheckCircle2
                    v-if="answerStatus === 'correct'"
                    class="mt-0.5 size-5 shrink-0 text-accent"
                  />
                  <XCircle v-else class="mt-0.5 size-5 shrink-0 text-danger" />
                  <div class="space-y-1">
                    <p class="font-semibold">{{ feedbackTitle }}</p>
                    <p class="text-[14px] leading-6 text-ink-muted">
                      {{ currentQuestion.explanation }}
                    </p>
                  </div>
                </div>
              </Transition>

              <div class="flex flex-wrap items-center justify-between gap-3">
                <p class="text-[14px] text-ink-muted">
                  当前连击 {{ stats.currentStreak }}，最高连击 {{ stats.bestStreak }}。
                </p>
                <Button size="sm" @click="nextQuestion">
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
              <template #title>
                <span class="flex flex-col gap-1.5">
                  <Badge variant="neutral" class="w-fit">记忆口诀</Badge>
                  <span class="inline-flex items-center gap-2">
                    <Lightbulb class="size-5 text-[var(--p0seid0n-upload)]" />
                    <span>两个特殊半音</span>
                  </span>
                </span>
              </template>
            </CardHeader>
            <CardContent class="space-y-2.5 pt-0 text-[14px] leading-6 text-ink-muted">
              <p>只要记住 3-4 是 E-F，7-1̇ 是 B-C，就能快速判断所有相邻自然音。</p>
              <p>吉他同弦上：半音移动 1 个品格，全音移动 2 个品格。</p>
            </CardContent>
          </Card>

          <Card v-if="currentQuestion.kind === 'D'">
            <CardHeader>
              <template #title>
                <span class="flex flex-col gap-1.5">
                  <Badge variant="outline" class="w-fit">指板示意</Badge>
                  <span>本题指板提示</span>
                </span>
              </template>
              <template #description>
                <p class="text-[13px] text-ink-muted">
                  假设起点音在 0 品，观察目标音落在哪个品格。
                </p>
              </template>
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
              <p class="text-[14px] leading-6 text-ink-muted">{{ fretboardDescription }}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        v-else-if="currentMode === 'ear'"
        key="ear"
        class="grid gap-4 lg:grid-cols-[0.78fr_1.22fr]"
      >
        <Card>
          <CardHeader>
            <template #title>
              <span class="flex flex-col gap-1.5">
                <Badge variant="neutral" class="w-fit">答题格式</Badge>
                <span class="inline-flex items-center gap-2 text-lg">
                  <Volume2 class="size-5 text-[var(--p0seid0n-upload)]" />
                  <span>听音识别模式</span>
                </span>
              </span>
            </template>
            <template #description>
              <p class="text-[14px] leading-6 text-ink-muted">
                先听吉他拨弦音，再选择对应音名、简谱或唱名。点击选项也会播放该选项的实际音高以便对比。
              </p>
            </template>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid gap-2">
              <button
                v-for="answerMode in earAnswerModes"
                :key="answerMode.id"
                type="button"
                class="rounded-panel border p-3.5 text-left transition-all active:scale-[0.99]"
                :class="
                  earAnswerMode === answerMode.id
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink hover:bg-control'
                "
                @click="selectEarAnswerMode(answerMode.id)"
              >
                <p class="text-[15px] font-semibold">{{ answerMode.label }}</p>
                <p
                  class="mt-1 text-[12px] leading-5"
                  :class="earAnswerMode === answerMode.id ? 'opacity-80' : 'text-ink-muted'"
                >
                  {{ answerMode.description }}
                </p>
              </button>
            </div>

            <div
              class="rounded-panel border border-line bg-surface p-3.5 text-[13px] leading-6 text-ink-muted"
            >
              <strong class="text-ink">音域范围：</strong>
              C D E F G A B 高音 C，对应 1 2 3 4 5 6 7 1̇，以及 do re mi fa sol la si 高音 do。
            </div>
          </CardContent>
        </Card>

        <Card
          class="overflow-hidden"
          :class="{
            'border-accent': earAnswerStatus === 'correct',
            'border-danger': earAnswerStatus === 'wrong',
            'animate-correct-flash': earAnswerStatus === 'correct',
            'animate-wrong-shake': earAnswerStatus === 'wrong',
          }"
        >
          <CardHeader>
            <template #title>
              <span class="flex flex-col gap-1.5">
                <Badge variant="outline" class="w-fit">听音辨位</Badge>
                <span class="text-lg">听到的是哪个音？</span>
              </span>
            </template>
            <template #description>
              <p class="text-[14px] leading-6 text-ink-muted">
                点击喇叭按钮重播题目音，从下方按钮组中选出答案。
              </p>
            </template>
            <template #action>
              <Button variant="secondary" size="sm" @click="playEarQuestion">
                <Volume2 class="size-4" />
                重播题目音
              </Button>
            </template>
          </CardHeader>

          <CardContent class="space-y-5">
            <div class="rounded-panel border border-line bg-surface p-5 text-center">
              <div class="flex justify-center">
                <button
                  type="button"
                  class="grid size-20 place-items-center rounded-full border border-line bg-raised transition-all hover:-translate-y-0.5 hover:bg-control active:scale-95"
                  aria-label="播放题目音"
                  @click="playEarQuestion"
                >
                  <Volume2 class="size-9 text-[var(--p0seid0n-upload)]" />
                </button>
              </div>
              <p class="mt-3 text-[12px] text-ink-muted">点击图标播放吉他音色，凭听觉判断音级</p>
            </div>

            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Button
                v-for="option in earQuestion.options"
                :key="option.id"
                type="button"
                variant="secondary"
                class="min-h-12 rounded-panel border border-line text-[16px] font-semibold"
                :class="earOptionButtonClass(option)"
                :disabled="earAnswerStatus !== 'idle'"
                @click="chooseEarAnswer(option)"
              >
                {{ option.label }}
              </Button>
            </div>

            <Transition name="feedback">
              <div
                v-if="earAnswerStatus !== 'idle'"
                class="flex gap-3 rounded-panel border p-4"
                :class="
                  earAnswerStatus === 'correct'
                    ? 'border-accent bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))] text-ink'
                    : 'border-danger bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface))] text-danger'
                "
                role="status"
                aria-live="polite"
              >
                <CheckCircle2
                  v-if="earAnswerStatus === 'correct'"
                  class="mt-0.5 size-5 shrink-0 text-accent"
                />
                <XCircle v-else class="mt-0.5 size-5 shrink-0 text-danger" />
                <div class="space-y-1">
                  <p class="font-semibold">{{ earFeedbackTitle }}</p>
                  <p class="text-[14px] leading-6 text-ink-muted">
                    {{ noteSignature(earQuestionNote) }}。可点击上方重播题目音对比音高。
                  </p>
                </div>
              </div>
            </Transition>

            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-[14px] text-ink-muted">
                当前连击 {{ stats.currentStreak }}，最高连击 {{ stats.bestStreak }}。
              </p>
              <Button size="sm" @click="nextEarQuestion(true)">
                <RefreshCcw class="size-4" />
                {{ earAnswerStatus === 'idle' ? '换一个音' : '下一题' }}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <section v-else key="fretboard" class="space-y-4">
        <Card>
          <CardHeader>
            <template #title>
              <span class="flex flex-col gap-1.5">
                <Badge variant="neutral" class="w-fit">同弦品格换算</Badge>
                <span class="text-lg">指板大闯关</span>
              </span>
            </template>
            <template #description>
              <p class="max-w-2xl text-[14px] leading-6 text-ink-muted">
                选择或随机生成一组相邻自然音，把音程关系换算成同一根琴弦上的品格移动距离。
              </p>
            </template>
            <template #action>
              <Button variant="secondary" size="sm" @click="nextFretChallenge">
                <RefreshCcw class="size-4" />
                随机一关
              </Button>
            </template>
          </CardHeader>

          <CardContent class="space-y-6">
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              <button
                v-for="interval in intervals"
                :key="interval.id"
                type="button"
                class="rounded-panel border p-3 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                :class="[
                  selectedInterval.id === interval.id
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface text-ink hover:bg-control',
                  interval.kind === 'half' && selectedInterval.id !== interval.id
                    ? 'border-[var(--p0seid0n-upload)] bg-[color-mix(in_oklab,var(--p0seid0n-upload)_10%,var(--color-surface))]'
                    : '',
                ]"
                @click="selectInterval(interval)"
              >
                <p class="font-semibold">
                  {{ noteByIndex(interval.fromIndex).letter }} →
                  {{ noteDisplayName(noteByIndex(interval.toIndex)) }}
                </p>
                <p
                  class="mt-1 text-[12px]"
                  :class="selectedInterval.id === interval.id ? 'opacity-80' : 'text-ink-muted'"
                >
                  {{ intervalLabel(interval) }}
                </p>
              </button>
            </div>

            <div class="grid gap-4 lg:grid-cols-[1fr_340px]">
              <div class="space-y-4 rounded-panel border border-line bg-surface p-4">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p class="text-[12px] text-ink-muted">当前关卡</p>
                    <h3 class="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
                      {{ fretboardTitle }}
                    </h3>
                  </div>
                  <Badge :variant="fretboardInterval.kind === 'half' ? 'accent-alt' : 'outline'">
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

                <p class="text-[14px] leading-6 text-ink-muted">
                  {{ fretboardDescription }}
                </p>
              </div>

              <Card appearance="surface">
                <CardHeader>
                  <template #title>
                    <span class="flex flex-col gap-1.5">
                      <Badge variant="outline" class="w-fit">品格挑战</Badge>
                      <span>从起点到目标要移动几品？</span>
                    </span>
                  </template>
                  <template #description>
                    <p class="text-[13px] text-ink-muted">
                      先根据 3-4、7-1̇ 判断半音，再换算成品格。
                    </p>
                  </template>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div class="grid grid-cols-3 gap-2">
                    <Button
                      v-for="answer in fretAnswerOptions"
                      :key="answer"
                      type="button"
                      variant="secondary"
                      class="min-h-12 rounded-panel border border-line text-[16px] font-semibold"
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
                      class="rounded-panel border p-4 text-[14px] leading-6"
                      :class="
                        fretAnswerStatus === 'correct'
                          ? 'border-accent bg-[color-mix(in_oklab,var(--color-accent)_10%,var(--color-surface))] text-ink'
                          : 'border-danger bg-[color-mix(in_oklab,var(--color-danger)_10%,var(--color-surface))] text-danger'
                      "
                      role="status"
                      aria-live="polite"
                    >
                      <p class="font-semibold">{{ fretFeedbackTitle }}</p>
                      <p class="mt-1 text-ink-muted">{{ intervalTheory(selectedInterval) }}</p>
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
</template>

<style scoped>
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
  color: var(--p0seid0n-surface);
  background: var(--p0seid0n-upload);
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
