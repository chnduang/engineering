# 前端工程化-内部 npm 私服搭建



在工作中，公司有很多内部的包并不希望发布到npm官网仓库，因为可能涉及到一些私有代码不能暴露。对于前端来讲，这时就可以选择在公司内网搭建npm私有仓库。当前比较主流的几种解决方案：verdaccio、nexus、cnpm。大家可以按照自己的需求选择。本文中采用的是cnpm私服搭建。

  

cnpm私服搭建流程



\1. 安装node,新的node版本会自带npm

官网地址：https://nodejs.org/zh-cn/



\2. 拉取代码，对应公司需求做相应更改

- 

```
git clone https://github.com/cnpm/cnpmjs.org.git
```



\3. 修改配置文件 ./config/index.js

- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 
- 

```
// 仓库站点访问端口registryPort: 7001,   // 页面访问端口      webPort: 7002,             // 外网可以访问的话则注释，否则只能内网访问bindingHost: '127.0.0.1',      // 数据库配置database: {    db: 'cnpmjs',        // 数据库    username: 'root',    // 数据库用户名    password: '',        // 数据库密码    dialect: 'mysql',    // 数据库类型 'mysql', 'sqlite', 'postgres', 'mariadb'    host: '',            // 数据库服务地址    port: 3306           // 端口}// 用户配置 key 为用户名和密码，value为邮箱admins: {      harlie: 'yanghui3021@163.com',    fengmk2: 'fengmk2@gmail.com',    admin: 'admin@cnpmjs.org',    dead_horse: 'dead_horse@qq.com',},
// true为只有管理员可以发布，false是任何人发布都必须带有私有标识enablePrivate: false, 
//私有标识前缀scopes: [ '@harlie','@cnpm', '@cnpmtest' ],
//同步模块上游registry地址sourceNpmRegistry: 'https://registry.npm.taobao.org',
// 同步模式  'none' 不进行同步 , 'all' 定时同步所有源 registry 的模块, 'exist' 只同步已经存在于数据库的模块syncModel: 'exist', 
// 同步间隔时间syncInterval: '10m',
```



\4. 数据库创建 （MySQL）

- 
- 
- 

```
create database cnpmjs;   // 创建数据库use cnpmjs;source cnpmjs.org/docs/db.sql;   // 拉取项目的 docs/db.sql
```

\5. 命令启动执行 （到这里私有库的搭建已经完成，是不是并不复杂![图片](https://mmbiz.qpic.cn/mmbiz_gif/ictia63Scgnn9X9NXU7z64iasjvKkbewzjlJ5JHp3oHJjxhe8VlEwML7KzicYMg06nF1QPN6bicFTmfbrsxdGZVsGkw/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)）

- 

```
node dispatch.js  
```

启动成功后就可以通过 http://42.192.37.59:7002 查看网址页面。

![图片](https://mmbiz.qpic.cn/mmbiz_png/ictia63Scgnn9X9NXU7z64iasjvKkbewzjlA5ic5KVeG8fJ54Jr977c5NDWVPeRQ2xB1HiajBy4FrLGxxe7KCQL5ic3g/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)



私有库使用

\1. 使用nrm镜像源管理工具添加源

- 
- 
- 
- 

```
npm install nrm -gnrm add cnpmorg http://42.192.37.59:7001  // 添加源nrm use cnpmorg  // 使用cnpmorg源，名字自己定义nrm ls
```

\2. 内部源使用

- 
- 
- 
- 
- 
- 
- 
- 

```
···NPM···npm config set registry 42.192.37.59:7001
···CNPM···cnpm config set registry http://42.192.37.59:7001
···YARN···yarn config set registry http://42.192.37.59:7001
```

\3. 本地项目包发布

npm login 如下图所示则登陆成功

![图片](https://mmbiz.qpic.cn/mmbiz_png/ictia63Scgnn9X9NXU7z64iasjvKkbewzjlqrNP9oZoFc963CAPrNKiapHckia6aBZuDddKwhzx9VMibPnk4xNdkRR8Q/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)



npm publish 包发布

![图片](https://mmbiz.qpic.cn/mmbiz_png/ictia63Scgnn9X9NXU7z64iasjvKkbewzjlndKbre5Yv3UQm1HUnxNIL3nslWFYxRyCW14ZmTVT701oce2wMb920Q/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)



npm view @harlie/cnpm-test 

可以看到所发布的包的详情，通过网址页面搜索cnpm-test ,可以在页面查看相应版本信息。

![图片](https://mmbiz.qpic.cn/mmbiz_png/ictia63Scgnn9X9NXU7z64iasjvKkbewzjl5eutIANbtOUniacbVicqFxu695NIBadEicTjw02RX4iaKGtlayQNvBicNCg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)



结尾

具体代码可在git仓库查看：https://github.com/HarlieYang/cnpm-harlie

或直接点击 “阅读原文”前往github代码仓库



往 · 期 · 阅 · 读

[基于NodeJS搭建博客系统](http://mp.weixin.qq.com/s?__biz=MzIwODIxMTE5OA==&mid=2649794098&idx=1&sn=9d5e504193cf7318b97641bc292cb6a9&chksm=8f029ba3b87512b566be9f0da85bd88992e7ac35d2b5966434bf241f715d4acf1f669283ed84&scene=21#wechat_redirect)

[微信小程序web-view组件与h5页面交互传值](http://mp.weixin.qq.com/s?__biz=MzIwODIxMTE5OA==&mid=2649794118&idx=1&sn=b40fe70924a95b22d36a45519aa6200e&chksm=8f029bd7b87512c1b3b3c2df5492a978b812143f695603a26d8fb81aa31eb4c3d08685ce2f3d&scene=21#wechat_redirect)

[小程序实现流畅图片裁剪功能](http://mp.weixin.qq.com/s?__biz=MzIwODIxMTE5OA==&mid=2649794071&idx=1&sn=a62bdcd43985806d08b987610c7298ec&chksm=8f029b86b87512903295bbd29194c199d4c6e786e39bc4d012ac503aad026356ec38e79db3b3&scene=21#wechat_redirect)