# HappyPack

> 将任务分解成多个子进程去并发执行，子进程处理完之后再讲结果发送给主进程
>

```js
module.exports = {
	module: {
    rules: [
      {
        test: /\.js$/,
        use: ['happypack/loader?id=babel'],
        exclude: path.resolve(__dirname, 'node_modules')
      },
      {
        test: /\.css$\/,
        use: ExtractTextPlugin.extract({
        use:  ['happypack/loader?id=css']
      })
      }
    ]
  },
  plugins: [
    new HappyPack({
      id: 'babel',
      loaders: ['babel-loader?cacheDirectory']
    }),
    new HappyPack({
      id: 'css',
      loaders: ['css-loader']
    }),
    new ExtractTextPlugin({
      filename: [name].css
    })
  ]
}
```

