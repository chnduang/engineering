### Node中使用webpack打包时出现的错误和警告

#### 错误描述

```shell
ERROR in ./node_modules/destroy/index.js
Module not found: Error: Can't resolve 'fs' in
```

#### 解决方案

+ 在webpack的配置文件中，一般我们定义为`webpack.config.js`,中添加

  ```js
    target: 'node', // 服务端打包
  ```

#### 错误描述

```shell
WARNING in ./node_modules/mongoose/lib/index.js 11:28-64
Critical dependency: the request of a dependency is an expression
```

#### 解决方案

+ 在`webpack.config.js`,中添加

```js
output: {
	libraryTarget: 'commonjs',
},
externals: [
  /^(?!\.|\/).+/i,
],
```

