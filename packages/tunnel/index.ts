import { Duplex, Readable, Writable } from "stream";

interface TunnelError extends Error {
  readonly causedBy: Duplex | Readable | Writable;
}

// 给错误添加 causedBy 属性，方便定位错误来源
function nomalizeError(err: Error, causedBy: Duplex | Readable | Writable): TunnelError {
  const descriptors = Object.getOwnPropertyDescriptors(err);
  descriptors.causedBy = {
    enumerable: false, // 设置为 false 可以避免 console.log(err) 的时候输出 causedBy，但这不影响用户直接通过 err.causedBy 查看错误来源
    configurable: false,
    writable: false,
    value: causedBy,
  };
  return Object.create(Object.getPrototypeOf(err), descriptors);
}

type DuplexLike = {
  rs: Readable; // readable stream
  ws: Writable; // writable stream
  allowHalfOpen?: boolean; // 默认 false，即当 rs 结束时，自动终止 ws
  allowPipeHalfOpen?: boolean; // 默认 false，即当 rs 结束时，自动终止 tunnel 另一端的 ws
};

// 提供统一的对流的访问方式
function nomalizeDuplex(d: Duplex | DuplexLike): DuplexLike {
  if (d instanceof Duplex) {
    return Object.defineProperties(
      {
        rs: d,
        ws: d,
        _native: true,
      },
      {
        // 继承 duplex 的 allowHalfOpen 属性，之所以不直接赋值，是为了兼容 allowHalfOpen 被动态修改的场景
        allowHalfOpen: {
          get() {
            return d.allowHalfOpen;
          },
        },
        // 虽然 duplex 没有这个属性，但如果用户给 duplex 手动加了这个属性，就拿来用，如果没加的话，就当默认的 false 了，也不影响啥
        allowPipeHalfOpen: {
          get() {
            // @ts-ignore
            return d.allowPipeHalfOpen;
          },
        },
      }
    );
  }
  return d;
}

type callback = (err: TunnelError | null, time: number) => void;

// 双向转发数据，如果未提供回调函数，则返回 Promise
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number): Promise<number>;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, callback: callback): void;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, condition: number, callback: callback): void;
function tunnel(a: Duplex | DuplexLike, b: Duplex | DuplexLike, ...args: any[]) {
  // 规范化传过来的参数
  // 其中 condition 是隧道的关闭条件
  // a.rs 结束时的信号是 0b1000
  // a.ws 结束时的信号是 0b0100
  // b.rs 结束时的信号是 0b0010
  // b.ws 结束时的信号是 0b0001
  // 当以上四部分中的任意一部分结束时，都会把所有已结束部分的信号值做一次“或运算”（OR）
  // 如果运算结果和 condition 一致，就执行 callback 或 resolve 返回的 Promise
  // condition 的默认值是 0b1111，也即四部分全部结束了才关闭隧道
  const _a = nomalizeDuplex(a);
  const _b = nomalizeDuplex(b);
  let condition: number;
  let callback: callback;

  switch (args.length) {
    case 0:
      condition = 0b1111;
      break;
    case 1:
      if (typeof args[0] === "number") {
        condition = args[0];
      } else if (typeof args[0] === "function") {
        condition = 0b1111;
        callback = args[0];
      } else {
        throw new Error("invalid params");
      }
      break;
    case 2:
      if (typeof args[0] === "number" && typeof args[1] === "function") {
        condition = args[0];
        callback = args[1];
      } else {
        throw new Error("invalid params");
      }
      break;
    default:
      throw new Error("invalid params");
  }

  const start = Date.now();
  let resolve: () => void;
  let reject: (err: TunnelError) => void;
  let promise: Promise<number>;
  // @ts-ignore
  if (callback) {
    resolve = () => callback(null, Date.now() - start);
    reject = (err) => callback(err, Date.now() - start);
  } else {
    promise = new Promise((_resolve, _reject) => {
      resolve = () => _resolve(Date.now() - start);
      reject = (err) => _reject(err);
    });
  }

  let failed = 0;
  let constructed = 0;
  let settled = 0;

  const cleanA2B = pipe(_a, _b, 2); // a.rs -> b.ws
  const cleanB2A = pipe(_b, _a, 0); // a.ws <- b.rs

  // 当某部分结束时调用
  const onDone = (signal: number) => {
    if ((constructed |= signal) === condition && ++settled === 1) {
      cleanA2B();
      cleanB2A();
      resolve();
    }
  };

  // 当某部分发生错误时调用
  const onFail = (err: TunnelError) => {
    if (++failed === 1 && ++settled === 1) {
      _a.rs.destroyed || _a.rs.destroy();
      _a.ws.destroyed || _a.ws.destroy();
      _b.rs.destroyed || _b.rs.destroy();
      _b.ws.destroyed || _b.ws.destroy();
      cleanA2B();
      cleanB2A();
      reject(err);
    }
  };

  function pipe(x: DuplexLike, y: DuplexLike, signalMove: number) {
    // 当 x.rs 收到新数据时，立即转发（写入）给 y.ws，如果 y.ws 的内部缓冲区已满，则暂停对 x.rs 的读取
    const onReadData = (chunk: any) => {
      y.ws.write(chunk) || x.rs.pause();
    };
    // 当 x.rs 结束时
    const onReadEnd = () => {
      // 如果 x 的 allowPipeHalfOpen 属性是 false
      // 则应执行 y.ws.end()，结束 y.ws
      if (!x.allowPipeHalfOpen) {
        y.ws.end();
      }
      // 如果 x 的 allowHalfOpen 属性是 false
      // 则应执行 x.ws.end()，结束 x.ws
      // 对于原生的 duplex 来说，Node.js 会自动执行这一操作，我们就不多此一举了
      // @ts-ignore
      if (!x.allowHalfOpen && !x._native) {
        x.ws.end();
      }

      onDone(0b10 << signalMove);
    };
    // 当 x.rs 发生错误时
    const onReadError = (err: Error) => {
      onFail(nomalizeError(err, x.rs));
    };

    // 当 x.ws 的内部缓冲区有可用空间时，恢复对 y.rs 的读取
    const onWriteDrain = () => {
      y.rs.resume();
    };
    // 当 x.ws 结束时
    const onWriteFinish = () => {
      // x.ws <- y.rs 方向就不应再有数据流动了，因为向已结束的 ws 写入数据会抛出错误
      // 但此时 y.rs 并未关闭，所以需要手动结束 y.rs
      // 其实 y.rs 扮演的是 x 的对端的可读流的角色
      // 当 x.ws 结束时，其对端的可读流就会结束，所以 y 这个“镜像”可读流也就没有存活的必要了
      y.rs.push(null); // 如果 y.rs 已经结束了，push(null) 不会产生副作用（只要不是 push(data) 就没关系）
      // 需要补充说明的是：
      // 如果这个 "finish" 事件是因为 x.rs 结束了
      // 且 x.allowHalfOpen 是 false， 执行了 x.ws.end() 才触发的
      // 那么当 x.allowPipeHalfOpen 也是 false 时，y.ws 会被关闭
      // 但即使是这样，y.rs 也并不一定会关闭，因为 y.rs 的结束取决于 y 的对端（我们记作 z）
      // 假设 y 和 z 是 TCP 连接两端的 socket
      // z.rs 会在完全读取了写入 y.ws 的数据后收到一个 'end' 事件
      // 即 y.ws 的结束，会导致 z.rs 的结束
      // 如果 z 的 allowHalfOpen 属性是 false，则 z.ws 也会被自动结束
      // 这反过来才会导致了 y.rs 的结束
      // 但如果 z 的 allowHalfOpen 属性是 true，则 z.ws 并不会自动结束
      // 相应的 y.rs 也不会结束
      // 此时 y <-> z 的这个 TCP 连接处于单工的通信状态，即 y -> z 不可用，但 y <- z 依然可用
      // 我们无从得知 z 的 allowHalfOpen 属性是什么
      // 但如果在知道的情况下应让 x 的 allowHalfOpen 属性和 z 保持一致（对于 x 的对端来说，它眼中的 x 就是 z，可以理解为 x 就是 z 的镜像）
      // 这样可以避免 y <- z 可用，但 x <- y 不可用的发生
      // 不过不管怎样，既然已经知道 x.ws 已经结束了，也就没必要留着 y.rs 了

      onDone(0b01 << signalMove);
    };
    // 当 x.ws 发生错误时
    const onWriteError = (err: Error) => {
      onFail(nomalizeError(err, x.ws));
    };

    x.rs.on("data", onReadData).on("end", onReadEnd).on("error", onReadError);
    x.ws.on("drain", onWriteDrain).on("finish", onWriteFinish).on("error", onWriteError);
    return () => {
      x.rs.removeListener("data", onReadData).removeListener("end", onReadEnd).removeListener("error", onReadError);
      x.ws.removeListener("drain", onWriteDrain).removeListener("finish", onWriteFinish).removeListener("error", onWriteError);
    };
  }

  // @ts-ignore
  return promise;
}

export = tunnel;
