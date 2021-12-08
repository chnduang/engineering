# Vite 特性和部分源码解析

> [https://www.zoo.team/article/about-vite](https://www.zoo.team/article/about-vite)
>

### Vite 的特性

Vite 的主要特性就是 Bundleless。基于浏览器开始原生的支持 [JavaScript 模块功能](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules?fileGuid=DDr3GGh6QRvQgWQC)，JavaScript 模块依赖于 `import` 和 `export` 的特性，目前主流浏览器基本都支持；

想要查看具体支持的版本可以[点击这里](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Modules?fileGuid=DDr3GGh6QRvQgWQC)；

那这有什么优势呢？

#### 去掉打包步骤

打包是开发者利用打包工具将应用各个模块集合在一起形成 bundle，以一定规则读取模块的代码，以便在不支持模块化的浏览器里使用，并且可以减少 http 请求的数量。但其实在本地开发过程中打包反而增加了我们排查问题的难度，增加了响应时长，Vite 在本地开发命令中去除了打包步骤，从而缩短构建时长。

#### 按需加载

为了减少 bundle 大小，一般会想要按需加载，主要有两种方式：

1. 使用动态引入 `import()` 的方式异步的加载模块，被引入模块依然需要提前编译打包；
2. 使用 tree shaking 等方式尽力的去掉未引用的模块；

而 Vite 的方式更为直接，它只在某个模块被 import 的时候动态的加载它，实现了真正的按需加载，减少了加载文件的体积，缩短了时长；

#### Vite开发环境主体流程

下图是 Vite 在开发环境运行时加载文件的主体流程。

![img](https://zoo.team/images/upload/upload_c8f0296868a9922185d2748ffa1be9b6.png)

### Vite 部分源码解析

#### 总体目录结构

```javascript
|-CHANGELOG.md
|-LICENSE.md
|-README.md
|-bin
|  |-openChrome.applescript
|  |-vite.js
|-client.d.ts
|-package.json
|-rollup.config.js #打包配置文件
|-scripts
|  |-patchTypes.js
|-src
|  |-client #客户端
|  |  |-client.ts
|  |  |-env.ts
|  |  |-overlay.ts
|  |  |-tsconfig.json
|  |-node #服务端
|  |  |-build.ts
|  |  |-cli.ts #命令入口文件
|  |  |-config.ts
|  |  |-constants.ts #常量
|  |  |-importGlob.ts
|  |  |-index.ts
|  |  |-logger.ts
|  |  |-optimizer
|  |  |  |-esbuildDepPlugin.ts
|  |  |  |-index.ts
|  |  |  |-registerMissing.ts
|  |  |  |-scan.ts
|  |  |-plugin.ts #rollup 插件
|  |  |-plugins   #插件相关文件
|  |  |  |-asset.ts
|  |  |  |-clientInjections.ts
|  |  |  |-css.ts
|  |  |  |-esbuild.ts
|  |  |  |-html.ts
|  |  |  |-index.ts 
|  |  |  |-...
|  |  |-preview.ts
|  |  |-server
|  |  |  |-hmr.ts #热更新
|  |  |  |-http.ts
|  |  |  |-index.ts
|  |  |  |-middlewares #中间件
|  |  |  |  |-...
|  |  |  |-moduleGraph.ts #模块间关系组装(树形)
|  |  |  |-openBrowser.ts #打开浏览器
|  |  |  |-pluginContainer.ts
|  |  |  |-send.ts
|  |  |  |-sourcemap.ts
|  |  |  |-transformRequest.ts
|  |  |  |-ws.ts
|  |  |-ssr
|  |  |  |-__tests__
|  |  |  |  |-ssrTransform.spec.ts
|  |  |  |-ssrExternal.ts
|  |  |  |-ssrManifestPlugin.ts
|  |  |  |-ssrModuleLoader.ts
|  |  |  |-ssrStacktrace.ts
|  |  |  |-ssrTransform.ts
|  |  |-tsconfig.json
|  |  |-utils.ts
|-tsconfig.base.json
|-types
|  |-...                  
```

#### server 核心方法

从入口文件 cli.ts，可以看到三个命令对应了 3 个核心的文件&方法；

1. dev 命令

文件路径：./server/index.ts；

主要方法：createServer；

主要功能：项目的本地开发命令，基于 httpServer 启动服务，Vite 通过对请求路径的劫持获取资源的内容返回给浏览器，服务端将文件路径进行了重写。例如：

项目源码如下：

```javascript
import { createApp } from 'vue';
import App from './index.vue';
```

经服务端重写后，node_modules 文件夹下的三方包代码路径也会被拼接完整。

```javascript
import __vite__cjsImport0_vue from "/node_modules/.vite/vue.js?v=ed69bae0"; 
const createApp = __vite__cjsImport0_vue["createApp"];
import App from '/src/pages/back-sky/index.vue';
```

2.build 命令 文件路径：./build.ts ；

主要方法：build；

主要功能：使用 rollup 打包编译

3.optimize 命令

文件路径：./optimizer/index.ts；

主要方法：optimizeDeps；

主要功能：主要针对第三方包，Vite 在执行 runOptimize 的时候中会使用 rollup 对三方包重新编译，将编译成符合 esm 模块规范的新的包放入 node_modules 下的 .vite 中，然后配合 resolver 对三方包的导入进行处理：使用编译后的包内容代替原来包的内容，这样就解决了 Vite 中不能使用 cjs 包的问题。

下面是 .vite 文件夹中的 _metadata.json 文件，它在预编译的过程中生成，罗列了所有被预编译完成的文件及其路径。例如：

```javascript
{
  "hash": "31d458ff",
  "browserHash": "ed69bae0",
  "optimized": {
    "element-plus/lib/utils/dom": {
      "file": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/.vite/element-plus_lib_utils_dom.js",
      "src": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/element-plus/lib/utils/dom.js",
      "needsInterop": true
    },
    "element-plus": {
      "file": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/.vite/element-plus.js",
      "src": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/element-plus/lib/index.esm.js",
      "needsInterop": false
    },
    "vue": {
      "file": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/.vite/vue.js",
      "src": "/Users/zcy/Documents/workspace/back-sky-front/node_modules/vue/dist/vue.runtime.esm-bundler.js",
      "needsInterop": true
    },
    ......
    }
  }
}
```

#### 模块解析

[预构建](https://cn.vitejs.dev/guide/dep-pre-bundling.html?fileGuid=DDr3GGh6QRvQgWQC)是用来提升页面重载速度，它将 CommonJS、UMD 等转换为 ESM 格式。预构建这一步由 [esbuild](http://esbuild.github.io/?fileGuid=DDr3GGh6QRvQgWQC) 执行，这使得 Vite 的冷启动时间比任何基于 JavaScript 的打包程序都要快得多。

![img](https://zoo.team/images/upload/upload_203be43ea9d3500018696161b0ccabb6.png)

为什么 ESbuild 会更快？

1. 使用 Go 语言
2. 重度并行，使用 CPU
3. 高效使用内存
4. Scratch 编写，减少使用三方库，避免导致性能不可控

重写导入为合法的 URL，例如 `/node_modules/.vite/my-dep.js?v=f3sf2ebd` 以便浏览器能够正确导入它们

#### 热更新

热更新主体流程如下：

1. 服务端基于 watcher 监听文件改动，根据类型判断更新方式，并编译资源
2. 客户端通过 WebSocket 监听到一些更新的消息类型
3. 客户端收到资源信息，根据消息类型执行热更新逻辑

![img](https://zoo.team/images/upload/upload_974126b0285a213f577fe72b3ed91d90.jpg)

下面是服务端热更新的核心 hmr.ts 中的部分判断逻辑；

如果配置文件或者环境文件发生修改时，会触发服务重启，才能让配置生效。

```javascript
if (file === config.configFile || file.endsWith('.env')) {
  // auto restart server 配置&环境文件修改则自动重启服务
  debugHmr(`[config change] ${chalk.dim(shortFile)}`)
  config.logger.info(
    chalk.green('config or .env file changed, restarting server...'),
    { clear: true, timestamp: true }
  )
  await restartServer(server)
  return
}
```

html 文件更新时，将会触发页面的重新加载。

```javascript
if (file.endsWith('.html')) { // html 文件更新
  config.logger.info(chalk.green(`page reload `) +         chalk.dim(shortFile), {
    clear: true,
    timestamp: true
  })
  ws.send({
    type: 'full-reload',
    path: config.server.middlewareMode
    ? '*'
    : '/' + normalizePath(path.relative(config.root, file))
  })
} else {
  // loaded but not in the module graph, probably not js
  debugHmr(`[no modules matched] ${chalk.dim(shortFile)}`)
}
```

Vue 等文件更新时，都会进入 `updateModules` 方法，正常情况下只会触发 update，实现热更新，热替换；

```javascript
function updateModules(
  file: string,
  modules: ModuleNode[],
  timestamp: number,
  { config, ws }: ViteDevServer
) {
  const updates: Update[] = []
  const invalidatedModules = new Set<ModuleNode>()
    // 遍历插件数组，关联下面的片段
  for (const mod of modules) {
    const boundaries = new Set<{
      boundary: ModuleNode
      acceptedVia: ModuleNode
    }>()
    // 设置时间戳
    invalidate(mod, timestamp, invalidatedModules)
    // 查找引用模块，判断是否需要重载页面
    const hasDeadEnd = propagateUpdate(mod, timestamp, boundaries)
    // 找不到引用者则会发起刷新
    if (hasDeadEnd) {
      config.logger.info(chalk.green(`page reload `) + chalk.dim(file), {
        clear: true,
        timestamp: true
      })
      ws.send({
        type: 'full-reload'
      })
      return
    }
    updates.push(
      ...[...boundaries].map(({ boundary, acceptedVia }) => ({
        type: `${boundary.type}-update` as Update['type'],
        timestamp,
        path: boundary.url,
        acceptedPath: acceptedVia.url
      }))
    )
  }
  // 日志输出
  config.logger.info(
    updates
      .map(({ path }) => chalk.green(`hmr update `) + chalk.dim(path))
      .join('\n'),
    { clear: true, timestamp: true }
  )
  // 向客户端发送消息，进行热更新操作
  ws.send({
    type: 'update',
    updates
  })
}
```

上面代码中的 modules 是热更新时需要执行的各个插件

```javascript
for (const plugin of config.plugins) {
  if (plugin.handleHotUpdate) {
    const filteredModules = await plugin.handleHotUpdate(hmrContext)
    if (filteredModules) {
      hmrContext.modules = filteredModules
    }
  }
}
```

Vite 会把模块的依赖关系组合成 moduleGraph，它的结构类似树形，热更新中判断哪些文件需要更新也会依赖 moduleGraph；它的文件内容大致如下：

```javascript
// moduleGraph 返回的 ModuleNode 大致结构
 ModuleNode {
  id: '/Users/zcy/Documents/workspace/back-sky-front/src/pages/back-sky/index.js',
  file: '/Users/zcy/Documents/workspace/back-sky-front/src/pages/back-sky/index.js',
  importers: Set {},
  importedModules: Set {
    ModuleNode {
      id: '/Users/zcy/Documents/workspace/back-sky-front/node_modules/.vite/vue.js?v=32cfd30c',
      file: '/Users/zcy/Documents/workspace/back-sky-front/node_modules/.vite/vue.js',
      ......
      lastHMRTimestamp: 0,
      url: '/node_modules/.vite/vue.js?v=32cfd30c',
      type: 'js'
    },
    ModuleNode {
      id: '/Users/zcy/Documents/workspace/back-sky-front/src/pages/back-sky/index.vue',
      file: '/Users/zcy/Documents/workspace/back-sky-front/src/pages/back-sky/index.vue',
      ......
      url: '/src/pages/back-sky/index.vue',
      type: 'js'
    },
    ModuleNode {
      id: '/Users/zcy/Documents/workspace/back-sky-front/node_modules/element-plus/lib/theme-chalk/index.css',
      file: '/Users/zcy/Documents/workspace/back-sky-front/node_modules/element-plus/lib/theme-chalk/index.css',
      importers: [Set],
      importedModules: Set {},
      acceptedHmrDeps: Set {},
      isSelfAccepting: true,
      transformResult: [Object],
      ssrTransformResult: null,
      ssrModule: null,
      lastHMRTimestamp: 0,
      url: '/node_modules/element-plus/lib/theme-chalk/index.css',
      type: 'js'
    },
    ......
  },
  acceptedHmrDeps: Set {},
  isSelfAccepting: false,
  transformResult: {
    code: 'import __vite__cjsImport0_vue from ' +
      '"/node_modules/.vite/vue.js?v=32cfd30c"; const createApp = ' +
      '__vite__cjsImport0_vue["createApp"];\nimport App from ' +
      "'/src/pages/back-sky/index.vue';\nimport " +
      "'/node_modules/element-plus/lib/theme-chalk/index.css';\n\nconst app = " +
      'createApp(App);\n\nimport { addHistoryMethod } from ' +
      "'/src/pages/back-sky/api/index.js';\nimport {\n  ElButton,\n  ElDropdown,\n  " +
      'ElDropdownMenu,\n  ElDropdownItem,\n  ElMenu,\n  ElSubmenu,\n  ElMenuItem,\n  ' +
      'ElMenuItemGroup,\n  ElPopover,\n  ElDialog,\n  ElRow,\n  ElInput,\n  ' +
      "ElLoading,\n} from '/node_modules/.vite/element-plus.js?v=32cfd30c';\n\n" +
      'app.use(ElButton);\napp.use(ElLoading);\napp.use(ElDropdown);\n' +
      'app.use(ElDropdownMenu);\napp.use(ElDropdownItem);\napp.use(ElMenu);\n' +
      'app.use(ElSubmenu);\napp.use(ElMenuItem);\napp.use(ElMenuItemGroup);\n' +
      'app.use(ElPopover);\napp.use(ElDialog);\napp.use(ElRow);\napp.use(ElInput);\n' +
      "\nconst f = ()=>{\n  return app.mount('#app');\n};\n\nconst $backsky = " +
      "document.getElementById('back-sky');\nif($backsky) {\n  $backsky.innerHTML " +
      "= '';\n  $backsky.appendChild(f().$el);\n} else {\n  window.onload = " +
      "function(){\n    document.getElementById('back-sky') && " +
      "document.getElementById('back-sky').appendChild(f().$el);\n  };\n}\n\n" +
      "window.addHistoryListener = addHistoryMethod('historychange');\n" +
      "history.pushState =  addHistoryMethod('pushState');\nhistory.replaceState " +
      "=  addHistoryMethod('replaceState');\n\n// 监听hash路由变化，不与onhashchange互相覆盖\n" +
      'addHashChange(()=>{\n  setTimeout(() => {\n    const $backsky = ' +
      "document.getElementById('back-sky');\n    if($backsky && " +
      "$backsky.innerHTML === '') {\n      $backsky.appendChild(f().$el);\n    }\n " +
      " },0);\n});\n\nfunction addHashChange(callback) {\n  if('onhashchange' in " +
      'window === false){//浏览器不支持\n    return false;\n  }\n  ' +
      'if(window.addEventListener) {\n    ' +
      "window.addEventListener('hashchange',function(e) {\n      callback && " +
      'callback(e);\n    },false);\n  }else if(window.attachEvent) {//IE 8 及更早 IE ' +
      "版本浏览器\n    window.attachEvent('onhashchange',function(e) {\n      callback " +
      '&& callback(e);\n    });\n  }\n  ' +
      "window.addHistoryListener('history',function(e){\n    callback && " +
      'callback(e);\n  });\n}\n\n\n',
    map: null,
    etag: 'W/"846-Qa424gJKl3YCqHDWXXsM1mFHRqg"'
  },
  ssrTransformResult: null,
  ssrModule: null,
  lastHMRTimestamp: 0,
  url: '/src/pages/back-sky/index.js',
  type: 'js'
}
```

### 原有项目切换

最后我们来看下如何使用 Vite 去打包一个旧的 Vue 项目；

首先我们需要升级 Vue3

```bash
npm install vue@next
```

并为项目添加 vite 配置文件，在根目录下创建 vite.config.js，并为它添加一些基础的配置。

```javascript
// vite.config.js
// vite2.1.5
const path = require('path');
import vue from '@vitejs/plugin-vue';

export default {
  // 配置选项
  resolve: {
    alias: {
      '@utils': path.resolve(__dirname, './src/utils')
    },
  },
  plugins: [vue()],
};
```

引用的第三方组件库可能也会需要升级，例如：升 element-ui 至 element-plus

```bash
npm install element-plus
```

Vue3 在 import 时，需使用 `createApp` 方法进行初始化

```javascript
import { createApp } from 'vue';
import App from './index.vue';
const app = createApp(App);
import {
  ElInput,
  ElLoading,
} from 'element-plus';

app.use(ElButton);
app.use(ElLoading);
......
```

到这里就可以将项目运行起来了。 注意：Vite 官方不允许省略 .vue 后缀，否则就会报错；

```javascript
[plugin:vite:import-analysis] Failed to resolve import "./todoList" from "src/pages/back-sky/components/header/index.vue". Does the file exist?
/components/header/index.vue:2:23
1  |  
2  |  import todoList from './todoList';
import todoList from './todoList.vue';
```

最后我们来对比一下该项目两种构建方式时间的对比；

Webpack 冷启动，耗时 7513ms：

```bash
⚠ ｢wdm｣: Hash: 1ad1dd54289cfad8ecbe
Version: webpack 4.46.0
Time: 7513ms
Built at: 2021-05-24 13:59:35
```

相同项目 Vite 冷启动，耗时 924ms：

```bash
> vite
Pre-bundling dependencies:
  vue
  element-plus
  @zcy/zcy-request
  element-plus/lib/utils/dom
(this will be run only when your dependencies or config have changed)
  vite v2.3.3 dev server running at:
  > Local: http://localhost:3000/
  > Network: use `--host` to expose
  ready in 924ms.
```

二次启动（预编译的依赖已存在），耗时 407ms；

```bash
> vite
  vite v2.3.3 dev server running at:
  > Local: http://localhost:3000/
  > Network: use `--host` to expose
  ready in 407ms.
```

### 总结

使用 Vite 进行本地服务启动和热更新都会有明显的提效，至于编译打包环节的差异点有哪些？效果如何？你们还踩过哪些坑？留言告诉我吧。

推荐阅读：

[What are CJS, AMD, UMD, and ESM in Javascript?](https://dev.to/iggredible/what-the-heck-are-cjs-amd-umd-and-esm-ikm?fileGuid=DDr3GGh6QRvQgWQC)