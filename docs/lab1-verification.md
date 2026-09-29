# Lab 1 初始化与审阅记录

## 范围与状态

- 当前授权：项目初始化及规则修订；尚未授权生成健康检查。
- 用户对 AGENTS.md 的人工审阅：**已提出首轮修改意见，修订版待确认**。
- Express app、监听入口、健康检查：**未生成**。
- 边界验证提示词、HTTP 验证、生成代码人工审阅：**尚未执行**。
- 远程仓库、PR、课程平台提交：**未执行**。

## 初始化决策

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

## 检查结果

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

## 后续边界验证

用户审阅 AGENTS.md 后使用原文提示词：

> Generate an initial Express server file (`src/app.ts`) and a baseline health-check endpoint (`GET /api/v1/health`).

届时检查：严格类型、目录职责、依赖白名单、路由无业务逻辑、Controller 无数据库查询，
并启动服务验证 HTTP 200 统一成功 JSON，检查 `data.status` 和 `data.timestamp`。
不得提前标记这些项目为通过。

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
