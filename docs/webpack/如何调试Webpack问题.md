# 我是如何调试 Webpack 问题的

> [https://mp.weixin.qq.com/s/RExi2XnpstChIPIjhhmXhw](https://mp.weixin.qq.com/s/RExi2XnpstChIPIjhhmXhw)

事情是这样的，前两天有个小伙伴问我：**「为啥我的 webpack 运行完看不到我写的页面，而是：」**

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmF9DetOBKop4lY1XFqXmNU0HSgfictkEBql67xODs7DVwE5wibtjD0SZw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

嗯？文件列表页？好吧，这种情况我似乎没遇到过，一下子没法给出答案，只能要来关键代码：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmlljxZma6J9EbJAoYMaUqibYvDdQ4WoJdukJiaic9SUGGNAibLuUlu598ng/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

重点看看 `webpack.config.js` 配置，用到 `devServer + HMR` 功能，其中：

- Webpack 版本为 5.37.0
- webpack-dev-server 版本为 3.11.2

看了半天，没问题呀，给了几个纸糊的建议还是解决不了问题，刚好在开会这事就暂且放下了。过了一会，小伙伴兴冲冲跑过来跟我说经过一番盲猜，问题被解决了：

- `output.publicPath = '/'` 时一切正常
- `output.publicPath = './'` 时出错，返回文件列表页

啊？这玩意还会影响 `devServer` 的效果，直觉告诉我不应该啊。

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmQVcticlYRiaGPGib5pvCh7cOiaca5ibF9kUI8uXXmKA8ggGYtWcdLArHpRA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

emmm，成功勾起我的好奇心了，虽然写过一些 Webpack 源码分析的文章，但 `webpack-dev-server` 确实不在我的知识范围，好在我有秘籍《[如何阅读源码 —— 以 Vetur 为例](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484501&idx=1&sn=0d8abed19ae67c3fade6dc44c02987db&scene=21#wechat_redirect)》，是时候展示真正的技术了！

# 第一步：定义问题

先复盘一下问题发生的过程：

- `webpack.config.js` 同时配置了 `ouput.publicPath` 与 `devServer`
- 运行 `npx webpack serve` 启动开发服务器
- 浏览器访问 `http://localhost:9000` 没有按预期返回用户代码，而是返回了文件列表页面；但如果恢复 `output.publicPath` 的默认配置，一切如常

讲道理， `ouput.publicPath` 应该只是影响了最终产物引用的路径，试试命令行工具运行 `curl` 检测首页返回的内容：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZma5Fq6iaViaHYhxQXf7Y39tgFLkjanDo4OWGCtsFmMGnicAeQIUgD3sPLg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> Tips：有时候可以试试绕过浏览器的复杂逻辑，用最简单的工具验证 http 请求返回的内容。

可以看到，请求 `http://localhost:9000` 地址返回一大串 html 代码，且页面的 title 为 `listing directory` —— 也就是我们看到的文件列表页面：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmF9DetOBKop4lY1XFqXmNU0HSgfictkEBql67xODs7DVwE5wibtjD0SZw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

虽然不知道这是在那一层生成的，但可以肯定绝对不是我写的，而且这是在 HTTP 层面发生的。

所以问题的核心就是：**「为何 Webpack 的 `output.publicPath` 会影响 `webpack-dev-server` 的运行效果」**？

# 第二步：回顾背景

带着问题我又 review 了一遍 Webpack 官方文档。

## `publicPath`配置

首先 `output.publicPath` 是这么描述的：

> ❝
>
> This is an important option when using on-demand-loading or loading external resources like images, files, etc. If an incorrect value is specified you'll receive 404 errors while loading these resources.
>
> ❞

大意就是，这是一个控制按需加载或资源文件加载的选项，如果对应的路径资源加载失败时会返回 404。

嗐，其实这段描述就非常不明所以了，简单理解 `output.publicPath` 会改变产物资源在 html 文件的路径，比如说 Webpack 编译完生成了 `bundle.js` 文件，默认情况下写到 html 的路径是：

```html
<script src="bundle.js" />
```

如果设置了 `output.publicPath` 值，就会在路径前增加前缀：

```html
<script src="${output.publicPath}/bundle.js" />
```

看起来很简单。

## `devServer`配置项

再来看看 `devServer` 配置：

> ❝
>
> This set of options is picked up by webpack-dev-server and can be used to change its behavior in various ways.
>
> ❞

大意就是，`devServer` 配置最终会被 `webpack-dev-server` 消费，而` webpack-dev-server` 提供了包括 HMR —— 模块热更新在内的 web 服务。

感受一下，包括` vue-cli、create-react-app `之类的脚手架工具底层都依赖于` webpack-dev-server `，它的作用和重要性就可想而知了吧。

# 第三步：分析问题

按照现有的情报，加上我对 HTTP 协议的理解，可以基本推断问题必然是出在` webpack-dev-server` 框架处理首页请求的逻辑上，大概率是 `output.publicPath` 属性影响到首页资源的判定逻辑，导致 `webpack-dev-server 找不到对应的资源文件，返回兜底的文件列表页面。

嗯，我觉得靠谱，那就沿着这个思路挖一挖源码，找到具体原因吧。

# 第四步：分析代码

## 结构分析

书上得来终须浅，debug 还需看源码啊，啥都别说了先打开` webpack-dev-server` 包的代码看看内容吧：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmeyic4bnLJpEnchPjBoaloibA3p20gX1jA8Qib482KY9yq1awM0R5ic70aA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> Tips: 读者也可以试试 clone webpack-dev-server 仓库的代码，有惊喜~~

项目结构并不复杂，按 Webpack 的习惯可以推断主要代码都在 `lib` 目录：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZm64QoibE1OHK5Chc3XWYSONKiajaQEqvUjnVAqJTAYmVb19Scib6Off7bA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> `cloc` 是一个非常好用的代码统计工具，官网：https://www.npmjs.com/package/cloc

代码量也就 2000 出头，还好还好。

接下来再打开 `package.json` 文件，看看有哪些 `dependency`，一个个捋过去之后，与我们的问题强相关的依赖有：

- `express`：应用不用多介绍了吧
- `webpack-dev-middleware`：这个应该大多数人没有注意过，从官网文档判断这是一个桥接` Webpack `编译过程与` express `的中间件
- `serve-index`：**「提供特定目录下文件列表页面的 express 中间件」**！！！

按照这个描述，这锅肯定出在 `serve-index` 的调用上啊，感觉离答案很近了。

## 局部分析

### 切入点：验证 `serve-index` 包的作用

经过上面的分析，虽然我还不知道问题具体出在哪里，但大致可以判定跟 `serve-index` 包强相关，先搜一下 webpack-dev-server 在哪些地方引用这个包：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmps7ic3hHkhZbJxhYhL9sNuKxFEZ1sZLa1eJiclDPl3B5KniaRsFBLRnpQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

很幸运，只在 `lib/Server.js` 文件中用到，那就简单多了，**「静态分析」**调用语句前后的语句，大致上可以推导出：

- `serveIndex` 调用被包裹在 `this.app.use` 内，推测 `this.app` 指向 express 示例，`use` 函数用于注册中间件，所以整个 `serveIndex` 就是一个中间件
- 除 `setupStaticServeIndexFeature` 外，`Server` 类型中还包含了其它命名为 `setupXXXFeature` 的函数，基本上都用于添加 express 中间件，这些中间件组合拼装出` webpack-dev-server` 提供的 `HMR、proxy、ssl` 等功能

也看不出别的啥了，先做个对照实验，运行起来**「动态分析」**代码的实际执行过程，验证到底是不是这个地方出错吧。先在 `serveIndex` 函数之前插入 `debugger` 语句，之后：

- 先按照正常情况，也就是 `output.publicPath = '/'` 执行 `ndb npx webpack serve`，结果是如常打开了页面，没有命中断点，没有中断
- 再按照 `ouput.publicPath = './'` 执行 `ndb npx webpack serve`，进入断点：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmSVFxCFEH1KEAG4TMuLfdTsriaGMaUdTRrrBlXmx9LuRz8jUXCU5vicyA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> Tips： ndb 是一个开箱即用的 node debugger 工具，不需要做任何配置就能调试 node 应用，非常方便

OK，答案揭晓了，在 `ouput.publicPath = './'` 场景下会命中这个中间件，执行 `serveIndex` 函数返回文件目录列表，这很 `make sense`。

不过，作为一个有追求的程序员怎么会止步于此呢，我们继续往下挖呀：到底是那一段代码决定了流程会不会进入 `serveIndex` 中间件？

### 切入点：确定 `serveIndex` 的上游中间件

思考一下，`express` 架构的特点就是 —— 基于中间件的洋葱模型，而中间件之间通过 `next` 函数调起下一个中间件。

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmISM18D5SsrRXwzlh7QdIcOFuMibgUzAnSVwTTibSYAAtN6kSuPRdbBwQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

嗯，有思路了，我们沿着 `webpack-dev-server `的 `middleware` 队列，找到 `serveIndex` 之前都有哪些中间件，分析这些中间件的代码应该就能解答：

> 到底是那一段代码决定了流程会不会进入 `serveIndex` 中间件？

但是，express 中间件架构下，从 `next` 调用到实际中间件函数隔着很远的调用链路，很难通过断点的调用堆栈判断出上一级中间件，以及更更上一级中间件在哪里啊：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmicGZUO8WJCCdV1ZZ2kHsgjhRPg4Yic6H9Wg2pz38v3Vhx7fsG0BWiabaw/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

这时候不能硬刚，得换一个技巧了 —— 找到创建 express 示例的代码，用魔法包裹住 `use`函数：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZma7JURLF9C2YCe0JIsYb1Z0R0CATPicQbJ2qw7gpWeTKAq2OtiadEyTHA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

> Tips: 这种技巧在某些复杂场景下特别有用，比如我在学习 Webpack 源码的时候，就经常配合 `Proxy` 类对 hook 植入 debugger 语句，追踪钩子被谁监听，在哪里被触发

通过这种重写函数，植入断点的方式，我们就能轻松追溯到` webpack-dev-server` 用到了哪些中间件，以及中间件注册的顺序：

```js
setupCompressFeature => 注册资源压缩中间件
setupMiddleware => 注册 webpack-dev-middleware 中间件
setupStaticFeature => 注册静态资源服务中间件
setupServeIndexFeature => 注册 serveIndex 中间件
```

可以看到，在当前 Webpack 配置下总共注册了这四个中间件函数，按照 express 的执行逻辑这四个中间件会按注册顺序从上往下执行，所以 `serveIndex` 函数的直接上游就是 `setupStaticFeature` 注册的静态资源服务中间件了。

继续看看 `setupStaticFeature` 函数的代码：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmXgPJGnbVQ8cUiaeWAyqkgmgXiaJW5ibx3ejbIaZzN8qKUUChCchX9nHVQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

这里只是调用标准化的 `[express.static](https://expressjs.com/en/starter/static-files.html)` 函数，注入静态资源服务功能，如果这个中间件运行的时候按路径找不到对应的文件资源，会调用下一个中间件继续处理请求，看起来跟我们的问题没啥关系。

继续往上，看看 `setupMiddleware` 函数：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmGpa2YecorheTDOzgfkzXAm5hAVqaUYq89YIr7qu5sL7yvnWtEzG7yA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

注册了 `webpack-dev-middleware`，从名字就可以看出这个中间件跟 `webpack-dev-server` 应该关系匪浅，那就继续打开 `webpack-dev-middleware` 看看里面的代码：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmJ9rRz48mel8TzMlIXq3u8Uns6kQ83hoYOSxZZFGjaEibSQWbOzBlvKQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

我去。。。也不少啊，这看起来太费劲了，我只是想找到这个 bug 的原因，没必要全看吧！那就直接搜关键词 `publicPath` 试试吧：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmJ9rRz48mel8TzMlIXq3u8Uns6kQ83hoYOSxZZFGjaEibSQWbOzBlvKQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

比较幸运，`publicPath` 关键字出现的频率还是比较少的：

- `webpack-dev-middleware/lib/middleware.js` 文件中被使用了 1 次
- `webpack-dev-middleware/lib/util.js` 文件中被使用了 23 次

那，就先挑软柿子捏，看看 `middleware.js` 文件中是怎么用的：

```js
const { getFilenameFromUrl } = require('./util');

module.exports = function wrapper(context) {
  return function middleware(req, res, next) {
    function goNext() {
      // ...
      resolve(next());
    }
    // ...
    let filename = getFilenameFromUrl(
      context.options.publicPath,
      context.compiler,
      req.url
    );

    if (filename === false) {
      return goNext();
    }

    return new Promise((resolve) => {
      handleRequest(context, filename, processRequest, req);
      // ...
    });
  };
};
```

注意代码中有一个逻辑，就是调用 `util` 文件的 `getFilenameFromUrl` 函数，并判断返回的 `filename` 值是否为 `false`，是的话调用 `next` 函数，这看起来很像那么回事了！

那就继续进去看看 `getFilenameFromUrl` 的代码：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZm8A6qgic5JJeR4tHtvo20EkWhScM6EDO8LYv2pWC4RpmfibysgZCzmpQA/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

逐行分析下来，注意看红框框出来这一句：

```js
if(xxx && url.indexOf(publicPath) !== 0){
  return false;
}
```

讲道理，从字面意义上这个 `url` 应该是客户端发过来的请求连接，`publicPath` 应该就是我们在 `webpack.config.js` 中配置的 `output.publicPath` 项的值了吧？运行起来看看：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmHOebocwSjYhPf02fSbl0zuiciaD9thfmq0JVF0xwu1ic6L3sYBhX34m7A/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

果然，断点进去之后可以看到这两个值确确实实符合前面的猜想，问题就出在这里，此时：

- `url = '/`'`
- `publicPath = output.publicPath = '/helloworld'`
- 所以 `url.indexOf(publicPath) === false` 实锤

`getFilenameFromUrl` 函数执行结果为 `false`，所以 `webpack-dev-middleware` 会直接调用 `next` 方法进入下一个中间件。

如果手动在默认打开的路径后加上 `output.publicPath` 的内容：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkv8oY68bkOJ8qHRDCeJBZmTYZqIic9YiaRCuict4XO5r5iboibSGnk2XIhbQfdZXdR1pKw3Ucicu6nAl4g/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

果然，它又行了。

# 第五步：总结

嗐，你看，这就是源码分析的过程，繁琐但不复杂，简直人人都能成为技术大牛啊。回顾一下代码的流程：

- `webpack-dev-server` 启动后会调用自动打开浏览器访问默认路径 `http://localhost:9000`
- 此时 `webpack-dev-server` 接收到默认路径请求，沿着 express 逻辑逐步走到 `webpack-dev-middleware` 中间件中
- `webpack-dev-middleware` 中间件内部呢，又继续调用 `webpack-dev-middleware/lib/util.js` 文件的 `getFilenameFromUrl` 方法
- `getFilenameFromUrl` 内部判断 `url.indexOf(publicPath)`
- 若 `getFilenameFromUrl` 返回 `false` 则 `webpack-dev-middleware` 直接调用 `next` ，流程进入下一个中间件 `express.static`
- `express.static` 尝试读取 `http://localhost:9000` 对应的资源文件，发现文件不存在，流程继续进入最后一个中间件 `serveIndex`
- `serveIndex` 返回产物目录结构界面，不符合开发者预期

归根结底，这里面的问题：

1. Webpack 官网关于 `output.publicPath` 的介绍只说了会影响 bundle 产物路径，没说会影响主页面的索引路径，开发者表示很 confuse 咯
2. `webpack-dev-server` 启动后，自动打开页面时没有在链接后面自动追加 `output.publicPath` 值导致默认打开的路径与真正的 index 首页不一致，而且还没返回 **「404」** 一类通用的错误提示，取而代之以一个不明所以的**「文件列表页」**，开发者很难迅速 get 到问题到底出在哪

到这里就把问题从表象，到原理，到最最根本的问题所在都挖出来了，以后可以跟其他同学说：

> 开发阶段，尽量避免配置 `output.publicPath` 项，否则会有惊喜哦~~

