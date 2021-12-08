# 分享几个 Webpack 实用分析工具

设想一个场景，假如需要提升 webpack 编译速度，或者优化编译产物大小，应该从何下手？别急，在采用具体手段前，可以先花点时间了解当前的编译执行情况，确定性能瓶颈，有的放矢！今天就给大家分享一些 webpack 构建过程的分析诊断方法和工具，基于这些工具，你可以：

- 了解编译产物由那些模块资源组成
- 了解模块之间的依赖关系
- 了解不同模块的编译构建速度
- 了解模块在最终产物的资源占比
- 等等

# 收集统计信息

Webpack 运行过程会收集各种统计信息，只需要在启动时附加 `--json` 参数即可获得：

```shell
npx webpack --json > stats.json
```

上述命令运行后，会在文件夹下输出 `stats.json` 文件，文件内容主要包含：

```json
{
  "hash": "2c0b66247db00e494ab8",
  "version": "5.36.1",
  "time": 81,
  "builtAt": 1620401092814,
  "publicPath": "",
  "outputPath": "/Users/tecvan/learn-webpack/hello-world/dist",
  "assetsByChunkName": { "main": ["index.js"] },
  "assets": [
    // ...
  ],
  "chunks": [
    // ...
  ],
  "modules": [
    // ...
  ],
  "entrypoints": {
    // ...
  },
  "namedChunkGroups": {
    // ...
  },
  "errors": [
    // ...
  ],
  "errorsCount": 0,
  "warnings": [
    // ...
  ],
  "warningsCount": 0,
  "children": [
    // ...
  ]
}
```

通常，分析构建性能时主要关注如下属性：

- **「assets」** ：编译最终输出的产物列表
- **「chunks」** ：构建过程生成的 chunks 列表，数组内容包含 chunk 名称、大小、依赖关系图
- **「modules」** ：本次运行触达的所有模块，数组内容包含模块的大小、所属chunk、分析耗时、构建原因等
- **「entrypoints」** ：entry 列表，包括动态引入所生产的 entry 项也会包含在这里面
- **「namedChunkGroups」** ：chunks 的命名版本，内容相比于 chunks 会更精简
- **「errors」** ：构建过程发生的所有错误信息
- **「warnings」** ：构建过程发生的所有警告信息

基于这些属性，我们可以分析出模块的依赖关系、模块占比、编译耗时等信息，不过这里大致了解原理就行了，社区已经为我们提供了非常多事半功倍的分析工具。

# 可视化分析工具

## Webpack Analysis

Webpack Analysis 是 webpack 官方提供的可视化分析工具，相比于其它工具，它提供的视图更全，功能更强大，使用上只需要将上一节 `webpack --json > stats.json` 命令生成的 `stats.json` 文件拖入页面，就可以获得一系列分析视图：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEj3C4ib5GkolCWR7wE8bACzOnMbo8k127WKLPByUhaMaoFASiaHdoGVMibA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

点击 **「modules/chunks/assets」** 按钮，页面会渲染出对应依赖关系图，例如点击 **「modules」**：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjVWnxOd2qT2aMcuI0NW5dTOOJ1QCsjEKBibxTIiaJZlribys1XPUdiby7MQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

除 **「modules/chunks/assets」** 外，右上方菜单栏 **「Hints」** 还可以查看构建过程各阶段、各模块的处理耗时，可以用于分析构建的性能瓶颈：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjYtbZtAGOXwD95wbn4MuPE0qxzzxMf3NMELVMUAAXt2aSGsMm8K5iaUg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> ❝
>
> 不过，实测发现 **「Hints」** 还不支持 webpack 5 版本的产出，等待官方更新吧。
>
> ❞

Webpack Analysis 提供了非常齐全的分析视角，信息几乎不失真，但这也意味着上手难度更高，信息噪音也更多，所以社区还提供了一个简化版 webpack-deps-tree，用法相似但用法更简单、信息更清晰，读者可以根据实际场景对比交叉使用。

## Webpack Visualizer

Webpack Visualizer 是一个在线分析工具，同样只需要将 `stats.json` 文件拖入页面，就可以从文件夹到模块逐层看到 `bundle` 的组成：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjnRa1ianF1uJQ2Ort7pSq2nbnAGYvLichxr7dXrbgNsCpgfurRbcpVczg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> ❝
>
> 除了在线版本外，Webpack Visualizer 还提供了插件版本的 webpack-visualizer-plugin 工具，但是这个插件年久失修，只兼容 webpack 1.x ，所以现在几乎没有使用价值了。
>
> ❞

此外，在线工具 Webpack Chart 也提供了类似的功能，功能重合度很高，这里就不展开讲了。

## Webpack Bundle Analyzer

> [https://www.npmjs.com/package/webpack-bundle-analyzer](https://www.npmjs.com/package/webpack-bundle-analyzer)

webpack-bundle-analyzer 是一个 webpack 插件，只需要简单的配置就可以在 webpack 运行结束后获得 treemap 形态的模块分布统计图，用户可以仔细对比 treemap 内容推断是否包含重复模块、不必要的模块等场景，例如：

```js
const BundleAnalyzerPlugin = require("webpack-bundle-analyzer")
  .BundleAnalyzerPlugin;

module.exports = {
  ...
  plugins: [new BundleAnalyzerPlugin()],
};
```

编译结束后，默认自动打开本地视图页面：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjwb3j6QRYhQibt2zM4ibHx0bzxljlvmUkMH4RNDtdoLKFBvtAtSeUKjvw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

此外，webpack-bundle-size-analyzer 也提供了类似，但是基于命令行视图的分析功能，可以基于 webpack-bundle-size-analyzer 做一些自动分析、自动预警功能。

## Webpack Dashboard

> [https://www.npmjs.com/package/webpack-dashboard](https://www.npmjs.com/package/webpack-dashboard)

webpack-dashboard 是一个命令行可视化工具，能够在编译过程中实时展示编译进度、模块分布、产物信息等，与 webpack-bundle-size-analyzer 类似，它也只需要一些简单的改造就能运行，首先需要注册插件：

```js
const DashboardPlugin = require("webpack-dashboard/plugin");

module.exports = {
  // ...
  plugins: [new DashboardPlugin()],
};
```

其次，修改 webpack 的启动方式，例如原来的启动命令可能是：

```js
"scripts": {
    "dev": "node index.js", # OR
    "dev": "webpack-dev-server", # OR
    "dev": "webpack",
}
```

需要修改为：

```js
"scripts": {
    "dev": "webpack-dashboard -- node index.js", # OR
    "dev": "webpack-dashboard -- webpack-dev-server", # OR
    "dev": "webpack-dashboard -- webpack",
}
```

之后，就可以在命令行看到一个漂亮的可视化界面：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjKlej5HMLkkqPjMfSnogt8HMeJLcALyqHBecbBMyicYdIZ2QwS0zhiakg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

## UnusedWebpackPlugin

最后分享 UnusedWebpackPlugin 插件，它能够根据 webpack 统计信息，反向查找出工程项目里那些文件没有被用到，我日常在各种项目重构工作中都会用到，非常实用。用法也比较简单：

```js
const UnusedWebpackPlugin = require("unused-webpack-plugin");

module.exports = {
  // ...
  plugins: [
    new UnusedWebpackPlugin({
      directories: [path.join(__dirname, "src")],
      root: path.join(__dirname, "../"),
    }),
  ],
};
```

示例中，directories 用于指定需要分析的文件目录；root 用于指定根路径，与输出有关。配置插件后，webpack 每次运行完毕都会输出 directories 目录中，有那些文件没有被用到：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eicibllFcPDbzWwlyje5ab5LdOEjpxAdfqUXq9QoEF4ILACZhEkAEpTiaYKXt3j4gHMwYic0gmoS43GOfGKw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

# 总结

工欲善其事，必先利其器！上面分享的工具都在解决相似的问题 —— 构建分析，只是具体的侧重点、用法、交互形态略有不同，读者可以结合实际场景，择优选用。