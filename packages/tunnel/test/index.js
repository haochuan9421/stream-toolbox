const tunnel = require("@stream-toolbox/tunnel");
const { Duplex, Readable, Writable } = require("stream");
const { equal } = require("assert");

class DuplexA extends Duplex {
  constructor(allowHalfOpen) {
    super({ allowHalfOpen });
    this.times = 4;
    this.chunks = [];
  }
  _read() {
    // push 四次数据就结束可读流
    if (this.times > 0) {
      this.push(Buffer.alloc(16384, "a"));
    }
    this.times--;
    if (this.times === 0) {
      this.push(null);
    }
  }
  _write(chunk, encoding, cb) {
    this.chunks.push(chunk);
    cb(null);
  }
}

class DuplexB extends Duplex {
  constructor(allowHalfOpen) {
    super({ allowHalfOpen });
    this.times = 4;
    this.chunks = [];

    this.once("end", () => {
      clearTimeout(this.timer);
    });
  }
  _read() {
    this.timer = setTimeout(() => {
      if (this.times > 0) {
        this.push(Buffer.alloc(16384, "b"));
      }
      this.times--;
      if (this.times === 0) {
        this.push(null);
      }
    }, 100);
  }
  _write(chunk, encoding, cb) {
    this.chunks.push(chunk);
    cb(null);
  }
}

class ReadableA extends Readable {
  constructor() {
    super();
    this.times = 4;
  }
  _read() {
    if (this.times > 0) {
      this.push(Buffer.alloc(16384, "a"));
    }
    this.times--;
    if (this.times === 0) {
      this.push(null);
    }
  }
}

class ReadableB extends Readable {
  constructor() {
    super();
    this.times = 4;
    this.once("end", () => {
      clearTimeout(this.timer);
    });
  }
  _read() {
    this.timer = setTimeout(() => {
      if (this.times > 0) {
        this.push(Buffer.alloc(16384, "b"));
      }
      this.times--;
      if (this.times === 0) {
        this.push(null);
      }
    }, 100);
  }
}

class WritableCommon extends Writable {
  constructor() {
    super();
    this.chunks = [];
  }
  _write(chunk, encoding, cb) {
    this.chunks.push(chunk);
    cb(null);
  }
}

// 正常情况下 a.rs 很快就会结束，b.rs 需要 4 个 100 ms 才会结束
(async () => {
  {
    const a = new DuplexA(false);
    const b = new DuplexB(true);
    const time = await tunnel(a, b, 0b1111);
    // 因为 a.allowPipeHalfOpen 没设置（默认是 false）
    // 所以当 a.rs 结束时，会自动结束 b.ws

    // 因为 a.allowHalfOpen 是 false
    // 所以当 a.rs 结束时，会自动结束 a.ws

    // 因为 a.ws 结束了
    // 所以 b.rs 也会被提前结束

    // 综上可知，4 个部分均会很快结束，也即 tunnel 关闭
    // 所以必然有：

    // 1. time 值很小（大概是连续 push 四次数据的时间）
    equal(time < 100, true);
    // 2. b.ws 会收到 a.rs 的全部数据，总计 16384 * 4 字节
    equal(
      b.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    // 3. b.ws 收到的全是字符 'a'
    equal(
      b.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    // 4. 由于 b.rs 没产生任何数据，所以 a.ws 也不会被没写入任何数据
    equal(
      a.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      0
    );
  }

  {
    const a = new DuplexA(true);
    const b = new DuplexB(true);
    const time = await tunnel(a, b, 0b1111);
    // 因为 a.allowHalfOpen 是 true
    // 所以 a.ws 不会因为 a.rs 的结束而结束
    // 也即当 a.rs -> b.ws 关闭时，a.ws <- b.rs 依然会进行
    // b.rs 的结束大概需要 400 ms
    // 所以必然有：
    equal(time >= 400 && time < 500, true);
    equal(
      b.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      b.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    equal(
      a.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      a.chunks.every((chunk) => chunk.every((byte) => byte === 98 /* b */)),
      true
    );
  }

  {
    const a = new DuplexA(true);
    const b = new DuplexB(true);
    const time = await tunnel(a, b, 0b1001);
    // 因为 tunnel 的结束条件是 0b1001
    // 也即 a.rs（0b1000）和 b.ws（0b0001）结束就关闭隧道
    // 虽然 a.allowHalfOpen 是 true，关闭隧道时 a.ws <- b.rs 依然可用
    // 但也必然有：
    equal(time < 100, true);
    equal(
      b.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      b.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    equal(
      a.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      0
    );
  }

  // 下面的三个测试用例和上面的一样，只不过不是直接使用 Duplex，而是使用独立的可读流和可写流
  {
    const a = {
      rs: new ReadableA(),
      ws: new WritableCommon(),
      allowHalfOpen: false,
      allowPipeHalfOpen: false,
    };
    const b = {
      rs: new ReadableB(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const time = await tunnel(a, b, 0b1111);

    equal(time < 100, true);
    equal(
      b.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      b.ws.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    equal(
      a.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      0
    );
  }

  {
    const a = {
      rs: new ReadableA(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const b = {
      rs: new ReadableB(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const time = await tunnel(a, b, 0b1111);
    equal(time >= 400 && time < 500, true);
    equal(
      b.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      b.ws.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    equal(
      a.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      a.ws.chunks.every((chunk) => chunk.every((byte) => byte === 98 /* b */)),
      true
    );
  }

  {
    const a = {
      rs: new ReadableA(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const b = {
      rs: new ReadableB(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const time = await tunnel(a, b, 0b1001);
    equal(time < 100, true);
    equal(
      b.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      65536
    );
    equal(
      b.ws.chunks.every((chunk) => chunk.every((byte) => byte === 97 /* a */)),
      true
    );
    equal(
      a.ws.chunks.reduce((total, chunk) => (total += chunk.length), 0),
      0
    );
  }

  // 测试某一端抛出错误的场景
  {
    const a = {
      rs: new ReadableA(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    const b = {
      rs: new ReadableB(),
      ws: new WritableCommon(),
      allowHalfOpen: true,
      allowPipeHalfOpen: false,
    };
    tunnel(a, b, 0b1111, (err, time) => {
      equal(err.causedBy === b.rs, true);
      equal(time >= 200 && time < 300, true);
    });

    // 在 a.ws <- b.rs 还在进行的时候，手动触发一个错误
    setTimeout(() => {
      b.rs.emit("error", new Error("foo"));
    }, 200);
  }
})();
