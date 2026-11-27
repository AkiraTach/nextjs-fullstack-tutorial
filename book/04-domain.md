# 第 4 章 领域层：把业务规则写成纯函数

## 本章目标

- 理解为什么最核心的业务规则要抽成不依赖框架、不依赖数据库的纯函数
- 掌握金额处理的三条铁律：整数运算、服务端计算、只在展示时格式化
- 看懂「状态机表」：把状态流转规则收成一张可查、可测的表

## 4.1 什么是领域层

全栈应用里最值钱的代码不是页面，也不是 SQL，而是**业务规则本身**：钱怎么算、什么状态能变成什么状态、什么条件下允许操作。领域层的做法是把这些规则从框架和数据库里剥出来，写成纯函数：

- 不 import Next、不 import 数据库、不读环境变量；
- 给同样的输入，永远同样的输出；
- 因此可以被单元测试直接、快速、稳定地覆盖（第 14 章）。

参考实现里金额工具 `src/lib/money.ts` 就是这个形态；本章再给出定价与状态机两个标准范例。它们的共同点是：**规则只有一份实现，所有入口（页面、Action、后台、任务）都调用它**。

## 4.2 金额：运算、解析、展示分开

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

- 存储与运算全程整数（第 3 章），永远不会出现 `1998.9999`。
- 只有渲染给用户看的那一刻才 `/100` 并交给 `Intl.NumberFormat` 做本地化格式化——货币符号、千分位、小数位都由它处理，不要自己拼字符串。

**解析用户输入是单独的函数**。后台录入价格时用户输入的是 `"19.99"` 这样的字符串：

```ts
/** 把用户输入的 "19.99" 转成分；非法输入返回 null。 */
export function parseMoneyToCents(input: string): number | null {
  const s = input.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100);
}
```

不能用 `parseFloat(input) * 100` 一行了事：它会放行 `"1.005"`（三位小数）、`"-5"`，以及 `"abc"` 得到的 NaN（一路传染后续计算）。正则先卡死格式，非法返回 `null`，由上层（Zod schema 的 transform，第 8 章）翻译成给用户看的错误。**解析只管转换，报错是上层的事**——分工干净，函数才可复用、可测。

## 4.3 定价规则：一个 totals() 收口全部算法

只要业务出现优惠、运费、税费，「总价怎么算」就必须收口成一个领域函数，而不是散落在页面和结账逻辑里各算一份：

```ts
export function totals(subtotal: number, code: string) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0)
    throw new Error('Invalid subtotal');
  const discount = code.trim().toUpperCase() === 'LEARN10' ? Math.floor(subtotal / 10) : 0;
  const shipping = subtotal === 0 || subtotal >= 5000 ? 0 : 500;
  return { subtotal, discount, shipping, total: subtotal - discount + shipping };
}
```

十行里有三个习惯值得学：

1. **先守卫，后计算**：入口先检查小计是非负安全整数，非法直接抛错。脏数据挡在领域之外，调用方不用再操心。
2. **规则显式**：优惠码九折（向下取整到整数）、满额免运费、否则固定运费——全写在明面上。改规则只改这一处，测试跟着改。
3. **展示与落库用同一个函数**：结账页展示的金额和订单最终落库的金额，必须是同一个函数的两次调用。页面上手算一份、服务端再算一份，迟早算出两个数。

## 4.4 状态机表：流转规则收成一张表

有状态的实体（订单、工单、审批……）最容易失控的地方是流转规则散落在各个页面的 if 里。标准做法是收成一张表：

```ts
export const transitions: Record<string, readonly string[]> = {
  paid: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['refunded'],
  refunded: [],
  cancelled: [],
};
export function canTransition(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
```

读法：`paid` 只能去 `shipped` 或 `cancelled`；`refunded`、`cancelled` 是终态。客服问「已发货的订单能取消吗」，答案在这张表里，不在某个按钮的 disabled 属性里。

什么时候需要这张表？经验线：**合法流转超过四五条，或改状态的入口超过一个（用户端 + 后台 + 系统任务），就必须收口**。流转少、入口单一时，在 service 里手写合法状态对也可以——参考实现的订单服务就是这样（第 13 章），但你要清楚临界点在哪，别等规则散架了才收。

## 4.5 价格只信服务端

领域层之上还有一条全栈铁律：**凡是参与金额计算的数据（单价、数量、优惠资格），服务端都要自己查、自己算**，前端只负责传「买哪个、买几个」这种意图。

参考实现的结账 action 从数据库里查价格算总价，表单里根本没有价格字段。道理很直白：前端的一切都可以被篡改（改 HTML、改请求体），价格信前端等于让用户自己定价。

## 常见误区

- **「用 toFixed(2) 修一下浮点就行」**：toFixed 返回字符串且边界舍入不一致，修得了一时修不了对账。整数方案是从根上没这个问题。
- **「规则简单，直接写在页面里」**：规则从不简单太久。第二个入口出现之日，就是两份规则开始漂移之时。先放领域层，成本只有一次 import。
- **「金额校验就是 min(0)」**：还要防小数位溢出（1.005）、防 NaN 传染、防整数溢出（大额订单要检查不超过数据库 int 上限）。

## 本章练习

1. 仿照 `totals()` 给参考实现加一条定价规则：满 10000 分再减 500，与优惠码可叠加；并写出它的单元测试用例表（输入 → 期望输出），至少覆盖三个边界。
2. 把订单的四态流转（pending/paid/shipped/cancelled）写成一张 transitions 表，并找出参考实现里现在手写判断状态合法性的两处地方，说明换成表后各有什么变化。
3. 思考题：为什么 `parseMoneyToCents("1.005")` 应该返回 null 而不是四舍五入？从「谁承担误差」的角度回答。
