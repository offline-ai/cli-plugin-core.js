import cj from 'color-json'
import {Args, Flags} from '@oclif/core'
import { expandPath, parseJsJson } from '@isdk/ai-tool'
// @ts-ignore
import { LogLevelMap, getMeta, logLevel } from '@isdk/ai-tool-agent'
import { AICommand, AICommonFlags, colors, showBanner } from '@offline-ai/cli-common'

import {runScript} from '../../../lib/run-script.js'


async function parseJsonInput(input: string) {
  try {
    return await parseJsJson(input)
  } catch(e) {
    return input
  }
}

// @ts-ignore
export default class RunScript extends AICommand {
  static args = {
    file: Args.string({
      description: 'the script file path, or the json data when `-f` switch is set',
    }),
    data: Args.string({
      description: 'the json data which will be passed to the ai-agent script',
    }),
  }

  static summary = '💻 Run ai-agent script file.'

  static description = 'Execute ai-agent script file and return result. with `-i` to interactive.'

  static examples = [
    `<%= config.bin %> <%= command.id %> -f ./script.yaml "{content: 'hello world'}" -l info
┌────────────────────
│[info]:Start Script: ...
`,
  ]

  static flags = {
    ...AICommand.flags,
    ...AICommonFlags,
    'consoleClear': Flags.boolean({
      aliases: ['console-clear', 'ConsoleClear', 'Console-clear', 'Console-Clear'],
      description: 'Whether console clear after stream echo output, default to true',
      allowNo: true,
    }),
  }

  async run(): Promise<any> {
    const opts = await this.parse(RunScript as any)
    const {flags, args} = opts
    // console.log('🚀 ~ RunScript ~ run ~ flags:', flags)
    const isJson = this.jsonEnabled()

    if (!flags.script) {
      flags.script = args.file
    } else {
      args.data = args.file
    }

    args.data = await parseJsonInput(args.data)
    const userConfig = await this.loadConfig(flags.config, {...opts, skipLoadHook: true})
    logLevel.json = isJson
    const hasBanner = userConfig.banner ?? userConfig.interactive
    let script = userConfig.script
    if (!script) {
      this.error('missing script to run! require argument: `-f <script_file_name>`')
    }

    script = expandPath(script, userConfig)

    if (hasBanner) {showBanner()}

    if (!userConfig.logLevel) {
      userConfig.logLevel = userConfig.interactive ? 'error' : 'warn'
    }
    userConfig.ThisCmd = this
    const logLevelId = LogLevelMap[userConfig.logLevel]

    try {
      await this.config.runHook('config:load', {id: 'run', userConfig})
      let result = await runScript(script, userConfig)
      if (result?._ctxThink) {
        this.log(colors.gray('[Thinking]:\n' + result._ctxThink + '\n'))
      }
      if (logLevelId >= LogLevelMap.verbose && result?.content) {
        result = result.content
      }
      if (!userConfig.interactive && result != null) {
        this.log(typeof result === 'string' || result instanceof String ? '' + result : cj(result))
      }
      if (logLevelId <= LogLevelMap.notice) {
        // only for trace/debug/verbose/info/notice
        const metaUsage = getMeta(result)?.ai?.parameters.usage
        if (metaUsage) {
          if (metaUsage.loadModelTime) {
            const t = metaUsage.loadModelTime / 1000
            this.log(colors.gray('Load Model Time: ' + t.toFixed(2) + 's'))
          }
          let tokens = metaUsage.prompt
          if (tokens?.duration) {
            const n = tokens.tokens / (tokens.duration / 1000)
            this.log(colors.gray('Prompt eval: ' + n.toFixed(2) + ' tokens/s, Total: ' + tokens.tokens))
          }
          tokens = metaUsage.generation
          if (tokens?.duration) {
            const n = tokens.tokens / (tokens.duration / 1000)
            this.log(colors.gray('Generation eval: ' + n.toFixed(2) + ' tokens/s, Total: ' + tokens.tokens))
          }
          if (metaUsage.graphsReused) {
            this.log(colors.gray('Graphs Reused: ' + metaUsage.graphsReused))
          }
        }
      }
      return result
    } catch (error: any) {
      if (error) {
        console.log('🚀 ~ RunScript ~ run ~ error:', error)
        this.error(error.message)
      }
    }
  }
}
