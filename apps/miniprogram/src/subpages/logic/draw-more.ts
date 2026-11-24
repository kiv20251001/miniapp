/** 第 15–30 关的画布：图形要一眼能懂在玩什么。 */

import {
  akariLit,
  matchSquares,
  mineCount,
  queenAttacking,
  type MoreRound,
} from './more'

export type Spot = { name: string; x: number; y: number; w: number; h: number }
export type SceneLite = {
  round: { kind: string }
  w: number
  h: number
  dragId: number
  dragX: number
  dragY: number
  flowPath?: number[]
}

type Pen = CanvasRenderingContext2D
type Scene = SceneLite

const INK = ['#f15a36', '#3db7e8', '#ffd15c', '#8b6cf0', '#3ecf8e', '#ff8fab']

export function gridBox(width: number, height: number, cols: number, rows: number) {
  const cell = Math.max(28, Math.min(48, (width - 24) / cols, (height - 24) / rows))
  return { cell, x: (width - cell * cols) / 2, y: (height - cell * rows) / 2 }
}

function roundBox(ctx: Pen, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

export function moreHeight(kind: MoreRound['kind']) {
  if (kind === 'flow' || kind === 'sky' || kind === 'queen' || kind === 'akari' || kind === 'domino' || kind === 'slither') return 280
  if (kind === 'mine') return 300
  if (kind === 'peg') return 220
  if (kind === 'match') return 230
  if (kind === 'pack') return 300
  if (kind === 'bridge') return 280
  if (kind === 'tilt') return 240
  if (kind === 'knight') return 220
  if (kind === 'code') return 220
  if (kind === 'gear') return 230
  if (kind === 'cipher') return 280
  return 240
}

export function moreSpots(scene: Scene): Spot[] {
  const round = scene.round as MoreRound
  if (round.kind === 'flow') {
    const box = gridBox(scene.w, scene.h, round.n, round.n)
    return Array.from({ length: round.n * round.n }, (_, index) => {
      const r = Math.floor(index / round.n)
      const c = index % round.n
      return { name: `flow:${index}`, x: box.x + c * box.cell, y: box.y + r * box.cell, w: box.cell, h: box.cell }
    })
  }
  if (round.kind === 'peg') {
    const spots: Spot[] = []
    let index = 0
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col <= row; col += 1) {
        const x = scene.w / 2 + (col - row / 2) * 36 - 16
        const y = 24 + row * 34
        spots.push({ name: `peg:${index}`, x, y, w: 32, h: 32 })
        index += 1
      }
    }
    return spots
  }
  if (round.kind === 'match') {
    const spots: Spot[] = []
    const cell = 54
    const ox = (scene.w - cell * round.cols) / 2
    const oy = 36
    const horizCount = (round.rows + 1) * round.cols
    for (let r = 0; r <= round.rows; r += 1) {
      for (let c = 0; c < round.cols; c += 1) {
        const index = r * round.cols + c
        spots.push({ name: `stick:${index}`, x: ox + c * cell, y: oy + r * cell - 7, w: cell, h: 14 })
      }
    }
    for (let r = 0; r < round.rows; r += 1) {
      for (let c = 0; c <= round.cols; c += 1) {
        const index = horizCount + r * (round.cols + 1) + c
        spots.push({ name: `stick:${index}`, x: ox + c * cell - 7, y: oy + r * cell, w: 14, h: cell })
      }
    }
    return spots
  }
  if (round.kind === 'pack') {
    const box = gridBox(scene.w, scene.h - 70, round.cols, round.rows)
    const spots: Spot[] = Array.from({ length: round.rows * round.cols }, (_, index) => {
      const r = Math.floor(index / round.cols)
      const c = index % round.cols
      return { name: `cell:${index}`, x: box.x + c * box.cell, y: box.y + r * box.cell, w: box.cell, h: box.cell }
    })
    const slot = Math.min(64, (scene.w - 16) / Math.max(1, round.pieces.length))
    round.pieces.forEach((piece) => {
      if (piece.placed) return
      spots.push({ name: `piece:${piece.id}`, x: 8 + piece.id * slot, y: scene.h - 62, w: slot - 6, h: 56 })
    })
    return spots
  }
  if (round.kind === 'bridge') {
    const box = gridBox(scene.w, scene.h, round.cols, round.rows)
    return round.islands.map((island, index) => ({
      name: `island:${index}`,
      x: box.x + island.c * box.cell + 4,
      y: box.y + island.r * box.cell + 4,
      w: box.cell - 8,
      h: box.cell - 8,
    }))
  }
  if (round.kind === 'tilt') {
    const box = gridBox(scene.w, scene.h, round.cols, round.rows)
    return [{ name: 'tilt', x: box.x, y: box.y, w: box.cell * round.cols, h: box.cell * round.rows }]
  }
  if (round.kind === 'sky' || round.kind === 'queen' || round.kind === 'akari' || round.kind === 'mine' || round.kind === 'domino' || round.kind === 'knight') {
    const n = 'n' in round ? round.n : 'cols' in round ? round.cols : 4
    const rows = 'rows' in round ? round.rows : n
    const cols = 'cols' in round ? round.cols : n
    const pad = round.kind === 'sky' ? 28 : 8
    const box = gridBox(scene.w - (round.kind === 'sky' ? 36 : 0), scene.h - (round.kind === 'sky' ? 36 : 0), cols, rows)
    const ox = round.kind === 'sky' ? box.x + 18 : box.x
    const oy = round.kind === 'sky' ? box.y + 18 : box.y
    void pad
    return Array.from({ length: rows * cols }, (_, index) => {
      const r = Math.floor(index / cols)
      const c = index % cols
      return { name: `cell:${index}`, x: ox + c * box.cell, y: oy + r * box.cell, w: box.cell, h: box.cell }
    })
  }
  if (round.kind === 'code') {
    return round.slots.map((_, index) => ({ name: `slot:${index}`, x: 28 + index * ((scene.w - 40) / round.slots.length), y: 16, w: (scene.w - 40) / round.slots.length - 8, h: 52 }))
  }
  if (round.kind === 'gear') {
    const gap = scene.w / round.teeth.length
    const cy = scene.h / 2 + 6
    return round.teeth.map((_, index) => ({ name: `gear:${index}`, x: gap * index + 4, y: cy - gap * 0.42, w: gap - 8, h: gap * 0.84 }))
  }
  if (round.kind === 'slither') {
    const n = round.n
    const box = gridBox(scene.w, scene.h, n, n)
    const spots: Spot[] = []
    for (let r = 0; r <= n; r += 1) {
      for (let c = 0; c < n; c += 1) {
        const index = r * n + c
        spots.push({ name: `h:${index}`, x: box.x + c * box.cell, y: box.y + r * box.cell - 8, w: box.cell, h: 16 })
      }
    }
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c <= n; c += 1) {
        const index = r * (n + 1) + c
        spots.push({ name: `v:${index}`, x: box.x + c * box.cell - 8, y: box.y + r * box.cell, w: 16, h: box.cell })
      }
    }
    return spots
  }
  if (round.kind === 'cipher') {
    const gap = scene.w / round.dials.length
    return round.dials.map((_, index) => ({ name: `dial:${index}`, x: index * gap + 6, y: 118, w: gap - 12, h: 110 }))
  }
  return []
}

export function paintMore(ctx: Pen, scene: Scene) {
  const round = scene.round as MoreRound
  if (round.kind === 'flow') paintFlow(ctx, scene, round)
  else if (round.kind === 'peg') paintPeg(ctx, scene, round)
  else if (round.kind === 'match') paintMatch(ctx, scene, round)
  else if (round.kind === 'pack') paintPack(ctx, scene, round)
  else if (round.kind === 'bridge') paintBridge(ctx, scene, round)
  else if (round.kind === 'tilt') paintTilt(ctx, scene, round)
  else if (round.kind === 'sky') paintSky(ctx, scene, round)
  else if (round.kind === 'knight') paintKnight(ctx, scene, round)
  else if (round.kind === 'queen') paintQueen(ctx, scene, round)
  else if (round.kind === 'code') paintCode(ctx, scene, round)
  else if (round.kind === 'akari') paintAkari(ctx, scene, round)
  else if (round.kind === 'domino') paintDomino(ctx, scene, round)
  else if (round.kind === 'gear') paintGear(ctx, scene, round)
  else if (round.kind === 'slither') paintSlither(ctx, scene, round)
  else if (round.kind === 'mine') paintMine(ctx, scene, round)
  else if (round.kind === 'cipher') paintCipher(ctx, scene, round)
}

function paintFlow(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'flow' }>) {
  const box = gridBox(scene.w, scene.h, round.n, round.n)
  for (let index = 0; index < round.n * round.n; index += 1) {
    const r = Math.floor(index / round.n)
    const c = index % round.n
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    let color = round.ends[index]
    if (!color) {
      for (let cIndex = 1; cIndex < round.paths.length; cIndex += 1) {
        if (round.paths[cIndex].includes(index)) color = cIndex
      }
    }
    if (!color && scene.flowPath?.includes(index) && scene.dragId > 0) color = scene.dragId
    ctx.fillStyle = color ? `${INK[color - 1]}55` : '#f4f1ea'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    if (round.ends[index]) {
      ctx.fillStyle = INK[round.ends[index] - 1]
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.22, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function paintPeg(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'peg' }>) {
  moreSpots(scene).forEach((spot, index) => {
    ctx.fillStyle = '#e8e0d4'
    ctx.beginPath()
    ctx.arc(spot.x + 16, spot.y + 16, 12, 0, Math.PI * 2)
    ctx.fill()
    if (!round.pegs[index]) return
    ctx.fillStyle = scene.dragId === index ? '#ff8a4c' : '#f15a36'
    ctx.beginPath()
    ctx.arc(spot.x + 16, spot.y + 16, 11, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff6'
    ctx.beginPath()
    ctx.arc(spot.x + 12, spot.y + 12, 3, 0, Math.PI * 2)
    ctx.fill()
  })
}

function paintMatch(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'match' }>) {
  const spots = moreSpots(scene)
  spots.forEach((spot, index) => {
    if (!round.on[index]) {
      ctx.strokeStyle = scene.dragId >= 0 ? '#e7b08a' : '#e4ddd4'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 4])
      ctx.strokeRect(spot.x + 2, spot.y + 2, spot.w - 4, spot.h - 4)
      ctx.setLineDash([])
      return
    }
    ctx.fillStyle = scene.dragId === index ? '#ffb070' : '#c47a3a'
    roundBox(ctx, spot.x + 2, spot.y + 2, spot.w - 4, spot.h - 4, 4)
    ctx.fill()
  })
  ctx.fillStyle = '#314056'
  ctx.font = 'bold 16px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(String(matchSquares(round)), 16, 22)
  ctx.font = '12px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillStyle = '#8a7460'
  ctx.fillText(`${round.moved}/${round.limit}`, scene.w - 16, 22)
}

function paintPack(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'pack' }>) {
  const box = gridBox(scene.w, scene.h - 70, round.cols, round.rows)
  for (let index = 0; index < round.board.length; index += 1) {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const id = round.board[index]
    ctx.fillStyle = id >= 0 ? INK[id % INK.length] : '#f4f1ea'
    roundBox(ctx, box.x + c * box.cell + 2, box.y + r * box.cell + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
  }
  const tray = round.pieces.filter((piece) => !piece.placed)
  const slot = Math.min(64, (scene.w - 16) / Math.max(1, round.pieces.length))
  tray.forEach((piece) => {
    const index = piece.id
    const x = 8 + index * slot
    const y = scene.h - 58
    ctx.fillStyle = scene.dragId === piece.id ? '#1c2430' : 'transparent'
    roundBox(ctx, x, y - 4, slot - 6, 56, 8)
    ctx.fill()
    ctx.fillStyle = INK[piece.id % INK.length]
    piece.cells.forEach(([r, c]) => {
      roundBox(ctx, x + 6 + c * 12, y + r * 12, 10, 10, 2)
      ctx.fill()
    })
  })
}

function paintBridge(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'bridge' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  ctx.fillStyle = '#d9eef8'
  roundBox(ctx, box.x, box.y, box.cell * round.cols, box.cell * round.rows, 12)
  ctx.fill()
  const center = (island: { r: number; c: number }) => ({
    x: box.x + island.c * box.cell + box.cell / 2,
    y: box.y + island.r * box.cell + box.cell / 2,
  })
  const counts = new Map<string, number>()
  round.links.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1))
  counts.forEach((count, key) => {
    const [a, b] = key.split('-').map(Number)
    const A = center(round.islands[a])
    const B = center(round.islands[b])
    for (let i = 0; i < count; i += 1) {
      const offset = (i - (count - 1) / 2) * 5
      const dx = B.x - A.x
      const dy = B.y - A.y
      const len = Math.hypot(dx, dy) || 1
      const ox = (-dy / len) * offset
      const oy = (dx / len) * offset
      ctx.strokeStyle = '#6b4f2c'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(A.x + ox, A.y + oy)
      ctx.lineTo(B.x + ox, B.y + oy)
      ctx.stroke()
    }
  })
  round.islands.forEach((island, index) => {
    const p = center(island)
    ctx.fillStyle = scene.dragId === index ? '#ffb070' : '#3ecf8e'
    ctx.beginPath()
    ctx.arc(p.x, p.y, box.cell * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#14301f'
    ctx.font = `bold ${Math.floor(box.cell * 0.28)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(island.need), p.x, p.y + 1)
  })
}

function paintTilt(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'tilt' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  for (let index = 0; index < round.walls.length; index += 1) {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    if (round.walls[index]) {
      ctx.fillStyle = '#2c3654'
      roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 6)
      ctx.fill()
      continue
    }
    ctx.fillStyle = '#eef3f8'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 6)
    ctx.fill()
    if (round.goals[index]) {
      ctx.strokeStyle = '#3ecf8e'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.22, 0, Math.PI * 2)
      ctx.stroke()
    }
    if (round.pits[index]) {
      ctx.fillStyle = '#1a1f2c'
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  round.balls.forEach((at) => {
    const r = Math.floor(at / round.cols)
    const c = at % round.cols
    const x = box.x + c * box.cell + box.cell / 2 + (scene.dragX || 0)
    const y = box.y + r * box.cell + box.cell / 2 + (scene.dragY || 0)
    const g = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, box.cell * 0.28)
    g.addColorStop(0, '#ffe08a')
    g.addColorStop(1, '#f15a36')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, box.cell * 0.26, 0, Math.PI * 2)
    ctx.fill()
  })
}

function paintSky(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'sky' }>) {
  const box = gridBox(scene.w - 36, scene.h - 36, round.n, round.n)
  const ox = box.x + 18
  const oy = box.y + 18
  ctx.fillStyle = '#6b7280'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  round.top.forEach((v, i) => v && ctx.fillText(String(v), ox + i * box.cell + box.cell / 2, oy - 14))
  round.bottom.forEach((v, i) => v && ctx.fillText(String(v), ox + i * box.cell + box.cell / 2, oy + round.n * box.cell + 14))
  round.left.forEach((v, i) => v && ctx.fillText(String(v), ox - 14, oy + i * box.cell + box.cell / 2))
  round.right.forEach((v, i) => v && ctx.fillText(String(v), ox + round.n * box.cell + 14, oy + i * box.cell + box.cell / 2))
  round.grid.forEach((h, index) => {
    const r = Math.floor(index / round.n)
    const c = index % round.n
    const x = ox + c * box.cell
    const y = oy + r * box.cell
    ctx.fillStyle = '#f4f1ea'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    if (!h) return
    const tall = 10 + h * ((box.cell - 16) / round.n)
    ctx.fillStyle = INK[h - 1]
    roundBox(ctx, x + box.cell / 2 - 12, y + box.cell - 6 - tall, 24, tall, 4)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(String(h), x + box.cell / 2, y + box.cell - 14)
  })
}

function paintKnight(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'knight' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  for (let index = 0; index < round.rows * round.cols; index += 1) {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    ctx.fillStyle = round.seen[index] ? '#d9f5e6' : ((r + c) % 2 ? '#f4f1ea' : '#e7eef6')
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    if (index === round.at) {
      ctx.fillStyle = '#314056'
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.28, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2 - 4, 5, 0, Math.PI * 2)
      ctx.fill()
      roundBox(ctx, x + box.cell / 2 - 7, y + box.cell / 2, 14, 10, 3)
      ctx.fill()
    }
  }
}

function paintQueen(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'queen' }>) {
  const box = gridBox(scene.w, scene.h, round.n, round.n)
  const bad = queenAttacking(round)
  for (let index = 0; index < round.n * round.n; index += 1) {
    const r = Math.floor(index / round.n)
    const c = index % round.n
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    ctx.fillStyle = (r + c) % 2 ? '#f4f1ea' : '#e7eef6'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    if (!round.queens[index]) continue
    ctx.fillStyle = bad.has(index) ? '#f15a36' : '#8b6cf0'
    ctx.beginPath()
    ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.28, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(x + box.cell / 2, y + box.cell / 2 - 10)
    ctx.lineTo(x + box.cell / 2 + 8, y + box.cell / 2 + 8)
    ctx.lineTo(x + box.cell / 2 - 8, y + box.cell / 2 + 8)
    ctx.closePath()
    ctx.fill()
  }
}

function paintCode(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'code' }>) {
  const gap = (scene.w - 40) / round.slots.length
  round.slots.forEach((color, index) => {
    const x = 20 + index * gap
    ctx.fillStyle = '#e7eef6'
    roundBox(ctx, x, 16, gap - 10, 52, 12)
    ctx.fill()
    if (index === round.cursor) {
      ctx.strokeStyle = '#ff6a33'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    if (color < 0) {
      ctx.strokeStyle = '#c5ceda'
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.arc(x + (gap - 10) / 2, 42, 12, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
      return
    }
    ctx.fillStyle = INK[color]
    ctx.beginPath()
    ctx.arc(x + (gap - 10) / 2, 42, 14, 0, Math.PI * 2)
    ctx.fill()
  })
  round.log.forEach((item, row) => {
    const y = 88 + row * 26
    item.guess.forEach((color, index) => {
      ctx.fillStyle = INK[color] ?? '#ccc'
      ctx.beginPath()
      ctx.arc(36 + index * 18, y, 7, 0, Math.PI * 2)
      ctx.fill()
    })
    for (let peg = 0; peg < item.black; peg += 1) {
      ctx.fillStyle = '#1c2430'
      ctx.beginPath()
      ctx.arc(130 + peg * 12, y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let peg = 0; peg < item.white; peg += 1) {
      ctx.strokeStyle = '#1c2430'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(130 + (item.black + peg) * 12, y, 4, 0, Math.PI * 2)
      ctx.stroke()
    }
  })
}

function paintAkari(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'akari' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  const lit = akariLit(round)
  round.cell.forEach((cell, index) => {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    if (cell !== -1) {
      ctx.fillStyle = '#2c3654'
      roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 6)
      ctx.fill()
      if (cell >= 0) {
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 14px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(cell), x + box.cell / 2, y + box.cell / 2 + 1)
      }
      return
    }
    ctx.fillStyle = lit[index] ? '#fff3bf' : '#f4f1ea'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 6)
    ctx.fill()
    if (round.lamps[index]) {
      ctx.fillStyle = '#ffd15c'
      ctx.beginPath()
      ctx.arc(x + box.cell / 2, y + box.cell / 2, box.cell * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#f15a36'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  })
}

function paintDomino(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'domino' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  round.nums.forEach((num, index) => {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    ctx.fillStyle = round.cover[index] >= 0 ? `${INK[round.cover[index] % INK.length]}88` : '#f4f1ea'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    if (round.pick === index) {
      ctx.strokeStyle = '#ff6a33'
      ctx.lineWidth = 3
      ctx.stroke()
    }
    ctx.fillStyle = '#314056'
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(num), x + box.cell / 2, y + box.cell / 2 + 1)
  })
}

function paintGear(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'gear' }>) {
  const gap = scene.w / round.teeth.length
  const cy = scene.h / 2 + 6
  const radius = Math.min(28, gap * 0.34)
  round.mesh.forEach(([a, b]) => {
    ctx.strokeStyle = '#d7cfc4'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(gap * (a + 0.5), cy)
    ctx.lineTo(gap * (b + 0.5), cy)
    ctx.stroke()
  })
  round.teeth.forEach((teeth, index) => {
    const cx = gap * (index + 0.5)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate((round.rot[index] / teeth) * Math.PI * 2)
    ctx.fillStyle = INK[index % INK.length]
    ctx.beginPath()
    for (let t = 0; t < teeth; t += 1) {
      const a0 = (t / teeth) * Math.PI * 2
      const a1 = ((t + 0.45) / teeth) * Math.PI * 2
      ctx.lineTo(Math.cos(a0) * radius, Math.sin(a0) * radius)
      ctx.lineTo(Math.cos(a1) * (radius + 7), Math.sin(a1) * (radius + 7))
    }
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#f15a36'
    ctx.beginPath()
    ctx.arc(0, -radius + 4, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  })
}

function paintSlither(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'slither' }>) {
  const n = round.n
  const box = gridBox(scene.w, scene.h, n, n)
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const clue = round.clues[r * n + c]
      if (clue < 0) continue
      ctx.fillStyle = '#314056'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(clue), box.x + c * box.cell + box.cell / 2, box.y + r * box.cell + box.cell / 2)
    }
  }
  for (let r = 0; r <= n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      const on = round.horiz[r * n + c]
      ctx.strokeStyle = on ? '#f15a36' : '#d7cfc4'
      ctx.lineWidth = on ? 5 : 2
      ctx.beginPath()
      ctx.moveTo(box.x + c * box.cell, box.y + r * box.cell)
      ctx.lineTo(box.x + (c + 1) * box.cell, box.y + r * box.cell)
      ctx.stroke()
    }
  }
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c <= n; c += 1) {
      const on = round.vert[r * (n + 1) + c]
      ctx.strokeStyle = on ? '#f15a36' : '#d7cfc4'
      ctx.lineWidth = on ? 5 : 2
      ctx.beginPath()
      ctx.moveTo(box.x + c * box.cell, box.y + r * box.cell)
      ctx.lineTo(box.x + c * box.cell, box.y + (r + 1) * box.cell)
      ctx.stroke()
    }
  }
  for (let r = 0; r <= n; r += 1) {
    for (let c = 0; c <= n; c += 1) {
      ctx.fillStyle = '#314056'
      ctx.beginPath()
      ctx.arc(box.x + c * box.cell, box.y + r * box.cell, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function paintMine(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'mine' }>) {
  const box = gridBox(scene.w, scene.h, round.cols, round.rows)
  for (let index = 0; index < round.mines.length; index += 1) {
    const r = Math.floor(index / round.cols)
    const c = index % round.cols
    const x = box.x + c * box.cell
    const y = box.y + r * box.cell
    if (!round.open[index]) {
      ctx.fillStyle = '#cfd8e6'
      roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
      ctx.fill()
      continue
    }
    ctx.fillStyle = '#f4f1ea'
    roundBox(ctx, x + 2, y + 2, box.cell - 4, box.cell - 4, 8)
    ctx.fill()
    const count = mineCount(round, index)
    if (!count) continue
    ctx.fillStyle = INK[(count - 1) % INK.length]
    ctx.font = 'bold 16px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(count), x + box.cell / 2, y + box.cell / 2 + 1)
  }
}

function paintCipher(ctx: Pen, scene: Scene, round: Extract<MoreRound, { kind: 'cipher' }>) {
  const gap = scene.w / round.dials.length
  round.dials.forEach((value, index) => {
    const x = index * gap + 6
    const w = gap - 12
    ctx.fillStyle = '#e7eef6'
    roundBox(ctx, x, 118, w, 108, 16)
    ctx.fill()
    ctx.fillStyle = '#ff6a33'
    ctx.font = 'bold 26px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(String(value), x + w / 2, 162)
    ctx.fillStyle = '#8a7460'
    ctx.font = '12px sans-serif'
    ctx.fillText(String.fromCharCode(65 + index), x + w / 2, 198)
  })
  ctx.fillStyle = '#314056'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  round.clues.forEach((clue, index) => {
    const a = String.fromCharCode(65 + clue.a)
    const b = String.fromCharCode(65 + clue.b)
    const text = clue.op === 'eq' ? `${a} = ${b}` : clue.op === 'gt' ? `${a} = ${b} + ${clue.n}` : `${a} + ${b} = ${clue.n}`
    ctx.fillText(text, 18, 28 + index * 18)
  })
}
