import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(process.argv[2] || 'dist/build/mp-weixin')
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === 'cloudfunctions' || name === 'node_modules') continue
    if (statSync(full).isDirectory()) walk(full)
    else if (name.endsWith('.js')) files.push(full)
  }
}
walk(root)

const graph = new Map()
for (const file of files) {
  const code = readFileSync(file, 'utf8')
  const deps = [...code.matchAll(/require\("(\.[^"]+)"\)/g)].map((m) => resolve(dirname(file), m[1]))
  graph.set(file, deps)
}

const seen = new Set()
const stack = []
const onStack = new Set()
const cycles = []
function dfs(node) {
  seen.add(node)
  stack.push(node)
  onStack.add(node)
  for (const dep of graph.get(node) || []) {
    if (onStack.has(dep)) {
      cycles.push(stack.slice(stack.indexOf(dep)).concat(dep).map((f) => relative(root, f)).join(' -> '))
    } else if (!seen.has(dep)) dfs(dep)
  }
  stack.pop()
  onStack.delete(node)
}
for (const file of files) if (!seen.has(file)) dfs(file)
console.log(cycles.length ? cycles.join('\n') : 'no cycles')
