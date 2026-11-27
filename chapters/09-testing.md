---
layout: default
title: "09 · 测试策略与工程质量"
---

[返回目录](../index.md)

# 09 · 测试策略与工程质量

## 原则
单元测试覆盖纯逻辑；集成测试覆盖数据库及外部边界；端到端测试覆盖用户流程。不能用单元测试代替权限和并发验证。

源码：`tests/unit/money.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToCents, sumCents } from "@/lib/money";

describe("money", () => {
  it("formats cents as USD", () => {
    expect(formatMoney(1999)).toBe("$19.99");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("parses user input into integer cents without float error", () => {
    expect(parseMoneyToCents("19.99")).toBe(1999);
    expect(parseMoneyToCents("0.1")).toBe(10);
    expect(parseMoneyToCents("12")).toBe(1200);
    expect(parseMoneyToCents("1.005")).toBeNull();
    expect(parseMoneyToCents("-5")).toBeNull();
    expect(parseMoneyToCents("abc")).toBeNull();
  });

  it("sums line items", () => {
    expect(
      sumCents([
        { unitPriceCents: 1999, quantity: 2 },
        { unitPriceCents: 500, quantity: 1 },
      ]),
    ).toBe(4498);
  });
});
```

现有测试还包括 `schemas.test.ts`（输入校验、slug）和 `token.test.ts`（签名、篡改、错误密钥）。未见数据库集成测试或 Playwright E2E 测试。

| 层级 | 应覆盖 |
|---|---|
| 单元 | 金额、schema、token、状态转换规则 |
| 集成 | 约束、事务回滚、竞争条件、对象归属 |
| HTTP | Webhook 签名、重复事件、错误响应 |
| E2E | 登录、表单错误、权限跳转、正常流程 |

```bash
npm ci
npm run typecheck
npm test
npm run build
```
原 package.json 未配置 lint 命令；需单独引入 ESLint 等工具。构建与测试必须在真实依赖安装后执行，本教程未运行这些命令。

## 推荐 CI 门禁
在 pull request 中依次运行依赖安装、类型检查、单元测试、构建。数据库集成测试使用独立 PostgreSQL 服务和测试凭证。不要将生产数据库连接字符串交给 PR 测试。

## 练习
先为纯函数增加边界用例，再为一次跨表写入增加回滚测试，最后补充双用户越权测试。每修复一个缺陷先写一个能重现问题的测试。


---

[上一章：外部服务、Webhook 与一致性](08-integrations.md) · [目录](../index.md) · [下一章：容器、配置与部署拓扑](10-deployment.md)
