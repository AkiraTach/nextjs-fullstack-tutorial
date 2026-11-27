"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card text-center">
      <h1 className="text-xl font-bold">出错了</h1>
      <p className="mt-2 text-zinc-500">请稍后重试。</p>
      <button onClick={reset} className="btn mt-4">重试</button>
    </div>
  );
}
