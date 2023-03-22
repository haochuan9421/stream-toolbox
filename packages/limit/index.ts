import { Transform } from "stream";

class Limit extends Transform {
  private bytesPerSecond: number;
  private roundStart: number;
  private roundSpace: number;

  constructor(bytesPerSecond: number) {
    super({ allowHalfOpen: false, objectMode: false });
    this.bytesPerSecond = bytesPerSecond;
    this.newRound();
  }
  newRound() {
    this.roundStart = process.uptime();
    this.roundSpace = this.bytesPerSecond;
  }
  process(chunk: Buffer, callback: Function) {
    const roundUptime = process.uptime() - this.roundStart;

    // 如果距离当前轮的开始时间已经过去 1 秒了，则开启新的一轮
    if (roundUptime > 1) {
      this.newRound();
    }

    if (this.roundSpace > chunk.length) {
      // 如果当前轮还有可用空间，则立刻回调，回调后才会有新的数据进来
      if (chunk.length) {
        this.roundSpace -= chunk.length;
        this.push(chunk);
      }
      callback();
    } else {
      // 如果当前轮接受的数据量已达到上限，这 1 秒内就不再处理数据了，暂时不要回调，等这一轮结束了，在下一轮处理剩余的数据，直到数据消耗完毕再释放 _write 的回调
      setTimeout(() => {
        this.push(chunk.subarray(0, this.roundSpace));
        const remain = chunk.subarray(this.roundSpace);
        this.newRound();
        this.process(remain, callback);
      }, (1 - roundUptime) * 1000);
    }
  }
  _transform(chunk: Buffer, encoding: string, callback: Function) {
    this.process(chunk, callback);
  }
}

export = function createLimit(bytesPerSecond: number) {
  return new Limit(bytesPerSecond);
};
