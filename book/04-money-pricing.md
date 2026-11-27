# 第 4 章 金额与定价：领域规则要纯

## 本章目标

- 理解金额处理的三条铁律：整数运算、服务端计算、只在展示时格式化
- 看懂项目 B 为什么把定价规则放进不依赖任何框架的 `domain/` 纯函数
- 理解「用户输入的金额字符串」为什么需要专门的解析函数

## 4.1 展示与存储是两回事

项目 A 的 `src/lib/money.ts` 只有四个小函数，但分工很清楚：

```ts
/** 金额统一以"分"为单位的整数，仅在展示时格式化。 */
export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function lineTotal(unitPriceCents: number, quantity: number): number {
  return unitPriceCents * quantity;
}

export function sumCents(items: { unitPriceCents: number; quantity: number }[]) {
  return items.reduce((acc, i) => acc + lineTotal(i.unitPriceCents, i.quantity), 0);
}
```

- 数据库里存 `1999`（分），运算全是整数乘加，**永远不会出现 1998.9999**。
- 只有在渲染给用户看的那一刻，才 `/100` 并交给 `Intl.NumberFormat` 做本地化格式化（货币符号、千分位、小数位都由它处理，不要自己拼字符串）。
- 项目 B 的货币是日元，没有辅币，所以 `src/shared/money.ts` 只剩一个格式化函数——单位选对了，代码自然变短。这反过来说明：**金额的内部单位要选该货币的最小不可分单位**。

## 4.2 解析用户输入：钱的字符串最脏

后台录入商品价格时，用户输入的是 `"19.99"` 这样的字符串。A 为此写了专门的解析（`parseMoneyToCents`），并在 Zod schema 里用 `transform` 接上：

```ts
/** 把用户输入的 "19.99" 转成分；非法输入返回 null。 */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
```

为什么不用 `parseFloat(input) * 100` 一行了事？因为它会放行 `"1.005"`（三位小数）、`"-5"`、`"abc"`（得到 NaN 然后一路传染）。正则先卡死格式：只能是非负、最多两位小数。非法就返回 `null`，由 schema 层翻译成给用户看的错误信息「价格格式应为 19.99」。**解析（parse）与校验（validate）分开**：解析函数只管转换、失败返回 null；报错文案是上层的事。

## 4.3 定价规则是领域逻辑：B 的 totals()

项目 B 把「小计 → 折扣 → 运费 → 总计」写成一个纯函数（`src/features/pricing/domain/totals.ts`）：

```ts
export function totals(subtotal: number, code: string) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0)
    throw new Error('Invalid subtotal');
  const discount = code.trim().toUpperCase() === 'LEARN10' ? Math.floor(subtotal / 10) : 0;
  const shipping = subtotal === 0 || subtotal >= 5000 ? 0 : 500;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}
```

短短十行，示范了领域函数的标准品格：

1. **不依赖任何东西**：没有 import 数据库、没有 import Next。给同样的输入永远同样的输出，所以能被单元测试直接覆盖（第 14 章会看到它的测试）。
2. **先守卫，后计算**：入口先检查 `subtotal` 是非负安全整数，非法直接抛错——把「脏数据」挡在领域之外，下单工作流调用它时不用再操心。
3. **规则显式**：优惠码九折（向下取整到整数日元）、满 5000 免运费、否则运费 500——全写在明面上，没有藏在页面组件或 SQL 里。将来改规则，只改这一处，测试跟着改。

项目 A 没有优惠券和运费（README 的「上线前还需要」里明说了），它的「定价」就是购物车小计 `sumCents`。对照着看你会发现：**A 的钱更简单，但 B 的结构更能长大**——一旦 A 要加优惠券，正确的做法就是照 B 的样子抽一个 domain 函数，而不是把折扣逻辑塞进结账 action。

## 4.4 价格只信服务端

两个项目共同的铁律：**订单金额永远由服务端按数据库里的价格重新计算，前端传来的价格一概不信**。

- A 的结账 action 从数据库购物车查询里拿 `unitPriceCents` 算总价，表单里根本没有价格字段。
- B 的下单工作流在事务里重新查 `products.price` 算小计（第 11 章）。

道理很直白：前端的一切都可以被篡改（改 HTML、改请求体）。价格如果信前端，等于让顾客自己定价。这条铁律的推论是：**凡是参与金额计算的数据（单价、数量、优惠资格），服务端都要自己查、自己算**，前端只负责传「买哪个、买几个」这种意图。

## 常见误区

- **「用 toFixed(2) 修一下浮点就行」**：toFixed 返回字符串且四舍五入规则在边界上不一致，修得了一时修不了对账。整数方案是从根上没这个问题。
- **「优惠逻辑写在页面上，展示多少收多少」**：展示和收费必须是同一个函数的两次调用（B 在结账页展示、workflow 里再算一次并以服务端结果落库），页面上手算一份、服务端再算一份，迟早算出两个数。
- **「金额校验就是 min(0)」**：还要防小数位溢出（1.005）、防 NaN 传染、防整数溢出（B 的 workflow 专门检查了总额不超过 int 上限 2147483647）。

## 本章练习

1. 给项目 B 的 `totals()` 加一条规则：满 10000 日元再减 500（与优惠码可叠加），并给 `tests/domain.test.ts` 补上对应用例，跑 `npm test` 验证。
2. 在项目 A 里故意用浏览器开发者工具把结账表单改出一个 `totalCents` 字段提交，验证服务端是否理会它（不理会——找出它忽略的理由在代码哪里）。
3. 思考题：为什么 `parseMoneyToCents("1.005")` 应该返回 null 而不是四舍五入到 100 或 101？从「谁承担误差」的角度回答。
