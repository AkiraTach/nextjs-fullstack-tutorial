# 第 6 章 认证与会话

## 本章目标

- 理解参考实现的 JWT 会话方案：令牌怎么签、怎么验、为什么这样分工
- 理解 JWT 与「服务端记账的会话」之间的核心取舍：撤销能力
- 掌握 cookie 安全属性、密码哈希与登录流程的防泄漏细节

## 6.1 会话的本质：服务端如何「记住」你

HTTP 无状态，登录状态靠 cookie 里的一张「票」维持。参考实现用的是 JWT（自包含票）：服务端把用户信息签进令牌，不存任何会话记录，验票 = 验签名 + 看过期。

令牌的签发与验证在 `src/server/auth/token.ts`（纯运算，不碰 cookie，第 1 章讲过这个拆分）：

```ts
export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)   // 7 天
    .sign(authSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, authSecret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return {
      userId: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role === "admin" ? "admin" : "customer",   // 白名单收敛
    };
  } catch {
    return null;
  }
}
```

两个细节：

- **验完签名还要校验形状**：role 用白名单收敛（是 `"admin"` 才当 admin，其余一律 customer）。令牌内容本质上是外部输入，不能全信。
- **失败一律返回 null，不抛异常**：调用方只需判空。验签失败的原因（过期、篡改、格式错）对上层没有区别，都叫「没登录」。

读写 cookie 的部分在 `session.ts`：`getSession()` 读 cookie 并验票；`createSession()` 签票并设置 cookie；`destroySession()` 清 cookie。

## 6.2 核心取舍：JWT 的撤销问题

JWT 的好处是无状态：验票不查库，天然适合多实例扩容。代价是**签出去的票收不回来**：

- 用户改了密码，旧令牌在有效期（这里是 7 天）内依然能用；
- 管理员封了一个账号，他的令牌不会立刻失效；
- 「退出登录」在参考实现里只是清掉本机 cookie，令牌本身复制走还能用。

替代方案是**服务端记账的会话**：cookie 里只放一个随机不透明令牌，服务端在数据库会话表里存它的哈希与过期时间，每次验票查库。慢一点（多一次查询），换来随时可撤销：登出删一行、封号删该用户全部会话；且数据库泄漏时攻击者拿到的是哈希，反推不出可用令牌（令牌是高熵随机数，用 SHA-256 快速哈希即可，不需要慢哈希）。

怎么选，看业务的撤销需求：

| | JWT（参考实现） | 数据库会话 |
| --- | --- | --- |
| 验票成本 | 本地验签，无查询 | 每次查库 |
| 撤销 | 做不到（过期前一直有效） | 删行即失效 |
| 适合 | 无状态扩容、跨服务验票 | 需要踢人/封号即时生效 |

参考实现的 README 把「会话撤销」明确列在上线缺口里——**知道自己方案的代价并写下来，就是架构能力的一部分**。缓解手段也有：缩短有效期、敏感操作要求重新输密码、或给 JWT 加一层版本号（用户表存 token_version，改密时 +1，验票时比对——本质上是把一点状态加回来）。

## 6.3 密码哈希

参考实现在应用层用 bcryptjs：注册时 `bcrypt.hash(password, 10)`，登录时 `bcrypt.compare`。要点：

- **慢哈希**：bcrypt 故意慢且成本可调，暴力破解的代价被人为放大。绝不能用 SHA/MD5 这类快速哈希存密码。
- **每用户随机盐**：bcrypt 自带，相同的密码存出不同的哈希，彩虹表无效。
- 哈希放在应用层而不是数据库里做（如 pgcrypto），是因为明文密码不应出现在数据库的查询日志/慢查询记录里，且算法升级（将来换 Argon2）只动应用代码。

## 6.4 Cookie 的安全属性

会话 cookie 的属性逐个理解：

- `httpOnly: true`：JavaScript 读不到，XSS 时偷不走票。
- `sameSite: "lax"`：跨站请求基本不带 cookie，大幅压制 CSRF。
- `secure`：只在 https 下发送。参考实现按站点 URL 推导（第 2 章），本地 http 自动关闭、生产自动开启。
- `maxAge`：与令牌有效期保持一致（7 天），避免「cookie 还在、票已过期」或反过来的错位。

## 6.5 登录流程的防泄漏细节

登录 action（`src/features/auth/actions.ts`）值得逐行读：

```ts
const [user] = await db.select().from(users).where(eq(users.email, email));
// 无论是邮箱不存在还是密码错误，都返回同样的提示，避免泄露账号是否存在
const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
if (!user || !ok) return { error: "邮箱或密码错误" };
```

- **统一错误信息**：「邮箱不存在」和「密码错误」返回同一句。分开提示等于给攻击者一个免费的「邮箱是否注册过」查询接口。
- **防开放重定向**：登录后的 `next` 参数只允许站内相对路径：

```ts
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
```

少了 `!next.startsWith("//")` 这一半，`//evil.com` 就会被浏览器当成协议相对地址跳去外站——登录页是钓鱼攻击的经典跳板，这个两行函数就是防线。
- **登录成功后合并游客数据**：参考实现会在登录/注册后把游客购物车并入用户购物车（第 10 章）——登录不只是发一张票，还要把「游客态」平滑过渡到「用户态」。

## 常见误区

- **「JWT 里可以放敏感信息，反正用户改不了」**：JWT 只是签名，不是加密——内容是 Base64，任何人都能解开看。放 userId、role 可以，放密码、手机号不行。
- **「退出登录 = 清掉 cookie」**：对 JWT 方案，清 cookie 只是本机退出；对数据库会话方案，必须删服务端记录才算真撤销。先想清楚你的方案里「撤销」意味着什么。
- **「登录错误提示越详细越友好」**：对登录场景，详细 = 泄漏。友好留给注册后的引导，登录失败只给一句话。
- **「密码哈希用 SHA-256 多跑几轮就行」**：快速哈希是为「快」设计的，正是攻击者想要的。密码必须用故意慢的 bcrypt / scrypt / Argon2。

## 本章练习

1. 解开一个 session cookie（Base64 解码 JWT 的中段），看看里面有什么、没有什么。
2. 给参考实现加「改密码后旧会话失效」：用户表加 `token_version` 字段、签票时写入、验票时比对、改密码时自增。跑通后说说这个方案还剩什么缺口。
3. 思考题：JWT 里包含 role。管理员把某用户从 admin 降为 customer 后，他的旧令牌在过期前还能进后台吗？结合第 7 章的校验方式回答，并给出缓解办法。
