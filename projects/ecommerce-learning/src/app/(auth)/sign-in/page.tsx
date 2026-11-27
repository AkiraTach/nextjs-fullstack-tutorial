import { signIn, signUp } from '@/features/auth/server/actions';
export default async function Page({ searchParams }: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const { error } = await searchParams;
  return <>
    <h1>登录 / 注册</h1>
    <p>演示顾客：customer@example.test / Customer1234!</p>
    <p>演示管理员：admin@example.test / Admin1234!</p>
    {error && <p className="error" role="alert">登录或注册失败，请检查邮箱和密码。</p>}
    <form className="stack card" action={signIn}>
      <label>邮箱<input
        name="email"
        type="email"
        required
        autoComplete="email"
      /></label>
      <label>密码<input
        name="password"
        type="password"
        required
        minLength={8}
        maxLength={72}
      /></label>
      <div className="row">
        <button>登录</button>
        <button className="quiet" formAction={signUp}>注册新顾客</button>
      </div>
    </form>
  </>;
}
