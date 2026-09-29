# Lab 1 初始化与审阅记录

## 范围与状态

- 当前授权：用户回复“没有问题了，执行下一步骤”，已批准修订规则并授权 Part 3。
- 用户对 AGENTS.md 的人工审阅：**已完成**。
- Express app、监听入口、健康检查：**已实现**。
- 边界验证提示词、静态检查、开发及构建入口 HTTP 验证：**已执行**。
- 生成代码的用户人工审阅：**待完成**，不能用代理自检替代。
- 远程仓库、PR、课程平台提交：**未执行**。

## 初始化决策（历史记录）

- 在独立的新目录 `campushub-backend` 初始化 main 分支，课程目录本身不建立 Git 仓库。
- 本次只建立配置和目录骨架，不执行计划中的 Part 3。
- 应用依赖为 Express、Mongoose；开发依赖单独列入规则白名单。
- 选择 TypeScript 5.9 系列：初始化时 npm 最新标签为 7.0.2，而 typescript-eslint 声明支持 `<6.1.0`，不盲目安装不受支持的组合。
- 使用 `.d.ts` 环境类型声明作为初始类型输入；没有业务实现，构建检查不等同于服务验证。
- 预置开发及生产启动命令，待服务器入口生成后才能运行。
- 配置文件用实际工具检查；不为这次配置初始化添加业务测试或测试框架。

## 配置依据

- [typescript-eslint 入门](https://typescript-eslint.io/getting-started/)
- [ESLint 配置文件说明](https://eslint.org/docs/latest/use/configure/configuration-files)

## 初始化检查结果（历史记录）

- 实测环境：Node.js `v26.8.2`、npm `11.19.1`，满足 Lab 所写的最低版本。
- `npm run check`：通过，包含严格类型检查、lint 和格式检查。
- `npm run build`：通过；当前只含 `.d.ts`，没有生成可运行服务器。
- `npm ls --depth=0`：通过，直接依赖均在 AGENTS.md 白名单中，无依赖解析错误。
- 安装输出审计：209 个包，报告 0 个已知漏洞（仅代表当次 npm 审计结果）。
- ESLint 有效配置读取：未来 route、controller、service 文件均启用禁止 `any`、未处理 Promise 和对应直接导入限制。
- `ts-node` 实际执行 TypeScript 并导入 Express/Mongoose：通过，未启动 HTTP 或数据库连接。
- Node 读取本地环境文件：得到 `PORT=3000`。
- `.env`、依赖目录与构建输出路径已被 Git 忽略；源码、配置与规则文件可纳入版本控制。
- HTTP 和生成代码边界检查仍未执行；上述结果仅覆盖本次初始化范围。
- 独立代理只读审查：未发现 Critical / Important 问题，确认可交给用户审阅；其提示的旧检查状态已更新为本节实际结果。该审查不代替用户审阅。

## Part 3 生成提示词

用户确认 AGENTS.md 后，本轮按原文提示词与审阅后的规则生成：

> Generate an initial Express server file (`src/app.ts`) and a baseline health-check endpoint (`GET /api/v1/health`).

检查范围：严格类型、目录职责、依赖白名单、路由无业务逻辑、Controller 无数据库查询，
以及 HTTP 200 统一成功 JSON、`data.status` 和 `data.timestamp`。

## 首轮人工审阅修订

- 明确 Service 是 Mongoose 查询调用的唯一宿主，当前不引入 Repository；启动连接与业务查询分开说明。
- 同步更新 Service 的直接导入限制，允许 Mongoose 和 models；Route/Controller 的数据库导入限制保持生效。
- 明确成功/失败的 JSON 包装、HTTP 状态码和统一错误处理格式。
- Health 必须保留分层与响应接口，Service 只返回状态和时间戳，不增加类、延迟或探活依赖。
- 普通函数不再强制配套可调用 interface；保留显式签名和数据接口要求。
- 检查失败必须展示真实诊断位置及可用堆栈、分析类型或分层等根因；不得通过放宽配置或忽略文件绕过检查。
- 本次 lint 变更由用户明确要求调整数据库职责所授权；没有修改 tsconfig、检查脚本、规则级别或忽略范围。
- 修订后执行 `npm run check`、`npm run build`：均通过。
- 基于实际 ESLint 导入规则执行 7 项检查：Service 导入 Mongoose/Model 允许，导入 Express/原生 MongoDB 驱动禁止；Controller 导入 Mongoose/Model 禁止；Route 直接导入 Service 禁止。全部符合预期。
- 复查各层的禁止 `any` 与未处理 Promise 规则仍为 error；Git 差异确认 tsconfig、依赖、检查脚本和忽略文件未改变。
- 本轮仍未生成 app/server/health 代码，未执行 HTTP 验证。

## Part 3 实现与验证结果

- 调用路径：`app.ts` → `health.routes.ts` → `health.controller.ts` → `health.service.ts`。
- `HealthResponse` 与统一成功/失败接口位于 `interfaces/`；Service 只有一个同步函数，返回状态和 UTC ISO 时间戳。
- `error.middleware.ts` 负责 404 和统一 500；已发送响应头时转交错误，避免重复发送响应。
- 启动入口负责端口校验和监听错误。只监听 `127.0.0.1`，不连接数据库，不新增依赖。
- 新增一个 `middleware/` 目录承载已批准的公共错误处理；未引入业务架构层、类或响应构建器。
- `npm run check`：通过，包含 TypeScript、ESLint、Prettier。
- `npm run build`：通过，产生可运行的 `dist/server.js`。
- `npm run dev` 实际监听 `127.0.0.1:3000`；`curl -i` 得到 HTTP 200，真实响应如下：

```json
{
  "success": true,
  "data": { "status": "ok", "timestamp": "2026-09-29T02:11:15.534Z" }
}
```

- 开发入口验证：HTTP 200、JSON content-type、准确的字段集合、状态值、当前时间范围和 ISO 时间戳、统一 404，全部通过。
- 停止开发进程后使用 `npm start` 启动构建入口，健康检查和统一 404 均通过。
- 9 个无效 PORT 值（空字符串、0、65536、-1、1.5、abc、3000junk、1e3、带空格的 3000）均明确报错且退出状态为 1。
- 在端口已占用时启动第二个构建进程，得到 EADDRINUSE 并退出 1，原服务仍可响应。
- 临时 HTTP 测试应用挂载真实错误中间件，验证同步抛错、异步 Promise 拒绝均返回统一 500 JSON，客户端不包含私密测试错误内容；已发送头部的错误正确转交。临时应用已关闭，不包含在产品代码中。
- 验证用开发和构建服务进程均已停止；没有修改 tsconfig、lint 忽略项、依赖或检查脚本。
- 使用真实 HTTP 与 Node 内置断言完成验证，未添加测试框架或生产测试路由。

### 开发启动环境错误记录

第一次在受限执行环境运行 `npm run dev` 失败，原始诊断为：

```text
Error: EMFILE: too many open files, watch
    at FSWatcher._handle.onchange (node:internal/fs/watchers:269:21)
Emitted 'error' event on FSWatcher instance at:
    at FSWatcher._handle.onchange (node:internal/fs/watchers:275:12)
errno: -24, syscall: 'watch', code: 'EMFILE', filename: null
```

失败发生于 Node 文件监听器，没有项目文件行号；类型及分层检查均已通过。
仅调整工具的运行权限后，原样的 `npm run dev` 成功启动且 HTTP 验证通过。
因此按执行环境限制处理，没有修改代码、类型配置、规则或忽略项来规避检查。

### 最终审查修复

- 发现 Express 5 在监听失败时也调用 `app.listen` 的回调；初版 `src/server.ts:10` 忽略该情况，虽然失败退出正确，但会误打印启动成功。
- 增补端口占用断言“失败时 stdout 不得包含启动成功”，首次在临时检查 `[eval1]:13:10` 得到 `ERR_ASSERTION`，实际捕获了误打印的监听地址。
- 将成功日志移至 `server.once('listening')`，保留原有错误事件处理；不修改脚本或配置。
- README 区分应用进程退出与开发 watch 父进程继续等待，避免误导使用者。
- 修复后同一端口占用断言通过：stdout 为空、stderr 包含 EADDRINUSE、退出状态为 1。
- 修复后 `npm run check`、`npm run build` 均通过；最终开发和构建入口各重新验证健康检查 200、当前 ISO 时间戳、统一 404，全部通过，验证进程已停止。
- 独立代理复查最终代码，无 Critical / Important 问题。代理审查不代表用户已完成代码阅读。
