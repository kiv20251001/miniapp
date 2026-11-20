/**
 * 3D 场景里的天体名字。用离屏 2D 画布按设备系统字体画字，读出像素做成纹理，
 * 不随包带任何字体文件。
 */
import { DataTexture, LinearFilter, RGBAFormat, Sprite, SpriteMaterial } from 'three'

const SCALE = 2
const FONT_PX = 13
const HEIGHT_PX = 22

export type Label = { sprite: Sprite; aspect: number }

export function offscreen(width: number, height: number) {
  try {
    // #ifdef MP-WEIXIN
    return wx.createOffscreenCanvas?.({ type: '2d', width, height }) ?? null
    // #endif
  } catch {
    return null
  }
  return null
}

/** pill：在浅色背景上用，文字下面垫一块圆角底色，不加阴影。 */
export function createLabel(text: string, color = '#ffffff', pill?: string): Label | null {
  const font = `${pill ? 700 : 600} ${FONT_PX * SCALE}px sans-serif`
  const probe = offscreen(8, 8)
  if (!probe) return null
  const probeCtx = probe.getContext('2d')
  probeCtx.font = font
  const width = Math.ceil(probeCtx.measureText(text).width + (pill ? 16 : 12) * SCALE)
  const height = HEIGHT_PX * SCALE
  const canvas = offscreen(width, height)
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (pill) {
    const r = height / 2 - SCALE
    ctx.fillStyle = pill
    ctx.beginPath()
    ctx.moveTo(r + SCALE, SCALE)
    ctx.lineTo(width - r - SCALE, SCALE)
    ctx.arc(width - r - SCALE, height / 2, r, -Math.PI / 2, Math.PI / 2)
    ctx.lineTo(r + SCALE, height - SCALE)
    ctx.arc(r + SCALE, height / 2, r, Math.PI / 2, Math.PI * 1.5)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
    ctx.shadowBlur = 4 * SCALE
  }
  ctx.fillStyle = color
  ctx.fillText(text, width / 2, height / 2)
  const source = ctx.getImageData(0, 0, width, height).data
  // 画布的第一行在上面，纹理的第一行在下面，逐行翻过来
  const data = new Uint8Array(width * height * 4)
  const row = width * 4
  for (let y = 0; y < height; y += 1) {
    data.set(source.subarray((height - 1 - y) * row, (height - y) * row), y * row)
  }
  const texture = new DataTexture(data, width, height, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  const material = new SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, sizeAttenuation: false })
  const sprite = new Sprite(material)
  sprite.renderOrder = 10
  return { sprite, aspect: width / height }
}

/** sizeAttenuation 关掉后，sprite 的 scale 是相对视口的比例。按屏幕像素算出要设的值。 */
export function fitLabel(label: Label, viewportHeight: number, fovDeg: number) {
  const h = (HEIGHT_PX / viewportHeight) * 2 * Math.tan((fovDeg * Math.PI) / 360)
  label.sprite.scale.set(h * label.aspect, h, 1)
}

export function disposeLabel(label: Label) {
  label.sprite.material.map?.dispose()
  label.sprite.material.dispose()
}
