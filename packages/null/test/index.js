const createZero = require("@stream-toolbox/zero");
const createNull = require("@stream-toolbox/null");
const { deepEqual } = require("assert");

const $GB = 2 ** 30;

function noSpeedLimit(cb) {
  const start = Date.now();
  const readable = createZero(10 * $GB);
  const writable = createNull(); // 实测不限速时的吞吐量大概在 10GB/s
  readable.pipe(writable).on("finish", () => {
    deepEqual(Date.now() - start < 3000, true); // 测试时保守一点，如果吞下 10GB 数据耗时在 3 秒以内就算正常。
    cb && cb();
  });
}

function hasSpeedLimit(cb) {
  {
    const start = Date.now();
    const readable = createZero(10 * $GB);
    const writable = createNull(2 * $GB); // 限速 2GB/s
    readable.pipe(writable).on("finish", () => {
      deepEqual(Date.now() - start < 6000 && Date.now() - start > 4000, true); // 耗时如果被控制在 4~6 秒之内算正常
      cb && cb();
    });
  }
}

noSpeedLimit(hasSpeedLimit);
