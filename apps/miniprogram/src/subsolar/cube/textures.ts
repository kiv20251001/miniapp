/** 展开图每个面上的字母、星号：离屏 2D 画布画好，读出像素做成纹理。 */
import { DataTexture, LinearFilter, RGBAFormat } from 'three'
import { offscreen } from '../labels'

const SIZE = 128

export function faceTexture(fill: string, text: string, ink: string): DataTexture | null {
  const canvas = offscreen(SIZE, SIZE)
  if (!canvas) return null
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, SIZE, SIZE)
  if (text) {
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `800 ${text === '★' ? 78 : 70}px sans-serif`
    ctx.fillText(text, SIZE / 2, SIZE / 2 + 4)
  }
  const source = ctx.getImageData(0, 0, SIZE, SIZE).data
  const data = new Uint8Array(SIZE * SIZE * 4)
  const row = SIZE * 4
  for (let y = 0; y < SIZE; y += 1) {
    data.set(source.subarray((SIZE - 1 - y) * row, (SIZE - y) * row), y * row)
  }
  const texture = new DataTexture(data, SIZE, SIZE, RGBAFormat)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.needsUpdate = true
  return texture
}
