<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError, register, setSession } from '@/services/api'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const name = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  const account = username.value.trim()
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(account)) {
    error.value = '账号需 3-32 位，只能用字母、数字或下划线'
    return
  }
  if (password.value.length < 6) {
    error.value = '密码至少 6 位'
    return
  }
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  submitting.value = true
  try {
    const session = await register({
      username: account,
      password: password.value,
      name: name.value.trim() || undefined,
    })
    setSession(session)
    await store.hydrate()
    await router.replace('/')
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '注册失败，请确认后端已启动'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page auth-page">
    <section class="auth-hero">
      <p class="eyebrow">Uday家庭课表计划</p>
      <h1>注册家庭账号</h1>
      <p class="muted">第一期用账号和密码创建家庭。注册后会自动生成一个孩子档案，可再改名。</p>
    </section>

    <form class="card auth-card" @submit.prevent="submit">
      <label class="field">
        <span>账号</span>
        <input v-model="username" autocomplete="username" maxlength="32" placeholder="例如 parent_01" />
      </label>
      <label class="field">
        <span>显示名（可选）</span>
        <input v-model="name" autocomplete="nickname" maxlength="32" placeholder="家长怎么称呼" />
      </label>
      <label class="field">
        <span>密码</span>
        <input v-model="password" type="password" autocomplete="new-password" placeholder="至少 6 位" />
      </label>
      <label class="field">
        <span>确认密码</span>
        <input v-model="confirmPassword" type="password" autocomplete="new-password" placeholder="再输入一次" />
      </label>
      <p v-if="error" class="auth-error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="submitting">
        {{ submitting ? '创建中…' : '注册并进入' }}
      </button>
    </form>

    <p class="auth-switch muted">
      已有账号？
      <router-link to="/login">去登录</router-link>
    </p>
  </main>
</template>

<style scoped>
.auth-page {
  padding-bottom: 48px;
}

.auth-hero {
  margin: 28px 0 20px;
}

.auth-card {
  padding: 20px 18px;
}

.auth-error {
  margin: 0 0 12px;
  color: var(--unpaid);
  font-size: 13px;
}

.auth-switch {
  margin-top: 18px;
  text-align: center;
}

.auth-switch a {
  color: var(--accent-text);
  text-decoration: none;
  font-weight: 600;
}
</style>
