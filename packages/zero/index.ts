import { Readable } from "stream";

function createZero(total: number, fill?: number | [number, number]) {
  if (total === undefined) {
    total = Infinity;
  }

  return new Readable({
    read(size) {
      if (total <= 0) {
        this.push(null);
        return;
      }
      const len = Math.min(size, total);
      total -= len;
      if (typeof fill === "undefined") {
        this.push(Buffer.allocUnsafe(len));
      } else if (typeof fill === "number") {
        // 每一个字节的值都是 fill
        this.push(Buffer.alloc(len, fill));
      } else if (Array.isArray(fill)) {
        // 每一个字节的值都是 [min, max] 之间的随机数
        const chunk = Buffer.allocUnsafe(len);
        const [min, max] = fill;
        const range = max - min + 1;
        for (let i = 0; i < len; i++) {
          chunk[i] = Math.floor(Math.random() * range) + min;
        }
        this.push(chunk);
      }
    },
  });
}

export = createZero;
