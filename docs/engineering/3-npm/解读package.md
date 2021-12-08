## 全方位解读 package.json

## 前言

平常在工作中，对`package.json`这个文件的接触非常非常少。

- 一些同学可能还会看一下script里面有什么命令，执行了哪些方法。
- 又或者了解一下`dependencies`和`devDependencies`
- 其他大部分的同学可能直接就`npm i`和`npm start`就开始工作了。
- 但是`package.json`的魅力远不止如此
- 今天就和我一起探索一下这个项目中不可或缺的——`package.json`吧！

## 由浅入深-核心内容

### 准备工作

手摸手新建一个空的package.json

![图片](https://mmbiz.qpic.cn/sz_mmbiz_jpg/Voibl9R35rqqNK6T3jH4O0JCfm8AIWyiab6cCYBK6R4CWbwCZAcE1Gf801c5OFM92nSddCKriaUNQHWiakH0gJllXg/640?wx_fmt=jpeg&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)img

1. `npm init`
2. `上万个回车`

或者直接执行

1. `npm init -y`
2. 其意思就是全部都略过，和我们上面的无数个回车的效果一样

先看看上面有的东西。

```
{
  "name": "package.json", # 项目名称
  "version": "1.0.0", # 项目版本（格式：大版本.次要版本.小版本）
  "description": "", # 项目描述
  "main": "index.js", # 入口文件
  "scripts": { # 指定运行脚本命令的 npm 命令行缩写
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [], # 关键词
  "author": "", # 作者
  "license": "ISC" # 许可证
}
```

### scripts（快捷脚本）

- `scripts` 字段是 `package.json` 中的一种元数据功能，它接受一个对象，对象的属性为可以通过 `npm run`运行的脚本，值为实际运行的命令（通常是终端命令），如：

```
"scripts": {
  "start": "node index.js"
},
复制代码
```

- 将终端命令放入 `scripts` 字段，既可以记录它们又可以实现轻松重用。

### dependencies & devDependencies（项目依赖）

- `dependencies` 字段指定了项目运行所依赖的模块
- 可以理解为我们的项目在生产环境运行中要用到的东西。
- 比如说我们常用的`antd`只能哪个代码块就会用到里面的组件，所以要放到`dependencies`里面去
- `devDependencies`字段指定了项目开发所需要的模块
- 开发环境会用到的东西，比如说webpack。我们打包的时候会用到，但是项目运行的时候却用不到，所以只需要放到`devDependencies`中去就好了
- 类似的`eslint`之类的

这里重点谈一下这些版本号直接的差异

#### ~1.1.1

- `~1.2.3`:= `>=1.2.3 <1.(2+1).0`:=`>=1.2.3 <1.3.0-0`
- `~1.2`:= `>=1.2.0 <1.(2+1).0`:= `>=1.2.0 <1.3.0-0`(同`1.2.x`)
- `~1`:= `>=1.0.0 <(1+1).0.0`:= `>=1.0.0 <2.0.0-0`(同`1.x`)
- `~0.2.3`:= `>=0.2.3 <0.(2+1).0`:=`>=0.2.3 <0.3.0-0`
- `~0.2`:= `>=0.2.0 <0.(2+1).0`:= `>=0.2.0 <0.3.0-0`(同`0.2.x`)
- `~0`:= `>=0.0.0 <(0+1).0.0`:= `>=0.0.0 <1.0.0-0`(同`0.x`)
- `~1.2.3-beta.2`:=`>=1.2.3-beta.2 <1.3.0-0`请注意，`1.2.3`版本中的预发布将被允许，如果它们大于或等于`beta.2`. 所以，`1.2.3-beta.4`会被允许，但 `1.2.4-beta.2`不会，因为它是不同`[major, minor, patch]`元组的预发布。

#### ^1.1.1

允许不修改`[major, minor, patch]`元组中最左边的非零元素的更改 。换句话说，这允许版本`1.0.0`及以上版本的补丁和次要更新，版本的补丁更新`0.X >=0.1.0`，以及版本的*不*更新`0.0.X`。

许多作者将`0.x`版本视为`x`主要的“重大变化”指标。

当作者可能在发行版`0.2.4`和`0.3.0`发行版之间进行重大更改时，插入符范围是理想的，这是一种常见做法。但是，它假定和之间*不会*有重大变化 。根据通常观察到的做法，它允许进行假定为附加（但不会破坏）的更改。`0.2.4``0.2.5`

- `^1.2.3` := `>=1.2.3 <2.0.0-0`
- `^0.2.3` := `>=0.2.3 <0.3.0-0`
- `^0.0.3` := `>=0.0.3 <0.0.4-0`
- `^1.2.3-beta.2`:=`>=1.2.3-beta.2 <2.0.0-0`请注意，`1.2.3`版本中的预发布将被允许，如果它们大于或等于`beta.2`. 所以，`1.2.3-beta.4`会被允许，但 `1.2.4-beta.2`不会，因为它是不同`[major, minor, patch]`元组的预发布。
- `^0.0.3-beta`:=`>=0.0.3-beta <0.0.4-0` 请注意，*仅*允许`0.0.3`版本中的预发布 ，如果它们大于或等于. 所以，会被允许。`beta``0.0.3-pr.2`

解析插入符范围时，缺失`patch`值会被减为数字`0`，但即使主要版本和次要版本都是`0`.

- `^1.2.x` := `>=1.2.0 <2.0.0-0`
- `^0.0.x` := `>=0.0.0 <0.1.0-0`
- `^0.0` := `>=0.0.0 <0.1.0-0`

缺失值`minor`和`patch`值将脱糖为零，但也允许在这些值内具有灵活性，即使主要版本为零。

- `^1.x` := `>=1.0.0 <2.0.0-0`
- `^0.x` := `>=0.0.0 <1.0.0-0`

#### 1.1.x

任何的`X`，`x`或`*`可被用来“立场在”在数字值中的一个`[major, minor, patch]`元组。

- `*`:= `>=0.0.0`(任何版本都满足)
- `1.x`:= `>=1.0.0 <2.0.0-0`(匹配主要版本)
- `1.2.x`:= `>=1.2.0 <1.3.0-0`（匹配主要和次要版本）

部分版本范围被视为 X 范围，因此特殊字符实际上是可选的。

- `""`（空字符串）:= `*`:=`>=0.0.0`
- `1`:= `1.x.x`:=`>=1.0.0 <2.0.0-0`
- `1.2`:= `1.2.x`:=`>=1.2.0 <1.3.0-0`

#### 1.1.1 - 1.1.2

指定一个包含集。

- `1.2.3 - 2.3.4` := `>=1.2.3 <=2.3.4`

如果部分版本作为包含范围中的第一个版本提供，则缺失的部分将替换为零。

- `1.2 - 2.3.4` := `>=1.2.0 <=2.3.4`

如果部分版本作为包含范围中的第二个版本提供，则接受以元组提供的部分开头的所有版本，但不会大于提供的元组部分。

- `1.2.3 - 2.3` := `>=1.2.3 <2.4.0-0`
- `1.2.3 - 2` := `>=1.2.3 <3.0.0-0`

### engines（指定项目 node 版本）

- 有时候，新拉一个项目的时候，由于和其他开发使用的 `node` 版本不同，导致会出现很多奇奇怪怪的问题（如某些依赖安装报错、依赖安装完项目跑步起来等）。
- 为了实现项目开箱即用的伟大理想，这时候可以使用 `package.json` 的 `engines` 字段来指定项目 node 版本：

```
"engines": {
   "node": ">= 8.16.0"
},
复制代码
```

- 该字段也可以指定适用的 `npm` 版本：

```
"engines": {
   "npm": ">= 6.9.0"
 },
复制代码
```

- 需要注意的是，engines属性仅起到一个说明的作用，当用户版本不符合指定值时也不影响依赖的安装。

### os（模块适用系统）

- 假如我们开发了一个模块，只能跑在 `darwin` 系统下，我们需要保证 `windows` 用户不会安装到该模块，从而避免发生不必要的错误。
- 这时候，使用 `os` 属性则可以帮助我们实现以上的需求，该属性可以指定模块适用系统的系统，或者指定不能安装的系统黑名单（当在系统黑名单中的系统中安装模块则会报错）：

```
"os" : [ "darwin", "linux" ] # 适用系统
"os" : [ "!win32" ] # 黑名单
复制代码
```

> Tips：在 `node` 环境下可以使用 `process.platform` 来判断操作系统。

### cpu（指定模块适用 cpu 架构）

- 和上面的 `os` 字段类似，我们可以用 `cpu` 字段更精准的限制用户安装环境：

```
"cpu" : [ "x64", "ia32" ] # 适用 cpu
"cpu" : [ "!arm", "!mips" ] # 黑名单
复制代码
```

> Tips：在 `node` 环境下可以使用 `process.arch` 来判断 `cpu` 架构。

### private（定义私有模块）

- 一般公司的非开源项目，都会设置 `private` 属性的值为 `true`，这是因为 `npm` 拒绝发布私有模块，通过设置该字段可以防止私有模块被无意间发布出去。

## 次重要（可以当百科全书）

### name（项目名称）

- 这个名称和你要发布项目到`npm`上的有关系。
- 假如你不想发布的话那这个`name`和`version`就不是必填项了

名字就是你的东西叫什么。（name名称）和（version版本号）构成一个唯一的标识符。

名称的一些规则：

- 名称必须小于或等于 214 个字符。这包括范围包的范围。
- 作用域包的名称可以以点或下划线开头。这在没有范围的情况下是不允许的。
- 新包的名称中不得包含大写字母。
- 该名称最终成为 URL 的一部分、命令行上的参数和文件夹名称。因此，名称不能包含任何非 URL 安全字符。

一些技巧：

- 不要使用与核心节点模块相同的名称。
- 不要在名称中加入“js”或“node”。假设它是 js，因为您正在编写 package.json 文件，并且您可以使用“engines”字段指定引擎。（见下文。）
- 该名称可能会作为参数传递给 require()，因此它应该是简短的，但也应该具有合理的描述性。
- 您可能需要检查 npm 注册表以查看是否已经存在使用该名称的内容，以免过于依赖它。https://www.npmjs.com/
- 方法一：直接到npm官网去搜
- 方法二：`npm view <packageName>`

如果模块存在，可以查看该模块的一些基本信息：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)img

如果该模块名从未被使用过，则会抛出 404 错误：

![图片](data:image/gif;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==)img

### version（版本号）

- `version`和`name`组成在`npm`内部的一个唯一标识符。
- 假如你不想发布的话那这个`name`和`version`就不是必填项了
- 版本必须可由node-semver解析 ，它作为依赖项与 npm 捆绑在一起。（`npm install semver`自己使用。）
- 我们可以执行以下命令查看模块的版本：

```
npm view <packageName> version # 查看某个模块的最新版本
npm view <packageName> versions # 查看某个模块的所有历史版本
```

- `npm view <packageName> version`

### description（项目描述）

此文档是您需要了解的有关 `package.json` 文件中所需内容的全部信息。它必须是实际的 `JSON`，而不仅仅是 `JavaScript`对象文字。

本文档中描述的许多行为受 中描述的配置设置的影响`config`。

### keywords

把关键字放进去。它是一个字符串数组。这有助于人们发现您的包裹，因为它在 中列出`npm search`。

### homepage（项目主页）

项目主页的`url`。

例子：

```
"homepage" ：“https://github.com/owner/project#readme”
```

### bugs（问题追踪）

项目问题跟踪器的 url 和/或应报告问题的电子邮件地址。这些对于遇到包裹问题的人很有帮助。

它应该是这样的：

```
{
  "url" : "https://github.com/owner/project/issues" ,  
  "email" ："project@hostname.com"
}
```

您可以指定一个或两个值。如果您只想提供一个 url，您可以将“bugs”的值指定为一个简单的字符串而不是一个对象。

如果提供了`url`，它将被`npm bugs`命令使用。

### license（执照）

你应该为你的包指定一个许可证，以便人们知道他们如何被允许使用它，以及你对它施加的任何限制。

如果您使用的是 BSD-2-Clause 或 MIT 等通用许可证，请为您使用的许可证添加当前的`SPDX` 许可证标识符，如下所示：

```
{
  "license" : "BSD-3-Clause"
}
```

您可以查看SPDX 许可证 ID 的完整列表。理想情况下，您应该选择 OSI批准的一种。

如果您的软件包在多个通用许可下获得许可，请使用SPDX 许可表达式语法版本 2.0 string，如下所示：

```
{
  "license" : "(ISC OR GPL-3.0)"
}
```

如果您使用的许可证尚未分配`SPDX` 标识符，或者您使用的是自定义许可证，请使用如下字符串值：

```
{
  "license" : "SEE LICENSE IN <filename>"
}
```

然后包含一个`<filename>`在包的顶层命名的文件。

一些旧包使用许可证对象或包含许可证对象数组的“许可证”属性：

```
// 无效的元数据
{
  "license" : {
    "type" : "ISC",
    "url" : "https://opensource.org/licenses/ISC"
  }
}

// 无效的元数据
{
  "licenses" : [
    {
      "type": "MIT",
      "url": "https://www.opensource.org/licenses/mit-license.php"
    },
    {
      "type": "Apache-2.0",
      "url": "https://opensource.org/licenses/apache2.0.php"
    }
  ]
}
```

这些样式现在已被弃用。相反，使用`SPDX`表达式，如下所示：

```
{
  "license": "ISC"
}
{
  "license": "(MIT OR Apache-2.0)"
}
```

最后，如果您不希望根据任何条款授予他人使用私有或未发布包的权利：

```
{
  "license": "UNLICENSED"
}
```

还要考虑设置`"private": true`以防止意外发布。

### author, contributors（作者和贡献者）

“作者”是一个人。“贡献者”是一群人。“person”是一个带有“name”字段和可选的“url”和“email”的对象，像这样：

```
{
  "name" : "Barney Rubble",
  "email" : "b@rubble.com",
  "url" : "http://barnyrubble.tumblr.com/"
}
```

或者，您可以将其全部缩短为一个字符串，然后 npm 将为您解析它：

```
{
  "author": "Barney Rubble <b@rubble.com> (http://barnyrubble.tumblr.com/)"
}
```

email 和 url 都是可选的。

npm 还使用您的 npm 用户信息设置顶级“维护者”字段。

### funding（档案）

可选`files`字段是一个文件模式数组，它描述了当您的包作为依赖项安装时要包含的条目。文件模式遵循与 类似的语法`.gitignore`，但相反：包含文件、目录或 glob 模式（`*`,`**/*`等）将使该文件在打包时包含在 tarball 中。省略该字段将使其默认为`["*"]`，这意味着它将包含所有文件。

一些特殊的文件和目录也会被包含或排除，无论它们是否存在于`files`数组中（见下文）。

您还可以`.npmignore`在包的根目录或子目录中提供一个文件，以防止文件被包含在内。在包的根目录中，它不会覆盖“文件”字段，但在子目录中会覆盖。该`.npmignore`文件就像一个`.gitignore`. 如果有一个`.gitignore`文件，并且`.npmignore`丢失了，`.gitignore`则将使用 的内容。

文件包含了“的package.json＃文件”栏中*无法*通过排除`.npmignore`或`.gitignore`。

无论设置如何，始终包含某些文件：

- `package.json`
- `README`
- `CHANGES`/ `CHANGELOG`/`HISTORY`
- `LICENSE` / `LICENCE`
- `NOTICE`
- “主要”字段中的文件

`README`, `CHANGES`, `LICENSE`&`NOTICE`可以有任何大小写和扩展名。

相反，一些文件总是被忽略：

- `.git`
- `CVS`
- `.svn`
- `.hg`
- `.lock-wscript`
- `.wafpickle-N`
- `.*.swp`
- `.DS_Store`
- `._*`
- `npm-debug.log`
- `.npmrc`
- `node_modules`
- `config.gypi`
- `*.orig`
- `package-lock.json`（ `npm-shrinkwrap.json`如果您希望发布，请使用）

### main（主要入口）

- `main` 字段是 `package.json` 中的另一种元数据功能，它可以用来指定加载的入口文件。假如你的项目是一个 `npm` 包，当用户安装你的包后，`require('my-module')` 返回的是 `main` 字段中所列出文件的 `module.exports` 属性。
- 当不指定`main` 字段时，默认值是模块根目录下面的`index.js` 文件。

### browser（浏览器）

如果您的模块打算在客户端使用，则应使用浏览器字段而不是主字段。这有助于提示用户它可能依赖于 Node.js 模块中不可用的原语。（例如 `window`）

### bin（自定义命令）

很多包都有一个或多个他们想要安装到 PATH 中的可执行文件。npm 使这变得非常简单（实际上，它使用此功能来安装“npm”可执行文件。）

要使用它，请`bin`在 package.json 中提供一个字段，它是命令名到本地文件名的映射。在安装时，npm 会将该文件符号链接到`prefix/bin`全局安装或`./node_modules/.bin/`本地安装。

给大家看看我自己做一个简单的demo：

```
{
  "name": "react-cli-library",
  "version": "0.0.2",
  "description": "",
  "bin": {
    "react-cli": "./bin/index.js"
  },
}
```

我的名称叫做react-cli-library。

所以，`npm i react-cli-library`

安装完成之后，执行react-cli就会有一些命令，他会执行我的根目录底下`./bin/index.js`这个文件。

虽然我的项目名称是：`react-cli-library`。但是我执行的内容却是`react-cli`，这个取决于bin的内容

### man（快捷入口）

用来给Linux下的man命令查找文档地址，是个单一文件或者文件数组。如果是单一文件，安装完成后，他就是man + 的结果，和此文件名无关，例如：

```
{
  "name": "foo",
  "version": "1.2.3",
  "description": "A packaged foo fooer for fooing foos",
  "main": "foo.js",
  "man": "./man/doc.1"
}
```

通过man foo命令会得到 ./man/doc.1 文件的内容。如果man文件名称不是以模块名称开头的，安装的时候会给加上模块名称前缀。因此，下面这段配置：

```
{
  "name": "foo",
  "version": "1.2.3",
  "description": "A packaged foo fooer for fooing foos",
  "main": "foo.js",
  "man": [
    "./man/foo.1",
    "./man/bar.1"
  ]
}
```

会创建一些文件来作为man foo和man foo-bar命令的结果。man文件必须以数字结尾，或者如果被压缩了，以.gz结尾。数字表示文件将被安装到man的哪个部分。

```
{
  "name": "foo",
  "version": "1.2.3",
  "description": "A packaged foo fooer for fooing foos",
  "main": "foo.js",
  "man": [
    "./man/foo.1",
    "./man/foo.2"
  ]
}
```

会创建 man foo 和 man 2 foo 两条命令。

### directories（目录）

CommonJS Packages规范详细说明了一些可以使用`directories`对象指示包结构的方法。如果您查看npm 的 package.json，您会看到它包含 doc、lib 和 man 目录。

将来，这些信息可能会以其他创造性的方式使用。

### 目录.bin

如果在 中指定`bin`目录`directories.bin`，则将添加该文件夹中的所有文件。

由于`bin`指令的工作方式，同时指定`bin`路径和设置`directories.bin`是错误的。如果要指定单个文件，请使用`bin`，对于现有`bin` 目录中的所有文件，请使用`directories.bin`。

### 目录.man

一个充满手册页的文件夹。Sugar 通过遍历文件夹来生成“man”数组。

### repository（代码存储位置）

指定代码所在的位置。这对想要贡献的人很有帮助。如果 git repo 在 GitHub 上，那么该`npm docs` 命令将能够找到您。

像这样做：

```
{
  "repository": {
    "type": "git",
    "url": "https://github.com/npm/cli.git"
  }
}
```

URL 应该是一个公开可用的（可能是只读的）url，可以直接传递给 VCS 程序，无需任何修改。它不应该是您放入浏览器的 html 项目页面的 url。是给电脑用的。

对于 GitHub、GitHub gist、Bitbucket 或 GitLab 存储库，您可以使用与 相同的快捷语法`npm install`：

```
{
  "repository": "npm/npm",

  "repository": "github:user/repo",

  "repository": "gist:11081aaa281",

  "repository": "bitbucket:user/repo",

  "repository": "gitlab:user/repo"
}
```

如果`package.json`您的包的 不在根目录中（例如，如果它是 monorepo 的一部分），您可以指定它所在的目录：

```
{
  "repository": {
    "type": "git",
    "url": "https://github.com/facebook/react.git",
    "directory": "packages/react-dom"
  }
}
```

### config（配置内容）

“config”对象可用于设置在升级过程中持续存在的包脚本中使用的配置参数。例如，如果一个包具有以下内容：

```
{
  "name": "foo",
  "config": {
    "port": "8080"
  }
}
```

然后有一个“开始”命令，然后引用 `npm_package_config_port`环境变量，然后用户可以通过执行`npm config set foo:port 8001`.

查看`config`和`scripts`了解更多关于包配置的信息。

### peerDependencies（对等依赖）

在某些情况下，您希望表达您的包与主机工具或库的兼容性，而不必执行`require`此主机的操作。这通常称为*插件*。值得注意的是，您的模块可能会公开主机文档所预期和指定的特定接口。

例如：

```
{
  "name": "tea-latte",
  "version": "1.3.5",
  "peerDependencies": {
    "tea": "2.x"
  }
}
```

这确保您的软件包`tea-latte`只能与主机软件包的第二个主要版本*一起*安装`tea`。`npm install tea-latte`可能会产生以下依赖图：

```
├── tea-latte@1.3.5
└── tea@2.2.0
```

在 npm 版本 3 到 6 中，`peerDependencies`不会自动安装，如果在树中发现对等依赖项的无效版本，则会发出警告。由于NPM V7的，peerDependencies*被* 默认安装。

如果无法正确解析树，尝试安装具有冲突要求的另一个插件可能会导致错误。因此，请确保您的插件要求尽可能广泛，而不是将其锁定为特定的补丁版本。

假设主机符合semver，只有主机包的主要版本中的更改才会破坏您的插件。因此，如果您使用过主机包的每个 1.x 版本，请使用`"^1.0"`或`"1.x"` 来表达这一点。如果您依赖 1.5.2 中引入的功能，请使用 `"^1.5.2"`.

### peerDependenciesMeta（捆绑依赖）

这定义了在发布包时将捆绑的包名称数组。

如果您需要在本地保留 npm 包或通过单个文件下载使它们可用，您可以通过在`bundledDependencies` 数组中指定包名称并执行`npm pack`.

例如：

如果我们像这样定义 package.json：

```
{
  "name": "awesome-web-framework",
  "version": "1.0.0",
  "bundledDependencies": [
    "renderized",
    "super-streams"
  ]
}
```

我们可以`awesome-web-framework-1.0.0.tgz`通过运行获取文件`npm pack`。此文件包含的依赖关系`renderized`，并`super-streams`可以通过执行安装在一个新的项目`npm install awesome-web-framework-1.0.0.tgz`。请注意，包名称不包含任何版本，因为该信息在`dependencies`.

如果这是拼写`"bundleDependencies"`，那么这也很荣幸。

### optionalDependencies（可选依赖项）

如果可以使用依赖项，但如果找不到或安装失败，您希望 npm 继续，那么您可以将其放入 `optionalDependencies`对象中。这是包名称到版本或 url 的映射，就像`dependencies`对象一样。不同之处在于构建失败不会导致安装失败。运行`npm install --no-optional`将阻止安装这些依赖项。

处理缺少依赖项仍然是您的程序的责任。例如，这样的事情：

```
try {
  var foo = require('foo')
  var fooVersion = require('foo/package.json').version
} catch (er) {
  foo = null
}
if ( notGoodFooVersion(fooVersion) ) {
  foo = null
}

// .. then later in your program ..

if (foo) {
  foo.doFooThings()
}
```

中的条目`optionalDependencies`将覆盖 中的同名条目 `dependencies`，因此通常最好只放在一个地方。

### publishConfig（发布配置）

这是一组将在发布时使用的配置值。如果您想设置标记、注册表或访问权限，这将特别方便，这样您就可以确保给定的包没有被标记为“最新”、未发布到全局公共注册表或默认情况下范围模块是私有的。

查看`config`可覆盖的配置选项列表。

### workspaces（工作区）

可选`workspaces`字段是一个文件模式数组，它描述了本地文件系统内的位置，安装客户端应该查找这些位置以找到需要符号链接到顶级文件夹的每个工作区`node_modules`。

它可以描述要用作工作区的文件夹的直接路径，也可以定义将解析为这些相同文件夹的 glob。

在以下示例中，`./packages`只要文件夹中包含有效`package.json`文件，位于文件夹内的所有文件夹 都将被视为工作区 ：

```
{
  "name": "workspace-example",
  "workspaces": [
    "./packages/*"
  ]
}
```

有关`workspaces`更多示例，请参见。