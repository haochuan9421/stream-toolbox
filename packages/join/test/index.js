const join = require("@stream-toolbox/join");
const createZero = require("@stream-toolbox/zero");
const { equal } = require("assert");

const chunks = [];

join(["foo", createZero(1024, 97), Buffer.from("bar"), createZero(1024, 98), "baz"], "|")
  .on("data", (chunk) => {
    chunks.push(chunk);
  })
  .on("end", () => {
    const all = Buffer.concat(chunks);
    const expected = Buffer.from(`foo|${"a".repeat(1024)}|bar|${"b".repeat(1024)}|baz`);
    equal(all.equals(expected), true);
  });
