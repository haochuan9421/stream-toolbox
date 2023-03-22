const createZero = require("@stream-toolbox/zero");
const createNull = require("@stream-toolbox/null");
const createLimit = require("@stream-toolbox/limit");
const { deepEqual } = require("assert");

const $GB = 2 ** 30;

const start = Date.now();
const readable = createZero(10 * $GB);
const duplex = createLimit(2 * $GB);
const writable = createNull();

readable
  .pipe(duplex)
  .pipe(writable)
  .on("finish", () => {
    deepEqual(Date.now() - start < 6000 && Date.now() - start > 4000, true); // 耗时如果被控制在 4~6 秒之内算正常
  });
