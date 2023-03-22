# @stream-toolbox/replace

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/replace" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/replace.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/replace" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/replace.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/replace/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/replace.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/replace" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/replace.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#features) [中文文档](#特点)

---

> 💱 Replace the given [Buffer](https://nodejs.org/api/buffer.html) in a [readable stream](https://nodejs.org/api/stream.html#readable-streams) with another Buffer.

## Features

- Fast 🚀，throughput is about 5GB/s (data is in memory).
- Supports limiting the maximum number of replacements.

## Installation

```bash
npm i @stream-toolbox/replace
```

## Quick Start

```js
const createReplace = require("@stream-toolbox/replace");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("crlf.text");
const duplex = createReplace("\r\n", "\n"); // replace all '\r\n' in crlf.text with '\n'
const writable = createWriteStream(`lf.text`);

readable.pipe(duplex).pipe(writable);
```

## API

```ts
createReplace(find: string | Buffer, replace: string | Buffer, limit?: number): Duplex
```

If `limit` is not specified, all `find` will be replaced with `replace`, if `limit` is an positive interger, then only the first `limit` `find` will be replaced, the subsequent ones will remain as they are.

---

> 💱 用提供的 [Buffer](https://nodejs.org/api/buffer.html) 替换[可读流](https://nodejs.org/api/stream.html#readable-streams)中的特定 Buffer。

## 特点

- 速度快 🚀，吞吐量大概在 5GB/s (数据在内存中).
- 支持限制最多替换多少次。

## 安装

```bash
npm i @stream-toolbox/replace
```

## 快速开始

```js
const createReplace = require("@stream-toolbox/replace");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("crlf.text");
const duplex = createReplace("\r\n", "\n"); // 将 crlf.text 中的所有 '\r\n' 替换成 '\n'
const writable = createWriteStream(`lf.text`);

readable.pipe(duplex).pipe(writable);
```

## API

```ts
createReplace(find: string | Buffer, replace: string | Buffer, limit?: number): Duplex
```

如果没有指定 `limit`，所有的 `find` 都将被替换成 `replace`，如果 `limit` 是一个正整数，那么只有前 `limit` 个 `find` 会被替换，后面的将保持原样。
