import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const outputDirectory = join(process.cwd(), 'release', 'app', 'dist')

function removeSourceMaps(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)

    if (entry.isDirectory()) {
      removeSourceMaps(path)
    } else if (entry.name.endsWith('.map')) {
      rmSync(path)
    }
  }
}

removeSourceMaps(outputDirectory)
