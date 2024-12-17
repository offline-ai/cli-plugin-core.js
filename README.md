# Offline AI Client Core(WIP)

> 【English|[中文](./README.cn.md)】
---
The [Offline AI Client](https://npmjs.org/package/@offline-ai/cli) core plugin.

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/%40offline-ai%2Fcli.svg)](https://npmjs.org/package/@offline-ai/cli)
[![Downloads/week](https://img.shields.io/npm/dw/%40offline-ai%2Fcli.svg)](https://npmjs.org/package/@offline-ai/cli)

**Features**:

* User-friendly for ai development and creation of intelligent applications...
* Low-code or even no-code solutions for rapid ai development...
* Flexible, adding custom instructions within scripts, and inter-script calls...
* The data is completely open to the script, and the input and output data, even the internal data, can be freely accessed in the script
* Powerful, enabling event transmission seamlessly between client and server with numerous utility functions...
* Secure, supporting encrypted execution and usage limits for scripts(TODO)...
* The AI Agent Script follows the [Programmable Prompt Engine Specification](https://github.com/offline-ai/ppe).
  * Visit the site for the detailed AI Agent script usage.

<!-- toc -->
* [Offline AI Client Core(WIP)](#offline-ai-client-corewip)
* [Install](#install)
* [Commands](#commands)
* [Credit](#credit)
<!-- tocstop -->


# Install

```bash
npm install -g @offline-ai/cli
```

# Commands

<!-- commands -->
* [`ai run [FILE] [DATA]`](#ai-run-file-data)

## `ai run [FILE] [DATA]`

💻 Run ai-agent script file.

```
USAGE
  $ ai run [FILE] [DATA] [--json] [--config <value>] [--banner] [-u <value>] [--apiKey <value>] [-s
    <value>...] [--logLevelMaxLen <value> -l trace|debug|verbose|info|notice|warn|error|fatal|print|silence]
    [--histories <value>] [-n] [-k] [-t <value> -i] [--no-chats] [--no-inputs ] [-m] [-f <value>] [-d <value>] [-D
    <value>...] [-a <value>] [-b <value>] [-p <value>...] [-L <value>] [-A <value>] [-e true|false|line] [-C <value>]
    [-P <value>] [--consoleClear]

ARGUMENTS
  FILE  the script file path, or the json data when `-f` switch is set
  DATA  the json data which will be passed to the ai-agent script

FLAGS
  -A, --aiPreferredLanguage=<value>    the ISO 639-1 code for the AI preferred language to translate the user input
                                       automatically, eg, en, etc.
  -C, --streamEchoChars=<value>        [default: 80] stream echo max characters limit
  -D, --data=<value>...                the data which will be passed to the ai-agent script: key1=value1 key2=value2
  -L, --userPreferredLanguage=<value>  the ISO 639-1 code for the user preferred language to translate the AI result
                                       automatically, eg, en, zh, ja, ko, etc.
  -P, --provider=<value>               the LLM provider, defaults to llamacpp
  -a, --arguments=<value>              the json data which will be passed to the ai-agent script
  -b, --brainDir=<value>               the brains(LLM) directory
  -d, --dataFile=<value>               the data file which will be passed to the ai-agent script
  -e, --streamEcho=<option>            [default: line] stream echo mode
                                       <options: true|false|line>
  -f, --script=<value>                 the ai-agent script file name or id
  -i, --[no-]interactive               interactive mode
  -k, --backupChat                     whether to backup chat history before start, defaults to false
  -l, --logLevel=<option>              the log level
                                       <options: trace|debug|verbose|info|notice|warn|error|fatal|print|silence>
  -m, --[no-]stream                    stream mode, defaults to true
  -n, --[no-]newChat                   whether to start a new chat history, defaults to false in interactive mode, true
                                       in non-interactive
  -p, --promptDirs=<value>...          the prompts template directory
  -s, --agentDirs=<value>...           the search paths for ai-agent script file
  -t, --inputs=<value>                 the input histories folder for interactive mode to record
  -u, --api=<value>                    the api URL
      --apiKey=<value>                 the api key (optional)
      --[no-]banner                    show banner
      --config=<value>                 the config file
      --[no-]consoleClear              Whether console clear after stream echo output, default to true
      --histories=<value>              the chat histories folder to record
      --logLevelMaxLen=<value>         the max length of log item to display
      --no-chats                       disable chat histories, defaults to false
      --no-inputs                      disable input histories, defaults to false

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  💻 Run ai-agent script file.

  Execute ai-agent script file and return result. with `-i` to interactive.

EXAMPLES
  $ ai run -f ./script.yaml "{content: 'hello world'}" -l info
  ┌────────────────────
  │[info]:Start Script: ...
```

_See code: [src/commands/run/index.ts](https://github.com/offline-ai/cli-plugin-core.js/blob/v0.8.14/src/commands/run/index.ts)_
<!-- commandsstop -->

# Credit

* [OpenAI](https://openai.com/)
* [HuggingFace](https://huggingface.co/)
* [llama-cpp](https://github.com/ggerganov/llama.cpp)
