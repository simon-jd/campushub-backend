# CampusHub：AI 开发规则

本文件适用于整个 `campushub-backend` 仓库，是 CS 5500 学期项目的版本化上下文。
开始工作前阅读本文件、用户当前要求及相关代码；按用户授权的范围执行。

## 1. 当前阶段与人类审阅

- 用户已审阅并确认本规则，已授权执行 Part 3 的 Express 服务器和健康检查生成任务。
- 生成代码仍需用户亲自审阅，不能将规则确认等同于代码审阅完成。
- 不把代理自检、工具检查或其他代理审阅记作用户已审阅；如实记录实际状态。
- 后续修改规则时说明原因和影响。不得为消除检查错误而静默删除约束、关闭规则或降低严格度。

## 2. 技术栈与依赖白名单

- 使用 Node.js `>=24.21.0`、npm `>=11.19.1`、TypeScript、Express、Mongoose。
- 应用运行时直接依赖仅允许 `express` 和 `mongoose`；允许使用 Node.js 内置模块。
- 开发直接依赖仅允许：`typescript`、`ts-node`、`@types/node`、`@types/express`、`eslint`、`@eslint/js`、`typescript-eslint`、`jiti`、`prettier`。
- 白名单限制直接依赖；这些包由 npm 解析的传递依赖记录在 lockfile 中，不将其当作可自行导入的应用依赖。
- 新增或替换直接依赖前，说明必要性并获得用户批准，再更新本文件和 lockfile。
- 使用 npm；提交 `package-lock.json`，已有 lockfile 的环境使用 `npm ci` 安装。
- 当前使用 TypeScript 5.9 系列及 Node 24 类型定义，避免超出开发工具支持范围或误用高于项目最低环境的 API。
- 手写应用源码只能是 `.ts`，类型声明使用 `.d.ts`；工具配置使用 `.mts` 或 JSON。不手写 `.js`、`.cjs`、`.mjs`、`.jsx` 应用或工具文件。
- `dist/` 内编译生成的 JavaScript 和 `node_modules/` 内第三方文件不受上一条源码扩展名限制，但不得手改或提交。
- 应用使用 CommonJS 输出与 TypeScript `Node16` 模块解析；保持开发入口与编译后的入口一致，不混用未经验证的模块设置。

## 3. 架构边界

业务调用方向为 **Routes → Controllers → Services → Models**；Models 承载数据定义，Service 是 Mongoose 查询调用的唯一宿主。
不得为了一个简单端点把多个层的职责放进同一文件。

| 位置               | 允许的职责                                                        | 禁止的职责                                                  |
| ------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `src/app.ts`       | 创建 Express 应用，挂载公共中间件和路由，导出应用                 | 监听端口、业务逻辑、数据库查询                              |
| `src/server.ts`    | 读取和验证启动配置，启动监听，处理启动失败                        | 定义路由或业务规则                                          |
| `src/routes/`      | 路径、HTTP 方法、已有 Controller 和中间件的映射                   | 内联业务逻辑、直接调用 Service、数据库访问                  |
| `src/controllers/` | 读取和验证 HTTP 输入，调用 Service，设置状态码和响应，转交错误    | 导入或调用 Mongoose Model、直接数据库查询、业务规则         |
| `src/services/`    | 业务逻辑与持久化操作，调用 Mongoose Model，接收和返回有类型的数据 | Express 请求/响应对象、HTTP 状态码、路由注册、HTTP 响应包装 |
| `src/models/`      | Mongoose schema、数据 interface 与必要的 model 定义及导出         | 查询执行、请求处理、业务规则                                |
| `src/middleware/`  | 公共 HTTP 中间件、统一 404 和错误响应                             | 业务规则、数据库查询                                        |
| `src/interfaces/`  | 请求、响应、业务数据和函数契约                                    | 有副作用的可执行逻辑                                        |
| `src/types/`       | TypeScript 声明和必要的第三方类型扩展                             | 应用运行时逻辑                                              |

- 不创建暂时无用的类、通用基类、依赖注入容器或额外架构层。
- Lab 1 不需要数据库连接或查询；Mongoose 为后续项目准备。健康检查不得依赖 MongoDB。
- 持久化阶段的 `find`、`findOne`、`create`、`save`、更新、删除、聚合等 Mongoose 读写调用只允许出现在 `services/`；Controller 只调用 Service，Model 文件只定义和导出 schema/interface/model，不执行查询。
- 当前明确**不引入 Repository 模式**。将来确有需求时，先说明理由并经用户批准同步修改本文件、目录约定和 lint 边界，不能同时保留互相矛盾的两套规则。
- 连接与断开数据库属于启动生命周期，不属于业务查询；未来可由启动入口调用连接配置模块，业务读写仍只能由 Service 执行。本次不创建连接模块。
- 导入方向和职责需要人工检查。当前 lint 只覆盖部分直接导入，不代表可自动证明全部架构边界。

### Health Check 的最小实现

- 即便健康检查端点也必须遵守 **Route → Controller → Service**，并在 `interfaces/` 中定义响应数据接口 `HealthResponse`。
- Service 用一个普通同步函数返回普通状态对象：`{ status: 'ok', timestamp: string }`，其中时间戳为本次调用生成的 UTC ISO 8601 字符串，例如 `new Date().toISOString()`。
- Controller 只调用 Service，再按下一节的统一 JSON 结构包装；Route 只映射 Controller。
- 不创建 `HealthService` 类、配套的 `IHealthService`、工厂、模拟适配器或多余的转发层；保留必要的分层文件和数据接口即可。
- 不引入模拟延迟、定时心跳、心跳检测库、数据库探活或任何无关依赖。

### Controller 的统一 JSON 响应

- 所有返回 JSON 的端点统一使用以下结构，不混用裸对象、裸数组或不同的顶层字段：

```typescript
// 统一定义在 src/interfaces/api-response.interface.ts。
export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiFailure {
  success: false;
  error: ApiError;
}
```

- 成功由 Controller 包装为 `{ success: true, data: serviceResult }`；Service 不返回 HTTP 包装。列表放在 `data` 中，不直接返回顶层数组。
- 验证失败、资源不存在、未匹配路由和统一错误处理中间件均返回 `{ success: false, error: { code, message } }`。`code` 是稳定的机器可读标识，`message` 是可安全展示的说明。
- HTTP 状态码反映真实结果：读取与健康检查为 `200`、创建为 `201`、输入错误为 `400`、资源不存在为 `404`、未知内部错误为 `500`。不得用 HTTP `200` 包装失败；其他状态按语义使用。
- 明确需要 `204 No Content` 的操作不返回响应体；这不是另一种 JSON 格式。Lab 健康检查始终返回 `200` JSON。
- Health 的外部响应形状为 `{ success: true, data: { status: 'ok', timestamp: string } }`。
- 未知内部错误统一使用安全的 `INTERNAL_ERROR` code 和通用说明，不向客户端泄漏堆栈、数据库细节或敏感配置。
- 只共享必要的响应接口；当前不建立通用响应构建器、响应基类或装饰器框架。

## 4. 类型与编码标准

- 保持 `strict: true`、`allowJs: false`、`noEmitOnError: true` 及已有严格检查选项。
- 所有函数和方法的参数与返回值必须明确标注类型；异步函数明确返回 `Promise<T>`。
- 为自定义结构化输入、输出、请求/响应体和数据库记录声明有名字的 `interface`，不要用匿名对象形状或宽泛对象掩盖契约。
- 函数签名由显式参数/返回类型及具名数据 interface 描述；普通函数不强制再声明一个可调用 interface。仅在实际需要复用或替换调用契约时增加函数接口。框架回调使用已有 Express 类型并补齐项目相关的泛型参数；原始值直接使用 `string`、`number` 等类型。
- Mongoose schema 与 model 使用对应的数据 interface 作为泛型参数，保证定义一致。
- 禁止显式 `any`、隐式 `any`，以及通过 `as any`、双重断言、`@ts-ignore` 或关闭 lint 来绕过检查。
- 外部输入和未知异常使用 `unknown`，经运行时检查收窄。类型断言不等同于输入验证。
- 用 `import type` 导入只用于类型的符号；遵守仓库 Prettier 配置。
- 使用清楚的名称和短小函数；注释说明约束或原因，不重复代码字面意思。

## 5. 异步与错误处理

- 每个 Promise 都必须被 `await`、返回给会处理错误的调用方，或带有实际处理错误的 `.catch(...)`。
- 不使用裸 `void promise` 隐藏未处理任务，不吞掉异常，不以成功响应掩盖失败。
- Express 异步处理函数必须把失败交给统一错误处理链：返回框架可处理的 Promise，或捕获 `unknown` 后调用 `next(error)`；同一错误只转交一次。
- 响应完成后不得再次发送响应；内部堆栈和敏感配置不得直接返回客户端。
- 简单同步逻辑保持同步，不为了展示 async 而增加无必要的异步包装。
- 读取端口时，缺省值为 `3000`；只接受 `1–65535` 之间的整数。配置错误应清楚报错。

## 6. 环境文件与版本控制

- `.env` 仅保存在本地，绝不提交；`.env-example` 只包含无密钥的示例值。
- 不提交或手工修改 `node_modules/`、`dist/`、日志、覆盖率输出和临时验证文件。
- 提交源码、上下文规则、工具配置、lockfile 和必要说明。
- 不改写已有历史；不覆盖用户未提交的改动。远程推送、发布和课程平台提交按用户实际授权执行。
- 提交说明使用简洁的 `type: summary`，如 `chore: initialize backend tooling` 或 `feat: add health endpoint`。
- PR/diff 描述包括：做了什么及目的、应用了哪些上下文规则、实际执行的验证、尚未完成的项目。不得编造测试结果或用户审阅记录。

## 7. 检查与完成声明

- 修改完成后运行 `npm run check` 和 `npm run build`，读取结果再报告。
- 当 `npm run check` 或 `npm run build` 失败时，必须依次执行：
  1. 输出失败命令、原始诊断和具体文件路径、行号、列号、错误码或规则名；工具提供错误堆栈时展示堆栈。工具未提供堆栈或位置时明确说明，不编造；敏感值须脱敏。
  2. 分析根因：明确是否是 TypeScript 类型收窄/空值处理/接口不匹配，或跨层访问等分层违规；若属于格式、依赖或工具配置问题，如实单列，不强行归入前两类。
  3. 修复导致失败的类型处理、职责放置或具体代码，再重新执行原失败命令及必要检查；如有剩余失败逐项报告。
- **禁止私自修改 `tsconfig.json` 或 ESLint 忽略项来“假装通过”**；同样禁止降低规则级别、增加 `eslint-disable`、缩小检查文件范围、使用 `@ts-ignore`/`any` 或修改脚本跳过检查。配置确需变更时，先展示证据、影响和拟议差异，取得用户对该变更的明确批准。
- 类型检查和构建通过不能代替实际 HTTP 验证。
- `dev` 和 `start` 分别运行 `src/server.ts` / `dist/server.js`；必须实际启动并请求端点，才能声称服务运行验证通过。
- Part 3 生成代码后，运行 `npm run dev`，实际请求 `GET /api/v1/health`，确认状态码为 `200`、响应为统一成功 JSON，`data.status` 为 `ok`、`data.timestamp` 为有效的 UTC ISO 8601 时间戳，并复查代码的分层和类型。
- 如果生成结果越界，修正规则或实现后重新验证；记录实际偏差，不虚构失败或重试。
- 用户需要亲自阅读上下文规则和生成代码。代理不得用自动检查代替这两个步骤。
