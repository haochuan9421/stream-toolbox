const StreamSearch = require("streamsearch");
const FastStreamSearch = require("@stream-toolbox/search");

function buildHaystack(size) {
  const chunks = [];
  while (size > 0) {
    const chunk = Buffer.allocUnsafe(Math.min(size, 65536));
    size -= 65536;
    for (let i = 0; i < chunk.length; i++) {
      chunk[i] = Math.floor(Math.random() * 128);
    }
    chunks.push(chunk);
  }
  return chunks;
}

function buildNeedle(size) {
  const needle = Buffer.allocUnsafe(size);
  for (let i = 0; i < needle.length; i++) {
    needle[i] = 128 + Math.floor(Math.random() * 128);
  }
  return needle;
}

function benchmark(haystack, needle) {
  console.log(`----------------------------`);
  console.log(`needle.length: ${needle.length}`);

  console.time(`streamsearch`);
  const ss = new StreamSearch(needle, (isMatch) => {
    if (isMatch) {
      console.timeEnd(`streamsearch`);
    }
  });
  for (let i = 0; i < haystack.length; i++) {
    ss.push(haystack[i]);
  }
  ss.push(needle);

  console.time(`@stream-toolbox/search`);
  const fss = new FastStreamSearch(needle, (isMatch) => {
    if (isMatch) {
      console.timeEnd(`@stream-toolbox/search`);
    }
  });
  for (let i = 0; i < haystack.length; i++) {
    fss.push(haystack[i]);
  }
  fss.push(needle);
}

console.time("build_haystack");
const haystack = buildHaystack(500 * 2 ** 20); // 500MB
console.timeEnd("build_haystack");

benchmark(haystack, buildNeedle(1));
benchmark(haystack, buildNeedle(2));
benchmark(haystack, buildNeedle(4));
benchmark(haystack, buildNeedle(8));
benchmark(haystack, buildNeedle(16));
benchmark(haystack, buildNeedle(32));
benchmark(haystack, buildNeedle(64));
benchmark(haystack, buildNeedle(128));
benchmark(haystack, buildNeedle(256));
benchmark(haystack, buildNeedle(512));
benchmark(haystack, buildNeedle(1024));
benchmark(haystack, buildNeedle(2048));
benchmark(haystack, buildNeedle(4096));
benchmark(haystack, buildNeedle(8192));
