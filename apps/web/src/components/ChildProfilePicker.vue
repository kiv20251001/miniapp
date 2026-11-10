<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import ChildAvatar from '@/components/ChildAvatar.vue'
import { CHILD_AVATAR_OPTIONS, childAvatarOption, DEFAULT_CHILD_AVATAR } from '@/domain/constants'
import type { ChildAvatarKey } from '@/domain/types'

const props = withDefaults(defineProps<{
  modelValue: string[]
  mode?: 'switch' | 'multiple'
  centered?: boolean
}>(), {
  mode: 'switch',
  centered: false,
})

const emit = defineEmits<{
  'update:modelValue': [ids: string[]]
}>()

const store = useAppStore()
const managing = ref(false)
const newChildName = ref('')
const newChildAvatar = ref<ChildAvatarKey>(DEFAULT_CHILD_AVATAR.key)
const editingAvatarId = ref('')
const error = ref('')
const names = reactive<Record<string, string>>({})

function avatarUsedByOther(key: ChildAvatarKey, exceptId?: string) {
  return store.snapshot.children.some((child) => child.id !== exceptId && childAvatarOption(child.avatarKey).key === key)
}

function firstFreeAvatar() {
  return CHILD_AVATAR_OPTIONS.find((option) => !avatarUsedByOther(option.key))?.key ?? DEFAULT_CHILD_AVATAR.key
}

const canAddChild = computed(() =>
  store.snapshot.children.length < CHILD_AVATAR_OPTIONS.length && CHILD_AVATAR_OPTIONS.some((option) => !avatarUsedByOther(option.key)),
)

watch(managing, (open) => {
  if (!open) return
  error.value = ''
  editingAvatarId.value = ''
  newChildAvatar.value = firstFreeAvatar()
  for (const child of store.snapshot.children) names[child.id] = child.name
})

function choose(childId: string) {
  if (props.mode === 'switch') {
    emit('update:modelValue', [childId])
    return
  }
  if (props.modelValue.includes(childId)) {
    if (props.modelValue.length > 1) {
      emit('update:modelValue', props.modelValue.filter((id) => id !== childId))
    }
    return
  }
  emit('update:modelValue', [...props.modelValue, childId])
}

function childActionLabel(childId: string, childName: string) {
  if (props.mode === 'switch') return `查看${childName}`
  return `${props.modelValue.includes(childId) ? '取消选择' : '选择'}${childName}`
}

async function addChild() {
  error.value = ''
  if (!canAddChild.value) {
    error.value = '最多添加 4 个孩子'
    return
  }
  if (avatarUsedByOther(newChildAvatar.value)) {
    error.value = '这个头像已经有孩子在用'
    return
  }
  try {
    const id = await store.addChild(newChildName.value, newChildAvatar.value)
    if (!id) {
      error.value = '请先填写孩子名字'
      return
    }
    names[id] = newChildName.value.trim()
    newChildName.value = ''
    newChildAvatar.value = firstFreeAvatar()
  } catch (err) {
    error.value = err instanceof Error ? err.message : '添加失败'
  }
}

async function setChildAvatar(childId: string, avatarKey: ChildAvatarKey) {
  if (avatarUsedByOther(avatarKey, childId)) {
    error.value = '这个头像已经有孩子在用'
    return
  }
  error.value = ''
  try {
    await store.updateChild({ id: childId, avatarKey })
    editingAvatarId.value = ''
  } catch (err) {
    error.value = err instanceof Error ? err.message : '更换头像失败'
  }
}

async function saveName(childId: string) {
  await store.updateChild({ id: childId, name: names[childId] ?? '' })
  const child = store.snapshot.children.find((item) => item.id === childId)
  if (child) names[childId] = child.name
}

async function removeChild(childId: string, childName: string) {
  error.value = ''
  if (!window.confirm(`确定删除“${childName}”吗？相关独享课程、账单和目标也会删除。`)) return
  try {
    await store.removeChild(childId)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '删除失败'
    return
  }
  const next = props.modelValue.filter((id) => id !== childId)
  if (!next.length && store.snapshot.children[0]) next.push(store.snapshot.children[0].id)
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="child-picker" :class="{ centered }">
    <div class="child-avatars" aria-label="孩子选择">
      <button
        v-for="child in store.snapshot.children"
        :key="child.id"
        type="button"
        class="child-avatar"
        :class="{ active: modelValue.includes(child.id) }"
        :style="{ '--avatar-color': child.avatarColor }"
        :aria-label="childActionLabel(child.id, child.name)"
        :aria-pressed="modelValue.includes(child.id)"
        @click="choose(child.id)"
      >
        <ChildAvatar :avatar-key="child.avatarKey" :size="40" />
        <span>{{ child.name }}</span>
      </button>

      <button class="manage-children" type="button" aria-label="新增或管理孩子" @click="managing = true">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M18 5v6m-3-3h6" />
        </svg>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="child-sheet">
        <div v-if="managing" class="child-overlay" @click.self="managing = false">
          <section class="child-sheet" role="dialog" aria-modal="true" aria-label="孩子资料管理">
            <i class="sheet-handle" />
            <header>
              <div><p>家庭成员</p><h2>孩子资料管理</h2></div>
              <button type="button" aria-label="关闭" @click="managing = false">×</button>
            </header>

            <div class="profile-list">
              <div v-for="child in store.snapshot.children" :key="child.id" class="profile-row">
                <button
                  v-if="editingAvatarId !== child.id"
                  type="button"
                  class="row-avatar"
                  :aria-label="`更换${child.name}的头像`"
                  @click="editingAvatarId = child.id"
                >
                  <ChildAvatar :avatar-key="child.avatarKey" :size="42" />
                </button>
                <div v-else class="avatar-choices compact" role="radiogroup" :aria-label="`为${child.name}选择头像`">
                  <button
                    v-for="option in CHILD_AVATAR_OPTIONS"
                    :key="option.key"
                    type="button"
                    role="radio"
                    :aria-checked="child.avatarKey === option.key"
                    :class="{ active: child.avatarKey === option.key, taken: avatarUsedByOther(option.key, child.id) }"
                    :aria-label="option.label"
                    :disabled="avatarUsedByOther(option.key, child.id)"
                    @click="setChildAvatar(child.id, option.key)"
                  >
                    <ChildAvatar :avatar-key="option.key" :size="36" />
                  </button>
                </div>
                <label>
                  <span>孩子名称</span>
                  <input v-model="names[child.id]" maxlength="8" @blur="saveName(child.id)" @keyup.enter="saveName(child.id)" />
                </label>
                <button type="button" class="delete-child" :aria-label="`删除${child.name}`" @click="removeChild(child.id, child.name)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" /></svg>
                </button>
              </div>
            </div>

            <div v-if="canAddChild" class="new-child">
              <p>选择头像</p>
              <div class="avatar-choices" role="radiogroup" aria-label="选择新孩子头像">
                <button
                  v-for="option in CHILD_AVATAR_OPTIONS"
                  :key="option.key"
                  type="button"
                  role="radio"
                  :aria-checked="newChildAvatar === option.key"
                  :class="{ active: newChildAvatar === option.key, taken: avatarUsedByOther(option.key) }"
                  :aria-label="option.label"
                  :disabled="avatarUsedByOther(option.key)"
                  @click="newChildAvatar = option.key"
                >
                  <ChildAvatar :avatar-key="option.key" :size="52" />
                </button>
              </div>
              <div class="new-child-row">
                <input v-model="newChildName" maxlength="8" placeholder="输入新孩子名字" @keyup.enter="addChild" />
                <button type="button" @click="addChild">添加</button>
              </div>
            </div>
            <p v-else class="child-limit">最多 4 个孩子，每个头像只能用一次</p>
            <p v-if="error" class="child-error">{{ error }}</p>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.child-picker.centered { display: flex; justify-content: center; }
.child-avatars { display: flex; align-items: flex-start; justify-content: center; gap: 8px; }
.child-avatar {
  display: grid;
  width: 48px;
  justify-items: center;
  gap: 5px;
  padding: 0;
  color: var(--muted);
  border: 0;
  background: transparent;
}
.child-avatar :deep(.child-face) {
  border: 2px solid transparent;
  filter: grayscale(.35) saturate(.7);
  transition: transform .2s ease, filter .2s ease, box-shadow .2s ease;
}
.child-avatar.active :deep(.child-face) {
  filter: none;
  border-color: color-mix(in srgb, var(--avatar-color, #5b8def) 55%, #fff);
  box-shadow: 0 7px 16px color-mix(in srgb, var(--avatar-color, #5b8def) 24%, transparent);
  transform: translateY(-2px);
}
.child-avatar.active span {
  color: var(--ink);
  font-weight: 750;
}
.child-avatar span {
  width: 100%;
  overflow: hidden;
  font-size: 9px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.manage-children {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  padding: 0;
  place-items: center;
  color: var(--accent-text);
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--line));
  border-radius: 50%;
  background: var(--accent-soft);
}
.manage-children svg { width: 22px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }

.child-overlay {
  position: fixed;
  z-index: 1100;
  inset: 0;
  display: grid;
  padding: 18px;
  align-items: end;
  background: rgba(29,33,43,.36);
  backdrop-filter: blur(5px);
}
.child-sheet {
  width: min(100%, 444px);
  margin: 0 auto;
  padding: 18px;
  color: var(--ink);
  border: 0;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--elev-lg), var(--glow-top);
}
.sheet-handle { display: block; width: 38px; height: 4px; margin: -6px auto 14px; border-radius: 99px; background: var(--line); }
.child-sheet header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.child-sheet header p { margin: 0 0 2px; color: var(--muted); font-size: 10px; }
.child-sheet header h2 { font-size: 19px; }
.child-sheet header button { width: 36px; height: 36px; color: var(--muted); border: 0; border-radius: 50%; background: var(--bg); font-size: 20px; }
.profile-list { display: grid; gap: 8px; }
.profile-row { display: grid; grid-template-columns: auto minmax(0, 1fr) 38px; gap: 10px; align-items: center; padding: 9px; border: 0; border-radius: 16px; background: var(--paper); box-shadow: var(--elev-sm), var(--glow-top); }
.row-avatar { width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; background: transparent; }
.avatar-choices {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.avatar-choices button {
  display: grid;
  width: 64px;
  height: 64px;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ink) 4%, var(--paper));
  box-shadow: inset 0 0 0 1px var(--line);
}
.avatar-choices button.active {
  background: var(--accent-soft);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 55%, #fff);
}
.avatar-choices button.taken { opacity: 0.35; }
.child-limit { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
.avatar-choices.compact {
  justify-content: flex-start;
  gap: 4px;
}
.avatar-choices.compact button {
  width: 40px;
  height: 40px;
}
.profile-row label { display: grid; gap: 2px; }
.profile-row label span { color: var(--muted); font-size: 9px; }
.profile-row input { width: 100%; padding: 3px 0; color: var(--ink); border: 0; outline: 0; background: transparent; font-weight: 700; }
.delete-child { display: grid; width: 36px; height: 36px; padding: 0; place-items: center; color: #b4485a; border: 0; border-radius: 11px; background: color-mix(in srgb, #b4485a 8%, var(--paper)); }
.delete-child svg { width: 17px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-width: 1.7; }
.new-child { display: grid; gap: 10px; margin-top: 13px; }
.new-child > p { margin: 0; color: var(--muted); font-size: 10px; }
.new-child-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; }
.new-child-row input { min-width: 0; padding: 11px 13px; color: var(--ink); border: 0; border-radius: 13px; background: var(--paper); box-shadow: inset 0 0 0 1px var(--line); }
.new-child-row button { padding: 0 16px; color: #fff; border: 0; border-radius: 13px; background: var(--accent-gradient); box-shadow: 0 12px 22px -10px rgba(255,122,69,.75); font-weight: 700; }
.child-error { margin: 9px 2px 0; color: #b4485a; font-size: 11px; }
.child-sheet-enter-active, .child-sheet-leave-active { transition: opacity .2s ease; }
.child-sheet-enter-from, .child-sheet-leave-to { opacity: 0; }
</style>
