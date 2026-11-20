/**
 * 「3D 人体器官」的讲解文字和首次进入的引导，按小学科学（三到六年级「人体」单元）的口径原创编写，
 * 数字取常见的约数，只讲孩子能理解的程度。
 * 中英文写在一起，页面按语言取，不走 i18n 词表。
 */
import type { FoodStage, Layer, PartId, System } from './anatomy'

export { pick, type Text } from '../lessons'
import type { Text } from '../lessons'

export type PartLesson = {
  name: Text
  /** 一句话说它是干什么的 */
  line: Text
  /** 打个比方或一个好记的数字 */
  like: Text
}

export const PART_LESSONS: Record<PartId, PartLesson> = {
  skin: {
    name: { zh: '皮肤', en: 'Skin' },
    line: { zh: '包住全身的「外衣」，挡住细菌，还能感觉冷热和疼。', en: 'The body’s coat. It keeps germs out and feels heat, cold and pain.' },
    like: { zh: '它是人体最大的器官，出汗能帮身体降温。', en: 'It is the largest organ. Sweating through it cools you down.' },
  },
  muscle: {
    name: { zh: '肌肉', en: 'Muscles' },
    line: { zh: '一收一放拉动骨头，我们才能走路、跑跳、拿东西。', en: 'They tighten and relax to pull on bones, so we can walk, jump and grab.' },
    like: { zh: '全身有 600 多块肌肉，心脏也是肌肉做的。', en: 'There are over 600 muscles. The heart is made of muscle too.' },
  },
  skull: {
    name: { zh: '颅骨', en: 'Skull' },
    line: { zh: '像一顶坚硬的头盔，保护里面的大脑。', en: 'A hard helmet that protects the brain inside.' },
    like: { zh: '它由二十多块骨头拼成，长大后拼缝会长牢。', en: 'It is made of over twenty bones that join firmly as you grow.' },
  },
  ribcage: {
    name: { zh: '肋骨', en: 'Rib cage' },
    line: { zh: '一根根弯弯的肋骨围成笼子，护住心脏和肺。', en: 'Curved ribs form a cage that guards the heart and lungs.' },
    like: { zh: '左右各 12 根，呼吸时整个笼子会微微张开、收拢。', en: '12 on each side. The whole cage opens and closes a little as you breathe.' },
  },
  spine: {
    name: { zh: '脊柱', en: 'Spine' },
    line: { zh: '身体的「顶梁柱」，撑起上半身，里面藏着脊髓。', en: 'The body’s main pillar. It holds you up and shelters the spinal cord.' },
    like: { zh: '由二十多块椎骨一节节叠起来，所以能弯腰、扭身。', en: 'Over twenty small bones stack up, which is why you can bend and twist.' },
  },
  pelvis: {
    name: { zh: '骨盆', en: 'Pelvis' },
    line: { zh: '像一个碗托住肚子里的器官，连着两条腿。', en: 'A bowl that holds up the belly organs and connects to the legs.' },
    like: { zh: '坐下时，身体的重量主要落在骨盆上。', en: 'When you sit, most of your weight rests on it.' },
  },
  limbBones: {
    name: { zh: '四肢骨', en: 'Arm and leg bones' },
    line: { zh: '手臂和腿里的长骨头，撑起四肢，靠关节弯曲。', en: 'Long bones in the arms and legs that bend at the joints.' },
    like: { zh: '大腿骨是全身最长的骨头；骨头中间的骨髓会造血。', en: 'The thigh bone is the longest. Marrow inside bones makes blood.' },
  },
  brain: {
    name: { zh: '大脑', en: 'Brain' },
    line: { zh: '身体的「司令部」，负责思考、记忆，指挥全身。', en: 'The body’s headquarters. It thinks, remembers and gives orders.' },
    like: { zh: '表面有很多褶皱，展开后差不多有一张报纸那么大。', en: 'It is full of folds. Spread out, it would be about the size of a newspaper page.' },
  },
  spinalCord: {
    name: { zh: '脊髓', en: 'Spinal cord' },
    line: { zh: '大脑和身体之间的「电话线」，消息在这里上上下下地传。', en: 'The phone line between brain and body. Messages race up and down it.' },
    like: { zh: '手碰到烫的东西会马上缩回来，是脊髓先做的决定。', en: 'When you jerk your hand off something hot, the spinal cord decides first.' },
  },
  trachea: {
    name: { zh: '气管', en: 'Windpipe' },
    line: { zh: '空气的通道，从喉咙往下分成两支，通到左右两个肺。', en: 'The air tube. It runs down from the throat and splits to reach both lungs.' },
    like: { zh: '吃饭时别说笑，免得食物「走错路」进了气管。', en: 'Don’t laugh while eating, or food may go down the wrong way.' },
  },
  lungs: {
    name: { zh: '肺', en: 'Lungs' },
    line: { zh: '把空气里的氧气交给血液，再把二氧化碳送出去。', en: 'They hand oxygen from the air to the blood and send carbon dioxide out.' },
    like: { zh: '里面有几亿个小气泡（肺泡），摊开有半个篮球场那么大。', en: 'Hundreds of millions of tiny air sacs inside would cover half a basketball court.' },
  },
  diaphragm: {
    name: { zh: '膈肌', en: 'Diaphragm' },
    line: { zh: '胸和肚子中间一块圆顶形的肌肉，往下一拉就吸进空气。', en: 'A dome of muscle between chest and belly. Pulling down draws air in.' },
    like: { zh: '打嗝就是它突然抽了一下。', en: 'A hiccup is this muscle twitching suddenly.' },
  },
  heart: {
    name: { zh: '心脏', en: 'Heart' },
    line: { zh: '身体的水泵，一刻不停地把血液送到全身。', en: 'The body’s pump. It never stops sending blood all around you.' },
    like: { zh: '和你的拳头差不多大，一天要跳 10 万次左右。', en: 'About the size of your fist, it beats around 100,000 times a day.' },
  },
  vessels: {
    name: { zh: '血管', en: 'Blood vessels' },
    line: { zh: '血液流动的管道：动脉把血送出去，静脉把血带回心脏。', en: 'Tubes for blood. Arteries carry it out, veins bring it back to the heart.' },
    like: { zh: '一个人的血管连起来，能绕地球两圈多。', en: 'Joined end to end, one person’s blood vessels would wrap around Earth twice.' },
  },
  esophagus: {
    name: { zh: '食道', en: 'Food pipe' },
    line: { zh: '连着嘴巴和胃的管子，一挤一挤把食物推下去。', en: 'The tube from mouth to stomach. It squeezes food down in waves.' },
    like: { zh: '就算倒立，食物也能被推进胃里。', en: 'It works even if you are upside down.' },
  },
  stomach: {
    name: { zh: '胃', en: 'Stomach' },
    line: { zh: '能伸缩的「口袋」，用胃液把食物搅拌成糊糊。', en: 'A stretchy bag that churns food with stomach juice into a paste.' },
    like: { zh: '空着时只有拳头大，吃饱了能撑大好几倍。', en: 'Empty, it is fist-sized. Full, it can stretch several times bigger.' },
  },
  liver: {
    name: { zh: '肝脏', en: 'Liver' },
    line: { zh: '身体的「化工厂」，处理营养、清除有害物质，还会做胆汁。', en: 'The body’s chemical factory. It processes food, clears out harmful stuff and makes bile.' },
    like: { zh: '它是肚子里最大的器官，切掉一部分还能慢慢长回来。', en: 'It is the biggest organ in the belly and can grow back if part is removed.' },
  },
  gallbladder: {
    name: { zh: '胆囊', en: 'Gallbladder' },
    line: { zh: '挂在肝下面的小袋子，存着肝做的胆汁，帮忙消化油脂。', en: 'A small bag under the liver that stores bile to help digest fat.' },
    like: { zh: '吃了油腻的东西，它就挤出胆汁送进小肠。', en: 'After greasy food, it squeezes bile into the small intestine.' },
  },
  pancreas: {
    name: { zh: '胰腺', en: 'Pancreas' },
    line: { zh: '藏在胃后面，做消化液，还管着血液里的糖。', en: 'Tucked behind the stomach, it makes digestive juice and controls blood sugar.' },
    like: { zh: '它做的胰岛素让身体能用上糖里的能量。', en: 'The insulin it makes lets the body use energy from sugar.' },
  },
  spleen: {
    name: { zh: '脾', en: 'Spleen' },
    line: { zh: '血液的「检查站」，过滤旧的红细胞，帮身体抵抗病菌。', en: 'A checkpoint for blood. It filters old red cells and helps fight germs.' },
    like: { zh: '它在胃的左后方，大小和一个小土豆差不多。', en: 'It sits behind the stomach on the left, about the size of a small potato.' },
  },
  smallIntestine: {
    name: { zh: '小肠', en: 'Small intestine' },
    line: { zh: '消化和吸收营养的主要地方，营养从这里进入血液。', en: 'The main place where food is digested and nutrients pass into the blood.' },
    like: { zh: '盘起来塞在肚子里，拉直有 5～6 米长。', en: 'Coiled up in the belly, it would stretch 5 to 6 metres long.' },
  },
  largeIntestine: {
    name: { zh: '大肠', en: 'Large intestine' },
    line: { zh: '吸收剩下的水分，把食物残渣变成便便。', en: 'It soaks up leftover water and turns what is left into poop.' },
    like: { zh: '比小肠粗、比小肠短，像一个「门」字框住小肠。', en: 'Wider but shorter than the small intestine, it frames it like a doorway.' },
  },
  kidneys: {
    name: { zh: '肾', en: 'Kidneys' },
    line: { zh: '血液的「过滤器」，把废物和多余的水变成尿。', en: 'Blood filters. They turn waste and extra water into urine.' },
    like: { zh: '左右各一个，形状像蚕豆，贴在后背腰的位置。', en: 'One on each side, bean-shaped, near the back at your waist.' },
  },
  bladder: {
    name: { zh: '膀胱', en: 'Bladder' },
    line: { zh: '存尿的小口袋，装满了就会提醒你去厕所。', en: 'A small bag that stores urine and tells you when it is time for the toilet.' },
    like: { zh: '它像气球一样，装得越多撑得越大。', en: 'Like a balloon, it stretches as it fills.' },
  },
}

export const LAYER_NAMES: Record<Layer, Text> = {
  skin: { zh: '皮肤', en: 'Skin' },
  muscle: { zh: '肌肉', en: 'Muscle' },
  bone: { zh: '骨骼', en: 'Bones' },
  organ: { zh: '器官', en: 'Organs' },
}

export const LAYER_HINTS: Record<Layer, Text> = {
  skin: { zh: '最外面一层是皮肤，往右一层层剖开看看', en: 'The outside is skin. Peel layer by layer to the right' },
  muscle: { zh: '皮肤下面是肌肉，一条条拉着骨头', en: 'Under the skin are muscles that pull on bones' },
  bone: { zh: '骨骼撑起身体，点骨头看介绍', en: 'Bones hold the body up. Tap a bone to learn more' },
  organ: { zh: '点任意器官看介绍，拖动转着看', en: 'Tap any organ to learn about it. Drag to turn' },
}

export const SYSTEM_LESSONS: Record<System, { name: Text; line: Text }> = {
  respiratory: {
    name: { zh: '呼吸系统', en: 'Breathing' },
    line: { zh: '鼻子、气管和肺一起，把氧气吸进来，把二氧化碳呼出去。', en: 'Nose, windpipe and lungs bring oxygen in and let carbon dioxide out.' },
  },
  circulatory: {
    name: { zh: '循环系统', en: 'Blood flow' },
    line: { zh: '心脏和血管组成一个圆圈，血液带着氧气和营养跑遍全身。', en: 'Heart and vessels form a loop that carries oxygen and food all over the body.' },
  },
  digestive: {
    name: { zh: '消化系统', en: 'Digestion' },
    line: { zh: '从嘴巴到大肠是一条长长的路，食物在这里变成身体能用的营养。', en: 'A long road from mouth to large intestine that turns food into nutrients.' },
  },
  urinary: {
    name: { zh: '泌尿系统', en: 'Urinary' },
    line: { zh: '肾过滤血液做出尿，膀胱存起来，再排出身体。', en: 'Kidneys filter blood into urine; the bladder stores it until it leaves the body.' },
  },
  nervous: {
    name: { zh: '神经系统', en: 'Nerves' },
    line: { zh: '大脑和脊髓通过神经连着全身，又快又准地传消息。', en: 'Brain and spinal cord link to the whole body through nerves, passing messages fast.' },
  },
  skeletal: {
    name: { zh: '骨骼', en: 'Skeleton' },
    line: { zh: '200 多块骨头撑起身体、保护器官，和肌肉一起让我们动起来。', en: 'Over 200 bones hold you up, protect organs and help muscles move you.' },
  },
}

// ---- 工作演示 ----

export const DEMO_NAMES: Record<'heart' | 'lungs' | 'food', Text> = {
  heart: { zh: '心脏跳动', en: 'Heartbeat' },
  lungs: { zh: '肺的呼吸', en: 'Breathing' },
  food: { zh: '食物旅行', en: 'Food journey' },
}

export const DEMO_LINES: Record<'heart' | 'lungs' | 'food', Text> = {
  heart: { zh: '看血液怎么从心脏出发，绕全身一圈再回来', en: 'Watch blood leave the heart, go round the body and come back' },
  lungs: { zh: '按住按钮吸气，松开呼气，看肺怎么变大变小', en: 'Hold the button to breathe in, let go to breathe out' },
  food: { zh: '跟着一口食物，从嘴巴走到大肠', en: 'Follow one bite from your mouth all the way through' },
}

export const HEART_FACTS: Text[] = [
  {
    zh: '心脏一缩，红色的血带着氧气从动脉出发，送到全身。',
    en: 'With each squeeze, red blood full of oxygen leaves through the arteries.',
  },
  {
    zh: '氧气用完的血变成「蓝色」，顺着静脉回到心脏，再去肺里换上新的氧气。',
    en: 'Blood that has used up its oxygen, shown in blue, returns through the veins and goes to the lungs for more.',
  },
  {
    zh: '小提示：真实的血一直是红色的，只是缺氧的血颜色暗一些，图上用蓝色好区分。',
    en: 'Tip: real blood is always red; it is just darker without oxygen. Blue here makes it easy to tell apart.',
  },
]

export const HEART_RUN: Text = {
  zh: '跑步时身体要更多氧气，心脏就跳得更快。跑完歇一会儿，它又慢慢变回来。',
  en: 'When you run, your body needs more oxygen, so the heart beats faster. Rest, and it slows down again.',
}

export const LUNG_TEXT = {
  in: { zh: '吸气：膈肌往下拉、肋骨张开，肺像气球一样鼓起来，蓝色的氧气跑进去。', en: 'Breathe in: the diaphragm pulls down and the ribs open, so the lungs fill like balloons with blue oxygen.' } as Text,
  out: { zh: '呼气：膈肌放松回去，肺变小，灰色的二氧化碳被呼出去。', en: 'Breathe out: the diaphragm relaxes, the lungs shrink and grey carbon dioxide goes out.' } as Text,
  idle: { zh: '肺自己不会动，是膈肌和肋骨带着它一张一缩。', en: 'Lungs can’t move by themselves. The diaphragm and ribs make them grow and shrink.' } as Text,
  rate: { zh: '安静时一分钟呼吸大约 20 次，睡着了也不会停。', en: 'At rest, children breathe about 20 times a minute, even while asleep.' } as Text,
}

export type FoodLesson = { name: Text; time: Text; text: Text }

export const FOOD_LESSONS: Record<FoodStage, FoodLesson> = {
  mouth: {
    name: { zh: '嘴巴', en: 'Mouth' },
    time: { zh: '几十秒', en: 'Under a minute' },
    text: { zh: '牙齿把食物嚼碎，唾液把它变软，还能把一点点淀粉变甜。', en: 'Teeth chew food small and saliva softens it, even turning a little starch sweet.' },
  },
  esophagus: {
    name: { zh: '食道', en: 'Food pipe' },
    time: { zh: '约 10 秒', en: 'About 10 s' },
    text: { zh: '咽下去后，食道一段一段地挤，把食物推进胃里。', en: 'After you swallow, the food pipe squeezes in waves and pushes food into the stomach.' },
  },
  stomach: {
    name: { zh: '胃', en: 'Stomach' },
    time: { zh: '2～4 小时', en: '2–4 hours' },
    text: { zh: '胃一边搅拌一边加胃液，把食物变成稀稀的糊糊。', en: 'The stomach churns and adds juice until food becomes a runny paste.' },
  },
  small: {
    name: { zh: '小肠', en: 'Small intestine' },
    time: { zh: '3～5 小时', en: '3–5 hours' },
    text: { zh: '胆汁和胰液来帮忙，营养（绿色）穿过肠壁进入血液，送去全身。', en: 'Bile and pancreatic juice help out. Nutrients (green) pass through the wall into the blood.' },
  },
  large: {
    name: { zh: '大肠', en: 'Large intestine' },
    time: { zh: '十几个小时到一两天', en: 'Half a day to two days' },
    text: { zh: '大肠吸收剩下的水分（蓝色），残渣慢慢变成便便。', en: 'The large intestine takes back water (blue) and what is left slowly becomes poop.' },
  },
  out: {
    name: { zh: '排出', en: 'Out' },
    time: { zh: '旅行结束', en: 'Journey’s end' },
    text: { zh: '身体用不上的部分排出体外。多吃蔬菜水果、多喝水，肠道走得更顺畅。', en: 'What the body can’t use leaves it. Vegetables, fruit and water keep things moving.' },
  },
}

export const FOODS: Array<{ key: string; name: Text; color: string }> = [
  { key: 'apple', name: { zh: '苹果', en: 'Apple' }, color: '#ff6b5a' },
  { key: 'bread', name: { zh: '面包', en: 'Bread' }, color: '#e9b26a' },
  { key: 'greens', name: { zh: '青菜', en: 'Greens' }, color: '#57c26b' },
]

export const FOOD_DONE: Text = {
  zh: '一口食物的旅行大约要一到两天。',
  en: 'One bite takes about one to two days to make the whole trip.',
}

// ---- 首次进入的引导 ----

export type GuideAction = 'drag' | 'pick' | 'layer' | 'explode' | 'breathe' | 'food'
export type GuideStep = { target: string; title: Text; text: Text; action?: GuideAction; done?: Text }
export type GuideKey = 'explore' | 'heart' | 'lungs' | 'food'

export const GUIDES: Record<GuideKey, GuideStep[]> = {
  explore: [
    {
      target: 'body-stage',
      title: { zh: '转一转，点一点', en: 'Turn and tap' },
      text: {
        zh: '一根手指拖动转着看，两根手指捏合放大缩小。点一个器官试试，镜头会飞过去。',
        en: 'Drag to turn, pinch to zoom. Tap an organ and the camera flies to it.',
      },
      action: 'pick',
      done: { zh: '下面出现了它的介绍卡片。', en: 'Its info card appeared below.' },
    },
    {
      target: 'guide-layers',
      title: { zh: '一层层剖开', en: 'Peel the layers' },
      text: {
        zh: '从皮肤、肌肉、骨骼到器官，点一点看身体里面有什么。',
        en: 'Skin, muscle, bones, organs: tap to see what is inside.',
      },
      action: 'layer',
    },
    {
      target: 'guide-explode',
      title: { zh: '把器官展开', en: 'Spread the organs' },
      text: {
        zh: '点「展开」或拖动滑块，器官会散开，每一个都看得清清楚楚。',
        en: 'Tap "Spread" or drag the slider to pull the organs apart so you can see each one.',
      },
      action: 'explode',
    },
    {
      target: 'guide-systems',
      title: { zh: '按系统看', en: 'By system' },
      text: {
        zh: '只看呼吸、循环、消化这些系统，看看哪些器官是一伙的。',
        en: 'Show just one system, like breathing or digestion, to see which organs team up.',
      },
    },
  ],
  heart: [
    {
      target: 'body-stage',
      title: { zh: '血液在流动', en: 'Blood on the move' },
      text: {
        zh: '红色是带着氧气的血，蓝色是氧气用完的血。看它们从心脏出发，又回到心脏。',
        en: 'Red blood carries oxygen; blue has used it up. Watch both leave the heart and return.',
      },
    },
    {
      target: 'guide-heart',
      title: { zh: '跑一跑', en: 'Go for a run' },
      text: {
        zh: '点「跑一跑」，看看心跳会变成多快。',
        en: 'Tap "Run" and see how fast the heart beats.',
      },
    },
  ],
  lungs: [
    {
      target: 'guide-breathe',
      title: { zh: '按住吸气', en: 'Hold to breathe in' },
      text: {
        zh: '按住按钮吸气，松开就呼气。可以跟着画面一起呼吸。',
        en: 'Hold the button to breathe in, let go to breathe out. Breathe along with it.',
      },
      action: 'breathe',
      done: { zh: '肺鼓起来了，膈肌也往下走了。', en: 'The lungs filled up and the diaphragm moved down.' },
    },
  ],
  food: [
    {
      target: 'guide-food',
      title: { zh: '选一种食物', en: 'Pick a food' },
      text: {
        zh: '选一种食物，看它在身体里走了哪些地方，每一站要待多久。',
        en: 'Pick a food and see where it goes in the body and how long each stop takes.',
      },
      action: 'food',
    },
    {
      target: 'guide-timeline',
      title: { zh: '六个站', en: 'Six stops' },
      text: {
        zh: '点任意一站可以直接跳过去，再看一遍。',
        en: 'Tap any stop to jump straight there and watch again.',
      },
    },
  ],
}
