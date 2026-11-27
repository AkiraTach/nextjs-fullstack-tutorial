# 第 6 章 认证与会话：JWT vs 数据库会话

## 本章目标

- 对照两种会话方案：A 的无状态 JWT、B 的不透明令牌 + 数据库会话表
- 理解密码哈希的两种放法：应用层 bcrypt 与数据库层 pgcrypto
- 掌握 cookie 的安全属性与登录流程的几个防泄漏细节

## 6.1 会话的本质：服务端如何「记住」你

HTTP 无状态，登录状态靠 cookie 里的一张「票」维持。两个项目的分歧只在**票长什么样、服务端还记不记账**：

**项目 A：JWT（自包含票）**。`src/server/auth/token.ts` 用 jose 把用户信息签进令牌：

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
    // …把 payload 校验、整理成 SessionPayload；任何异常都返回 null
  } catch {
    return null;
  }
}
```

服务端不存任何会话记录，验票 = 验签名 + 看过期。快（不用查库）、天然适合多实例；代价是**签出去的票收不回来**：用户改了密码、被管理员封号，旧 JWT 在 7 天内依然有效（除非再引入黑名单，那就又变回有状态了）。另一个细节：`verifySession` 里把 role 做了白名单收敛（`payload.role === "admin" ? "admin" : "customer"`）——令牌内容是外部输入，验完签名也要再校验形状，不能全信。

**项目 B：不透明令牌 + 会话表（服务端记账）**。`src/features/auth/server/session.ts`：

```ts
const hash = (s: string) => createHash('sha256').update(s).digest('hex');

export async function createSession(id: string) {
  const token = randomBytes(32).toString('hex');               // 随机令牌，无任何含义
  await db.query("INSERT INTO sessions VALUES($1,$2,now()+interval '7 days')",
    [hash(token), id]);                                        // 库里只存哈希
  (await cookies()).set('shop_session', token, { httpOnly: true, sameSite: 'lax', /* … */ });
}

export async function user(): Promise<User | null> {
  const token = (await cookies()).get('shop_session')?.value;
  if (!token) return null;
  const r = await db.query(
    'SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now()',
    [hash(token)]);
  return r.rows[0] ?? null;
}
```

令牌本身是纯随机数，不含任何信息；服务端每次都要查库验票。慢一点（多一次查询），换来的是**随时可撤销**：登出就是删一行（`deleteSession` 真的删库记录，不只是清 cookie），封号就是删该用户全部会话。还有一个精妙点：**库里只存令牌的 SHA-256 哈希**——数据库泄漏时，攻击者拿到的是哈希，反推不出能直接用的令牌（和密码只存哈希是同一个道理；令牌是高熵随机数，用快速哈希 SHA-256 即可，不需要慢哈希）。

| | JWT（A） | 数据库会话（B） |
| --- | --- | --- |
| 验票成本 | 本地验签，无查询 | 每次查库 |
| 撤销 | 做不到（过期前一直有效） | 删行即失效 |
| 泄漏面 | 密钥泄漏 = 可伪造任意用户 | 库泄漏也拿不到可用令牌（存哈希） |
| 适合 | 无状态扩容、跨服务验票 | 需要踢人/封号即时生效的业务 |

没有哪种「更安全」，只有哪种匹配你的撤销需求。

## 6.2 密码哈希：应用层 vs 数据库层

- A 在应用层用 bcryptjs：`bcrypt.hash(password, 10)` 存哈希，登录时 `bcrypt.compare`。
- B 把哈希放进数据库做：注册时 SQL 里 `crypt($2, gen_salt('bf'))`（pgcrypto 的 bcrypt），登录时 `password_hash = crypt($2, password_hash)` 一句 SQL 同时完成取盐和比对。

B 的写法代码极短，但代价是**明文密码会进数据库的查询日志/慢查询记录**的风险面变大，且算法升级（如将来换 Argon2）要动 SQL。A 的应用层方案把密码的活动范围限制在应用进程内，是更主流的选择。无论哪种，共同点是：慢哈希（bcrypt 成本因子 10）、每用户随机盐（bcrypt 自带）、绝不明文或快速哈希存密码。

## 6.3 Cookie 的安全属性

两个项目的会话 cookie 都设了同一组属性，逐个理解：

- `httpOnly: true`：JavaScript 读不到 cookie，XSS 时偷不走票。
- `sameSite: "lax"`：跨站请求基本不带 cookie，大幅压制 CSRF。
- `secure`：只在 https 下发送。A 按站点 URL 推导（第 2 章），B 按演示模式开关——本地 http 调试时关掉，生产必须开。
- `maxAge`：与服务端过期时间保持一致（都是 7 天），避免「cookie 还在、票已过期」或反过来的错位。

## 6.4 登录流程的防泄漏细节（项目 A）

`src/features/auth/actions.ts` 的 login 值得逐行读：

```ts
const [user] = await db.select().from(users).where(eq(users.email, email));
// 无论是邮箱不存在还是密码错误，都返回同样的提示，避免泄露账号是否存在
const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
if (!user || !ok) return { error: "邮箱或密码错误" };
```

- **统一错误信息**：「邮箱不存在」和「密码错误」返回同一句。分开提示等于给攻击者一个免费的「邮箱是否注册过」查询接口。
- **跳转地址防开放重定向**：登录后的 `next` 参数只允许站内相对路径：

```ts
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
```

少了 `!next.startsWith("//")` 这一半，`//evil.com` 就会被浏览器当成协议相对地址跳去外站——登录页是钓鱼攻击的经典跳板，这个两行函数就是防线。

- B 的登录还有个细节：`signIn` 成功前先 `deleteSession()` 再 `createSession()`——**登录时换一张新票**，防会话固定攻击（session fixation）。

## 常见误区

- **「JWT 里可以放敏感信息，反正用户改不了」**：JWT 只是签名，不是加密——内容是 Base64，任何人都能解开看。放 userId、role 可以，放密码、手机号不行。
- **「退出登录 = 清掉 cookie」**：对 JWT 方案，清 cookie 只是本机退出（票本身还有效，复制走的人还能用）；对 B 的方案，必须删库记录才算真撤销。A 的 `destroySession` 只清 cookie，这正是它在 README 里把「会话撤销」列为生产化缺口的原因之一。
- **「密码哈希用 SHA-256 多跑几轮就行」**：快速哈希是为「快」设计的，正是攻击者想要的。密码必须用故意慢的 bcrypt/scrypt/Argon2。
- **「登录错误提示越详细越友好」**：对登录场景，详细 = 泄漏。友好留给注册后的引导，登录失败只给一句话。

## 本章练习

1. 解开一个项目 A 的 session cookie（Base64 解码 JWT 的中段），看看里面有什么、没有什么。
2. 给项目 B 加一个「管理员踢人下线」：删除指定用户的全部 sessions 行，验证该用户刷新页面即被登出。
3. 思考题：A 的 JWT 里包含 role。如果管理员把某用户从 admin 降为 customer，他的旧 JWT 在过期前还能进后台吗？结合第 7 章的校验方式回答，并说说怎么缓解。
