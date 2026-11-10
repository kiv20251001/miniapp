const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const domainDir = path.join(root, 'server/src/domain')

for (const file of fs.readdirSync(domainDir)) {
  if (!file.endsWith('.ts')) continue
  const filePath = path.join(domainDir, file)
  let source = fs.readFileSync(filePath, 'utf8')
  source = source
    .replace(/from '@\/domain\/types'/g, "from './types'")
    .replace(/from '@\/domain\/constants'/g, "from './constants'")
    .replace(/from '@\/services\/schedule'/g, "from './schedule'")
    .replace(/from '@\/services\/packages'/g, "from './packages'")
    .replace(/from '@\/services\/courseSchedule'/g, "from './courseSchedule'")
    .replace(/from '@\/services\/charges'/g, "from './charges'")
    .replace(/from '@\/services\/billing'/g, "from './billing'")
    .replace(/from '@\/services\/forecast'/g, "from './forecast'")
  fs.writeFileSync(filePath, source)
}

let store = fs.readFileSync(path.join(root, 'apps/web/src/stores/app.ts'), 'utf8').replace(/\r\n/g, '\n')
store = store
  .replace(
    `import { defineStore } from 'pinia'\nimport { computed, ref } from 'vue'\nimport type {\n`,
    `import type {\n  AppSnapshot,\n`,
  )
  .replace("from '@/domain/types'", "from '../domain/types'")
  .replace("from '@/domain/constants'", "from '../domain/constants'")
  .replace("import { loadSnapshot, resetSnapshot, saveSnapshot } from '@/data/storage'\n", '')
  .replace("from '@/services/billing'", "from '../domain/billing'")
  .replace("from '@/services/schedule'", "from '../domain/schedule'")
  .replace("from '@/services/courseSchedule'", "from '../domain/courseSchedule'")
  .replace("from '@/services/charges'", "from '../domain/charges'")
  .replace(
    `import dayjs from 'dayjs'\n\nexport const useAppStore = defineStore('app', () => {\n  const snapshot = ref(loadSnapshot())\n\n  const persist = () => saveSnapshot(snapshot.value)\n`,
    `import dayjs from 'dayjs'\n\nfunction computed<T>(fn: () => T) {\n  return { get value() { return fn() } }\n}\n\nexport function createFamilyWorkspace(initial: AppSnapshot) {\n  const snapshot = { value: initial }\n\n  const persist = () => {}\n`,
  )
  .replace(
    `\n  function restoreDemo() {\n    snapshot.value = resetSnapshot()\n  }\n\n  return {`,
    `\n  return {`,
  )
  .replace(
    `    addGoalProgress,\n    restoreDemo,\n  }\n})\n`,
    `    addGoalProgress,\n  }\n}\n`,
  )

const out = path.join(root, 'server/src/workspace/family-workspace.ts')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, store)
console.log('synced domain imports and family-workspace.ts')
