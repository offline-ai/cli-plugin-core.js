# Programmable Prompt Engine(PPE) Language Script Capabilities

Programmable Prompt Engine(PPE) Language is a message-processing language, similar to the YAML format.

PPE is designed to define AI prompt messages and their input/output configurations. It allows for the creation of a reusable and programmable prompt system akin to software engineering practices.

* Message-Based: PPE revolves around defining interactions as a series of messages. Each message has a `role` (e.g., `system`, `assistant`, `user`) and the actual `message content`.
* YAML-Like: PPE uses a syntax similar to YAML, making it human-readable and relatively easy to learn.
* Dialogue Separation: Triple dashes (`---`) or asterisks (`***`) clearly mark the beginning of new dialogue turns, ensuring context is managed effectively.

## Instruction Invocation

The `$` prefix calls script instructions (e.g., `$fn: {param1:value1}`, or `$fn(param1=value)`).

## Chains Invocation of Agent Scripts Or Instructions

Within messages, results can be forwarded to other agents.

If no parameters are specified, the AI outcome will be passed as the `content` parameter to the agent. For instance,

`list-expression.ai.yaml`:

```yaml
system: Only list the calculation expression, do not calculate the result
---
user: "Three candies plus five candies."
assistant: "[[CalcExpression]]"
# The actual input to the agent in this case is: {content: "[AI-generated calculation expression]"}
-> calculator
$echo: "#A total of {{LatestResult}} pieces of candy"
```

`calculator.ai.yaml`:

```yaml
---
# Below is the front-matter configuration
parameters:
  response_format:
    type: "json"
output:
  type: "number"
---
# Below is the script
system: Please as a calculator to calculate the result of the following expression. Only output the result.
--- # mark the beginning of new dialogue
user: "{{content}}"
```

When parameters are included, the AI `content` is combined with these parameters and forwarded together to the agent. For example,

```yaml
user: "Tell me a joke!"
assistant: "[[JOKE]]"
# The actual input to the agent here is: {content: "[This is a joke generated by AI]", target_lang: "Portuguese"}
-> translator(target_lang="Portuguese") -> $print
```

**Note**:

* Call internal instruction with `$` prefix
* If the script returns a value of type `string`/`boolean`/`number`, that return value will be placed to the `content` field. If the return value is an `object`, its contents will be directly passed to the agent.

## Script Extension

### Declare Functions in Scripts

* The `!fn` directive allows declaring `JavaScript`/`Python`/... functions to extend script functionality.

```yaml
!fn |-
  function func1 ({arg1, arg2}) {
  }
# The function keyword can be omitted:
!fn |-
  func1 ({arg1, arg2}) {
  }
```

The function body is `javascript`. In the definition function, `async require(moduleFilename)` can be used to load local esm js file in the format.

```yaml
!fn |-
  async myTool ({arg1, arg2}) {
  const tool = await require(__dirname + '/myTool.js')
  return tool.myTool({arg1, arg2})
  }
```

If you need to use other languages, you should specify the language:

```yaml
!fn |-
  [python] def func1(arg1, arg2):
    return arg1 + arg2
```

**Note**:

* `__dirname`: is the directory where the prompt script file is located.
* `__filename`: is the prompt script file path.
* In the function, you can use `this` to get all the methods of the current script's runtime.
* All custom functions must be referenced by `$`. For example, in the example above, `func1` is defined, so `$func1` must be used when calling
* Currently only supports JavaScript, planning to add support for Python, Ruby, etc.

### Import External scripts and modules

* The `import` configuration to import functions and declarations in other script file

Import one file:

```yaml
---
import: "js:js_package_name"
---
```

Import many files Use Array Format:

```yaml
---
import:
  - "js:js_package_name"
  - "js/script/path.js": ['func1', 'func2', {func3: 'asFunc3'}] # Import only the specified functions
  - 'ruby-funcs.rb'
  - "agent.ai.yaml": "asName" # Import the script and rename it to "$asName"
---
```

Use Object Format:

```yaml
---
import: # Object Format
  "js:js_package_name": "*"
  "js/script/path.js": ['func1', 'func2']
  "agent.ai.yaml": "asName"
---
```

**Note**:

* the default is js module if not extension name provided.
* The relative path is the folder of the current ai script, not the CWD(current working dir)
* When the imported declaration is a function, it automatically adds the prefix "$" to function names without a prefix
* If the function `initializeModule` exists in the module and is imported, it will be automatically executed after the module loads.
* Currently, only `javascript` support has been implemented.

## Script File and Package

A PPE script can be a single file or an entire directory as package. If it is a file, the filename must end with `.ai.yaml`.

If it's a package(directory), The package name is the same as the directory name. The root directory of the package must contain a script file with the same name as the directory, which serves as the package entry script. Additionally, other script files within the same directory can call each other.

For example, if there is a package directory named `a-dir`, the entry script in that directory should be named `a-dir/a-dir.ai.yaml`.

The functions exported by the package are determined by the `export` configuration in the entry file.

```yaml
---
export:
  - "$hi"
  - "./dobby.ai.yaml"
---
!fn |-
  [js]hi() {console.log('hi')}
```

For example, if there is a directory named `a-dir`, the entry point script file should be named `a-dir/a-dir.ai.yaml`.

## Essential Tips

* Script Return Value: The script's final command's output determines its return value.
* Auto-Execution: Scripts ending with prompts but no explicit `$AI` call will automatically execute `$AI` at the end, configurable via `autoRunLLMIfPromptAvailable`.
* Output Mode: Scripts default to streaming output, can disable it using the `--no-stream` switch
  * Note: not all LLM backends support streaming output.
