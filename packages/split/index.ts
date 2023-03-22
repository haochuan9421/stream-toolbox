import StreamSearch = require("@stream-toolbox/search");
import { Readable, ReadableOptions, Writable, WritableOptions } from "stream";

type partOptions = {
  separator: number | Buffer | string; // 区块终止条件，如果是正整数则创建的区块会在到达 separator 大小时终止，如果是 Buffer (或 string) 则创建的区块会在遇到 separator 时终止
  keepSeparator?: boolean; // 如果 separator 是 Buffer (或 string) ，默认情况下区块尾部是不包含 separator 的，设置为 true，separator 会保留在区块尾部。
  head?: Buffer | string; // 可用于自定义每个区块头部的内容，默认为空
  tail?: Buffer | string; // 可用于自定义每个区块尾部的内容，默认为空
  readableOptions?: Omit<ReadableOptions, "objectMode" | "read">;
};
type partConfig = {
  separator: number | Buffer;
  keepSeparator: boolean;
  head: Buffer;
  tail: Buffer;
  readableOptions: ReadableOptions;
};

class Part extends Readable {
  kickoff: boolean = false; // Readable 的成员方法 read 是否已触发过
  cutted: boolean = false; // 属于该区块的数据是否已全部 push 进来
  called: number = 0; // 该区块关联的 callback 函数被调用了多少次
  size: number = 0; // 该区块实际包含了多少字节的数据
  index: number; // 是第几个区块，从 0 开始
  space: number; // 该区块还可以 push 多少字节的数据
  config: partConfig;

  constructor(config: partConfig) {
    super(config.readableOptions);
    if (typeof config.separator === "number") {
      this.space = config.separator - config.tail.length;
    } else {
      this.space = Infinity;
    }
    this.config = config;
  }
}

type onPart = (
  this: Spliter,
  part: Part,
  callback: (error?: Error | null, config?: partOptions["separator"] | partOptions) => void
) => void | Promise<partOptions["separator"] | partOptions>;

class Spliter extends Writable {
  private part: Part; // 当前的区块
  partCount: number; // 已创建了多少个区块
  private forwardable: boolean; // 用于控制 _write 接收数据的节奏，如果 forwardable 为 true 则立即把数据转发（forward）给当前的区块
  private freeze: Parameters<Exclude<WritableOptions["write"], undefined>> | null; // 如果 forwardable 为 false，则先把 _write 接收的数据暂存在 freeze 中，直到 this.part 的 read 方法触发时再转发
  private remain: Buffer[]; // 用于暂存当前 part 无法消费的数据，比如 forward 的数据量超出了当前区块的可用空间，则多余的数据会暂存在 remain 中，以供下一个 part 消费
  private finalCb: ((error?: Error | null) => void) | null; // _final 的回调函数，_final 触发时不能立即执行它的回调，而应该等待 this.remain 中的数据清空了，且用户处理完最后一个区块后再执行，执行后会 emit 'finish' 事件
  private finalCbed: boolean; // finalCb 是否已被调用
  private searcher: StreamSearch; // 流式搜索工具
  private onPart: onPart;

  constructor(partOptions: partOptions["separator"] | partOptions, onPart: onPart, opts?: Omit<WritableOptions, "objectMode" | "write" | "writev" | "final" | "destroy">) {
    super({ ...opts, objectMode: false });
    this.partCount = 0;
    this.forwardable = false; // _write 可能在 createPart 还未被调用时就触发了，所以 forwardable 的初始化状态必须是 false，以保证 part 创建前的这段时间 forward 一定不会被调用
    this.freeze = null;
    this.remain = [];
    this.finalCb = null;
    this.finalCbed = false;
    this.onPart = onPart.bind(this);
    process.nextTick(() => this.createPart(partOptions)); // 这里不加 nextTick 对功能也没啥影响，但加了可以保证 onPart 回调的执行晚于同步代码，这也是 Node.js 中大部分回调形式的接口的习惯
  }
  private createPart(partOptions: partOptions["separator"] | partOptions) {
    // 当 'finish' 事件 emit 之后或 this 被销毁之后，不再创建新的 part
    if (this.finalCbed || this.destroyed) {
      return;
    }
    // this.finalCb 存在则表明 this.end() 已被调用且所有 _write 的 callback 也都已被调用
    // this.remain 为空表明所有从原可读流获取的数据都已转发给子可读流 (part) 了
    // 这种情况一般发生在最后一个 part 被用户处理完毕后
    // 此时应该执行 finalCb 而不是创建新的区块，执行 finalCb 会 emit 'finish' 事件
    // 增加 this.partCount 这个条件是为了保证至少创建一个 part，比如用户希望拆分一个空的可读流，那么拆分的结果至少也得有一个，即使拆分出的 part 也是空的
    if (this.finalCb && this.remain.length === 0 && this.partCount) {
      this.finalCbed = true;
      this.finalCb(null);
      return;
    }
    if (this.part) {
      // part 未结束时，不可创建下一个 part
      if (!this.part.cutted) {
        this.destroy(new Error("The data in current part has not been all read out, you should wait for the 'end' event emit!"));
        return;
      }
      // part 对应的 callback 只能调用一次
      if (this.part.called !== 1) {
        this.destroy(new Error("'callback' can only be called once! If 'onPart' is an async function, you don't need call 'callback' manually!"));
        return;
      }
    }

    // 整理参数
    const partConfig = this.normalizeConfig(partOptions);
    if (partConfig instanceof Error) {
      this.destroy(partConfig);
      return;
    }

    partConfig.readableOptions = {
      ...partConfig.readableOptions,
      objectMode: false,
      read: () => {
        // read 只要触发了，就说明当前 part 可以 push 新数据了
        this.forwardable = true;

        // read 第一次触发时，应先添加自定义的头部和上一轮遗留的数据
        if (!this.part.kickoff) {
          this.part.kickoff = true;
          if (partConfig.head.length) {
            this.remain.unshift(partConfig.head);
          }
          const chunk = Buffer.concat(this.remain);
          this.remain = [];
          this.forward(chunk, "buffer", () => {
            // 当 _final 触发后，依然可以基于 remain 中数据创建区块，这种情况下创建的区块是没法利用 _final 来结束自己的
            // 如果剩余的数据又不足以触发区块的终止条件，则只能在此手动结束了
            if (this.finalCb && this.remain.length === 0) {
              this.cut();
            }
          });
        }

        // 如果 forwardable 是 true，则可以解除对 _write 的限制了，反之则交由下一次 read 的触发来解除
        if (this.forwardable && this.freeze) {
          const freeze = this.freeze;
          this.freeze = null;
          this.forward(...freeze);
        }
      },
    };

    // 如果 separator 是 Buffer，需要做好流式搜索的准备
    if (Buffer.isBuffer(partConfig.separator)) {
      this.initSearcher(partConfig.separator);
    }

    // 创建区块并递增索引
    this.part = new Part(partConfig);
    this.part.index = this.partCount++;

    // 通过 onPart 回调把当前的 part 发送给用户，用户可以自己读取这个 part 的数据，当用户读取完毕后，
    // 也即 part 的 'end' 事件触发后，用户才可以通过调用 callback 函数或结束 promise 来告知我们创建下一个 part
    // 之所以在 nextTick 之后再执行 createPart 创建下一个 part 是因为：
    // part 的 'end' 事件可能先于 this 的 '_final' 触发（ 当 Node.js 版本 < v15 会这样）
    // 假设 this 共接收了 200MB 的数据，我们按照 100MB 的大小划分区块
    // 那么当最后一个数据 push 给第二个 part 时，该 part 的终止条件也就满足了，this.cut() 会被立刻调用，也即 part.push(null) 会立刻执行，也即 part 的 'end' 事件即将触发
    // 与此同时最后一个 _write 的 callback 也会立即被调用，也即 this 的 '_final' 即将触发
    // 但 part 的 'end' 事件可能比 '_final' 先触发，用户很可能在收到 'end' 事件后立即调用 callback 函数或结束 promise
    // 此时会第三次执行 createPart，由于无法保证 '_final' 的先触发，也就无法保证 this.finalCb 的存在了
    // 这就会导致有可能创建出 3 个 part，这显然不符合我们的预期，我们只希望创建 2 个 part
    // 在 nextTick 后 createPart 可以保证在可读流结束后，不创建无意义的子可读流
    const ret = this.onPart(this.part, (error, nextConfig = partConfig) => {
      this.part.called++;
      if (error != null) {
        this.destroy(error);
      } else {
        process.nextTick(() => this.createPart(nextConfig));
      }
    });
    if (ret instanceof Promise) {
      ret
        .then((nextConfig = partConfig) => {
          this.part.called++;
          process.nextTick(() => this.createPart(nextConfig));
        })
        .catch((error) => {
          this.part.called++;
          this.destroy(error);
        });
    }
  }
  private normalizeConfig(partOptions: partOptions["separator"] | partOptions): partConfig | Error {
    let separator: any, keepSeparator: any, head: any, tail: any, readableOptions: any;

    if (Object.prototype.toString.call(partOptions) === "[object Object]") {
      separator = (partOptions as partOptions).separator;
      keepSeparator = (partOptions as partOptions).keepSeparator === true;
      head = (partOptions as partOptions).head ?? Buffer.alloc(0);
      tail = (partOptions as partOptions).tail ?? Buffer.alloc(0);
      readableOptions = (partOptions as partOptions).readableOptions ?? {};
    } else {
      separator = partOptions as partOptions["separator"];
      keepSeparator = false;
      head = Buffer.alloc(0);
      tail = Buffer.alloc(0);
      readableOptions = {};
    }

    typeof separator === "string" && (separator = Buffer.from(separator, "utf-8"));
    typeof head === "string" && (head = Buffer.from(head, "utf-8"));
    typeof tail === "string" && (tail = Buffer.from(tail, "utf-8"));

    if ((Buffer.isBuffer(separator) && separator.length > 0) || (typeof separator === "number" && separator > 0)) {
      if (!Buffer.isBuffer(head)) {
        return new Error("head can only be buffer or string");
      }
      if (!Buffer.isBuffer(tail)) {
        return new Error("tail can only be buffer or string");
      }
      if (typeof separator === "number" && head.length + tail.length > separator) {
        return new Error("head.length + tail.length show be less than part limit size");
      }
      return { separator, head, tail, keepSeparator, readableOptions };
    }
    return new Error("separator can only be non-empty buffer (string) or positive integer!");
  }
  private initSearcher(separator: Buffer) {
    if (this.searcher) {
      // 如果 searcher 已创建，则重置
      this.searcher.reset({ needle: separator, limit: 1, abandon: false });
    } else {
      // 如果 searcher 未创建，则以当前的 separator 为 needle 创建 searcher
      this.searcher = new StreamSearch({ needle: separator, limit: 1, abandon: false }, (isMatch, chunk) => {
        // 通过 searcher.push() 添加数据时，会以同步的方式对数据进行搜索
        // 当添加的数据必然无法匹配 needle 时，会被立刻回调回来，此时 isMatch 是 false，但如果不能确定这个数据是否可以匹配，searcher 会把 push 的数据先暂存在内部
        // 比如 needle 是 'foo'，我们先 push 一个 'barfo'，此时还不能确定这个数据是否可以匹配成功，所以会先暂存在 searcher 内部而不是回调出来（除非手动调用 searcher.flush()）
        // 假设我们后面添加了 'obazfoo'，则会先把 'bar' 回调出来，回调这部分数据时 isMatch 是 false
        // 再把 'bazfoo' 回调回来，此时 isMatch 是 true，第二个 foo 之所以不会被检查，是因为 limit 是 1，也即只匹配一次
        if (isMatch) {
          if (this.part.config.keepSeparator) {
            this.part.size += (this.part.config.separator as Buffer).length;
            this.part.push(this.part.config.separator);
          }
          if (chunk.length) {
            this.remain.push(chunk);
          }
          this.cut();
        } else if (chunk.length) {
          this.part.size += chunk.length;
          this.forwardable = this.part.push(chunk);
        }
      });
    }
  }
  // 当区块的终止条件满足时或不会再有更多数据时，结束当前的区块（可读流）
  private cut() {
    if (!this.part || this.part.cutted) {
      return;
    }
    this.part.cutted = true;
    // 将 this.forwardable 设置为 false 是为了保证下一个 part 准备好之前的这段时间 forward 方法一定不会被调用
    this.forwardable = false;
    // 之所以不在 _final 中执行 flush 是因为：
    // _final 触发时，最后一次 push 给 searcher 的数据可能会匹配 separator，且 separator 后面可能还有部分数据
    // 当匹配到 separator 时，后面的数据会转移到 this.remain 中
    // 此时执行 flush 是没有意义的，因为匹配成功后，searcher.lookback 本身就是空的
    // 且之后基于 this.remain 中的数据再创建 part 时，这部分剩余数据会重新 push 给 searcher 用于搜索
    // 这就又会导致 searcher 中残存数据了，但此时 _final 不会再次触发了
    // 把 flush 操作放在 cut 方法里的好处在于，无论是在 _final 中执行的 cut，还是在 this.remain 清空后执行的 cut，searcher 中的残存的数据一定可以交给最后一个 part
    if (Buffer.isBuffer(this.part.config.separator)) {
      this.searcher.flush();
    }
    // 添加自定义的尾部
    this.part.size += this.part.config.tail.length;
    this.part.push(this.part.config.tail);
    // 结束 part
    this.part.push(null);
  }
  // 把 _write 接收到的数据转发给区块
  private forward(chunk: Buffer, encoding: string, callback: (error?: Error | null) => void) {
    if (Buffer.isBuffer(this.part.config.separator)) {
      this.searcher.push(chunk);
    } else if (this.part.space > chunk.length) {
      this.part.size += chunk.length;
      this.part.space -= chunk.length;
      this.forwardable = this.part.push(chunk);
    } else {
      const last = chunk.subarray(0, this.part.space);
      const remain = chunk.subarray(this.part.space);
      this.part.size += last.length;
      this.part.space = 0;
      if (remain.length) {
        this.remain.push(remain);
      }
      this.part.push(last);
      this.cut();
    }
    callback(null);
  }
  // _write 的 callback 被调用后，_write 才有可能再次触发
  // _write 从触发到 callback 被调用的这段时间，添加给 this 的数据会暂存在 this 的内部缓冲区中
  // 当缓冲区的数据大小到达 highWatchMark（默认 16KB）时，this.write() 会返回 false
  // 此时用户不宜再向 this 添加数据，否则可能导致内存泄漏
  _write(...args: Parameters<Exclude<WritableOptions["write"], undefined>>) {
    if (this.forwardable) {
      this.forward(...args);
    } else {
      this.freeze = args;
    }
  }
  // 如果 this.end() 方法被调用了，且所有数据都已发给了 _write，且所有 _write 的 callback 都被调用了（回调的不是 error），才会触发 _final
  // 还有一种情况是 this.write() 没被调用过，就直接调用 this.end() 了，也会触发 _final
  // _final 触发时 this.remain 中可能还有数据，this.searcher 内部也可能还有数据，所以我们必须把这些剩余数据处理干净了再执行 _final 的 callback
  // 只有 _final 的 callback 被调用了（回调的不是 error），才会 emit "finish" 事件
  _final(callback: (error?: Error | null) => void) {
    this.finalCb = callback;
    this.cut();
  }
  // 当 this.destroy() 被调用了 或 _write 的 callback 回调了 error 或 _final 的 callback 被调用了（autoDestroy 为 true) 都会触发 _destroy
  // _destroy 的 callback 被调用后才会 emit "close" 事件（emitClose 为 true）
  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    // 当发生错误时，也应自动销毁当前的区块
    if (error != null && this.part && !this.part.destroyed) {
      this.part.destroy(error);
    }
    callback(error);
  }
}

function createSpliter(partOptions: partOptions["separator"] | partOptions, onPart: onPart, opts?: Omit<WritableOptions, "objectMode" | "write" | "writev" | "final" | "destroy">) {
  return new Spliter(partOptions, onPart, opts);
}

export = createSpliter;
