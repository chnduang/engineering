# Webpack 下的 HMR 机制原理: 120 行代码帮你搞定

> [https://mp.weixin.qq.com/s/_z6IOfrjAF0yPq2YuJAe4w](https://mp.weixin.qq.com/s/_z6IOfrjAF0yPq2YuJAe4w)

大家好，我是山月，今天分享一篇微医前端团队的 HMR 原理分析

**「目录」**

- `1. HMR 的背景`

- `2. HMR 简单概念`

- `3. HMR 流程概览`

- `4. HMR 入门体验`

- `5. HMR 中的 Server 和 Client`

- - `5.1. devServer 通知浏览器文件变更`
  - `5.2. Client 接收到服务端消息做出响应`
  - `5.3. reload 策略选择`
  - `5.4. webpack 根据 hash 请求最新模块代码`
  - `5.5. HMR Runtime 对模块进行热更新`

- `6. HMR 中的 hot 成员`

- - `6.1. HotModuleReplaceMentPlugin`
  - `6.2. module.hot.accept 原理`
  - `6.3. 实现 JS 模块替换`

## 1. HMR 的背景

在使用`Webpack Dev Server`以后 可以让我们在开发工程中 专注于 Coding， 因为它可以监听代码的变化 从而实现打包更新，并且最后通过自动刷新的方式同步到浏览器，便于我们及时查看效果。但是 Dev Server 从监听到打包再到通知`浏览器整体刷新页面`就会导致一个让人困扰的问题 那就是 `无法保存应用状态` 因此 针对这个问题，Webpack 提供了一个新的解决方案 `Hot Module Replacement`

## 2. HMR 简单概念

Hot Module Replacement 是指当我们对代码修改并保存后，Webpack 将会对代码进行重新打包，并将新的模块发送到浏览器端，浏览器用新的模块替换掉旧的模块，以实现在不刷新浏览器的前提下更新页面。最明显的优势就是相对于传统的`live reload`而言，HMR 并不会丢失应用的状态，提高开发效率。在开始深入了解 Webpack HMR 之前 我们可以先简单过一下下面这张流程图

## 3. HMR 流程概览

![图片](https://mmbiz.qpic.cn/mmbiz_png/WOeOmUjdHrv8QHktqrkwXl8rs6msCy29zA2Rw61MWm7LPqkrVbIKxBexVX0dJpXm5MXaTBh8bhLhXONtSnRglw/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)1597240262452-5ecbaec0-6245-4ed5-9195-59c7a38e8b24.png

1. Webpack Compile: watch 打包本地文件 写入内存
2. Boundle Server: 启一个本地服务，提供文件在浏览器端进行访问
3. HMR Server: 将热更新的文件输出给 HMR Runtime
4. HMR Runtime: 生成的文件，注入至浏览器内存
5. Bundle: 构建输出文件

## 4. HMR 入门体验

开启 HMR 其实也极其容易 因为 HMR 本身就已经集成在了 Webpack 里 开启方式有两种

1. 直接通过运行 webpack-dev-server 命令时 加入 `--hot`参数 直接开启 HMR
2. 写入配置文件 代码如下

```
// ./webpack.config.js
const webpack = require('webpack')
module.exports = {
  // ...
  devServer: {
    // 开启 HMR 特性 如果不支持 MMR 则会 fallback 到 live reload
    hot: true,
  },
  plugins: [
    // ...
    // HMR 依赖的插件
    new webpack.HotModuleReplacementPlugin()
  ]
}
```

## 5. HMR 中的 Server 和 Client

### 5.1. devServer 通知浏览器文件变更

通过翻阅 webpack-dev-server**源码** 在这一过程中，依赖于**sockjs**提供的服务端与浏览器端之间的桥梁，在 devServer 启动的同时，建立了一个 webSocket 长链接，用于通知浏览器在 webpack 编译和打包下的各个状态，同时监听 compile 下的 done 事件，当 compile 完成以后，通过 sendStats 方法, 将重新编译打包好的新模块 hash 值发送给浏览器。

长按识别二维码查看原文

标题：源码

![图片](https://mmbiz.qpic.cn/mmbiz_png/WOeOmUjdHrv8QHktqrkwXl8rs6msCy29UQlUzfgP4kicGQF4PsEhlYnw8lJcJ97ibicyoHzicgIaiaSl3C77LUR0d6w/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)   

长按识别二维码查看原文

标题：sockjs

![图片](https://mmbiz.qpic.cn/mmbiz_png/WOeOmUjdHrv8QHktqrkwXl8rs6msCy29FfeACdVVZicCNLFVO4JwH0lhjA8zQjRDkK3XwGhnpQvZwv9icjS68vUg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)   

```
// webpack-dev-server/blob/master/lib/Server.js
sendStats(sockets, stats, force) {
    const shouldEmit =
      !force &&
      stats &&
      (!stats.errors || stats.errors.length === 0) &&
      (!stats.warnings || stats.warnings.length === 0) &&
      stats.assets &&
      stats.assets.every((asset) => !asset.emitted);

    if (shouldEmit) {
      this.sockWrite(sockets, 'still-ok');

      return;
    }

    this.sockWrite(sockets, 'hash', stats.hash);

    if (stats.errors.length > 0) {
      this.sockWrite(sockets, 'errors', stats.errors);
    } else if (stats.warnings.length > 0) {
      this.sockWrite(sockets, 'warnings', stats.warnings);
    } else {
      this.sockWrite(sockets, 'ok');
    }
  }
```

### 5.2. 「Client 接收到服务端消息做出响应」

webpack-dev-server/client 当接收到 type 为 hash 消息后会将 hash 值暂时缓存起来，同时当接收到到 type 为 ok 的时候，对浏览器执行 reload 操作。![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

### 5.3. reload 策略选择

```
function reloadApp(
  { hotReload, hot, liveReload },
  { isUnloading, currentHash }
) {
  if (isUnloading || !hotReload) {
    return;
  }

  if (hot) {
    log.info('App hot update...');

    const hotEmitter = require('webpack/hot/emitter');

    hotEmitter.emit('webpackHotUpdate', currentHash);

    if (typeof self !== 'undefined' && self.window) {
      // broadcast update to window
      self.postMessage(`webpackHotUpdate${currentHash}`, '*');
    }
  }
  // allow refreshing the page only if liveReload isn't disabled
  else if (liveReload) {
    let rootWindow = self;

    // use parent window for reload (in case we're in an iframe with no valid src)
    const intervalId = self.setInterval(() => {
      if (rootWindow.location.protocol !== 'about:') {
        // reload immediately if protocol is valid
        applyReload(rootWindow, intervalId);
      } else {
        rootWindow = rootWindow.parent;

        if (rootWindow.parent === rootWindow) {
          // if parent equals current window we've reached the root which would continue forever, so trigger a reload anyways
          applyReload(rootWindow, intervalId);
        }
      }
    });
  }

  function applyReload(rootWindow, intervalId) {
    clearInterval(intervalId);

    log.info('App updated. Reloading...');

    rootWindow.location.reload();
  }
```

通过翻阅 webpack-dev-server/client**源码**，我们可以看到，首先会根据 hot 配置决定是采用哪种更新策略，刷新浏览器或者代码进行热更新（HMR），如果配置了 HMR，就调用 `webpack/hot/emitter` 将最新 hash 值发送给 webpack，如果没有配置模块热更新，就直接调用 `applyReload`下的`location.reload` 方法刷新页面。

长按识别二维码查看原文

标题：源码

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)   

### 5.4. webpack 根据 hash 请求最新模块代码

在这一步，其实是 webpack 中三个模块（三个文件，后面英文名对应文件路径）之间配合的结果，首先是 `webpack/hot/dev-server`（以下简称 dev-server） 监听第三步 `webpack-dev-server/client` 发送的 `webpackHotUpdate` 消息，调用 `webpack/lib/HotModuleReplacement.runtime`（简称 HMR runtime）中的 check 方法，检测是否有新的更新，在 check 过程中会利用 `webpack/lib/JsonpMainTemplate.runtime`（简称 jsonp runtime）中的两个方法 `hotDownloadUpdateChunk` 和 `hotDownloadManifest`， 第二个方法是调用 AJAX 向服务端请求是否有更新的文件，如果有将发更新的文件列表返回浏览器端，而第一个方法是通过 jsonp 请求最新的模块代码，然后将代码返回给 HMR runtime，HMR runtime 会根据返回的新模块代码做进一步处理，可能是刷新页面，也可能是对模块进行热更新。

在这个过程中，其实是 webpack 三个模块配合执行之后获取的结果

1. `webpack/hot/dev-server`监听 client 发送的`webpackHotUpdate`消息

```
// ....
var hotEmitter = require("./emitter");
	hotEmitter.on("webpackHotUpdate", function (currentHash) {
		lastHash = currentHash;
		if (!upToDate() && module.hot.status() === "idle") {
			log("info", "[HMR] Checking for updates on the server...");
			check();
		}
	});
	log("info", "[HMR] Waiting for update signal from WDS...");
} else {
	throw new Error("[HMR] Hot Module Replacement is disabled.");
```

1. **HMR runtime/check()** 检测是否有新的更新，check 过程中会利用**webpack/lib/web/JsonpMainTemplate.runtime.js**中的`hotDownloadUpdateChunk`（通过 jsonp 请求新的模块代码并且返回给 HMR Runtime）以及`hotDownloadManifest`(发送 AJAx 请求向 Server 请求是否有更新的文件，如果有则会将新的文件返回给浏览器)

   长按识别二维码查看原文

   标题：HMR runtime/check()

   ![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)   

   长按识别二维码查看原文

   标题：webpack/lib/web/JsonpMainTemplate.runtime.js

   ![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)   

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)企业微信 20210524-162204.png

### 5.5. HMR Runtime 对模块进行热更新

这里就是整个 HMR 最关键的步骤了，而其中 最关键的 无非就是**hotApply**这个方法了，由于代码量实在太多，这里我们直接进入过程解析(关键代码)，有兴趣的同学可以阅读一下源码。

长按识别二维码查看原文

标题：hotApply

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)   

1. 找出 `outdatedModules` 和 `outdatedDependencies`
2. 删除过期的模块以及对应依赖

```
// remove module from cache
delete installedModules[moduleId];

// when disposing there is no need to call dispose handler
delete outdatedDependencies[moduleId];
```

1. 新模块添加至 modules 中

```
for(moduleId in appliedUpdate) {
  if(Object.prototype.hasOwnProperty.call(appliedUpdate, moduleId)) {
      modules[moduleId] = appliedUpdate[moduleId];
  }
}
```

至此 一整个模块替换的流程已经结束了，已经可以获取到最新的模块代码了，接下来就轮到业务代码如何知晓模块已经发生了变化～

## 6. HMR 中的 hot 成员

### 6.1. HotModuleReplaceMentPlugin

由于我们编写的 JavaScript 代码是没有任何规律可言的模块，可以导出的是一个模块、函数、甚至于只是一个字符串 而对于这些毫无规律可言的模块来说 Webpack 是无法提供一个通用的模块替换方案去处理的 因此在这种情况下，还想要体验完整的 HMR 开发流程 是需要我们自己手动处理 当 JS 模块更新以后，如何将更新以后的 JS 模块替换至页面当中 因此 HotModuleReplacementPlugin 为我们提供了一系列关于 HMR 的 API 而其中 最关键的部分则是`hot.accept`。

接下来 我们将尝试 自己手动处理 JS 模块更新 并通知到浏览器实现对应的局部刷新

> info 当前主流开发框架 Vue、React 都提供了统一的模块替换函数， 因此 Vue、React 项目并不需要针对 HMR 做手动的代码处理，同时 css 文件也由 style-loader 统一处理 因此也不需要额外的处理，因此接下去的代码处理逻辑，全部建立在纯原生开发的基础之上实现

回到代码中来 假设当前 main.js 文件如下

```
// ./src/main.js
import createChild from './child'

const child = createChild()
document.body.appendChild(child)
```

main.js 是 Webpack 打包的入口文件 在文件中引入了 Child 模块 因此 当 Child 模块里的业务代码更改以后 webpack 必然会重新打包，并且重新使用这些更新以后的模块，所以，我们需要在 main.js 里实现去处理它所依赖的这些模块更新后的热替换逻辑

在 HMR 已开启的情况下，我们可以通过访问全局的`module`对象下的`hot 成员`它提供了一个`accept 方法`，这个方法用来注册当某个模块更新以后需要如何处理，它接受两个参数 一个是需要监听模块的 path(相对路径)，第二个参数就是当模块更新以后如何处理 其实也就是一个回调函数

```
// main.js
// 监听 child 模块变化
module.hot.accept('./child', () => {
  console.log('老板好，child 模块更新啦～')
})
```

当做完这些以后，重新运行 npm run serve 同时修改 child 模块 你会发现，控制台会输出以上的 console 内容，同时，浏览器也不会自动更新了，因此，我们可以得出一个结论 当你手动处理了某个模块的更新以后，是不会出发自动刷新机制的，接下来 就来一起看看 其中的原理 以及 如何实现 HMR 中的 JS 模块替换逻辑

### 6.2. module.hot.accept 原理

为什么我们只有调用了`moudule.hot.accept`才可以实现热更新, 翻看**源码** 其实可以发现实现如下

长按识别二维码查看原文

标题：源码

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)   

```
// 部分源码
accept: function (dep, callback, errorHandler) {
				if (dep === undefined) hot._selfAccepted = true;
				else if (typeof dep === "function") hot._selfAccepted = dep;
				else if (typeof dep === "object" && dep !== null) {
					for (var i = 0; i < dep.length; i++) {
						hot._acceptedDependencies[dep[i]] = callback || function () {};
						hot._acceptedErrorHandlers[dep[i]] = errorHandler;
					}
				} else {
					hot._acceptedDependencies[dep] = callback || function () {};
					hot._acceptedErrorHandlers[dep] = errorHandler;
				}
			},
// module.hot.accept 其实等价于 module.hot._acceptedDependencies('./child) = render
// 业务逻辑实现
module.hot.accept('./child', () => {
  console.log('老板好，child 模块更新啦～')
})
```

accept 往`hot._acceptedDependencies`这个对象里存入局部更新的 callback， 当模块改变时，对模块需要做的变更，搜集到`_acceptedDependencies`中，同时当被监听的模块内容发生了改变以后，父模块可以通过`_acceptedDependencies`知道哪些内容发生了变化。

### 6.3. 实现 JS 模块替换

当了解了 accpet 方法以后，其实我们要考虑的事情就非常简单了，也就是如何实现 cb 里的业务逻辑，其实当 accept 方法执行了以后，在其回调里是可以获取到最新的被修改了以后的模块的函数内容的

```
// ./src/main.js
import createChild from './child'

console.log(createChild) // 未更新前的函数内容
module.hot.accept('./child', ()=> {
	console.log(createChild) // 此时已经可以获取更新以后的函数内容
})
```

既然是可以获取到最新的函数内容 其实也就很简单了 我们只需要移除之前的 dom 节点 并替换为最新的 dom 节点即可，同时我们也需要记录节点里的内容状态，当节点替换为最新的节点以后，追加更新原本的内容状态

```
// ./src/main.js
import createChild from './child'

const child = createChild()
document.body.appendChild(child)

// 这里需要额外注意的是,child 变量每一次都会被移除，所以其实我们一个记录一下每次被修改前的 child
let lastChild = child
module.hot.accept('./child', ()=> {
  // 记录状态
  const value = lastChild.innerHTML
  // 删除节点
	document.body.remove(child)
  // 创建最新节点
  lastChild = createChild()
  // 恢复状态
  lastChild.innerHTMl = value
  // 追加内容
  document.body.appendChild(lastChild)
})
```

到这里为止，对于如何手动实现一个 child 模块的热更新替换逻辑已经全部实现完毕了，有兴趣的同学可以自己也手动实现一下～

> 手动处理 HMR 逻辑过程中 如果 HMR 过程中出现报错 导致的 HRM 失效，其实只需要在配置文件中将`hot: true 修改为 hotOnly: true` 即可

