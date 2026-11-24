'use strict';
// In-app notifications for the signed-in learner: list with unread count, mark one or all read.
// Only the caller's own notifications in the current center are ever read or changed.
module.exports = async ({ req, url, body, c, userId, centerId, mustUUID, deny }) => {
  const route = url.pathname;
  if (req.method === 'GET' && route === '/api/notifications') {
    const rows = await c.query('select id,kind,body,read_at,created_at from qib.notifications where center_id=$1 and user_id=$2 order by created_at desc limit 50', [centerId, userId]);
    return { handled: true, data: { notifications: rows.rows, unread: rows.rows.filter(n => !n.read_at).length } };
  }
  if (req.method === 'POST' && route === '/api/notifications/read-all') {
    const r = await c.query('update qib.notifications set read_at=now() where center_id=$1 and user_id=$2 and read_at is null returning id', [centerId, userId]);
    return { handled: true, data: { marked: r.rowCount } };
  }
  return { handled: false };
};
