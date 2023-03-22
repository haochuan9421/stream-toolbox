import { Transform, TransformCallback } from "stream";
import StreamSearch = require("@stream-toolbox/search");

class StreamReplace extends Transform {
  private searcher: StreamSearch;

  constructor(find: string | Buffer, replace: string | Buffer, limit?: number) {
    super();
    if (typeof find === "string") {
      find = Buffer.from(find, "utf-8");
    }
    if (typeof replace === "string") {
      replace = Buffer.from(replace, "utf-8");
    }
    this.searcher = new StreamSearch({ needle: find, limit, abandon: false }, (isMatch, chunk) => {
      if (isMatch) {
        this.push(replace);
      }
      if (chunk.length) {
        this.push(chunk);
      }
    });
  }
  // Writable 一侧有代消费数据且 Readable 一侧的内部缓冲区未满时，_transform 才会触发
  _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback): void {
    this.searcher.push(chunk);
    callback(null);
  }
  // Writable 一侧的数据已全部交由 _transform 处理完毕, Readable 一侧的 'end' 事件还没触发时
  _flush(callback: TransformCallback): void {
    this.searcher.flush();
    callback(null);
  }
}

export = function createReplace(find: string | Buffer, replace: string | Buffer, limit?: number) {
  return new StreamReplace(find, replace, limit);
};
