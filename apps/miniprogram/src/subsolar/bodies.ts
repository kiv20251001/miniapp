/**
 * 太阳系天体资料。中英文都写在这里（不进 i18n/en.ts），只在这个分包里用。
 * 数字取自公开天文常数（NASA 行星资料表等），讲解文字为本项目原创。
 */
import type { OrbitElements } from './astro'

export type SurfaceKind = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
export type BodyKey = SurfaceKind

type Text = { zh: string; en: string }

export type Body = {
  key: BodyKey
  name: Text
  /** 选择按钮上的点缀色 */
  color: string
  /** 平均半径，公里 */
  radiusKm: number
  /** 自转周期，小时；负数表示逆向自转 */
  rotationHours: number
  /** 自转轴倾角，度 */
  tilt: number
  moons: string
  orbit?: OrbitElements
  /** 一句话特点，信息卡标题下面显示 */
  tagline: Text
  /** 信息卡正文，也用来朗读，控制在 300 字节以内的中文 */
  intro: Text
}

export const BODIES: Body[] = [
  {
    key: 'sun',
    name: { zh: '太阳', en: 'Sun' },
    color: '#ffb340',
    radiusKm: 696340,
    rotationHours: 609.1,
    tilt: 7.25,
    moons: '—',
    tagline: { zh: '太阳系的中心，一颗会发光的恒星', en: 'The star at the center of our solar system' },
    intro: {
      zh: '太阳是离我们最近的恒星，是一个巨大的发光气体球。它的直径大约是地球的 109 倍，里面能装下 130 万个地球。太阳给地球带来光和热，八大行星都绕着它转。',
      en: 'The Sun is the closest star to us, a giant glowing ball of gas. It is about 109 times wider than Earth, and about 1.3 million Earths could fit inside it. It gives us light and warmth, and all eight planets travel around it.',
    },
  },
  {
    key: 'mercury',
    name: { zh: '水星', en: 'Mercury' },
    color: '#b5aca3',
    radiusKm: 2440,
    rotationHours: 1407.6,
    tilt: 0.03,
    moons: '0',
    orbit: { a: 0.387, e: 0.2056, L0: 252.25, peri: 77.46, period: 87.97 },
    tagline: { zh: '离太阳最近、跑得最快的行星', en: 'The closest and fastest planet' },
    intro: {
      zh: '水星离太阳最近，也是八大行星里最小的。它跑得最快，88 天就绕太阳一圈。水星几乎没有空气，白天能热到 400 多摄氏度，晚上又会冷到零下 170 多摄氏度。',
      en: 'Mercury is the closest planet to the Sun and the smallest of the eight. It is also the fastest, going around the Sun in just 88 days. With almost no air, its days are hotter than 400°C and its nights colder than minus 170°C.',
    },
  },
  {
    key: 'venus',
    name: { zh: '金星', en: 'Venus' },
    color: '#e8c27a',
    radiusKm: 6052,
    rotationHours: -5832.5,
    tilt: 177.4,
    moons: '0',
    orbit: { a: 0.723, e: 0.0068, L0: 181.98, peri: 131.53, period: 224.7 },
    tagline: { zh: '夜空中最亮的行星，也是最热的行星', en: 'The brightest and hottest planet' },
    intro: {
      zh: '金星是夜空中最亮的行星，清晨出现时叫启明星，傍晚出现时叫长庚星。它裹着厚厚的云层，是八大行星里最热的。金星自转很慢，而且是倒着转的，在金星上太阳从西边升起。',
      en: 'Venus is the brightest planet in the night sky, often called the morning star or the evening star. Thick clouds trap its heat, making it the hottest planet. It spins very slowly and backwards, so on Venus the Sun rises in the west.',
    },
  },
  {
    key: 'earth',
    name: { zh: '地球', en: 'Earth' },
    color: '#4f9cf0',
    radiusKm: 6371,
    rotationHours: 23.93,
    tilt: 23.44,
    moons: '1',
    orbit: { a: 1, e: 0.0167, L0: 100.46, peri: 102.94, period: 365.25 },
    tagline: { zh: '我们的家，目前已知唯一有生命的星球', en: 'Our home, the only known planet with life' },
    intro: {
      zh: '地球是我们的家，也是目前已知唯一有生命的星球。地球表面大约 71% 是海洋。地球自转一圈是一天，绕太阳一圈是一年。地轴是斜着的，所以才有了春夏秋冬。',
      en: 'Earth is our home and the only planet we know of with life. About 71% of its surface is ocean. One spin makes a day, and one trip around the Sun makes a year. Its axis is tilted, and that is why we have four seasons.',
    },
  },
  {
    key: 'moon',
    name: { zh: '月球', en: 'Moon' },
    color: '#d6d3cc',
    radiusKm: 1737,
    rotationHours: 655.7,
    tilt: 6.68,
    moons: '—',
    tagline: { zh: '地球唯一的天然卫星', en: "Earth's only natural satellite" },
    intro: {
      zh: '月球是地球唯一的天然卫星，自己不会发光，我们看到的月光是它反射的太阳光。月球绕地球一圈大约 27 天，而且总是同一面朝着地球。从新月到满月再回到新月，大约要 29 天半。',
      en: 'The Moon is Earth’s only natural satellite. It does not make its own light; moonlight is sunlight bouncing off it. It circles Earth about every 27 days and always shows us the same face. Going from new moon to full moon and back takes about 29 and a half days.',
    },
  },
  {
    key: 'mars',
    name: { zh: '火星', en: 'Mars' },
    color: '#e0703c',
    radiusKm: 3390,
    rotationHours: 24.62,
    tilt: 25.19,
    moons: '2',
    orbit: { a: 1.524, e: 0.0934, L0: 355.45, peri: 336.04, period: 686.98 },
    tagline: { zh: '红色星球，一天和地球差不多长', en: 'The red planet with a day like ours' },
    intro: {
      zh: '火星表面有很多铁锈一样的红色尘土，看上去红红的，所以叫红色星球。火星上有太阳系最高的火山奥林匹斯山，差不多有珠穆朗玛峰的两倍半高。火星的一天和地球差不多长。',
      en: 'Mars is covered in rusty red dust, which is why it is called the red planet. It has Olympus Mons, the tallest volcano in the solar system, about two and a half times as tall as Mount Everest. A day on Mars is almost as long as a day on Earth.',
    },
  },
  {
    key: 'jupiter',
    name: { zh: '木星', en: 'Jupiter' },
    color: '#d9a877',
    radiusKm: 69911,
    rotationHours: 9.93,
    tilt: 3.13,
    moons: '90+',
    orbit: { a: 5.203, e: 0.0484, L0: 34.4, peri: 14.75, period: 4332.6 },
    tagline: { zh: '太阳系最大的行星', en: 'The biggest planet' },
    intro: {
      zh: '木星是太阳系最大的行星，里面能装下 1300 多个地球。它是一颗气态巨行星，身上有一条条彩色云带，还有一个比地球还大的风暴，叫大红斑。木星转得最快，不到 10 小时就自转一圈。',
      en: 'Jupiter is the biggest planet; more than 1,300 Earths could fit inside it. It is a gas giant with colorful cloud bands and a storm bigger than Earth called the Great Red Spot. It spins the fastest, making one turn in less than 10 hours.',
    },
  },
  {
    key: 'saturn',
    name: { zh: '土星', en: 'Saturn' },
    color: '#e6cf94',
    radiusKm: 58232,
    rotationHours: 10.66,
    tilt: 26.73,
    moons: '270+',
    orbit: { a: 9.537, e: 0.0539, L0: 49.94, peri: 92.43, period: 10759.2 },
    tagline: { zh: '戴着美丽光环的行星', en: 'The planet with beautiful rings' },
    intro: {
      zh: '土星以美丽的光环出名。光环由无数冰块和石块组成，直径有二十多万公里，厚度却很薄。土星的密度比水还小，如果有一个足够大的浴缸，土星可以浮在水面上。',
      en: 'Saturn is famous for its beautiful rings, made of countless pieces of ice and rock. The rings are over 200,000 kilometers across but very thin. Saturn is less dense than water, so in a big enough bathtub it would float.',
    },
  },
  {
    key: 'uranus',
    name: { zh: '天王星', en: 'Uranus' },
    color: '#8fd9df',
    radiusKm: 25362,
    rotationHours: -17.24,
    tilt: 97.77,
    moons: '28+',
    orbit: { a: 19.19, e: 0.0473, L0: 313.23, peri: 170.96, period: 30688.5 },
    tagline: { zh: '躺着转的冰巨星', en: 'The ice giant that spins on its side' },
    intro: {
      zh: '天王星是一颗冰巨星，看上去是淡淡的蓝绿色。它最特别的地方是躺着转：自转轴倾斜了大约 98 度，就像一个在轨道上滚动的球。天王星绕太阳一圈要 84 年。',
      en: 'Uranus is an ice giant with a pale blue-green color. Its most unusual feature is that it spins on its side: its axis is tilted about 98 degrees, like a ball rolling along its path. One trip around the Sun takes 84 years.',
    },
  },
  {
    key: 'neptune',
    name: { zh: '海王星', en: 'Neptune' },
    color: '#4c74e8',
    radiusKm: 24622,
    rotationHours: 16.11,
    tilt: 28.32,
    moons: '16',
    orbit: { a: 30.07, e: 0.0086, L0: 304.88, peri: 44.97, period: 60182 },
    tagline: { zh: '离太阳最远、风最大的行星', en: 'The farthest and windiest planet' },
    intro: {
      zh: '海王星是离太阳最远的行星，颜色深蓝。它是太阳系里风最大的地方，风速每小时能超过 2000 公里。海王星是科学家先用数学算出位置，再用望远镜找到的。它绕太阳一圈要 165 年。',
      en: 'Neptune is the farthest planet from the Sun, with a deep blue color. It has the strongest winds in the solar system, faster than 2,000 kilometers per hour. Scientists found it by first calculating where it should be. One trip around the Sun takes 165 years.',
    },
  },
]

export const BODY_MAP = Object.fromEntries(BODIES.map((body) => [body.key, body])) as Record<BodyKey, Body>

/** 右侧选择栏的顺序：按离太阳由近到远，月球跟在地球后面。 */
export const PICKER_ORDER: BodyKey[] = ['sun', 'mercury', 'venus', 'earth', 'moon', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']

export const MOON_DISTANCE_KM = 384400
export const MOON_PERIOD_DAYS = 27.32
const AU_KM = 149597870

function grouped(value: number) {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function fixed(value: number) {
  return value >= 100 ? String(Math.round(value)) : value.toFixed(1).replace(/\.0$/, '')
}

export type Fact = { label: Text; value: string }

/** 信息卡上的几项数据，已按语言排好版。 */
export function factsOf(body: Body, en: boolean): Array<{ label: string; value: string }> {
  const facts: Fact[] = []
  const pick = (text: Text) => (en ? text.en : text.zh)
  facts.push({ label: { zh: '直径', en: 'Diameter' }, value: en ? `${grouped(body.radiusKm * 2)} km` : `${grouped(body.radiusKm * 2)} 公里` })
  if (body.orbit) {
    const km = body.orbit.a * AU_KM
    facts.push({
      label: { zh: '离太阳', en: 'From Sun' },
      value: en ? `${fixed(km / 1e6)} million km` : `${fixed(km / 1e8)} 亿公里`,
    })
    const days = body.orbit.period
    facts.push({
      label: { zh: '公转一圈', en: 'Year' },
      value: days < 700 ? (en ? `${fixed(days)} days` : `${fixed(days)} 天`) : (en ? `${fixed(days / 365.25)} years` : `${fixed(days / 365.25)} 年`),
    })
  } else if (body.key === 'moon') {
    facts.push({ label: { zh: '离地球', en: 'From Earth' }, value: en ? `${grouped(MOON_DISTANCE_KM)} km` : `${fixed(MOON_DISTANCE_KM / 1e4)} 万公里` })
    facts.push({ label: { zh: '绕地球一圈', en: 'Orbit' }, value: en ? `${MOON_PERIOD_DAYS} days` : `${MOON_PERIOD_DAYS} 天` })
  } else {
    facts.push({ label: { zh: '离地球', en: 'From Earth' }, value: en ? '150 million km' : '1.5 亿公里' })
  }
  const hours = Math.abs(body.rotationHours)
  const backwards = body.rotationHours < 0 ? (en ? ' (backwards)' : '（倒着转）') : ''
  facts.push({
    label: { zh: '自转一圈', en: 'Day' },
    value: (hours < 48 ? (en ? `${fixed(hours)} hours` : `${fixed(hours)} 小时`) : (en ? `${fixed(hours / 24)} days` : `${fixed(hours / 24)} 天`)) + backwards,
  })
  facts.push({ label: { zh: '直径是地球的', en: 'Size vs Earth' }, value: `${fixed(body.radiusKm / 6371)}×` })
  if (body.moons !== '—') facts.push({ label: { zh: '卫星', en: 'Moons' }, value: body.moons })
  return facts.map((fact) => ({ label: pick(fact.label), value: fact.value }))
}

export function nameOf(key: BodyKey, en: boolean) {
  return en ? BODY_MAP[key].name.en : BODY_MAP[key].name.zh
}

/** 农历日的写法：初一、十五、廿三、三十。 */
export function lunarDayText(day: number, en: boolean) {
  if (en) return `Lunar day ${day}`
  const digits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (day <= 10) return `农历初${digits[day]}`
  if (day < 20) return `农历十${digits[day - 10]}`
  if (day === 20) return '农历二十'
  if (day < 30) return `农历廿${digits[day - 20]}`
  return '农历三十'
}
