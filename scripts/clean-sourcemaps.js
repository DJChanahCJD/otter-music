import fs from 'node:fs/promises'
import path from 'node:path'

const targetDir = process.argv[2] ?? 'dist'

async function removeMapsInDir(dir) {
  let removed = 0

  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return 0
    }
    throw err
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      removed += await removeMapsInDir(fullPath)
      continue
    }
    if (entry.isFile() && entry.name.endsWith('.map')) {
      await fs.rm(fullPath, { force: true })
      removed += 1
    }
  }

  return removed
}

const removedCount = await removeMapsInDir(path.resolve(targetDir))
process.stdout.write(`Removed ${removedCount} sourcemap files from ${targetDir}\n`)
