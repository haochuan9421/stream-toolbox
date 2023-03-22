const { deepEqual } = require("assert");
const StreamSearch = require("@stream-toolbox/search");

// 把 README 中的 DEMO 都跑一遍

{
  const result = [];
  const StreamSearch = require("@stream-toolbox/search");

  const searcher = new StreamSearch("\r\n", (...args) => result.push(args));

  searcher.push("foo");
  // false 'foo'
  deepEqual(result, [[false, Buffer.from("foo")]]);
  searcher.push(" bar");
  // false ' bar'
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
  ]);
  searcher.push("\r");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
  ]);
  searcher.push("\n");
  // true ''
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
    [true, Buffer.from("")],
  ]);
  searcher.push("baz, hello\r");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
    [true, Buffer.from("")],
  ]);
  searcher.push("\n world.");
  // false 'baz, hello'
  // true ''
  // false ' world.'
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
    [true, Buffer.from("")],
    [false, Buffer.from("baz, hello")],
    [true, Buffer.from("")],
    [false, Buffer.from(" world.")],
  ]);
  searcher.push("\r\n Node.JS rules!!\r\n\r\n");
  // true ''
  // false ' Node.JS rules!!'
  // true ''
  // true ''
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [false, Buffer.from(" bar")],
    [true, Buffer.from("")],
    [false, Buffer.from("baz, hello")],
    [true, Buffer.from("")],
    [false, Buffer.from(" world.")],
    [true, Buffer.from("")],
    [false, Buffer.from(" Node.JS rules!!")],
    [true, Buffer.from("")],
    [true, Buffer.from("")],
  ]);
}

{
  const result = [];
  const searcher = new StreamSearch({ needle: "_bar_", limit: 1, abandon: false }, (...args) => result.push(args));

  searcher.push("foo_bar_baz");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [true, Buffer.from("baz")],
  ]);
  searcher.push("foo_bar_baz");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [true, Buffer.from("baz")],
    [false, Buffer.from("foo_bar_baz")],
  ]);
}

{
  const result = [];
  const searcher = new StreamSearch({ needle: "_bar_", limit: 1, abandon: true }, (...args) => result.push(args));

  searcher.push("foo_bar_baz");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [true, Buffer.from("")],
  ]);
  searcher.push("foo_bar_baz");
  deepEqual(result, [
    [false, Buffer.from("foo")],
    [true, Buffer.from("")],
  ]);
}

{
  const result = [];
  const searcher = new StreamSearch("foo", (...args) => result.push(args));

  searcher.push("bar");
  deepEqual(result, [[false, Buffer.from("bar")]]);
  deepEqual(searcher.lookback, []);
}

{
  const result = [];
  const searcher = new StreamSearch("foo", (...args) => result.push(args));

  searcher.push("barfo");
  deepEqual(result, []);
  deepEqual(searcher.lookback, [Buffer.from("barfo")]);
}

{
  const result = [];
  const searcher = new StreamSearch("foo", (isMatch, data) => {
    if (isMatch && searcher.matched === 1) {
      searcher.resetNeedle("bar");
    }
    result.push([isMatch, data]);
  });

  searcher.push("foobar");

  deepEqual(result, [
    [true, Buffer.from("")],
    [true, Buffer.from("")],
  ]);
}
