# Webpack 原理系列六： 彻底理解Webpack运行时

# 背景 

在上一篇文章 [有点难的 webpack 知识点：Chunk 分包规则详解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484029&idx=1&sn=7862737524e799c5eaf1605325171e32&scene=21#wechat_redirect) 中，我们详细讲解了 Webpack 默认的分包规则，以及一部分 seal 阶段的执行逻辑，现在我们将按 Webpack 的执行流程，继续往下深度分析实现原理，具体内容包括：

- Webpack 的构建产物包含那些内容？产物如何支持诸如模块化、异步加载、HMR 特性？
- 何谓运行时？Webpack 构建过程中如何收集运行时依赖？如何将运行时与业务代码合并输出到 `bundle`？

实际上，本文及前面几篇原理性质的文章，可能并不能马上解决你在业务中可能正在面临的现实问题，但放到更长的时间维度，这些文章所呈现的知识、思维、思辨过程可能能够长远地给到你：

- 分析、理解复杂开源代码的能力
- 理解 Webpack 架构及实现细节，下次遇到问题的时候能根据表象迅速定位到根源
- 理解 Webpack 为 hooks、loader 提供的上下文，能够更通畅地理解其它开源组件，甚至能够自如地实现自己的组件

所以，希望感兴趣的同学能够坚持，我后续还会输出很多关于 Webpack 实现原理的文章！如果你恰好也想提升自己在 Webpack 方面的知识储备，关注我，我们一起学习！

# 编译产物分析

为了正常、正确运行业务项目，Webpack 需要将开发者编写的业务代码以及支撑、调配这些业务代码的**「运行时」**一并打包到产物(bundle)中，以建筑作类比的话，业务代码相当于砖瓦水泥，是看得见摸得着能直接感知的逻辑；运行时相当于掩埋在砖瓦之下的钢筋地基，通常不会关注但决定了整座建筑的功能、质量。

大多数 Webpack 特性都需要特定钢筋地基才能跑起来，比如说：

- 异步按需加载
- HMR
- WASM
- Module Federation

下面先从最简单的示例开始，逐步展开了解各个特性下的 Webpack 运行时代码。

## 基本结构

先从一个最简单的示例开始，对于下面的代码结构：

```
// a.js
export default 'a module';

// index.js
import name from './a'
console.log(name)
```

使用如下配置：

```
module.exports = {
  entry: "./src/index",
  mode: "development",
  devtool: false,
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist"),
  },
};
```

配置的内容比较简单，就不展开讲了，直接看编译生成的结果：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblk61ELBjWls2TgqlBSHNAS9x4zxTtiahM7YwDwu0fjX3gIXIsKiam6c9VPDm2p9MvSseL6vvCezmPdQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

虽然看起来很非主流，但细心分析还是能拆解出代码脉络的，bundle 整体由一个 IIFE 包裹，里面的内容从上到下依次为：

- `__webpack_modules__` 对象，包含了除入口外的所有模块，示例中即 `a.js` 模块
- `__webpack_module_cache__` 对象，用于存储被引用过的模块
- `__webpack_require__` 函数，实现模块引用(require) 逻辑
- `__webpack_require__.d` ，工具函数，实现将模块导出的内容附加的模块对象上
- `__webpack_require__.o` ，工具函数，判断对象属性用
- `__webpack_require__.r` ，工具函数，在 ESM 模式下声明 ESM 模块标识
- 最后的 IIFE，对应 entry 模块即上述示例的 `index.js` ，用于启动整个应用

这几个 `__webpack_` 开头奇奇怪怪的函数可以统称为 Webpack 运行时代码，作用如前面所说的是搭起整个业务项目的骨架，就上述简单示例所罗列出来的几个函数、对象而言，它们协作构建起一个简单的模块化体系从而实现 ES Module 规范所声明的模块化特性。

上述示例中最终的函数是 `__webpack_require__`，它实现了模块间引用功能，核心代码：

```
function __webpack_require__(moduleId) {
    /******/ // 如果模块被引用过
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId](
      module,
      module.exports,
      __webpack_require__
    );
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
```

从代码可以推测出，它的功能：

- 根据 `moduleId` 参数找到对应的模块代码，执行并返回结果
- 如果 `moduleId` 对应的模块被引用过，则直接返回存储在 `__webpack_module_cache__` 缓存对象中的导出内容，避免重复执行

其中，业务模块代码被存储在 bundle 最开始的 `__webpack_modules__` 变量中，内容如：

```
var __webpack_modules__ = {
    "./src/a.js": (
        __unused_webpack_module,
        __webpack_exports__,
        __webpack_require__
      ) => {
        // ...
      },
  };
```

结合 `__webpack_require__` 函数与 `__webpack_modules__` 变量就可以正确地引用到代码模块，例如上例生成代码最后面的IIFE：

```
(() => {
    /*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
    /* harmony import */ var _a__WEBPACK_IMPORTED_MODULE_0__ =
      __webpack_require__(/*! ./a */ "./src/a.js");

    console.log(_a__WEBPACK_IMPORTED_MODULE_0__.name);
  })();
```

这几个函数、对象构成了 Webpack 运行时最基本的能力 —— 模块化，它们的生成规则与原理我们放到文章第二节《实现原理》再讲，下面我们继续看看异步模块加载、模块热更新场景下对应的运行时内容。

## 异步模块加载

我们来看个简单的异步模块加载示例：

```
// ./src/a.js
export default "module-a"

// ./src/index.js
import('./a').then(console.log)
```

Webpack 配置跟上例相似：

```
module.exports = {
  entry: "./src/index",
  mode: "development",
  devtool: false,
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist"),
  },
};
```

生成的代码太长，就不贴了，相比于最开始的基本结构示例所示的模块化功能，使用异步模块加载特性时，会额外增加如下运行时：

- `__webpack_require__.e` ：逻辑上包裹了一层中间件模式与 `promise.all` ，用于异步加载多个模块
- `__webpack_require__.f` ：供 `__webpack_require__.e` 使用的中间件对象，例如使用 Module Federation 特性时就需要在这里注册中间件以修改 e 函数的执行逻辑
- `__webpack_require__.u` ：用于拼接异步模块名称的函数
- `__webpack_require__.l` ：基于 JSONP 实现的异步模块加载函数
- `__webpack_require__.p` ：当前文件的完整 URL，可用于计算异步模块的实际 URL

建议读者运行示例对比实际生成代码，感受它们的具体功能。这几个运行时模块构建起 Webpack 异步加载能力，其中最核心的是 `__webpack_require__.e` 函数，它的代码很简单：

```
__webpack_require__.f = {};
/******/    // This file contains only the entry chunk.
/******/    // The chunk loading function for additional chunks
/******/    __webpack_require__.e = (chunkId) => {
/******/      return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/        __webpack_require__.f[key](chunkId, promises);
/******/        return promises;
/******/      }, []));
/******/    };
```

从代码看，只是实现了一套基于 `__webpack_require__.f` 的中间件模式，以及用 `Promise.all` 实现并行处理，实际加载工作由 `__webpack_require__.f.j` 与 `__webpack_require__.l` 实现，分开来看两个函数：

```
/******/  __webpack_require__.f.j = (chunkId, promises) => {
/******/        // JSONP chunk loading for javascript
/******/        var installedChunkData = __webpack_require__.o(installedChunks, chunkId) ? installedChunks[chunkId] : undefined;
/******/        if(installedChunkData !== 0) { // 0 means "already installed".
/******/    
/******/          // a Promise means "currently loading".
/******/          if(installedChunkData) {
/******/            promises.push(installedChunkData[2]);
/******/          } else {
/******/            if(true) { // all chunks have JS
/******/              // ...
/******/              // start chunk loading
/******/              var url = __webpack_require__.p + __webpack_require__.u(chunkId);
/******/              // create error before stack unwound to get useful stacktrace later
/******/              var error = new Error();
/******/              var loadingEnded = ...;
/******/              __webpack_require__.l(url, loadingEnded, "chunk-" + chunkId, chunkId);
/******/            } else installedChunks[chunkId] = 0;
/******/          }
/******/        }
/******/    };
```

`__webpack_require__.f.j` 实现了异步 `chunk` 路径的拼接、缓存、异常处理三个方面的逻辑，而 `__webpack_require__.l` 函数：

```
/******/    var inProgress = {};
/******/    // data-webpack is not used as build has no uniqueName
/******/    // loadScript function to load a script via script tag
/******/    __webpack_require__.l = (url, done, key, chunkId) => {
/******/      if(inProgress[url]) { inProgress[url].push(done); return; }
/******/      var script, needAttach;
/******/      if(key !== undefined) {
/******/        var scripts = document.getElementsByTagName("script");
/******/        // ...
/******/      }
/******/      // ...
/******/      inProgress[url] = [done];
/******/      var onScriptComplete = (prev, event) => {
/******/        // ...
/******/      }
/******/      ;
/******/      var timeout = setTimeout(onScriptComplete.bind(null, undefined, { type: 'timeout', target: script }), 120000);
/******/      script.onerror = onScriptComplete.bind(null, script.onerror);
/******/      script.onload = onScriptComplete.bind(null, script.onload);
/******/      needAttach && document.head.appendChild(script);
/******/    };
```

`__webpack_require__.l` 中通过 script 实现异步 chunk 内容的加载与执行。

`e + l + f.j` 三个运行时函数支撑起 Webpack 异步模块运行的能力，落到实际用法上只需要调用 e 函数即可完成异步模块加载、运行，例如上例对应生成的 `entry` 内容：

```
/*!**********************!*\
  !*** ./src/index.js ***!
  \**********************/
__webpack_require__.e(/*! import() */ "src_a_js").then(__webpack_require__.bind(__webpack_require__, /*! ./a */ "./src/a.js"))
```

## 模块热更新

模块热更新 —— HMR 是一个能显著提高开发效率的能力，它能够在模块代码出现变化的时候，单独编译该模块并将最新的编译结果传送到浏览器，浏览器再用新的模块代码替换掉旧的代码，从而实现模块级别的代码热替换能力。落到最终体验上，开发者启动 Webpack 后，编写、修改代码的过程中不需要手动刷新浏览器页面，所有变更能够实时同步呈现到页面中。

实现上，HMR 的实现链路很长也比较有意思，我们后续会单开一篇文章讨论，本文主要关注 HMR 特性所带入运行时代码。启动 HMR 能力需要用到一些特殊的配置项：

```
module.exports = {
  entry: "./src/index",
  mode: "development",
  devtool: false,
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "./dist"),
  },
  // 简单起见，这里使用 HtmlWebpackPlugin 插件自动生成作为 host 的 html 文件
  plugins: [
    new HtmlWebpackPlugin({
      title: "Hot Module Replacement",
    }),
  ],
  // 配置 devServer 属性，启动 HMR
  devServer: {
    contentBase: "./dist",
    hot: true,
    writeToDisk: true,
  },
```

按照上述配置，使用命令 `webpack serve --hot-only` 启动 Webpack，就可以在 dist 文件夹找到产物：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

相比于前面两个示例，HMR 所产生运行时代码达到 1.5w+ 行，简直可以用炸裂来形容。主要的运行时内容有：

- 支持 HMR 所需要用到的 `webpack-dev-server` 、`webpack/hot/xxx` 、`querystring` 等框架，这一部分占了大部分代码
- `__webpack_require__.l` ：与异步模块加载一样，基于 JSONP 实现的异步模块加载函数
- `__webpack_require__.e` ：与异步模块加载一样
- `__webpack_require__.f` ：与异步模块加载一样
- `__webpack_require__.hmrF`：用于拼接热更新模块 url 的函数
- `webpack/runtime/hot` ：这不是单个对象或函数，而是包含了一堆实现模块替换的方法

可以看到， HMR 运行时是上面异步模块加载运行时的超集，而异步模块加载的运行时又是第一个基本示例运行时的超集，层层叠加。在 HMR 中包含了：

- 模块化能力
- 异步模块加载能力 —— 实现变更模块的异步加载
- 热替换能力 —— 用拉取到的新模块替换掉旧的模块，并触发热更新事件

内容过多，我们放到下次专门开一篇文章聊聊 HMR。

# 实现原理

仔细阅读上述三个示例，相信读者应该已经模模糊糊捕捉到一些重要规则：

- 除了业务代码外，bundle 中还必须包含**「运行时」**代码才能正常运行
- **「运行时的具体内容由业务代码，确切地说由业务代码所使用到的特性决定」**，例如使用到异步加载时需要打包 `__webpack_require__.e` 函数，那么这里面必然有一个运行时依赖收集的过程
- 开发者编写的业务代码会被包裹进恰当的运行时函数中，实现整体协调

落到 Webpack 源码实现上，运行时的生成逻辑可以划分为两个步骤：

1. **「依赖收集」**：遍历业务代码模块收集模块的特性依赖，从而确定整个项目对 Webpack runtime 的依赖列表
2. **「生成」**：合并 runtime 的依赖列表，打包到最终输出的 bundle

两个步骤都发生在打包阶段，即 Webpack(v5) 源码的 `compilation.seal` 函数中：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

> 上图是我总结的 Webpack 知识图谱的一部分，可关注公众号【Tecvan】 回复【1】获取线上地址

注意上图，进入 runtime 处理环节时 Webpack 已经解析得出 `ModuleDependencyGraph` 及 `ChunkGraph` 关系，也就意味着此时已经可以计算出：

- 需要输出那些 `chunk`
- 每个 `chunk` 包含那些 `module`，以及每个 `module` 的内容
- `chunk` 与 `chunk` 之间的父子依赖关系

> 对 bundle、module、chunk 关系这几个概念还不太清晰的同学，建议扩展阅读：
>
> - [[万字总结\] 一文吃透 Webpack 核心原理](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483744&idx=1&sn=d7128a76eed20746cd8c5100f0899138&scene=21#wechat_redirect)
> - [有点难的 webpack 知识点：Dependency Graph 深度解析](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483743&idx=1&sn=0ce0845ee3e5316bcac05993035de3ed&scene=21#wechat_redirect)
> - [有点难的 webpack 知识点：Chunk 分包规则详解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484029&idx=1&sn=7862737524e799c5eaf1605325171e32&scene=21#wechat_redirect)

基于这些信息，接下来首先需要收集运行时依赖。

## 依赖收集

Webpack runtime 的依赖概念上很像 Vue 的依赖，都是用来表达模块对其它模块存在依附关系，只是实现方法上 Vue 基于动态、在运行过程中收集，而 Webpack 则基于静态代码分析的方式收集依赖。实现逻辑大致为：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

运行时依赖的计算逻辑集中在 `compilation.processRuntimeRequirements` 函数，代码上包含三次循环：

- 第一次循环遍历所有 `module`，收集所有 `module` 的 runtime 依赖
- 第二次循环遍历所有 `chunk`，将 `chunk` 下所有 `module` 的 runtime 统一收录到 `chunk` 中
- 第三次循环遍历所有 runtime chunk，收集其对应的子 `chunk` 下所有 runtime 依赖，之后遍历所有依赖并发布 `runtimeRequirementInTree` 钩子，(主要是) `RuntimePlugin` 插件订阅该钩子并根据依赖类型创建对应的 `RuntimeModule` 子类实例

下面我们展开聊聊细节。

### 第一次循环：收集模块依赖

在打包(seal)阶段，完成 `ChunkGraph` 的构建之后，Webpack 会紧接着调用 `codeGeneration` 函数遍历 `module` 数组，调用它们的 `module.codeGeneration` 函数执行模块转译，模块转译结果如：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

其中，sources 属性为模块经过转译后的结果；而 `runtimeRequirements` 则是基于 AST 计算出来的，为运行该模块时所需要用到的运行时，计算过程与本文主题无关，挖个坑下一回我们再继续讲。

所有模块转译完毕后，开始调用 `compilation.processRuntimeRequirements` 进入第一重循环，将上述转译结果的 `runtimeRequirements` 记录到 `ChunkGraph` 对象中。

### 第二次循环：整合 chunk 依赖

第一次循环针对 `module` 收集依赖，第二次循环则遍历 `chunk` 数组，收集将其对应所有 `module` 的 runtime 依赖，例如：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

示例图中，`module a` 包含两个运行时依赖；`module b` 包含一个运行时依赖，则经过第二次循环整合后，对应的 `chunk` 会包含两个模块对应的三个运行时依赖。

### 第三次循环：依赖标识转 RuntimeModule 对象

源码中，第三次循环的代码最少但逻辑最复杂，大致上执行三个操作：

- 遍历所有 runtime chunk，收集其所有子 `chunk` 的 runtime 依赖
- 为该 runtime chunk 下的所有依赖发布 `runtimeRequirementInTree` 钩子
- `RuntimePlugin` 监听钩子，并根据 runtime 依赖的标识信息创建对应的 `RuntimeModule` 子类对象，并将对象加入到 `ModuleDepedencyGraph` 和 `ChunkGraph` 体系中管理

至此，runtime 依赖完成了从 `module` 内容解析，到收集，到创建依赖对应的 `Module`子类，再将 `Module` 加入到 `ModuleDepedencyGraph` /`ChunkGraph` 体系的全流程，业务代码及运行时代码对应的模块依赖关系图完全 ready，可以准备进入下一阶段 —— 生成最终产物。

但在继续讲解产物逻辑之前，我们有必要先解决两个问题：

- 何谓 runtime chunk？与普通 `chunk` 是什么关系
- 何谓 `RuntimeModule`？与普通 `Module` 有什么区别

### 总结：Chunk 与 Runtime Chunk

在上一篇文章 [有点难的 webpack 知识点：Chunk 分包规则详解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484029&idx=1&sn=7862737524e799c5eaf1605325171e32&scene=21#wechat_redirect) 我尝试完整地讲解 Webpack 默认分包规则，回顾一下在三种特定的情况下，Webpack 会创建新的 `chunk`：

- 每个 entry 项都会对应生成一个 `chunk` 对象，称之为 `initial chunk`
- 每个异步模块都会对应生成一个 `chunk` 对象，称之为 `async chunk`
- Webpack 5 之后，如果 entry 配置中包含 runtime 值，则在 entry 之外再增加一个专门容纳 runtime 的 chunk 对象，此时可以称之为 runtime chunk

默认情况下 `initial chunk` 通常包含运行该 entry 所需要的所有 runtime 代码，但 webpack 5 之后出现的第三条规则打破了这一限制，允许开发者将 runtime 从 `initial chunk` 中剥离出来独立为一个多 entry 间可共享的 `runtime chunk`。

类似的，异步模块对应 runtime 代码大部分都被包含在对应的引用者身上，比如说：

```
// a.js
export default 'a-module'

// index.js
// 异步引入 a 模块
import('./a').then(console.log)
```

在这个示例中，index 异步引入 a 模块，那么按默认分配规则会产生两个 `chunk`：入口文件 index 对应的 `initial chunk`、异步模块 a 对应的 `async chunk`。此时从 `ChunkGraph` 的角度看 `chunk[index]` 为 `chunk[a]` 的父级，运行时代码会被打入 `chunk[index]`，站在浏览器的角度，运行 `chunk[a]` 之前必须先运行 `chunk[index]`，两者形成明显的父子关系。

### 总结：RuntimeModule 体系

在最开始阅读 Webpack 源码的时候，我就觉得很奇怪，`Module` 是 Webpack 资源管理的基本单位，但 `Module` 底下总共衍生出了 54 个子类，且大部分为 `Module => RuntimeModule => xxxRuntimeModule` 的继承关系：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

在 [有点难的 webpack 知识点：Dependency Graph 深度解析](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483743&idx=1&sn=0ce0845ee3e5316bcac05993035de3ed&scene=21#wechat_redirect) 一文中我们聊到模块依赖关系图的生成过程及作用，但文章的内容主要围绕业务代码展开，用到的大多是 `NormalModule` 。到 `seal` 函数收集运行时的过程中，`RuntimePlugin` 还会为运行时依赖一一创建对应的 `RuntimeModule` 子类，例如：

- 模块化实现中依赖 `__webpack_require__.r` ，则对应创建 `MakeNamespaceObjectRuntimeModule` 对象
- ESM 依赖 `__webpack_require__.o` ，则对应创建 `HasOwnPropertyRuntimeModule` 对象
- 异步模块加载依赖 `__webpack_require__.e`，则对应创建 `EnsureChunkRuntimeModule` 对象
- 等等

所以可以推导出所有 `RuntimeModule` 结尾的类型与特定的运行时功能一一对应，收集依赖的结果就是在业务代码之外创建出一堆支撑性质的 `RuntimeModule` 子类，这些子类对象随后被加入 `ModuleDependencyGraph` ，并入整个模块依赖体系中。

## 资源合并生成

经过上面的运行时依赖收集过程后，bundle 所需要的所有内容都就绪了，接着就可以准备写出到文件中，即下图核心流程中的生成(emit)阶段：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

我的另一篇 [[万字总结\] 一文吃透 Webpack 核心原理](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483744&idx=1&sn=d7128a76eed20746cd8c5100f0899138&scene=21#wechat_redirect) 对这一块有比较细致的讲解，这里从运行时的视角再简单聊一下代码流程：

- 调用 `compilation.createChunkAssets` ，遍历 `chunks` 将 chunk 对应的所有 `module`，包括业务模块、运行时模块全部合并成一个资源(`Source` 子类)对象
- 调用 `compilation.emitAsset` 将资源对象挂载到 `compilation.assets` 属性中
- 调用 `compiler.emitAssets` 将 assets 全部写到 FileSystem
- 发布 `compiler.hooks.done` 钩子
- 运行结束

# 挖坑

Webpack 真的很复杂，每次信心满满写出一个主题的内容之后都会发现更多新的坑点，比如本文可以衍生出来的关注点：

- 除了 NormalModule 与 RuntimeModule 体系外，其他的 Module 子类分别起什么作用？
- 单个 Module 的内容转译过程是怎么样的？在这个过程中具体是怎么计算出 runtime 依赖的？
- 除了记录 module、chunk 的 runtimeRequirements 之外，ChunkGraph 还起什么作用？

慢慢挖坑，慢慢填坑吧。如果觉得文章有用，请务必点赞关注转发来一波。

> 往期文章
>
> - [[万字总结\] 一文吃透 Webpack 核心原理](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483744&idx=1&sn=d7128a76eed20746cd8c5100f0899138&scene=21#wechat_redirect)
> - [[源码解读\] Webpack 插件架构深度讲解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483941&idx=1&sn=ce7597dfc8784e66d3c58f0e8df51f6b&scene=21#wechat_redirect)
> - [十分钟精进 Webpack：module.issuer 属性详解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483956&idx=1&sn=a2066fcc76cd97de88a6d6cb397e6c2a&scene=21#wechat_redirect)
> - [有点难的 webpack 知识点：Dependency Graph 深度解析](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483743&idx=1&sn=0ce0845ee3e5316bcac05993035de3ed&scene=21#wechat_redirect)
> - [有点难的知识点：Webpack Chunk 分包规则详解](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484029&idx=1&sn=7862737524e799c5eaf1605325171e32&scene=21#wechat_redirect)
> - [分享几个 Webpack 实用分析工具](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484005&idx=1&sn=ae3e478259a50c54e0282b2efbc28c3f&scene=21#wechat_redirect)
> - [建议收藏] Webpack 4+ 优秀学习资料合集