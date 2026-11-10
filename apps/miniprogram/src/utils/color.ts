function channels(hex: string) {
  const value = hex.trim().replace('#', '')
  const full = value.length === 3 ? value.split('').map((item) => item + item).join('') : value
  if (!/^[\da-f]{6}$/i.test(full)) return [123, 97, 255]
  return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16))
}

let mixBase = '#ffffff'
let darkMix = false

export function setMixBase(hex: string, dark = false) {
  mixBase = hex
  darkMix = dark
}

export function currentMixBase() {
  return mixBase
}

export function isDarkMix() {
  return darkMix
}

/** targetWeight 为 0 时保持原色，为 1 时变成目标色。 */
export function mix(hex: string, target: string, targetWeight: number) {
  const from = channels(hex)
  const to = channels(target)
  const weight = Math.min(1, Math.max(0, targetWeight))
  const next = from.map((channel, index) => Math.round(channel + (to[index] - channel) * weight))
  return `rgb(${next.join(',')})`
}

export function deepTone(hex: string) {
  return darkMix ? mix(hex, '#ffffff', 0.38) : mix(hex, '#2a2350', 0.24)
}

export function tileBackground(hex: string) {
  return `linear-gradient(150deg, ${mix(hex, '#ffffff', 0.12)} 0%, ${deepTone(hex)} 100%)`
}

export function cardBackground(hex: string) {
  if (darkMix) {
    return `linear-gradient(150deg, ${mix(hex, mixBase, 0.86)} 0%, ${mixBase} 62%)`
  }
  return `linear-gradient(150deg, ${mix(hex, '#ffffff', 0.88)} 0%, #ffffff 55%)`
}

export function folderTab(hex: string) {
  if (darkMix) {
    return `linear-gradient(135deg, ${mix(hex, mixBase, 0.6)} 0%, ${mix(hex, mixBase, 0.84)} 100%)`
  }
  return `linear-gradient(135deg, ${mix(hex, '#ffffff', 0.38)} 0%, ${mix(hex, '#ffffff', 0.74)} 100%)`
}
