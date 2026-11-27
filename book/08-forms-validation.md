# 第 8 章 表单、Server Actions 与 Zod 校验

## 本章目标

- 理解 App Router 的表单范式：Server Action + `useActionState` + `useFormStatus`
- 理解为什么所有输入都要过 Zod，以及校验失败时错误如何回显到字段
- 对照项目 B 的「redirect 带错误码」简化做法，理解两种错误反馈的取舍

## 8.1 表单的服务端闭环

项目 A 的结账表单是一个客户端组件，但它不写一行 fetch：

```tsx
// src/features/checkout/components/checkout-form.tsx（项目 A）
"use client";

export function CheckoutForm({ defaultEmail, defaultName }) {
  const [state, action] = useActionState(placeOrder, undefined);
  const fe = state?.fieldErrors ?? {};

  return (
    <form action={action} className="card space-y-4">
      <FormError message={state?.error} />
      <Field label="邮箱" name="email" type="email" errors={fe.email} required />
      <Field label="收件人" name="shippingName" errors={fe.shippingName} required />
      {/* … */}
      <SubmitButton pendingText="正在下单…">提交订单并支付</SubmitButton>
    </form>
  );
}
```

数据流是一个闭环：

```
用户提交 → useActionState 把 FormData 交给 Server Action
→ Action 用 Zod 校验：失败 → 返回 { fieldErrors }，表单按字段回显
                    成功 → 执行业务，最后 redirect（成功不返回状态）
```

关键约定在 Action 的签名和返回值上（`src/features/checkout/actions.ts`）：

```ts
export async function placeOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = checkoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  // …业务逻辑
}
```

- `FormState` 是两个项目外最值得抄走的类型：`{ error?: string; fieldErrors?: Record<string, string[]> }`——一个全局错误（「购物车是空的」）加一组字段级错误，覆盖了表单反馈的全部需求。
- 用 `safeParse` 而不是 `parse`：校验失败是**预期内**的用户错误，走返回值；`parse` 抛异常适合「不该发生」的程序错误。分清这两类，代码里就不会到处是 try/catch。
- 成功路径用 `redirect()`（抛异常实现）结束，所以 Action 的返回值只承载失败信息。这个不对称是故意的：成功就跳走，不需要状态。

## 8.2 校验规则集中在 schemas.ts

每个 feature 一个 `schemas.ts`，规则和报错文案都写在那里。以 A 的结账 schema 为例（`src/features/checkout/schemas.ts`）：

```ts
export const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("邮箱格式不正确")),
  shippingName: z.string().trim().min(1, "请输入收件人").max(100),
  shippingAddress: z.string().trim().min(3, "请输入详细地址").max(200),
  // …
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
```

三个习惯值得学：

1. **先规范化，再校验**：`trim().toLowerCase()` 写进 schema，邮箱大小写、首尾空格在入口就统一，后面所有代码都不用再操心。
2. **每个字段都有上限**：`max(200)` 看似多余，实则防的是超大输入打爆数据库和日志。校验不只是格式，更是资源边界。
3. **类型从 schema 推出**（`z.infer`）：校验规则和 TS 类型永远同步，改一处即可。这正是第 3 章 Drizzle「schema 即类型」思想的表单版。

后台商品表单的 schema 更进一步，用 `transform` 把字符串价格直接转成分（第 4 章的 `parseMoneyToCents`），校验即转换，下游拿到的已经是干净的类型化数据。

## 8.3 提交中的状态：useFormStatus

提交按钮在 `src/components/ui/submit-button.tsx`：

```tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText = "处理中…", /* … */ }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={/* … */}>
      {pending ? pendingText : children}
    </button>
  );
}
```

`pending` 期间禁用按钮 + 换文案。这不只是体验优化：**它在客户端先挡掉一批重复提交**（手快连点两下）。但注意第 11 章会讲——客户端防重复只是辅助，下单的幂等必须由服务端保证，因为请求可以绕过浏览器重放。

配套的 `Field` 组件把「标签 + 输入框 + 该字段的错误列表」打包成一个单元，表单里每个字段只写一行。错误回显的位置贴着字段，用户不用猜哪填错了。

## 8.4 项目 B 的简化路线：redirect + 错误码

项目 B 的表单处理要朴素得多：Action 校验失败就 `redirect('/checkout?error=INSUFFICIENT_STOCK')`，页面读 query 参数显示对应提示；成功也 redirect 到订单页。它甚至不用 `useActionState`，Action 签名就是 `(formData) => Promise<never>`。

取舍很清楚：

| | A：useActionState 回显 | B：redirect 错误码 |
| --- | --- | --- |
| 字段级错误 | 有，贴着字段显示，用户输入不丢失 | 无，只有顶部一句提示，且表单清空重填 |
| 代码量 | 多（FormState 类型、Field 组件、客户端组件） | 少得多 |
| 适合 | 面向公众的产品表单 | 内部工具、教学、字段少的表单 |

B 不是「写错了」，是教学项目主动选了低复杂度，并把省下的篇幅给了事务与状态机。**知道两种做法的成本差，才能按场景选**——这正是本教程双项目对照的意义。

## 常见误区

- **「前端校验过了，后端可以省」**：前端校验是体验（即时反馈），后端校验是安全（请求可伪造）。两者目的不同，都要做；规则用同一份 schema 表达，避免漂移。
- **「Zod 校验通过 = 数据可信」**：Zod 只保证形状对（类型、长度、格式），保证不了业务真理（商品是否存在、库存够不够、价格对不对）。业务校验在 Action/workflow 里另做一层（第 11 章）。
- **「把异常信息直接返回给用户看」**：数据库错误、堆栈信息回显到页面是信息泄漏。给用户的只能是准备好的文案；原始错误进日志（A 的 Stripe 失败处理就是 `console.error` 记录 + 返回通用提示）。

## 本章练习

1. 在项目 A 的注册表单里给密码加一条规则：必须包含数字。在 schema 改一处，验证前端回显和服务端拦截都生效。
2. 把项目 B 的登录表单改成 A 的风格（useActionState + 字段错误），体会多写了哪些代码、换来了什么。
3. 思考题：A 的 `placeOrder` 在校验失败时返回状态、在成功时 redirect。为什么成功不能也返回一个 `{ ok: true }` 让前端自己跳？（提示：想想非 JS 环境和表单的渐进增强。）
