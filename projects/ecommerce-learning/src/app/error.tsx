"use client";
export default function ErrorPage({ reset }: {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}) {
  return <section>
    <h1>操作失败</h1>
    <p>请返回页面检查输入，或重试。</p>
    <button onClick={reset}>重试</button>
  </section>;
}
