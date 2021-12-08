# Koa2中使用webpack进行打包压缩

```js
const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    main: './app.js',
  },
  output: {
    filename: 'app.js',
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs',
  },
  externals: [
    /^(?!\.|\/).+/i,
  ],
  target: 'node',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            // cacheDriectory: true, // 配置缓存目录
            presets: ['@babel/preset-env'],
            plugins: ['@babel/transform-runtime'] // 辅助代码从这里引用
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.optimize.UglifyJsPlugin()
  ],
  optimization: {
    minimizer: [
      new UglifyJsPlugin({
        cache: true
      })
    ],
    runtimeChunk: "single",
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          priority: 10,
          chunks:'initial',
          enforce:true
        },
        common: {
          chunks:'initial',
          minChunks: 2,
          name:'common'
        },
      },
    },
  },
};

```

