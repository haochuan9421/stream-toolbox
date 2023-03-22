import { Transform, TransformCallback } from "stream";
import { table } from "table";
import * as chalk from "chalk";

type opts = {
  interval?: number; // 采样间隔，单位秒，默认 1 秒
  stdout?: boolean; // 是否将采样结果输出到 stdout，默认 true
  onTick?: (writed: number, readed: number, usedTime: number) => {}; // 每轮采样结束时回调，writed 是已写入 monit 的数据总量，readed 是已从 monit 读取的数据总量，usedTime 是已耗时多少秒
  onClose?: (transferred: number, usedTime: number) => {}; // 传输结束时回调，transferred 表示已传输的数据总量，usedTime 是已耗时多少秒
};

class Monit extends Transform {
  constructor(opts?: opts) {
    super({ allowHalfOpen: false, objectMode: false, autoDestroy: true, highWaterMark: 16384 });

    const start = process.uptime();
    const interval = opts?.interval || 1;

    // 已传输了多少字节的数据
    let transferred = 0;
    this._transform = (chunk: any, encoding: BufferEncoding, callback: TransformCallback): void => {
      transferred += chunk.length;
      callback(null, chunk);
    };

    // 上次采样时的信息
    let lastWrited = 0;
    let lastReaded = 0;
    let isTTYDirty = false;
    const timer = setInterval(() => {
      // writableLength 和 readableLength 在 Node.js v9.4.0 之后才有
      const writed = transferred + this.writableLength; // writableLength 是可写流一侧缓冲区中的数据量
      const readed = transferred - this.readableLength; // readableLength 是可读流一侧缓冲区中的数据量

      const cached = writed - readed; // 缓冲区中的总数量
      const usedTime = process.uptime() - start;

      const writeSpeed = (writed - lastWrited) / interval;
      const readSpeed = (readed - lastReaded) / interval;
      lastWrited = writed;
      lastReaded = readed;

      if (opts?.stdout === false) {
        opts?.onTick?.(writed, readed, usedTime);
        return;
      }

      if (isTTYDirty) {
        // 将光标恢复到未输出表格时的位置
        process.stdout.write("\x1B[u");
      } else {
        isTTYDirty = true;
        // 保存未输出表格时的光标位置
        process.stdout.write("\x1B[s");
        // 隐藏光标
        process.stdout.write("\x1B[?25l");
        // 如果在传输结束前用户按下了 Ctrl + C，则恢复光标的显示
        process.once("SIGINT", this.onInterrupt);
      }
      // 输出表格到 TTY
      process.stdout.write(
        table(
          [
            ["", chalk.blue("transferred size"), chalk.cyan("current speed")],
            ["readable => monit", `${this.format(writed)} ${writed >= 1024 ? `(${writed})` : ""}`, `${this.format(writeSpeed)}/s`],
            ["monit => writable", `${this.format(readed)} ${readed >= 1024 ? `(${readed})` : ""}`, `${this.format(readSpeed)}/s`],
            [`⏳ ${chalk.magenta(Math.floor(usedTime))} second since start`, "", ""],
            [`${cached > 32768 ? "🟡" : "🟢"} internal buffer size: ${cached > 32768 ? chalk.yellow(this.format(cached)) : chalk.green(this.format(cached))}`, "", ""],
          ],
          {
            columns: [{ alignment: "center" }, { alignment: "center" }, { alignment: "center" }],
            spanningCells: [
              { row: 3, col: 0, colSpan: 3 },
              { row: 4, col: 0, colSpan: 3 },
            ],
          }
        ).replace(/\n/g, "\x1B[0K\n") // 如果上次输出的表格比这次的宽，则新表格无法完全覆盖旧表格，会导致每行的尾部有残留字符，使用 \x1B[0K 可以清除每行的尾部残留。
      );
    }, interval * 1000).unref();

    let showed = false;
    const showEndTable = (error: null | Error) => {
      if (showed) {
        return;
      }
      showed = true;

      clearInterval(timer);
      const usedTime = process.uptime() - start;

      if (opts?.stdout === false) {
        opts?.onClose?.(transferred, usedTime);

        return;
      }

      const averageSpeed = transferred / usedTime;
      // 将光标恢复到未输出表格时的位置
      process.stdout.write("\x1B[u");
      // 清除光标后面的全部内容
      process.stdout.write("\x1B[0J");
      // 输出表格到 TTY
      process.stdout.write(
        table(
          [
            [chalk.blue("transferred size"), chalk.magenta("used time"), chalk.cyan("average speed")],
            [`${this.format(transferred)} ${transferred >= 1024 ? `(${transferred})` : ""}`, `${Math.floor(usedTime * 1000) / 1000}s`, `${this.format(averageSpeed)}/s`],
            [error ? `🔴 transfer fail! ${error.message}` : `🟢 transfer success!`, "", ""],
          ],
          {
            columns: [{ alignment: "center" }, { alignment: "center" }, { alignment: "center" }],
            spanningCells: [{ row: 2, col: 0, colSpan: 3 }],
          }
        )
      );
      // 恢复光标的显示
      process.stdout.write("\x1B[?25h");
      process.removeListener("SIGINT", this.onInterrupt);
    };

    this._flush = (callback: TransformCallback): void => {
      showEndTable(null);
      callback(null);
    };
    // 如果正常结束，没有发生错误，在 v11.2.0, v10.16.0 之前 _destroy 是不会触发的，为了兼容加了 _flush
    this._destroy = (error: Error | null, callback: (error: Error | null) => void): void => {
      showEndTable(error);
      callback(error);
    };
  }
  private format(byte: number) {
    if (byte < 1024) {
      return `${byte} B`;
    }
    if (byte < 1048576) {
      return `${Math.round((byte / 1024) * 100) / 100} KB`;
    }
    if (byte < 1073741824) {
      return `${Math.round((byte / 1048576) * 100) / 100} MB`;
    }
    return `${Math.round((byte / 1073741824) * 100) / 100} GB`;
  }
  private onInterrupt(signal: string) {
    process.stdout.write("\x1B[?25h");
    process.kill(process.pid, signal);
  }
}

export = function createMonit(opts?: opts) {
  return new Monit(opts);
};
