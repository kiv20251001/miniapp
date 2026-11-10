<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ApiError, login, setSession } from '@/services/api'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  const account = username.value.trim()
  if (account.length < 3) {
    error.value = '请输入账号'
    return
  }
  if (password.value.length < 6) {
    error.value = '请输入密码'
    return
  }
  submitting.value = true
  try {
    const session = await login({ username: account, password: password.value })
    setSession(session)
    await store.hydrate()
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : '登录失败，请确认后端已启动'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="page auth-page">
    <section class="auth-hero">
      <p class="eyebrow">Uday家庭课表计划</p>
      <h1>登录家庭账本</h1>
      <p class="muted">用账号和密码进入已有家庭，课表和账单会从服务器同步。</p>
    </section>

    <form class="card auth-card" @submit.prevent="submit">
      <label class="field">
        <span>账号</span>
        <input v-model="username" autocomplete="username" maxlength="32" placeholder="字母、数字或下划线" />
      </label>
      <label class="field">
        <span>密码</span>
        <input v-model="password" type="password" autocomplete="current-password" placeholder="至少 6 位" />
      </label>
      <p v-if="error" class="auth-error">{{ error }}</p>
      <button class="btn block" type="submit" :disabled="submitting">
        {{ submitting ? '登录中…' : '登录' }}
      </button>
    </form>

    <p class="auth-switch muted">
      还没有账号？
      <router-link to="/register">注册一个家庭</router-link>
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
