/**
 * 天文计算。角度都用「度」，黄经从春分点起算、逆时针（从北天极往下看）增加。
 * 行星用 J2000 平根数 + 开普勒方程，忽略轨道倾角，精度够孩子看「今天行星大概在哪」。
 */

export const DEG = Math.PI / 180
export const OBLIQUITY = 23.44
export const SYNODIC_MONTH = 29.53
export const YEAR_DAYS = 365.25
const J2000 = Date.UTC(2000, 0, 1, 12)

export type OrbitElements = {
  /** 半长轴，天文单位 */
  a: number
  e: number
  /** J2000 平黄经 */
  L0: number
  /** 近日点黄经 */
  peri: number
  /** 公转周期，天 */
  period: number
}

export function mod360(value: number) {
  return ((value % 360) + 360) % 360
}

export function daysSinceJ2000(time = Date.now()) {
  return (time - J2000) / 86400000
}

/** 返回日心黄经（度）和日心距离（天文单位）。 */
export function heliocentric(el: OrbitElements, days: number) {
  const L = el.L0 + (360 / el.period) * days
  const M = mod360(L - el.peri) * DEG
  let E = M
  for (let i = 0; i < 6; i += 1) E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E))
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2))
  return { lon: mod360(nu / DEG + el.peri), r: el.a * (1 - el.e * Math.cos(E)) }
}

/** 月球地心平黄经。 */
export function moonLongitude(days: number) {
  return mod360(218.316 + 13.176396 * days)
}

// ---- 月相 ----

export type MoonPhase = {
  /** 月球相对太阳的角距 0~360：0 新月，90 上弦，180 满月，270 下弦 */
  elongation: number
  /** 被照亮的比例 0~1 */
  lit: number
  name: string
  /** 农历日，1~30 */
  lunarDay: number
}

const PHASES: Array<[number, string]> = [
  [11.25, '新月'],
  [78.75, '蛾眉月'],
  [101.25, '上弦月'],
  [168.75, '盈凸月'],
  [191.25, '满月'],
  [258.75, '亏凸月'],
  [281.25, '下弦月'],
  [348.75, '残月'],
  [360, '新月'],
]

export function moonPhase(moonLon: number, sunLon: number): MoonPhase {
  const elongation = mod360(moonLon - sunLon)
  const name = PHASES.find(([limit]) => elongation < limit)?.[1] ?? '新月'
  return {
    elongation,
    lit: (1 - Math.cos(elongation * DEG)) / 2,
    name,
    lunarDay: Math.min(30, Math.floor((elongation / 360) * SYNODIC_MONTH) + 1),
  }
}

// ---- 四季与昼夜 ----

/** 二十四节气，按太阳黄经每 15° 一个，从春分开始。 */
export const SOLAR_TERMS = [
  '春分', '清明', '谷雨', '立夏', '小满', '芒种',
  '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
  '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰',
]

export type Season = '春天' | '夏天' | '秋天' | '冬天'

export type SeasonInfo = {
  /** 太阳地心黄经 */
  sunLon: number
  /** 太阳直射点纬度 */
  declination: number
  term: string
  season: Season
  /** 北半球白天时长（小时） */
  dayHours: number
  /** 大约的公历日期 */
  month: number
  day: number
}

/** 北京的纬度，昼长按这里算。 */
export const LATITUDE = 39.9

export function declinationOf(sunLon: number) {
  return Math.asin(Math.sin(OBLIQUITY * DEG) * Math.sin(sunLon * DEG)) / DEG
}

export function dayLength(latitude: number, declination: number) {
  const x = -Math.tan(latitude * DEG) * Math.tan(declination * DEG)
  if (x <= -1) return 24
  if (x >= 1) return 0
  return (2 * Math.acos(x)) / DEG / 15
}

/** 以立春、立夏、立秋、立冬为四季的起点，和孩子在课本里学的一致。 */
function seasonOf(sunLon: number): Season {
  const lon = mod360(sunLon)
  if (lon >= 315 || lon < 45) return '春天'
  if (lon < 135) return '夏天'
  if (lon < 225) return '秋天'
  return '冬天'
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function seasonInfo(sunLon: number, latitude = LATITUDE): SeasonInfo {
  const lon = mod360(sunLon)
  const declination = declinationOf(lon)
  // 春分约在 3 月 20 日（一年第 79 天），太阳每天走约 0.9856°
  let dayOfYear = Math.round(79 + lon / 0.9856) % 365
  let month = 0
  while (dayOfYear >= MONTH_DAYS[month]) {
    dayOfYear -= MONTH_DAYS[month]
    month += 1
  }
  return {
    sunLon: lon,
    declination,
    term: SOLAR_TERMS[Math.floor(lon / 15) % 24],
    season: seasonOf(lon),
    dayHours: dayLength(latitude, declination),
    month: month + 1,
    day: dayOfYear + 1,
  }
}

/** 黄道坐标转场景坐标：黄道面是 xz 平面，北是 +y，黄经逆时针增加。 */
export function eclipticToScene(lonDeg: number, radius: number) {
  const a = lonDeg * DEG
  return { x: radius * Math.cos(a), z: -radius * Math.sin(a) }
}

/** 场景坐标转黄经。 */
export function sceneToEcliptic(x: number, z: number) {
  return mod360(Math.atan2(-z, x) / DEG)
}
