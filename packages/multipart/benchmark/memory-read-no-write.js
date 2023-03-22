const stream = require("stream");

const busboy = require("busboy");
const formidable = require("formidable");
const multipart = require("@stream-toolbox/multipart");

function buildMultipart(boundary) {
  const bufs = [];
  for (let i = 0; i < 30; i++) {
    bufs.push(
      Buffer.from(
        [
          `--${boundary}`,
          `content-disposition: form-data; name="field_${i}"`,
          "",
          "0".repeat(65536), // 64K
          "",
        ].join("\r\n")
      )
    );
  }
  for (let j = 0; j < 30; j++) {
    bufs.push(
      Buffer.from(
        [
          `--${boundary}`,
          `content-disposition: form-data; name="file_${j}"; filename="file_${j}.txt"`,
          "content-type: text/plain",
          "",
          "0".repeat(67108864), // 64M
          "",
        ].join("\r\n")
      )
    );
  }
  bufs.push(Buffer.from(`--${boundary}--\r\n`));
  return bufs;
}

function buffersToReadable(bufs) {
  let i = 0;
  let flowing = true;
  const rs = new stream.Readable({
    read() {
      flowing = true;
      read();
    },
  });
  function read() {
    if (!flowing) {
      return;
    }
    if (i < bufs.length) {
      flowing = rs.push(bufs[i++]);
      read();
    } else {
      rs.push(null);
    }
  }
  return rs;
}

function runBusboy(req) {
  return new Promise((done) => {
    const parser = busboy({ headers: req.headers });
    parser.on("file", (name, file, meta) => {
      file.on("data", () => {});
    });
    parser.on("close", () => {
      done();
    });
    req.pipe(parser);
  });
}

function runFormidable(req) {
  return new Promise((done) => {
    const form = formidable({
      multiples: true,
      maxFileSize: Infinity,
      fileWriteStreamHandler() {
        return new stream.Writable({
          write(chunk, encoding, cb) {
            cb(null);
          },
        });
      },
    });
    form.parse(req, (err, fields, files) => {
      done();
    });
  });
}

function runMultipart(req) {
  return new Promise((done) => {
    multipart(req, {
      onFile(file, meta, cb) {
        file.on("data", () => {}).on("end", () => cb(null));
      },
    }).finally(done);
  });
}

function randomString(len) {
  let charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += charset[Math.floor(Math.random() * charset.length)];
  }
  return str;
}

function measure(name) {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();
  return () => {
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    console.log(
      name,
      `${endTime - startTime}ms`,
      Object.keys(endMemory).reduce((res, key) => {
        res[key] = `${((endMemory[key] - startMemory[key]) / 1048576).toFixed(2)}MB`; // Byte to MB
        return res;
      }, {})
    );
  };
}

(async () => {
  const boundary = `----WebKitFormBoundary${randomString(16)}`;
  const bufs = buildMultipart(boundary);
  const totalSize = bufs.reduce((total, buf) => total + buf.length, 0);
  const headers = {
    "content-type": `multipart/form-data; boundary=${boundary}`,
    "content-length": totalSize,
  };

  console.log(`Content-Length: ${(totalSize / 2 ** 30).toFixed(2)}GB`);

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = buffersToReadable(bufs);
    req.headers = headers;
    const log = measure("busboy");
    await runBusboy(req);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = buffersToReadable(bufs);
    req.headers = headers;
    const log = measure("formidable");
    await runFormidable(req);
    log();
  }

  {
    await new Promise((r) => setTimeout(r, 1000));
    const req = buffersToReadable(bufs);
    req.headers = headers;
    const log = measure("@stream-toolbox/multipart");
    await runMultipart(req);
    log();
  }
})();
