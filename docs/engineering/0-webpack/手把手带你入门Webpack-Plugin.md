# 手把手带你入门 Webpack Plugin

> [https://www.zoo.team/article/webpack-plugin](https://www.zoo.team/article/webpack-plugin)

### 关于 Webpack

在讲 Plugin 之前，我们先来了解下 **Webpack**。本质上，**Webpack** 是一个用于现代 JavaScript 应用程序的静态模块打包工具。它能够解析我们的代码，生成对应的依赖关系，然后将不同的模块达成一个或多个 bundle。

![img](https://zoo.team/images/upload/upload_df3af7faf7f94771ce64d4865c1be877.png)

**Webpack** 的基本概念包括了如下内容：

1. Entry：Webpack 的入口文件，指的是应该从哪个模块作为入口，来构建内部依赖图。
2. Output：告诉 Webpack 在哪输出它所创建的 bundle 文件，以及输出的 bundle 文件该如何命名、输出到哪个路径下等规则。
3. Loader：模块代码转化器，使得 Webpack 有能力去处理除了 JS、JSON 以外的其他类型的文件。
4. Plugin：Plugin 提供执行更广的任务的功能，包括：打包优化，资源管理，注入环境变量等。
5. Mode：根据不同运行环境执行不同优化参数时的必要参数。
6. Browser Compatibility：支持所有 ES5 标准的浏览器（IE8 以上）。

了解完 Webpack 的基本概念之后，我们再来看下，为什么我们会需要 Plugin。

### Plugin 的作用

我先举一个我们政采云内部的案例：

在 React 项目中，一般我们的 Router 文件是写在一个项目中的，如果项目中包含了许多页面，不免会出现所有业务模块 Router 耦合的情况，所以我们开发了一个 Plugin，在构建打包时，该 Plugin 会读取所有文件夹下的 index.js 文件，再合并到一起形成一个统一的 Router 文件，轻松解决业务耦合问题。这就是 Plugin 的应用（具体实现会在最后一小节说明）。

来看一下我们合成前项目代码结构：

```json
├── package.json
├── README.md
├── zoo.config.js
├── .eslintignore
├── .eslintrc
├── .gitignore
├── .stylelintrc
├── build （Webpack 配置目录）
│   └── webpack.dev.conf.js
├── src
│   ├── index.hbs
│   ├── main.js （入口文件）
│   ├── common （通用模块，包权限，统一报错拦截等）
│       └── ...
│   ├── components （项目公共组件）
│       └── ...
│   ├── layouts （项目顶通）
│       └── ...
│   ├── utils （公共类）
│       └── ...
│   ├── routes （页面路由）
│   │   ├── Hello （对应 Hello 页面的代码）
│   │   │   ├── config （页面配置信息）
│   │   │       └── ...
│   │   │   ├── models （dva数据中心）
│   │   │       └── ...
│   │   │   ├── services （请求相关接口定义）
│   │   │       └── ...
│   │   │   ├── views （请求相关接口定义）
│   │   │       └── ...
│   │   │   └── index.js （router定义的路由信息）
├── .eslintignore
├── .eslintrc
├── .gitignore
└── .stylelintrc
```

再看一下经过 Plugin 合成 Router 之后的结构：

```json
├── package.json
├── README.md
├── zoo.config.js
├── .eslintignore
├── .eslintrc
├── .gitignore
├── .stylelintrc
├── build （Webpack 配置目录）
│   └── webpack.dev.conf.js
├── src
│   ├── index.hbs
│   ├── main.js （入口文件）
│   ├── router-config.js （合成后的router文件）
│   ├── common （通用模块，包权限，统一报错拦截等）
│       └── ...
│   ├── components （项目公共组件）
│       └── ...
│   ├── layouts （项目顶通）
│       └── ...
│   ├── utils （公共类）
│       └── ...
│   ├── routes （页面路由）
│   │   ├── Hello （对应 Hello 页面的代码）
│   │   │   ├── config （页面配置信息）
│   │   │       └── ...
│   │   │   ├── models （dva数据中心）
│   │   │       └── ...
│   │   │   ├── services （请求相关接口定义）
│   │   │       └── ...
│   │   │   ├── views （请求相关接口定义）
│   │   │       └── ...
├── .eslintignore
├── .eslintrc
├── .gitignore
└── .stylelintrc
```

总结来说 Plugin 的作用如下：

1. 提供了 Loader 无法解决的一些其他事情
2. 提供强大的扩展方法，能执行更广的任务

了解完 Plugin 的大致作用之后，我们来聊一聊如何创建一个 Plugin。

### 创建一个 Plugin

#### Hook

在聊创建 Plugin 之前，我们先来聊一下什么是 Hook。

Webpack 在编译的过程中会触发一系列流程，而在这样一连串的流程中，Webpack 把一些关键的流程节点暴露出来供开发者使用，这就是 Hook，可以类比 React 的生命周期钩子。

Plugin 就是在这些 Hook 上暴露出方法供开发者做一些额外操作，在写 Plugin 的时候，也需要先了解我们应该在哪个 Hook 上做操作。

#### 如何创建 Plugin

我们先来看一下 Webpack 官方给的案例：

```javascript
const pluginName = 'ConsoleLogOnBuildWebpackPlugin';

class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        // 代表开始读取 records 之前执行
        compiler.hooks.run.tap(pluginName, compilation => {
            console.log("webpack 构建过程开始！");
        });
    }
}
```

从上面的代码我们可以总结如下内容：

- Plugin 其实就是一个类。
- 类需要一个 apply 方法，执行具体的插件方法。
- 插件方法做了一件事情就是在 run 这个 Hook 上注册了一个同步的打印日志的方法。
- apply 方法的入参注入了一个 compiler 实例，compiler 实例是 Webpack 的支柱引擎，代表了 CLI 和 Node API 传递的所有配置项。
- Hook 回调方法注入了 compilation 实例，compilation 能够访问当前构建时的模块和相应的依赖。

> Compiler 对象包含了 Webpack 环境所有的的配置信息，包含 options，loaders，plugins 这些信息，这个对象在 Webpack 启动时候被实例化，它是全局唯一的，可以简单地把它理解为 Webpack 实例；Compilation 对象包含了当前的模块资源、编译生成资源、变化的文件等。当 Webpack 以开发模式运行时，每当检测到一个文件变化，一次新的 Compilation 将被创建。Compilation 对象也提供了很多事件回调供插件做扩展。通过 Compilation 也能读取到 Compiler 对象。 —— 摘自「深入浅出 Webpack」

- compiler 实例和 compilation 实例上分别定义了许多 Hooks，可以通过 `实例.hooks.具体Hook` 访问，Hook 上还暴露了 3 个方法供使用，分别是 tap、tapAsync 和 tapPromise。这三个方法用于定义如何执行 Hook，比如 tap 表示注册同步 Hook，tapAsync 代表 callback 方式注册异步 hook，而 tapPromise 代表 Promise 方式注册异步 Hook，可以看下 Webpack 中关于这三种类型实现的源码，为方便阅读，我加了些注释。

```javascript
// tap方法的type是sync，tapAsync方法的type是async，tapPromise方法的type是promise
// 源码取自Hook工厂方法：lib/HookCodeFactory.js
create(options) {
  this.init(options);
  let fn;
  // Webpack 通过new Function 生成函数
  switch (this.options.type) {
    case "sync":
      fn = new Function(
        this.args(), // 生成函数入参
        '"use strict";\n' +
        this.header() + // 公共方法，生成一些需要定义的变量
        this.contentWithInterceptors({ // 生成实际执行的代码的方法
          onError: err => `throw ${err};\n`, // 错误回调
          onResult: result => `return ${result};\n`, // 得到值的时候的回调
          resultReturns: true,
          onDone: () => "",
          rethrowIfPossible: true
        })
      );
      break;
    case "async":
      fn = new Function(
        this.args({
          after: "_callback"
        }),
        '"use strict";\n' +
        this.header() + // 公共方法，生成一些需要定义的变量
        this.contentWithInterceptors({ 
          onError: err => `_callback(${err});\n`, // 错误时执行回调方法
          onResult: result => `_callback(null, ${result});\n`, // 得到结果时执行回调方法
          onDone: () => "_callback();\n" // 无结果，执行完成时
        })
      );
      break;
    case "promise":
      let errorHelperUsed = false;
      const content = this.contentWithInterceptors({
        onError: err => {
          errorHelperUsed = true;
          return `_error(${err});\n`;
        },
        onResult: result => `_resolve(${result});\n`,
        onDone: () => "_resolve();\n"
      });
      let code = "";
      code += '"use strict";\n';
      code += this.header(); // 公共方法，生成一些需要定义的变量
      code += "return new Promise((function(_resolve, _reject) {\n"; // 返回的是 Promise
      if (errorHelperUsed) {
        code += "var _sync = true;\n";
        code += "function _error(_err) {\n";
        code += "if(_sync)\n";
        code +=
          "_resolve(Promise.resolve().then((function() { throw _err; })));\n";
        code += "else\n";
        code += "_reject(_err);\n";
        code += "};\n";
      }
      code += content; // 判断具体执行_resolve方法还是执行_error方法
      if (errorHelperUsed) {
        code += "_sync = false;\n";
      }
      code += "}));\n";
      fn = new Function(this.args(), code);
      break;
  }
  this.deinit(); // 清空 options 和 _args
  return fn;
}
```

Webpack 共提供了以下十种 Hooks，代码中所有具体的 Hook 都是以下这 10 种中的一种。

```javascript
// 源码取自：lib/index.js
"use strict";

exports.__esModule = true;
// 同步执行的钩子，不能处理异步任务
exports.SyncHook = require("./SyncHook");
// 同步执行的钩子，返回非空时，阻止向下执行
exports.SyncBailHook = require("./SyncBailHook");
// 同步执行的钩子，支持将返回值透传到下一个钩子中
exports.SyncWaterfallHook = require("./SyncWaterfallHook");
// 同步执行的钩子，支持将返回值透传到下一个钩子中，返回非空时，重复执行
exports.SyncLoopHook = require("./SyncLoopHook");
// 异步并行的钩子
exports.AsyncParallelHook = require("./AsyncParallelHook");
// 异步并行的钩子，返回非空时，阻止向下执行，直接执行回调
exports.AsyncParallelBailHook = require("./AsyncParallelBailHook");
// 异步串行的钩子
exports.AsyncSeriesHook = require("./AsyncSeriesHook");
// 异步串行的钩子，返回非空时，阻止向下执行，直接执行回调
exports.AsyncSeriesBailHook = require("./AsyncSeriesBailHook");
// 支持异步串行 && 并行的钩子，返回非空时，重复执行
exports.AsyncSeriesLoopHook = require("./AsyncSeriesLoopHook");
// 异步串行的钩子，下一步依赖上一步返回的值
exports.AsyncSeriesWaterfallHook = require("./AsyncSeriesWaterfallHook");
// 以下 2 个是 hook 工具类，分别用于 hooks 映射以及 hooks 重定向
exports.HookMap = require("./HookMap");
exports.MultiHook = require("./MultiHook");
```

举几个简单的例子：

- 上面官方案例中的 run 这个 Hook，会在开始读取 records 之前执行，它的类型是 AsyncSeriesHook，查看源码可以发现，run Hook 既可以执行同步的 tap 方法，也可以执行异步的 tapAsync 和 tapPromise 方法，所以以下写法也是可以的：

```javascript
const pluginName = 'ConsoleLogOnBuildWebpackPlugin';

class ConsoleLogOnBuildWebpackPlugin {
    apply(compiler) {
        compiler.hooks.run.tapAsync(pluginName, (compilation, callback) => {
            setTimeout(() => {
              console.log("webpack 构建过程开始！");
              callback(); // callback 方法为了让构建继续执行下去，必须要调用
            }, 1000);
        });
    }
}
```

- 再举一个例子，比如 failed 这个 Hook，会在编译失败之后执行，它的类型是 SyncHook，查看源码可以发现，调用 tapAsync 和 tapPromise 方法时，会直接抛错。

对于一些同步的方法，推荐直接使用 tap 进行注册方法，对于异步的方案，tapAsync 通过执行 callback 方法实现回调，如果执行的方法返回的是一个 Promise，推荐使用 tapPromise 进行方法的注册

Hook 的类型可以通过官方 API 查询，[地址传送门](https://www.webpackjs.com/api/compiler-hooks/?fileGuid=3tGHdrykRgwCyTP8)

```javascript
// 源码取自：lib/SyncHook.js
const TAP_ASYNC = () => {
  throw new Error("tapAsync is not supported on a SyncHook");
};

const TAP_PROMISE = () => {
  throw new Error("tapPromise is not supported on a SyncHook");
};

function SyncHook(args = [], name = undefined) {
  const hook = new Hook(args, name);
  hook.constructor = SyncHook;
  hook.tapAsync = TAP_ASYNC;
  hook.tapPromise = TAP_PROMISE;
  hook.compile = COMPILE;
  return hook;
}
```

讲解完具体的执行方法之后，我们再聊一下 Webpack 流程以及 Tapable 是什么。

### Webpack && Tapable

#### Webpack 运行机制

要理解 Plugin，我们先大致了解 Webpack 打包的流程

1. 我们打包的时候，会先合并 Webpack config 文件和命令行参数，合并为 options。
2. 将 options 传入 Compiler 构造方法，生成 compiler 实例，并实例化了 Compiler 上的 Hooks。
3. compiler 对象执行 run 方法，并自动触发 beforeRun、run、beforeCompile、compile 等关键 Hooks。
4. 调用 Compilation 构造方法创建 compilation 对象，compilation 负责管理所有模块和对应的依赖，创建完成后触发 make Hook。
5. 执行 compilation.addEntry() 方法，addEntry 用于分析所有入口文件，逐级递归解析，调用 NormalModuleFactory 方法，为每个依赖生成一个 Module 实例，并在执行过程中触发 beforeResolve、resolver、afterResolve、module 等关键 Hooks。
6. 将第 5 步中生成的 Module 实例作为入参，执行 Compilation.addModule() 和 Compilation.buildModule() 方法递归创建模块对象和依赖模块对象。
7. 调用 seal 方法生成代码，整理输出主文件和 chunk，并最终输出。

![img](https://zoo.team/images/upload/upload_c44331e60d68a7cbe9b00cf1acb73d4a.png)

#### Tapable

Tapable 是 Webpack 核心工具库，它提供了所有 Hook 的抽象类定义，Webpack 许多对象都是继承自 Tapable 类。比如上面说的 tap、tapAsync 和 tapPromise 都是通过 Tapable 进行暴露的。源码如下（截取了部分代码）：

```js
// 第二节 “创建一个 Plugin” 中说的 10 种 Hooks 都是继承了这两个类
// 源码取自：tapable.d.ts
declare class Hook<T, R, AdditionalOptions = UnsetAdditionalOptions> {
  tap(options: string | Tap & IfSet<AdditionalOptions>, fn: (...args: AsArray<T>) => R): void;
}

declare class AsyncHook<T, R, AdditionalOptions = UnsetAdditionalOptions> extends Hook<T, R, AdditionalOptions> {
  tapAsync(
    options: string | Tap & IfSet<AdditionalOptions>,
    fn: (...args: Append<AsArray<T>, InnerCallback<Error, R>>) => void
  ): void;
  tapPromise(
    options: string | Tap & IfSet<AdditionalOptions>,
    fn: (...args: AsArray<T>) => Promise<R>
  ): void;
}
```

#### 常见 Hooks API

可以参考 [Webpack](https://www.webpackjs.com/api/compiler-hooks/?fileGuid=3tGHdrykRgwCyTP8)

本文列举一些常用 Hooks 和其对应的类型：

**Compiler Hooks**

|  Hook   |      type       |                调用                 |
| :-----: | :-------------: | :---------------------------------: |
|   run   | AsyncSeriesHook |        开始读取 records 之前        |
| compile |    SyncHook     | 一个新的编译 (compilation) 创建之后 |
|  emit   | AsyncSeriesHook |     生成资源到 output 目录之前      |
|  done   |    SyncHook     |       编译 (compilation) 完成       |

**Compilation Hooks**

|     Hook      |   type   |          调用          |
| :-----------: | :------: | :--------------------: |
|  buildModule  | SyncHook | 在模块构建开始之前触发 |
| finishModules | SyncHook |   所有模块都完成构建   |
|   optimize    | SyncHook |   优化阶段开始时触发   |

### Plugin 在项目中的应用

讲完这么多理论知识，接下来我们来看一下 Plugin 在项目中的实战：如何将各个子模块中的 router 文件合并到 router-config.js 中。

#### 背景：

在 React 项目中，一般我们的 Router 文件是写在一个项目中的，如果项目中包含了许多页面，不免会出现所有业务模块 Router 耦合的情况，所以我们开发了一个 Plugin，在构建打包时，该 Plugin 会读取所有文件夹下的 Router 文件，再合并到一起形成一个统一的 Router Config 文件，轻松解决业务耦合问题。这就是 Plugin 的应用。

#### 实现：

```javascript
const fs = require('fs');
const path = require('path');
const _ = require('lodash');

function resolve(dir) {
  return path.join(__dirname, '..', dir);
}

function MegerRouterPlugin(options) {
  // options是配置文件，你可以在这里进行一些与options相关的工作
}

MegerRouterPlugin.prototype.apply = function (compiler) {
  // 注册 before-compile 钩子，触发文件合并
  compiler.plugin('before-compile', (compilation, callback) => {
    // 最终生成的文件数据
    const data = {};
    const routesPath = resolve('src/routes');
    const targetFile = resolve('src/router-config.js');
    // 获取路径下所有的文件和文件夹
    const dirs = fs.readdirSync(routesPath);
    try {
      dirs.forEach((dir) => {
        const routePath = resolve(`src/routes/${dir}`);
        // 判断是否是文件夹
        if (!fs.statSync(routePath).isDirectory()) {
          return true;
        }
        delete require.cache[`${routePath}/index.js`];
        const routeInfo = require(routePath);
        // 多个 view 的情况下，遍历生成router信息
        if (!_.isArray(routeInfo)) {
          generate(routeInfo, dir, data);
        // 单个 view 的情况下，直接生成
        } else {
          routeInfo.map((config) => {
            generate(config, dir, data);
          });
        }
      });
    } catch (e) {
      console.log(e);
    }

    // 如果 router-config.js 存在，判断文件数据是否相同，不同删除文件后再生成
    if (fs.existsSync(targetFile)) {
      delete require.cache[targetFile];
      const targetData = require(targetFile);
      if (!_.isEqual(targetData, data)) {
        writeFile(targetFile, data);
      }
    // 如果 router-config.js 不存在，直接生成文件
    } else {
      writeFile(targetFile, data);
    }

    // 最后调用 callback，继续执行 webpack 打包
    callback();
  });
};
// 合并当前文件夹下的router数据，并输出到 data 对象中
function generate(config, dir, data) {
  // 合并 router
  mergeConfig(config, dir, data);
  // 合并子 router
  getChildRoutes(config.childRoutes, dir, data, config.url);
}
// 合并 router 数据到 targetData 中
function mergeConfig(config, dir, targetData) {
  const { view, models, extraModels, url, childRoutes, ...rest } = config;
  // 获取 models，并去除 src 字段
  const dirModels = getModels(`src/routes/${dir}/models`, models);
  const data = {
    ...rest,
  };
  // view 拼接到 path 字段
  data.path = `${dir}/views${view ? `/${view}` : ''}`;
  // 如果有 extraModels，就拼接到 models 对象上
  if (dirModels.length || (extraModels && extraModels.length)) {
    data.models = mergerExtraModels(config, dirModels);
  }
  Object.assign(targetData, {
    [url]: data,
  });
}
// 拼接 dva models
function getModels(modelsDir, models) {
  if (!fs.existsSync(modelsDir)) {
    return [];
  }
  let files = fs.readdirSync(modelsDir);
  // 必须要以 js 或者 jsx 结尾
  files = files.filter((item) => {
    return /\.jsx?$/.test(item);
  });
  // 如果没有定义 models ，默认取 index.js
  if (!models || !models.length) {
    if (files.indexOf('index.js') > -1) {
      // 去除 src
      return [`${modelsDir.replace('src/', '')}/index.js`];
    }
    return [];
  }
  return models.map((item) => {
    if (files.indexOf(`${item}.js`) > -1) {
      // 去除 src
      return `${modelsDir.replace('src/', '')}/${item}.js`;
    }
  });
}
// 合并 extra models
function mergerExtraModels(config, models) {
  return models.concat(config.extraModels ? config.extraModels : []);
}
// 合并子 router
function getChildRoutes(childRoutes, dir, targetData, oUrl) {
  if (!childRoutes) {
    return;
  }
  childRoutes.map((option) => {
    option.url = oUrl + option.url;
    if (option.childRoutes) {
      // 递归合并子 router
      getChildRoutes(option.childRoutes, dir, targetData, option.url);
    }
    mergeConfig(option, dir, targetData);
  });
}

// 写文件
function writeFile(targetFile, data) {
  fs.writeFileSync(targetFile, `module.exports = ${JSON.stringify(data, null, 2)}`, 'utf-8');
}

module.exports = MegerRouterPlugin;
```

#### 结果：

合并前的文件：

```javascript
module.exports = [
  {
    url: '/category/protocol',
    view: 'protocol',
  },
  {
    url: '/category/sync',
    models: ['sync'],
    view: 'sync',
  },
  {
    url: '/category/list',
    models: ['category', 'config', 'attributes', 'group', 'otherSet', 'collaboration'],
    view: 'categoryRefactor',
  },
  {
    url: '/category/conversion',
    models: ['conversion'],
    view: 'conversion',
  },
];
```

合并后的文件：

```javascript
module.exports = {
  "/category/protocol": {
    "path": "Category/views/protocol"
  },
  "/category/sync": {
    "path": "Category/views/sync",
    "models": [
      "routes/Category/models/sync.js"
    ]
  },
  "/category/list": {
    "path": "Category/views/categoryRefactor",
    "models": [
      "routes/Category/models/category.js",
      "routes/Category/models/config.js",
      "routes/Category/models/attributes.js",
      "routes/Category/models/group.js",
      "routes/Category/models/otherSet.js",
      "routes/Category/models/collaboration.js"
    ]
  },
  "/category/conversion": {
    "path": "Category/views/conversion",
    "models": [
      "routes/Category/models/conversion.js"
    ]
  },
}
```

最终项目就会生成 router-config.js 文件

![img](https://zoo.team/images/upload/upload_817dd09465d1bf29f9a99d8357e73d35.png)

### 结尾

希望大家看完本章之后，对 Webpack Plugin 有一个初步的认识，能够上手写一个自己的 Plugin 来应用到自己的项目中。

文章中如有不对的地方，欢迎指正