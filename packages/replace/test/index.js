const join = require("@stream-toolbox/join");
const createReplace = require("@stream-toolbox/replace");
const { deepEqual } = require("assert");

{
  const readable = join(["foo", " bar", "\r", "\n", "baz, hello\r", "\n world.", "\r\n Node.JS rules!!\r\n\r\n"]);
  const replacer = createReplace("\r\n", "\n");

  let result = "";
  readable
    .pipe(replacer)
    .on("data", (chunk) => {
      result += chunk;
    })
    .on("end", () => {
      deepEqual(result, `foo bar\nbaz, hello\n world.\n Node.JS rules!!\n\n`);
    });
}

{
  const readable = join(["foo", " bar", "\r", "\n", "baz, hello\r", "\n world.", "\r\n Node.JS rules!!\r\n\r\n"]);
  const replacer = createReplace("\r\n", "\n", 3);

  let result = "";
  readable
    .pipe(replacer)
    .on("data", (chunk) => {
      result += chunk;
    })
    .on("end", () => {
      deepEqual(result, `foo bar\nbaz, hello\n world.\n Node.JS rules!!\r\n\r\n`);
    });
}
