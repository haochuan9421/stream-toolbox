import { mkdir, readdir, readFile } from "fs/promises";
import { resolve } from "path";
import { get } from "https";
import { platform, arch } from "os";
import { existsSync } from "fs";
import { pipeline } from "stream";
import { extract } from "tar";
import { spawnSync } from "child_process";
import { minVersion } from "semver";

// 下载最新版本的 Node.js
const latestRuntime = await downloadRuntime(await getLatestVersion());

// 遍历所有的子包并执行他们的测试用例
outer: for (const pkg of await readdir(resolve(`packages`), { withFileTypes: true })) {
  if (!pkg.isDirectory()) {
    continue; // 跳过 .DS_Store
  }
  // 下载当前子包所声明兼容的最低的 Node.js
  const pkgJson = JSON.parse(await readFile(resolve(`packages/${pkg.name}/package.json`), "utf-8"));
  const minRuntime = await downloadRuntime(`v${minVersion(pkgJson.engines.node)}`);

  for (const runtime of [minRuntime, latestRuntime]) {
    const testDir = resolve(`packages/${pkg.name}/test`);
    // 遍历子包中的所有测试用例
    for (const testCase of await readdir(testDir, { withFileTypes: true })) {
      if (!testCase.isFile() || !testCase.name.endsWith(".js")) {
        continue; // 一个 js 文件代表一个测试用例
      }

      const { status, stderr } = spawnSync(runtime, [resolve(`packages/${pkg.name}/test/${testCase.name}`)], {
        cwd: testDir,
        encoding: "utf-8",
        stdio: ["ignore", "inherit", "pipe"],
      });
      if (status === 0 && !stderr) {
        console.log(`✅ ${runtime} packages/${pkg.name}/test/${testCase.name}`);
      } else {
        console.log(`❌ ${runtime} packages/${pkg.name}/test/${testCase.name}\nstatus: ${status}\n${stderr}`);
        // 如果有任何一个测试用例没通过就直接跳出，必须保证所有用例都通过
        break outer;
      }
    }
  }
}

// 获取 Node.js 最新的版本号
function getLatestVersion() {
  return new Promise((ok, fail) => {
    get("https://nodejs.org/dist/index.json", (res) => {
      if (res.statusCode != 200) {
        return fail(new Error(res.statusMessage));
      }
      let result = "";
      res.setEncoding("utf-8");
      res
        .on("data", (data) => (result += data))
        .on("end", () => {
          try {
            ok(JSON.parse(result)[0].version);
          } catch (error) {
            fail(error);
          }
        })
        .on("error", fail);
    })
      .on("error", fail)
      .end();
  });
}

// 下载用于测试的 Node.js (不适用于 Windows)
function downloadRuntime(version) {
  return new Promise((ok, fail) => {
    const runtime = resolve(`runtimes/${version}/bin/node`);

    if (existsSync(runtime)) {
      return ok(runtime);
    }

    const base = resolve(`runtimes/${version}`);
    mkdir(base, { recursive: true })
      .then(() => {
        get(`https://nodejs.org/dist/${version}/node-${version}-${platform()}-${arch()}.tar.gz`, (res) => {
          if (res.statusCode != 200) {
            return fail(new Error(res.statusMessage));
          }
          pipeline(res, extract({ cwd: base, strip: 1 }), (err) => (err ? fail(err) : ok(runtime)));
        })
          .on("error", fail)
          .end();
      })
      .catch(fail);
  });
}
