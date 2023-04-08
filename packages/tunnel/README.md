# @stream-toolbox/tunnel

<p>
    <a href="https://www.npmjs.com/package/@stream-toolbox/tunnel" target="_blank"><img src="https://img.shields.io/npm/v/@stream-toolbox/tunnel.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@stream-toolbox/tunnel" target="_blank"><img src="https://img.shields.io/npm/dm/@stream-toolbox/tunnel.svg?style=for-the-badge" alt="downloads"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/blob/master/packages/tunnel/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@stream-toolbox/tunnel.svg?style=for-the-badge" alt="license"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox/tree/master/packages/tunnel" target="_blank"><img src="https://img.shields.io/node/v/@stream-toolbox/tunnel.svg?style=for-the-badge" alt="node-current"></a>
    <a href="https://github.com/haochuan9421/stream-toolbox" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#installation) [中文文档](#安装)

---

> ↔️ Forward data bidirectionally between two [duplex](https://nodejs.org/api/stream.html#duplex-and-transform-streams)es, like `a.pipe(b).pipe(a)`, but with better handling for various cases.

## Installation

```bash
npm i @stream-toolbox/tunnel
```

## Quick Start

```js
const { createServer, createConnection } = require("node:net");
const tunnel = require("@stream-toolbox/tunnel");

// Map the serverPort of serverAddress to port 8001 of local host
const serverAddress = "xxx.xxx.xxx.xxx"; // IP or hostname
const serverPort = 22;

const localAddress = "0.0.0.0";
const localPort = 8001;

const proxyServer = createServer((clientSocket) => {
  const clientAddress = clientSocket.remoteAddress;

  console.log(`TCP connection established successfully: ${clientAddress} <===> ${localAddress}`);

  const serverSocket = createConnection({
    host: serverAddress,
    port: serverPort,
    timeout: 3000,
  })
    .once("timeout", () => {
      console.log(`TCP connection establishment timed out: ${localAddress} <===> ${serverAddress}`);
      serverSocket.destroy();
      clientSocket.destroy();
    })
    .once("error", (err) => {
      console.log(`TCP connection establishment failed: ${localAddress} <===> ${serverAddress}`, err);
      serverSocket.destroy();
      clientSocket.destroy();
    })
    .once("connect", () => {
      console.log(`TCP connection established successfully: ${localAddress} <===> ${serverAddress}`);

      // after connection established, remove the connection timeout and failure event listeners
      serverSocket.removeAllListeners("error");
      serverSocket.removeAllListeners("timeout");
      serverSocket.setTimeout(0);

      // Bidirectional forwarding data of clientSocket and serverSocket
      tunnel(clientSocket, serverSocket, (err, time) => {
        console.log(`Tunnel closed, tunnel alive for ${time} milliseconds`);
        console.log(`${clientAddress} sended ${serverSocket.bytesWritten} bytes data to ${serverAddress}`);
        console.log(`${serverAddress} sended ${clientSocket.bytesWritten} bytes data to ${clientAddress}`);

        if (err) {
          console.log(`The tunnel is broken because of ${err.causedBy === serverSocket ? "serverSocket" : "clientSocket"} throws an error:`, err);
        }
      });
    });
}).listen(localPort, localAddress, () => {
  console.log("proxy server start", proxyServer.address());
});
```

If you can use the `ssh -i ~/.ssh/id_rsa -p 22 root@xxx.xxx.xxx.xxx` command to remotely log in to the `xxx.xxx.xxx.xxx` host, after starting the above proxy server locally, now you should also be able to use `ssh -i ~/.ssh/id_rsa -p 8001 root@127.0.0.1` to log in to the host.

Diagram when the client is directly connected to the remote ssh server:

<img src="https://user-images.githubusercontent.com/5093611/230406818-99666d73-d224-40e2-9a39-2b0187c0de0a.png">

Diagram when connecting through the proxy server:

<img src="https://user-images.githubusercontent.com/5093611/230704451-ed5f3734-9145-4bb9-973c-8024fc29c0a7.png">

## API

```ts
type DuplexLike = {
  rs: Readable; // readable stream
  ws: Writable; // writable stream
  allowHalfOpen?: boolean; // default false，which means when rs ended，call ws.end() automatically
  allowPipeHalfOpen?: boolean; // default false，which means when rs ended，end the writable stream of the other side of tunnel automatically
};

function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, callback: callback): void;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number, callback: callback): void;
```

For the explanation of `allowHalfOpen`, `allowPipeHalfOpen` and `condition`, refer to the figure below:

<img src="https://user-images.githubusercontent.com/5093611/230703813-ddd5e69b-d8e8-4683-aba6-cbaf753e2393.png">

---

> ↔️ 在两个 [duplex](https://nodejs.org/api/stream.html#duplex-and-transform-streams) 间双向转发数据，类似 `a.pipe(b).pipe(a)`，但是对各种情况有更完善的处理。

## 安装

```bash
npm i @stream-toolbox/tunnel
```

## 快速开始

```js
const { createServer, createConnection } = require("node:net");
const tunnel = require("@stream-toolbox/tunnel");

// 将 serverAddress 的 serverPort 端口映射到本机的 8001 端口
const serverAddress = "xxx.xxx.xxx.xxx"; // IP 地址或域名
const serverPort = 22;

const localAddress = "0.0.0.0";
const localPort = 8001;

const proxyServer = createServer((clientSocket) => {
  const clientAddress = clientSocket.remoteAddress;

  console.log(`TCP 连接建立成功: ${clientAddress} <===> ${localAddress}`);

  const serverSocket = createConnection({
    host: serverAddress,
    port: serverPort,
    timeout: 3000,
  })
    .once("timeout", () => {
      console.log(`TCP 连接建立超时: ${localAddress} <===> ${serverAddress}`);
      serverSocket.destroy();
      clientSocket.destroy();
    })
    .once("error", (err) => {
      console.log(`TCP 连接建立失败: ${localAddress} <===> ${serverAddress}`, err);
      serverSocket.destroy();
      clientSocket.destroy();
    })
    .once("connect", () => {
      console.log(`TCP 连接建立成功: ${localAddress} <===> ${serverAddress}`);

      // TCP 连接建立成功后，移除连接超时和连接失败的事件监听
      serverSocket.removeAllListeners("error");
      serverSocket.removeAllListeners("timeout");
      serverSocket.setTimeout(0);

      // 对 clientSocket 和 serverSocket 的数据进行双向转发
      tunnel(clientSocket, serverSocket, (err, time) => {
        console.log(`隧道已断开，隧道存活了 ${time} 毫秒`);
        console.log(`${clientAddress} 累积向 ${serverAddress} 发送了 ${serverSocket.bytesWritten} 字节的数据`);
        console.log(`${serverAddress} 累积向 ${clientAddress} 发送了 ${clientSocket.bytesWritten} 字节的数据`);

        if (err) {
          console.log(`隧道断开是因为 ${err.causedBy === serverSocket ? "serverSocket" : "clientSocket"} 抛出了错误:`, err);
        }
      });
    });
}).listen(localPort, localAddress, () => {
  console.log("proxy server start", proxyServer.address());
});
```

如果你可以使用 `ssh -i ~/.ssh/id_rsa -p 22 root@xxx.xxx.xxx.xxx` 命令远程登录到 `xxx.xxx.xxx.xxx` 主机，在本地启动上面的代理服务后，你现在应该也可以使用 `ssh -i ~/.ssh/id_rsa -p 8001 root@127.0.0.1` 登录进去该主机了。

客户端与 SSH 服务端直连时的示意图：

<img src="https://user-images.githubusercontent.com/5093611/230402930-104220fa-a75f-4439-8729-f6032348e7ff.png">

通过代理服务连接时的示意图：

<img src="https://user-images.githubusercontent.com/5093611/230704470-005b3da8-670a-4644-ac64-f5ce2065a15f.png">

## API

```ts
type DuplexLike = {
  rs: Readable; // readable stream
  ws: Writable; // writable stream
  allowHalfOpen?: boolean; // 默认 false，即当 rs 结束时，自动终止 ws
  allowPipeHalfOpen?: boolean; // 默认 false，即当 rs 结束时，自动终止 tunnel 另一端的 ws
};

function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, callback: callback): void;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number, callback: callback): void;
```

关于 `allowHalfOpen`, `allowPipeHalfOpen` 以及 `condition` 参数的解释参考下图：

<img src="https://user-images.githubusercontent.com/5093611/230703693-41e7eb1c-2bd5-4062-860a-850d0df2ba29.png">
