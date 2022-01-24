# 不要再看loader原理了，自己写一个就什么都明白了

> [https://mp.weixin.qq.com/s/JJSssYAavurYr1dhAfBJBQ](https://mp.weixin.qq.com/s/JJSssYAavurYr1dhAfBJBQ)

loader的作用

**loader**又叫模块转换器。换言之就是将输入到模块到内容按照自己到特性转换输出去（有点像Vue的过滤）。同时，所有的loader的功能都是单一的，他们只会关心自己的输入与输出。同理，loader有链式调用转换的功能（有点像promise then，想要了解这一块的同学，可以看我的另一篇文章 [手撕代码之Promise的实现（附源码）](http://mp.weixin.qq.com/s?__biz=MzU2MDg0MDQ0OQ==&mid=2247483875&idx=1&sn=7672d6e8ce641987406feeadda61b77e&chksm=fc00ab8dcb77229bfd072cffd81bf891a9c047756ad9ba73b66a35f24bd55ba0a59f848f2450&scene=21#wechat_redirect)）

### 多个loader使用规则

- 从右向前
- 从下向上

从右向前

```js

module.exports = {
  module: {
    rules: [
      {
        test: /\.less$/,
        use: ["style-loader","css-loader","less-loader"],
  },
};
```

说明：在执行该规则的时候，我们先执行了less-loader，将less文件转换成css。接着将转换为的规则交给前面的css-loader，css-loader 会对css中的@import 和 url() 进行处理，并将处理后的文件交给style-loader，然后style-loader把 CSS 插入到 DOM 中。

从下向上

```js
module.exports = {
  module: {
    rules: [
      {
        test: /\.less$/,
        use: [
          {
            loader: "style-loader",
          },
          {
            loader: "css-loader",
          },
          {
            loader: "less-loader",
            options: {
              lessOptions: {
                strictMath: true,
              },
            },
          },
        ],
      },
    ],
  },
};
```



按照刚刚的套路从下到上，分别执行 less-loader，css-loader，style-loader 。很容易的理解loader执行顺序，和每一个loader的作用。

**强调：**刚刚讲到的是loader的执行顺序是从右到左，从下到上。而loader的加载顺序还是我们所理解的从左到右，从上到下。但是如果在加载到时候遇到pitch-loader有返回，就不会继续向后加载了，而是会立即执行当前加载到的loader的前一个loader，然后按照执行顺序执行回去。

这一块还有很多东西，我会在之后的loader文章中详细说到，现在仅仅记住这个结论即可。

### 实现自己的babel-loader

开头我们就说了，loader的本质是将输入到模块到内容按照自己到特性转换输出去。而这和vue的过滤很像。所以，我们其实就可以将loader 定义为是 一个函数。

```js

function loader(source){
  // coding
}
module.exports = loader;
```

知己知彼，方能百战不殆。接下来，我们就来了解我们今天写的这个loader

```shell
npm install @babel/core label-loader @babel/preset-env -D
```

这是我们在将es6+语法 转换为 ES5  语法的时候的操作。

- @babel/preset-env 将我们的高版本语法转化为低版本语法
- label-loader 该软件包允许使用Babel和webpack转换JavaScript文件。
-  @babel/core babel核心包

label-loader 具体作用，换一句能听懂的话讲，就是为@babel/preset-env 和 @babel/core 搭建起了桥梁，并将@babel/preset-env 高级语法转化为的输出数据，转换为@babel/core 能看懂的输入数据。

**1、拿到babel预设（输入参数）**

```js

 module: {
       rules: [
           {
               test: /\.js$/,
               use: {
                   loader: 'babel-loader',
                   options: {
                       presets: [
                           '@babel/preset-env'
                       ]
                   }
               }
           }
       ]
   }
```



这一块代码在 webpack.config.js 目录中倒是很常见。

optionss 就是 loader的配置参数，我们需要拿到这些，并且预设显示，需要用到 @babel/preset-env。那么很容易得到代码...

```js

let babel = require('@babel/core')
// 协助拿到传入的参数
let loaderUtils = require('loader-utils')
function loader(source) {
    // 拿到输入的参数
    let options = loaderUtils.getOptions(this);
    return source
} 


module.exports = loader
```



```js
let babel = require('@babel/core')
// 协助拿到传入的参数
let loaderUtils = require('loader-utils')
function loader(source) {
    // 拿到输入的参数
    let options = loaderUtils.getOptions(this);
    // 返回结果的过程是异步，需要调用该api
    let cb = this.async()
    babel.transform(source, {
        ...options,
        // 生成sourcemap文件 调试源码
        sourceMap: true
    },function (err,result) {
      // 如果babel转换后提供了ast抽象语法树,webpack会直接
       //使用你这个loader提供的语法树而不再需要自己把code再转成语法树了
        // 异步过程
        cb(err,result.code,result.map)
    })
} 
module.exports = loader
```

是不是感觉很简单，没错这就是看起来很牛逼，很难懂的webpack中的loader。同时你也理解了weback中的laoder的核心。
