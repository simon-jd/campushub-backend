# CampusHub Backend

CS 5500 学期项目后端，采用 TypeScript、Express 和 Mongoose。

## 当前进度

Lab 1 初始化阶段：Git 仓库、依赖、TypeScript/lint/格式配置和目录骨架已建立。
[AGENTS.md](AGENTS.md) 已按用户首轮审阅意见修订，修订版待用户确认。

**尚未生成 Express 应用、启动入口或健康检查接口。** 用户审阅规则后再进行 Lab Part 3。
`src/types/environment.d.ts` 仅声明环境变量类型，不包含服务逻辑。

## 环境与安装

- Node.js `>=24.21.0`
- npm `>=11.19.1`
- 从仓库安装依赖：`npm ci`
- 创建本地配置：`cp .env-example .env`（本地已有 `.env` 时保留原文件）

依赖使用确切版本及 lockfile；TypeScript 选用开发工具支持的 5.9 系列。
当前阶段不需要启动 MongoDB。

## 命令

| 命令                   | 用途                             | 当前可用状态                        |
| ---------------------- | -------------------------------- | ----------------------------------- |
| `npm run typecheck`    | 严格类型检查                     | 可用；目前检查环境类型声明          |
| `npm run lint`         | 检查类型、Promise 和部分导入边界 | 可用                                |
| `npm run format:check` | 检查格式                         | 可用                                |
| `npm run format`       | 应用格式化                       | 可用                                |
| `npm run check`        | 运行前三项检查                   | 可用                                |
| `npm run build`        | 编译 `src/` 到 `dist/`           | 可用；仅有 `.d.ts` 时不产生运行文件 |
| `npm run dev`          | 运行并监听 `src/server.ts`       | 预置；等待 Part 3 创建入口          |
| `npm start`            | 运行 `dist/server.js`            | 预置；等待 Part 3 创建并构建入口    |

这些检查不能代替实际 HTTP 测试，也不能代替用户审阅。

## 目录

```text
src/
├── routes/       路径与中间件映射
├── controllers/  HTTP 请求和响应
├── services/     业务逻辑与 Mongoose 查询
├── models/       Mongoose schema 和数据定义
├── interfaces/   数据与函数契约
└── types/        类型声明
```

后续 `src/app.ts` 负责组装应用，`src/server.ts` 负责读取配置和启动监听。
详细边界、白名单和验收要求见 [AGENTS.md](AGENTS.md)。

持久化读写由 Service 唯一负责，当前不使用 Repository 模式。
Controller 成功响应统一为 `{ success: true, data: ... }`，失败响应统一为
`{ success: false, error: { code, message } }`，并使用对应的 HTTP 状态码。
Health 也保留 Route → Controller → Service 和响应数据接口，Service 只返回状态与时间戳。

## 人工审阅

请重点检查 AGENTS.md 中的依赖白名单、各层职责、类型要求和错误处理方式。
完成审阅后再使用 Lab 指定提示词生成服务器与健康检查。
过程及检查结果记录在 [Lab 1 验证记录](docs/lab1-verification.md)。
