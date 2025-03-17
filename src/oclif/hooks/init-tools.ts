import type { Hook, Config } from '@oclif/core'

import { initTools as _initTools } from '../../lib/init-tools.js'

let initialized: boolean
export async function init_tools(this: Hook.Context, options: {userConfig: any, config: Config}) {
  console.log('🚀 ~ file: init-tools.ts:7 ~ options:', options)
  if (initialized) return
  initialized = true

  await _initTools.call(this, options.userConfig, options.config)
  await this.config.runHook('register', {...options})
}

export default init_tools
