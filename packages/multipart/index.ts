import { Readable } from "stream";
import StreamSearch = require("@stream-toolbox/search");
import { IncomingMessage } from "http";

class PartFile extends Readable {
  size: number = 0;
}

type fieldMeta = {
  name: string;
  mimeType?: string;
  encoding?: string;
};

type fileMeta = fieldMeta & { filename: string };

type opts = {
  // 可指定 boundary，默认自动从 rs.headers['content-type'] 中解析
  boundary?: string;
  // 请求体的解析过程出错时，是否自动调用 rs.destroy()，默认是 false
  autoDestroy?: boolean;
  // 各种限制相关的参数，超出限制后会报错并停止解析
  limits?: {
    // 普通区块的数量，默认最多 256 个
    fields?: number;
    // 一个普通区块的值的字节数，默认最多 64KB（读取普通区块的值时，数据会暂存在内存里，所以需要限制，否则可能导致内存泄露，数据库中一个字段所占的空间一般也不会超过这个值，比如 MySQL 的 text 类型的字段，也就只占 65535 个字节，所以不需要给太大的空间）
    fieldSize?: number;
    // 文件区块的数量，默认最多 256 个
    files?: number;
    // 一个文件的字节数，默认不限制（读取文件内容时，是以流的方式进行的，数据不会被暂存在内存里，所以没太大必要限制）
    fileSize?: number;
    // 一个区块中头部的个数，默认最多 3 个，因为每个区块的头部一般也就只有 Content-Disposition, Content-Type 和 Content-Transfer-Encoding
    partHeaders?: number;
    // 一个头部的字节数，默认最多 1 KB（读取头部时，数据会暂存在内存中，所以需要限制，否则可能导致内存泄露）
    partHeaderSize?: number;
    // 请求体的总字节数，默认不限制
    totalSize?: number;
  };
  // 当解析到普通区块时触发，如果未提供 onField 函数，区块内容会被转成 utf-8 字符串
  // 1. data 参数是区块的内容，可以自定义转化
  // 2. meta 参数是区块的一些基本信息，比如: name (区块的名称，即 form 表单项中的 name 属性值), encoding (区块头部 Content-Transfer-Encoding 的值)
  // 3. cb   参数是回调函数，如果自行转化的过程中发生了错误，需要回调错误信息，以通知 multipart 结束整个请求体的解析，如果没有发生错误，回调的第一个参数是 null，第二个参数是转化结果，转化结果会放入 multipart 函数的返回值
  // 4. onField 函数也可以不使用 cb 参数回调结果，而是通过返回一个 Promise 来告知结果
  onField?: (data: Buffer, meta: fieldMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
  // 当解析到文件区块时触发，如果未提供 onFile 函数，区块内容会被忽略
  // 1. file 参数是区块所含文件的可读流，可以将该可读流 pipe 到本地磁盘或其他存储位置，这个可读流必须被耗尽，否则整个请求的解析过程可能会卡住
  // 2. meta 参数是区块的一些基本信息，比如: filename (原始文件名), mimeType (文件的 mime 类型)
  // 3. cb   参数是回调函数，如果转存的过程中发生了错误，需要回调错误信息，以通知 multipart 结束整个请求体的解析，如果没有发生错误，回调的第一个参数是 null，第二个参数是转存结果，转存结果会放入 multipart 函数的返回值
  // 4. onFile 函数也可以不使用 cb 参数回调结果，而是通过返回一个 Promise 来告知结果
  onFile?: (file: PartFile, meta: fileMeta, cb: (err: null | Error, data?: any) => void) => void | Promise<any>;
  // 返回值的格式，默认值 "common"
  resultFormat?: "array" | "common";
};

type arrayResult = { [key: string]: any[] };
type commonResult = { [key: string]: any };

enum STATES {
  UNSTART,
  PART_HEADER,
  PART_BODY,
  POST_BOUNDARY,
  END,
}

const fromV16 = parseInt(process.version.replace(/^v/, "")) >= 16;

function multipart(rs: Readable, opts?: opts & { resultFormat?: "array" }): Promise<arrayResult>;
function multipart(rs: Readable, opts?: opts & { resultFormat?: "common" }): Promise<commonResult>;
function multipart(rs: Readable, opts?: opts): Promise<arrayResult | commonResult> {
  if (!(rs instanceof Readable)) {
    throw new Error(`Expected readable stream, got ${typeof rs}`);
  }

  const boundaryText = opts?.boundary ?? (rs as IncomingMessage).headers?.["content-type"]?.replace(/^multipart\/form-data;\s?boundary=/, "");
  if (!boundaryText?.length) {
    throw new Error("Empty boundary");
  }
  const boundary = Buffer.from(`\r\n--${boundaryText}`);
  const CRLF = Buffer.from("\r\n");

  const onField = opts?.onField;
  const onFile = opts?.onFile;

  const MAX_FIELDS = opts?.limits?.fields ?? 256;
  const MAX_FIELD_SIZE = opts?.limits?.fieldSize ?? 65536;
  const MAX_FILES = opts?.limits?.files ?? 256;
  const MAX_FILE_SIZE = opts?.limits?.fileSize ?? Infinity;
  const MAX_PART_HEADERS = opts?.limits?.partHeaders ?? 3;
  const MAX_PART_HEADER_SIZE = opts?.limits?.partHeaderSize ?? 1024;
  const MAX_TOTAL_SIZE = opts?.limits?.totalSize ?? Infinity;

  return new Promise<[string, any][]>((_resolve, _reject) => {
    let settled = false;
    let state = STATES.UNSTART;
    let tmpChunks: Buffer[] = [];
    let misMatchSize = 0;
    let fields = 0;
    let files = 0;
    let partHeaders = 0;
    let totalSize = 0;
    let meta: fieldMeta | fileMeta;
    let file: null | PartFile;
    const parts: Promise<[string, any]>[] = [];

    const searcher = new StreamSearch(boundary, (isMatch, chunk) => {
      if (state === STATES.END) {
        return reject(new Error("multipart/form-data has ended"));
      }
      if (isMatch) {
        switch (state) {
          case STATES.UNSTART:
            state = STATES.POST_BOUNDARY;
            searcher.resetNeedle(CRLF);
            break;
          case STATES.PART_HEADER:
            if (misMatchSize) {
              // CRLF 前有内容，说明找到了一个头部
              if (++partHeaders > MAX_PART_HEADERS) {
                return reject(new Error("Header count exceeded the limit"));
              }
              const header = Buffer.concat(tmpChunks).toString("utf-8");
              tmpChunks = [];
              misMatchSize = 0;
              const colonIdx = header.indexOf(":");
              if (colonIdx < 1) {
                return;
              }
              const hName = header.substring(0, colonIdx).toLowerCase();
              const hValue = header.substring(colonIdx + 1).trim();
              switch (hName) {
                case "content-disposition":
                  const pairs = hValue.split(";");
                  for (let i = 1; i < pairs.length; i++) {
                    const [key, value] = pairs[i].trim().split("=");
                    if ((key === "name" || key === "filename") && value !== undefined) {
                      (meta as any)[key] = value.replace(/^"|"$/g, "");
                    }
                  }
                  break;
                case "content-type":
                  meta.mimeType = hValue;
                  break;
                case "content-transfer-encoding":
                  meta.encoding = hValue;
                  break;
              }
            } else {
              // CRLF 前没内容，说明遇到了空行，此时区块头部的解析已结束，可以开始准备解析区块实体了
              if (!meta.name) {
                return reject(new Error("Part missing name"));
              }
              if (meta.hasOwnProperty("filename")) {
                // 文件区块
                if (++files > MAX_FILES) {
                  return reject(new Error("File part count exceeded the limit"));
                }
                const name = meta.name;
                if (onFile && (meta as fileMeta).filename) {
                  file = new PartFile({
                    read() {
                      if (rs.isPaused()) {
                        rs.resume();
                      }
                    },
                  });
                  parts.push(
                    new Promise<any>((success) => {
                      onFile(file!, meta as fileMeta, (err, data) => {
                        err ? reject(err) : success([name, data]);
                      })?.then((data) => {
                        success([name, data]);
                      }, reject);
                    })
                  );
                } else {
                  parts.push(Promise.resolve([name, undefined]));
                }
              } else {
                // 普通区块
                if (++fields > MAX_FIELDS) {
                  return reject(new Error("Field part count exceeded the limit"));
                }
              }
              partHeaders = 0;
              searcher.resetNeedle(boundary);
              state = STATES.PART_BODY;
            }
            break;
          case STATES.PART_BODY:
            if (meta.hasOwnProperty("filename")) {
              // 文件区块
              if (file) {
                file.size = misMatchSize;
                file.push(null); // 结束文件可读流
                file = null;
              }
            } else {
              // 普通区块
              const name = meta.name;
              if (onField) {
                parts.push(
                  new Promise<any>((success) => {
                    onField(Buffer.concat(tmpChunks), meta as fieldMeta, (err, data) => {
                      err ? reject(err) : success([name, data]);
                    })?.then((data) => {
                      success([name, data]);
                    }, reject);
                  })
                );
              } else {
                parts.push(Promise.resolve([name, Buffer.concat(tmpChunks).toString("utf-8")]));
              }
            }
            tmpChunks = [];
            misMatchSize = 0;
            searcher.resetNeedle(CRLF);
            state = STATES.POST_BOUNDARY;
            break;
          case STATES.POST_BOUNDARY:
            if (misMatchSize === 0) {
              meta = { name: "" };
              state = STATES.PART_HEADER;
            } else if (Buffer.concat(tmpChunks).equals(Buffer.from("--"))) {
              state = STATES.END;
              Promise.all(parts).then(resolve);
            } else {
              reject(new Error("Invalid data after boundary"));
            }
            break;
        }
      } else {
        misMatchSize += chunk.length;
        switch (state) {
          case STATES.UNSTART:
            if (misMatchSize > 0) {
              // 起始位置前面只会是空的
              return reject(new Error("Readable stream should be start with boundary"));
            }
            break;
          case STATES.PART_HEADER:
            if (misMatchSize > MAX_PART_HEADER_SIZE) {
              return reject(new Error("Header size exceeded the limit"));
            }
            tmpChunks.push(chunk);
            break;
          case STATES.PART_BODY:
            if (meta.hasOwnProperty("filename")) {
              // 文件区块
              if (misMatchSize > MAX_FILE_SIZE) {
                return reject(new Error("File size exceeded the limit"));
              }
              if (file) {
                // push 的返回值是 true 代表 file 还可以 push 新的内容进去，我们就没必要停止读取 rs，反之就需要暂停了，不然会导致数据积压在内存里
                if (!file.push(chunk) && !rs.isPaused()) {
                  rs.pause();
                }
              }
            } else {
              // 普通区块
              if (misMatchSize > MAX_FIELD_SIZE) {
                return reject(new Error("Field size exceeded the limit"));
              }
              tmpChunks.push(chunk);
            }
            break;
          case STATES.POST_BOUNDARY:
            if (misMatchSize > 2) {
              // boundary 后面要不就是紧跟着 "--\r\n" 表示结束，要不就是紧跟着 "\r\n" 表示后面还有其他 PART
              return reject(new Error("Invalid data after boundary"));
            }
            tmpChunks.push(chunk);
            break;
        }
      }
    });

    searcher.push(Buffer.from("\r\n"));

    function onData(chunk: Buffer) {
      if (settled) {
        return;
      }
      totalSize += chunk.length;
      if (totalSize > MAX_TOTAL_SIZE) {
        return reject(new Error("Total size exceeded the limit"));
      }
      searcher.push(chunk);
    }
    const onEnd = (() => {
      let called = false;
      return () => {
        if (called) {
          return;
        }
        called = true;
        searcher.flush();
        if (file) {
          file.emit("error", new Error("Request socket closed"));
        }
        if (state !== STATES.END) {
          reject(new Error("Incomplete multipart/form-data"));
        }
      };
    })();
    function cleanUp() {
      settled = true;
      rs.removeListener("data", onData);
      rs.removeListener("error", reject);
      rs.removeListener("end", onEnd);
      if (fromV16) {
        rs.removeListener("close", onEnd);
      } else {
        rs.removeListener("aborted", onEnd);
      }
    }
    function resolve(data: [string, any][]) {
      if (settled) {
        return;
      }
      cleanUp();
      _resolve(data);
    }
    function reject(err: any) {
      if (settled) {
        return;
      }
      cleanUp();
      if (file && !file.destroyed) {
        file.destroy(err);
      }
      if (opts?.autoDestroy && !rs.destroyed) {
        rs.destroy(err);
      }
      _reject(err);
    }
    rs.on("data", onData);
    rs.on("error", reject);
    rs.on("end", onEnd); // 只会在请求结束时触发，如果请求被取消了，这个事件不会触发
    if (fromV16) {
      rs.on("close", onEnd); // 从 Node.js v16 开始，这个事件会在请求完成时触发，无论请求是成功还是被取消（v16之前是在底层的 socket 关闭时触发，keep-alive 会在多个请求间复用 socket）
    } else {
      rs.on("aborted", onEnd); // 请求被取消时触发，但是从 v17.0.0, v16.12.0 开始被废弃了
    }
  }).then((parts) => {
    const arrayResult: arrayResult = {};
    for (let i = 0; i < parts.length; i++) {
      const [name, value] = parts[i];
      if (Object.hasOwnProperty.call(arrayResult, name)) {
        arrayResult[name].push(value);
      } else {
        arrayResult[name] = [value];
      }
    }

    if (opts?.resultFormat === "array") {
      return arrayResult;
    }

    const commonResult: commonResult = {};
    for (const name in arrayResult) {
      const value = arrayResult[name];
      commonResult[name] = value.length === 1 ? value[0] : value;
    }
    return commonResult;
  });
}

export = multipart;
