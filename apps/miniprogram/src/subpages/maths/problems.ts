/**
 * 20 以内进位加法用凑十法，20 以内退位减法用破十法，都是一年级的计算重点。
 * 凑十法：看大数，拆小数，先凑成十，再加剩下的数。7+8：拆 7 成 5 和 2，8+2=10，10+5=15。
 * 破十法：把十几拆成 10 和几，先用 10 减，再加剩下的几。15-9：15 拆成 10 和 5，10-9=1，1+5=6。
 */
export type TenKind = 'make10' | 'break10'
export type MathKind = TenKind | 'mixed'

export type Problem = { a: number; b: number; op: '+' | '-' }

export type KindInfo = {
  kind: MathKind
  name: string
  title: string
  summary: string
  placeholder: string
  rules: string[]
}

export const MATH_KINDS: KindInfo[] = [
  {
    kind: 'break10',
    name: '破十法',
    title: '破十法练习题',
    summary: '20 以内退位减法',
    placeholder: '输入算式，用；隔开，例如：15-9；13-6；12-5',
    rules: [
      '多道算式用；隔开，例如：15-9；13-6；12-5',
      '被减数是 11–18，减数是 2–9，个位不够减时才用破十法',
      '把十几拆成 10 和几，先用 10 减去减数，再加上剩下的几',
      '例：15-9，15 拆成 10 和 5，10-9=1，1+5=6',
    ],
  },
  {
    kind: 'make10',
    name: '凑十法',
    title: '凑十法练习题',
    summary: '20 以内进位加法',
    placeholder: '输入算式，用；隔开，例如：7+6；5+9；8+4',
    rules: [
      '多道算式用；隔开，例如：7+6；5+9；8+4',
      '两个加数都在 2–9 之间，和大于 10（11–18）',
      '看大数，拆小数：小的数拆成凑十的数和剩下的数',
      '凑十口诀：9 凑 1，8 凑 2，7 凑 3，6 凑 4，5 凑 5',
    ],
  },
  {
    kind: 'mixed',
    name: '加减混合',
    title: '加减混合运算',
    summary: '连加、连减和加减混合',
    placeholder: '输入算式，用；隔开，例如：16-3-1；12+18+14；7-4+6',
    rules: [
      '多道算式用；隔开，例如：16-3-1；12+18+14；7-4+6',
      '支持两个或三个数的加减，从左往右算，中间和结果都不能是负数',
      '随机生成用 1–20 的数，按下面选的运算符出题',
      '每道题挖一个空，位置按下面的填空位置设置',
    ],
  },
]

export function kindInfo(kind: MathKind) {
  return MATH_KINDS.find((item) => item.kind === kind) ?? MATH_KINDS[0]
}

export function isMathKind(value: unknown): value is MathKind {
  return value === 'make10' || value === 'break10' || value === 'mixed'
}

export function fitsKind(kind: TenKind, problem: Problem) {
  const { a, b, op } = problem
  if (kind === 'make10') return op === '+' && a >= 2 && a <= 9 && b >= 2 && b <= 9 && a + b > 10
  return op === '-' && a >= 11 && a <= 18 && b >= 2 && b <= 9 && a % 10 < b
}

/** 本题型所有合规算式，凑十法和破十法各 36 道。 */
export function allProblems(kind: TenKind) {
  const list: Problem[] = []
  if (kind === 'make10') {
    for (let a = 2; a <= 9; a += 1) {
      for (let b = 2; b <= 9; b += 1) {
        if (a + b > 10) list.push({ a, b, op: '+' })
      }
    }
  } else {
    for (let a = 11; a <= 18; a += 1) {
      for (let b = 2; b <= 9; b += 1) {
        const problem: Problem = { a, b, op: '-' }
        if (fitsKind(kind, problem)) list.push(problem)
      }
    }
  }
  return list
}

export function randomProblems(kind: TenKind, count: number) {
  const pool = allProblems(kind)
  const picked: Problem[] = []
  while (picked.length < count) {
    const round = pool.slice()
    for (let i = round.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = round[i]
      round[i] = round[j]
      round[j] = swap
    }
    picked.push(...round.slice(0, count - picked.length))
  }
  return picked
}

export function formatProblem(problem: Problem) {
  return `${problem.a}${problem.op}${problem.b}`
}

export function joinProblems(problems: Problem[]) {
  return problems.map(formatProblem).join('；')
}

function normalize(token: string) {
  return token
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[＋]/g, '+')
    .replace(/[－−—–]/g, '-')
    .replace(/[=＝].*$/, '')
    .replace(/\s+/g, '')
}

/** 按；拆开算式，返回符合题型的题目和被跳过的原文。 */
export function parseProblems(kind: TenKind, text: string) {
  const problems: Problem[] = []
  const skipped: string[] = []
  for (const raw of text.split(/[;；,，、\n]+/)) {
    const token = raw.trim()
    if (!token) continue
    const match = normalize(token).match(/^(\d{1,2})([+-])(\d{1,2})$/)
    const problem: Problem | null = match ? { a: Number(match[1]), op: match[2] as '+' | '-', b: Number(match[3]) } : null
    if (problem && fitsKind(kind, problem)) problems.push(problem)
    else skipped.push(token)
  }
  return { problems, skipped }
}
