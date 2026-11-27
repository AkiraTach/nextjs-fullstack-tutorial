#!/usr/bin/env python3
"""Build the tutorial book (Markdown) into a static site for GitHub Pages."""
import re
import shutil
from pathlib import Path

import markdown

ROOT = Path(__file__).parent
BOOK = ROOT / "book"
OUT = ROOT / "site"

CHAPTERS = [
    ("00-intro", "导读：教程定位与参考实现"),
    ("01-architecture", "第 1 章 全栈架构总览：分层与依赖方向"),
    ("02-env-docker", "第 2 章 配置、环境与运行编排"),
    ("03-database", "第 3 章 数据层设计：建模、约束与迁移"),
    ("04-domain", "第 4 章 领域层：把业务规则写成纯函数"),
    ("05-data-access", "第 5 章 数据访问层：查询、参数化与缓存"),
    ("06-auth-session", "第 6 章 认证与会话"),
    ("07-access-control", "第 7 章 访问控制：两道门与越权防护"),
    ("08-forms-validation", "第 8 章 表单、Server Actions 与校验"),
    ("09-rendering", "第 9 章 页面渲染与数据获取"),
    ("10-cart", "第 10 章 客户端状态与服务端状态：购物车"),
    ("11-checkout-transactions", "第 11 章 事务与并发控制"),
    ("12-payments", "第 12 章 与外部服务集成：支付与 Webhook"),
    ("13-orders-admin", "第 13 章 业务流程编排：状态机、审计与事件"),
    ("14-testing", "第 14 章 测试策略"),
    ("15-deployment", "第 15 章 部署与运维"),
    ("16-checklist", "第 16 章 全栈架构清单与进阶路线"),
]

CSS = """
:root{--bg:#fff;--fg:#1f2328;--muted:#59636e;--border:#d1d9e0;--accent:#0969da;--code-bg:#f6f8fa;--sidebar-bg:#f6f8fa}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--border:#3d444d;--accent:#4493f8;--code-bg:#151b23;--sidebar-bg:#151b23}}
*{box-sizing:border-box}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;background:var(--bg);color:var(--fg);line-height:1.75}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.layout{display:flex;min-height:100vh}
nav.sidebar{width:300px;flex:0 0 300px;background:var(--sidebar-bg);border-right:1px solid var(--border);padding:20px 16px;position:sticky;top:0;height:100vh;overflow-y:auto}
nav.sidebar .site-title{font-weight:700;font-size:17px;margin:0 0 4px}
nav.sidebar .site-sub{color:var(--muted);font-size:12.5px;margin:0 0 16px}
nav.sidebar ol{list-style:none;margin:0;padding:0}
nav.sidebar li a{display:block;padding:5px 8px;border-radius:6px;color:var(--fg);font-size:13.5px}
nav.sidebar li a:hover{background:var(--border);text-decoration:none}
nav.sidebar li a.active{background:var(--accent);color:#fff}
main{flex:1;min-width:0;padding:32px 40px 64px;max-width:920px;margin:0 auto}
h1{font-size:27px;line-height:1.35;border-bottom:1px solid var(--border);padding-bottom:10px}
h2{font-size:21px;margin-top:36px}h3{font-size:17px;margin-top:26px}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:var(--code-bg);padding:.15em .35em;border-radius:5px}
pre{background:var(--code-bg);border:1px solid var(--border);border-radius:8px;padding:14px 16px;overflow-x:auto}
pre code{background:none;padding:0;font-size:13px;line-height:1.6}
table{border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;display:block;overflow-x:auto}
th,td{border:1px solid var(--border);padding:7px 10px;text-align:left;vertical-align:top}
th{background:var(--sidebar-bg)}
blockquote{border-left:4px solid var(--border);margin:16px 0;padding:2px 16px;color:var(--muted)}
.prevnext{display:flex;justify-content:space-between;gap:16px;margin-top:48px;border-top:1px solid var(--border);padding-top:18px;font-size:14.5px}
.prevnext .next{margin-left:auto;text-align:right}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:20px}
.card{border:1px solid var(--border);border-radius:10px;padding:16px 18px;color:var(--fg)}
.card:hover{border-color:var(--accent);text-decoration:none}
.card .t{font-weight:600;display:block;margin-bottom:4px}
.card .d{color:var(--muted);font-size:13px}
footer{color:var(--muted);font-size:12.5px;margin-top:56px;border-top:1px solid var(--border);padding-top:14px}
.menu-btn{display:none}
@media (max-width:860px){
  nav.sidebar{position:fixed;left:0;top:0;z-index:20;transform:translateX(-100%);transition:transform .2s}
  nav.sidebar.open{transform:none;box-shadow:0 0 40px rgba(0,0,0,.25)}
  main{padding:20px 18px 56px}
  .menu-btn{display:inline-block;margin-bottom:10px;background:var(--sidebar-bg);border:1px solid var(--border);border-radius:6px;padding:5px 12px;cursor:pointer;color:var(--fg)}
}
"""

TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Next.js 全栈最佳实践教程</title>
<meta name="description" content="Next.js 全栈架构最佳实践教程：分层、配置、数据建模、领域规则、认证、访问控制、事务与并发、外部服务集成、流程编排、测试与部署。">
<link rel="stylesheet" href="{root}assets/style.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css" media="(prefers-color-scheme: dark)">
</head>
<body>
<div class="layout">
<nav class="sidebar" id="sidebar">
<p class="site-title"><a href="{root}index.html" style="color:inherit">Next.js 全栈最佳实践教程</a></p>
<p class="site-sub">以一个完整的 Next.js 16 + PostgreSQL 参考实现，系统讲全栈架构：分层 · 数据 · 认证 · 事务 · 集成 · 测试 · 部署</p>
<ol>
{nav}
</ol>
<p class="site-sub" style="margin-top:18px">参考实现源码在仓库 <code>project/</code> 目录，可与教程对照阅读。</p>
</nav>
<main>
<button class="menu-btn" onclick="document.getElementById('sidebar').classList.toggle('open')">☰ 目录</button>
{body}
{prevnext}
<footer>Next.js 全栈最佳实践教程 · 代码以仓库 project/ 目录的参考实现为准</footer>
</main>
</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<script>hljs.highlightAll();</script>
</body>
</html>
"""

HOME_BODY = """
<h1>Next.js 全栈最佳实践教程</h1>
<p>这是一本讲<strong>全栈架构</strong>的教程：怎么分层、配置怎么管、数据怎么建模、认证怎么做、并发怎么控、外部服务怎么接、怎么测、怎么部署——这些决定一个项目能不能长期维护的问题。</p>
<p>教程贯穿一个完整的参考实现（Next.js 16 + PostgreSQL 17：前台浏览、账号、购物车、结账支付、订单、运营后台），源码在仓库 <code>project/</code> 目录。商城只是载体，每章讲的方法都可迁移到任何全栈项目。</p>
<p>从<a href="chapters/00-intro.html">导读</a>开始：先把参考实现用 Docker 跑起来走一遍流程，再按章读代码。每章都有关键代码节选、设计理由、常见误区和动手练习。</p>
<h2>章节</h2>
<div class="cards">
{cards}
</div>
<h2>参考实现</h2>
<table>
<tr><th>维度</th><th>选型</th></tr>
<tr><td>框架</td><td>Next.js 16（App Router）· React 19 · TypeScript</td></tr>
<tr><td>数据库</td><td>PostgreSQL 17 · Drizzle ORM（schema 即类型 + 迁移链）</td></tr>
<tr><td>认证</td><td>JWT 会话（jose）· bcrypt 密码哈希 · proxy + 守卫两道门</td></tr>
<tr><td>校验</td><td>Zod（校验规则与类型同源）· Server Actions + useActionState</td></tr>
<tr><td>支付集成</td><td>Stripe Checkout + Webhook（无密钥时自动降级模拟支付）</td></tr>
<tr><td>正确性</td><td>条件 UPDATE 防超卖 · 幂等确认 · 状态机 + 审计 + outbox</td></tr>
<tr><td>测试 / 部署</td><td>Vitest（领域层优先）· Docker 多阶段构建 + compose 编排</td></tr>
</table>
"""


def nav_html(current: str, prefix: str) -> str:
    items = []
    for slug, title in CHAPTERS:
        cls = ' class="active"' if slug == current else ""
        items.append(f'<li><a href="{prefix}chapters/{slug}.html"{cls}>{title}</a></li>')
    return "\n".join(items)


def main() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "chapters").mkdir(parents=True)
    (OUT / "assets").mkdir(parents=True)
    (OUT / "assets" / "style.css").write_text(CSS, encoding="utf-8")

    md = markdown.Markdown(extensions=["fenced_code", "tables", "sane_lists"])

    for i, (slug, title) in enumerate(CHAPTERS):
        text = (BOOK / f"{slug}.md").read_text(encoding="utf-8")
        md.reset()
        body = md.convert(text)
        prevnext = '<div class="prevnext">'
        if i > 0:
            pslug, ptitle = CHAPTERS[i - 1]
            prevnext += f'<span><a href="{pslug}.html">← {ptitle}</a></span>'
        if i < len(CHAPTERS) - 1:
            nslug, ntitle = CHAPTERS[i + 1]
            prevnext += f'<span class="next"><a href="{nslug}.html">{ntitle} →</a></span>'
        prevnext += "</div>"
        html = TEMPLATE.format(
            title=title, root="../", nav=nav_html(slug, "../"), body=body, prevnext=prevnext
        )
        (OUT / "chapters" / f"{slug}.html").write_text(html, encoding="utf-8")

    cards = "\n".join(
        f'<a class="card" href="chapters/{slug}.html"><span class="t">{title}</span></a>'
        for slug, title in CHAPTERS
    )
    home = TEMPLATE.format(
        title="首页", root="", nav=nav_html("", ""), body=HOME_BODY.format(cards=cards), prevnext=""
    )
    (OUT / "index.html").write_text(home, encoding="utf-8")
    print(f"built {len(CHAPTERS)} chapters + index into {OUT}")


if __name__ == "__main__":
    main()
