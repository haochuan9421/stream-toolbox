const createReplace = require("@stream-toolbox/replace");

const replacer = createReplace("foo", "bar");
const start = Date.now();

replacer
  .on("data", () => {})
  .on("end", () => {
    console.log(Date.now() - start);
  });

// 总的有 5GB 数据
for (let i = 0; i < 65536 * 5; i++) {
  replacer.write(Buffer.allocUnsafe(16384));
}
replacer.end();
