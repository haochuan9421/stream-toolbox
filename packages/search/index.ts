import { Buffer } from "buffer";

type callback = (isMatch: boolean, data: Buffer) => void;
type opts = {
  needle: string | Buffer;
  limit?: number;
  abandon?: boolean;
};

class StreamSearch {
  private pos: number;
  lookback: Buffer[];
  matched: number;
  limit: number;
  abandon: boolean;
  needle: Buffer;
  private nLen: number;
  private nLast: number;
  private move: number[];
  private cb: callback;

  constructor(opts: opts | string | Buffer, cb: callback) {
    if (typeof cb !== "function") {
      throw new Error("Missing match callback");
    }
    this.cb = cb;
    this.reset(opts);
  }
  reset(opts: opts | string | Buffer) {
    this.pos = 0;
    this.lookback = [];
    this.matched = 0;
    if (typeof opts === "string" || Buffer.isBuffer(opts)) {
      this.limit = Infinity;
      this.abandon = true;
      this.resetNeedle(opts);
    } else {
      if (typeof opts.limit === "undefined") {
        this.limit = Infinity;
      } else if (Number.isInteger(opts.limit) && opts.limit > 0) {
        this.limit = opts.limit;
      } else {
        throw new Error(`Expected positive interger for limit`);
      }
      this.abandon = opts.abandon !== false;
      this.resetNeedle(opts.needle);
    }
  }
  resetNeedle(needle: string | Buffer) {
    if (typeof needle === "string") {
      needle = Buffer.from(needle, "utf-8");
    }
    if (!Buffer.isBuffer(needle)) {
      throw new Error(`Expected Buffer for needle, got ${typeof needle}`);
    }
    if (!needle.length) {
      throw new Error(`Empty Buffer`);
    }
    if (Buffer.isBuffer(this.needle) && this.needle.equals(needle)) {
      return;
    }
    this.needle = needle;
    this.nLen = this.needle.length;
    this.nLast = this.nLen - 1;
    this.move = new Array(256).fill(this.nLen);
    for (let i = 0; i < this.nLast; i++) {
      this.move[this.needle[i]] = this.nLast - i;
    }
  }
  push(chunk: string | Buffer) {
    if (!chunk) {
      return;
    }

    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk, "utf-8");
    }

    if (this.matched >= this.limit) {
      this.abandon || this.cb(false, chunk);
      return;
    }

    let offset = 0;
    while (this.pos <= chunk.length - this.nLen) {
      if (this.pos < 0) {
        let i = this.pos;
        let j = 0;
        // chunk[i] 一定不会溢出，因为 i 最多只会增加 this.nLen - 1 且 this.pos + this.nLen - 1 <= chunk.length - 1（最外层 while 循环的判断条件的变换）
        while (j < this.nLen && this.needle[j] === (i < 0 ? this.lookbackAt(i) : chunk[i])) {
          i++;
          j++;
        }
        if (j === this.nLen) {
          this.lookbackUnload(this.pos);
          this.pos += this.nLen;
          offset = this.pos;
          if (++this.matched === this.limit) {
            return this.cb(true, this.abandon ? Buffer.alloc(0) : chunk.subarray(offset));
          } else {
            this.cb(true, Buffer.alloc(0));
          }
        } else {
          // chunk[this.pos + this.nLast] 一定不会溢出，因为 this.pos + this.nLen - 1 >=0（断言 this.pos > -this.nLen 的变换，参考底部注释）
          this.pos += this.move[chunk[this.pos + this.nLast]];
          this.lookbackShift(this.pos);
        }
      } else {
        const idx = chunk.indexOf(this.needle, this.pos);
        if (idx !== -1) {
          idx !== offset && this.cb(false, chunk.subarray(offset, idx));
          this.pos = idx + this.nLen;
          offset = this.pos;
          if (++this.matched === this.limit) {
            return this.cb(true, this.abandon ? Buffer.alloc(0) : chunk.subarray(offset));
          } else {
            this.cb(true, Buffer.alloc(0));
          }
        } else {
          const end = chunk.length - 1;
          const start = end - this.nLast;
          this.pos = start + this.move[chunk[end]];
        }
      }
    }

    const remain = chunk.subarray(offset);
    if (remain.length) {
      // 如果下轮匹配的起点还在 chunk 之中，则把 chunk 放入 lookback 中，否则说明该 chunk 再也用不上了，可以直接回调出去了
      this.pos < chunk.length ? this.lookback.push(remain) : this.cb(false, remain);
    }

    // 能执行到此处，说明上面的 while 循环的判断条件已不满足
    // 即: this.pos > chunk.length - this.nLen
    // 把 this.pos 减少 chunk.length 后: this.pos > -this.nLen
    // 又因为 while 循环中 this.pos 只会增加不会减少，所以 this.pos 的值任何时候都是大于 -this.nLen
    this.pos -= chunk.length;
  }
  flush() {
    while (this.lookback.length) {
      this.cb(false, this.lookback.shift()!);
    }
  }
  // idx 位置的值是什么
  private lookbackAt(idx: number) {
    // idx < 0
    for (let i = this.lookback.length - 1, offset = 0; i > -1; i--) {
      const chunk = this.lookback[i];
      offset -= chunk.length;
      if (offset <= idx) {
        return chunk[idx - offset];
      }
    }
  }
  // 从 lookback 中移除 idx 之前的 chunk，这些被移除的 chunk 是必然无法匹配的 chunk
  private lookbackShift(idx: number) {
    // idx 不一定小于 0
    if (idx >= 0) {
      while (this.lookback.length) {
        this.cb(false, this.lookback.shift()!);
      }
      return;
    }

    for (let i = this.lookback.length - 1, offset = 0, shift = false; i > -1; i--) {
      if (shift) {
        this.cb(false, this.lookback.shift()!);
      } else {
        const chunk = this.lookback[i];
        offset -= chunk.length;
        shift = offset <= idx;
      }
    }
  }
  // 从 lookback 中移除 idx 之前的数据，并清空 lookback
  private lookbackUnload(idx: number) {
    // idx < 0
    let lastChunk;
    for (let i = this.lookback.length - 1, offset = 0, shift = false; i > -1; i--) {
      if (shift) {
        this.cb(false, this.lookback.shift()!);
      } else {
        const chunk = this.lookback[i];
        offset -= chunk.length;
        shift = offset <= idx;
        if (shift && idx !== offset) {
          lastChunk = chunk.subarray(0, idx - offset);
        }
      }
    }
    lastChunk && this.cb(false, lastChunk);
    // 因为 this.pos > -this.nLen，且下一轮匹配的 this.pos 会跳过 needle，所以下轮的 this.pos 必然大于0，所以 lookback 可以清空了
    this.lookback = [];
  }
}

export = StreamSearch;
