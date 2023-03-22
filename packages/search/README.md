# @stream-toolbox/search

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/search" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/search.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/search" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/search.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/search/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/search.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/search" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/search.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#features) [中文文档](#特点)

---

> 🔍 Search for the given [Buffer](https://nodejs.org/api/buffer.html) in a sequence of data ([readable stream](https://nodejs.org/api/stream.html#readable-streams)).

## Features

- Fast 🚀，up to 100x faster than [streamsearch](https://www.npmjs.com/package/streamsearch).
- Zero dependencies, Less than 200 lines of code.
- Support reset needle when match.
- Support limit the count of matches.

## Installation

```bash
npm i @stream-toolbox/search
```

## Quick Start

```js
const StreamSearch = require("@stream-toolbox/search");

const searcher = new StreamSearch("\r\n", (isMatch, data) => {
  console.log(isMatch, `'${data}'`);
});

searcher.push("foo");
// false 'foo'
searcher.push(" bar");
// false ' bar'
searcher.push("\r");
searcher.push("\n");
// true ''
searcher.push("baz, hello\r");
searcher.push("\n world.");
// false 'baz, hello'
// true ''
// false ' world.'
searcher.push("\r\n Node.JS rules!!\r\n\r\n");
// true ''
// false ' Node.JS rules!!'
// true ''
// true ''
```

## API

### Constructor

```js
new StreamSearch(needle, callback);
// or
new StreamSearch(opts, callback);
```

- `needle`: should be a `string` or `Buffer`, string will be treated as `utf-8` encoded.

- `opts`:

  ```ts
  type opts = {
    needle: string | Buffer;
    limit?: number; // default: Infinity
    abandon?: boolean; // default: true
  };
  ```

  `limit` should be a positive interger, when match count reach limit, you can choose `abandon` the data after the last needle or not, set abandon to `true` mean no data will be callbacked after the last needle, set abandon to `false` mean any data after the last needle will be callbacked as non-matching data without check.

- `callback`: A function which will be called when there is a match or non-matching data, the `callback` has following parameters:

  - `isMatch`

    - type: `boolean`

  - `data`

    - type: `Buffer`
    - description: When `isMatch` is `false`, `data` is the non-matching data. When `isMatch` is `true`, `data` is an empty Buffer (unless `opts.limit` reached and `opts.abandon` is `false`, in this case, the `data` is what after the last needle).

    ```js
    const searcher = new StreamSearch(
      {
        needle: "_bar_",
        limit: 1,
        abandon: false,
      },
      (isMatch, data) => {
        console.log(isMatch, `'${data}'`);
      }
    );

    searcher.push("foo_bar_baz");
    // false 'foo'
    // true 'baz'
    searcher.push("foo_bar_baz"); // this chunk has '_bar_' inside, but since the limit reached, this chunk will not be checked.
    // false 'foo_bar_baz'
    ```

    ```js
    const searcher = new StreamSearch(
      {
        needle: "_bar_",
        limit: 1,
        abandon: true,
      },
      (isMatch, data) => {
        console.log(isMatch, `'${data}'`);
      }
    );

    searcher.push("foo_bar_baz");
    // false 'foo'
    // true ''
    searcher.push("foo_bar_baz"); // when 'abandon' is true, any data after the last 'needle' will not be callbacked.
    ```

### Properties

- `needle`: same to `opts.needle`

- `limit`: same to `opts.limit`

- `abandon`: same to `opts.abandon`

- `matched`

  - type: `number`
  - description: matched count, when needle is matched, `searcher.matched` will +1 and callback function will be called immediately. The value provides introspection data regarding the status of the `limit`, if `searcher.matched === searcher.limit`, `searcher.abandon` will be use to decide whether to callback data after the last needle or not.

- `lookback`
  - type: `Buffer[]`
  - description: The chunks pushed to searcher, but can not sure if they will match needle or not. for example, if needle is `'foo'`, when you push `'bar'`, then `'bar'` will be callbacked immediately, but if you push `'barfo'`, `'barfo'` will stored in `searcher.lookback`, due to we don't know if the next char is `'o'` or not. when the stream ends, use `searcher.flush()` to manual callback these "waiting for check chunks".

### Methods

- `push(chunk: string | Buffer)`: Add new data for searching, string will be treated as `utf-8` encoded.
- `flush()`: Generally called at the end of the readable stream, this will cause all data in `lookback` callbacked with `isMatch` set to `false`.
- `resetNeedle(needle: string | Buffer)`: reset the `needle` used in the search process. Can be called only when the `isMatch` is `true`, otherwise it will lead to unpredictable consequences.

  ```js
  const searcher = new StreamSearch("foo", (isMatch, data) => {
    if (isMatch && searcher.matched === 1) {
      searcher.resetNeedle("bar");
    }
    console.log(isMatch);
  });

  searcher.push("foobar");
  // true
  // true
  ```

  > resetNeedle will not reset `matched` to `0`.

- `reset(opts)`: resets all internal state, useful when you want to search for a new stream.the `opts` argument is the same as the `opts` argument to `constructor`. Calling `searcher.reset(opts)` is the same as using `new StreamSearch(opts)` to create a new instance.

## benchmark

The following result shows the time taken to search for a `500MB` size stream. Throughput is about 20GB/s (data is in memory).

<img width="473" alt="image" src="https://user-images.githubusercontent.com/5093611/222040641-f29c9799-24f6-41c4-bc0f-fc65874bd3ee.png">

## Why [@stream-toolbox/search](https://www.npmjs.com/package/@stream-toolbox/search) is faster than [streamsearch](https://www.npmjs.com/package/streamsearch)

@stream-toolbox/search uses the [boyer-moore-horspool](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore%E2%80%93Horspool_algorithm) algorithm for the entire search process but when the native Buffer's [indexOf](https://nodejs.org/api/buffer.html#bufindexofvalue-byteoffset-encoding) method can be used, `indexOf` is used first to drives the search pointer forward. The advantage of this is that the native `indexOf` is usually faster than the horspool algorithm, especially when the needle is short, and the horspool algorithm is a little faster than `indexOf` when the needle is long, but not by much. @stream-toolbox/search takes the best of both worlds, i.e. it solves the problem of native indexOf not being able to streaming search, and also solves the problem of pure horspool not being as fast as native indexOf. So @stream-toolbox/search is usually faster than streamsearch based on horspool algorithm only. When the needle length is 1, it can even be 100x faster than streamsearch, and when the needle length is under 256, there is at least a 2x performance advantage, and in most search scenarios, the needle is not too long. So @stream-toolbox/search is usually the better choice, but streamsearch is also a great tool.

Here is a piece of code that compares the speed of horspool with `indexOf`:

```js
function horspool(haystack, needle) {
  const len = needle.length;
  const last = len - 1;
  const move = new Array(256).fill(len);
  for (let i = 0; i < last; i++) {
    move[needle[i]] = last - i;
  }

  let i = 0;
  let j = 0;
  while (i <= haystack.length - len) {
    const start = i;

    while (j < len && haystack[i] === needle[j]) {
      i++;
      j++;
    }

    if (j === len) {
      return start;
    }

    i = start + move[haystack[start + last]];
    j = 0;
  }
  return -1;
}

const haystack = Buffer.allocUnsafe(2 ** 30); // 1GB
for (let i = 0; i < haystack.length; i++) {
  haystack[i] = Math.floor(Math.random() * 128);
}

const needleLen = 1;
const needle = Buffer.allocUnsafe(needleLen);
for (let i = 0; i < needle.length; i++) {
  needle[i] = 128 + Math.floor(Math.random() * 128);
}

console.time("indexOf");
haystack.indexOf(needle);
console.timeEnd("indexOf");

console.time("horspool");
horspool(haystack, needle);
console.timeEnd("horspool");
```

---

> 🔍 在一连串的数据（[可读流](https://nodejs.org/api/stream.html#readable-streams)）中搜索特定的 [Buffer](https://nodejs.org/api/buffer.html)。

## 特点

- 速度快 🚀，最多可以比 [streamsearch](https://www.npmjs.com/package/streamsearch) 快 100 倍。
- 零依赖, 不到 200 行代码。
- 支持重置 needle。
- 支持限制匹配成功的次数。

## 安装

```bash
npm i @stream-toolbox/search
```

## 快速开始

```js
const StreamSearch = require("@stream-toolbox/search");

const searcher = new StreamSearch("\r\n", (isMatch, data) => {
  console.log(isMatch, `'${data}'`);
});

searcher.push("foo");
// false 'foo'
searcher.push(" bar");
// false ' bar'
searcher.push("\r");
searcher.push("\n");
// true ''
searcher.push("baz, hello\r");
searcher.push("\n world.");
// false 'baz, hello'
// true ''
// false ' world.'
searcher.push("\r\n Node.JS rules!!\r\n\r\n");
// true ''
// false ' Node.JS rules!!'
// true ''
// true ''
```

## API

### 构造函数

```js
new StreamSearch(needle, callback);
// or
new StreamSearch(opts, callback);
```

- `needle`: 类型是 `string` 或 `Buffer`, 如果是字符串则按 `utf-8` 编码处理。

- `opts`:

  ```ts
  type opts = {
    needle: string | Buffer;
    limit?: number; // 默认是: Infinity
    abandon?: boolean; // 默认是: true
  };
  ```

  `limit` 是正整数, 当匹配成功 limit 次时, 你可以选择是否 `abandon` (抛弃)最后一个 needle 后面的数据, abandon 是 `true` 则不会再回调最后一个 needle 后面的任何数据, abandon 是 `false` 则后面的数据都会被当做是不匹配数据进行回调。

- `callback`: 回调函数，当匹配成功时或有不匹配的数据时触发, 回调参数如下:

  - `isMatch`

    - 类型: `boolean`

  - `data`

    - 类型: `Buffer`
    - 描述: 当 `isMatch` 是 `false`, `data` 就是 needle 前面的不匹配数据. 当 `isMatch` 是 `true`, `data` 就是一个空 Buffer (当匹配成功次数达到 `opts.limit` 次且 `opts.abandon` 是 `false` 时除外，此时的 `data` 是 needle 后面的数据).

    ```js
    const searcher = new StreamSearch(
      {
        needle: "_bar_",
        limit: 1,
        abandon: false,
      },
      (isMatch, data) => {
        console.log(isMatch, `'${data}'`);
      }
    );

    searcher.push("foo_bar_baz");
    // false 'foo'
    // true 'baz'
    searcher.push("foo_bar_baz"); // 这里面虽然有 '_bar_'，但因为已经到达匹配成功次数的上限了，这部分数据不会再被检查
    // false 'foo_bar_baz'
    ```

    ```js
    const searcher = new StreamSearch(
      {
        needle: "_bar_",
        limit: 1,
        abandon: true,
      },
      (isMatch, data) => {
        console.log(isMatch, `'${data}'`);
      }
    );

    searcher.push("foo_bar_baz");
    // false 'foo'
    // true ''
    searcher.push("foo_bar_baz"); // 当 'abandon' 是 true 时, 最后一个 needle 后面的任何数据都不会再回调
    ```

### 属性

- `needle`: 同 `opts.needle`

- `limit`: 同 `opts.limit`

- `abandon`: 同 `opts.abandon`

- `matched`

  - 类型: `number`
  - 描述: 已匹配成功的次数, 当匹配到 needle 时，`searcher.matched` 会 +1，然后立即触发回调函数. 这个值可以用于检查匹配成功的次数是否已到达 `limit` 次, 如果 `searcher.matched === searcher.limit`, `searcher.abandon` 将决定如何处理最后一个 needle 之后的数据。

- `lookback`
  - 类型: `Buffer[]`
  - 描述: 已 `push` 到 searcher，但还不能断定是否会匹配上 needle 的数据。例如, 当 needle 是 `'foo'` 时, 如果你 push `'bar'`, 那么 `'bar'` 会立即回调出来, 但如果你 push `'barfo'`, `'barfo'` 则只会暂存在 `searcher.lookback` 中, 因为不能确定下一个字符是不是 `'o'`. 当流结束时, 使用 `searcher.flush()` 可以手动把 lookback 中的数据全部回调出来。

### 方法

- `push(chunk: string | Buffer)`: 添加新的用于搜索的数据, 字符串会按 `utf-8` 编码进行处理.
- `flush()`: 一般在可读流结束时调用, 会把 `lookback` 中的全部数据以 `isMatch` 是 `false` 的方式回调出来.
- `resetNeedle(needle: string | Buffer)`: 重置搜索过程中的 `needle`. 当回调的 `isMatch` 是 `true` 才能调用, 否则会有不可预期的后果。

  ```js
  const searcher = new StreamSearch("foo", (isMatch, data) => {
    if (isMatch && searcher.matched === 1) {
      searcher.resetNeedle("bar");
    }
    console.log(isMatch);
  });

  searcher.push("foobar");
  // true
  // true
  ```

  > resetNeedle 不会把 `matched` 重置为 0。

- `reset(opts)`: 重置所有的内部状态, 当你希望搜索一个新的流时这个方法很有用. `opts` 参数和 `constructor` 的 `opts` 参数相同. 调用 `searcher.reset(opts)` 之后的 searcher 等同于使用 `new StreamSearch(opts)` 创建一个新实例。

## 性能测试

搜索一个 `500MB` 大小的流的耗时如下图所示，数据吞吐量可以达到 20GB/s 左右（数据在内存中）。

<img width="473" alt="image" src="https://user-images.githubusercontent.com/5093611/222040641-f29c9799-24f6-41c4-bc0f-fc65874bd3ee.png">

## 为什么 [@stream-toolbox/search](https://www.npmjs.com/package/@stream-toolbox/search) 比 [streamsearch](https://www.npmjs.com/package/streamsearch) 更快

@stream-toolbox/search 的整个搜索过程采用的是 [boyer-moore-horspool](https://en.wikipedia.org/wiki/Boyer%E2%80%93Moore%E2%80%93Horspool_algorithm) 算法，但当待匹配内容可以直接使用 Buffer 原生的 [indexOf](https://nodejs.org/api/buffer.html#bufindexofvalue-byteoffset-encoding) 方法进行匹配时，会优先使用 `indexOf` 来进行匹配，并根据 `indexOf` 的结果推动整体的搜索指针前进。这么做的好处在于原生的 `indexOf` 通常比 horspool 算法有更快的速度，特别是 needle 较短时，速度优势非常明显，horspool 算法在 needle 较长时会比 `indexOf` 快一点，但优势不明显。@stream-toolbox/search 取长补短，即解决了原生 indexOf 无法流式搜索的问题，也解决了纯 horspool 不如原生 indexOf 快的问题。所以 @stream-toolbox/search 通常会比只基于 horspool 算法的 streamsearch 更快。当 needle 长度为 1 时，甚至可以比 streamsearch 快 100 倍之多，needle 长度在 256 以下时，也有至少 2 倍的性能优势，大部分搜索场景，needle 都不会太长。所以 @stream-toolbox/search 通常是更好的选择，不过 streamsearch 也是一个很棒的工具。

附上一段 horspool 与 `indexOf` 速度对比的代码:

```js
function horspool(haystack, needle) {
  const len = needle.length;
  const last = len - 1;
  const move = new Array(256).fill(len);
  for (let i = 0; i < last; i++) {
    move[needle[i]] = last - i;
  }

  let i = 0;
  let j = 0;
  while (i <= haystack.length - len) {
    const start = i;

    while (j < len && haystack[i] === needle[j]) {
      i++;
      j++;
    }

    if (j === len) {
      return start;
    }

    i = start + move[haystack[start + last]];
    j = 0;
  }
  return -1;
}

const haystack = Buffer.allocUnsafe(2 ** 30); // 1GB
for (let i = 0; i < haystack.length; i++) {
  haystack[i] = Math.floor(Math.random() * 128);
}

const needleLen = 1;
const needle = Buffer.allocUnsafe(needleLen);
for (let i = 0; i < needle.length; i++) {
  needle[i] = 128 + Math.floor(Math.random() * 128);
}

console.time("indexOf");
haystack.indexOf(needle);
console.timeEnd("indexOf");

console.time("horspool");
horspool(haystack, needle);
console.timeEnd("horspool");
```
