import { fileURLToPath } from 'url';
import enquier from 'enquirer'
import { ux } from '@oclif/core'
import util from 'util'
import fs from 'fs'
import path from 'path'
import colors from 'ansicolor'
// import cliSpinners from 'cli-spinners'
import _logUpdate from 'log-update'
import { get as getByPath, omitBy } from 'lodash-es'
import {
  ConfigFile,
  countRegexMatches,
  expandConfig, expandPath,
  event,
  formatISO,
  formatTextWithSpace,
  getMultiLevelExtname,
  getPackageDir,
  hasDirectoryIn,
  parseJsJson,
  readFilenamesRecursiveSync,
  toDateTime,
  wait,
  beforeShutdown, shutdown,
  EventEmitter,
} from '@isdk/ai-tool'
import { llm } from '@isdk/ai-tool-llm'
import { LocalProviderName, LocalProviderProgressEventName } from '@isdk/ai-tool-llm-local'
// @ts-ignore
import { AIScriptServer, LogLevel, LogLevelMap } from '@isdk/ai-tool-agent'
import { detectTextLanguage as detectLang, detectTextLangEx, getLanguageFromIso6391 } from '@isdk/detect-text-language'
import { prompt, setHistoryStore, HistoryStore } from './prompt.js'

import '@isdk/ai-pack-core'
import '@isdk/ai-pack-pro'
// import { initTools } from './init-tools.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// @ts-ignore
const scriptRootDir = path.join(getPackageDir(__dirname), 'lib')

// const endWithSpacesRegEx = /[\s\n\r]+$/
// const startWithSpacesRegEx = /^[\s\n\r]+/
const YouCharName = 'You:'

const consoleInput = enquier.prompt


export declare namespace AIScriptEx {
  let searchPaths: string[]
  function loadFile(...args: any[]): any
  function getMatchedScriptInfos(...args: any[]): any
}
export interface AIScriptEx extends EventEmitter {
  [name: string]: any
}

export class AIScriptEx extends AIScriptServer {
  $detectLang(text: string) {
    return detectLang(text)
  }

  $translate(params: any) {
    return this.$exec({id: 'translator', args: { max_tokens: 2048, ...params }})
  }

  $getLanguageFromIso6391(iso6391: string|{iso6391: string}) {
    if (iso6391 && typeof iso6391 === 'object') {
      iso6391 = iso6391.iso6391
    }
    if (iso6391?.length > 2) {iso6391 = iso6391.slice(0, 2)}
    return getLanguageFromIso6391(iso6391)
  }

  $isDir(dir: string|{content: string}) {
    if (dir && typeof dir === 'object') {
      dir = dir.content
    }
    const stat = fs.statSync(dir, { throwIfNoEntry: false })
    return stat?.isDirectory()
  }

  $listFilenames(params: {dir: string|string[], recursive?: boolean, extname?: string[]|string, aborter?: AbortController, level?: number}) {
    const options: any = {}
    if (params) {
      if (params.extname) {
        const extname = Array.isArray(params.extname) ? params.extname : [params.extname]
        options.isFileMatched = function(filepath: string) {
          return extname.includes(getMultiLevelExtname(filepath, 2))
        }
      }
      if (params.recursive === false) {
        options.level = 1
      } else if (typeof params.level === 'number') {
        options.level = params.level
      }
      if (params.aborter instanceof AbortController) {
        options.signal = params.aborter.signal
      }
    }
    const dir = params.dir
    let result = readFilenamesRecursiveSync(dir, options)
    const parentDir = params.dir as string
    if (typeof parentDir === 'string') {
      result = result.map(filepath => path.relative(path.resolve(parentDir), path.resolve(filepath)))
    }
    return result
  }

  async $consoleInput(params: any) {
    const defaults = this.getJSON(true)
    params = {...defaults, ...params}
    params.type = params.inputType || 'input'
    delete params.inputType
    params.message = params.content
    delete params.content
    params.initial = params.value
    delete params.value
    params.name = 'answer'
    delete params.input
    delete params.output
    return await consoleInput(params)
  }
}

interface IRunScriptOptions {
  chatsDir?: string,
  inputsDir?: string,
  stream?: boolean,
  interactive?: boolean,
  logLevel?: LogLevel,
  data?: any,
  apiUrl?: string,
  newChat?: boolean,
  backupChat?: boolean,
  agentDirs?: string[],
  theme?: any,
  consoleClear?: boolean,
  userPreferredLanguage?: string
  aiPreferredLanguage?: string
  ThisCmd?: any
  streamEcho?: boolean|string
  streamEchoChars?: number
  logUpdate?: (...text: string[]) => void
  runtime?: AIScriptEx
  brainDir: string
}

function logUpdate(...text: string[]) {
  logUpdate.dirt = true
  _logUpdate(...text)
}

logUpdate.dirt = false
logUpdate.clear = (consoleClear: boolean|undefined) => {
  if (logUpdate.dirt) {
    logUpdate.dirt = false
    if (consoleClear) {
      _logUpdate.clear()
    } else {
      console.log(`\n${colors.magenta('<---STREAMING END--->')}\n\n`)
    }
  }
}

function findCreatedAt(messages: any[]) {
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i]
      if (message.createdAt) {
        return message.createdAt
      }
    }
  }
}
function renameOldFile(filename: string, backupChat?: boolean) {
  if (fs.existsSync(filename)) {
    const content = ConfigFile.loadSync(filename)
    let createdAtStr = findCreatedAt(content)
    const createdAt = createdAtStr ? toDateTime(createdAtStr) as Date : new Date()
    const dirname = path.dirname(filename)
    const extName = path.extname(filename)
    const basename = path.basename(filename, extName)
    // rename to history-2023-01-01T00_00_00_000Z.yaml
    createdAtStr = formatISO(createdAt).replace(/[:.]/g, '_')
    const newFileName = path.join(dirname, `${basename}-${createdAtStr}${extName}`)
    if (backupChat) {
      fs.cpSync(filename, newFileName)
    } else {
      fs.renameSync(filename, newFileName)
    }
  }
}

let hasInited = false
export async function runScript(filename: string, options: IRunScriptOptions) {
  // initTools(options)

  const { logLevel: level, interactive, stream, userPreferredLanguage, aiPreferredLanguage } = options

  if (options.consoleClear === undefined) {
    // options.consoleClear = interactive
    options.consoleClear = true
  }

  const scriptExtName = getMultiLevelExtname(filename, 2)
  const scriptBasename = path.basename(filename, scriptExtName)
/*
  if (!AIScriptEx.searchPaths) {
    AIScriptEx.searchPaths = [scriptRootDir]
  } else if (!hasDirectoryIn(scriptRootDir, AIScriptEx.searchPaths)) {
    AIScriptEx.searchPaths.push(scriptRootDir)
  }
*/
  if (Array.isArray(options.agentDirs) && options.agentDirs.length) {
    const agentDirs = options.agentDirs = expandConfig(options.agentDirs, options) as any[]
    for (const agentDir of agentDirs) {
      if (agentDir && !hasDirectoryIn(agentDir, AIScriptEx.searchPaths)) {
        AIScriptEx.searchPaths.push(agentDir)
      }
    }
  }

  let script
  const aborter = new AbortController()
  if (!hasInited) {
    beforeShutdown(() => {
      // console.log('🚀 ~ process.once ~ SIGINT!')
      aborter.abort()
    })
    // process.once('SIGINT', () => {
    //   console.log('🚀 ~ process.once ~ SIGINT!')
    //   aborter.abort()
    // })

    // process.once('exit', function () {
    //   aborter.abort()
    // })
  }
  const mLogUpdate = options.logUpdate ?? logUpdate

  try {
    const eventBus = event.runSync();
    eventBus.on(LocalProviderProgressEventName, (progress: number, {filepath, type}: {filepath: string, type: string}) => {
      mLogUpdate(`Loading ${type} ${path.basename(filepath)} ${(progress*100).toFixed(2)}%`)
      // if (progress === 1) logUpdate.clear(true)
      // if (progress === 1) console.log(`Loading ${type} ${path.basename(filepath)} done!`)
    })

    const USER_ENV = omitBy(options, (v, k) => {
      const vT = typeof v
      return k?.[0] === '_' || v == null || vT === 'function' || (vT === 'object' && !Array.isArray(v)) || vT === 'symbol'
    })

    script = await AIScriptEx.loadFile(filename,
      {
        chatsDir: options.chatsDir,
        shouldLoadChats: !options.newChat,
      },
      {
        ABORT_SEARCH_SCRIPTS_SIGNAL: aborter.signal,
        USER_ENV,
        FUNC_SCOPE: {
          expandPath: function(path: string) {
            // for formatting
            if (path && typeof path === 'object') {return (p: string)=>expandPath(p, options)}
            return expandPath(path, options)
          },
        }
      },
    )
  } catch(err) {
    console.error('Load script error:',err)
    await shutdown('loadScriptError', 1)
  }

  const chatsFilename = script.getChatsFilename()

  let isSilence = false

  if (level !== undefined) {
    script.logLevel = level
    if (LogLevelMap[level] >= LogLevelMap['silence']) {
      isSilence = true
    }
  }
  if (stream !== undefined) {
    script.llmStream = stream
  }
  if (interactive && script.autoRunLLMIfPromptAvailable === undefined) {
    script.autoRunLLMIfPromptAvailable = false
  }

  let quit = false
  const runtime = options.runtime = await script.getRuntime(false) as AIScriptEx
  const currentProvider = llm.getCurrentProvider()
  if (currentProvider?.name === LocalProviderName && !currentProvider.defaultModelName && !runtime.parameters?.model) {
    const default_model_filepath = path.join(options.brainDir, 'DEFAULT_MODEL_NAME.txt');
    let defaultModelName: string | undefined
    if (fs.existsSync(default_model_filepath)) {
      defaultModelName = fs.readFileSync(default_model_filepath, 'utf8')
      if (defaultModelName) {
        if (!defaultModelName.endsWith('.gguf')) {
          defaultModelName += '.gguf'
        }
        const filepath = path.isAbsolute(defaultModelName) ? defaultModelName : path.join(options.brainDir, defaultModelName)
        if (!fs.existsSync(filepath)) {
          console.log('⚠️  The default model file does not exist:', defaultModelName)
          defaultModelName = undefined
        }
      }
    }
    if (!defaultModelName) {
      const models = readFilenamesRecursiveSync(options.brainDir, {isFileMatched: (filename)=> filename.endsWith('.gguf'), level: 1, resolveSymlinks: false})
        .map((filename)=>path.relative(options.brainDir, filename));
      if (models.length) {
        const {modelName} = await consoleInput<{modelName: string}>({
          type: 'autocomplete',
          name: 'modelName',
          message: 'Please Choose a model as default model for the local LLM provider.',
          choices: models,
        })
        if (modelName) {
          defaultModelName = modelName
          fs.writeFileSync(default_model_filepath, defaultModelName, 'utf8')
          console.log('✍️  Write the default model name into file:', default_model_filepath)
        }
      } else {
        const {modelName} = await consoleInput<{modelName: string}>({
          type: 'input',
          name: 'modelName',
          message: 'No model found in the brain directory. You need to donwload a model first.\nPlease input the huggingface 🧠 model name(Author/Repo) or url to download GGUF model:',
          initial: 'Qwen/Qwen2.5-3B-Instruct-GGUF'
        })
        let hfUrl: string | undefined
        if (!modelName.includes('://')) {
          const {url} = await consoleInput<{url: string}>({
            type: 'input',
            name: 'url',
            message: 'The huggingface mirror url to speed up downloading(Optional):',
            validate: (input) => {
              if (input && !/^https?:\/\//.test(input)) return 'Please starts with http:// or https://'
              return true
            },
           })
           if (url) hfUrl = url.trim()
        }
        const args = [modelName]
        if (hfUrl) {
          args.push('-u ' + hfUrl)
        }
        const dnResult = await options.ThisCmd.config.runCommand('brain:download', args)
        if (Array.isArray(dnResult) && dnResult.length) {
          defaultModelName = dnResult[0].filepath
        }
      }
    }
    if (defaultModelName) {
      currentProvider.defaultModelName = defaultModelName
    }
  }

  runtime.on('error', async (error: any) => {
    if (error.name !== 'AbortError') {
      console.error(error)
      const cause = error.cause
      if (cause?.code === 'ECONNREFUSED' && options.apiUrl) {
        const url = new URL(options.apiUrl)
        if (url.port == cause.port) {
          console.error(`Are you sure the brain(LLM) server is running on ${options.apiUrl}?`)
        }
      }
      await shutdown('ECONNREFUSED', 1)
    }
  })

  const saveChatHistory = async () => {
    if (chatsFilename) {
      if ((options.newChat || options.backupChat) && chatsFilename) {
        renameOldFile(chatsFilename, options.backupChat)
      }

      await runtime.$saveChats(chatsFilename)
    }
  }

  const interrupted = () => {
    quit = true
    if (!runtime.isToolAborted()) {
      runtime.abortTool()
    }
    // await wait(100)
    // console.log('quit for interrupted.')
    // process.exit(0)
  }

  if (!hasInited) {
    beforeShutdown(interrupted)
    // process.once('SIGINT', interrupted)
    beforeShutdown(saveChatHistory)
    // process.once('beforeExit', async() => {
    //   console.log('🚀 ~ beforeExit ~ chatsFilename:', chatsFilename)
    //   await saveChatHistory()
    //   console.log('🚀 ~ beforeExit ~ done')
    // })
  }

  let llmLastContent = ''
  let retryCount = 0

  if (stream) {
    runtime.on('llmStream', async function(llmResult, content: string, count: number, id?: string) {
      const runtime = this.target as AIScriptEx
      let s = llmResult.content

      if (quit) {
        runtime.abortTool('quit')
        await shutdown()
      }

      if (options.streamEcho === false) {return}

      if (count !== retryCount) {
        retryCount = count
        s += colors.blue(`<续:${count}>`)
      }
      llmLastContent += s

      if (options.streamEchoChars && llmLastContent.length > options.streamEchoChars) {
        llmLastContent = ''
      }

      if (options.consoleClear && options.streamEcho === 'line' && countRegexMatches(llmLastContent, /[\n\r]/) >= 1) {
        // logUpdate.clear(options.consoleClear)
        llmLastContent = ''
      }
      // if (llmLastContent.length > 100) {
      //   llmLastContent = llmLastContent.slice(llmLastContent.length-100)
      // }
      if (llmResult.stop) {
        llmLastContent = ''
        mLogUpdate(llmLastContent)
      }

      if (!isSilence) {
        if (options.consoleClear) {
          if (!id && runtime.id) {id = runtime.id}
          if (llmLastContent) mLogUpdate((id ? '['+formatTextWithSpace(id)+']: ' : '') + llmLastContent.trim())
        } else {
          process.stdout.write(s)
          logUpdate.dirt = true
        }
      }
    })
  }

  hasInited = true

  let lastError: any
  try {
    if (aiPreferredLanguage && options.data) {
      const _data = options.data
      const translated = await translate(_data, aiPreferredLanguage, userPreferredLanguage, runtime)
      if (translated) {
        if (_data.content) {
          _data.content = translated.translated
        } else {
          options.data = translated.translated
        }
        if (!isSilence) {
          logUpdate.clear(options.consoleClear)
          options.ThisCmd.log(translated.target +'Input:'+ translated.translated)
        }
      }
    }
    await runtime.run(options.data)
  } catch(error: any) {
    if (error.name !== 'AbortError') {throw error}
    lastError = error.name + (error.data?.what ? ':'+error.data.what : '')
} finally {
    if (!isSilence) {logUpdate.clear(options.consoleClear)}
    if (lastError) {
      console.log(colors.lightMagenta(`<${lastError}>`))
      lastError = undefined
    }
  }

  let result = runtime.LatestResult

  if (interactive) {
    runtime.$ready(true)

    // const spinner = cliSpinners.dots
    const aiName = runtime.character?.name || runtime.name || 'ai'
    await runtime.printLatestMessages()

    const inputsHistoryFilename = options.inputsDir ? path.join(options.inputsDir, scriptBasename, 'history.yaml') : undefined
    const store = new HistoryStore(inputsHistoryFilename)
    setHistoryStore(store)

    do {
      // llmContentChunk = ''
      llmLastContent = ''
      retryCount = 0
      result = ''
      const input = prompt({prefix: YouCharName})
      const message = (await input.run()).trim()
      const llmOptions = {} as any
      if (message) {
        if (message[0] === '/') {
          const command = message.slice(1)
          switch (command) {
            case 'quit':
            case 'exit': {
              quit = true
              break
            }
            default: {
              if (command[0] === '.') {
                const r = getByPath(runtime, command.slice(1))
                console.log(command, '=', util.inspect(r, {showHidden: false, depth: 9, colors: true}))
              } else {
                const {command: cmd, args} = await parseCommandString(command)
                try {
                  const r = await runtime[cmd](args)
                  if (r) {console.log(r)}
                } catch(e: any) {
                  console.error('command error:', e)
                }
              }
            }
          }
          continue;
        }

        llmOptions.message = message
        delete llmOptions.shouldAppendResponse
        delete llmOptions.add_generation_prompt
      } else {
        llmOptions.shouldAppendResponse = false
        llmOptions.add_generation_prompt = false
        input.clear()
      }
      quit = message === 'quit' || message === 'exit'
      // console.log()

      if (!quit) {
        // if (message) {input.write(colors.yellow(aiName+ ': '))}
        const text = message.trim()
        if (aiPreferredLanguage && text) {
          const translated = await translate(text, aiPreferredLanguage, userPreferredLanguage, runtime)
          if (translated) {
            llmOptions.message = translated.translated
            if (!isSilence) {logUpdate.clear(options.consoleClear)}
            input.write(YouCharName + translated.target + translated.translated + '\n')
          }
        }

        try {
          result = await runtime.$interact(llmOptions)
        } catch(error: any) {
          if (error.name !== 'AbortError') {throw error}
          lastError = error.name + (error.data?.what ? ':'+error.data.what : '')
        } finally {
          if (!isSilence) {logUpdate.clear(options.consoleClear)}
          if (lastError) {
            input.write(colors.lightMagenta(`<${lastError}>\n`))
            lastError = undefined
          }
        }
        if (result) {
          const isString = result instanceof String || typeof result === 'string'
          if (!isString) {
            result = ux.colorizeJson(result, {pretty: true, theme: options.theme?.json})
          }
          let str = colors.yellow(aiName+ ': ') + result.trimEnd() + '\n'
          if (isString) {
            if (userPreferredLanguage && result) {
              const translated = await trans(result, userPreferredLanguage, userPreferredLanguage, runtime)
              if (translated) {
                str += colors.yellow(aiName+ ':') + (translated + '\n')
              }
            }
          }
          input.write(str)
        }
      } else {
        console.log('bye!')
      }

    } while (!quit)
  } else {
    if (userPreferredLanguage && result) {
      let text = result
      if (typeof text !== 'string' && text.content) {
        text = text.content
      }
      if (typeof text === 'string') {
        text = text.trim()
        if (text) {
          result = text
          const translated = await trans(text, userPreferredLanguage, userPreferredLanguage, runtime)
          if (translated) {
            result += '\n' + translated
          }
        }
      }
    }
  }
  return result
}

export async function translate(content: string|Record<string, any>, preferredLanguage: string, userPreferredLanguage: string|undefined, runtime: AIScriptEx) {
  if (content && typeof content !== 'string') {
    content = content.content as string
  }
  const cache = translate.cache

  if (preferredLanguage && typeof content === 'string') {
    let target = getLanguageFromIso6391(preferredLanguage)
    if (target) {
      const text = content.slice(0, 140)
      const langInfo = detectTextLangEx(text)
      if (langInfo && langInfo.iso6391 !== preferredLanguage) {
        let translated = await runtime.$exec({id: 'translator', args: {lang: langInfo.name, content, target, max_tokens: 2048 }})
        if (translated && typeof translated === 'string') {
          translated = translated.trim()
          if (translated) {
            if (userPreferredLanguage && userPreferredLanguage !== 'en') {
              userPreferredLanguage = getLanguageFromIso6391(userPreferredLanguage)!
              if (userPreferredLanguage) {
                if (!cache[target]) {
                  let _transTarget = await runtime.$exec({id: 'translator', args: {lang: 'English', content: target + ' translated automatically', target: userPreferredLanguage, max_tokens: 2048}})
                  if (_transTarget && typeof _transTarget === 'string') {
                    _transTarget = _transTarget.trim()
                    cache[target] = _transTarget
                    target = _transTarget
                  }
                } else {
                  target = cache[target]
                }
              }
            } else {
              target += ' translated automatically'
            }
            target = '【' + target + '】'
            return {translated, target}
          }
        }
      }
    }
  }
}
translate.cache = {} as any

async function trans(content: string|Record<string, any>, preferredLanguage: string, userPreferredLanguage: string, runtime: AIScriptEx) {
  const translated = await translate(content, preferredLanguage, userPreferredLanguage, runtime)
  if (translated) {
    return formatTranslated(translated.translated, translated.target)
  }
}

function formatTranslated(translated: string, target: string, sep: string = '\n━━━━━━━━━━━━━\n') {
  // return sep + target +':: ' + translated + '\n'
  return target + translated + '\n'
}

export function getFrame(arr, i) {
  return arr[i % arr.length]
};

export const keypressTimeout = 5
export async function typeToPrompt(prompt: any, input: string) {
  for (const char of input) {
    await prompt.keypress(char)
    await wait(keypressTimeout+ 10)
  }
}

export async function parseCommandString(commandString: string): Promise<{ command: string, args: string[] }> {
  const regex = /^([\w$]+)(?:\((.*)\))?$/i;
  const match = commandString.match(regex);

  if (!match) {
    throw new Error('Invalid command format');
  }

  const command = match[1]
  const argsString = match[2] ? '[' + match[2].trim() + ']' : undefined;
  const args: any[] = argsString ? (await parseJsJson(argsString)) : []

  return { command, args };
}
