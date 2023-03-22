# @stream-toolbox/null

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/null" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/null.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/null" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/null.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/null/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/null.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/null" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/null.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> 🕳️ Create a [writable stream](https://nodejs.org/api/stream.html#writable-streams) that will swallow all data, somewhat similar to [/dev/null](https://en.wikipedia.org/wiki/Null_device), but with some extra features.

## Installation

```bash
npm i @stream-toolbox/null
```

## Quick Start

Read data from readable as fast as possible:

```js
const createNull = require("@stream-toolbox/null");
const { createReadStream } = require("fs");

createReadStream("some_file").pipe(createNull());
```

Read data from readable with speed limit:

```js
const createNull = require("@stream-toolbox/null");
const { createReadStream } = require("fs");

createReadStream("some_file").pipe(createNull(1024)); // 1024 bytes per second
```

## API

```ts
createNull(bytesPerSecond?: number): Writable
```

---

> 🕳️ 创建一个会吞噬所有数据的[可写流](https://nodejs.org/api/stream.html#writable-streams)，有点类似于 [/dev/null](https://en.wikipedia.org/wiki/Null_device)，但多了一些额外的功能。

## 安装

```bash
npm i @stream-toolbox/null
```

## 快速开始

尽可能快地从可读流中读取数据：

```js
const createNull = require("@stream-toolbox/null");
const { createReadStream } = require("fs");

createReadStream("some_file").pipe(createNull());
```

有速度限制的从可读流中读取数据：

```js
const createNull = require("@stream-toolbox/null");
const { createReadStream } = require("fs");

createReadStream("some_file").pipe(createNull(1024)); // 1024 字节每秒
```

## API

```ts
createNull(bytesPerSecond?: number): Writable
```
