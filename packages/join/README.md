# @stream-toolbox/join

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/join" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/join.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/join" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/join.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/join/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/join.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/join" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/join.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> 🔗 Join multiple [readable stream](https://nodejs.org/api/stream.html#readable-streams)s (or [Buffer](https://nodejs.org/api/buffer.html)s) into one readable stream.

## Installation

```bash
npm i @stream-toolbox/join
```

## Quick Start

```js
const join = require("@stream-toolbox/join");
const { createReadStream, createWriteStream } = require("fs");

const readable = join([
  createReadStream("a_file"),
  createReadStream("b_file"),
  createReadStream("c_file")
]);

readable.pipe(createWriteStream("joined_file"));
```

## API

```ts
join(sources: (Buffer | string | Readable)[], separator?: Buffer | string): Readable;
```

- `sources`: An Array contians `Buffer`, `string` or `Readable`, `string` will be treated as `utf-8` encoded.
- `separator`: Optional, can be `Buffer` or `string`, `string` will be treated as `utf-8` encoded.

  ```js
  join(["foo", "bar", "baz"], "_"); // foo_bar_baz
  ```

---

> 🔗 将多个[可读流](https://nodejs.org/api/stream.html#readable-streams)（或 [Buffer](https://nodejs.org/api/buffer.html)）连接成一个可读流。

## 安装

```bash
npm i @stream-toolbox/join
```

## 快速开始

```js
const join = require("@stream-toolbox/join");
const { createReadStream, createWriteStream } = require("fs");

const readable = join([
  createReadStream("a_file"),
  createReadStream("b_file"),
  createReadStream("c_file")
]);

readable.pipe(createWriteStream("joined_file"));
```

## API

```ts
join(sources: (Buffer | string | Readable)[], separator?: Buffer | string): Readable;
```

- `sources`: 一个包含了 `Buffer`, `string` 或 `Readable` 的数组, `string` 按照 `utf-8` 编码处理.
- `separator`: 可选, 类型是 `Buffer` 或 `string`, `string` 按照 `utf-8` 编码处理.

  ```js
  join(["foo", "bar", "baz"], "_"); // foo_bar_baz
  ```
