import assert from "assert";
import { readFile, writeFile, mkdir, copyFile } from "fs/promises";
import { resolve } from "path";

assert(process.argv.length > 2, "package name required!");

for (const name of process.argv.slice(2)) {
  const directory = `packages/${name}`;
  // 创建文件夹
  await mkdir(directory);
  await mkdir(`${directory}/test`);

  // 创建 package.json
  const scopePkg = JSON.parse(await readFile(resolve("package.json"), "utf-8"));
  const subPkg = {
    name: `@${scopePkg.name}/${name}`,
    description: "",
    version: "1.0.0",
    private: false,
    main: "index.js",
    types: "index.d.ts",
    files: ["index.js", "index.d.ts"],
    author: scopePkg.author,
    homepage: `${scopePkg.homepage}/tree/master/${directory}`,
    repository: {
      ...scopePkg.repository,
      directory,
    },
    publishConfig: {
      access: "public",
      registry: "https://registry.npmjs.org/",
    },
    engines: {
      node: ">=8.0.0",
    },
    keywords: [scopePkg.name],
    license: scopePkg.license,
  };
  await writeFile(`${directory}/package.json`, `${JSON.stringify(subPkg, null, 2)}`);

  // 创建 index.ts
  await writeFile(`${directory}/index.ts`, ``);

  // 创建 LICENSE
  await copyFile("LICENSE", `${directory}/LICENSE`);

  // 创建 tsconfig.json
  await writeFile(
    `${directory}/tsconfig.json`,
    JSON.stringify(
      {
        extends: "../../tsconfig.json",
        compilerOptions: {
          composite: true,
        },
        files: ["index.ts"],
      },
      null,
      2
    )
  );

  // 修改父级的 tsconfig.json
  const tsConfig = JSON.parse(await readFile(resolve("tsconfig.json"), "utf-8"));
  tsConfig.references.push({ path: directory });
  await writeFile(resolve("tsconfig.json"), JSON.stringify(tsConfig, null, 2));

  // 创建 README.md
  await writeFile(
    `${directory}/README.md`,
    `# @${scopePkg.name}/${name}

<p>
    <a href="https://www.npmjs.com/package/@${scopePkg.name}/${name}" target="_blank"><img src="https://img.shields.io/npm/v/@${scopePkg.name}/${name}.svg?style=for-the-badge" alt="version"></a>
    <a href="https://npmcharts.com/compare/@${scopePkg.name}/${name}" target="_blank"><img src="https://img.shields.io/npm/dm/@${scopePkg.name}/${name}.svg?style=for-the-badge" alt="downloads"></a>
    <a href="${scopePkg.homepage}/blob/master/${directory}/LICENSE" target="_blank"><img src="https://img.shields.io/npm/l/@${scopePkg.name}/${name}.svg?style=for-the-badge" alt="license"></a>
    <a href="${scopePkg.homepage}/tree/master/${directory}" target="_blank"><img src="https://img.shields.io/node/v/@${scopePkg.name}/${name}.svg?style=for-the-badge" alt="node-current"></a>
    <a href="${scopePkg.homepage}" target="_blank"><img src="https://img.shields.io/badge/stream--toolbox-%F0%9F%A7%B0-orange?style=for-the-badge"></a>
</p>

[English](#features) [中文文档](#特点)

---

>

## Features

-
-
-

## Installation

\`\`\`bash
npm i ${subPkg.name}
\`\`\`

## Quick Start

\`\`\`js

\`\`\`

---

>

## 特点

-
-
-

## 安装

\`\`\`bash
npm i ${subPkg.name}
\`\`\`

## 快速开始

\`\`\`js

\`\`\`

`
  );

  console.log(`@${scopePkg.name}/${name} created`);
}
