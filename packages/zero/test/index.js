const createZero = require("@stream-toolbox/zero");
const { deepEqual } = require("assert");

{
  // 创建一个 1GB 大小的可读流
  const readable = createZero(2 ** 30); // 生成速度大概在 12GB/s
  let total = 0;
  readable
    .on("data", (chunk) => {
      total += chunk.length;
    })
    .on("end", () => {
      deepEqual(total, 2 ** 30);
    });
}

{
  // 每一个字节都是指定的数据
  const readable = createZero(2 ** 20, 97); // 生成速度大概在 6GB/s
  readable.on("data", (chunk) => {
    deepEqual(
      chunk.every((byte) => byte === 97),
      true
    );
  });
}

{
  // 每一个字节都是指定范围内的数据（a-z）
  const readable = createZero(2 ** 20, [97, 122]); // 生成速度大概在 100MB/s
  readable.on("data", (chunk) => {
    deepEqual(
      chunk.every((byte) => byte >= 97 && byte <= 122),
      true
    );
  });
}
