const join = require("@stream-toolbox/join");
const createSpliter = require("@stream-toolbox/split");
const { deepEqual } = require("assert");

// 至少划分出一个子可读流
{
  const result = [];
  join([])
    .pipe(
      createSpliter("foo", (part, next) => {
        result.push(part.index);
        const chunks = [];
        part
          .on("data", (chunk) => {
            chunks.push(chunk);
          })
          .on("end", () => {
            result.push(Buffer.concat(chunks).toString("utf-8"));
            next(null);
          });
      })
    )
    .on("finish", () => {
      result.push(`finish`);
      deepEqual(result, [0, "", "finish"]);
    });
}

// 能按照给定的字节划分可读流
{
  const result = [];
  join(["foo", "bar", "baz"], "|")
    .pipe(
      createSpliter("|", (part, next) => {
        result.push(part.index);
        const chunks = [];
        part
          .on("data", (chunk) => {
            chunks.push(chunk);
          })
          .on("end", () => {
            result.push(Buffer.concat(chunks).toString("utf-8"));
            next(null);
          });
      })
    )
    .on("finish", () => {
      result.push(`finish`);
      deepEqual(result, [0, "foo", 1, "bar", 2, "baz", "finish"]);
    });
}

// 能按照大小划分可读流
{
  const result = [];
  join(["foo", "bar", "baz"])
    .pipe(
      createSpliter(3, (part, next) => {
        result.push(part.index);
        const chunks = [];
        part
          .on("data", (chunk) => {
            chunks.push(chunk);
          })
          .on("end", () => {
            result.push(Buffer.concat(chunks).toString("utf-8"));
            next(null);
          });
      })
    )
    .on("finish", () => {
      result.push(`finish`);
      deepEqual(result, [0, "foo", 1, "bar", 2, "baz", "finish"]);
    });
}

// 两种方式可以切换
{
  const result = [];
  join(["foo", "bar", "baz"])
    .pipe(
      createSpliter(3, (part, next) => {
        result.push(part.index);
        const chunks = [];
        part
          .on("data", (chunk) => {
            chunks.push(chunk);
          })
          .on("end", () => {
            result.push(Buffer.concat(chunks).toString("utf-8"));
            if (part.index === 0) {
              next(null, Infinity);
            } else {
              next(null);
            }
          });
      })
    )
    .on("finish", () => {
      result.push(`finish`);
      deepEqual(result, [0, "foo", 1, "barbaz", "finish"]);
    });
}

// 支持 async function
{
  const result = [];
  join(["foo", "bar", "baz"])
    .pipe(
      createSpliter(3, (part) => {
        return new Promise((ok) => {
          result.push(part.index);
          const chunks = [];
          part
            .on("data", (chunk) => {
              chunks.push(chunk);
            })
            .on("end", () => {
              result.push(Buffer.concat(chunks).toString("utf-8"));
              if (part.index === 0) {
                ok(Infinity);
              } else {
                ok();
              }
            });
        });
      })
    )
    .on("finish", () => {
      result.push(`finish`);
      deepEqual(result, [0, "foo", 1, "barbaz", "finish"]);
    });
}
