# @stream-toolbox/monit

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/monit" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/monit.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/monit" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/monit.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/monit/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/monit.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/monit" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/monit.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> 📈 Create a [duplex](https://nodejs.org/api/stream.html#duplex-and-transform-streams) that monits streaming transfer rate.

## Installation

```bash
npm i @stream-toolbox/monit
```

## Quick Start

```js
const createMonit = require("@stream-toolbox/monit");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("some_file");
const monit = createMonit();
const writable = createWriteStream("some_file_copy");

readable.pipe(monit).pipe(writable);
```

When data is being "pipe", the terminal will show the flowing chart, pay attention to the "internal buffer size", this value should be small and not growing, Otherwise, it means that the speed of read data from the source is faster than the speed of consuming data, that is, there may be a memory leak. For details, please refer to [backpressure](https://nodejs.org/en/docs/guides/backpressuring-in-streams/) for troubleshooting.

<img width="422" alt="image" src="https://user-images.githubusercontent.com/5093611/226332484-9c42d153-cc6c-4e7c-a053-87428e1ea3f3.png">

When the "pipe" is end, the terminal will show the flowing chart, you can checkout how many bytes data has transferred and the average speed.

<img width="349" alt="image" src="https://user-images.githubusercontent.com/5093611/226806757-f05c1adf-3312-4bd4-8db2-b086be169bcf.png">

## API

```ts
function createMonit(opts?: {
  interval?: number; // Sample interval, unit is second, default is 1 second, "onTick" will be call backed and the terminal will refresh every sample interval.
  stdout?: boolean; // Whether to output the sample results to stdout, default "true".
  onTick?: (writed: number, readed: number, usedTime: number) => {}; // "writed" is the total amount of data writed to monit, "readed" is the total amount of data readed from monit, and "usedTime" is since start.
  onClose?: (transferred: number, usedTime: number) => {}; // Callback at the end of transfer, "transferred" indicates the total amount of data transferred, "usedTime" is since start.
}): Duplex;
```

---

> 📈 创建一个[双工流](https://nodejs.org/api/stream.html#duplex-and-transform-streams)用于监测流的传输速度。

## 安装

```bash
npm i @stream-toolbox/monit
```

## 快速开始

```js
const createMonit = require("@stream-toolbox/monit");
const { createReadStream, createWriteStream } = require("fs");

const readable = createReadStream("some_file");
const monit = createMonit();
const writable = createWriteStream("some_file_copy");

readable.pipe(monit).pipe(writable);
```

当 "pipe" 正在进行时, 控制台会显示如下表格, 需要注意 "internal buffer size" 的值, 这个值一般不会太大且不应该持续增长，否则的话则说明从数据源获取数据的速度大于消费数据的速度，也即此时可能存在内存泄漏，具体可参考 [背压](https://nodejs.org/en/docs/guides/backpressuring-in-streams/) 进行排查。

<img width="422" alt="image" src="https://user-images.githubusercontent.com/5093611/226332484-9c42d153-cc6c-4e7c-a053-87428e1ea3f3.png">

当 "pipe" 结束时, 控制台会显示如下表格，你可以查看总共传输了多少字节，以及平均速度。

<img width="349" alt="image" src="https://user-images.githubusercontent.com/5093611/226806757-f05c1adf-3312-4bd4-8db2-b086be169bcf.png">

## API

```ts
function createMonit(opts?: {
  interval?: number; // 采样间隔，单位秒，默认 1 秒，每次采样完成时会回调 onTick 和刷新控制台
  stdout?: boolean; // 是否将采样结果输出到控制台，默认 true
  onTick?: (writed: number, readed: number, usedTime: number) => {}; // 每轮采样结束时回调，writed 是已写入 monit 的数据总量，readed 是已从 monit 读取的数据总量，usedTime 是已耗时多少秒
  onClose?: (transferred: number, usedTime: number) => {}; // 传输结束时回调，transferred 表示已传输的数据总量，usedTime 是已耗时多少秒
}): Duplex;
```
