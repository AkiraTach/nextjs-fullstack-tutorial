# 第 13 章 订单状态机、审计与管理后台

## 本章目标

- 理解为什么订单状态流转要用一张显式的「状态机表」来管，而不是散落的 if
- 看懂取消/退款时「恢复库存 + 改支付状态 + 写审计」如何在一个事务里完成
- 理解后台的权限校验与改动后的缓存失效闭环

## 13.1 状态机：一张表管全部流转

项目 B 的订单有六个状态，它的全部合法流转写在一张表里（`src/features/orders/domain/status.ts`）：

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

读法：`paid` 只能去 `shipped` 或 `cancelled`；`refunded` 和 `cancelled` 是终态（空数组）。这张表就是业务规则本身——客服问「已发货的订单能取消吗」，答案在这张表里，不在某个页面组件的 if 里。它还是纯函数模块（第 1 章的 domain 层），可单测（第 14 章有对应用例：`canTransition('paid','refunded')` 必须为 false——跳过退货流程直接退款是不允许的）。

项目 A 的状态少（pending/paid/shipped/cancelled），它没有抽状态机表，而是在后台 action 里手写合法对：

```ts
const ok =
  (status === "paid" && order?.status === "pending") ||
  (status === "shipped" && order?.status === "paid");
```

状态少时这样写没问题，但请注意临界点：**当合法流转超过四五条、或多个入口都要改状态时，手写 if 必然漏**。B 有顾客和管理员两个入口、六个状态，所以它必须把规则收成一张表。选型的依据是复杂度，不是喜好。

## 13.2 状态变更是一个事务（项目 B）

B 把所有状态变更收口到一个 workflow（`src/workflows/change-order-status.ts`），页面和 action 只负责把「谁、想把哪张订单、改成什么状态」递进来：

```ts
export async function changeOrderStatus(actor: User, id: string, to: string) {
  await transaction(async (c) => {
    const o = (await c.query('SELECT * FROM orders WHERE id=$1 FOR UPDATE', [id])).rows[0];
    if (!o) throw new Error('NOT_FOUND');
    // 权限：管理员全可；顾客只能对自己的订单做 cancelled / return_requested
    if (actor.role !== 'admin' && (o.user_id !== actor.id || !['cancelled', 'return_requested'].includes(to)))
      throw new Error('FORBIDDEN');
    if (!canTransition(o.status, to)) throw new Error('INVALID_TRANSITION');

    if (['cancelled', 'refunded'].includes(to)) {
      // 按 id 顺序锁商品行 → 恢复库存 → 支付状态改 refunded
    }
    await c.query('UPDATE orders SET status=$2 WHERE id=$1', [id, to]);
    await c.query('INSERT INTO audit_logs(actor_id,action,target) VALUES($1,$2,$3)',
      [actor.id, 'order.' + to, id]);
    await c.query('INSERT INTO outbox(topic,payload) VALUES($1,$2)',
      ['order.' + to, JSON.stringify({ orderId: id })]);
  });
}
```

一笔状态变更里同时发生四件事，必须同生共死：状态更新、库存恢复（取消/退款时）、支付状态同步、审计与事件记录。任何一步失败，整个事务回滚——不会出现「订单取消了但库存没回来」这种对账噩梦。注意库存恢复前同样 `ORDER BY p.id … FOR UPDATE`（第 11 章的加锁纪律），以及审计写在**同一个事务**里：业务回滚，审计也回滚，日志永远与事实一致。

权限判断也在这里，不在页面：页面藏按钮是体验，workflow 里的 `FORBIDDEN` 才是规则（第 7 章的第二道门）。

项目 A 的对应物是 `cancelOrderAndRestock`（第 12 章）：锁订单行、校验状态集合、改状态、逐项退库存，被三处复用——结账时 Stripe 创建失败的补偿、webhook 的 expired 事件、后台手动取消。**同一个业务动作只有一个实现，三个入口共用**，这就是 service 层存在的意义。

## 13.3 审计日志：谁、做了什么、对谁

B 的 `audit_logs` 表只有四列：`actor_id、action、target、created_at`。后台改价格/库存、订单每次状态变更都写一行，后台有专门的审计页可查。设计要点：

- **只追加，不修改**：审计表没有 UPDATE/DELETE 的代码路径，它是账本不是状态。
- **和业务同事务**：见上。事后补写的日志在崩溃时会丢，且可能与事实不符。
- **动作命名结构化**：`order.shipped`、`product.updated` 这种「资源.动作」命名，将来按资源筛选、统计都方便。

## 13.4 后台的另一半：改完数据要让缓存失效

项目 A 的后台商品 CRUD（`src/features/admin/actions.ts`）每个写操作都以同一组收尾结束：

```ts
function refreshCatalog() {
  revalidateTag(CATALOG_TAG, "max");
  revalidatePath("/admin/products");
}
```

前台目录走了缓存（第 5 章），后台改价若不失效，顾客看到的还是旧价——「后台改了没用」是这类系统最常见的 bug 报告。把失效收成一个函数、每个 action 都调，是防漏的办法。还要看到它对**唯一约束冲突**的处理：插入商品时捕获 PostgreSQL 的 `23505` 错误码，翻译成字段错误「slug 已被使用」回显到表单（第 8 章的闭环）——数据库约束（第 3 章）与用户体验在这里接上了。

## 常见误区

- **「状态流转写在页面按钮的 disabled 里就行」**：按钮状态是给人看的提示，绕过 UI 直接调 action 时必须有服务端的状态机校验。规则要活在 domain/workflow 层。
- **「审计日志事后异步补写更不影响性能」**：异步补写在进程崩溃时丢日志，且日志与业务状态可能不一致。先同事务写好，需要时再优化。
- **「退款就是改个状态」**：退款牵动库存、支付状态、审计三处，少一处都是对账差异。状态变更的副作用清单要在 workflow 里写全。
- **「管理员权限大，操作不用留痕」**：恰恰相反，权限越大越要留痕——审计的第一读者就是未来的你自己。

## 本章练习

1. 在项目 B 里走一遍完整链路：顾客下单 → 管理员发货 → 送达 → 顾客申请退货 → 管理员退款。每一步后去数据库看 `orders.status`、`products.stock`、`payments.status`、`audit_logs` 四处的变化。
2. 试着用顾客身份直接调用 action 把一张 `paid` 订单改成 `refunded`（跳过退货流程），看被哪一层拦下、报什么错。
3. 给项目 A 的手写状态流转补一张 transitions 表并替换 if 判断，跑一遍后台发货流程验证行为不变。
4. 思考题：为什么取消订单要恢复库存、而「已发货后退货退款」也要恢复？两者的库存恢复有没有区别（提示：B 的 README 说退款默认商品已检查可重新入库——生产里这一步该多什么环节）？
