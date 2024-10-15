import fs from 'fs'
import path from 'path'
import { expandPath } from '@offline-ai/cli-common'
import { loadUrl } from './load-url.js'
export async function loadFile(filepath, onlyContent) {
  filepath = filepath ? filepath : this.content || this[0]
  if (!filepath) {throw new Error('No file path provided.')}
  onlyContent = typeof onlyContent === 'boolean' ? onlyContent : this.onlyContent

  let content
  if (filepath.startsWith('https://') || filepath.startsWith('http://')) {
    content = await loadUrl.call(this, filepath, true)
    if (!onlyContent) {
      content = `url: ${filepath}\nfile content:\n${content}`
    }
  } else {
    const filename = path.basename(filepath);
    filepath = expandPath(filepath)
    content = fs.readFileSync(filepath, 'utf8');
    if (!onlyContent) {
      content = `filename: ${filename}\nfile content:\n${content}`
    }
  }
  return content
}
