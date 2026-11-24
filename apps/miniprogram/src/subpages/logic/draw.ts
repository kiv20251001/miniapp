/** 把每一关画成能看懂的小画面。文字由页面传进来，这里不写中文。 */

import {
  pipeFlow,
  pipeMask,
  type Block,
  type Round,
} from './play'
import { moreHeight, moreSpots, paintMore } from './draw-more'

export type Scene = {
  round: Round
  w: number
  h: number
  time: number
  boat: number
  hop: { from: number; to: number; t: number } | null
  eat: { who: string; t: number; text: string } | null
  names: Record<string, string>
  leftShore: string
  rightShore: string
  offBoat: string
  dragId: number
  dragX: number
  dragY: number
  flowPath?: number[]
  carry?: boolean
}

export type Spot = { name: string; x: number; y: number; w: number; h: number }

type Pen = CanvasRenderingContext2D

export function stageHeight(kind: Round['kind']) {
  if (kind === 'river') return 292
  if (kind === 'frog') return 168
  if (kind === 'lights') return 228
  if (kind === 'pipes') return 246
  if (kind === 'trace') return 250
  if (kind === 'scale') return 300
  if (kind === 'box') return 268
  if (kind === 'hanoi') return 236
  if (kind === 'slide' || kind === 'klotski') return 228
  return moreHeight(kind)
}

export function hitAt(scene: Scene, x: number, y: number) {
  const spots = hots(scene)
  for (let index = spots.length - 1; index >= 0; index -= 1) {
    const spot = spots[index]
    if (x >= spot.x && y >= spot.y && x <= spot.x + spot.w && y <= spot.y + spot.h) return spot.name
  }
  return ''
}

export function paint(ctx: Pen, scene: Scene) {
  ctx.clearRect(0, 0, scene.w, scene.h)
  const round = scene.round
  if (round.kind === 'frog') paintFrog(ctx, scene)
  else if (round.kind === 'river') paintRiver(ctx, scene)
  else if (round.kind === 'lights') paintLights(ctx, scene)
  else if (round.kind === 'pipes') paintPipes(ctx, scene)
  else if (round.kind === 'trace') paintTrace(ctx, scene)
  else if (round.kind === 'scale') paintScale(ctx, scene)
  else if (round.kind === 'box') paintBox(ctx, scene)
  else if (round.kind === 'slide') paintSlide(ctx, scene)
  else if (round.kind === 'klotski') paintKlot(ctx, scene)
  else if (round.kind === 'hanoi') paintHanoi(ctx, scene)
  else paintMore(ctx, scene)
}

function hots(scene: Scene): Spot[] {
  const round = scene.round
  if (round.kind === 'frog') return frogSpots(scene)
  if (round.kind === 'river') return riverLayout(scene).spots
  if (round.kind === 'lights') return gridSpots(scene, 3, 64, 'light')
  if (round.kind === 'pipes') return gridSpots(scene, 3, 74, 'pipe')
  if (round.kind === 'scale') return scaleSpots(scene)
  if (round.kind === 'slide') return gridSpots(scene, 3, 68, 'cell')
  if (round.kind === 'klotski') return round.blocks.map((block) => blockSpot(scene, block))
  if (round.kind === 'hanoi') return pegSpots(scene)
  if (round.kind === 'trace') return round.nodes.map((node, index) => ({ name: `node:${index}`, x: (node.x / 100) * scene.w - 18, y: (node.y / 100) * scene.h - 18, w: 36, h: 36 }))
  return moreSpots(scene)
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

function eye(ctx: Pen, x: number, y: number) {
  ctx.fillStyle = '#1c2430'
  ctx.beginPath()
  ctx.arc(x, y, 1.7, 0, Math.PI * 2)
  ctx.fill()
}

function label(ctx: Pen, text: string, x: number, y: number, color = '#1c2430') {
  ctx.fillStyle = color
  ctx.font = '700 12px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
}

function actor(ctx: Pen, id: string, x: number, y: number, name: string, scale = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(scale, scale)
  if (id === 'fox') drawFox(ctx)
  else if (id === 'hen') drawHen(ctx)
  else if (id === 'rice') drawSack(ctx)
  else drawPerson(ctx, id)
  ctx.restore()
  if (name) label(ctx, name, x, y + 28 * scale, '#245c38')
}

function drawPerson(ctx: Pen, id: string) {
  const color = id === 'mom' ? '#f08bb5' : id === 'dad' ? '#3d8fd9' : id === 'bro' ? '#7d8cff' : id === 'sis' ? '#ffb3d1' : '#ff9a6b'
  const grown = id === 'dad' || id === 'mom'
  ctx.fillStyle = '#ffd3b6'
  ctx.beginPath()
  ctx.arc(0, grown ? -16 : -12, grown ? 9 : 8, 0, Math.PI * 2)
  ctx.fill()
  eye(ctx, -3, grown ? -17 : -13)
  eye(ctx, 3, grown ? -17 : -13)
  ctx.fillStyle = color
  roundBox(ctx, grown ? -11 : -9, grown ? -6 : -4, grown ? 22 : 18, grown ? 16 : 14, 6)
  ctx.fill()
}

function drawFox(ctx: Pen) {
  ctx.fillStyle = '#f07a3a'
  ctx.beginPath()
  ctx.moveTo(-8, -10)
  ctx.lineTo(-12, -24)
  ctx.lineTo(-2, -12)
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(8, -10)
  ctx.lineTo(12, -24)
  ctx.lineTo(2, -12)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(0, -8, 10, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(0, 8, 13, 9, 0, 0, Math.PI * 2)
  ctx.fill()
  eye(ctx, -4, -9)
  eye(ctx, 4, -9)
  ctx.fillStyle = '#ffe1c4'
  ctx.beginPath()
  ctx.ellipse(0, -3, 4.5, 3, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1c2430'
  ctx.beginPath()
  ctx.arc(0, -2, 1.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawHen(ctx: Pen) {
  ctx.fillStyle = '#ffd15c'
  ctx.beginPath()
  ctx.ellipse(0, 6, 13, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(8, -2, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f15a36'
  ctx.beginPath()
  ctx.arc(6, -10, 3, 0, Math.PI * 2)
  ctx.arc(10, -11, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f08a24'
  ctx.beginPath()
  ctx.moveTo(14, -2)
  ctx.lineTo(20, 0)
  ctx.lineTo(14, 2)
  ctx.fill()
  eye(ctx, 8, -3)
  ctx.strokeStyle = '#e0a04e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-4, 16)
  ctx.lineTo(-6, 24)
  ctx.moveTo(4, 16)
  ctx.lineTo(6, 24)
  ctx.stroke()
}

function drawSack(ctx: Pen) {
  ctx.fillStyle = '#e7c98a'
  roundBox(ctx, -12, -6, 24, 26, 6)
  ctx.fill()
  ctx.strokeStyle = '#b8904e'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-6, -6)
  ctx.quadraticCurveTo(0, -16, 6, -6)
  ctx.stroke()
  label(ctx, '•', 0, 6, '#8a6230')
}

function drawFrog(ctx: Pen, x: number, y: number, faceRight: boolean) {
  ctx.save()
  ctx.translate(x, y)
  if (!faceRight) ctx.scale(-1, 1)
  const skin = faceRight ? '#ff8a3d' : '#3db7e8'
  const belly = faceRight ? '#ffd1a8' : '#d7f4ff'
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(-8, 8, 7, 4, -0.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(-12, 12, 5, 3, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(1, 3, 14, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = belly
  ctx.beginPath()
  ctx.ellipse(2, 6, 8, 4.5, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(3, -7, 5.2, 0, Math.PI * 2)
  ctx.arc(13, -5, 5.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#1c2430'
  ctx.beginPath()
  ctx.arc(4, -7, 2.1, 0, Math.PI * 2)
  ctx.arc(14, -5, 2.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#1c2430'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(9, 3, 4.2, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.ellipse(4, 12, 3, 2, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function lily(ctx: Pen, x: number, y: number, empty: boolean) {
  ctx.fillStyle = empty ? '#b7e3bf' : '#6fce78'
  ctx.beginPath()
  ctx.ellipse(x, y + 8, 22, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = empty ? '#7dba86' : '#3e9d4c'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y + 4)
  ctx.lineTo(x, y + 14)
  ctx.stroke()
}

function paintFrog(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'frog') return
  const spots = frogSpots(scene)
  ctx.fillStyle = '#d7f3fb'
  roundBox(ctx, 8, 28, scene.w - 16, scene.h - 40, 18)
  ctx.fill()
  const hop = scene.hop && scene.hop.t < 1 ? scene.hop : null
  spots.forEach((spot, index) => {
    const pad = round.pads[index]
    const cx = spot.x + spot.w / 2
    const cy = spot.y + spot.h / 2
    lily(ctx, cx, cy, pad === '.')
    if (pad === '.' || (hop && index === hop.to)) return
    drawFrog(ctx, cx, cy - 6, pad === 'L')
  })
  if (hop) {
    const from = spots[hop.from]
    const to = spots[hop.to]
    const t = hop.t
    const x = from.x + (to.x - from.x) * t + from.w / 2
    const y = from.y + (to.y - from.y) * t + from.h / 2 - Math.sin(t * Math.PI) * 26
    drawFrog(ctx, x, y - 6, round.pads[hop.to] === 'L')
  }
}

function frogSpots(scene: Scene): Spot[] {
  const round = scene.round
  if (round.kind !== 'frog') return []
  const slot = Math.min(48, (scene.w - 20) / round.pads.length)
  const total = slot * round.pads.length
  const left = (scene.w - total) / 2
  return round.pads.map((_, index) => ({ name: `frog:${index}`, x: left + index * slot, y: 48, w: slot, h: 84 }))
}

function riverLayout(scene: Scene) {
  const round = scene.round
  const bankW = Math.max(92, Math.min(118, scene.w * 0.32))
  const top = 28
  const bodyH = scene.h - 36
  const riverX = bankW
  const riverW = scene.w - bankW * 2
  const boatW = 70
  const boatH = 92
  let shown = scene.boat
  if (scene.eat && round.kind === 'river') {
    const dir = round.boat === 0 ? 1 : -1
    shown += Math.sin(Math.min(1, scene.eat.t) * Math.PI) * 0.26 * dir
  }
  shown = Math.max(-0.02, Math.min(1.02, shown))
  const boatX = riverX - 18 + (riverW - boatW + 36) * shown
  const boatY = top + bodyH * 0.46
  const spots: Spot[] = []
  if (round.kind === 'river') {
    const stand = (side: 0 | 1) => round.riders.filter((rider) => rider.side === side && !round.aboard.includes(rider.id))
    const drop = (list: typeof round.riders, side: 0 | 1) => {
      const cols = list.length > 3 ? 2 : 1
      list.forEach((rider, index) => {
        const col = index % cols
        const row = Math.floor(index / cols)
        const cx = side === 0 ? 30 + col * 44 : scene.w - 30 - col * 44
        const cy = top + 46 + row * 62
        spots.push({ name: `rider:${rider.id}`, x: cx - 22, y: cy - 30, w: 44, h: 62 })
      })
    }
    drop(stand(0), 0)
    drop(stand(1), 1)
    round.aboard.forEach((id, index) => {
      const cx = boatX + boatW / 2 + (index - (round.aboard.length - 1) / 2) * 28
      const cy = boatY + 34
      spots.push({ name: `rider:${id}`, x: cx - 18, y: cy - 26, w: 36, h: 52 })
    })
  }
  return { bankW, top, bodyH, riverX, riverW, boatX, boatY, boatW, boatH, spots }
}

function paintRiver(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'river') return
  const box = riverLayout(scene)
  ctx.fillStyle = '#8fd0f2'
  ctx.fillRect(box.riverX, box.top, box.riverW, box.bodyH)
  ctx.strokeStyle = 'rgba(255,255,255,0.75)'
  ctx.lineWidth = 2
  for (let band = 0; band < 4; band += 1) {
    const y = box.top + 28 + band * 48
    ctx.beginPath()
    for (let x = 0; x <= box.riverW; x += 6) {
      const py = y + Math.sin((x + scene.time * 3 + band * 20) * 0.08) * 4
      if (x === 0) ctx.moveTo(box.riverX + x, py)
      else ctx.lineTo(box.riverX + x, py)
    }
    ctx.stroke()
  }
  const grass = (x: number) => {
    ctx.fillStyle = '#7dcc6a'
    roundBox(ctx, x, box.top, box.bankW, box.bodyH, 16)
    ctx.fill()
    ctx.fillStyle = '#5eaf4a'
    for (let i = 0; i < 5; i += 1) {
      const gx = x + 16 + (i * 17) % (box.bankW - 24)
      const gy = box.top + box.bodyH - 28 - (i % 3) * 10
      ctx.fillRect(gx, gy, 3, 12)
    }
  }
  grass(0)
  grass(scene.w - box.bankW)
  label(ctx, scene.leftShore, box.bankW / 2, box.top + 16, '#1f6b34')
  label(ctx, scene.rightShore, scene.w - box.bankW / 2, box.top + 16, '#1f6b34')
  const pierX = scene.boat < 0.5 ? box.riverX - 10 : box.riverX + box.riverW - 16
  ctx.fillStyle = '#c49a6c'
  ctx.fillRect(pierX, box.boatY + 20, 26, 8)
  drawBoat(ctx, box.boatX, box.boatY, box.boatW, box.boatH)
  const prey = scene.eat?.who === 'fox' ? 'hen' : scene.eat?.who === 'hen' ? 'rice' : ''
  const hunter = scene.eat?.who ?? ''
  box.spots.forEach((spot) => {
    const id = spot.name.slice(6)
    if (scene.eat && (id === hunter || id === prey)) return
    const aboard = round.aboard.includes(id)
    actor(ctx, id, spot.x + spot.w / 2, spot.y + 24, aboard ? '' : scene.names[id] ?? id, aboard ? 0.78 : 1)
  })
  if (round.aboard.length) label(ctx, scene.offBoat, box.boatX + box.boatW / 2, box.boatY + 64, '#fff8ee')
  if (scene.eat && hunter && prey) {
    const from = box.spots.find((spot) => spot.name === `rider:${hunter}`)
    const to = box.spots.find((spot) => spot.name === `rider:${prey}`)
    if (from && to) {
      const t = Math.min(1, scene.eat.t)
      const x = from.x + (to.x - from.x) * t + from.w / 2
      const y = from.y + (to.y - from.y) * t + 18
      actor(ctx, prey, to.x + to.w / 2, to.y + 24, '', 1 - t * 0.4)
      actor(ctx, hunter, x, y, '', 1.08)
      if (t > 0.2) {
        const text = scene.eat.text
        const width = Math.max(88, text.length * 14)
        const left = Math.max(8, Math.min(scene.w - width - 8, (scene.w - width) / 2))
        ctx.fillStyle = '#fff'
        roundBox(ctx, left, box.top + 4, width, 28, 12)
        ctx.fill()
        ctx.strokeStyle = '#f15a36'
        ctx.lineWidth = 2
        ctx.stroke()
        label(ctx, text, left + width / 2, box.top + 18, '#d9482a')
      }
    }
  }
}

function drawBoat(ctx: Pen, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8d5a2b'
  ctx.beginPath()
  ctx.moveTo(x + 6, y + 28)
  ctx.quadraticCurveTo(x + w / 2, y + h, x + w - 6, y + 28)
  ctx.quadraticCurveTo(x + w / 2, y + 48, x + 6, y + 28)
  ctx.fill()
  ctx.strokeStyle = '#5c3b16'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#f3efe4'
  ctx.fillRect(x + w / 2 - 2, y + 4, 4, 30)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y + 6)
  ctx.lineTo(x + w / 2 + 18, y + 20)
  ctx.lineTo(x + w / 2, y + 28)
  ctx.fill()
  ctx.strokeStyle = '#d7d2c8'
  ctx.stroke()
}

function gridOrigin(scene: Scene, n: number, cell: number) {
  const size = n * cell
  return { x: (scene.w - size) / 2, y: Math.max(8, (scene.h - size) / 2), cell }
}

function gridSpots(scene: Scene, n: number, cell: number, prefix: string): Spot[] {
  const origin = gridOrigin(scene, n, cell)
  const spots: Spot[] = []
  for (let index = 0; index < n * n; index += 1) {
    const col = index % n
    const row = Math.floor(index / n)
    spots.push({ name: `${prefix}:${index}`, x: origin.x + col * cell, y: origin.y + row * cell, w: cell, h: cell })
  }
  return spots
}

function paintLights(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'lights') return
  gridSpots(scene, 3, 64, 'light').forEach((spot, index) => {
    const on = !!round.on[index]
    const cx = spot.x + spot.w / 2
    const cy = spot.y + 28
    if (on) {
      ctx.fillStyle = 'rgba(255, 209, 92, 0.35)'
      ctx.beginPath()
      ctx.arc(cx, cy, 26, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = on ? '#ffe28a' : '#2c3448'
    ctx.beginPath()
    ctx.arc(cx, cy, 18, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = on ? '#fff' : '#4a556c'
    ctx.beginPath()
    ctx.arc(cx - 5, cy - 6, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#8d8d8d'
    roundBox(ctx, cx - 8, cy + 16, 16, 8, 2)
    ctx.fill()
  })
}

function paintPipes(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'pipes') return
  const flow = pipeFlow(round)
  gridSpots(scene, 3, 74, 'pipe').forEach((spot, index) => {
    const tile = round.tiles[index]
    const mask = pipeMask(tile)
    const live = flow.has(index)
    ctx.fillStyle = '#f4f7fb'
    ctx.fillRect(spot.x + 4, spot.y + 4, spot.w - 8, spot.h - 8)
    ctx.fillStyle = live ? '#3db7e8' : '#d5dbe8'
    const midX = spot.x + spot.w / 2
    const midY = spot.y + spot.h / 2
    if (mask & 1) ctx.fillRect(midX - 7, spot.y + 6, 14, spot.h / 2)
    if (mask & 4) ctx.fillRect(midX - 7, midY, 14, spot.h / 2 - 6)
    if (mask & 2) ctx.fillRect(midX, midY - 7, spot.w / 2 - 6, 14)
    if (mask & 8) ctx.fillRect(spot.x + 6, midY - 7, spot.w / 2, 14)
    ctx.beginPath()
    ctx.arc(midX, midY, 9, 0, Math.PI * 2)
    ctx.fillStyle = index === 0 ? '#ff8a3d' : index === round.sink ? '#34c77b' : live ? '#3db7e8' : '#d5dbe8'
    ctx.fill()
  })
}

function paintTrace(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'trace') return
  ctx.fillStyle = '#eef3f8'
  roundBox(ctx, 8, 8, scene.w - 16, scene.h - 16, 16)
  ctx.fill()
  const point = (node: { x: number; y: number }) => ({ x: (node.x / 100) * scene.w, y: (node.y / 100) * scene.h })
  round.edges.forEach((edge) => {
    const from = point(round.nodes[edge[0]])
    const to = point(round.nodes[edge[1]])
    const used = round.used.includes(edge[0] < edge[1] ? `${edge[0]}-${edge[1]}` : `${edge[1]}-${edge[0]}`)
    ctx.strokeStyle = used ? '#ff8a3d' : '#c5d0de'
    ctx.lineWidth = used ? 8 : 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
  })
  round.nodes.forEach((node, index) => {
    const at = point(node)
    const odd = round.oddStart && round.edges.filter((edge) => edge[0] === index || edge[1] === index).length % 2 === 1
    const last = round.path[round.path.length - 1] === index
    ctx.beginPath()
    ctx.arc(at.x, at.y, 14, 0, Math.PI * 2)
    ctx.fillStyle = last ? '#ff6a33' : '#fff'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = odd ? '#ff9a6b' : '#d5dbe8'
    ctx.stroke()
    label(ctx, String(index + 1), at.x, at.y, last ? '#fff' : '#1c2430')
  })
}

function scaleFrame(scene: Scene) {
  const round = scene.round
  const w = scene.w
  const last = round.kind === 'scale' ? round.log[round.log.length - 1]?.result : undefined
  const drop = last === 'L' ? 28 : last === 'R' ? -28 : 0
  const mid = w / 2
  const beamY = 46
  const leftX = mid - Math.min(108, w * 0.3)
  const rightX = mid + Math.min(108, w * 0.3)
  const bowlW = Math.min(108, w * 0.34)
  const bowlH = 36
  const leftBowl = { x: leftX - bowlW / 2, y: 96 + drop, w: bowlW, h: bowlH }
  const rightBowl = { x: rightX - bowlW / 2, y: 96 - drop, w: bowlW, h: bowlH }
  const tray = { x: 16, y: 176, w: w - 32, h: 108 }
  return { last, drop, mid, beamY, leftX, rightX, leftBowl, rightBowl, tray }
}

function ballSlots(scene: Scene, ids: number[], box: { x: number; y: number; w: number; h: number }, cols: number) {
  return ids.map((id, index) => {
    const col = index % cols
    const row = Math.floor(index / cols)
    const cellW = box.w / cols
    return { id, x: box.x + col * cellW + cellW / 2, y: box.y + 16 + row * 28 }
  })
}

function scaleSpots(scene: Scene): Spot[] {
  const round = scene.round
  if (round.kind !== 'scale') return []
  const frame = scaleFrame(scene)
  const spots: Spot[] = [
    { name: 'pan:left', x: frame.leftBowl.x, y: frame.leftBowl.y - 8, w: frame.leftBowl.w, h: frame.leftBowl.h + 16 },
    { name: 'pan:right', x: frame.rightBowl.x, y: frame.rightBowl.y - 8, w: frame.rightBowl.w, h: frame.rightBowl.h + 16 },
    { name: 'tray', x: frame.tray.x, y: frame.tray.y, w: frame.tray.w, h: frame.tray.h },
  ]
  const trayIds = round.weights.map((_, id) => id).filter((id) => !round.left.includes(id) && !round.right.includes(id))
  const push = (ids: number[], box: { x: number; y: number; w: number; h: number }, cols: number) => {
    ballSlots(scene, ids, box, cols).forEach((ball) => {
      spots.push({ name: `ball:${ball.id}`, x: ball.x - 14, y: ball.y - 14, w: 28, h: 28 })
    })
  }
  push(round.left, frame.leftBowl, 3)
  push(round.right, frame.rightBowl, 3)
  push(trayIds, frame.tray, 5)
  return spots
}

function paintBall(ctx: Pen, x: number, y: number, id: number, picked: boolean) {
  ctx.beginPath()
  ctx.arc(x, y, 13, 0, Math.PI * 2)
  ctx.fillStyle = picked ? '#ff8a3d' : '#8b6cf0'
  ctx.fill()
  if (picked) {
    ctx.lineWidth = 3
    ctx.strokeStyle = '#1c2430'
    ctx.stroke()
  }
  label(ctx, String(id + 1), x, y, '#fff')
}

function paintBowl(ctx: Pen, box: { x: number; y: number; w: number; h: number }) {
  ctx.strokeStyle = '#8d6a45'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(box.x + 6, box.y + 8)
  ctx.quadraticCurveTo(box.x + box.w / 2, box.y + box.h + 16, box.x + box.w - 6, box.y + 8)
  ctx.stroke()
  ctx.strokeStyle = '#c8b89a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(box.x + 10, box.y + 10)
  ctx.quadraticCurveTo(box.x + box.w / 2, box.y + box.h + 8, box.x + box.w - 10, box.y + 10)
  ctx.stroke()
}

function paintScale(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'scale') return
  const frame = scaleFrame(scene)
  ctx.strokeStyle = '#c8b89a'
  ctx.lineWidth = 8
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(frame.leftX, frame.beamY + frame.drop * 0.15)
  ctx.lineTo(frame.mid, frame.beamY)
  ctx.lineTo(frame.rightX, frame.beamY - frame.drop * 0.15)
  ctx.stroke()
  ctx.fillStyle = '#b08968'
  ctx.beginPath()
  ctx.moveTo(frame.mid - 10, frame.beamY + 4)
  ctx.lineTo(frame.mid + 10, frame.beamY + 4)
  ctx.lineTo(frame.mid, frame.beamY + 28)
  ctx.fill()
  const hang = (x: number, bowl: { x: number; y: number; w: number; h: number }) => {
    ctx.strokeStyle = '#8d6a45'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, frame.beamY)
    ctx.lineTo(bowl.x + 12, bowl.y + 8)
    ctx.moveTo(x, frame.beamY)
    ctx.lineTo(bowl.x + bowl.w - 12, bowl.y + 8)
    ctx.stroke()
    paintBowl(ctx, bowl)
  }
  hang(frame.leftX, frame.leftBowl)
  hang(frame.rightX, frame.rightBowl)
  if (frame.last === 'L' || frame.last === 'R') {
    const heavy = frame.last === 'L'
    ctx.fillStyle = '#f15a36'
    ctx.beginPath()
    const x = heavy ? frame.leftX : frame.rightX
    const y = (heavy ? frame.leftBowl.y : frame.rightBowl.y) + frame.leftBowl.h + 18
    ctx.moveTo(x, y + 8)
    ctx.lineTo(x - 7, y - 4)
    ctx.lineTo(x + 7, y - 4)
    ctx.fill()
  }
  ctx.fillStyle = '#f4f1ea'
  roundBox(ctx, frame.tray.x, frame.tray.y, frame.tray.w, frame.tray.h, 16)
  ctx.fill()
  const trayIds = round.weights.map((_, id) => id).filter((id) => !round.left.includes(id) && !round.right.includes(id))
  const drawGroup = (ids: number[], box: { x: number; y: number; w: number; h: number }, cols: number) => {
    ballSlots(scene, ids, box, cols).forEach((ball) => {
      if (scene.carry && scene.dragId === ball.id) return
      paintBall(ctx, ball.x, ball.y, ball.id, scene.dragId === ball.id)
    })
  }
  drawGroup(round.left, frame.leftBowl, 3)
  drawGroup(round.right, frame.rightBowl, 3)
  drawGroup(trayIds, frame.tray, 5)
  if (scene.carry && scene.dragId >= 0) paintBall(ctx, scene.dragX, scene.dragY, scene.dragId, true)
}

function paintBox(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'box') return
  const cell = Math.min(32, (scene.w - 12) / round.w)
  const originX = (scene.w - cell * round.w) / 2
  const originY = 8
  round.walls.forEach((wall, index) => {
    const x = originX + (index % round.w) * cell
    const y = originY + Math.floor(index / round.w) * cell
    ctx.fillStyle = wall ? '#2c3654' : round.goals[index] ? 'rgba(241,90,54,0.28)' : '#f4f1ea'
    ctx.fillRect(x, y, cell - 1, cell - 1)
    if (round.boxes[index]) {
      ctx.fillStyle = '#e0a04e'
      roundBox(ctx, x + 4, y + 4, cell - 10, cell - 10, 4)
      ctx.fill()
    }
    if (index === round.player) {
      ctx.fillStyle = '#ff8a3d'
      ctx.beginPath()
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.28, 0, Math.PI * 2)
      ctx.fill()
      eye(ctx, x + cell / 2 - 3, y + cell / 2 - 1)
      eye(ctx, x + cell / 2 + 3, y + cell / 2 - 1)
    }
  })
}

function paintSlide(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'slide') return
  gridSpots(scene, 3, 68, 'cell').forEach((spot, index) => {
    const tile = round.tiles[index]
    if (!tile) {
      ctx.strokeStyle = '#d5dbe8'
      ctx.setLineDash([4, 4])
      roundBox(ctx, spot.x + 4, spot.y + 4, spot.w - 8, spot.h - 8, 12)
      ctx.stroke()
      ctx.setLineDash([])
      return
    }
    ctx.fillStyle = '#3db7e8'
    roundBox(ctx, spot.x + 4, spot.y + 4, spot.w - 8, spot.h - 8, 12)
    ctx.fill()
    label(ctx, String(tile), spot.x + spot.w / 2, spot.y + spot.h / 2, '#fff')
  })
}

function blockSpot(scene: Scene, block: Block): Spot {
  const cell = Math.min(52, (scene.w - 16) / 4)
  const origin = (scene.w - cell * 4) / 2
  const drag = scene.dragId === block.id
  return {
    name: `block:${block.id}`,
    x: origin + block.c * cell + (drag ? scene.dragX : 0),
    y: 12 + block.r * cell + (drag ? scene.dragY : 0),
    w: block.w * cell,
    h: block.h * cell,
  }
}

function paintKlot(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'klotski') return
  const cell = Math.min(52, (scene.w - 16) / 4)
  const origin = (scene.w - cell * 4) / 2
  ctx.fillStyle = '#f4f1ea'
  roundBox(ctx, origin, 12, cell * 4, cell * 4, 12)
  ctx.fill()
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      ctx.fillStyle = 'rgba(241,90,54,0.18)'
      roundBox(ctx, origin + (round.goal.c + col) * cell + 4, 12 + (round.goal.r + row) * cell + 4, cell - 8, cell - 8, 8)
      ctx.fill()
    }
  }
  const colors = ['#f15a36', '#5aa6e6', '#8b6cf0', '#3ecf8e', '#ffd15c', '#e0a04e']
  round.blocks.forEach((block) => {
    const spot = blockSpot(scene, block)
    ctx.fillStyle = block.role === 'hero' ? colors[0] : colors[(block.id % (colors.length - 1)) + 1]
    roundBox(ctx, spot.x + 3, spot.y + 3, spot.w - 6, spot.h - 6, 8)
    ctx.fill()
    if (block.role === 'hero') {
      eye(ctx, spot.x + spot.w / 2 - 8, spot.y + spot.h / 2)
      eye(ctx, spot.x + spot.w / 2 + 8, spot.y + spot.h / 2)
    }
  })
}

function pegSpots(scene: Scene): Spot[] {
  const width = scene.w / 3
  return [0, 1, 2].map((index) => ({ name: `peg:${index}`, x: index * width, y: 8, w: width, h: scene.h - 16 }))
}

function paintHanoi(ctx: Pen, scene: Scene) {
  const round = scene.round
  if (round.kind !== 'hanoi') return
  const colors = ['#ffd15c', '#5aa6e6', '#8b6cf0', '#f15a36', '#3ecf8e']
  pegSpots(scene).forEach((spot, index) => {
    const cx = spot.x + spot.w / 2
    ctx.fillStyle = '#e7eef6'
    roundBox(ctx, spot.x + 6, spot.y, spot.w - 12, spot.h, 12)
    ctx.fill()
    ctx.fillStyle = '#c8b89a'
    ctx.fillRect(cx - 3, spot.y + 16, 6, spot.h - 36)
    ctx.fillRect(cx - 28, spot.y + spot.h - 22, 56, 8)
    const peg = round.pegs[index]
    peg.forEach((disk, height) => {
      if (scene.dragId === disk) return
      const width = 22 + disk * 12
      const y = spot.y + spot.h - 34 - height * 18
      ctx.fillStyle = colors[disk - 1] ?? '#ccc'
      roundBox(ctx, cx - width / 2, y, width, 14, 7)
      ctx.fill()
    })
  })
  if (scene.dragId > 0) {
    const width = 22 + scene.dragId * 12
    ctx.fillStyle = colors[scene.dragId - 1] ?? '#ccc'
    roundBox(ctx, scene.dragX - width / 2, scene.dragY - 7, width, 14, 7)
    ctx.fill()
  }
}

export { gridBox } from './draw-more'
