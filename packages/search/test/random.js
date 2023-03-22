const { deepEqual } = require("assert");
const StreamSearch = require("@stream-toolbox/search");

// 生成一个随机的 needle 和 haystack，检测一下 StreamSearch 是否可以正确搜索到 needle 在 haystack 中出现的次数
function randomTest() {
  let added = 0;

  const needle = Buffer.allocUnsafe(32); // 生成 32 长度的 needle
  for (let i = 0; i < needle.length; i++) {
    needle[i] = Math.floor(Math.random() * 128);
  }

  const haystack = Buffer.allocUnsafe(65536); // 生成 65535 长度的 haystack
  for (let i = 0; i < haystack.length; i += 32) {
    if (Math.random() < 0.1) {
      // 随机把 needle 添加到 haystack 中
      added++;
      haystack.set(needle, i);
    } else {
      const chunk = Buffer.allocUnsafe(32);
      for (let i = 0; i < chunk.length; i++) {
        chunk[i] = 128 + Math.floor(Math.random() * 128);
      }
      haystack.set(chunk, i);
    }
  }

  const searcher = new StreamSearch(needle, () => {});
  searcher.push(haystack);
  deepEqual(added, searcher.matched); // 添加的次数应该和匹配成功的次数一样
}

for (let i = 0; i < 100; i++) {
  randomTest();
}
