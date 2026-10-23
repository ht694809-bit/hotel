# Hướng dẫn nối backend PHP (XAMPP + MySQL)

Frontend gọi dữ liệu **chỉ qua một file: `js/api.js`**. Các trang HTML không gọi `fetch` trực tiếp.
Hiện `api.js` chạy bằng dữ liệu giả (localStorage). Muốn nối backend PHP thì:

- **Backend:** làm API PHP trả JSON theo bảng endpoint ở Bước 6.
- **Frontend:** viết lại thân các hàm trong `api.js` bằng `fetch`, **giữ nguyên tên hàm, tham số và dữ liệu trả về**.
  Các trang HTML không phải sửa.

Hướng dẫn này viết cho PHP thuần (không framework), chạy trên XAMPP (PHP 8.0, MySQL/MariaDB).

> **Khung đã có sẵn trong repo:** `database.sql` (bảng + dữ liệu mẫu), `api/.htaccess`, `api/db.php`,
> `api/index.php` (đã chạy được đăng nhập/đăng ký/đăng xuất, xem phòng, phòng trống, danh sách đơn, duyệt đơn).
> Thông tin kết nối DB nằm ở `api/config.php` (chép từ `api/config.example.php`, không commit).
> Bước 1–5 dưới đây giải thích các file đó. Việc tiếp theo là làm nốt các endpoint ở Bước 6.

---

## Bước 1. Cấu trúc thư mục

Đặt frontend và API chung một thư mục trong `htdocs`, để cùng domain (không phải xử lý CORS, session tự chạy):

```
C:\xampp\htdocs\hotel\
├── index.html, rooms.html, booking.html, login.html, account.html, staff.html, admin.html
├── css\  js\  public\                ← frontend (đã có)
└── api\                              ← backend PHP
    ├── .htaccess
    ├── db.php
    └── index.php                     ← nhận mọi request /api/...
```

Mở web tại `http://localhost/hotel/`. API nằm ở `http://localhost/hotel/api/...`.

## Bước 2. Tạo database

Vào phpMyAdmin (`http://localhost/phpmyadmin`), tab SQL, chạy:

```sql
CREATE DATABASE hotel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,                 -- lưu password_hash(), không lưu mật khẩu gốc
  role ENUM('customer','receptionist','admin') NOT NULL DEFAULT 'customer'
);

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,                             -- VNĐ, dùng INT (DECIMAL sẽ ra chuỗi)
  capacity INT NOT NULL,
  image VARCHAR(255),
  amenities TEXT,                                 -- JSON: ["Wi-Fi","Điều hòa"]
  description TEXT
);

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  number VARCHAR(10) NOT NULL UNIQUE,
  type_id INT NOT NULL,
  status ENUM('available','occupied','maintenance') NOT NULL DEFAULT 'available',
  FOREIGN KEY (type_id) REFERENCES room_types(id)
);

CREATE TABLE services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL
);

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NULL,                           -- NULL = khách vãng lai không đăng nhập
  guest_name VARCHAR(100) NOT NULL,
  guest_phone VARCHAR(20) NOT NULL,
  guest_email VARCHAR(150),
  type_id INT NOT NULL,
  room_id INT NULL,                               -- gán khi check-in
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  payment ENUM('cash','transfer') NOT NULL,       -- tiền mặt tại quầy / chuyển khoản
  note VARCHAR(250),
  status ENUM('pending','confirmed','checked_in','checked_out','cancelled') NOT NULL DEFAULT 'pending',
  room_total INT NOT NULL,
  created_at DATE NOT NULL,                       -- dùng DATE, frontend đọc dạng YYYY-MM-DD
  paid_at DATE NULL,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  FOREIGN KEY (type_id) REFERENCES room_types(id),
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE TABLE booking_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  qty INT NOT NULL DEFAULT 1,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);
```

**Tạo tài khoản admin đầu tiên:** mở CMD, chạy lệnh sau để lấy chuỗi mật khẩu đã mã hóa:

```
C:\xampp\php\php.exe -r "echo password_hash('admin123', PASSWORD_DEFAULT);"
```

Rồi chèn vào bảng: `INSERT INTO users (name,email,phone,password,role) VALUES ('Quản trị viên','admin@solena.vn','0900000001','<chuỗi vừa in ra>','admin');`

Dữ liệu mẫu cho phòng, loại phòng, dịch vụ có thể lấy theo hàm `seed()` trong `js/api.js`.

## Bước 3. Chuyển mọi request `/api/...` về `index.php`

`api/.htaccess` (XAMPP đã bật sẵn `mod_rewrite` và `AllowOverride All` cho `htdocs`):

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^(.*)$ index.php?path=$1 [QSA,L]
```

Ví dụ `PATCH /hotel/api/bookings/12/confirm` sẽ thành `index.php?path=bookings/12/confirm`.
`QSA` giữ lại query như `?role=admin`.

## Bước 4. Kết nối DB và các hàm dùng chung

`api/db.php`:

```php
<?php
$pdo = new PDO('mysql:host=localhost;dbname=hotel;charset=utf8mb4', 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

function ok($data = [], int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(int $code, string $message): void {
    ok(['message' => $message], $code);
}

function me(): ?array {
    return $_SESSION['user'] ?? null;
}

function requireRole(string ...$roles): array {
    $u = me();
    if (!$u) fail(401, 'Vui lòng đăng nhập');
    if (!in_array($u['role'], $roles, true)) fail(403, 'Bạn không có quyền làm việc này');
    return $u;
}
```

### ⚠️ Ép kiểu số trước khi trả JSON

PHP 8.0 + PDO trả **mọi cột số dưới dạng chuỗi** (`"0"`, `"600000"`). Frontend có chỗ so sánh
`available === 0` và `if (t.available)`. Chuỗi `"0"` trong JavaScript bị coi là **true**, nên
phòng hết vẫn hiện là còn. Vì vậy luôn đi qua các hàm "chuyển dữ liệu ra" dưới đây,
vừa ép `(int)`, vừa đổi tên cột `snake_case` sang `camelCase` mà frontend đọc:

```php
function typeOut(array $t): array {
    $out = [
        'id' => (int)$t['id'], 'name' => $t['name'], 'price' => (int)$t['price'],
        'capacity' => (int)$t['capacity'], 'image' => $t['image'] ?? '',
        'amenities' => json_decode($t['amenities'] ?? '[]', true) ?: [],
        'description' => $t['description'] ?? '',
    ];
    if (isset($t['available'])) $out['available'] = (int)$t['available'];
    return $out;
}

function roomOut(array $r): array {
    return ['id' => (int)$r['id'], 'number' => $r['number'], 'typeId' => (int)$r['type_id'],
            'status' => $r['status'], 'typeName' => $r['type_name']];
}

function userOut(array $u): array {
    return ['id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'],
            'phone' => $u['phone'] ?? '', 'role' => $u['role']]; // không bao giờ trả password
}

// Câu SELECT dùng chung cho đơn: kèm tên loại phòng và số phòng
const BOOKING_SQL = 'SELECT b.*, t.name AS type_name, r.number AS room_number
                     FROM bookings b JOIN room_types t ON t.id = b.type_id
                     LEFT JOIN rooms r ON r.id = b.room_id';

function bookingOut(PDO $pdo, array $b): array {
    $s = $pdo->prepare('SELECT id, name, price, qty FROM booking_services WHERE booking_id = ? ORDER BY id');
    $s->execute([$b['id']]);
    $services = array_map(fn($x) => ['id' => (int)$x['id'], 'name' => $x['name'],
        'price' => (int)$x['price'], 'qty' => (int)$x['qty']], $s->fetchAll());
    $roomTotal = (int)$b['room_total'];
    return [
        'id' => (int)$b['id'],
        'customerId' => $b['customer_id'] === null ? null : (int)$b['customer_id'],
        'guest' => ['name' => $b['guest_name'], 'phone' => $b['guest_phone'], 'email' => $b['guest_email'] ?? ''],
        'typeId' => (int)$b['type_id'], 'typeName' => $b['type_name'],
        'roomId' => $b['room_id'] === null ? null : (int)$b['room_id'], 'roomNumber' => $b['room_number'],
        'checkIn' => $b['check_in'], 'checkOut' => $b['check_out'], 'guests' => (int)$b['guests'],
        'payment' => $b['payment'], 'note' => $b['note'] ?? '', 'status' => $b['status'],
        'services' => $services, 'roomTotal' => $roomTotal,
        'total' => $roomTotal + array_sum(array_map(fn($x) => $x['price'] * $x['qty'], $services)),
        'createdAt' => $b['created_at'], 'paidAt' => $b['paid_at'],
    ];
}
```

## Bước 5. File `api/index.php`: đọc request và chia route

Đăng nhập dùng **`$_SESSION` của PHP** (cookie), không cần token. Vì frontend và API cùng domain,
trình duyệt tự gửi cookie session theo mỗi `fetch`.

```php
<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = trim($_GET['path'] ?? '', '/');            // vd: bookings/12/confirm
$p = explode('/', $path);                          // ['bookings', '12', 'confirm']
$body = json_decode(file_get_contents('php://input'), true) ?? []; // JSON body ($_POST sẽ rỗng)

try {
    // ----- Đăng nhập -----
    if ($method === 'POST' && $path === 'auth/login') {
        $s = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $s->execute([strtolower(trim($body['email'] ?? ''))]);
        $u = $s->fetch();
        if (!$u || !password_verify($body['password'] ?? '', $u['password'])) fail(400, 'Email hoặc mật khẩu không đúng');
        session_regenerate_id(true);
        $_SESSION['user'] = userOut($u);
        ok(['user' => $_SESSION['user']]);
    }

    if ($method === 'POST' && $path === 'auth/logout') {
        session_destroy();
        ok();
    }

    // ----- Loại phòng còn trống theo ngày -----
    if ($method === 'GET' && $path === 'room-types/available') {
        $in = $_GET['checkIn'] ?? '';
        $out = $_GET['checkOut'] ?? '';
        if (!($out > $in)) fail(400, 'Ngày trả phòng phải sau ngày nhận phòng');
        $s = $pdo->prepare("SELECT t.*, GREATEST(0,
                (SELECT COUNT(*) FROM rooms r WHERE r.type_id = t.id AND r.status <> 'maintenance')
              - (SELECT COUNT(*) FROM bookings b WHERE b.type_id = t.id
                   AND b.status IN ('pending','confirmed','checked_in')
                   AND b.check_in < ? AND ? < b.check_out)) AS available
            FROM room_types t WHERE t.capacity >= ?");
        $s->execute([$out, $in, (int)($_GET['guests'] ?? 1)]);
        ok(array_map('typeOut', $s->fetchAll()));
    }

    if ($method === 'GET' && $path === 'room-types') {
        ok(array_map('typeOut', $pdo->query('SELECT * FROM room_types ORDER BY price')->fetchAll()));
    }

    // ----- Ví dụ một thao tác có kiểm tra quyền + trạng thái -----
    if ($method === 'PATCH' && $p[0] === 'bookings' && ($p[2] ?? '') === 'confirm') {
        requireRole('receptionist', 'admin');
        $s = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending'");
        $s->execute([(int)$p[1]]);
        if (!$s->rowCount()) fail(400, 'Chỉ duyệt được đơn đang chờ');
        ok();
    }

    // ----- Danh sách đơn (lễ tân / admin) -----
    if ($method === 'GET' && $path === 'bookings') {
        requireRole('receptionist', 'admin');
        $rows = $pdo->query(BOOKING_SQL . ' ORDER BY b.id DESC')->fetchAll();
        ok(array_map(fn($b) => bookingOut($pdo, $b), $rows));
    }

    // ... các route còn lại làm tương tự theo bảng ở Bước 6

    fail(404, 'Không tìm thấy API');
} catch (PDOException $e) {
    if (($e->errorInfo[1] ?? 0) === 1062) fail(400, 'Dữ liệu bị trùng (email hoặc số phòng đã tồn tại)');
    fail(500, 'Lỗi máy chủ');
}
```

> `fail()` / `ok()` gọi `exit` nên mỗi route trả xong là dừng, không chạy xuống route dưới.

## Bước 6. Danh sách endpoint cần làm

Quy ước:
- **Thành công:** trả 2xx kèm JSON.
- **Lỗi:** trả 4xx/5xx kèm `{"message": "..."}`. Frontend hiện nguyên câu `message` cho người dùng, nên viết tiếng Việt dễ hiểu.
- **Ngày:** dạng `YYYY-MM-DD`.
- **Tiền:** số nguyên VNĐ.

| Hàm trong `api.js` | Endpoint | Body gửi lên | Trả về | Ai được gọi |
|---|---|---|---|---|
| `login(email, password)` | `POST /api/auth/login` | `{email, password}` | `{user}` | Ai cũng được |
| `register(d)` | `POST /api/auth/register` | `{name, email, phone, password}` | `{user}` (role luôn `customer`, đăng nhập luôn) | Ai cũng được |
| `logout()` | `POST /api/auth/logout` | | `{}` | Ai cũng được |
| `getRoomTypes()` | `GET /api/room-types` | | `RoomType[]` | Ai cũng được |
| `searchAvailable(q)` | `GET /api/room-types/available?checkIn=&checkOut=&guests=` | | `RoomType[]` có thêm `available` | Ai cũng được |
| `saveRoomType(t)` | `POST /api/room-types`, `PUT /api/room-types/{id}` | `RoomType` | `{}` | admin |
| `deleteRoomType(id)` | `DELETE /api/room-types/{id}` | | `{}` | admin |
| `getRooms()` | `GET /api/rooms` | | `Room[]` có `typeName` | lễ tân, admin |
| `saveRoom(r)` | `POST /api/rooms`, `PUT /api/rooms/{id}` | `{number, typeId, status}` | `{}` | admin |
| `deleteRoom(id)` | `DELETE /api/rooms/{id}` | | `{}` | admin |
| `createBooking(d)` | `POST /api/bookings` | `{typeId, checkIn, checkOut, guests, name, phone, email, note, payment}` | `Booking` | Ai cũng được |
| `getBookings()` | `GET /api/bookings` | | `Booking[]`, mới nhất trước | lễ tân, admin |
| `myBookings()` | `GET /api/bookings/me` | | `Booking[]` của khách đang đăng nhập | customer |
| `confirmBooking(id)` | `PATCH /api/bookings/{id}/confirm` | | `{}` | lễ tân, admin |
| `cancelBooking(id)` | `PATCH /api/bookings/{id}/cancel` | | `{}` | lễ tân, admin; customer chỉ đơn của mình đang `pending` |
| `checkIn(id, roomId)` | `POST /api/bookings/{id}/check-in` | `{roomId}` | `{}` | lễ tân, admin |
| `addService(id, s)` | `POST /api/bookings/{id}/services` | `{name, price, qty}` | `Booking` | lễ tân, admin |
| `removeService(id, sid)` | `DELETE /api/bookings/{id}/services/{serviceId}` | | `Booking` | lễ tân, admin |
| `checkOut(id)` | `POST /api/bookings/{id}/check-out` | | `Booking` đã chốt (để in hóa đơn) | lễ tân, admin |
| `getServices()` | `GET /api/services` | | `[{id, name, price}]` | lễ tân, admin |
| `getUsers(role?)` | `GET /api/users?role=` | | `User[]` | admin |
| `saveUser(u)` | `POST /api/users`, `PUT /api/users/{id}` | `{name, email, phone, password, role}` (password rỗng = không đổi) | `{}` | admin |
| `deleteUser(id)` | `DELETE /api/users/{id}` | | `{}` | admin |
| `revenue(period)` | `GET /api/stats/revenue?period=day\|month\|year` | | `[{label, total}]`, xếp tăng dần | admin |
| `roomStats()` | `GET /api/stats/rooms` | | `{total, available, occupied, maintenance}` | admin |

**Lưu ý:**
- Khi thêm mới, frontend gửi `id: ''` cho các hàm `save...`. Backend coi `id` rỗng là **tạo mới (POST)**.
- `serviceId` là `id` của dòng trong bảng `booking_services`, lấy từ `services[].id` mà `bookingOut()` trả về.
- **Doanh thu:** cộng `total` của các đơn `checked_out`, nhóm theo `paid_at`. Label lấy như sau:
  `DATE_FORMAT(paid_at,'%Y-%m-%d')` (ngày), `'%Y-%m'` (tháng), `'%Y'` (năm).

## Bước 7. Hình dạng dữ liệu frontend đọc

```js
RoomType = { id, name, price, capacity, image, amenities: ['Wi-Fi', ...], description, available? }
Room     = { id, number: '101', typeId, status: 'available' | 'occupied' | 'maintenance', typeName }
User     = { id, name, email, phone, role: 'customer' | 'receptionist' | 'admin' }
Booking  = { id, customerId, guest: { name, phone, email }, typeId, typeName, roomId, roomNumber,
             checkIn, checkOut, guests, payment, note, status,
             services: [{ id, name, price, qty }], roomTotal, total, createdAt, paidAt }
```

`id` của đơn hiện là số (ví dụ `12`), frontend hiển thị nguyên giá trị này làm mã đơn.

## Bước 8. Sửa `js/api.js` để gọi PHP (phần frontend)

Bên trong `const API = (() => { ... })()`:

1. Xóa hàm `seed()`, biến `db`, `save` và các helper giả (`freeCount`, `bill`, `full`, `findBooking`...).
   **Giữ** hai hàm `isoDate`, `nights` ở đầu file và hàm `currentUser`.
2. Thêm hàm gọi API:

```js
const BASE = 'api'; // http://localhost/hotel/api

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) localStorage.removeItem(SESSION_KEY); // session PHP hết hạn → coi như đăng xuất
  if (!res.ok) throw new Error(data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
  return data;
}
```

3. Viết lại các hàm, ví dụ:

```js
async login(email, password) {
  const { user } = await request('POST', '/auth/login', { email, password });
  localStorage.setItem(SESSION_KEY, JSON.stringify(user)); // để header/menu biết ai đang đăng nhập
  return user;
},
async register(d) {
  const { user } = await request('POST', '/auth/register', d);
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  return user;
},
logout() { localStorage.removeItem(SESSION_KEY); request('POST', '/auth/logout').catch(() => {}); },
currentUser,

getRoomTypes: () => request('GET', '/room-types'),
searchAvailable: q => request('GET', '/room-types/available?' + new URLSearchParams(q)),
saveRoomType: t => t.id ? request('PUT', `/room-types/${t.id}`, t) : request('POST', '/room-types', t),
deleteRoomType: id => request('DELETE', `/room-types/${id}`),
getBookings: () => request('GET', '/bookings'),
confirmBooking: id => request('PATCH', `/bookings/${id}/confirm`),
checkIn: (id, roomId) => request('POST', `/bookings/${id}/check-in`, { roomId }),
removeService: (id, sid) => request('DELETE', `/bookings/${id}/services/${sid}`),
getUsers: role => request('GET', '/users' + (role ? `?role=${role}` : '')),
revenue: period => request('GET', `/stats/revenue?period=${period}`),
// ... các hàm còn lại làm tương tự theo bảng ở Bước 6
```

## Bước 9. Quy tắc backend phải tự kiểm tra

Frontend có kiểm tra, nhưng người dùng sửa được JavaScript, nên **PHP phải kiểm tra lại toàn bộ**:

- **Phân quyền:** gọi `requireRole(...)` theo cột "Ai được gọi". Khách chỉ xem/hủy được đơn có `customer_id` = id của mình.
- **SQL:** luôn dùng `prepare` + `execute` với dấu `?`. Không nối chuỗi `$_GET` / `$body` vào câu SQL.
- **Mật khẩu:** `password_hash()` khi lưu, `password_verify()` khi đăng nhập. Không trả cột `password` ra API.
- **Tiền:** PHP tự tính `room_total = số đêm × price` lấy từ DB. Không tin số tiền frontend gửi.
  Số đêm tính bằng `(new DateTime($in))->diff(new DateTime($out))->days`.
- **Còn phòng:** dùng đúng công thức ở route `room-types/available`. Kiểm tra lại ngay trước khi
  `INSERT` đơn mới, tốt nhất trong `$pdo->beginTransaction()` để hai người không đặt trùng phòng cuối.
- **Ngày và số khách:** `checkIn` ≥ hôm nay, `checkOut` > `checkIn`, `guests` ≤ `capacity`.
- **Thanh toán:** chỉ nhận `payment` là `cash` (tiền mặt tại quầy) hoặc `transfer` (chuyển khoản).
  Không có thanh toán online. Lễ tân thu tiền hoặc kiểm tra chuyển khoản khi khách trả phòng.
- **Chuyển trạng thái đơn:**
  - `pending → confirmed`: duyệt.
  - `pending` hoặc `confirmed → cancelled`: hủy.
  - `confirmed → checked_in`: phòng phải cùng `type_id` và đang `available`; sau đó cập nhật phòng thành `occupied`.
  - `checked_in → checked_out`: ghi `paid_at = CURDATE()`, phòng về `available`.
  - Chỉ thêm/xóa dịch vụ khi đơn đang `checked_in`.
- **Xóa:**
  - Không xóa loại phòng khi còn phòng thuộc loại đó.
  - Không xóa phòng đang `occupied`.
  - Admin không xóa được chính mình.
  - Email và số phòng trùng thì báo lỗi (cột đã đặt `UNIQUE`).

## Bước 10. Kiểm tra sau khi nối

Mở `http://localhost/hotel/`, bật DevTools (F12) → tab Network để xem request và JSON trả về:

1. Đăng ký khách mới, đăng xuất, đăng nhập lại.
2. Tìm phòng theo ngày, xem chi tiết, đặt phòng (thử cả khi chưa đăng nhập).
3. Đăng nhập lễ tân, đi hết luồng: duyệt đơn → nhận phòng (gán phòng) → thêm dịch vụ và "Khác / bồi thường" →
   xóa 1 dịch vụ → trả phòng → in hóa đơn.
4. Khách vào "Đơn của tôi" thấy đúng trạng thái; hủy được đơn đang chờ duyệt.
5. Đăng nhập admin:
   - Thêm/sửa/xóa loại phòng, phòng, nhân viên.
   - Xem danh sách khách hàng.
   - Đổi kỳ doanh thu ngày/tháng/năm.
6. Thử các trường hợp lỗi, frontend phải hiện đúng câu `message`:
   - Đặt phòng khi hết phòng.
   - Đăng nhập sai mật khẩu.
   - Đăng nhập lễ tân rồi gõ thẳng `admin.html`.
7. Đặt kín một loại phòng, kiểm tra trang danh sách phòng hiện "Hết phòng". Nếu vẫn hiện "Xem phòng" là quên ép `(int)`.

Upload ảnh phòng chưa làm, hiện admin nhập đường dẫn ảnh (ví dụ `public/images/room.webp`).
Nếu cần upload thì làm thêm endpoint nhận file (`$_FILES`), lưu vào `public/images/` và trả về đường dẫn.
