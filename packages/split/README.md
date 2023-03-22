# @stream-toolbox/split

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/split" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/split.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/split" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/split.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/split/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/split.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/split" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/split.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> ✂️ Split a [readable stream](https://nodejs.org/api/stream.html#readable-streams) into multiple readable streams by size or [Buffer](https://nodejs.org/api/buffer.html).

## Installation

```bash
npm i @stream-toolbox/split
```

## Quick Start

Split a file into multiple 1024-bytes sub-files:

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

// "spliter" is a writable stream，data writed to it will divide into 1024-bytes part，this callback function will be called when part created.
const spliter = createSpliter(1024, (part, next) => {
  // every "part" is a readable stream，and "next" is a function，when "part" end，"next" need to be called to create next part.
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => next(null));
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

> - If the size of the source file is an integer multiple of 1024, then only ("size of source file" / 1024) sub-files will be created.
> - If the size of the source file is not a multiple of 1024, the size of the last sub-file will be less than 1024 bytes, but the sum of the sizes of all sub-files equals the size of the source file.
> - If the size of the source file is 0 bytes, a 0-byte sub-file will be created.

Split a file into multiple sub-files by `"\n"`, that is, create a sub-file for each line of the source file:

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

const spliter = createSpliter("\n", (part, next) => {
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => next(null));
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

Split a file into two sub-files by `"|"`, that is, the content before `"|"` is one file, and the content after `"|"` is another file:

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

const spliter = createSpliter("|", (part, next) => {
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => {
      if (part.index === 0) {
        // The second parameter of "next" can be used to update the termination condition of the next part
        // If not passed, it will remain the same as the current part
        // Set to "Infinity" means next part will end when it's size reaches "Infinity"
        // obviously, we can't reach "Infinity", so, all subsequent content will added to the next part
        next(null, Infinity);
      } else {
        next(null);
      }
    });
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

> - `"|"` will neither appear at the end of the first sub-file nor at the beginning of the second sub-file.
> - If there are multiple `"|"`s in the source file, only two sub-files will be created, because the termination condition for the second sub-file is no longer "stop when `"|"` is encountered".

The callback function of `createSpliter` can also be `async function`, at this time there is no need to manually call the `next` function:

```js
const join = require("@stream-toolbox/join");
const createSpliter = require("@stream-toolbox/split");

join(["foo", "bar", "baz"], "|")
  .pipe(
    createSpliter("|", async (part) => {
      console.log("on part", part.index);
      for await (const chunk of part) {
        console.log(`${chunk}`);
      }
    })
  )
  .on("finish", () => {
    console.log("finish");
  });
// output:
//
// on part 0
// foo
// on part 1
// bar
// on part 2
// baz
// finish
```

> If you need to update the termination condition of the next part, just `return` the new termination condition at the end of `aysnc function`.

## Summarize

`@stream-toolbox/split` also supports adding a fixed header or tail to each part, and also supports retaining the `string` or `Buffer` seperator in the end of the part. For details, please refer to [index.d.ts](https://www.npmjs.com/package/@stream-toolbox/split?activeTab=code) file or [source code](https://github.com/haochuan9421/stream-toolbox/blob/master/packages/split/index.ts), There are detailed comments in the source code, and it is not very complicated.

After reading the above demos, you should already know how to use `@stream-toolbox/split`, it's very flexible.When the seperator is `number`, the source readable stream will be split by size, When the seperator is `string` or `Buffer`, it will be split by the given bytes. Moreover, the two methods can be used interchangeably. When current part is end, the termination condition of the next part can be set through the "next" function or resolved value of Promise.

The split process of the readable stream is completely in streaming way. The data of part will not be all accumulated in memory to check whether the termination condition is met. Instead, a part will be created immediately when it can be created. When the transmitted data is not enough to trigger the termination condition of the current part, the data will be forwarded to the sub-readable stream immediately, and the current sub-readable stream will be ended only when the termination condition is met. When using [pipe](https://nodejs.org/api/stream.html#readablepipedestination-options) to transfer data from the source-readable stream to the "spliter", if you stop reading the content of current part, the source-readable stream will also be paused, that is, `spliter` supports [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams), in short `@stream-toolbox/split` is a memory friendly tool.

---

> ✂️ 将一个[可读流](https://nodejs.org/api/stream.html#readable-streams)按大小或特定 [Buffer](https://nodejs.org/api/buffer.html) 分割成多个可读流。

## 安装

```bash
npm i @stream-toolbox/split
```

## 快速开始

将一个文件按照 1024 字节的大小划分成多个子文件：

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

// spliter 是一个可写流，写入到 spliter 的数据会按 1024 字节被划分成多个区块（part），当区块创建时回调函数会触发
const spliter = createSpliter(1024, (part, next) => {
  // 每个区块 (part) 都是一个可读流，next 是一个函数，当区块读取完毕后，需执行 next 方法创建下一个区块
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => next(null));
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

> - 如果源文件的大小是 1024 的整数倍，则只会创建 (源文件的大小 / 1024) 个子文件。
> - 如果源文件的大小不是 1024 的整数倍，则最后一个子文件的大小会不足 1024 字节，但所有子文件的大小相加等于源文件的大小。
> - 如果源文件的大小是 0 字节，则会创建一个 0 字节的子文件。

将一个文件按照 `"\n"` 划分成多个子文件，也即为源文件的每一行创建一个子文件：

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

const spliter = createSpliter("\n", (part, next) => {
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => next(null));
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

将一个文件按照 `"|"` 划分成两个子文件，也即 `"|"` 之前的内容是一个文件，`"|"` 之后的内容是另一个文件：

```js
const { createReadStream, createWriteStream } = require("fs");
const createSpliter = require("@stream-toolbox/split");

const source = createReadStream("source.txt");

const spliter = createSpliter("|", (part, next) => {
  part
    .pipe(createWriteStream(`part_${part.index}.txt`))
    .on("error", (error) => next(error))
    .on("finish", () => {
      if (part.index === 0) {
        // next 的第二个参数可以用于更新下一个区块的终止条件，不传则保持和当前区块的终止条件相同
        // 设置为 Infinity 表示下一个区块的大小到达 Infinity 时才停止
        // 这也就意味着接下来的全部内容都属于下一个区块
        next(null, Infinity);
      } else {
        next(null);
      }
    });
});

source.pipe(spliter).on("finish", () => {
  console.log(`"source.txt" has been split into ${spliter.partCount} parts.`);
});
```

> - `"|"` 既不会出现在第一个子文件的尾部，也不会出现在第二个子文件的头部。
> - 如果源文件中有多个 `"|"`，也只会创建两个子文件，因为第二个子文件的终止条件不再是“遇到 `"|"` 时停止”。

`createSpliter` 的回调函数也可以是 `async function`，此时无需手动调用 `next` 函数：

```js
const join = require("@stream-toolbox/join");
const createSpliter = require("@stream-toolbox/split");

join(["foo", "bar", "baz"], "|")
  .pipe(
    createSpliter("|", async (part) => {
      console.log("on part", part.index);
      for await (const chunk of part) {
        console.log(`${chunk}`);
      }
    })
  )
  .on("finish", () => {
    console.log("finish");
  });
// 执行结果：
// on part 0
// foo
// on part 1
// bar
// on part 2
// baz
// finish
```

> 如果需要更新下一个区块的终止条件，在 `aysnc function` 的结尾 `return` 新的终止条件即可。

## 说明

`@stream-toolbox/split` 还支持给每个区块添加固定的头部或尾部，也支持保留分割字节在区块尾部，具体可以参考 [index.d.ts](https://www.npmjs.com/package/@stream-toolbox/split?activeTab=code) 文件或[源码](https://github.com/haochuan9421/stream-toolbox/blob/master/packages/split/index.ts)，源码中有详细注释，也并不算很复杂。

看完了上面的示例，你应该知道如何使用 `@stream-toolbox/split` 了，它非常灵活，如果划分条件是 `number` 则会按大小划分可读流，如果划分条件是 `string` 或 `Buffer`，则会按给定的字节划分可读流。而且两种方式可以交叉使用，当一个区块读取完毕时，可以通过 next 函数（或 Promise resolve 的值）设置下一个区块的终止条件。

可读流的划分过程是完全流式的，划分时不会为了检查终止条件而将区块的全部数据堆积在内存中，而是在**可创建区块时**立即创建一个子可读流，当传输的数据不足以触发当前区块的终止条件时，会立刻把数据转发给子可读流，当终止条件满足时才会结束当前的子可读流。使用 [pipe](https://nodejs.org/api/stream.html#readablepipedestination-options) 在源可读流和 spliter 之间传输数据时，如果停止读取当前区块的内容，则源可读流的读取过程也会被暂停，也即 `spliter` 是支持 [背压（backpressuring）](https://nodejs.org/en/docs/guides/backpressuring-in-streams) 的，总之 `@stream-toolbox/split` 是一个内存友好的工具。
