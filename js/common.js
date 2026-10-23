const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const qs = k => new URLSearchParams(location.search).get(k);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => Number(n || 0).toLocaleString('vi-VN') + 'đ';
const fmtDate = s => s ? s.split('-').reverse().join('/') : '';
const formData = f => Object.fromEntries(new FormData(f));
const IMG = { room: 'public/images/room.webp', pool: 'public/images/pool.webp', spa: 'public/images/spa.webp' };

const STATUS = {
  pending: 'Chờ duyệt', confirmed: 'Đã xác nhận', checked_in: 'Đang ở', checked_out: 'Đã trả phòng', cancelled: 'Đã hủy',
  available: 'Trống', occupied: 'Đang sử dụng', maintenance: 'Bảo trì',
};
const PAYMENT = { cash: 'Tiền mặt tại quầy', transfer: 'Chuyển khoản' };
const ROLE = { customer: 'Khách hàng', receptionist: 'Lễ tân', admin: 'Quản trị' };
const badge = s => `<span class="badge ${s}">${STATUS[s] || esc(s)}</span>`;

const img = (src, alt, cls = '') => `<img class="${cls}" src="${esc(src || IMG.room)}" alt="${esc(alt)}" loading="lazy">`;
const field = (label, control) => `<label class="field"><span>${label}</span>${control}</label>`;

const typeCard = (t, query = '') => `<article class="room-card">${img(t.image, 'Phòng ' + t.name)}
  <div class="room-card-body"><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p>
  <div class="card-bottom"><span><b>${money(t.price)}</b>/đêm<br><small>Tối đa ${t.capacity} khách${t.available ? `, còn ${t.available} phòng` : ''}</small></span>
  ${t.available === 0 ? '<span class="badge cancelled">Hết phòng</span>' : `<a class="text-link" href="rooms.html?id=${t.id}${query}">Xem phòng</a>`}</div></div></article>`;

const searchFields = (max = 10) =>
  field('Nhận phòng', '<input type="date" name="checkIn" required>') +
  field('Trả phòng', '<input type="date" name="checkOut" required>') +
  field('Số khách', `<input type="number" name="guests" min="1" max="${max}" value="2" required>`);

function initDateRange(a, b) {
  a.min = isoDate();
  a.value = qs('checkIn') >= a.min ? qs('checkIn') : a.min;
  b.value = qs('checkOut') || '';
  const sync = () => { b.min = isoDate(1, a.value); if (!b.value || b.value < b.min) b.value = b.min; };
  sync();
  a.addEventListener('change', sync);
}

function toast(msg, type = '') {
  const el = $('#toast') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast' }));
  el.setAttribute('role', 'status');
  el.textContent = msg; el.className = 'show ' + type;
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

async function run(fn) {
  try { return await fn(); } catch (e) { toast(e.message, 'danger'); }
}

function requireRole(...roles) {
  const u = API.currentUser();
  if (!u || !roles.includes(u.role)) {
    location.replace('login.html?next=' + encodeURIComponent(location.pathname.split('/').pop()) + '#login');
    throw new Error('Không có quyền truy cập');
  }
  return u;
}

function setupTabs(onShow) {
  const panels = $$('[data-panel]');
  const show = () => {
    const h = location.hash.slice(1), name = panels.some(p => p.dataset.panel === h) ? h : panels[0].dataset.panel;
    panels.forEach(p => p.hidden = p.dataset.panel !== name);
    $$('[data-tab]').forEach(a => a.classList.toggle('active', a.dataset.tab === name));
    const link = $(`[data-tab="${name}"]`);
    if (link) document.title = `${link.textContent} · SOLENA`;
    onShow(name);
  };
  addEventListener('hashchange', show);
  show();
}

const logout = () => { API.logout(); location.href = 'index.html'; };
const here = location.pathname.split('/').pop() || 'index.html';

function renderSite() {
  const u = API.currentUser();
  const nav = [['index.html', 'Trang chủ'], ['rooms.html', 'Phòng nghỉ'], ['booking.html', 'Đặt phòng']];
  if (u?.role === 'customer') nav.push(['account.html', 'Đơn của tôi']);
  nav.push([u && u.role !== 'customer' ? (u.role === 'admin' ? 'admin.html' : 'staff.html') : 'login.html?next=staff.html#login', 'Quản lý khách sạn']);
  $('#site-header').innerHTML = `<a class="brand" href="index.html" aria-label="SOLENA trang chủ">SOLENA<span>RESORT</span></a>
    <nav class="site-nav" aria-label="Điều hướng">${nav.map(([h, t]) => `<a href="${h}" class="${h === here ? 'active' : ''}">${t}</a>`).join('')}</nav>
    <div class="header-actions">${u
      ? `<a class="text-link" href="${u.role === 'customer' ? 'account.html' : 'staff.html'}">${esc(u.name)}</a><button class="ghost small" id="logout">Đăng xuất</button>`
      : '<a class="ghost small" href="login.html#login">Đăng nhập</a>'}
      <a class="btn small" href="rooms.html">Đặt phòng</a>
      <button class="menu-toggle" id="menu" aria-label="Mở menu" aria-expanded="false">☰</button></div>`;
  $('#logout')?.addEventListener('click', logout);
  $('#menu').onclick = e => e.currentTarget.setAttribute('aria-expanded', $('.site-nav').classList.toggle('open'));
  $('#site-footer').innerHTML = `<div><strong>SOLENA</strong><span>RESORT</span>
    <p>86 Trần Phú, Lộc Thọ, Nha Trang<br>0258 3888 999 – datphong@solena.vn</p></div>
    <div><a href="rooms.html">Phòng nghỉ</a><a href="account.html">Đơn của tôi</a><a href="staff.html">Dành cho nhân viên</a></div>`;
}

const sub = (panel, text) => { const p = $(`[data-panel="${panel}"] .manager-heading p`); if (p) p.textContent = text; };

const MANAGER_NAV = [
  ['Lễ tân', 'receptionist', [['staff.html', 'bookings', 'Đơn đặt phòng'], ['staff.html', 'checkin', 'Nhận phòng'], ['staff.html', 'inhouse', 'Khách đang ở']]],
  ['Quản trị', 'admin', [['admin.html', 'stats', 'Báo cáo'], ['admin.html', 'types', 'Loại phòng'], ['admin.html', 'rooms', 'Phòng'], ['admin.html', 'staff', 'Nhân sự'], ['admin.html', 'customers', 'Khách hàng']]],
];
function renderManager(u) {
  const groups = MANAGER_NAV.filter(([, role]) => u.role === 'admin' || role === u.role);
  const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  $('.sidebar').innerHTML = `<a href="${groups[0][2][0][0]}" class="brand">SOLENA<span>MANAGEMENT</span></a>
    <nav aria-label="Điều hướng quản lý">${groups.map(([title, , links]) => `<span class="eyebrow">${title}</span>` +
      links.map(([page, tab, text]) => `<a href="${page === here ? '' : page}#${tab}" data-tab="${page === here ? tab : ''}">${text}</a>`).join('')).join('')}</nav>
    <div class="sidebar-foot"><b>${esc(u.name)}</b><span>${ROLE[u.role]}</span><button class="ghost small" data-logout>Đăng xuất</button></div>`;
  $('.manager-main').insertAdjacentHTML('afterbegin', `<div class="manager-top"><span>${today[0].toUpperCase() + today.slice(1)}</span>
    <div><a href="index.html" class="ghost small">Phía khách hàng</a><button class="ghost small" data-logout>Đăng xuất</button></div></div>`);
  $$('[data-logout]').forEach(b => b.onclick = logout);
}

if ($('#site-header')) renderSite();
