# 第 14 章 测试策略：先测领域层

## 本章目标

- 理解两个项目的测试为什么都只测「纯函数」：金额、令牌、定价、状态机
- 理解测试选点的经济学：哪些代码最值得先测
- 知道这两个项目的测试缺口在哪（集成测试、并发测试、E2E），以及补的顺序

## 14.1 两个项目的测试清单

项目 A（Vitest，`tests/unit/`）：

| 文件 | 测什么 |
| --- | --- |
| `money.test.ts` | 金额格式化、字符串解析（含 `1.005`、`-5`、`abc` 等非法输入）、行小计求和 |
| `token.test.ts` | JWT 签发/验签往返、篡改拒绝、换密钥拒绝、空令牌拒绝 |
| `schemas.test.ts` | Zod 校验规则 |

项目 B（Node 内置 test runner，`tests/domain.test.ts`）测两件事：

```ts
test('coupon and shipping', () => {
  assert.deepEqual(totals(2990, 'LEARN10'), { subtotal: 2990, discount: 299, shipping: 500, total: 3191 });
  assert.equal(totals(5000, '').shipping, 0);
  assert.throws(() => totals(-1, ''));
});
test('order transitions', () => {
  assert.equal(canTransition('paid', 'shipped'), true);
  assert.equal(canTransition('paid', 'refunded'), false);
  assert.equal(canTransition('refunded', 'paid'), false);
  assert.equal(canTransition('return_requested', 'refunded'), true);
});
```

## 14.2 为什么都是纯函数

被测的四个对象有个共同点：**不连数据库、不读环境、不发请求**——给定输入，输出只由输入决定。这类测试：

- **快**：毫秒级，保存代码就能跑，不需要先起 Docker 和数据库。
- **稳**：不依赖外部状态，没有「昨天能过今天不能过」的 flaky。
- **准**：失败时定位就是这个函数，不用排查环境。

而它们守护的恰恰是**错了最贵**的规则：钱算错、令牌验错、状态流转放错。测试选点的经济学就是这样：先测「纯 + 贵」的部分——领域层天然满足这两条。这不是巧合，是第 1 章分层设计的回报：**domain 层之所以要纯，就是为了能被这样测**。架构与测试是一枚硬币的两面。

看 A 的 token 测试怎么测「拒绝」类行为：

```ts
it("rejects tampered or missing tokens", async () => {
  const token = await signSession(payload);
  expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
  expect(await verifySession("garbage")).toBeNull();
  expect(await verifySession(undefined)).toBeNull();
});

it("rejects a token signed with another secret", async () => {
  const token = await signSession(payload);
  process.env.AUTH_SECRET = "<different-secret…>";
  expect(await verifySession(token)).toBeNull();
  // …还原
});
```

安全功能的测试重点不在「好人能过」，而在「坏人过不了」：篡改、伪造、换密钥、空值，每条拒绝路径都要有用例。写认证代码时把这句话刻在心里：**你的 verify 函数会被怎样攻击，就怎样测它**。

## 14.3 缺口与补测顺序

两个项目都诚实地在 README 里写了没测什么。按风险排序，补测的顺序应该是：

1. **集成测试（事务与并发）**：第 11 章的防超卖、幂等、回滚，只有真连数据库并发跑才能验。做法：测试里起一个临时数据库（或 compose 的 db），并发发 N 个下单请求抢最后 1 件库存，断言只成 1 单、库存为 0。这类测试慢且重，但它守的是钱。
2. **权限测试**：第 7 章的越权 404、顾客不能改状态——用不同身份调 action/page 断言结果。
3. **E2E（Playwright）**：完整走一遍「浏览 → 加购 → 结账 → 支付（模拟）→ 后台发货」，守的是主干流程不回归。数量要克制，E2E 维护成本最高，只覆盖核心链路。

注意顺序背后的逻辑：越靠近钱和权限的越先补，越靠近 UI 细节的越后补。反过来先写一堆页面快照测试，是把预算花在最不值钱的地方。

## 常见误区

- **「覆盖率数字高 = 测得好」**：给 getter 和样式组件刷覆盖率毫无意义。看的是关键规则（钱、权、状态、并发）有没有用例。
- **「手动点过一遍了，还要什么自动化」**：手动验证的结论只对当次有效；下一次改动有没有破坏它，无人知道。练习里让你手点的场景，恰恰是最该沉淀成自动化用例的场景。
- **「测试要 mock 一切外部依赖」**：对领域层成立；对事务层恰恰相反——防超卖的测试如果 mock 掉数据库，测的就是空气。哪层测什么，要用哪层的真实形态测。

## 本章练习

1. 给项目 A 的 `schemas.test.ts` 补一条：checkoutSchema 拒绝邮编为空、邮箱大写自动转小写。先写测试，再验证现有实现是否通过。
2. 给项目 B 的 `totals` 写一条新用例：小计恰好 5000 时运费为 0（边界值），以及优惠码小写 `learn10` 也生效（规范化）。
3. 动手写第 14.3 节说的第一个集成测试（可用任何方式起一个临时 PG）：并发 10 个请求下单库存为 3 的商品，断言成功订单数恰为 3。这是本章最有价值的练习。
