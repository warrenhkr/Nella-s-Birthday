import { loadPyodide } from 'pyodide'

let pyodidePromise = null
let packageLoadPromise = Promise.resolve()
const loadedPackages = new Set()

async function ensurePyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/'
    }).then((runtime) => {
      self.postMessage({ type: 'ready' })
      return runtime
    }).catch((error) => {
      pyodidePromise = null
      throw error
    })
  }

  return pyodidePromise
}

function ensurePackages(runtime, code) {
  const neededPackages = []
  if (/^\s*(?:import\s+numpy\b|from\s+numpy\b)/m.test(code)) neededPackages.push('numpy')
  if (/^\s*from\s+PIL\b/m.test(code)) neededPackages.push('pillow')
  if (neededPackages.length === 0) return Promise.resolve()

  const load = packageLoadPromise.then(async () => {
    const missingPackages = neededPackages.filter(name => !loadedPackages.has(name))
    if (missingPackages.length === 0) return

    await runtime.loadPackage(missingPackages)
    missingPackages.forEach(name => loadedPackages.add(name))
  })
  packageLoadPromise = load.catch(() => {})
  return load
}

self.onmessage = async (event) => {
  const { type, code, params, renderType, requestId } = event.data || {}
  if (type !== 'run') return

  try {
    const runtime = await ensurePyodide()
    await ensurePackages(runtime, code || '')
    runtime.globals.set('params_json', JSON.stringify(params || {}))
    runtime.globals.set('renderType', renderType || 'points')

    runtime.runPython(`
import json
${code || ''}

if 'run' not in globals():
    raise NameError('No run(params) function found in the Python source.')

params = json.loads(params_json)
result = run(params)
if not isinstance(result, dict):
    result = {'type': 'points', 'points': []}
`)

    const raw = runtime.globals.get('result')
    const payload = raw && typeof raw.toJs === 'function'
      ? raw.toJs({ dict_converter: Object.fromEntries })
      : raw
    if (raw && typeof raw.destroy === 'function') raw.destroy()

    self.postMessage({ type: 'result', requestId, payload: payload ?? { type: 'points', points: [] } })
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
