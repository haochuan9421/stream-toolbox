# @stream-toolbox/limit

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/limit" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/limit.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/limit" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/limit.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/limit/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/limit.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/limit" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/limit.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> ⏳ Create a [duplex](https://nodejs.org/api/stream.html#duplex-and-transform-streams) that limits streaming transfer rate.

## Installation

```bash
npm i @stream-toolbox/limit
```

## Quick Start

Control file copy speed:

```js
const createLimit = require("@stream-toolbox/limit");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("foo.mp4");
const duplex = createLimit(1048576); // 1048576 bytes per second (1MB/s)
const writable = createWriteStream("foo_copy.mp4");

readable.pipe(duplex).pipe(writable);
```

Control the upload bandwidth of a single HTTP request:

```js
const http = require("http");
const createLimit = require("@stream-toolbox/limit");

http
  .createServer((req, res) => {
    if (req.url === "/") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<form action="/upload" method="post" enctype="multipart/form-data"><input name="file" type="file" multiple /><button type="submit">submit</button></form>
    `);
    } else {
      const start = process.uptime();
      const chunks = [];
      req
        .pipe(createLimit(8 * 1024)) // 8 KB/s
        .on("data", (chunk) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          const reqBody = Buffer.concat(chunks);
          res.end(`Uploaded ${reqBody.length} bytes size of data in ${process.uptime() - start} seconds`);
        });
    }
  })
  .listen(8080);
```

## API

```ts
createLimit(bytesPerSecond: number): Duplex
```

---

> ⏳ 创建一个[双工流](https://nodejs.org/api/stream.html#duplex-and-transform-streams)用于控制流的传输速度。

## 安装

```bash
npm i @stream-toolbox/limit
```

## 快速开始

控制文件拷贝速度：

```js
const createLimit = require("@stream-toolbox/limit");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("foo.mp4");
const duplex = createLimit(1048576); // 每秒 1048576 字节 (1MB/s)
const writable = createWriteStream("foo_copy.mp4");

readable.pipe(duplex).pipe(writable);
```

控制单个 HTTP 请求的上行带宽：

```js
const http = require("http");
const createLimit = require("@stream-toolbox/limit");

http
  .createServer((req, res) => {
    if (req.url === "/") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<form action="/upload" method="post" enctype="multipart/form-data"><input name="file" type="file" multiple /><button type="submit">submit</button></form>
    `);
    } else {
      const start = process.uptime();
      const chunks = [];
      req
        .pipe(createLimit(8 * 1024)) // 8 KB/s
        .on("data", (chunk) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          const reqBody = Buffer.concat(chunks);
          res.end(`Uploaded ${reqBody.length} bytes size of data in ${process.uptime() - start} seconds`);
        });
    }
  })
  .listen(8080);
```

## API

```ts
createLimit(bytesPerSecond: number): Duplex
```
