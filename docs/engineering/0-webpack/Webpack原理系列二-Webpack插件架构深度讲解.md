# Webpack 插件架构深度讲解

本文大部分篇幅都 focus 在 Tapable 框架，详细枚举了 Tapable 提供的钩子及各类型钩子的特点、运行逻辑、实现原理，并进一步讨论 Tapable 框架在 webpack 的作用，进而揭示 webpack 插件架构的核心逻辑。

阅读本文，您将：

- 了解 webpack 插件架构的基本套路
- 了解不同钩子的特点，及 webpack 为什么需要接入多种回调方案
- 下次看 webpack 官方文档或源码时，可以仅仅通过钩子的类型名快速推断出钩子的作用

# 简介

网上不少资料将 webpack 的插件架构归类为“事件/订阅”模式，我认为这种归纳有失偏颇。订阅模式是一种松耦合架构，发布器只是在特定时机发布事件消息，订阅者并不或者很少与事件直接发生交互，举例来说，我们平常在使用 HTML 事件的时候很多时候只是在这个时机触发业务逻辑，很少调用上下文操作。

而 webpack 的插件体系是一种基于 Tapable 实现的强耦合架构，它在特定时机触发钩子时会附带上足够的上下文信息，插件定义的钩子回调中，能也只能与这些上下文背后的数据结构、接口交互产生 side effect，进而影响到编译状态和后续流程。

本文将围绕 Tapable 展开，深入讲解 Tapable 的钩子类型、特点、分别以什么逻辑处理回调，在此基础上进一步推导出

# 什么是插件

从形态上看，插件通常是一个带有 apply 函数的类：

```
class SomePlugin {
    apply(compiler) {
    }
}
```

Webpack 会在启动后按照注册的顺序逐次调用插件对象的 apply 函数，同时传入编译器对象 compiler ，插件开发者可以以此为起点触达到 webpack 内部定义的任意钩子，例如：

```
class SomePlugin {
    apply(compiler) {
        compiler.hooks.thisCompilation.tap('SomePlugin', (compilation) => {
        })
    }
}
```

注意观察核心语句 `compiler.hooks.thisCompilation.tap`，其中 `thisCompilation` 为 tapable 仓库提供的钩子对象；`tap` 为订阅函数，用于注册回调。

Webpack 的插件体系基于 tapable 提供的各类钩子展开，所以有必要先熟悉一下 tapable 提供的钩子类型及各自的特点。

# Tapable 全解析

Tapable 是 Webpack 插件架构的核心支架，但它的源码量其实很少，本质上就是围绕着 订阅/发布 模式叠加各种特化逻辑，适配 webpack 体系下复杂的事件源-处理器之间交互需求，比如说有些场景需要支持将前一个处理器的结果传入下一个回调处理器；有些场景需要支持异步并行调用这些回调处理器。

要理解 webpack 的插件架构，必须先理顺 Tapable 提供了哪些类型的钩子，不同类型分别有什么特点，适配哪些应用场景，所幸这块逻辑并不复杂，我们展开来看看。

## 基本用法

Tapable 使用时通常需要经历如下步骤：

- 创建钩子实例
- 调用订阅接口注册回调，包括：`tap、tapAsync、tapPromise`
- 调用发布接口触发回调，包括：`call、callAsync、promise`

举个例子：

```
const { SyncHook } = require("tapable");

// 1. 创建钩子实例
const sleep = new SyncHook();

// 2. 调用订阅接口注册回调
sleep.tap("test", () => {
  console.log("callback A");
});

// 3. 调用发布接口触发回调
sleep.call();

// 运行结果：
// callback A
```

示例中使用 `tap` 注册回调，使用 `call` 触发回调，在某些钩子中还可以使用异步风格的 `tapAsync/callAsync、promise` 风格 `tapPromise/promise`，具体使用哪一类函数与钩子类型有关。

## Tapable 钩子类型

Tabable 提供如下类型的钩子：

| 名称                     | 简介               | 统计                                                         |
| ------------------------ | ------------------ | ------------------------------------------------------------ |
| SyncHook                 | 同步钩子           | Webpack 共出现 71 次，如 Compiler.hooks.compilation          |
| SyncBailHook             | 同步熔断钩子       | Webpack 共出现 66 次，如 Compiler.hooks.shouldEmit           |
| SyncWaterfallHook        | 同步瀑布流钩子     | Webpack 共出现 37 次，如 Compilation.hooks.assetPath         |
| SyncLoopHook             | 同步循环钩子       | Webpack 中未使用                                             |
| AsyncParallelHook        | 异步并行钩子       | Webpack 仅出现 1 次：Compiler.hooks.make                     |
| AsyncParallelBailHook    | 异步并行熔断钩子   | Webpack 中未使用                                             |
| AsyncSeriesHook          | 异步串行钩子       | Webpack 共出现 16 次，如 Compiler.hooks.done                 |
| AsyncSeriesBailHook      | 异步串行熔断钩子   | Webpack 中未使用                                             |
| AsyncSeriesLoopHook      | 异步串行循环钩子   | Webpack 中未使用                                             |
| AsyncSeriesWaterfallHook | 异步串行瀑布流钩子 | Webpack 共出现 5 次，如 NormalModuleFactory.hooks.beforeResolve |

看到上面的表格相信很多人都是懵的，其实 Tapable 仓库的 readme 对钩子分类依据讲的很清楚，总结下来两条规则：

- 按回调逻辑，分为：

- - 基本类型，名称不带 `Waterfall/Bail/Loop` 关键字，与通常 **「订阅/回调」** 模式相似，按钩子注册顺序，逐次调用回调

- `waterfall` 类型：前一个回调的返回值会被带入下一个回调

- `bail` 类型：逐次调用回调，若有任何一个回调返回非 `undefined` 值，则终止后续调用

- `loop` 类型：逐次、循环调用，直到所有回调函数都返回 `undefined`

- 第二个维度，按执行回调的并行方式，分为：

- - `async` ：异步执行，支持传入 `callback` 或 `promise` 风格的异步回调函数，支持 `callAsync/tapAsync` 、`promise/tapPromise` 两种调用语句
  - `sync` ：同步执行，启动后会按次序逐个执行回调，支持 `call/tap` 调用语句

所有钩子都可以按名称套进这两条规则里面，对插件开发者来说不同类型的钩子会直接影响到回调函数的写法，以及插件与其他插件的互通关系，但是有一些基本能力、概念是通用的：`tap/call`、`intercept`、`context`、动态编译等。接下来按同步、异步维度考察每种钩子的特点。

## 同步钩子

### `SyncHook` 钩子

#### 基本逻辑

`SyncHook` 算的上是简单的钩子了，触发后会按照注册的顺序逐个调用回调，且不关心这些回调的返回值，逻辑上大致如：

```
function syncCall() {
  const callbacks = [fn1, fn2, fn3];
  for (let i = 0; i < callbacks.length; i++) {
    const cb = callbacks[i];
    cb();
  }
}
```

#### 示例

```
const { SyncHook } = require("tapable");

class Somebody {
  constructor() {
    this.hooks = {
      sleep: new SyncHook(),
    };
  }
  sleep() {
    //   触发回调
    this.hooks.sleep.call();
  }
}

const person = new Somebody();

// 注册回调
person.hooks.sleep.tap("test", () => {
  console.log("callback A");
});
person.hooks.sleep.tap("test", () => {
  console.log("callback B");
});
person.hooks.sleep.tap("test", () => {
  console.log("callback C");
});

person.sleep();
// 输出结果：
// callback A
// callback B
// callback C
```

示例中，`Somebody` 初始化时声明了一个 `sleep` 钩子，并在后续调用 `sleep.tap` 函数连续注册三次回调，在调用 `person.sleep()` 语句触发 `sleep.call` 之后，tapable 会按照注册的先后按序执行三个回调。

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

#### 异步风格

上述示例中，触发回调时用到了钩子的 `call` 函数，我们也可以选择异步风格的 `callAsync` ，选用 `call` 或 `callAsync` 并不会影响回调的执行逻辑：按注册顺序依次执行 + 忽略回调执行结果，两者唯一的区别是 `callAsync` 需要传入 `callback` 函数，用于处理回调队列可能抛出的异常：

```
// call 风格
try {
  this.hooks.sleep.call();
} catch (e) {
    // 错误处理逻辑
}
// callAsync 风格
this.hooks.sleep.callAsync((err) => {
  if (err) {
    // 错误处理逻辑
  }
});
```

由于调用方式不会钩子本身的规则，所以对钩子的使用者来说无需关注提供者到底用的是 `call` 还是 `callAsync`，上面的例子只需要做简单的修改就可以适配 `callAsync` 场景：

```
const { SyncHook } = require("tapable");

class Somebody {
  constructor() {
    this.hooks = {
      sleep: new SyncHook(),
    };
  }
  sleep() {
    //   触发回调
    this.hooks.sleep.callAsync((err) => {
      if (err) {
        console.log(`interrupt with "${err.message}"`);
      }
    });
  }
}

const person = new Somebody();

// 注册回调
person.hooks.sleep.tap("test", (cb) => {
  console.log("callback A");
  throw new Error("我就是要报错");
});
// 第一个回调出错后，后续回调不会执行
person.hooks.sleep.tap("test", () => {
  console.log("callback B");
});

person.sleep();

// 输出结果：
// callback A
// interrupt with "我就是要报错"
```

### `SyncBailHook` 钩子

#### 基本逻辑

`bail` 单词有熔断的意思，而 `bail` 类型钩子的特点是在回调队列中，若任一回调返回了非 `undefined` 的值，则中断后续处理，直接返回该值，用一段伪代码来表示：

```
function bailCall() {
  const callbacks = [fn1, fn2, fn3];
  for (let i in callbacks) {
    const cb = callbacks[i];
    const result = cb(lastResult);
    if (result !== undefined) {
      // 熔断
      return result;
    }
  }
  return undefined;
}
```

#### 示例

`SyncBailHook` 的调用顺序与规则都跟 `SyncHook` 相似，主要区别一是 `SyncBailHook` 增加了熔断逻辑，例如：

```
const { SyncBailHook } = require("tapable");

class Somebody {
  constructor() {
    this.hooks = {
      sleep: new SyncBailHook(),
    };
  }
  sleep() {
    return this.hooks.sleep.call();
  }
}

const person = new Somebody();

// 注册回调
person.hooks.sleep.tap("test", () => {
  console.log("callback A");
  // 熔断点
  // 返回非 undefined 的任意值都会中断回调队列
  return '返回值：tecvan'
});
person.hooks.sleep.tap("test", () => {
  console.log("callback B");
});

console.log(person.sleep());

// 运行结果：
// callback A
// 返回值：tecvan
```

其次，相比于 `SyncHook` ，`SyncBailHook` 运行结束后，会将熔断值返回给call函数，例如上例第20行， `callback A` 返回的返回值：`tecvan` 会成为 `this.hooks.sleep.call` 的调用结果。

#### Webpack 场景解析

`SyncBailHook` 通常用在发布者需要关心订阅回调运行结果的场景， webpack 内部有99个地方用到这种钩子，举个例子： `compiler.hooks.shouldEmit`，对应的 `call` 语句：

```
class Compiler {
  run(callback) {
    //   ...

    const onCompiled = (err, compilation) => {
      if (this.hooks.shouldEmit.call(compilation) === false) {
        // ...
      }
    };
  }
}
```

此处 webpack 会根据 `shouldEmit` 钩子的运行结果确定是否执行后续的操作，其它场景也有相似逻辑，如：

- `NormalModuleFactory.hooks.createModule` ：预期返回新建的 `module` 对象
- `Compilation.hooks.needAdditionalSeal` ：预期返回 `bool` 值，判定是否进入 `unseal` 状态
- `Compilation.hooks.optimizeModules` ：预期返回 `bool` 值，用于判定是否继续执行优化操作

### SyncWaterfallHook 钩子

#### 基本逻辑

`waterfall` 钩子的执行逻辑跟 lodash 的 `flow` 函数有点像，大致上就是会将前一个函数的返回值作为参数传入下一个函数，可以简化为如下代码：

```
function waterfallCall(arg) {
  const callbacks = [fn1, fn2, fn3];
  let lastResult = arg;
  for (let i in callbacks) {
    const cb = callbacks[i];
    // 上次执行结果作为参数传入下一个函数
    lastResult = cb(lastResult);
  }
  return lastResult;
}
```

理解上述逻辑后，`SyncWaterfallHook` 的特点也就很明确了：

1. 上一个函数的结果会被带入下一个函数
2. 最后一个回调的结果会作为 call 调用的结果返回

#### 示例

还是举例感受一下：

```
const { SyncWaterfallHook } = require("tapable");

class Somebody {
  constructor() {
    this.hooks = {
      sleep: new SyncWaterfallHook(["msg"]),
    };
  }
  sleep() {
    return this.hooks.sleep.call("hello");
  }
}

const person = new Somebody();

// 注册回调
person.hooks.sleep.tap("test", (arg) => {
  console.log(`call 调用传入： ${arg}`);
  return "tecvan";
});

person.hooks.sleep.tap("test", (arg) => {
  console.log(`A 回调返回： ${arg}`);
  return "world";
});

console.log("最终结果：" + person.sleep());
// 运行结果：
// call 调用传入： hello
// A 回调返回： tecvan
// 最终结果：world
```

示例中，`sleep` 钩子为 `SyncWaterfallHook` 类型，之后注册了两个回调，从处理结果可以看到第一个回调收到的 `arg = hello` ，即第10行 `call` 调用时传入的参数；第二个回调收到的是第一个回调返回的结果 `tecvan`；之后 `call` 调用返回的是第二个回调的结果 `world` 。

使用上，`SyncWaterfallHook` 钩子有一些注意事项：

- 初始化时必须提供参数，例如上例 `new SyncWaterfallHook(["msg"])` 构造函数中必须传入参数 `["msg"]` ，用于动态编译 `call` 的参数依赖，后面会讲到**「动态编译」**的细节。
- 发布调用 `call` 时，需要传入初始参数

#### Webpack 场景解析

`SyncWaterfallHook` 在 webpack 中总共出现了55次，其中比较有代表性的例子是 `NormalModuleFactory.hooks.factory` ，在 webpack 内部实现中，会在这个钩子内根据资源类型 `resolve` 出对应的 `module` 对象：

```
class NormalModuleFactory {
  constructor() {
    this.hooks = {
      factory: new SyncWaterfallHook(["filename", "data"]),
    };

    this.hooks.factory.tap("NormalModuleFactory", () => (result, callback) => {
      let resolver = this.hooks.resolver.call(null);

      if (!resolver) return callback();

      resolver(result, (err, data) => {
        if (err) return callback(err);

        // direct module
        if (typeof data.source === "function") return callback(null, data);

        // ...
      });
    });
  }

  create(data, callback) {
    //   ...
    const factory = this.hooks.factory.call(null);
    // ...
  }
}
```

大致上就是在创建模块，通过 `factory` 钩子将 `module` 的创建过程外包出去，在钩子回调队列中依据 `waterfall` 的特性逐步推断出最终的 `module` 对象。

### `SyncLoopHook` 钩子

#### 基本逻辑

`loop` 型钩子的特点是循环执行直到所有回调都返回 `undefined` ，不过这里循环的维度是单个回调函数，例如有回调队列 `[fn1, fn2, fn3]` ，`loop` 钩子先执行 `fn1` ，如果此时 `fn1` 返回了非 `undefined` 值，则继续执行 `fn1` 直到返回 `undefined` 后才向前推进执行 `fn2` 。伪代码：

```
function loopCall() {
  const callbacks = [fn1, fn2, fn3];
  for (let i in callbacks) {
    const cb = callbacks[i];
    // 重复执行
    while (cb() !== undefined) {}
  }
}
```

#### 示例

由于 `loop` 钩子循环执行的特性，使用时务必十分注意，避免陷入死循环。示例：

```
const { SyncLoopHook } = require("tapable");

class Somebody {
  constructor() {
    this.hooks = {
      sleep: new SyncLoopHook(),
    };
  }
  sleep() {
    return this.hooks.sleep.call();
  }
}

const person = new Somebody();
let times = 0;

// 注册回调
person.hooks.sleep.tap("test", (arg) => {
  ++times;
  console.log(`第 ${times} 次执行回调A`);
  if (times < 4) {
    return times;
  }
});

person.hooks.sleep.tap("test", (arg) => {
  console.log(`执行回调B`);
});

person.sleep();
// 运行结果
// 第 1 次执行回调A
// 第 2 次执行回调A
// 第 3 次执行回调A
// 第 4 次执行回调A
// 执行回调B
```

可以看到示例中一直在执行回调 A，直到满足判定条件 `times >= 4` ，A 返回 `undefined` 后，才开始执行回调B。

虽然 Tapable 提供了 `SyncLoopHook` 钩子，但 webpack 源码中并没有使用到，所以读者理解用法就行，不用深究。

## 异步钩子

前面说的 `Sync` 开头的都是同步风格的钩子，优点是执行顺序相对简单，回调之前依次执行，缺点是不能在回调中执行异步操作。除了同步钩子外，Tapable 还提供了一系列 `Async`开头的异步钩子，支持在回调函数中执行异步操作，逻辑比较复杂。

### `AsyncSeriesHook` 钩子

#### 基本逻辑

`AsyncSeriesHook` 的特点：

- 支持异步回调，可以在回调函数中写 `callback` 或 `promise` 风格的异步操作
- 回调队列依次执行，前一个执行结束后才会开始执行下一个
- 与 `SyncHook` 一样，不关心回调的执行结果

用一段伪代码来表示：

```
function asyncSeriesCall(callback) {
  const callbacks = [fn1, fn2, fn3];
  //   执行回调 1
  fn1((err1) => {
    if (err1) {
      callback(err1);
    } else {
      //   执行回调 2
      fn2((err2) => {
        if (err2) {
          callback(err2);
        } else {
          //   执行回调 3
          fn3((err3) => {
            if (err3) {
              callback(err2);
            }
          });
        }
      });
    }
  });
}
```

#### 示例

先来看个 `callback` 风格的示例：

```
const { AsyncSeriesHook } = require("tapable");

const hook = new AsyncSeriesHook();

// 注册回调
hook.tapAsync("test", (cb) => {
  console.log("callback A");
  setTimeout(() => {
    console.log("callback A 异步操作结束");
    // 回调结束时，调用 cb 通知 tapable 当前回调已结束
    cb();
  }, 100);
});

hook.tapAsync("test", () => {
  console.log("callback B");
});

hook.callAsync();
// 运行结果：
// callback A
// callback A 异步操作结束
// callback B
```

从代码输出结果可以看出，A 回调内部的 `setTimeout` 执行完毕调用 `cb` 函数，tapable 才认为当前回调执行完毕，开始执行 B 回调。

除了 `callback` 风格外，也可以使用 `promise` 风格调用 `tap/call` 函数，改造上例：

```
const { AsyncSeriesHook } = require("tapable");

const hook = new AsyncSeriesHook();

// 注册回调
hook.tapPromise("test", () => {
  console.log("callback A");
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("callback A 异步操作结束");
      resolve();
    }, 100);
  });
});

hook.tapPromise("test", () => {
  console.log("callback B");
  return Promise.resolve();
});

hook.promise();
// 运行结果：
// callback A
// callback A 异步操作结束
// callback B
```

有三个改动点：

- 将 `tapAsync` 更改为 `tapPromise`
- `Tap` 回调需要返回 `promise` 对象，如上例第 8 行
- `callAsync` 调用更改为 `promise`

#### Webpack 场景分析

`AsyncSeriesHook` 钩子在 webpack 中总共出现了34次，相对来说都是一些比较容易理解的时机，比如在构建完毕后触发 `compiler.hooks.done` 钩子，用于通知单次构建已经结束：

```
class Compiler {
  run(callback) {
    if (err) return finalCallback(err);

    this.emitAssets(compilation, (err) => {
      if (err) return finalCallback(err);

      if (compilation.hooks.needAdditionalPass.call()) {
        // ...
        this.hooks.done.callAsync(stats, (err) => {
          if (err) return finalCallback(err);

          this.hooks.additionalPass.callAsync((err) => {
            if (err) return finalCallback(err);
            this.compile(onCompiled);
          });
        });
        return;
      }

      this.emitRecords((err) => {
        if (err) return finalCallback(err);

        // ...
        this.hooks.done.callAsync(stats, (err) => {
          if (err) return finalCallback(err);
          return finalCallback(null, stats);
        });
      });
    });
  }
}
```

### `AsyncParallelHook` 钩子

与 `AsyncSeriesHook` 类似，`AsyncParallelHook` 也支持异步风格的回调，不过 `AsyncParallelHook` 是以并行方式，同时执行回调队列里面的所有回调，逻辑上近似于：

```
function asyncParallelCall(callback) {
  const callbacks = [fn1, fn2];
  // 内部维护了一个计数器
  var _counter = 2;

  var _done = function() {
    _callback();
  };
  if (_counter <= 0) return;
  // 按序执行回调
  var _fn0 = callbacks[0];
  _fn0(function(_err0) {
    if (_err0) {
      if (_counter > 0) {
        // 出错时，忽略后续回调，直接退出
        _callback(_err0);
        _counter = 0;
      }
    } else {
      if (--_counter === 0) _done();
    }
  });
  if (_counter <= 0) return;
  // 不需要等待前面回调结束，直接开始执行下一个回调
  var _fn1 = callbacks[1];
  _fn1(function(_err1) {
    if (_err1) {
      if (_counter > 0) {
        _callback(_err1);
        _counter = 0;
      }
    } else {
      if (--_counter === 0) _done();
    }
  });
}
```

`AsyncParallelHook` 钩子的特点：

- 支持异步风格
- 并行执行回调队列，不需要做任何等待
- 与 SyncHook 一样，不关心回调的执行结果

### 其它

部分钩子类型在 tapable 定义，但在 webpack 中并没有用例，大致理解作用即可：

- `AsyncParallelBailHook` ：异步 + 并行 + 熔断，启动后同时执行所有回调，但任意回调有返回值时，忽略剩余未执行完的回调，直接返回该结果
- `AsyncSeriesBailHook` ：异步 + 串行 + 熔断，启动后按序逐个执行回调，过程中若有任意回调返回非 undefined 值，则停止后续调用，直接返回该结果
- `AsyncSeriesLoopHook`： 异步 + 串行 + 循环，启动后按序逐个执行回调，若有任意回调返回非 `undefined` 值，则重复执行该回调直到返回 `undefined` 后，才继续执行下一个回调

## 动态编译

### 基本逻辑

Tapable 最大的秘密就是其内部实现了一套非常大胆的设计：动态编译，所谓的同步、异步、bail、waterfall、loop 等回调规则都是基于动态编译能力实现的，所以要深入学习 tapable 必然绕不开动态编译特性。

当用户执行钩子发布函数 `call/callAsync/promise` 时，tapable 会根据钩子类型、参数、回调队列等信息动态生成执行函数，例如对于下面的例子：

```
const { SyncHook } = require("tapable");

const sleep = new SyncHook();

sleep.tap("test", () => {
  console.log("callback A");
});
sleep.call();
```

调用 `sleep.call` 时，tapable 内部处理流程大致为：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

编译过程主要涉及三个实体：

- `tapable/lib/SyncHook.js` ：定义 `SyncHook` 的入口文件
- `tapable/lib/Hook.js` ：`SyncHook` 只是一个简单接口，内部实际上调用了 `Hook` 类，由 `Hook` 实现钩子的逻辑 —— 其它钩子也是一样的套路
- `tapable/lib/HookCodeFactory.js` ：动态编译出 `call、callAsync、promise` 函数内容的工厂类，注意，其他钩子也都会用到 `HookCodeFactory` 工厂函数。

`SyncHook` (其他钩子类似) 调用 `call` 后，`Hook` 基类收集上下文信息并调用 `createCall` 及子类传入的 `compiler` 函数；`compiler` 调用 `HookCodeFactory` 进而使用 `new Function` 方法动态拼接出回调执行函数。上面例子对应的生成函数：

```
(function anonymous() {
"use strict";
var _context;
var _x = this._x;
var _fn0 = _x[0];
_fn0();

})
```

### 更复杂的例子

动态编译能力在一般场景下会存在诸如性能、安全性方面的问题，所以社区很少见到类似的设计。回到上面的例子，`SyncHook` 的回调逻辑其实很简单，真的有必要用到动态编译吗？我们来看一个更复杂的例子：

```
const { AsyncSeriesWaterfallHook } = require("tapable");

const sleep = new AsyncSeriesWaterfallHook(["name"]);

sleep.tapAsync("test1", (name, cb) => {
  console.log(`执行 A 回调： 参数 name=${name}`);
  setTimeout(() => {
    cb(undefined, "tecvan2");
  }, 100);
});

sleep.tapAsync("test", (name, cb) => {
  console.log(`执行 B 回调： 参数 name=${name}`);
  setTimeout(() => {
    cb(undefined, "tecvan3");
  }, 100);
});

sleep.tapAsync("test", (name, cb) => {
  console.log(`执行 C 回调： 参数 name=${name}`);
  setTimeout(() => {
    cb(undefined, "tecvan4");
  }, 100);
});

sleep.callAsync("tecvan", (err, name) => {
  console.log(`回调结束， name=${name}`);
});

// 运行结果：
// 执行 A 回调： 参数 name=tecvan
// 执行 B 回调： 参数 name=tecvan2
// 执行 C 回调： 参数 name=tecvan3
// 回调结束， name=tecvan4
```

示例用到 `AsyncSeriesWaterfallHook`，这个钩子的特点是异步 + 串行 + 前一个回调的返回值会传入下一个回调，对应生成函数：

```
(function anonymous(name, _callback) {
  "use strict";
  var _context;
  var _x = this._x;
  function _next1() {
    var _fn2 = _x[2];
    _fn2(name, function(_err2, _result2) {
      if (_err2) {
        _callback(_err2);
      } else {
        if (_result2 !== undefined) {
          name = _result2;
        }
        _callback(null, name);
      }
    });
  }
  function _next0() {
    var _fn1 = _x[1];
    _fn1(name, function(_err1, _result1) {
      if (_err1) {
        _callback(_err1);
      } else {
        if (_result1 !== undefined) {
          name = _result1;
        }
        _next1();
      }
    });
  }
  var _fn0 = _x[0];
  _fn0(name, function(_err0, _result0) {
    if (_err0) {
      _callback(_err0);
    } else {
      if (_result0 !== undefined) {
        name = _result0;
      }
      _next0();
    }
  });
});
```

这段生成函数有几个特点：

- 生成函数将回调队列各个项封装为 `_next0/_next1` 函数，这些 `next` 函数内在逻辑高度相似
- 按回调定义的顺序，逐次执行，上一个回调结束后，才调用下一个回调，例如生成代码中的第39行、27行

相对于用递归、循环之类的手段实现 `AsyncSeriesWaterfallHook` ，这段生成函数逻辑确实会更清晰，更容易理解。

Tapable 提供的大多数特性都是基于 `Hook + HookCodeFactory` 实现的，如果读者对此有兴趣，可以在 `tapable/lib/Hook.js` 的 `CALL\_DELEGATE/CALL\_ASYNC\_DELEGATE/PROMISE\_DELEGATE` 几个函数打断点：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

之后，通过 ndb 命令断点调试，查看发布动作动态编译出的代码：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)

## 高级特性：Intercept

除了通常的 `tap/call` 之外，tapable 还提供了简易的中间件机制 —— `intercept` 接口，例如

```
const sleep = new SyncHook();

sleep.intercept({
  name: "test",
  context: true,
  call() {
    console.log("before call");
  },
  loop(){
    console.log("before loop");
  },
  tap() {
    console.log("before each callback");
  },
  register() {
    console.log("every time call tap");
  },
});
```

`intercept` 支持注册如下类型的中间件：

|          | 签名                           | 解释                                     |
| -------- | ------------------------------ | ---------------------------------------- |
| call     | (...args) => void              | 调用 call/callAsync/promise 时触发       |
| tap      | (tap: Tap) => void             | 调用 call 类函数后，每次调用回调之前触发 |
| loop     | (...args) => void              | 仅 loop 型的钩子有效，在循环开始之前触发 |
| register | (tap: Tap) => Tap \| undefined | 调用 tap/tapAsync/tapPromise 时触发      |

其中 `register` 在每次调用 tap 时被调用；其他三种中间件的触发时机大致如：

```
  var _context;
  const callbacks = [fn1, fn2];
  var _interceptors = this.interceptors;
  // 调用 call 函数，立即触发
  _interceptors.forEach((intercept) => intercept.call(_context));
  var _loop;
  var cursor = 0;
  do {
    _loop = false;
    // 每次循环开始时触发 `loop`
    _interceptors.forEach((intercept) => intercept.loop(_context));
    // 触发 `tap`
    var _fn0 = callbacks[0];
    _interceptors.forEach((intercept) => intercept.tap(_context, _fn0));
    var _result0 = _fn0();
    if (_result0 !== undefined) {
      _loop = true;
    } else {
      var _fn1 = callbacks[1];
      // 再次触发 `tap`
      _interceptors.forEach((intercept) => intercept.tap(_context, _fn1));
      var _result1 = _fn1();
      if (_result1 !== undefined) {
        _loop = true;
      }
    }
  } while (_loop);
```

`intercept` 特性在 webpack 内主要被用作进度提示，如 `webpack/lib/ProgressPlugin` 插件中，分别对 `compiler.hooks.emit` 、`compiler.hooks.afterEmit`钩子应用了记录进度的中间件函数。其他类型的插件应用较少。

## 高级特性：HookMap

Tapable 还有一个特性值得注意的特性 —— `HookMap` 。`HookMap` 提供了一种集合操作能力，能够降低创建与使用的复杂度，用法比较简单：

```
const { SyncHook, HookMap } = require("tapable");

const sleep = new HookMap(() => new SyncHook());

// 通过 for 函数过滤集合中的特定钩子
sleep.for("statement").tap("test", () => {
  console.log("callback for statement");
});

// 触发 statement 类型的钩子
sleep.get("statement").call();
```

在 webpack 中，HookMap 集中在 `webpack/lib/parser.js` 文件中，`parser` 文件主要完成将资源内容解析为 AST 集合，解析完成后遍历 AST 并以钩子方式对外通知遍历到的内容。例如遇到表达式的时候触发 `Parser.hooks.expression` 钩子，问题是 AST 结构和内容都很复杂，如果所有情景都以独立的钩子实现，那代码量工作量会急剧膨胀。

这种场景就很适合用 `HookMap` 解决，以 `expression` 为例：

```
class Parser {
  constructor() {
    this.hooks = {
      // 定义钩子
      // 这里用到 HookMap ，所以不需要提前遍历枚举所有 expression 场景
      expression: new HookMap(() => new SyncBailHook(["expression"])),
    };
  }

  //   不同场景下触发钩子
  walkMemberExpression(expression) {
    const exprName = this.getNameForExpression(expression);
    if (exprName && exprName.free) {
      // 触发特定类型的钩子
      const expressionHook = this.hooks.expression.get(exprName.name);
      if (expressionHook !== undefined) {
        const result = expressionHook.call(expression);
        if (result === true) return;
      }
    }
    // ...
  }

  walkThisExpression(expression) {
    const expressionHook = this.hooks.expression.get("this");
    if (expressionHook !== undefined) {
      expressionHook.call(expression);
    }
  }
}

// 钩子消费逻辑
// 选取 CommonJsStuffPlugin 仅起示例作用
class CommonJsStuffPlugin {
  apply(compiler) {
    compiler.hooks.compilation.tap(
      "CommonJsStuffPlugin",
      (compilation, { normalModuleFactory }) => {
        const handler = (parser, parserOptions) => {
          // 通过 for 精确消费钩子
          parser.hooks.expression
            .for("require.main.require")
            .tap(
              "CommonJsStuffPlugin",
              ParserHelpers.expressionIsUnsupported(
                parser,
                "require.main.require is not supported by webpack."
              )
            );
          parser.hooks.expression
            .for("module.parent.require")
            .tap(
              "CommonJsStuffPlugin",
              ParserHelpers.expressionIsUnsupported(
                parser,
                "module.parent.require is not supported by webpack."
              )
            );
          parser.hooks.expression
            .for("require.main")
            .tap(
              "CommonJsStuffPlugin",
              ParserHelpers.toConstantDependencyWithWebpackRequire(
                parser,
                "__webpack_require__.c[__webpack_require__.s]"
              )
            );
          // ...
        };
      }
    );
  }
}
```

# Webpack 插件架构

上面内容围绕 tapable 展开，着重介绍各种钩子类型的运行机理、特点、交互等，在理解这些内容之后，我们可以继续往前推导，聊聊 webpack 插件架构的核心设计。

前端社区里很多有名的框架都各自有一套插件架构，例如 axios、quill、vscode、webpack、vue、rollup 等等。插件架构灵活性高，扩展性强，但是通常需要非常强的架构能力，需要至少解决三个方面的问题：

- **「接口」**：需要提供一套逻辑接入方法，让开发者能够将逻辑在特定时机插入特定位置
- **「输入」**：如何将上下文信息高效传导给插件
- **「输出」**：插件内部通过何种方式影响整套运行体系

针对这些问题，webpack 为开发者提供了基于 tapable 钩子的插件方案：

1. 编译过程的特定节点以钩子形式，通知插件此刻正在发生什么事情；
2. 通过 tapable 提供的回调机制，以参数方式传递上下文信息；
3. 在上下文参数对象中附带了很多存在 side effect 的交互接口，插件可以通过这些接口改变

这一切实现都离不开 tapable，例如：

```
class Compiler {
  // 在构造函数中，先初始化钩子对象
  constructor() {
    this.hooks = {
      thisCompilation: new SyncHook(["compilation", "params"]),
    };
  }

  compile() {
    // 特定时机触发特定钩子
    const compilation = new Compilation();
    this.hooks.thisCompilation.call(compilation);
  }
}
```

`Compiler` 类型内部定义了 `thisCompilation` 钩子，并在 `compilation` 创建完毕后发布事件消息，插件开发者就可以基于这个钩子获取到最新创建出的 `compilation` 对象：

```
class SomePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap("SomePlugin", (compilation, params) => {
        // 上下文信息： compilation、params
    });
  }
}
```

钩子回调传递的 `compilation/params` 参数就是 webpack 希望传递给插件的上下文信息，也是插件能拿到的输入。不同钩子会传递不同的上下文对象，这一点在钩子被创建的时候就定下来了，比如：

```
class Compiler {
    constructor() {
        this.hooks = {
            /** @type {SyncBailHook<Compilation>} */
            shouldEmit: new SyncBailHook(["compilation"]),
            /** @type {AsyncSeriesHook<Stats>} */
            done: new AsyncSeriesHook(["stats"]),
            /** @type {AsyncSeriesHook<>} */
            additionalPass: new AsyncSeriesHook([]),
            /** @type {AsyncSeriesHook<Compiler>} */
            beforeRun: new AsyncSeriesHook(["compiler"]),
            /** @type {AsyncSeriesHook<Compiler>} */
            run: new AsyncSeriesHook(["compiler"]),
            /** @type {AsyncSeriesHook<Compilation>} */
            emit: new AsyncSeriesHook(["compilation"]),
            /** @type {AsyncSeriesHook<string, Buffer>} */
            assetEmitted: new AsyncSeriesHook(["file", "content"]),
            /** @type {AsyncSeriesHook<Compilation>} */
            afterEmit: new AsyncSeriesHook(["compilation"]),
        };
    }
}
```

- `shouldEmit` 会被传入 `compilation` 参数
- `done` 会被传入 `stats` 参数
- `addtionalPass` 没有参数
- ...

常见的参数对象有 `compilation/module/stats/compiler/file/chunks` 等，在钩子回调中可以通过改变这些对象的状态，影响 webpack 的编译逻辑。这些类型的含义、作用、接口都比较复杂，建议读者到 [[万字总结\] 一文吃透 Webpack 核心原理](http://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247483744&idx=1&sn=d7128a76eed20746cd8c5100f0899138&chksm=cf00bc19f877350f17844b283fa0f39daa111864aa69f0be8ce05d3809c51496da43de018a17&scene=21#wechat_redirect) 做进一步了解。

# 总结

Tapable 合计提供了 10 种钩子，支持同步、异步、熔断、循环、waterfall等功能特性，以此支撑起 webpack 复杂的编译功能。熟悉这10种钩子只是一个起点，能够让你在编写插件时迅速识别出回调函数的基本模式。

除此之外你还需要了解学习更多 webpack 内置对象的功能、特点、接口等内容才能顺利编写出符合需求的插件，作者近期会一直 focus 在 webpack 领域，对此感兴趣的同学记得点击关注。