import { requireUser } from '@/features/auth/server/session';
import { db } from '@/infrastructure/database/client';
export default async function Page() {
  await requireUser(true);
  const { rows } = await db.query('SELECT a.*,u.email FROM audit_logs a LEFT JOIN users u ON a.actor_id=u.id ORDER BY a.id DESC LIMIT 100');
  return <>
    <h1>审计日志</h1>
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>操作者</th>
            <th>动作</th>
            <th>对象</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => <tr key={r.id}>
            <td>
              {r.created_at.toISOString()}
            </td>
            <td>
              {r.email}
            </td>
            <td>
              {r.action}
            </td>
            <td>
              {r.target}
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </>;
}
