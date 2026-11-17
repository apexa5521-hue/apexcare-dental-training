'use strict';
// Notifications bell + panel (approved design, round 2 · screen 8) and toast alerts.
// window.nseMountNotifications({request, post, center, language}) — mounted after each center load.
// window.nseToast({type:'success'|'info'|'warning'|'error', title, body, action:{label,onClick}})
(() => {
  const KINDS = {
    learning_plan: { cat: 'tasks', glyph: '✓', tone: 'ok', ar: 'خطة تطوير جديدة', en: 'New learning plan' },
    support_plan: { cat: 'tasks', glyph: '!', tone: 'warn', ar: 'خطة دعم من المشرفة', en: 'Support plan from your supervisor' },
    training_reminder: { cat: 'tasks', glyph: '⏰', tone: 'info', ar: 'تذكير بخطوة اليوم', en: "Today's step reminder" },
    plan_completed: { cat: 'results', glyph: '★', tone: 'ok', ar: 'اكتملت خطوات الخطة', en: 'Plan steps completed' },
    certificate_revoked: { cat: 'results', glyph: '✕', tone: 'bad', ar: 'تم إلغاء بطاقة', en: 'A card was revoked' }
  };
  const kindOf = k => KINDS[String(k).replace(/_\d{4}-\d{2}-\d{2}$/, '')] || { cat: 'content', glyph: 'i', tone: 'info', ar: 'إشعار', en: 'Notification' };
  const TONES = { ok: ['#e3f6ee', '#0b6a4a'], warn: ['#fff2d9', '#8a5200'], info: ['#e4eefc', '#1d4f9a'], bad: ['#fde8e8', '#a12a2a'] };

  const css = `
.nse-bell{position:relative;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;border:1px solid var(--nse-line);background:var(--nse-surface);color:var(--nse-ink);cursor:pointer}
.nse-bell:focus-visible{outline:2px solid var(--nse-green);outline-offset:2px}
.nse-bell .badge{position:absolute;top:-5px;inset-inline-end:-5px;min-width:20px;height:20px;padding:0 5px;box-sizing:border-box;border-radius:99px;background:var(--nse-accent,#ffb020);color:#3a2400;font:700 11px/20px Inter,sans-serif;text-align:center;border:2px solid var(--nse-surface)}
.nse-bell .badge[hidden]{display:none}
.nse-notes{position:fixed;z-index:300;top:72px;inset-inline-end:24px;width:min(440px,calc(100vw - 32px));max-height:min(620px,calc(100dvh - 96px));display:flex;flex-direction:column;background:var(--nse-surface);color:var(--nse-ink);border:1px solid var(--nse-line);border-radius:22px;box-shadow:0 22px 50px #0b231a2e;overflow:hidden}
.nse-notes[hidden]{display:none}
.nse-notes header{display:flex;align-items:center;gap:10px;padding:16px 18px 10px}
.nse-notes header h2{margin:0;font-size:18px;flex:1}
.nse-notes .count{font:700 12px Inter,sans-serif;background:var(--nse-green);color:var(--nse-surface);padding:3px 9px;border-radius:99px}
.nse-notes .link{border:0;background:none;color:var(--nse-green);font:inherit;font-weight:700;font-size:13px;cursor:pointer;padding:8px}
.nse-notes .filters{display:flex;gap:6px;padding:0 18px 10px;overflow-x:auto}
.nse-notes .filters button{flex:0 0 auto;height:34px;padding:0 14px;border-radius:99px;border:1px solid var(--nse-line);background:var(--nse-surface);color:var(--nse-muted);font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.nse-notes .filters button[aria-selected=true]{background:var(--nse-ink);border-color:var(--nse-ink);color:var(--nse-surface)}
.nse-notes .list{overflow-y:auto;flex:1}
.nse-notes .day{display:block;padding:10px 18px 4px;font-size:12px;font-weight:700;color:var(--nse-muted)}
.nse-notes .item{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:start;padding:12px 18px;border:0;border-top:1px solid var(--nse-line);background:var(--nse-surface);color:inherit;font:inherit;cursor:pointer}
.nse-notes .item.unread{background:color-mix(in srgb,var(--nse-green) 7%,var(--nse-surface))}
.nse-notes .ico{width:40px;height:40px;flex:0 0 40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px}
.nse-notes .txt{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.nse-notes .txt strong{font-size:14px}
.nse-notes .txt span{font-size:13px;line-height:1.6;color:var(--nse-muted)}
.nse-notes .txt small{font-size:11px;color:var(--nse-muted)}
.nse-notes .dot{width:9px;height:9px;flex:0 0 9px;margin-top:6px;border-radius:50%;background:var(--nse-green)}
.nse-notes .empty{padding:40px 24px;text-align:center;color:var(--nse-muted);font-size:14px}
.nse-toasts{position:fixed;z-index:400;top:16px;left:50%;transform:translateX(-50%);display:grid;gap:10px;width:min(460px,calc(100vw - 32px));pointer-events:none}
.nse-toast{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:16px;background:var(--nse-surface);color:var(--nse-ink);border:1px solid var(--nse-line);box-shadow:0 12px 28px #0b231a24;animation:nseToastIn .25s ease-out}
.nse-toast .ico{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700}
.nse-toast .txt{flex:1;min-width:0}.nse-toast .txt strong{display:block;font-size:14px}.nse-toast .txt span{font-size:13px;color:var(--nse-muted)}
.nse-toast button{border:0;background:none;color:var(--nse-green);font:inherit;font-weight:700;font-size:13px;cursor:pointer;padding:6px}
@keyframes nseToastIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.nse-toast{animation:none}}
@media(max-width:760px){.nse-notes{top:auto;bottom:0;inset-inline:0;width:100%;max-height:85dvh;border-radius:22px 22px 0 0}}`;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);

  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const toneIcon = (tone, glyph, cls = 'ico') => { const [bg, fg] = TONES[tone] || TONES.info; const i = mk('span', cls, glyph); i.style.background = bg; i.style.color = fg; i.setAttribute('aria-hidden', 'true'); return i; };

  let toastHost;
  window.nseToast = ({ type = 'info', title, body, action, timeout = 5000 } = {}) => {
    if (!toastHost) { toastHost = mk('div', 'nse-toasts'); toastHost.setAttribute('aria-live', 'polite'); document.body.append(toastHost); }
    const tone = { success: 'ok', info: 'info', warning: 'warn', error: 'bad' }[type] || 'info';
    const t = mk('div', 'nse-toast'); t.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const txt = mk('div', 'txt'); txt.append(mk('strong', '', title || '')); if (body) txt.append(mk('span', '', body));
    t.append(toneIcon(tone, { ok: '✓', info: 'i', warn: '!', bad: '✕' }[tone]), txt);
    if (action) { const b = mk('button', '', action.label); b.type = 'button'; b.onclick = () => { action.onClick?.(); t.remove(); }; t.append(b); }
    toastHost.append(t); setTimeout(() => t.remove(), timeout);
    return t;
  };

  let state = { items: [], filter: 'all', open: false }, ctx = null, bell, badge, panel;
  const ar = () => (ctx?.language?.() || 'en') === 'ar';
  const L = (a, e) => ar() ? a : e;
  const dayLabel = d => {
    const riyadh = x => new Date(x).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
    const today = riyadh(Date.now()), yest = riyadh(Date.now() - 864e5), k = riyadh(d);
    return k === today ? L('اليوم', 'Today') : k === yest ? L('أمس', 'Yesterday') : L('سابقًا', 'Earlier');
  };
  const timeLabel = d => new Date(d).toLocaleString(ar() ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });

  function paint() {
    const unread = state.items.filter(n => !n.read_at).length;
    badge.textContent = unread > 9 ? '9+' : String(unread); badge.hidden = !unread;
    bell.setAttribute('aria-label', L('الإشعارات', 'Notifications') + (unread ? ' · ' + unread + ' ' + L('غير مقروءة', 'unread') : ''));
    if (!state.open) return;
    const head = mk('header'); head.append(mk('h2', '', L('الإشعارات', 'Notifications')));
    if (unread) head.append(mk('span', 'count', String(unread)));
    const all = mk('button', 'link', L('تحديد الكل كمقروء', 'Mark all read')); all.type = 'button'; all.disabled = !unread;
    all.onclick = async () => { try { await ctx.post('/api/notifications/read-all', {}); state.items = state.items.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })); paint(); } catch (e) { window.nseToast({ type: 'error', title: L('ما تم التحديث', 'Could not update'), body: e.message }); } };
    const close = mk('button', 'link', '✕'); close.type = 'button'; close.setAttribute('aria-label', L('إغلاق', 'Close')); close.onclick = () => toggle(false);
    head.append(all, close);
    const filters = mk('div', 'filters'); filters.setAttribute('role', 'tablist');
    [['all', 'الكل', 'All'], ['tasks', 'مهامي', 'My tasks'], ['results', 'النتائج', 'Results'], ['content', 'المحتوى', 'Content']].forEach(([id, a, e]) => {
      const b = mk('button', '', L(a, e)); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(state.filter === id));
      b.onclick = () => { state.filter = id; paint(); }; filters.append(b);
    });
    const list = mk('div', 'list');
    const shown = state.items.filter(n => state.filter === 'all' || kindOf(n.kind).cat === state.filter);
    if (!shown.length) list.append(mk('p', 'empty', L('ما فيه إشعارات هنا. بنبلغك أول ما يصير شي جديد.', "Nothing here yet. We'll let you know when something new arrives.")));
    let last = null;
    shown.forEach(n => {
      const k = kindOf(n.kind), d = dayLabel(n.created_at);
      if (d !== last) { list.append(mk('span', 'day', d)); last = d; }
      const item = mk('button', 'item' + (n.read_at ? '' : ' unread')); item.type = 'button';
      const txt = mk('span', 'txt'); txt.append(mk('strong', '', L(k.ar, k.en)));
      const b = mk('span', '', n.body); b.lang = 'en'; b.dir = 'auto'; txt.append(b, mk('small', '', timeLabel(n.created_at)));
      item.append(toneIcon(k.tone, k.glyph), txt);
      if (!n.read_at) item.append(mk('span', 'dot'));
      item.onclick = async () => { if (n.read_at) return; try { await ctx.post('/api/notifications/read', { id: n.id }); n.read_at = new Date().toISOString(); paint(); } catch {} };
      list.append(item);
    });
    panel.replaceChildren(head, filters, list);
  }
  function toggle(open = !state.open) {
    state.open = open; panel.hidden = !open; bell.setAttribute('aria-expanded', String(open));
    if (open) { paint(); refresh(); panel.querySelector('button')?.focus(); } else bell.focus();
  }
  async function refresh() {
    if (!ctx) return;
    try { const r = await ctx.request('/api/notifications?centerId=' + encodeURIComponent(ctx.center())); state.items = r.notifications || []; paint(); } catch {}
  }
  window.nseMountNotifications = c => {
    ctx = c;
    if (!bell) {
      bell = mk('button', 'nse-bell'); bell.type = 'button'; bell.setAttribute('aria-haspopup', 'dialog'); bell.setAttribute('aria-expanded', 'false');
      bell.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9M10 20a2 2 0 0 0 4 0"/></svg>';
      badge = mk('span', 'badge'); badge.hidden = true; bell.append(badge);
      bell.onclick = () => toggle();
      panel = mk('section', 'nse-notes'); panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notifications');
      document.body.append(panel);
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) toggle(false); });
      document.addEventListener('click', e => { if (state.open && e.target.isConnected && !panel.contains(e.target) && !bell.contains(e.target)) toggle(false); });
      const controls = document.querySelector('.controls');
      controls ? controls.prepend(bell) : document.body.append(bell);
      setInterval(() => { if (!document.hidden) refresh(); }, 120000);
    }
    state.items = c.initial || []; paint(); refresh();
  };
})();
