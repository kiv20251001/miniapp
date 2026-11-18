/**
 * 月相、四季的知识点和首次进入的引导，文字为本项目原创，按小学科学课本的口径编写。
 * 中英文写在一起，页面按语言取，不走 i18n 词表。
 */
import type { Mode } from './scene'

export type Text = { zh: string; en: string }

export const pick = (text: Text, en: boolean) => (en ? text.en : text.zh)

export const MODE_HINTS: Record<Mode, Text> = {
  system: {
    zh: '距离和大小都缩小了，方便看清轨道。点星球看介绍',
    en: 'Distances and sizes are shrunk so the orbits fit. Tap a planet to learn more',
  },
  compare: {
    zh: '行星按真实大小排队，左边露出一角的是太阳',
    en: 'Planets in true size order. The edge on the left is the Sun',
  },
  moon: {
    zh: '月亮自己不发光，总是朝太阳的一半被照亮。拖动月球绕地球转一圈看看',
    en: 'The Moon has no light of its own; the half facing the Sun is lit. Drag the Moon around Earth',
  },
  seasons: {
    zh: '地球斜着身子绕太阳转，地轴方向一直不变。拖动地球转一圈看看',
    en: 'Earth is tilted and its axis keeps pointing the same way. Drag Earth around the Sun',
  },
}

export type PhaseLesson = { name: string; elongation: number; text: Text }

/** 八个月相，按月球离太阳的角度排列；name 和 astro.ts 的月相名一致。 */
export const PHASE_LESSONS: PhaseLesson[] = [
  {
    name: '新月',
    elongation: 0,
    text: {
      zh: '农历初一前后。月亮走到地球和太阳中间，亮的一面背对着我们，所以几乎看不见。',
      en: 'Around lunar day 1. The Moon sits between Earth and the Sun, its lit side faces away from us, so we can hardly see it.',
    },
  },
  {
    name: '蛾眉月',
    elongation: 45,
    text: {
      zh: '农历初三、初四。傍晚太阳落山后，西边天空低处有一弯细细的月牙，右边亮。',
      en: 'Around lunar days 3–4. After sunset a thin crescent hangs low in the west, lit on the right.',
    },
  },
  {
    name: '上弦月',
    elongation: 90,
    text: {
      zh: '农历初七、初八。右半边亮，上半夜在西边天空。口诀「上上上西西」：上弦月，上半月，上半夜，西边天空，西边亮。',
      en: 'Around lunar days 7–8. The right half is lit and it is seen in the western sky in the evening.',
    },
  },
  {
    name: '盈凸月',
    elongation: 135,
    text: {
      zh: '农历初十左右。亮的部分超过一半，一天比一天圆。',
      en: 'Around lunar day 10. More than half is lit and it grows rounder every day.',
    },
  },
  {
    name: '满月',
    elongation: 180,
    text: {
      zh: '农历十五、十六。地球在太阳和月亮中间，月亮朝着我们的一面全被照亮。太阳落山时它从东边升起，整夜都能看到。',
      en: 'Around lunar days 15–16. Earth is between the Sun and the Moon, so the whole side facing us is lit. It rises in the east at sunset and shines all night.',
    },
  },
  {
    name: '亏凸月',
    elongation: 225,
    text: {
      zh: '农历十八左右。从右边开始变暗，一天比一天小。',
      en: 'Around lunar day 18. It starts to darken from the right and shrinks every day.',
    },
  },
  {
    name: '下弦月',
    elongation: 270,
    text: {
      zh: '农历廿二、廿三。左半边亮，下半夜才升起，清晨在东边天空。口诀「下下下东东」：下弦月，下半月，下半夜，东边天空，东边亮。',
      en: 'Around lunar days 22–23. The left half is lit. It rises after midnight and is seen in the eastern sky at dawn.',
    },
  },
  {
    name: '残月',
    elongation: 315,
    text: {
      zh: '农历廿六左右。天快亮时东边天空的一弯月牙，左边亮，过几天又回到新月。',
      en: 'Around lunar day 26. A thin crescent in the east before dawn, lit on the left. In a few days it is a new moon again.',
    },
  },
]

export type SeasonPoint = { name: string; sunLon: number; date: Text; text: Text }

/** 二分二至，sunLon 是太阳黄经。 */
export const SEASON_POINTS: SeasonPoint[] = [
  {
    name: '春分',
    sunLon: 0,
    date: { zh: '3月20日前后', en: 'around Mar 20' },
    text: {
      zh: '太阳直射赤道，全世界白天和黑夜差不多一样长。过了春分，北半球白天越来越长。',
      en: 'The Sun is overhead at the equator, so day and night are about equal everywhere. After this, days in the north get longer.',
    },
  },
  {
    name: '夏至',
    sunLon: 90,
    date: { zh: '6月21日前后', en: 'around Jun 21' },
    text: {
      zh: '北半球最朝向太阳，太阳直射北回归线。这一天北半球白天最长，北京白天约 15 小时。',
      en: 'The north leans most toward the Sun, which is overhead at the Tropic of Cancer. The longest day in the north: about 15 hours in Beijing.',
    },
  },
  {
    name: '秋分',
    sunLon: 180,
    date: { zh: '9月23日前后', en: 'around Sep 23' },
    text: {
      zh: '太阳又直射赤道，白天和黑夜又差不多一样长。过了秋分，北半球白天越来越短。',
      en: 'The Sun is overhead at the equator again and day equals night. After this, days in the north get shorter.',
    },
  },
  {
    name: '冬至',
    sunLon: 270,
    date: { zh: '12月22日前后', en: 'around Dec 22' },
    text: {
      zh: '北半球背向太阳，太阳直射南回归线。这一天北半球白天最短，北京白天只有约 9 小时。',
      en: 'The north leans away from the Sun, which is overhead at the Tropic of Capricorn. The shortest day in the north: only about 9 hours in Beijing.',
    },
  },
]

/** 不在二分二至附近时，按太阳在哪一段说明正在发生什么。 */
export const SEASON_BETWEEN: Text[] = [
  {
    zh: '春分到夏至之间：太阳直射点从赤道往北移，北京的白天一天比一天长。',
    en: 'Between the March equinox and the June solstice: the overhead Sun moves north and Beijing’s days grow longer.',
  },
  {
    zh: '夏至到秋分之间：太阳直射点往赤道退回，白天开始变短，但还比黑夜长。',
    en: 'Between the June solstice and the September equinox: the overhead Sun moves back toward the equator; days shorten but are still longer than nights.',
  },
  {
    zh: '秋分到冬至之间：太阳直射点到了南半球，北京的白天比黑夜短，而且越来越短。',
    en: 'Between the September equinox and the December solstice: the overhead Sun is in the south; Beijing’s days are shorter than nights and keep shrinking.',
  },
  {
    zh: '冬至到春分之间：太阳直射点从南回归线往北回，白天一天天变长，春天快来了。',
    en: 'Between the December solstice and the March equinox: the overhead Sun heads north again; days lengthen and spring is coming.',
  },
]

export type GuideAction = 'select' | 'drag-moon' | 'drag-earth'
export type GuideStep = { target: string; title: Text; text: Text; action?: GuideAction; done?: Text }

export const GUIDES: Partial<Record<Mode, GuideStep[]>> = {
  system: [
    {
      target: 'guide-modes',
      title: { zh: '四种看法', en: 'Four views' },
      text: {
        zh: '「太阳系」看行星怎么转，「大小对比」看谁大谁小，「月相」「四季」可以动手拖一拖。',
        en: '"Solar system" shows how planets move, "Sizes" compares them, and in "Moon" and "Seasons" you drag things yourself.',
      },
    },
    {
      target: 'guide-stage',
      title: { zh: '转一转、缩一缩', en: 'Turn and zoom' },
      text: {
        zh: '一根手指拖动可以转动视角；两根手指张开放大、捏拢缩小，也可以点右上角的 ＋ 和 −。',
        en: 'Drag with one finger to turn the view. Spread two fingers to zoom in and pinch to zoom out, or tap + and − at the top right.',
      },
    },
    {
      target: 'guide-stage',
      title: { zh: '点一下星球', en: 'Tap a planet' },
      text: {
        zh: '点画面里的任意一颗星球试试，镜头会飞过去，下面出现它的介绍卡片。',
        en: 'Tap any planet in the picture. The camera flies over and its info card appears below.',
      },
      action: 'select',
      done: { zh: '看，下面出现了它的介绍卡片，往下滑可以看完整介绍。', en: 'Look, its info card appeared below. Scroll it to read more.' },
    },
    {
      target: 'guide-picker',
      title: { zh: '星球名单', en: 'Planet list' },
      text: {
        zh: '也可以点这里的名字。点到靠边的名字，名单会自动滑动，露出后面的星球。',
        en: 'You can also tap a name here. Tapping one near the edge scrolls the list to show more.',
      },
    },
    {
      target: 'guide-controls',
      title: { zh: '时间快慢', en: 'Speed of time' },
      text: {
        zh: '暂停、拖动速度条让行星转快转慢，点「今天」回到今天真实的位置。',
        en: 'Pause, drag the slider to speed up or slow down, and tap "Today" to return to today’s real positions.',
      },
    },
  ],
  compare: [
    {
      target: 'guide-stage',
      title: { zh: '谁大谁小', en: 'Who is bigger?' },
      text: {
        zh: '行星按真实比例排成一排。一根手指左右拖动看后面的行星，两根手指张开放大、捏拢缩小。',
        en: 'The planets are lined up at true scale. Drag left and right with one finger to see the rest, and pinch to zoom.',
      },
    },
    {
      target: 'guide-picker',
      title: { zh: '点名字飞过去', en: 'Tap a name to fly there' },
      text: {
        zh: '点名字，镜头会飞到那颗星球前面，比一比它和地球差多少。',
        en: 'Tap a name and the camera flies to that planet so you can compare it with Earth.',
      },
    },
  ],
  moon: [
    {
      target: 'guide-stage',
      title: { zh: '拖动月球', en: 'Drag the Moon' },
      text: {
        zh: '阳光从右边照过来。按住月球绕地球拖一圈，看看月球的亮面一直朝哪边。',
        en: 'Sunlight comes from the right. Hold the Moon and drag it around Earth. Which way does its lit side always face?',
      },
      action: 'drag-moon',
      done: { zh: '发现了吗？不管转到哪里，月球亮的一半总是朝着太阳。', en: 'Did you notice? Wherever it goes, the lit half of the Moon always faces the Sun.' },
    },
    {
      target: 'guide-moon-view',
      title: { zh: '地球上看到的样子', en: 'What we see from Earth' },
      text: {
        zh: '这里是站在地球上看到的月亮。亮面一样朝着太阳，只是我们看到的亮面有多有少，就成了不同的月相。',
        en: 'This is the Moon as seen from Earth. Its lit half still faces the Sun; we just see more or less of it, which gives the phases.',
      },
    },
    {
      target: 'guide-phase-row',
      title: { zh: '八个月相', en: 'Eight phases' },
      text: {
        zh: '点任意一个月相，月球会转到对应的位置，下面告诉你它在农历哪天、什么时候能看到。',
        en: 'Tap a phase and the Moon moves there. You will see which lunar day it is and when to look for it.',
      },
    },
  ],
  seasons: [
    {
      target: 'guide-stage',
      title: { zh: '拖动地球', en: 'Drag Earth' },
      text: {
        zh: '按住地球绕太阳拖动。注意黄色的地轴一直斜着、方向不变，北半球有时朝向太阳，有时背向太阳。',
        en: 'Hold Earth and drag it around the Sun. The yellow axis stays tilted the same way, so the north sometimes leans toward the Sun and sometimes away.',
      },
      action: 'drag-earth',
      done: { zh: '发现了吗？地轴一直斜着指向同一个方向，所以有了四季。', en: 'Did you notice? The axis always tilts the same way, and that is why we have seasons.' },
    },
    {
      target: 'guide-season-view',
      title: { zh: '太阳直射点和白天长短', en: 'Overhead Sun and day length' },
      text: {
        zh: '左边是太阳直射的位置，在南北回归线之间来回移动；右边是北京白天和黑夜各有多长。',
        en: 'On the left is where the Sun is overhead, moving between the two tropics. On the right is how long day and night are in Beijing.',
      },
    },
    {
      target: 'guide-term-row',
      title: { zh: '春分 夏至 秋分 冬至', en: 'Equinoxes and solstices' },
      text: {
        zh: '点一个节气，地球会转到那天的位置，看看那天发生了什么。',
        en: 'Tap one and Earth moves to that day. See what happens then.',
      },
    },
  ],
}
