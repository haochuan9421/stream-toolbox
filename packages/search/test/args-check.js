const { doesNotThrow, throws } = require("assert");
const StreamSearch = require("@stream-toolbox/search");

const noop = () => {};

throws(() => {
  new StreamSearch("foo"); // 缺少回调函数需要抛错
});

throws(() => {
  new StreamSearch(false, noop); // needle 类型既不是字符串也不是 Buffer 需要抛错
});

throws(() => {
  new StreamSearch({ needle: "" }, noop); // needle 为空需要抛错
});
throws(() => {
  new StreamSearch({ needle: "foo", limit: -1 }, noop); // limit 不是正整数需要抛错
});

doesNotThrow(() => {
  new StreamSearch("foo", noop);
  new StreamSearch(Buffer.from("foo"), noop);
  new StreamSearch({ needle: "foo" }, noop);
  new StreamSearch({ needle: Buffer.from("foo") }, noop); //
  new StreamSearch({ needle: Buffer.from("foo"), limit: 1 }, noop);
});
