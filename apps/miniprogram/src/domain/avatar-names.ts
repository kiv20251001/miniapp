import type { ChildAvatarKey } from '@server-domain/types'

/** 选中头像后，孩子名字输入框的提示；留空提交时也用它作名字。 */
export const AVATAR_DEFAULT_NAME: Record<ChildAvatarKey, string> = {
  'boy-blue': '小Y',
  'boy-cap': '小I',
  'girl-flower': '小M',
  'girl-bow': '小U',
}

export function avatarDefaultName(key?: ChildAvatarKey) {
  return (key && AVATAR_DEFAULT_NAME[key]) || AVATAR_DEFAULT_NAME['boy-blue']
}
