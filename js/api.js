function isoDate(offset = 0, from) {
  const d = from ? new Date(from + 'T00:00') : new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv');
}
function nights(a, b) { return Math.max(1, Math.round((new Date(b) - new Date(a)) / 864e5)); }

const API = (() => {
  const DB_KEY = 'hotel_db_v2', SESSION_KEY = 'hotel_session';
  const ACTIVE = ['pending', 'confirmed', 'checked_in'];

  function seed() {
    const roomTypes = [
      { id: 't1', name: 'Standard', price: 600000, capacity: 2, image: 'public/images/room.webp', amenities: ['Wi-Fi', 'Điều hòa', 'TV', 'Nước nóng'], description: 'Phòng tiêu chuẩn 22m², giường đôi, cửa sổ hướng phố. Phù hợp cho cặp đôi hoặc khách công tác.' },
      { id: 't2', name: 'Deluxe', price: 950000, capacity: 3, image: 'public/images/family-room.png', amenities: ['Wi-Fi', 'Điều hòa', 'Smart TV', 'Minibar', 'Bồn tắm'], description: 'Phòng 30m² với ban công riêng, 1 giường đôi + 1 giường đơn, nội thất gỗ ấm cúng.' },
      { id: 't3', name: 'VIP', price: 1600000, capacity: 4, image: 'public/images/ocean-suite.png', amenities: ['Wi-Fi', 'Điều hòa', 'Smart TV', 'Minibar', 'Bồn tắm', 'View biển', 'Ăn sáng'], description: 'Phòng 42m² view biển toàn cảnh, 2 giường đôi lớn, bao gồm bữa sáng buffet.' },
      { id: 't4', name: 'Suite', price: 2800000, capacity: 4, image: 'public/images/sky-suite.png', amenities: ['Wi-Fi', 'Phòng khách riêng', 'Bếp nhỏ', 'Bồn sục', 'View biển', 'Ăn sáng', 'Đưa đón sân bay'], description: 'Căn suite 65m² gồm phòng ngủ và phòng khách riêng biệt, dịch vụ quản gia 24/7.' },
    ];
    const typeOf = n => n < 200 ? 't1' : n < 300 ? 't2' : n < 400 ? 't3' : 't4';
    const rooms = [101, 102, 103, 104, 201, 202, 203, 301, 302, 401].map(n => ({
      id: 'r' + n, number: String(n), typeId: typeOf(n), status: n === 201 ? 'occupied' : n === 302 ? 'maintenance' : 'available',
    }));
    const users = [
      { id: 'u1', name: 'Quản trị viên', email: 'admin@solena.vn', phone: '0900000001', password: 'admin123', role: 'admin' },
      { id: 'u2', name: 'Nguyễn Lễ Tân', email: 'letan@solena.vn', phone: '0900000002', password: '123456', role: 'receptionist' },
      { id: 'u3', name: 'Trần Văn Khách', email: 'khach@gmail.com', phone: '0912345678', password: '123456', role: 'customer' },
      { id: 'u4', name: 'Lê Thị Hoa', email: 'hoa@gmail.com', phone: '0987654321', password: '123456', role: 'customer' },
    ];
    const bk = (id, user, guest, typeId, from, to, status, extra = {}) => {
      const checkIn = isoDate(from), checkOut = isoDate(to);
      return {
        id, customerId: user?.id || null, guest: user ? { name: user.name, phone: user.phone, email: user.email } : guest,
        typeId, roomId: null, checkIn, checkOut, guests: 2, payment: 'cash', note: '', status, services: [],
        roomTotal: nights(checkIn, checkOut) * roomTypes.find(t => t.id === typeId).price,
        createdAt: isoDate(from - 3), paidAt: status === 'checked_out' ? checkOut : null, ...extra,
      };
    };
    const bookings = [
      bk('BK1001', users[2], null, 't1', -400, -398, 'checked_out', { roomId: 'r101' }),
      bk('BK1002', users[3], null, 't3', -45, -43, 'checked_out', { roomId: 'r301', payment: 'transfer', services: [{ name: 'Ăn sáng', price: 120000, qty: 4 }] }),
      bk('BK1003', users[2], null, 't1', -20, -18, 'checked_out', { roomId: 'r102', services: [{ name: 'Nước suối', price: 15000, qty: 2 }] }),
      bk('BK1004', null, { name: 'Phạm Minh Tuấn', phone: '0933111222', email: '' }, 't2', -5, -3, 'checked_out', { roomId: 'r202' }),
      bk('BK1005', users[2], null, 't2', -1, 2, 'checked_in', { roomId: 'r201', services: [{ name: 'Giặt ủi', price: 50000, qty: 1 }] }),
      bk('BK1006', null, { name: 'Đỗ Thu Trang', phone: '0977000111', email: 'trang@gmail.com' }, 't4', 0, 2, 'confirmed', { payment: 'transfer' }),
      bk('BK1007', users[3], null, 't1', 3, 5, 'pending'),
    ];
    const services = [
      { id: 's1', name: 'Nước suối', price: 15000 }, { id: 's2', name: 'Bia', price: 30000 }, { id: 's3', name: 'Nước ngọt', price: 25000 },
      { id: 's4', name: 'Giặt ủi', price: 50000 }, { id: 's5', name: 'Ăn sáng', price: 120000 }, { id: 's6', name: 'Minibar', price: 80000 },
    ];
    return { roomTypes, rooms, users, bookings, services, seq: 1008 };
  }

  let db;
  try { db = JSON.parse(localStorage.getItem(DB_KEY)); } catch { }
  db ||= seed();
  const save = () => localStorage.setItem(DB_KEY, JSON.stringify(db));
  const ok = v => Promise.resolve(v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const fail = msg => Promise.reject(new Error(msg));
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const pub = ({ password, ...u }) => u;
  const bill = b => b.roomTotal + b.services.reduce((s, x) => s + x.price * x.qty, 0);
  const full = b => ({
    ...b, total: bill(b),
    typeName: db.roomTypes.find(t => t.id === b.typeId)?.name || '—',
    roomNumber: db.rooms.find(r => r.id === b.roomId)?.number || null,
  });
  const findBooking = id => db.bookings.find(b => b.id === id);
  const freeCount = (typeId, from, to) =>
    db.rooms.filter(r => r.typeId === typeId && r.status !== 'maintenance').length -
    db.bookings.filter(b => b.typeId === typeId && ACTIVE.includes(b.status) && b.checkIn < to && from < b.checkOut).length;
  const currentUser = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } };
  const login = (email, password) => {
    const u = db.users.find(x => x.email.toLowerCase() === email.trim().toLowerCase() && x.password === password);
    if (!u) return fail('Email hoặc mật khẩu không đúng');
    localStorage.setItem(SESSION_KEY, JSON.stringify(pub(u)));
    return ok(pub(u));
  };

  return {
    login,
    register(d) {
      if (db.users.some(x => x.email.toLowerCase() === d.email.trim().toLowerCase())) return fail('Email đã được sử dụng');
      db.users.push({ id: newId('u'), name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), password: d.password, role: 'customer' });
      save();
      return login(d.email, d.password);
    },
    logout() { localStorage.removeItem(SESSION_KEY); },
    currentUser,

    getRoomTypes: () => ok(db.roomTypes),
    searchAvailable({ checkIn, checkOut, guests = 1 }) {
      if (!(checkOut > checkIn)) return fail('Ngày trả phòng phải sau ngày nhận phòng');
      return ok(db.roomTypes.filter(t => t.capacity >= guests).map(t => ({ ...t, available: Math.max(0, freeCount(t.id, checkIn, checkOut)) })));
    },
    saveRoomType(t) {
      const data = { name: t.name.trim(), price: +t.price, capacity: +t.capacity, image: t.image || '', amenities: t.amenities || [], description: t.description || '' };
      if (t.id) Object.assign(db.roomTypes.find(x => x.id === t.id), data); else db.roomTypes.push({ id: newId('t'), ...data });
      save(); return ok();
    },
    deleteRoomType(id) {
      if (db.rooms.some(r => r.typeId === id)) return fail('Còn phòng thuộc loại này, hãy xóa hoặc chuyển phòng trước');
      db.roomTypes = db.roomTypes.filter(t => t.id !== id); save(); return ok();
    },

    getRooms: () => ok(db.rooms.map(r => ({ ...r, typeName: db.roomTypes.find(t => t.id === r.typeId)?.name || '—' }))),
    saveRoom(r) {
      const number = r.number.trim(), cur = db.rooms.find(x => x.id === r.id);
      if (db.rooms.some(x => x.number === number && x.id !== r.id)) return fail('Số phòng đã tồn tại');
      const data = { number, typeId: r.typeId, status: cur?.status === 'occupied' ? 'occupied' : r.status || 'available' };
      if (cur) Object.assign(cur, data); else db.rooms.push({ id: newId('r'), ...data });
      save(); return ok();
    },
    deleteRoom(id) {
      if (db.rooms.find(r => r.id === id)?.status === 'occupied') return fail('Phòng đang có khách, không thể xóa');
      db.rooms = db.rooms.filter(r => r.id !== id); save(); return ok();
    },

    createBooking(d) {
      const t = db.roomTypes.find(x => x.id === d.typeId);
      if (!t) return fail('Loại phòng không tồn tại');
      if (d.checkIn < isoDate()) return fail('Ngày nhận phòng không được ở quá khứ');
      if (!(d.checkOut > d.checkIn)) return fail('Ngày trả phòng phải sau ngày nhận phòng');
      if (+d.guests > t.capacity) return fail(`Loại phòng này tối đa ${t.capacity} người`);
      if (!['cash', 'transfer'].includes(d.payment)) return fail('Phương thức thanh toán không hợp lệ');
      if (freeCount(t.id, d.checkIn, d.checkOut) <= 0) return fail('Đã hết phòng trong khoảng ngày bạn chọn');
      const u = currentUser();
      const b = {
        id: 'BK' + db.seq++, customerId: u?.role === 'customer' ? u.id : null,
        guest: { name: d.name.trim(), phone: d.phone.trim(), email: (d.email || '').trim() },
        typeId: t.id, roomId: null, checkIn: d.checkIn, checkOut: d.checkOut, guests: +d.guests, payment: d.payment,
        note: d.note || '', status: 'pending', services: [], roomTotal: nights(d.checkIn, d.checkOut) * t.price,
        createdAt: isoDate(), paidAt: null,
      };
      db.bookings.push(b); save();
      return ok(full(b));
    },
    getBookings: () => ok(db.bookings.map(full).reverse()),
    myBookings: () => ok(db.bookings.filter(b => b.customerId === currentUser()?.id).map(full).reverse()),
    confirmBooking(id) {
      const b = findBooking(id);
      if (b?.status !== 'pending') return fail('Chỉ duyệt được đơn đang chờ');
      b.status = 'confirmed'; save(); return ok();
    },
    cancelBooking(id) {
      const b = findBooking(id);
      if (!['pending', 'confirmed'].includes(b?.status)) return fail('Không thể hủy đơn này');
      b.status = 'cancelled'; save(); return ok();
    },
    checkIn(id, roomId) {
      const b = findBooking(id), r = db.rooms.find(x => x.id === roomId);
      if (b?.status !== 'confirmed') return fail('Đơn chưa được xác nhận');
      if (!r || r.typeId !== b.typeId || r.status !== 'available') return fail('Phòng không hợp lệ hoặc không trống');
      Object.assign(b, { roomId, status: 'checked_in' }); r.status = 'occupied';
      save(); return ok();
    },
    addService(id, s) {
      const b = findBooking(id);
      if (b?.status !== 'checked_in') return fail('Khách không còn ở trong phòng');
      b.services.push({ name: s.name.trim(), price: +s.price, qty: +s.qty || 1 });
      save(); return ok(full(b));
    },
    removeService(id, i) {
      const b = findBooking(id);
      if (b?.status !== 'checked_in') return fail('Không thể sửa hóa đơn đã chốt');
      b.services.splice(+i, 1); save(); return ok(full(b));
    },
    checkOut(id) {
      const b = findBooking(id);
      if (b?.status !== 'checked_in') return fail('Đơn không ở trạng thái đang ở');
      Object.assign(b, { status: 'checked_out', paidAt: isoDate() });
      const r = db.rooms.find(x => x.id === b.roomId);
      if (r) r.status = 'available';
      save(); return ok(full(b));
    },
    getServices: () => ok(db.services),

    getUsers: role => ok(db.users.filter(u => !role || u.role === role).map(pub)),
    saveUser(u) {
      const email = u.email.trim().toLowerCase(), cur = db.users.find(x => x.id === u.id);
      if (db.users.some(x => x.email.toLowerCase() === email && x.id !== u.id)) return fail('Email đã được sử dụng');
      if (!cur && !u.password) return fail('Cần nhập mật khẩu cho tài khoản mới');
      const data = { name: u.name.trim(), email, phone: (u.phone || '').trim(), role: u.role, ...(u.password ? { password: u.password } : {}) };
      if (cur) Object.assign(cur, data); else db.users.push({ id: newId('u'), ...data });
      save(); return ok();
    },
    deleteUser(id) {
      if (id === currentUser()?.id) return fail('Không thể xóa tài khoản đang đăng nhập');
      db.users = db.users.filter(u => u.id !== id); save(); return ok();
    },

    revenue(period) {
      const len = { day: 10, month: 7, year: 4 }[period], map = {};
      db.bookings.filter(b => b.status === 'checked_out').forEach(b => {
        const k = b.paidAt.slice(0, len);
        map[k] = (map[k] || 0) + bill(b);
      });
      return ok(Object.entries(map).sort().map(([label, total]) => ({ label, total })));
    },
    roomStats() {
      const c = { total: db.rooms.length, available: 0, occupied: 0, maintenance: 0 };
      db.rooms.forEach(r => c[r.status]++);
      return ok(c);
    },
  };
})();
