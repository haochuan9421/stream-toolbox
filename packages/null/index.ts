import { Writable } from "stream";

class LimitWritable extends Writable {
  private bytesPerSecond: number;
  private roundStart: number;
  private roundSpace: number;

  constructor(bytesPerSecond: number) {
    super();
    this.bytesPerSecond = bytesPerSecond;
    this.newRound();
  }
  newRound() {
    this.roundStart = process.uptime();
    this.roundSpace = this.bytesPerSecond;
  }
  process(len: number, callback: Function) {
    const roundUptime = process.uptime() - this.roundStart;

    // 如果距离当前轮的开始时间已经过去 1 秒了，则开启新的一轮
    if (roundUptime > 1) {
      this.newRound();
    }

    if (this.roundSpace > len) {
      // 如果当前轮还有可用空间，则立刻回调，回调后才会有新的数据进来
      this.roundSpace -= len;
      callback();
    } else {
      // 如果当前轮接受的数据量已达到上限，这 1 秒内就不再处理数据了，暂时不要回调，等这一轮结束了，在下一轮处理剩余的数据，直到数据消耗完毕再释放 _write 的回调
      setTimeout(() => {
        const remain = len - this.roundSpace;
        this.newRound();
        this.process(remain, callback);
      }, (1 - roundUptime) * 1000);
    }
  }
  _write(chunk: Buffer, encoding: string, callback: Function) {
    this.process(chunk.length, callback);
  }
}

// bytesPerSecond 用于限流，表示每秒最多吞噬多少字节的数据
function createNull(bytesPerSecond?: number) {
  if (typeof bytesPerSecond === "number" && bytesPerSecond > 0) {
    return new LimitWritable(Math.floor(bytesPerSecond));
  }

  return new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
}

export = createNull;
