import { Readable } from "stream";

function join(sources: (Buffer | string | Readable)[], separator?: Buffer | string) {
  if (typeof separator === "string") {
    separator = Buffer.from(separator, "utf-8");
  }

  let kickoff = false;
  let part: Readable | null = null;

  const readable = new Readable({
    read() {
      if (!kickoff) {
        kickoff = true;
        next(false);
      } else if (part && part.isPaused()) {
        part.resume();
      }
    },
  });

  function next(addSeparator: boolean) {
    const ele = sources.shift();

    if (typeof ele === "undefined") {
      readable.push(null);
      return;
    }

    if (addSeparator && separator && separator.length) {
      readable.push(separator);
    }

    if (typeof ele === "string") {
      readable.push(Buffer.from(ele, "utf-8"));
      next(true);
    } else if (Buffer.isBuffer(ele)) {
      readable.push(ele);
      next(true);
    } else {
      part = ele
        .on("data", (chunk) => {
          if (!readable.push(chunk)) {
            ele.pause();
          }
        })
        .once("error", (error) => {
          readable.destroy(error);
        })
        .once("end", () => {
          part = null;
          next(true);
        });
    }
  }

  return readable;
}

export = join;
