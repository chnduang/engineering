# 实例解析：如何开发 VSCode LSP 服务

> [https://mp.weixin.qq.com/s/kIntNVMXae_wMD5t5NJ8ag](https://mp.weixin.qq.com/s/kIntNVMXae_wMD5t5NJ8ag)

从一张动图说起：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktW9RLdxPscMcF0aWfHTRSE05Wl7LvTt1cVsww4G27ibzoJOewCf7oq3sQ/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

上图应该大家经常使用的**「错误诊断」** 功能，它能够在你编写代码的过程中提示，那一块代码存在什么类型的问题。

这个看似高大上的功能，从插件开发者的角度看其实特别简单，基本上就是上一篇文章《[你不知道的 VSCode 代码高亮原理](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484259&idx=1&sn=afc05ec9cec29e4e1b7a750356b30502&scene=21#wechat_redirect)》中简单介绍过的 VSCode 开发语言特性的三种方案：

- 基于 **「Sematic Tokens Provider」** 协议的词法高亮
- 基于 **「Language API」** 的编程式语法高亮
- 基于 **「Language Server Protocol」** 的多进程架构语法高亮

其中， **「Language Server Protocol」** 由于性能与开发效率上的优势已经逐渐成为主流实现方案，本文接下来会基于 LSP 展开介绍各种语言特性的实现细节，解答 LSP 的通讯模型与开发模式。

# 示例代码

本文示例均已同步到 Github，建议读者先拉下代码实际体验：

```
# 1. clone 示例代码
git clone git@github.com:Tecvan-fe/vscode-lsp-sample.git
# 2. 安装依赖
npm i # or yarn
# 3. 使用 vscode 打开示例代码
code ./vscode-lsp-sample
# 4. 在 vscode 中按下 F5 启动调试
```

顺利执行完毕后，可以看到插件的调试窗口：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWyJLIKic6MtJU1iacDylTE2icBEZL8nbpQU3l8pjgk61fPrpGhZMDovLKQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

核心代码有：

- `server/src/server.ts`：LSP 服务端代码，提供代码补全、错误诊断、代码提示等常见语言功能的示例

- `client/src/extension.ts`：提供一系列 LSP 参数，包括 Server 的调试端口、代码入口、通讯方式等。

- `packages.json`：主要提供了语法插件所需要的配置信息，包括：

- - `activationEvents`：声明插件的激活条件，代码中的 `onLanguage:plaintext` 意为打开 txt 文本文件时激活
  - `main`：插件的入口文件

其中，`client/src/extension.ts` 与 `packages.json` 都比较简单，本文不过多介绍，重点在于 `server/src/server.ts` 文件，接下来我们逐步拆解，解析不同语言特性的实现细节。

# 如何编写 Language Server

## Server 结构解析

示例项目的 `server/src/server.ts` 实现了一个小型但完整的 Language Server 应用，核心代码：

```
// 要素1： 初始化 LSP 连接对象
const connection = createConnection(ProposedFeatures.all);

// 要素2： 创建文档集合对象，用于映射到实际文档
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

connection.onInitialize((params: InitializeParams) => {
  // 要素3： 显式声明插件支持的语言特性
  const result: InitializeResult = {
    capabilities: {
      hoverProvider: true
    },
  };
  return result;
});

// 要素4： 将文档集合对象关联到连接对象
documents.listen(connection);

// 要素5： 开始监听连接对象
connection.listen();
```

从示例代码可以总结出 Language Server 的 5 个必要步骤：

- 创建 `connection` 对象，用于实现客户端与服务器之间的信息互通
- 创建 `documents` 文档集合对象，用于映射客户端正在编辑的文件
- 在 `connection.onInitialize` 事件中，显式声明插件支持的语法特性，例如上例中返回对象包含 `hoverProvider: true` 声明，表示该插件能够提供代码悬停提示功能
- 将 `documents` 关联到 `connection` 对象
- 调用 `connection.listen` 函数，开始监听客户端消息

> 上述 
>
> ```
> connection
> ```
>
>  、
>
> ```
> documents
> ```
>
>  等对象定义在 npm 包：
>
> - `vscode-languageserver/node`
> - `vscode-languageserver-textdocument`

这是一个基本模板，主要完成了 Language Server 各种初始化操作，后续就可以使用 `connection.onXXX` 或 `documents.onXXX` 监听各类交互事件，并在事件回调中返回符合 LSP 协议的结果，或者显式调用通讯函数如 `connection.sendDiagnostics` 发送交互信息。

接下来我们通过几个简单实例，分析各项语言特性的实现逻辑。

## 悬停提示

当鼠标停留在语言元素如函数、变量、符号等 token 时，VSCode 会显示 token 对应描述与帮助信息：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWp2Fc5oO9LsB4hiaXxRKGN6Q3N7Pdo1GeqA6slthne69JV3vflpPDYYQ/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

要实现悬停提示功能，首先需要声明插件支持 `hoverProvider` 特性：

```
connection.onInitialize((params: InitializeParams) => {
  return {
    capabilities: {
      hoverProvider: true
    },
  };
});
```

之后，需要监听 `connection.onHover` 事件，并在事件回调中返回提示信息：

```
connection.onHover((params: HoverParams): Promise<Hover> => {
  return Promise.resolve({
    contents: ["Hover Demo"],
  });
});
```

OK，这就是一个很简单的语言特性示例了，本质上就是监听事件 + 返回结果，非常简单。

## 代码格式化

代码格式化是一个特别有用的功能，能够帮助用户快速、自动完成代码的美化处理，实现效果如：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWIic6yibkbS5uFaZ3INFibMgyJD447pm91ydYayFqaufdV6tfHzWoCnPtg/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

实现悬停提示功能，首先需要声明插件支持 `documentFormattingProvider` 特性：

```
{
    ...
    capabilities : {
        documentFormattingProvider: true
        ...
    }
}
```

之后，监听 `onDocumentFormatting` 事件：

```
connection.onDocumentFormatting(
  (params: DocumentFormattingParams): Promise<TextEdit[]> => {
    const { textDocument } = params;
    const doc = documents.get(textDocument.uri)!;
    const text = doc.getText();
    const pattern = /\b[A-Z]{3,}\b/g;
    let match;
    const res = [];
    // 查找连续大写字符串
    while ((match = pattern.exec(text))) {
      res.push({
        range: {
          start: doc.positionAt(match.index),
          end: doc.positionAt(match.index + match[0].length),
        },
        // 将大写字符串替换为 驼峰风格
        newText: match[0].replace(/(?<=[A-Z])[A-Z]+/, (r) => r.toLowerCase()),
      });
    }

    return Promise.resolve(res);
  }
);
```

示例代码中，回调函数主要实现将连续大写字符串格式化为驼峰字符串，效果如图：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktW9YvaVxiaqibpdoqaD74JMf0bxQ0D9CK82XclYpL1vKxPjRV3UIq62K7A/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

## 函数签名

函数签名特性在用户输入函数调用语法时触发，此时 VSCode 会根据 Language Server 返回的内容，显示该函数的帮助信息。

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWBJCOarcyRJRVjhPucLLBLrmIZ451xF9B7YlksuZI7xTmpdvjlBhWVQ/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

实现函数签名功能，需要首先声明插件支持 `documentFormattingProvider` 特性：

```
{
    ...
    capabilities : {
        signatureHelpProvider: {
            triggerCharacters: ["("],
        }
        ...
    }
}
```

之后，监听 `onSignatureHelp` 事件：

```
connection.onSignatureHelp(
  (params: SignatureHelpParams): Promise<SignatureHelp> => {
    return Promise.resolve({
      signatures: [
        {
          label: "Signature Demo",
          documentation: "帮助文档",
          parameters: [
            {
              label: "@p1 first param",
              documentation: "参数说明",
            },
          ],
        },
      ],
      activeSignature: 0,
      activeParameter: 0,
    });
  }
);
```

实现效果：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWGyponCNck3u29cJS8ZVIUBRLMIfrib32EpDBGQadB3QIF6LKTK94dAQ/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

## 错误提示

注意，错误提示的实现逻辑与上述事件 + 响应的模式有一点点不同：

- 首先不需要通过`capabilities` 做额外声明；
- 监听的是 `documents.onDidChangeContent` 事件，而不是 `connection` 对象上的事件
- 不是在事件回调中用 `return` 语句返回错误信息，而是调用 `connection.sendDiagnostics` 发送错误消息

完整示例：

```
// 增量错误诊断
documents.onDidChangeContent((change) => {
  const textDocument = change.document;

  // The validator creates diagnostics for all uppercase words length 2 and more
  const text = textDocument.getText();
  const pattern = /\b[A-Z]{2,}\b/g;
  let m: RegExpExecArray | null;

  let problems = 0;
  const diagnostics: Diagnostic[] = [];
  while ((m = pattern.exec(text))) {
    problems++;
    const diagnostic: Diagnostic = {
      severity: DiagnosticSeverity.Warning,
      range: {
        start: textDocument.positionAt(m.index),
        end: textDocument.positionAt(m.index + m[0].length),
      },
      message: `${m[0]} is all uppercase.`,
      source: "Diagnostics Demo",
    };
    diagnostics.push(diagnostic);
  }

  // Send the computed diagnostics to VSCode.
  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
});
```

这段逻辑诊断代码中是否存在连续大写字符串，通过 `sendDiagnostics` 发送相应的错误信息，实现效果：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWH0M3Qy8Xy1AnSegzSfKTmxbQicwJ05MYDZo32gnukiaVpPhFoJj69zvg/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

## 如何识别事件与响应体

上述示例，我有意忽略大多数实现细节，更关注实现语言特性的基本框架和输入输出。授人以鱼不如授人以渔，所以接下来我们花一点点时间了解从哪里获取这些接口、参数、响应体的信息。有两个非常重要的链接：

- https://zjsms.com/egWtqPj/ ， VSCode 官网关于可编程语言特性的说明文档
- https://zjsms.com/egWVTPg/ ，LSP 协议官网

这两个网页提供了 VSCode 所支持的所有语言特性的详细介绍，可以在这里找到你想要实现的特性的概念性描述，例如对于代码补齐：

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWWY0xygPd3PGg6POficTSvAiaNNBFRduJfhyvNLddo6vvp5KzTP4HTWuQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

嗯，有点复杂且太过 detail，不过还是很有必要耐心了解下，让你对即将要做的事情有一个高层概念上的理解。

此外，如果你选择使用 TS 编写 LSP，事情会变得更简单。`vscode-languageserver`包提供了非常完善的 Typescript 类型定义，我们完全可以借助 ts + VSCode 的代码提示找到需要使用的监听函数：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWibacDMqZCgnkiaZ5x621ibGsYOL1fabsE0lhL6OJ5DEL90U4n6dPezvlQ/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

之后，根据函数签名找到参数、结果的类型定义：

![图片](https://mmbiz.qpic.cn/mmbiz_gif/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWk52bGO4bW4SYWgbTBztmic76YNk2lp8ddRic9JjvWW2p0hZyvib5TUxkw/640?wx_fmt=gif&tp=webp&wxfrom=5&wx_lazy=1)

之后，就可以根据类型定义，有针对性地处理参数，返回对应结构的数据。

# 深入理解 LSP

看完示例后，我们再反过头来看看 LSP。LSP —— Language Server Protocol 本质上是一种基于 JSON-RPC 的进程间通讯协议，LSP 本身包含两大块内容：

- 定义 client 与 server 之间的通讯模型，也就是谁、在什么时候、以什么方式向对方发送什么格式的信息，接收方又以什么方式返回响应信息
- 定义通讯信息体，也就是以什么格式、什么字段、什么样的值表达信息状态

作为类比，HTTP 协议专门用于描述网络节点间如何传输、理解超媒体文档的网络通讯协议；而 LSP 协议则专门用于描述 IDE 中，用户行为与响应之间的通讯方式与信息结构。

总结一下，LSP 架构的工作流程如下：

- 编辑器如 VSCode 跟踪、计算、管理用户行为模型，在发生某些特定的行为序列时，以 LSP 协议规定的通讯方式向 Language Server 发送动作与上下文参数
- Language Server 根据这些参数异步地返回响应信息
- 编辑器再根据响应信息处理交互反馈

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWShvEciaE34ICzdkO3c6vIo5PIgBRczwbqGvJr5cN82iaCxcp2AFcQoDQ/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

简单说，编辑器负责与用户直接交互， Language Server 负责在背后默默计算如何响应用户的交互动作，两者以进程粒度分离、解耦，在 LSP 协议框架下各司其职又协作共生。就好像我们通常开发的 Web 应用中，前端负责与用户交互，服务端负责管理诸如权限、业务数据、业务状态流转等不可见的部分。

目前，LSP 协议已经发展到 3.16 版本，覆盖大多数语言特性，包括：

- 代码补全
- 代码高亮
- 定义跳转
- 类型推断
- 错误检测
- 等等

得益于 LSP 清晰的设计，这些语言特性的开发套路都很相似，学习曲线很平滑，开发的时候基本上只需要关心监听那个函数，返回什么格式的结构，可以说掌握上述几个示例之后就可以很简单地上手了。

过去，IDE 对语言特性的支持是集成在 IDE 或者以同构插件形式实现的，在 VSCode 中这种同构扩展能力以 **「Language API」** 或 **「Sematic Tokens Provider」** 接口方式提供，这两种方式在上一篇文章《[你不知道的 VSCode 代码高亮原理](https://mp.weixin.qq.com/s?__biz=Mzg3OTYwMjcxMA==&mid=2247484259&idx=1&sn=afc05ec9cec29e4e1b7a750356b30502&scene=21#wechat_redirect)》都有过介绍了，虽然架构上比较简单，容易理解，但有一些明显硬伤：

- 插件开发者必须复用 VSCode 本身的开发语言、环境，例如 Python 语言插件就必须用 JavaScript 写
- 同一个编程语言需要为不同 IDE 重复开发相似的扩展插件，重复投入

![图片](https://mmbiz.qpic.cn/mmbiz_png/3xDuJ3eiciblkLunDick5KwwyaIbVdEzktWNSKia0ic3JY24rVQJ8HsldibHAD1yQiaLkhRkwXdibIMSJoPthmIjG5m48w/640?wx_fmt=png&tp=webp&wxfrom=5&wx_lazy=1&wx_co=1)

LSP 最大的优势就是将 IDE 客户端与实际计算交互特性的服务端隔离开来，同一个 Language Service 可以重复应用在多个不同 Language Client 中。

此外，LSP 协议下客户端、服务器分别在各自进程运行，在性能上也会有正向收益：

- 确保 UI 进程不卡顿
- Node 环境下，充分利用多核 CPU 能力
- 由于不再限定 Language Server 的技术栈，开发者可以选择更高性能的语言，例如 Go

总的来说，就是很强。

# 总结

本文介绍了 VSCode 下，开发一款基于 LSP 的语言插件所需要具备的最最基本的技能，实际开发的时候通常还会混合另一种技术：嵌入式语法 —— Embedded Languages Server ，实现复杂的多语言复合支持，如果有人感兴趣，我们下周可以聊聊。赞19在看8