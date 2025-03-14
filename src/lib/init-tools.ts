import {
  event, // event bus for server
  backendEventable,
  ResServerTools,
  ServerTools,
} from '@isdk/ai-tool'
import { llm, LLMProvider } from '@isdk/ai-tool-llm'
import { LocalProviderName, LocalProvider } from '@isdk/ai-tool-llm-local'
import { LlamaCppProviderName, llamaCpp } from '@isdk/ai-tool-llm-llamacpp'
import { openai } from '@isdk/ai-tool-llm-openai'
import { AIPromptsFunc, AIPromptsName } from '@isdk/ai-tool-prompt'
import { download } from '@isdk/ai-tool-downloader'
import type { Hook, Config } from '@oclif/core'

export const BRAINS_FUNC_NAME = 'llm.brains'

const providers: {[name: string]: LLMProvider} = {}

export function registerProvider(provider: LLMProvider, name?: string) {
  if (!name) {
    name = provider.name!
  }
  providers[name] = provider
}

function initRegisteredProviders(rootDir: string) {
  const local = new LocalProvider(LocalProviderName, {rootDir})
  registerProvider(local)
  registerProvider(llamaCpp)
  registerProvider(openai)

  for (const provider of Object.values(providers)) {
    provider.register()
  }

  // add aliases:
  registerProvider(local, 'local')
}


export async function initTools(this: Hook.Context, userConfig: any, _config: Config) {
  try {
    const promptsFunc = new AIPromptsFunc(AIPromptsName, {dbPath: ':memory:', initDir: userConfig.promptsDir})
    await promptsFunc.initData()

    ServerTools.register(promptsFunc)
    ServerTools.register(llm)

    // llamaCpp.register()
    initRegisteredProviders(userConfig.brainDir)

    let currentProviderName = userConfig.provider || LlamaCppProviderName
    const providerUriParts = currentProviderName.split('://')
    currentProviderName = providerUriParts[0]
    if (!providers[currentProviderName]) {throw new Error(`Provider ${currentProviderName} not found`)}

    const provider = providers[currentProviderName]
    llm.setCurrentProvider(provider.name!)
    if (providerUriParts[1]) {
      provider.model = providerUriParts[1]
      provider.defaultModel = providerUriParts[1]
    }

    // the event-bus for server
    ResServerTools.register(event)
    backendEventable(ResServerTools)
    ResServerTools.register(download)

    if (userConfig.apiUrl) {
      provider.apiUrl = userConfig.apiUrl
    }
    if (userConfig.apiKey) {
      provider.apiKey = userConfig.apiKey
    }
  } catch (err) {
    console.error('🚀 ~ initTools ~ err:', err)
    throw err
  }
}
