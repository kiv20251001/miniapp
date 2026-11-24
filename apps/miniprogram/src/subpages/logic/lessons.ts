/**
 * 「逻辑思维」闯关文案。中英文写在一起，用 pick() 取。
 * 面向小学二年级以上：要自己动手，才会出现那个「原来如此」。
 */

export type Text = { zh: string; en: string }

export function pick(text: Text, en: boolean) {
  return en ? text.en : text.zh
}

export type GuideAction = 'play'

export type GuideStep = {
  target: string
  title: Text
  text: Text
  action?: GuideAction
  done?: Text
}

export const NAMES: Record<string, Text> = {
  me: { zh: '我', en: 'Me' },
  fox: { zh: '狐', en: 'Fox' },
  hen: { zh: '鸡', en: 'Hen' },
  rice: { zh: '米', en: 'Rice' },
  dad: { zh: '爸', en: 'Dad' },
  mom: { zh: '妈', en: 'Mom' },
  bro: { zh: '哥', en: 'Bro' },
  sis: { zh: '妹', en: 'Sis' },
}

export const WEIGH: Record<string, Text> = {
  L: { zh: '左边沉', en: 'Left side down' },
  R: { zh: '右边沉', en: 'Right side down' },
  '=': { zh: '一样重', en: 'Balanced' },
}

export const NOTES: Record<string, Text> = {
  heavy: { zh: '船装不下这么重。', en: 'The boat cannot carry that much.' },
  away: { zh: '人在对岸，船过不去接。', en: 'That one is on the other bank.' },
  empty: { zh: '船上得有人划。', en: 'Someone has to row.' },
  rower: { zh: '这一关要你自己划船。', en: 'You have to row this boat.' },
  fox: { zh: '狐狸会把单独留下的鸡吃掉。', en: 'The fox would eat the hen if you leave them.' },
  hen: { zh: '鸡会把单独留下的米吃掉。', en: 'The hen would eat the rice if you leave them.' },
  frog: { zh: '它只能往前走一格，或跳过面前的一只。', en: 'It can only move forward one pad, or jump over the one in front.' },
  same: { zh: '左右放一样多，才能比。', en: 'Put the same number on each side.' },
  limit: { zh: '次数用完了。用橡皮重来，或根据结果再指。', en: 'No tries left. Use the eraser, or use the results you have.' },
  nope: { zh: '不是这颗。橡皮可以重称。', en: 'Not that one. The eraser lets you weigh again.' },
  start: { zh: '从连着三条线的点开始。', en: 'Start at a dot with three lines.' },
  wall: { zh: '这边过不去。', en: 'That way is blocked.' },
  disk: { zh: '大盘不能压在小盘上面。', en: 'A bigger disk cannot sit on a smaller one.' },
  trace: { zh: '这条线不能这么走。', en: 'That line does not connect.' },
  flow: { zh: '这条线交叉了，或没连到同色。', en: 'That path crosses another, or it does not reach its color.' },
  peg: { zh: '这样跳不了。要隔着一颗跳进空位。', en: 'That jump is not allowed. Jump over one peg into an empty hole.' },
  match: { zh: '只能从有火柴的地方搬到空位。', en: 'Move a match from a filled slot into an empty one.' },
  pack: { zh: '这块放不下，会叠到别的板上。', en: 'That piece does not fit there.' },
  bridge: { zh: '这两座岛连不上，中间有岛或方向不对。', en: 'Those islands cannot link that way.' },
  cross: { zh: '桥不能交叉。', en: 'Bridges cannot cross.' },
  pit: { zh: '珠子掉进洞里了。', en: 'The ball fell into the pit.' },
  knight: { zh: '马只能走日，而且不能重复踩。', en: 'The knight only moves in an L, and cannot revisit a square.' },
  akari: { zh: '这里不能放灯。', en: 'You cannot place a lamp there.' },
  pair: { zh: '这对数字已经用过了。', en: 'That number pair is already used.' },
  boom: { zh: '踩到雷了。用橡皮重来。', en: 'That was a mine. Use the eraser and try again.' },
  domino: { zh: '要先点相邻的两格。', en: 'Tap two neighboring cells.' },
  code: { zh: '四个空都要放上颜色，再核对。', en: 'Put a color in every slot, then check.' },
}

export const HOWTO: Record<string, Text[]> = {
  frog2: [
    { zh: '点一只青蛙，它会朝箭头方向跳到荷叶上。', en: 'Tap a frog. It jumps the way the arrow points.' },
    { zh: '前面是空荷叶就跳上去；前面有一只、再过去是空的，就跳过去。', en: 'Jump onto an empty pad, or over one frog if the pad beyond is empty.' },
    { zh: '橙色只能往右，蓝色只能往左。两边换个位置就过关。', en: 'Orange only goes right, blue only left. Swap the two sides.' },
  ],
  frog3: [
    { zh: '还是点青蛙，它只会往前跳。', en: 'Tap a frog. It still only jumps forward.' },
    { zh: '这次每边三只，空荷叶只有一个。', en: 'Three on each side, and only one empty pad.' },
  ],
  fox: [
    { zh: '点岸上的人，他会跳上船。点船上的人，他会下到船靠着的岸。', en: 'Tap someone on the bank to board. Tap someone on the boat to step off.' },
    { zh: '再点下面的按钮。按钮上写着开到哪一岸，船就会划过去。', en: 'Then tap the button. It names the bank, and the boat rows there.' },
    { zh: '你不在的岸上，狐狸会吃鸡，鸡会吃米。', en: 'If you leave, the fox eats the hen, and the hen eats the rice.' },
  ],
  family: [
    { zh: '点人上船，点船上的人下船，再点下面的按钮把船划过去。', en: 'Tap to board, tap again to step off, then tap the button to row across.' },
    { zh: '船最多载重 2。爸妈各是 2，两个孩子各是 1。', en: 'The boat holds 2. Each parent is 2, each child is 1.' },
  ],
  lamp1: [
    { zh: '点一盏灯，它和上下左右会一起变亮或变暗。', en: 'Tap a lamp. It and its neighbors all flip.' },
    { zh: '把每一盏都关掉。', en: 'Turn every lamp off.' },
  ],
  lamp2: [
    { zh: '还是点灯，连带上下左右一起变。', en: 'Tap a lamp. Neighbors flip too.' },
    { zh: '灯更多了，目标仍是全部关掉。', en: 'More lamps. Turn them all off.' },
  ],
  pipe: [
    { zh: '点一格，管子就转一下。', en: 'Tap a tile to turn the pipe.' },
    { zh: '让水从橙色的点流到绿色的点。', en: 'Connect the water from the orange dot to the green dot.' },
  ],
  star: [
    { zh: '用手指沿着线画，画到下一个点再继续。', en: 'Draw with your finger from dot to dot.' },
    { zh: '每条线只画一次，画成一颗星。', en: 'Use each line once, and finish the star.' },
  ],
  house: [
    { zh: '从橙色的点开始，手指沿着线画。', en: 'Start at an orange dot and draw along the lines.' },
    { zh: '每条线只画一次。', en: 'Use each line once.' },
  ],
  scale: [
    { zh: '先点一颗球，再点左边或右边的盘子，它会掉进去。点下面的空盘可以拿回来。', en: 'Tap a ball, then tap the left or right pan. It drops in. Tap the tray below to take it back.' },
    { zh: '两边放一样多，再点「称一称」。横梁和指针会往重的那边沉。只有两次。', en: 'Put the same number on each side, then tap Weigh. The beam and needle sink to the heavy side. Only twice.' },
    { zh: '九颗里有一颗更重。点中它，再点「就是这颗」。', en: 'One of the nine is heavier. Tap it, then tap This one.' },
  ],
  box: [
    { zh: '在画面上滑动，小人朝那边走一步。', en: 'Swipe. The person walks one step.' },
    { zh: '前面是箱子就推一格，不能拉，也不能同时推两个。', en: 'A box in front is pushed one square. You cannot pull, or push two at once.' },
    { zh: '三个箱子都推进浅红色的格子。先想好顺序。', en: 'Push all three boxes onto the pale red squares. Plan the order.' },
  ],
  slide: [
    { zh: '只能点挨着空格的数字，它会滑进空格。', en: 'Tap a number next to the gap. Only that tile slides in.' },
    { zh: '排成 1 到 8。这一关要多走一些，不能整排一起滑。', en: 'Line them up from 1 to 8. This one takes many single slides.' },
  ],
  klot: [
    { zh: '按住方块，拖到空的格子里。', en: 'Press a block and drag it into an empty square.' },
    { zh: '红色大方块拖进浅红色的地方就过关。', en: 'Drag the big red block onto the pale red squares.' },
  ],
  hanoi: [
    { zh: '按住最上面的盘子，拖到别的柱子上。', en: 'Drag the top disk onto another peg.' },
    { zh: '大的不能压住小的。五个盘子都到右边。', en: 'A bigger disk cannot sit on a smaller one. Move all five to the right.' },
  ],
  'flow-a': [
    { zh: '从彩色圆点按住，拖到另一个同色圆点。', en: 'Press a colored dot and drag to the matching dot.' },
    { zh: '四条线不能交叉，25 个格子都要铺满。先连短的。', en: 'Four paths cannot cross, and all 25 squares must be filled. Connect the short one first.' },
  ],
  'peg-a': [
    { zh: '先点一颗棋子，再点它能跳到的空位。', en: 'Tap a peg, then tap an empty hole it can jump to.' },
    { zh: '跳过中间那颗，中间的会被拿掉。最后只留一颗。', en: 'Jump over a peg to remove it. Leave only one peg.' },
  ],
  'match-a': [
    { zh: '先点一根火柴，再点虚线空位，把它搬过去。', en: 'Tap a match, then tap a dashed slot to move it there.' },
    { zh: '左上角的数字是现在有几个正方形，大的也算。只搬 3 根，让它变成 0。', en: 'The number at the top left is how many squares you have, big ones too. Move only 3 matches to make 0.' },
  ],
  'pack-a': [
    { zh: '先点下面一块板，点「旋转」转向，再点棋盘放下。', en: 'Tap a piece, tap Rotate, then tap the board to place it.' },
    { zh: '五块板要正好铺满，不能重叠，也不能留空。', en: 'All five pieces must fill the board with no overlap and no gap.' },
  ],
  'bridge-a': [
    { zh: '先点一座岛，再点同一行或同一列的另一座，架起一座桥。', en: 'Tap an island, then another in the same row or column, to build a bridge.' },
    { zh: '再点一次变成两座并排的桥，第三次拆掉。岛上的数字要刚好等于桥的座数。', en: 'Tap again for a double bridge. A third tap removes them. The number must equal its bridges.' },
  ],
  'tilt-a': [
    { zh: '朝一个方向滑动，珠子会一直滚到撞墙。', en: 'Swipe a direction. The ball rolls until it hits a wall.' },
    { zh: '滚进绿色圈就过关。别掉进黑洞。', en: 'Land in the green ring. Do not fall into the black hole.' },
  ],
  'sky-a': [
    { zh: '点格子，高度从 1 到 4 循环。', en: 'Tap a cell to cycle its height from 1 to 4.' },
    { zh: '同一行同一列数字不重复。边上的数是从那边能看见几座楼。', en: 'No repeat in a row or column. Edge numbers are how many towers you can see.' },
  ],
  'knight-a': [
    { zh: '马走日：点它能跳到的格子。', en: 'The knight moves in an L. Tap a square it can jump to.' },
    { zh: '每一格都要踩到，而且不能重复。', en: 'Visit every square once.' },
  ],
  'queen-a': [
    { zh: '点格子放皇后，再点可以拿掉。', en: 'Tap a square to place a queen. Tap again to remove it.' },
    { zh: '放满 4 个，并且谁都不能在同一行、列或斜线上。', en: 'Place 4 queens. None may share a row, column or diagonal.' },
  ],
  'code-a': [
    { zh: '先点上面一个空格，再点下面的颜色放进去。', en: 'Tap an empty slot, then a color below to fill it.' },
    { zh: '四个都放好再点「核对」。实心点是位置对，空心点是颜色对、位置不对。', en: 'Fill all four, then tap Check. A filled dot is the right place. An open dot is the right color in the wrong place.' },
  ],
  'akari-a': [
    { zh: '点白格放灯泡，灯光会照一整行一整列直到墙。', en: 'Tap a white cell to place a lamp. Light fills the row and column until a wall.' },
    { zh: '所有白格都要亮，灯泡不能互相看见。墙上数字是旁边要几盏灯。', en: 'Light every white cell. Lamps cannot see each other. A wall number is how many lamps touch it.' },
  ],
  'domino-a': [
    { zh: '先点一格，再点旁边一格，盖上一张骨牌。', en: 'Tap one cell, then a neighbor, to cover them with a domino.' },
    { zh: '每种数字对只能用一次，整板都要盖住。', en: 'Each number pair may be used once. Cover the whole board.' },
  ],
  'gear-a': [
    { zh: '点一颗齿轮，它顺时针转一齿，咬住的那颗反着转一齿。', en: 'Tap a gear. It turns one tooth clockwise, and a meshed gear turns the other way.' },
    { zh: '五颗连成一串。让每颗上的红点都转到正上方。', en: 'Five gears in a line. Turn until every red mark is at the top.' },
  ],
  'slither-a': [
    { zh: '点格子的边，画上或擦掉一段围栏。', en: 'Tap a side to draw or erase a fence.' },
    { zh: '围成单独的一圈。格子里的数字等于它四条边里有几条围栏。', en: 'Make one single loop. A number is how many of that cell’s four sides are fenced.' },
  ],
  'mine-a': [
    { zh: '已经翻开一块。数字是周围八格里有几颗雷。', en: 'A patch is already open. A number is how many mines touch that cell.' },
    { zh: '用数字推出安全格再点开。点到雷就要重来。', en: 'Use the numbers to find safe cells. A mine makes you start over.' },
  ],
  'cipher-a': [
    { zh: '上下滑动密码轮，数字会跟着转。', en: 'Slide a wheel up or down. The number rolls with your finger.' },
    { zh: '还没转过的轮子，括号里是问号。转过之后，括号里跟着变成现在的数字。', en: 'A wheel you have not turned shows a question mark. After you turn it, the number in parentheses follows.' },
  ],
}

export const BRIEF: Record<string, { prompt: Text; praise: Text }> = {
  frog2: {
    prompt: { zh: '把橙色和蓝色换到对面。只能往前走，或跳过面前一只。', en: 'Swap the orange frogs with the blue ones. Only forward, or one jump.' },
    praise: { zh: '先给对面留一个落脚的空位，才能跳过去。', en: 'Leave an empty pad to land on before you jump.' },
  },
  fox: {
    prompt: { zh: '把狐狸、鸡和米都送到对岸。你不在，狐狸会吃鸡，鸡会吃米。', en: 'Take the fox, hen and rice across. Alone, the fox eats the hen, and the hen eats the rice.' },
    praise: { zh: '鸡得来回接。先把鸡送过河，再分别送狐狸和米。', en: 'The hen has to come back. Ferry the hen first, then the fox and the rice.' },
  },
  lamp1: {
    prompt: { zh: '点一盏，它和上下左右一起变。把灯全部关掉。', en: 'Tap a light. It and its neighbors flip. Turn them all off.' },
    praise: { zh: '亮着的不一定都要按。看一次点击带走了哪些灯。', en: 'You do not have to tap every light that is on. Watch which ones a tap takes with it.' },
  },
  pipe: {
    prompt: { zh: '转动管子，让水从橙色流到绿色。', en: 'Turn the pipes so water runs from orange to green.' },
    praise: { zh: '水亮到哪儿，就接到哪儿。断掉的那一格转一下。', en: 'Water shows how far you are connected. Turn the tile where it stops.' },
  },
  star: {
    prompt: { zh: '用手指把这颗星一笔画完，线不重复。', en: 'Draw the star in one stroke. Do not reuse a line.' },
    praise: { zh: '每个角都连着两条线，从哪个角开始都能画完。', en: 'Every point has two lines, so any start works.' },
  },
  frog3: {
    prompt: { zh: '三对三。空位只有一个，更要想好谁先跳。', en: 'Three against three, and only one empty pad. Decide who jumps first.' },
    praise: { zh: '两边先各跳过一只，空位就会回到中间。', en: 'Let each side jump once. The empty pad returns to the middle.' },
  },
  family: {
    prompt: { zh: '船最多载重 2。爸妈各是 2，孩子各是 1。大家都要到对岸。', en: 'The boat holds weight 2. Each parent is 2, each child is 1. Everyone crosses.' },
    praise: { zh: '两个孩子负责把船划回来，大人一次只能过一个。', en: 'The children bring the boat back. Only one parent can cross at a time.' },
  },
  scale: {
    prompt: { zh: '九颗里有一颗更重。只能称两次，然后指出它。', en: 'One of nine balls is heavier. Two weighings, then point to it.' },
    praise: { zh: '先分成三组，每组三颗。称两组。平了，重的就在没称的那组。', en: 'Split into three groups of three. If the first weighing balances, the heavy ball is in the group you left out.' },
  },
  box: {
    prompt: { zh: '滑动把三个箱子推进阴影。只能推，不能拉。', en: 'Swipe to push three boxes onto the shaded squares. Push only.' },
    praise: { zh: '箱子堵住路就推不出来。先把挡路的推到旁边。', en: 'A box blocking the path gets stuck. Push the blocker aside first.' },
  },
  lamp2: {
    prompt: { zh: '灯更多了。还是点一下，连带上下左右。全部关掉。', en: 'More lights. A tap still flips the light and its neighbors. Turn them all off.' },
    praise: { zh: '同一盏灯按两次等于没按。先找会一次关掉两盏的位置。', en: 'Tapping a light twice undoes it. Look for a tap that turns off two lights.' },
  },
  slide: {
    prompt: { zh: '一次只能把挨着空格的一块滑进去，排成 1 到 8。', en: 'Slide one tile at a time into the gap. Make 1 to 8.' },
    praise: { zh: '先把 1、2、3 送到第一行，不要为了近路把它们拆开。', en: 'Park 1, 2 and 3 on the top row, and do not break them apart for a shortcut.' },
  },
  klot: {
    prompt: { zh: '按住拖动。把红色大方块送进阴影。', en: 'Press and drag. Move the big red block onto the shade.' },
    praise: { zh: '阴影上的横条要先让开，大方块才进得去。', en: 'Move the bar off the shade before the big block can enter.' },
  },
  hanoi: {
    prompt: { zh: '把五层盘子都搬到右边。大的不能压小的。', en: 'Move the five-disk tower to the right peg. Never put a bigger disk on a smaller one.' },
    praise: { zh: '要挪最大的，得先把上面四层整座搬到旁边。', en: 'To free the biggest disk, move the four-disk tower aside first.' },
  },
  house: {
    prompt: { zh: '每条线画一次。这一次，起点不是随便选的。', en: 'Draw each line once. This time the start matters.' },
    praise: { zh: '连着奇数条线的点，要放在起点或终点。', en: 'A dot with an odd number of lines belongs at the start or the end.' },
  },
  'flow-a': {
    prompt: { zh: '把同色圆点连起来，线不能交叉，还要铺满整盘。', en: 'Connect matching dots. Paths cannot cross, and they must fill the board.' },
    praise: { zh: '先连短的那一条，给长线留通道。', en: 'Connect the short pair first so the long path still has room.' },
  },
  'peg-a': {
    prompt: { zh: '跳棋：跳过一颗拿走它。最后只留一颗。', en: 'Jump a peg over another to remove it. Leave only one.' },
    praise: { zh: '别把棋子跳散到边上。尽量往中间收。', en: 'Do not scatter pegs to the edge. Work them toward the center.' },
  },
  'match-a': {
    prompt: { zh: '只搬 3 根。左上角数字是现在有几个正方形，大的也算，要变成 0。', en: 'Move only 3 matches. The number is how many squares you have, big ones too. Make it 0.' },
    praise: { zh: '大的正方形靠外圈。先拆掉同时属于两个正方形的那根。', en: 'The big square uses the outer sticks. First move a stick that belongs to two squares.' },
  },
  'pack-a': {
    prompt: { zh: '旋转并放下五块板，正好铺满 4×5 的格子。', en: 'Rotate and place five pieces so they fill the 4 by 5 grid.' },
    praise: { zh: '先放最长的那条，剩下的空位形状就清楚了。', en: 'Place the long bar first. The leftover shape becomes clear.' },
  },
  'bridge-a': {
    prompt: { zh: '在岛之间架桥，每座岛上的数字是要连几座桥。', en: 'Build bridges between islands. The number is how many bridges it needs.' },
    praise: { zh: '先满足数字最大的岛，小路自然就出来了。', en: 'Satisfy the biggest number first. The other bridges fall into place.' },
  },
  'tilt-a': {
    prompt: { zh: '滑动让珠子滚动。滚进绿圈，躲开黑洞。', en: 'Swipe to roll the ball into the green ring. Avoid the pit.' },
    praise: { zh: '一次滑动会滚到底。先想停在哪一格，再滑。', en: 'One swipe rolls all the way. Decide the stop square before you swipe.' },
  },
  'sky-a': {
    prompt: { zh: '填 1 到 4 的楼高。边上的数是从那边能看见几座。', en: 'Fill heights 1 to 4. Edge clues are how many towers are visible from that side.' },
    praise: { zh: '边上是 1，这一列最前面一定是最高楼。', en: 'A clue of 1 means the nearest cell is the tallest in that line.' },
  },
  'knight-a': {
    prompt: { zh: '马走日，走遍每一格，不重复。', en: 'Move the knight in L-steps to visit every square once.' },
    praise: { zh: '先走到边角，不然最后会无路可跳。', en: 'Visit corners early, or you will trap yourself.' },
  },
  'queen-a': {
    prompt: { zh: '放 4 个皇后，互相不能在同一行、列、斜线。', en: 'Place 4 queens so none share a row, column or diagonal.' },
    praise: { zh: '变红就是互相攻击了。先错开行和列，再检查斜线。', en: 'Red means they attack. Fix rows and columns first, then diagonals.' },
  },
  'code-a': {
    prompt: { zh: '猜四格密码。黑点位置对，白点只有颜色对。', en: 'Crack the 4-color code. Black is right place. White is right color only.' },
    praise: { zh: '白点说明颜色在，只是槽位要换。不要整组丢掉。', en: 'White means keep the color and swap slots. Do not throw the whole guess away.' },
  },
  'akari-a': {
    prompt: { zh: '放灯照亮全部白格。灯不能互射，墙边数字要刚好。', en: 'Place lamps to light every white cell. Lamps cannot see each other, and wall numbers must match.' },
    praise: { zh: '数字是 1 的墙，先把唯一能放的那一侧点上。', en: 'For a wall marked 1, place the only possible touching lamp first.' },
  },
  'domino-a': {
    prompt: { zh: '用骨牌盖满，且每对数字只出现一次。', en: 'Cover the board with dominos. Each number pair appears only once.' },
    praise: { zh: '先盖住只剩一种盖法的格子，别把唯一出路堵死。', en: 'Cover forced pairs first so you do not block the only way out.' },
  },
  'gear-a': {
    prompt: { zh: '五颗齿轮连成一串。点一颗，它和咬住的一起转，红点都要到正上方。', en: 'Five gears in a line. Tap one and it turns with its neighbor. Every red mark must sit at the top.' },
    praise: { zh: '转一颗只带动旁边反转，不会整串一起转。从一头对齐到另一头。', en: 'A tap turns only that gear and its neighbor. Align them from one end to the other.' },
  },
  'slither-a': {
    prompt: { zh: '在 16 格上画单独的一圈。数字等于这一格四边里有几条围栏。', en: 'Draw one loop on the 16 cells. A number is how many of that cell’s four sides are fenced.' },
    praise: { zh: '数字是 3 的格子，三边都要画上，只留一个口。', en: 'A 3 needs three sides. Leave only one side open.' },
  },
  'mine-a': {
    prompt: { zh: '已经翻开一块。用数字推出其余安全格，不要踩雷。', en: 'A patch is already open. Use the numbers to open the rest. Do not hit a mine.' },
    praise: { zh: '数字旁边空格数等于数字时，那些空格全是雷，不要点。', en: 'If a number equals its closed neighbors, those neighbors are all mines. Do not open them.' },
  },
  'cipher-a': {
    prompt: { zh: '滑动 A 到 E 五个密码轮，让上面五条加法同时成立。', en: 'Slide wheels A to E until all five sums are true at once.' },
    praise: { zh: 'A 加 B 等于 A 加 E，所以 B 和 E 一样。再代进别的加法。', en: 'A plus B equals A plus E, so B and E match. Substitute that into the other sums.' },
  },
}

export const GUIDES: GuideStep[] = [
  {
    target: 'guide-road',
    title: { zh: '一关一个谜题', en: 'One puzzle a level' },
    text: { zh: '这些要拖、要画、要称。解开了才打开后面的。', en: 'You drag, draw and weigh. Clear a puzzle to open the next.' },
  },
  {
    target: 'guide-board',
    action: 'play',
    title: { zh: '用手去试', en: 'Try it with your hands' },
    text: { zh: '上面写着这一关的规则。走错了会弹回来，并告诉你为什么。', en: 'The line above is the rule. A bad move bounces back and tells you why.' },
    done: { zh: '卡住了就用橡皮，这一关会回到开头。', en: 'Stuck? The eraser puts this puzzle back to the start.' },
  },
  {
    target: 'guide-help',
    title: { zh: '可以重看', en: 'You can replay this' },
    text: { zh: '问号能再看说明。点前面点亮的关，可以重玩。', en: 'The question mark shows this again. Tap a lit level to replay it.' },
  },
]
