## esbuild 为什么这么快?

# 前言

`esbuild` 是新一代的 JavaScript 打包工具。

`esbuild`以`速度快`而著称，耗时只有 webpack 的 2% ～3%。

`esbuild` 项目主要目标是: `开辟一个构建工具性能的新时代，创建一个易用的现代打包器`。

它的主要功能：

- `Extreme speed without needing a cache`
- `ES6 and CommonJS modules`
- `Tree shaking of ES6 modules`
- `An API for JavaScript and Go`
- `TypeScript and JSX syntax`
- `Source maps`
- `Minification`
- `Plugins`

现在很多工具都内置了它，比如我们熟知的:

- `vite`,
- `snowpack`

借助 esbuild 优异的性能， vite 更是如虎添翼， 快到飞起。

今天我们就来探索一下: 为什么 esbuild 这么快?

下文的主要内容：

- `几组性能数据对比`
- `为什么 esbuild 这么快`
- `esbuild upcoming roadmap`
- `esbuild 在 vite 中的运用`
- `为什么生产环境仍需打包?`
- `为何vite不用 esbuild 打包？`
- `总结`

# 正文

先看一组对比：

![图片](https://mmbiz.qpic.cn/mmbiz_png/pTwqLfWKewCv0ozo69wA6CibHdgUDTUe6oS948cPTtnBm3wLY2K4bQxzzqrrel7tIQ0ZEk4ia06tewlMh9y4fM1Q/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

使用 10 份 threeJS 的生产包，对比不同打包工具在默认配置下的打包速度。

webpack5 垫底， 耗时 `55.25`秒。

esbuild 仅耗时 `0.37` 秒。

差异巨大。

还有更多对比：

![图片](https://mmbiz.qpic.cn/mmbiz_png/pTwqLfWKewCv0ozo69wA6CibHdgUDTUe6gWXCNCZlkP23gva8vsgwP18IUGpblWNh6NfJLeHmxlPXwFFImIZibAA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)https://twitter.com/evanwallace/status/1314121407903617025

webpack5 表示很受伤: 我还比不过 webpack 4 ?

...

## 为什么 esbuild 这么快 ？

有以下几个原因。

(为了保证内容的准确性， 以下内容翻译自 esbuild 官网。)

### 1. 它是用 Go 语言编写的，并可以编译为本地代码。

大多数打包器都是用 JavaScript 编写的，但是对于 `JIT 编译`的语言来说，命令行应用程序拥有最差的性能表现。

每次运行打包器时，JavaScript VM 都会在没有任何优化提示的情况下看到打包程序的代码。

在 esbuild 忙于解析 JavaScript 时，node 忙于解析打包程序的JavaScript。

到节点完成解析打包程序代码的时间时，esbuild可能已经退出，您的打包程序甚至还没有开始打包。

另外，Go 是为`并行性`而设计的，而 JavaScript 不是。

Go在线程之间`共享内存`，而JavaScript必须在线程之间序列化数据。

Go 和 JavaScript都有`并行的垃圾收集器`，但是Go的堆在`所有线程`之间共享，而对于JavaScript, 每个JavaScript线程中都有一个`单独的堆`。

根据测试，这似乎将 JavaScript worker 线程的并行能力减少了一半，大概是因为一半CPU核心正忙于为另一半收集垃圾。

### 2. 大量使用了并行操作。

esbuild 中的`算法经过精心设计`，可以充分利用CPU资源。

大致分为三个阶段：

1. `解析`
2. `链接`
3. `代码生成`

`解析`和`代码生成`是大部分工作，并且可以`完全并行化`（链接在大多数情况下是固有的串行任务）。

由于所有线程`共享内存`，因此当捆绑导入同一JavaScript库的不同入口点时，可以轻松地共享工作。

大多数现代计算机具有`多内核`，因此并行性是一个巨大的胜利。

### 3. 代码都是自己写的， 没有使用第三方依赖。

自己编写所有内容, 而不是使用第三方库，可以带来很多性能优势。

可以从一开始就牢记性能，可以确保所有内容都使用一致的数据结构来避免昂贵的转换，并且可以在必要时进行广泛的体系结构更改。缺点当然是多了很多工作。

例如，许多捆绑程序都使用官方的TypeScript编译器作为解析器。

但是，它是为实现TypeScript编译器团队的目标而构建的，它们没有将性能作为头等大事。

### 4. 内存的高效利用。

理想情况下， 根据数据数据的长度， 编译器的复杂度为O(n).

如果要处理大量数据，内存访问速度可能会严重影响性能。

对数据进行的遍历次数越少（将数据转换成数据所需的不同表示形式也就越少），编译器就会越快。

例如，esbuild 仅触及整个JavaScript AST 3次：

1. 进行词法分析，解析，作用域设置和声明符号的过程
2. 绑定符号，最小化语法。比如：将 JSX / TS转换为 JS, ES Next 转换为 es5。
3. 最小标识符，最小空格，生成代码。

当 AST 数据在CPU缓存中仍然处于活跃状态时，会最大化AST数据的重用。

其他打包器在单独的过程中执行这些步骤，而不是将它们交织在一起。

它们也可以在数据表示之间进行转换，将多个库组织在一起(例如:字符串→TS→JS→字符串，然后字符串→JS→旧的JS→字符串，然后字符串→JS→minified JS→字符串)。

这样会占用更多内存，并且会减慢速度。

Go的另一个好处是它可以将内容紧凑地存储在内存中，从而使它可以使用更少的内存并在CPU缓存中容纳更多内容。

所有对象字段的类型和字段都紧密地包装在一起，例如几个布尔标志每个仅占用一个字节。

Go 还具有值语义，可以将一个对象直接嵌入到另一个对象中，因此它是'免费的'，无需另外分配。

JavaScript不具有这些功能，还具有其他缺点，例如 JIT 开销（例如隐藏的类插槽）和低效的表示形式（例如，非整数与指针堆分配）。

以上的每一条因素， 都能在一定程度上提高编译速度。

当它们共同工作时，效果比当今通常使用的其他打包器快几个数量级。

以上内容比较繁琐，对此，也有一些网友做了简要的总结:

- 它是用 `Go` 语言编写的，该语言可以编译为本地代码。而且 Go 的执行速度很快。一般来说，JS 的操作是`毫秒级`，而 Go 则是`纳秒级`。
- `解析`，生成最终打包文件和生成 source maps 的操作全部完全并行化
- `无需昂贵的数据转换`，只需很少的几步即可完成所有操作
- 该库`以提高编译速度为编写代码时的第一原则`，并尽量避免不必要的内存分配。

仅作参考。

## Upcoming roadmap

以下这几个 feature 已经在进行中了, 而且是第一优先级：

1. `Code splitting` (#16, docs)
2. `CSS content type` (#20, docs)
3. `Plugin API` (#111)

下面这几个 fearure 比较有潜力, 但是还不确定：

1. `HTML content type` (#31)
2. `Lowering to ES5` (#297)
3. `Bundling top-level await` (#253)

感兴趣的可以保持关注。

## esbuild 在 vite 中的运用

`vite` 中大量使用了 `esbuild`, 这里简单分享两点。

1. `optimizer`

![图片](https://mmbiz.qpic.cn/mmbiz_png/pTwqLfWKewCv0ozo69wA6CibHdgUDTUe6iciciaa0hwcic637YbPPYggWCDxZjByz6vhToNbclTme5OiaLuOBpibQ31eQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)https://github.com/vitejs/vite/blob/main/packages/vite/src/node/optimizer/index.ts#L262

```
import { build, BuildOptions as EsbuildBuildOptions } from 'esbuild'

// ...
const result = await build({
    entryPoints: Object.keys(flatIdDeps),
    bundle: true,
    format: 'esm',
    external: config.optimizeDeps?.exclude,
    logLevel: 'error',
    splitting: true,
    sourcemap: true,
    outdir: cacheDir,
    treeShaking: 'ignore-annotations',
    metafile: true,
    define,
    plugins: [
      ...plugins,
      esbuildDepPlugin(flatIdDeps, flatIdToExports, config)
    ],
    ...esbuildOptions
  })

  const meta = result.metafile!

  // the paths in `meta.outputs` are relative to `process.cwd()`
  const cacheDirOutputPath = path.relative(process.cwd(), cacheDir)

  for (const id in deps) {
    const entry = deps[id]
    data.optimized[id] = {
      file: normalizePath(path.resolve(cacheDir, flattenId(id) + '.js')),
      src: entry,
      needsInterop: needsInterop(
        id,
        idToExports[id],
        meta.outputs,
        cacheDirOutputPath
      )
    }
  }

  writeFile(dataPath, JSON.stringify(data, null, 2))
```

1. 处理 `.ts` 文件

![图片](https://mmbiz.qpic.cn/mmbiz_png/pTwqLfWKewCv0ozo69wA6CibHdgUDTUe6nofONBRUwLv1ib9XBSgP6DJtriboxXrZzbOXFTedKJ6nhtrEB105DO9Q/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)https://github.com/vitejs/vite/commit/59035546db7ff4b7020242ba994a5395aac92802

## `为什么生产环境仍需打包?`

尽管原生 `ESM` 现在得到了`广泛支持`，但由于嵌套导入会导致`额外的网络往返`，在生产环境中发布未打包的 ESM 仍然效率低下（即使使用 `HTTP/2`）。

为了在生产环境中获得`最佳的加载性能`，最好还是将代码进行 `tree-shaking`、`懒加载`和 `chunk 分割`（以获得更好的`缓存`）。

要确保`开发`服务器和`产品构建`之间的`最佳输出`和`行为`达到一致，并不容易。

为解决这个问题，Vite 附带了一套 `构建优化` 的 `构建命令`，开箱即用。

## `为何 vite 不用 esbuild 打包？`

虽然 `esbuild` 快得惊人，并且已经是一个在构建库方面比较出色的工具，但一些针对构建应用的重要功能仍然还在持续开发中 —— 特别是`代码分割`和 `CSS处理`方面。

就目前来说，`Rollup` 在应用打包方面, 更加成熟和灵活。

尽管如此，当未来这些功能稳定后，也不排除使用 esbuild 作为`生产构建器`的可能。

# 总结

esbuild 为构建提效带来了曙光， 而且 esm 的数量也在快速增加：

![图片](https://mmbiz.qpic.cn/mmbiz_png/pTwqLfWKewCv0ozo69wA6CibHdgUDTUe6kXJhebo42byTQ5icOUph6BIzYWF7sXyibqumjfLMX9Lw2PxKicx9NamMQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)https://twitter.com/skypackjs/status/1113838647487287296

希望 `esm` 生态尽快完善起来, 造福前端