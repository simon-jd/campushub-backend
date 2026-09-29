# CampusHub Backend

CS 5500 学期项目后端，采用 TypeScript、Express 和 Mongoose。

## 当前进度

Lab 1：初始化与上下文规则已完成，用户已确认 [AGENTS.md](AGENTS.md)。
Express 应用、启动入口及分层健康检查已实现，并通过开发/构建入口的实际 HTTP 验证。
**生成代码仍待用户亲自审阅**；规则确认和自动检查不能替代该步骤。

## 环境与安装

- Node.js `>=24.21.0`
- npm `>=11.19.1`
- 从仓库安装依赖：`npm ci`
- 创建本地配置：`cp .env-example .env`（本地已有 `.env` 时保留原文件）

依赖使用确切版本及 lockfile；TypeScript 选用开发工具支持的 5.9 系列。
当前阶段不需要启动 MongoDB。

## 命令

| 命令                   | 用途                             | 当前可用状态           |
| ---------------------- | -------------------------------- | ---------------------- |
| `npm run typecheck`    | 严格类型检查                     | 可用                   |
| `npm run lint`         | 检查类型、Promise 和部分导入边界 | 可用                   |
| `npm run format:check` | 检查格式                         | 可用                   |
| `npm run format`       | 应用格式化                       | 可用                   |
| `npm run check`        | 运行前三项检查                   | 可用                   |
| `npm run build`        | 编译 `src/` 到 `dist/`           | 可用                   |
| `npm run dev`          | 运行并监听 `src/server.ts`       | 可用                   |
| `npm start`            | 运行 `dist/server.js`            | 先运行 `npm run build` |

这些检查不能代替实际 HTTP 测试，也不能代替用户审阅。

## 运行与验证

在项目目录运行 `npm run dev`，然后在另一个终端执行：

```sh
curl -i http://127.0.0.1:3000/api/v1/health
```

预期 HTTP `200`，JSON 示例（时间戳每次请求生成）：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-09-29T02:11:15.534Z"
  }
}
```

未知路径返回 HTTP `404`：

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "The requested resource was not found."
  }
}
```

服务只监听本机 `127.0.0.1`；`PORT` 默认 `3000`，可在 `.env` 中修改或通过环境变量覆盖。
端口须为 `1–65535` 的整数；无效值或端口被占用时，应用进程明确报错并以非零状态退出。
`npm start` 随应用退出；`npm run dev` 的监听父进程会继续等待文件变化，可用 Ctrl+C 停止。
验证构建入口时，先用 Ctrl+C 停止开发进程，再执行 `npm run build` 和 `npm start`。
健康检查只表示 HTTP 服务存活，不表示数据库或其他依赖就绪；不需要启动 MongoDB。

## 目录

```text
src/
├── app.ts        组装 Express 应用
├── server.ts     配置校验与启动监听
├── routes/       路径与中间件映射
├── controllers/  HTTP 请求和响应
├── services/     业务逻辑与 Mongoose 查询
├── models/       Mongoose schema 和数据定义
├── middleware/   统一 404 与错误处理
├── interfaces/   数据与函数契约
└── types/        类型声明
```

`src/app.ts` 负责组装应用，`src/server.ts` 负责读取配置和启动监听。
详细边界、白名单和验收要求见 [AGENTS.md](AGENTS.md)。

持久化读写由 Service 唯一负责，当前不使用 Repository 模式。
Controller 成功响应统一为 `{ success: true, data: ... }`，失败响应统一为
`{ success: false, error: { code, message } }`，并使用对应的 HTTP 状态码。
Health 也保留 Route → Controller → Service 和响应数据接口，Service 只返回状态与时间戳。

## 人工审阅

规则已审阅确认。代码建议按 `interfaces/` → `services/health.service.ts` →
`controllers/health.controller.ts` → `routes/health.routes.ts` → `middleware/` → `app.ts` → `server.ts` 阅读。
重点核对分层、类型、响应格式、异常转交，以及 Service 是否保持最小实现。
过程及检查结果记录在 [Lab 1 验证记录](docs/lab1-verification.md)。
