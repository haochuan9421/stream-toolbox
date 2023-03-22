# @stream-toolbox/multipart

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/multipart" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/multipart.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/multipart" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/multipart.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/multipart/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/multipart.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/multipart" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/multipart.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#features) [中文文档](#特点)

---

> 📋 A streaming parser for [multipart/form-data](https://www.ietf.org/rfc/rfc2388.txt) type request body.

## Features

- Fast, about 30% faster than [busboy](https://www.npmjs.com/package/busboy) and [formidable](https://www.npmjs.com/package/formidable)
- Lightweight, only about 300 lines of code
- Easy-to-use API
- Typescript Friendly

## Installation

```bash
npm i @stream-toolbox/multipart
```

## Quick Start

```js
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pipeline } = require("stream");

const multipart = require("@stream-toolbox/multipart");

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.headers["content-type"].startsWith("multipart/form-data")) {
      multipart(req, {
        // "onFile" will be called when a file part is encountered
        onFile(file, meta, cb) {
          // The following code saves the uploaded file to the "upload" folder (assuming the "upload" folder already exists)
          const filePath = path.join("upload", `${Math.random()}`.slice(2) + path.extname(meta.filename));
          pipeline(file, fs.createWriteStream(filePath), (err) => {
            if (err) {
              cb(err);
            } else {
              cb(null, filePath);
            }
          });
        },
      })
        .then((result) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result, null, 2));
        })
        .catch((err) => {
          console.log("multipart parse error", err);
        });
    } else {
      // Returns a form html for submit a multipart/form-data request
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<form action="/submit" method="post" enctype="multipart/form-data">
    <input name="username" type="text" />
    <select name="interest" multiple>
      <option value="coding">coding</option>
      <option value="music">music</option>
      <option value="game">game</option>
      <option value="dance">dance</option>
    </select>
    <input name="avatar" type="file" accept="image/*" />
    <input name="doc" type="file" multiple />
    <button type="submit">submit</button>
  </form>
  `);
    }
  })
  .listen(9000, () => {
    console.log("open http://127.0.0.1:9000");
  });
```

## Parameters of multipart

`multipart(rs, opts)`

- `rs`
  - type: [Readable](https://nodejs.org/api/stream.html#readable-streams)
  - description: [http.IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage), [readable stream](https://nodejs.org/api/stream.html#readable-streams) is also supported.
- `opts`
  - type:
    ```ts
    {
      // "boundary" can be specified, parse from rs.headers['content-type'] by default
      boundary?: string;
      // Whether to automatically call rs.destroy() in case of errors in the request body parsing process, default is false
      autoDestroy?: boolean;
      // Various limit-related parameters, exceeding the limit will reject error and stop parsing
      limits?: {
        // Number of field part, up to 256 by default
        fields?: number;
        // The max size of a field part content, up to 65536 (bytes) by default (when reading the content of a field part, the data will temporarily exist in memory, so it needs to be limited, otherwise it may lead to memory leaks, the "text" type field of MySQL only occupies 65535 bytes, so there is no need to give too much space)
        fieldSize?: number;
        // Number of file part, up to 256 by default
        files?: number;
        // The max size of a file, no limited by default (when reading the contents of a file, it is done as a stream and the data is not temporarily stored in memory, so there is not much need to limit it)
        fileSize?: number;
        // Number of headers in a part, up to 3 by default, because each part usually has only Content-Disposition, Content-Type and Content-Transfer-Encoding headers
        partHeaders?: number;
        // The max size of a header, default 1024 (bytes) (when reading the header, the data is temporarily stored in memory, so it needs to be limited, otherwise it may lead to memory leaks)
        partHeaderSize?: number;
        // The total size of the request body, no limit by default
        totalSize?: number;
      };
      // "onField" function is called when a field part is encountered, if no "onField" function is provided, the content of the part will be converted to a utf-8 string
      // 1. "data" parameter is the content of the part, which can be custom transformed
      // 2. "meta" parameter is some basic information about the part, such as: "name" (the value of the name attribute in a form field), "encoding" (the value of the Content-Transfer-Encoding in the part header)
      // 3. "cb"   parameter is a callback function, if an error occurs during your custom transform process, the error message should be called back to notify "multipart" to end the parsing of the whole request body, if no error occurs, the first parameter of the callback is "null", the second parameter is the result of the transform, the result will be put into the return value of the "multipart" function
      // 4. Instead of using the "cb" parameter to call back the result, the "onField" function can also inform the result by returning a Promise
      onField?: (data: Buffer, meta: fieldMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
      // "onFile" function is called when a file part is encountered, If the "onFile" function is not provided, the file content will be ignored
      // 1. "file" parameter is a readable stream which can be piped to your disk or other storage, this readable stream must be exhausted or the entire request parsing process may get stuck
      // 2. "meta" parameter is some basic information about the part, such as: "filename" (original filename), "mimeType" (mime type of the file)
      // 3. "cb"   parameter is a callback function, if an error occurs during your dump file process, the error message should be called back to notify "multipart" to end the parsing of the whole request body, if no error occurs, the first parameter of the callback is "null", the second parameter is the result of the your dump, the result will be put into the return value of the "multipart" function
      // 4. Instead of using the "cb" parameter to call back the result, the "onFile" function can also inform the result by returning a Promise
      onFile?: (file: Readable, meta: fileMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
      // Format of the return value, default "common"
      resultFormat?: "array" | "common";
    }
    ```
  - description: Parsing configuration, refer to the comments above for details.

## Return value of multipart

- If `opts.resultFormat = "array"`, then the return value type is `Promise<{ [key: string]: any[] }>`, for example:

  ```json
  {
    "username": ["😊"],
    "interest": ["coding", "music", "game"],
    "avatar": ["upload/08948277734749754.png"],
    "doc": ["upload/8910049773055626.MP4", "upload/5344086262626364.pdf"]
  }
  ```

  Since a form field may has multiple values (e.g., `select`, `checkbox` and `file` that supports multiple file uploads), the values of a field are always stored in an array, even if the field has only one value, this format ensures that when read any field values, it is read in the same way.

- If `opts.resultFormat = "common"` (default), then the return value type is `Promise<{ [key: string]: any }>`, for example:

  ```json
  {
    "username": "😊",
    "interest": ["coding", "music", "game"],
    "avatar": "upload/08948277734749754.png",
    "doc": ["upload/8910049773055626.MP4", "upload/5344086262626364.pdf"]
  }
  ```

  Array is only used when one field has multiple values.

## Benchmarks

The following figure shows the results of parsing the same request body with 30 field parts (64KB) and 30 file parts (64MB) using [busboy](https://www.npmjs.com/package/busboy), [formidable](https://www.npmjs.com/package/formidable) and [multipart](https://www.npmjs.com/package/multipart). The `Content-Length` is the size of the request body, the number of milliseconds represents the time difference between the beginning and the end of parsing, and the memory-related data is the difference in the process memory usage between the beginning and the end of parsing. 4 plots correspond to 4 different data reading and writing scenarios.

1. `memory-read-no-write`: The data of the request body is already in memory and when a file part is encountered, the file is not written to disk.
2. `memory-read-disk-write`: The data of the request body is already in memory and when a file part is encountered, the file is written to disk.
3. `disk-read-no-write`: The data of the request body is read from disk and when a file part is encountered, the file is not written to disk.
4. `disk-read-disk-write`: The data of the request body is read from disk and when a file part is encountered, the file is written to disk.

<img src="https://user-images.githubusercontent.com/5093611/226623143-00a16930-a19f-4bec-9779-37c31f064cb6.png">
<img src="https://user-images.githubusercontent.com/5093611/226623573-17831f3e-d0a0-4ff4-aa20-170f717eea86.png">

Test method 1, which measures the theoretical maximum parsing speed, shows that `multipart` is theoretically about 4x faster than `busboy` and about 6x faster than `formidable`! But even the slowest `formidable` has a theoretical parsing speed of `3GB/s` (derived from `1.88GB/621ms`). Since the request body is usually read from the network and the parsed files are usually written to disk, the performance bottleneck in real-world scenarios is often not in the parsing speed, but in the disk write speed and the server's uplink bandwidth.

Test method 4 reading data from a local file (simulating the readable stream of a network request with a file readable stream) and writes the parsed file to local disk, which best reflects the performance gap between the three packages in real network IO.

---

> 📋 一款用于 [multipart/form-data](https://www.ietf.org/rfc/rfc2388.txt) 类型请求体的解析工具。

## 特点

- 速度快，比 [busboy](https://www.npmjs.com/package/busboy) 和 [formidable](https://www.npmjs.com/package/formidable) 快 30% 左右
- 轻量，仅 300 行左右的代码
- 简单易用的 API
- Typescript 友好

## 安装

```bash
npm i @stream-toolbox/multipart
```

## 快速开始

```js
const fs = require("fs");
const http = require("http");
const path = require("path");
const { pipeline } = require("stream");

const multipart = require("@stream-toolbox/multipart");

http
  .createServer((req, res) => {
    if (req.method === "POST" && req.headers["content-type"].startsWith("multipart/form-data")) {
      multipart(req, {
        // 解析到文件区块时 onFile 会触发，用于处理上传的文件
        onFile(file, meta, cb) {
          // 下面的示例代码是把上传的文件保存到了 upload 文件夹中（假设 upload 文件夹已存在）
          const filePath = path.join("upload", `${Math.random()}`.slice(2) + path.extname(meta.filename));
          pipeline(file, fs.createWriteStream(filePath), (err) => {
            if (err) {
              cb(err);
            } else {
              cb(null, filePath);
            }
          });
        },
      })
        .then((result) => {
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify(result, null, 2));
        })
        .catch((err) => {
          console.log("multipart parse error", err);
        });
    } else {
      // 返回一个 form 表单，用于提交 multipart/form-data 类型的请求
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.end(`<form action="/submit" method="post" enctype="multipart/form-data">
    <input name="username" type="text" />
    <select name="interest" multiple>
      <option value="coding">编码</option>
      <option value="music">音乐</option>
      <option value="game">游戏</option>
      <option value="dance">舞蹈</option>
    </select>
    <input name="avatar" type="file" accept="image/*" />
    <input name="doc" type="file" multiple />
    <button type="submit">提交</button>
  </form>
  `);
    }
  })
  .listen(9000, () => {
    console.log("open http://127.0.0.1:9000");
  });
```

## multipart 的参数

`multipart(rs, opts)`

- `rs`
  - 类型: [Readable](https://nodejs.org/api/stream.html#readable-streams)
  - 说明: 一般是 [http.IncomingMessage](https://nodejs.org/api/http.html#class-httpincomingmessage)，不过也支持任意的 [可读流](https://nodejs.org/api/stream.html#readable-streams)。
- `opts`
  - 类型:
    ```ts
    {
      // 可指定 boundary，默认自动从 rs.headers['content-type'] 中解析
      boundary?: string;
      // 请求体的解析过程出错时，是否自动调用 rs.destroy()，默认是 false
      autoDestroy?: boolean;
      // 各种限制相关的参数，超出限制后会报错并停止解析
      limits?: {
        // 普通区块的数量，默认最多 256 个
        fields?: number;
        // 一个普通区块的值的字节数，默认最多 64KB（读取普通区块的值时，数据会暂存在内存里，所以需要限制，否则可能导致内存泄露，数据库中一个字段所占的空间一般也不会超过这个值，比如 MySQL 的 text 类型的字段，也就只占 65535 个字节，所以不需要给太大的空间）
        fieldSize?: number;
        // 文件区块的数量，默认最多 256 个
        files?: number;
        // 一个文件的字节数，默认不限制（读取文件内容时，是以流的方式进行的，数据不会被暂存在内存里，所以没太大必要限制）
        fileSize?: number;
        // 一个区块中头部的个数，默认最多 3 个，因为每个区块的头部一般也就只有 Content-Disposition, Content-Type 和 Content-Transfer-Encoding
        partHeaders?: number;
        // 一个头部的字节数，默认最多 1 KB（读取头部时，数据会暂存在内存中，所以需要限制，否则可能导致内存泄露）
        partHeaderSize?: number;
        // 请求体的总字节数，默认不限制
        totalSize?: number;
      };
      // 当解析到普通区块时触发，如果未提供 onField 函数，区块内容会被转成 utf-8 字符串
      // 1. data 参数是区块的内容，可以自定义转化
      // 2. meta 参数是区块的一些基本信息，比如: name (区块的名称，即 form 表单项中的 name 属性值), encoding (区块头部 Content-Transfer-Encoding 的值)
      // 3. cb   参数是回调函数，如果自行转化的过程中发生了错误，需要回调错误信息，以通知 multipart 结束整个请求体的解析，如果没有发生错误，回调的第一个参数是 null，第二个参数是转化结果，转化结果会放入 multipart 函数的返回值
      // 4. onField 函数也可以不使用 cb 参数回调结果，而是通过返回一个 Promise 来告知结果
      onField?: (data: Buffer, meta: fieldMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
      // 当解析到文件区块时触发，如果未提供 onFile 函数，区块内容会被忽略
      // 1. file 参数是区块所含文件的可读流，可以将该可读流 pipe 到本地磁盘或其他存储位置，这个可读流必须被耗尽，否则整个请求的解析过程可能会卡住
      // 2. meta 参数是区块的一些基本信息，比如: filename (原始文件名), mimeType (文件的 mime 类型)
      // 3. cb   参数是回调函数，如果转存的过程中发生了错误，需要回调错误信息，以通知 multipart 结束整个请求体的解析，如果没有发生错误，回调的第一个参数是 null，第二个参数是转存结果，转存结果会放入 multipart 函数的返回值
      // 4. onFile 函数也可以不使用 cb 参数回调结果，而是通过返回一个 Promise 来告知结果
      onFile?: (file: Readable, meta: fileMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
      // 返回值的格式，默认值 "common"
      resultFormat?: "array" | "common";
    }
    ```
  - 说明: 解析配置，具体参考上面注释。

## multipart 的返回值

- 如果 `opts.resultFormat = "array"`，则返回值类型为 `Promise<{ [key: string]: any[] }>`，比如:

  ```json
  {
    "username": ["😊"],
    "interest": ["coding", "music", "game"],
    "avatar": ["upload/08948277734749754.png"],
    "doc": ["upload/8910049773055626.MP4", "upload/5344086262626364.pdf"]
  }
  ```

  由于表单的同一个字段可能有多个值(比如可以多选的 `select`，`checkbox` 以及支持多文件上传的 `file`)，所以字段的值会始终以数组的形式保存，即使该字段的值只有一个，这种格式可以保证读取任意字段的值时，读取方式都是一致的。

- 如果 `opts.resultFormat = "common"`（默认值），则返回值类型为 `Promise<{ [key: string]: any }>`，比如:

  ```json
  {
    "username": "😊",
    "interest": ["coding", "music", "game"],
    "avatar": "upload/08948277734749754.png",
    "doc": ["upload/8910049773055626.MP4", "upload/5344086262626364.pdf"]
  }
  ```

  只有在表单的同一个字段有多个值时才会使用数组保存。

## Benchmarks

下图的测试结果为分别使用 [busboy](https://www.npmjs.com/package/busboy), [formidable](https://www.npmjs.com/package/formidable) 和 [multipart](https://www.npmjs.com/package/multipart) 解析同一个包含了 30 个普通字段 (64KB 大小) 和 30 个文件字段(64MB 大小) 的请求体的情况。其中的 `Content-Length` 是请求体的大小，毫秒数代表解析开始到结束的时间差值，内存相关的数据是解析前后的进程内存占用差值。4 个图分别对应了 4 种不同的数据读写场景。

1. `memory-read-no-write`: 请求体的数据已在内存中，解析到文件时，文件不写入磁盘。
2. `memory-read-disk-write`: 请求体的数据已在内存中，解析到文件时，文件写入磁盘。
3. `disk-read-no-write`: 请求体的数据从磁盘读取，解析到文件时，文件不写入磁盘。
4. `disk-read-disk-write`: 请求体的数据从磁盘读取，解析到文件时，文件写入磁盘。

<img src="https://user-images.githubusercontent.com/5093611/226623143-00a16930-a19f-4bec-9779-37c31f064cb6.png">
<img src="https://user-images.githubusercontent.com/5093611/226623573-17831f3e-d0a0-4ff4-aa20-170f717eea86.png">

其中测试方法 1 可以测出理论上的最大解析速度，可以看到 `multipart` 理论上会比 `busboy` 快 4 倍左右，比 `formidable` 快 6 倍左右! 但即使是最差的 `formidable` 也有高达 `3GB/s` 的理论解析速度 (由 `1.88GB/621ms` 得出)，由于请求体通常从网络读取，解析到的文件也通常需要写入磁盘，所以实际场景中的性能瓶颈往往并不在解析速度上，而在于磁盘的写入速度和服务器的上行带宽。

其中测试方法 4 采用从本地文件读取数据（用文件可读流模拟网络请求的可读流），并将解析到的文件写入本地磁盘，该测试方法最能反应实际网络 IO 中三者的性能差距，可以看到 `multipart` 依然有 30% 以上的性能优势。
