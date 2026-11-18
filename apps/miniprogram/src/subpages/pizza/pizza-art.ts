/** 披萨上的配料位置。自己排布的，画的时候按角度裁进每一块里。 */
export type Topping = { a: number; r: number; s: number; basil: boolean }

const TAU = Math.PI * 2

export const TOPPINGS: Topping[] = [
  { a: -1.35, r: 0.34, s: 0.1, basil: false },
  { a: -0.85, r: 0.58, s: 0.085, basil: false },
  { a: -0.3, r: 0.28, s: 0.095, basil: false },
  { a: 0.15, r: 0.62, s: 0.08, basil: false },
  { a: 0.7, r: 0.36, s: 0.1, basil: false },
  { a: 1.15, r: 0.7, s: 0.075, basil: false },
  { a: 1.65, r: 0.3, s: 0.09, basil: false },
  { a: 2.15, r: 0.54, s: 0.085, basil: false },
  { a: 2.7, r: 0.26, s: 0.095, basil: false },
  { a: 3.2, r: 0.6, s: 0.08, basil: false },
  { a: 3.75, r: 0.34, s: 0.1, basil: false },
  { a: 4.25, r: 0.68, s: 0.075, basil: false },
  { a: 4.8, r: 0.3, s: 0.09, basil: false },
  { a: 5.3, r: 0.52, s: 0.085, basil: false },
  { a: 5.85, r: 0.24, s: 0.09, basil: false },
  { a: 0.4, r: 0.46, s: 0.07, basil: false },
  { a: 2.45, r: 0.46, s: 0.07, basil: false },
  { a: 4.55, r: 0.48, s: 0.07, basil: false },
  { a: 1.0, r: 0.74, s: 0.048, basil: true },
  { a: 2.9, r: 0.72, s: 0.044, basil: true },
  { a: 4.7, r: 0.7, s: 0.046, basil: true },
]

/** 饼边的起伏，让外圈不那么像一个圆规画的圆。 */
export function crustWobble(angle: number) {
  return 1 + Math.sin(angle * 9 + 1.7) * 0.02 + Math.sin(angle * 21 + 0.4) * 0.009
}

/** angle 是否落在从 start 开始、顺时针 span 弧度的那一块里。 */
export function inSlice(angle: number, start: number, span: number) {
  let delta = angle - start
  while (delta < 0) delta += TAU
  while (delta >= TAU) delta -= TAU
  return delta <= span + 1e-4
}
