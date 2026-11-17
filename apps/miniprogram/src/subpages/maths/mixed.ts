/**
 * 加减混合运算（连加、连减、加减混合）：两到三个数从左往右算，每道题挖一个空。
 * 空可以挖在算式里的数上，也可以挖在结果上；中间每一步都不能出现负数。
 */
export type Op = '+' | '-'
export type MixedOp = 'add' | 'sub' | 'random'
export type BlankPos = 'random' | 'left' | 'middle' | 'right'

export type Chain = { nums: number[]; ops: Op[] }
/** blank 是要挖空的位置：0…nums.length-1 是算式里的数，nums.length 是结果。 */
export type MixedItem = Chain & { blank: number }

export const RANDOM_MIN = 1
export const RANDOM_MAX = 20

export const MIXED_OPS: Array<{ value: MixedOp; label: string }> = [
  { value: 'add', label: '加法' },
  { value: 'sub', label: '减法' },
  { value: 'random', label: '加减随机' },
]

export const BLANK_POSITIONS: Array<{ value: BlankPos; label: string }> = [
  { value: 'random', label: '随机' },
  { value: 'left', label: '左边' },
  { value: 'middle', label: '中间' },
  { value: 'right', label: '右边' },
]

function pick(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

/** 从左往右算，任何一步小于 0 就返回 null。 */
export function chainValue(chain: Chain) {
  let value = chain.nums[0]
  for (let i = 0; i < chain.ops.length; i += 1) {
    value = chain.ops[i] === '+' ? value + chain.nums[i + 1] : value - chain.nums[i + 1]
    if (value < 0) return null
  }
  return value
}

function sameChain(a: Chain, b: Chain) {
  return a.nums.join() === b.nums.join() && a.ops.join() === b.ops.join()
}

function randomChain(mode: MixedOp): Chain {
  for (;;) {
    const ops: Op[] = [0, 1].map(() => (mode === 'add' ? '+' : mode === 'sub' ? '-' : Math.random() < 0.5 ? '+' : '-'))
    const nums = [0, 1, 2].map(() => pick(RANDOM_MIN, RANDOM_MAX))
    const chain = { nums, ops }
    if (chainValue(chain) !== null) return chain
  }
}

/** 随机出三个数的算式，数在 1–20 之间，相邻两道不重复。 */
export function randomChains(mode: MixedOp, count: number) {
  const list: Chain[] = []
  while (list.length < count) {
    const chain = randomChain(mode)
    if (list.length && sameChain(list[list.length - 1], chain)) continue
    list.push(chain)
  }
  return list
}

export function formatChain(chain: Chain) {
  return chain.nums.reduce((text, num, index) => (index === 0 ? String(num) : `${text}${chain.ops[index - 1]}${num}`), '')
}

export function joinChains(chains: Chain[]) {
  return chains.map(formatChain).join('；')
}

function normalize(token: string) {
  return token
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[＋]/g, '+')
    .replace(/[－−—–]/g, '-')
    .replace(/[=＝].*$/, '')
    .replace(/\s+/g, '')
}

/** 支持两到三个数的加减算式，结果和中间步骤不能是负数。 */
export function parseChains(text: string) {
  const problems: Chain[] = []
  const skipped: string[] = []
  for (const raw of text.split(/[;；,，、\n]+/)) {
    const token = raw.trim()
    if (!token) continue
    const clean = normalize(token)
    if (!/^\d{1,3}([+-]\d{1,3}){1,2}$/.test(clean)) {
      skipped.push(token)
      continue
    }
    const chain: Chain = {
      nums: clean.split(/[+-]/).map(Number),
      ops: (clean.match(/[+-]/g) ?? []) as Op[],
    }
    if (chainValue(chain) === null) skipped.push(token)
    else problems.push(chain)
  }
  return { problems, skipped }
}

function blankIndex(count: number, pos: BlankPos) {
  if (pos === 'left') return 0
  if (pos === 'right') return count
  if (pos === 'middle') return pick(1, count - 1)
  return pick(0, count)
}

/** 每次生成时按设置定下挖空的位置，同一份图片里位置就固定了。 */
export function placeBlanks(chains: Chain[], pos: BlankPos): MixedItem[] {
  return chains.map((chain) => ({ ...chain, blank: blankIndex(chain.nums.length, pos) }))
}
