import http from "http";
import multipart from "@stream-toolbox/multipart";
import fetch, { FormData, File } from "node-fetch";
import { deepEqual } from "assert";

const server = http
  .createServer((req, res) => {
    multipart(req, {
      onField(data, meta, cb) {
        cb(null, `prefix_${data}_suffix`);
      },
      onFile(file, meta, cb) {
        file
          .on("data", (chunk) => {
            console.log(`${chunk}`);
          })
          .on("end", () => {
            cb(null, meta.filename);
          });
      },
    })
      .then((result) => {
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify(result, null, 2));
      })
      .catch((err) => {
        console.log("multipart parse error", err);
      });
  })
  .listen(9000, async () => {
    console.log("open http://127.0.0.1:9000");

    const formData = new FormData();

    formData.append("username", "haochuan9421");
    formData.append("interest", "coding");
    formData.append("interest", "music");
    formData.append("doc", new File([new Uint8Array([97, 98, 99])], "abc.txt", { type: "text/plain" }));
    formData.append("doc", new File([new Uint8Array([100, 101, 102])], "def.txt", { type: "text/plain" }));

    const response = await fetch("http://127.0.0.1:9000/submit", { method: "POST", body: formData });
    const data = await response.json();

    deepEqual(data, {
      username: "prefix_haochuan9421_suffix",
      interest: ["prefix_coding_suffix", "prefix_music_suffix"],
      doc: ["abc.txt", "def.txt"],
    });

    server.close();
  });
