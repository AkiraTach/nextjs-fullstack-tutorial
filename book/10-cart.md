# 第 10 章 购物车：游客合并 vs 用户行锁

## 本章目标

- 对照两种购物车模型：A 支持游客购物车并在登录时合并；B 只服务登录用户
- 理解购物车数量的边界为什么必须由服务端钳制
- 理解 B 用「锁用户行」串行化同一用户并发操作的思路

## 10.1 先问业务：游客能不能加购？

购物车的所有技术差异，都源于一个业务决定：

- **项目 A：游客可以加购、可以结账**（结账只需填邮箱和地址）。于是它需要一等公民的「游客购物车」：cart 记录先建着，`userId` 为空，靠 cookie 里的 cart id 认领。
- **项目 B：必须登录才能加购**。于是 `cart_items` 直接以 `user_id` 为主键的一部分，没有 cart 表、没有游客状态。

A 的找车逻辑（`src/features/cart/cart-store.ts`）因此分两条路：

```ts
export async function findCartId(): Promise<string | null> {
  const session = await getSession();
  if (session) {
    // 登录用户：按 userId 找他的购物车
    const [cart] = await db.select({ id: carts.id }).from(carts)
      .where(eq(carts.userId, session.userId)).limit(1);
    return cart?.id ?? null;
  }
  // 游客：读 cookie，并校验它真的是个 UUID、且库里存在这辆车
  const raw = (await cookies()).get(CART_COOKIE)?.value;
  if (!raw || !UUID_RE.test(raw)) return null;
  // …
}
```

注意对 cookie 值的处理：先正则验形状，再查库确认存在——cookie 是用户可篡改的输入，不能拿来就信。还有一对函数的分工很讲究：`findCartId` 只读、渲染期可调用；`getOrCreateCartId` 会写 cookie，**只能在 Server Action 里调用**（渲染期写 cookie 在 Next 里是禁止的）。把「读」和「建」拆成两个函数，是被框架的渲染规则逼出来的正确形状。

## 10.2 登录合并：游客车并入用户车

游客逛了半天加了五件商品，然后登录——如果登录后购物车变空，转化率当场去世。A 的 `mergeGuestCartInto(userId)` 在注册/登录成功后立刻执行：

- 用户还没有购物车：直接把游客车的 `userId` 改成他，「认领」完成，零数据搬运。
- 用户已有购物车：逐行把游客车的数量**累加**进用户车（同一商品用 `onConflictDoUpdate` 做 `quantity = quantity + 游客数量`），然后删掉游客车、清掉 cookie。
- 全程一个事务：中途失败就整体回滚，不会出现「一半合并一半没合」的中间态。

## 10.3 数量边界：服务端钳制，不信前端

A 的加购 action（`src/features/cart/actions.ts`）：

```ts
const MAX_PER_LINE = 20;
// 校验：zod 先卡 productId 是 uuid、quantity 在 1..20
// 再查商品：不存在、未上架、无库存 → 直接返回，什么都不做
const next = Math.min((existing?.quantity ?? 0) + quantity, product.stock, MAX_PER_LINE);
```

三层钳制：单次提交上限（zod）、单行总量上限（20）、库存上限（`Math.min` 里带上 `product.stock`）。为什么加购时就钳到库存？因为购物车是结账的预演，越早把数量拉回现实，结账时「库存不足」的惊吓越少。当然结账时还要再验一次（第 11 章）——加购到结账之间库存随时可能被别人买走，购物车里的数字只是「当时的意愿」，不是预留。

## 10.4 B 的做法：一把用户行锁解决并发

B 的加购在事务里先锁用户行（`src/features/cart/server/actions.ts`）：

```ts
await transaction(async (c) => {
  await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId]);
  const p = (await c.query('SELECT stock,active FROM products WHERE id=$1', [id])).rows[0];
  if (!p?.active || p.stock < 1) return;
  await c.query(
    'INSERT INTO cart_items VALUES($1,$2,1) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=LEAST(cart_items.quantity+1,$3,99)',
    [u.id, id, p.stock]);
});
```

- `SELECT … FOR UPDATE` 锁住这个用户自己的行：同一用户的两个并发请求（双击、两个标签页）被迫排队，数量不会算错；不同用户之间互不阻塞。
- 数量上限同样在 SQL 里钳：`LEAST(现有+1, 库存, 99)`。
- B 的下单工作流开头也锁同一行用户行——于是「加购」和「结账」对同一用户天然串行，不会出现结账读到一半更新的购物车。这个「锁一个聚合根」的思路在第 11 章还会放大使用。

对照来看：A 没有在加购时加锁，它靠单条 `INSERT … ON CONFLICT` 的原子性和 `Math.min` 钳制保证结果不越界（并发下可能少加一件，但不会加出负数或超库存的脏数据）。两种都能成立，B 的更严格、A 的更轻——**并发控制的强度要匹配业务对正确性的要求**：购物车数量差一件可以接受，订单库存差一件不行（下一章）。

## 常见误区

- **「购物车放 localStorage 就行」**：换设备就丢、服务端结账时还得全部重验重建。两个项目都把购物车放服务端数据库，cookie/登录态只存「车是谁的」。
- **「前端 max 属性限制了数量，后端不用管」**：max 是给诚实用户的提示，不是约束。约束只认服务端钳制。
- **「加购成功就等于预订了库存」**：购物车不预留库存是行业惯例（否则加购不买的人能把库存锁死）。结账那一刻的校验才是真的——下一章的主题。

## 本章练习

1. 在项目 A 里以游客身份加购两件商品，再注册新账号，验证购物车被合并、数量正确。
2. 给项目 A 的合并逻辑找一个边界情况：游客车和用户车有同一商品，且合计超过库存 20 上限时，现在的代码会怎样？需要修吗？
3. 思考题：B 为什么锁的是「用户行」而不是「购物车行」？（提示：B 没有 carts 表；再想想这把锁还顺带保护了哪个流程。）
