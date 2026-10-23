# Hướng dẫn làm backend PHP – SOLENA

Tài liệu dành cho **người làm backend** sau khi nhận `hotel.zip`. Đây cũng là **hợp đồng API** giữa frontend và backend:
frontend sẽ gửi và đọc dữ liệu đúng như mô tả ở đây. Muốn đổi gì thì phải bàn với người kia trước.

**Mục lục**

1. Cài đặt khi nhận `hotel.zip`
2. Hiểu khung backend có sẵn
3. Ba việc sửa khung trước khi viết API
4. Quy ước bắt buộc
5. Cách thử API (không cần cài thêm gì)
6. Danh sách API và trạng thái
7. Đặc tả chi tiết từng API (kèm code mẫu)
8. Thứ tự làm và cách gửi lại cho frontend
9. Lỗi thường gặp
10. Phụ lục A: frontend ghép API vào `js/api.js`
11. Phụ lục B: dạng dữ liệu trả về

---

## 1. Cài đặt khi nhận `hotel.zip`

1. **Cài XAMPP** nếu máy chưa có: https://www.apachefriends.org. Mở **XAMPP Control Panel**, bấm **Start** cho
   **Apache** và **MySQL**. Hai ô phải chuyển xanh.
   - MySQL báo đỏ `Port 3306 in use`: máy bạn có MySQL khác chiếm cổng 3306. Xem mục 9.
2. **Giải nén** `hotel.zip` vào `C:\xampp\htdocs\hotel\`.
   Đúng là có file `C:\xampp\htdocs\hotel\index.html`. Nếu thành `hotel\hotel\index.html` là sai, chuyển lên một cấp.
3. **Tạo database**: mở http://localhost/phpmyadmin → tab **Import** (Nhập) → **Choose File** →
   chọn `C:\xampp\htdocs\hotel\database.sql` → **Import**.
   Bên trái hiện database `hotel` với 6 bảng là đúng.
   > Import lại file này bất cứ lúc nào sẽ **xóa sạch và tạo lại** database `hotel` với dữ liệu mẫu.
   > Dùng mỗi khi muốn làm lại từ đầu sau khi thử nghiệm.
4. **Tạo file cấu hình**: trong `C:\xampp\htdocs\hotel\api\`, copy `config.example.php` và đổi tên bản copy thành `config.php`.
   - XAMPP mặc định (cổng 3306, user `root`, không mật khẩu): **không phải sửa gì**.
   - MySQL chạy cổng khác hoặc có mật khẩu: sửa `port` / `pass` trong `config.php`.
   - **Không bao giờ gửi `config.php` cho người khác** (mỗi máy một bản).
5. **Kiểm tra** bằng cách mở 3 địa chỉ:

   | Địa chỉ | Phải thấy |
   |---|---|
   | http://localhost/hotel/ | Trang chủ khách sạn SOLENA |
   | http://localhost/hotel/api/room-types | JSON danh sách 4 loại phòng |
   | http://localhost/hotel/api/bookings | `{"message":"Vui lòng đăng nhập"}` |

   Cả 3 đúng là máy bạn đã sẵn sàng.

**Tài khoản mẫu** (có trong `database.sql`):

| Email | Mật khẩu | Quyền |
|---|---|---|
| admin@solena.vn | admin123 | admin (quản trị) |
| letan@solena.vn | 123456 | receptionist (lễ tân) |
| khach@gmail.com | 123456 | customer (khách) |
| hoa@gmail.com | 123456 | customer (khách) |

---

## 2. Hiểu khung backend có sẵn

### 2.1. Các file trong `api/`

| File | Vai trò | Bạn có sửa không |
|---|---|---|
| `.htaccess` | Chuyển mọi đường dẫn `/hotel/api/...` vào `index.php`; chặn trình duyệt đọc `config.php` | Không |
| `config.example.php` | Mẫu thông tin kết nối MySQL | Không |
| `config.php` | Thông tin kết nối MySQL của **máy bạn** | Chỉ khi đổi máy/mật khẩu |
| `db.php` | Kết nối DB + các hàm dùng chung | Thêm 2 hàm ở mục 3 |
| `index.php` | **Chứa toàn bộ API**, mỗi API là một khối `if` | **Có, viết API ở đây** |

Ngoài `api/`, bạn chỉ sửa thêm `database.sql` (khi đổi cấu trúc bảng). **Không sửa** các file `.html`, `.css`, `.js`:
đó là phần của frontend.

### 2.2. Một request đi qua các file thế nào

Ví dụ trình duyệt gọi `PATCH http://localhost/hotel/api/bookings/7/confirm`:

```
.htaccess   → đổi thành index.php?path=bookings/7/confirm
index.php   → session_start(), nạp db.php (kết nối MySQL, có biến $pdo)
            → chuẩn bị sẵn các biến:
                $method = 'PATCH'
                $path   = 'bookings/7/confirm'
                $p      = ['bookings', '7', 'confirm']     (path tách theo dấu /)
                $body   = mảng dữ liệu JSON frontend gửi lên ([] nếu không gửi gì)
            → chạy lần lượt từng khối if:
                khớp  if ($method === 'PATCH' && $p[0] === 'bookings' && ($p[2] ?? '') === 'confirm')
                → xử lý → ok() trả JSON và DỪNG
            → không khớp khối nào → fail(404, 'Không tìm thấy API')
```

- **Đọc id trên đường dẫn:** `(int)$p[1]`. Ví dụ `bookings/7/confirm` → `7`.
- **Đọc tham số sau dấu `?`:** `$_GET['ten']`. Ví dụ `stats/revenue?period=month` → `$_GET['period']`.
- **Đọc dữ liệu gửi lên:** `$body['ten']`. **Không dùng `$_POST`**: frontend gửi JSON nên `$_POST` luôn rỗng.

### 2.3. Các hàm có sẵn trong `db.php`

| Hàm | Dùng để |
|---|---|
| `ok($data, $code = 200)` | Trả `$data` dạng JSON rồi **dừng** script. Không có dữ liệu thì `ok()` |
| `fail($code, 'câu báo lỗi')` | Trả `{"message": "..."}` với mã lỗi rồi **dừng**. Frontend hiện nguyên câu này cho người dùng |
| `me()` | Người đang đăng nhập: `['id', 'name', 'email', 'phone', 'role']`, hoặc `null` |
| `requireRole('receptionist', 'admin')` | Chưa đăng nhập → 401; sai quyền → 403; đúng thì trả về `me()` |
| `typeOut($row)` | Dòng `room_types` → dữ liệu loại phòng frontend đọc |
| `roomOut($row)` | Dòng `rooms` (kèm cột `type_name`) → dữ liệu phòng |
| `userOut($row)` | Dòng `users` → dữ liệu người dùng (**bỏ password**) |
| `bookingOut($pdo, $row)` | Dòng đơn (lấy bằng `BOOKING_SQL`) → dữ liệu đơn, kèm danh sách dịch vụ và tổng tiền |
| `BOOKING_SQL` | Hằng chứa câu `SELECT` đơn + tên loại phòng + số phòng. Dùng: `BOOKING_SQL . ' WHERE b.id = ?'` |

**Vì sao luôn phải đi qua các hàm `...Out`:** PHP 8.0 trả **mọi cột số dưới dạng chuỗi** (`"0"`, `"600000"`).
Trong JavaScript, chuỗi `"0"` bị coi là **đúng**, nên ví dụ phòng hết (`available: "0"`) vẫn hiện là còn.
Các hàm `...Out` đã ép `(int)` và đổi tên cột `type_id` → `typeId` cho bạn.

### 2.4. Các bảng trong database

| Bảng | Cột chính |
|---|---|
| `users` | `id, name, email (UNIQUE), phone, password (đã mã hóa), role` (`customer` / `receptionist` / `admin`) |
| `room_types` | `id, name, price, capacity, image, amenities (JSON), description` |
| `rooms` | `id, number (UNIQUE), type_id, status` (`available` / `occupied` / `maintenance`) |
| `services` | `id, name, price`: danh mục dịch vụ (nước, giặt ủi...) |
| `bookings` | `id, customer_id (NULL = khách vãng lai), guest_name, guest_phone, guest_email, type_id, room_id (NULL tới khi nhận phòng), check_in, check_out, guests, payment` (`cash` / `transfer`), `note, status, room_total, created_at, paid_at` |
| `booking_services` | `id, booking_id, name, price, qty`: dịch vụ khách đã dùng trong một đơn |

**Trạng thái đơn** (`bookings.status`) chỉ được đi theo đúng các mũi tên:

```
pending ──duyệt──▶ confirmed ──nhận phòng──▶ checked_in ──trả phòng──▶ checked_out
   │                   │
   └──────hủy──────────┴──▶ cancelled
```

---

## 3. Ba việc sửa khung trước khi viết API

### 3.1. Đặt múi giờ Việt Nam: `api/index.php`

XAMPP để PHP chạy giờ **Đức (Europe/Berlin)**, chậm hơn Việt Nam 5–6 tiếng. Nếu không sửa, từ 0h đến khoảng 6h sáng,
`date('Y-m-d')` vẫn trả **ngày hôm qua**, và kiểm tra "ngày nhận phòng không được ở quá khứ" sẽ sai.

Thêm dòng này ngay dưới dòng `ini_set('display_errors', '0');` ở đầu file:

```php
date_default_timezone_set('Asia/Ho_Chi_Minh');
```

### 3.2. Thêm 2 hàm dùng chung: cuối file `api/db.php`

```php
function findBooking(PDO $pdo, int $id): array {
    $s = $pdo->prepare(BOOKING_SQL . ' WHERE b.id = ?');
    $s->execute([$id]);
    $b = $s->fetch();
    if (!$b) fail(404, 'Không tìm thấy đơn đặt phòng');
    return $b;
}

function validDate(string $d): bool {
    $x = DateTime::createFromFormat('!Y-m-d', $d);
    return $x && $x->format('Y-m-d') === $d;
}
```

- `findBooking`: lấy một đơn theo id; không có thì tự trả 404. Dùng trong hầu hết API về đơn.
- `validDate`: kiểm tra chuỗi có đúng là ngày `YYYY-MM-DD` có thật không (`2027-02-31` → sai).

### 3.3. Báo lỗi dễ hiểu khi xóa dữ liệu đang được dùng: cuối `api/index.php`

Trong khối `catch` ở cuối file, thêm dòng `1451` ngay dưới dòng `1062`:

```php
    if (($e->errorInfo[1] ?? 0) === 1062) fail(400, 'Dữ liệu bị trùng (email hoặc số phòng đã tồn tại)');
    if (($e->errorInfo[1] ?? 0) === 1451) fail(400, 'Dữ liệu này đang được dùng ở đơn đặt phòng, không thể xóa');
```

Lỗi `1451` là MySQL chặn xóa vì còn dữ liệu khác trỏ tới, ví dụ xóa loại phòng đã có người đặt.

---

## 4. Quy ước bắt buộc

1. **Trả về luôn là JSON.**
   - Thành công: mã 200 (tạo mới thì nên 201) kèm dữ liệu.
   - Lỗi: dùng `fail()` với mã:
     - **400**: dữ liệu sai hoặc vi phạm quy tắc.
     - **401**: chưa đăng nhập.
     - **403**: sai quyền.
     - **404**: không tìm thấy.
2. **Câu báo lỗi viết tiếng Việt, dễ hiểu.** Frontend hiện nguyên văn cho người dùng.
   Nên dùng **đúng các câu ghi trong mục 7** để giống bản chạy thử của frontend.
3. **Frontend gửi số dưới dạng chuỗi** (lấy từ ô nhập liệu): `"typeId": "2"`, `"price": "600000"`.
   Luôn ép kiểu khi đọc: `(int)($body['price'] ?? 0)`.
4. **SQL luôn dùng `prepare` + dấu `?`**:
   ```php
   $s = $pdo->prepare('SELECT * FROM rooms WHERE id = ?');
   $s->execute([$id]);
   ```
   **Không bao giờ** nối thẳng `$body[...]` hay `$_GET[...]` vào câu SQL (lỗi bảo mật SQL injection).
   Được phép dùng `$pdo->query(...)` khi câu SQL **không có dữ liệu từ người dùng**.
5. **Không tin dữ liệu frontend.** Người dùng sửa được JavaScript, nên backend phải tự kiểm tra **mọi** quy tắc:
   - quyền;
   - trạng thái đơn;
   - còn phòng;
   - tự tính tiền từ giá trong database, không lấy số tiền frontend gửi.
6. **Mật khẩu:** lưu bằng `password_hash($pw, PASSWORD_DEFAULT)`, kiểm tra bằng `password_verify()`.
   Không bao giờ trả cột `password` ra ngoài (dùng `userOut`).
7. **Đăng nhập dùng `$_SESSION`** (đã có sẵn). Không cần token; trình duyệt tự gửi cookie.
8. **Thêm hoặc sửa nhiều bảng cùng lúc** (ví dụ nhận phòng: sửa cả `bookings` lẫn `rooms`) thì bọc trong transaction:
   `$pdo->beginTransaction();` … `$pdo->commit();`
   Nếu `fail()` giữa chừng, transaction tự hủy khi script dừng, không cần tự `rollBack()`.
9. **Thêm mới vs sửa:** frontend gọi `POST /api/xxx` để thêm mới, `PUT /api/xxx/{id}` để sửa.
   Khi sửa, **lấy id trên đường dẫn** (`$p[1]`), không lấy `$body['id']`.

---

## 5. Cách thử API (không cần cài thêm gì)

### Cách 1: API kiểu GET

Gõ thẳng địa chỉ lên trình duyệt, ví dụ http://localhost/hotel/api/room-types.

### Cách 2: mọi loại API, dùng Console của trình duyệt (khuyên dùng)

1. Mở http://localhost/hotel/, bấm **F12** → tab **Console**.
2. Dán dòng sau, Enter (tạo hàm `api` để gọi cho nhanh):
   ```js
   const api = (method, path, body) => fetch('api/' + path, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) }).then(async r => [r.status, await r.json()])
   ```
3. Gọi thử, ví dụ:
   ```js
   await api('POST', 'auth/login', { email: 'letan@solena.vn', password: '123456' })
   await api('GET', 'bookings')
   await api('PATCH', 'bookings/7/confirm')
   await api('POST', 'bookings', { typeId: '2', checkIn: '2026-12-01', checkOut: '2026-12-03', guests: '2', name: 'Khách Thử', phone: '0911222333', email: '', note: '', payment: 'cash' })
   ```
   Kết quả hiện dạng `[200, {...}]`: số đầu là mã trả về, phần sau là JSON.
   Đã đăng nhập ở Console thì mở API kiểu GET trên tab khác cũng được tính là đã đăng nhập.

### Cách 3: Postman hoặc Thunder Client (extension của VS Code)

Chọn method, nhập URL `http://localhost/hotel/api/...`, tab **Body** → **JSON**. Gọi `auth/login` trước;
công cụ tự giữ cookie đăng nhập cho các lần gọi sau.

### Xem lỗi PHP

Lỗi PHP **không hiện ra màn hình** (đã tắt để không làm hỏng JSON). Khi API trả `{"message":"Lỗi máy chủ"}`
hoặc trang trắng, mở file **`C:\xampp\apache\logs\error.log`** và kéo xuống cuối.

### Làm lại dữ liệu từ đầu

Thử nhiều lần làm dữ liệu rối thì Import lại `database.sql` (mục 1, bước 3).

---

## 6. Danh sách API và trạng thái

✅ = đã có sẵn trong `index.php` · ⬜ = bạn cần viết · 📄 = mục 7 có **code mẫu đầy đủ, đã chạy thử**

| # | Method | Đường dẫn | Ai được gọi | Trạng thái |
|---|---|---|---|---|
| 1 | POST | `auth/login` | Ai cũng được | ✅ |
| 2 | POST | `auth/register` | Ai cũng được | ✅ |
| 3 | POST | `auth/logout` | Ai cũng được | ✅ |
| 4 | GET | `room-types` | Ai cũng được | ✅ |
| 5 | GET | `room-types/available?checkIn=&checkOut=&guests=` | Ai cũng được | ✅ |
| 6 | POST | `room-types` | admin | ⬜ |
| 7 | PUT | `room-types/{id}` | admin | ⬜ |
| 8 | DELETE | `room-types/{id}` | admin | ⬜ |
| 9 | GET | `rooms` | lễ tân, admin | ⬜ 📄 |
| 10 | POST | `rooms` | admin | ⬜ |
| 11 | PUT | `rooms/{id}` | admin | ⬜ |
| 12 | DELETE | `rooms/{id}` | admin | ⬜ |
| 13 | POST | `bookings` | Ai cũng được | ⬜ 📄 |
| 14 | GET | `bookings` | lễ tân, admin | ✅ |
| 15 | GET | `bookings/me` | khách | ⬜ |
| 16 | PATCH | `bookings/{id}/confirm` | lễ tân, admin | ✅ |
| 17 | PATCH | `bookings/{id}/cancel` | lễ tân, admin, khách (đơn của mình) | ⬜ |
| 18 | POST | `bookings/{id}/check-in` | lễ tân, admin | ⬜ |
| 19 | POST | `bookings/{id}/services` | lễ tân, admin | ⬜ |
| 20 | DELETE | `bookings/{id}/services/{serviceId}` | lễ tân, admin | ⬜ |
| 21 | POST | `bookings/{id}/check-out` | lễ tân, admin | ⬜ 📄 |
| 22 | GET | `services` | lễ tân, admin | ⬜ 📄 |
| 23 | GET | `users?role=` | admin | ⬜ |
| 24 | POST | `users` | admin | ⬜ |
| 25 | PUT | `users/{id}` | admin | ⬜ |
| 26 | DELETE | `users/{id}` | admin | ⬜ |
| 27 | GET | `stats/revenue?period=day\|month\|year` | admin | ⬜ 📄 |
| 28 | GET | `stats/rooms` | admin | ⬜ 📄 |

Mọi đường dẫn đều có tiền tố `http://localhost/hotel/api/`. Mọi API mới đều thêm vào `index.php`,
**ngay phía trên dòng** `fail(404, 'Không tìm thấy API');`.

---

## 7. Đặc tả chi tiết từng API

Mỗi API ghi rõ:
- **Quyền:** ai được gọi.
- **Gửi lên:** dữ liệu frontend gửi.
- **Kiểm tra:** theo đúng thứ tự, kèm câu báo lỗi.
- **Xử lý:** cần làm gì với database.
- **Trả về:** kết quả khi thành công.

Dạng dữ liệu `RoomType`, `Room`, `Booking`, `User` xem ở **Phụ lục B**.

### A. Tài khoản (1–3) ✅ đã có

| API | Gửi lên | Trả về | Lỗi |
|---|---|---|---|
| `POST auth/login` | `{email, password}` | `{user}` | 400 `Email hoặc mật khẩu không đúng` |
| `POST auth/register` | `{name, email, phone, password}` | 201 `{user}` (role luôn là `customer`, đăng nhập luôn) | 400 `Vui lòng nhập họ tên` / `Email không hợp lệ` / `Số điện thoại không hợp lệ` / `Mật khẩu phải có ít nhất 6 ký tự` / `Email đã được sử dụng` |
| `POST auth/logout` | | `[]` | |

### B. Loại phòng

**4. `GET room-types`** ✅: trả `RoomType[]` xếp theo giá tăng dần.

**5. `GET room-types/available?checkIn=2026-12-01&checkOut=2026-12-03&guests=2`** ✅
Trả `RoomType[]` có thêm `available` (số phòng còn trống), chỉ gồm loại có `capacity >= guests`.
Công thức còn trống: **số phòng của loại đó không ở trạng thái `maintenance`**, trừ đi
**số đơn `pending` / `confirmed` / `checked_in` của loại đó bị trùng ngày**.
Hai khoảng ngày trùng nhau khi `đơn.check_in < checkOut AND checkIn < đơn.check_out`.

**6. `POST room-types`**
- **Quyền:** admin.
- **Gửi lên:** `{name, price, capacity, image, amenities, description, id: ""}`. `amenities` là **mảng chuỗi**: `["Wi-Fi","TV"]`.
- **Kiểm tra:**
  - `name` rỗng → `Vui lòng nhập tên loại phòng`
  - `price < 0` → `Giá phòng không hợp lệ`
  - `capacity < 1` → `Số khách tối đa phải từ 1 trở lên`
- **Xử lý:**
  ```php
  $pdo->prepare('INSERT INTO room_types (name, price, capacity, image, amenities, description) VALUES (?, ?, ?, ?, ?, ?)')
      ->execute([$name, $price, $capacity, $image, json_encode(is_array($body['amenities'] ?? null) ? $body['amenities'] : [], JSON_UNESCAPED_UNICODE), $description]);
  ```
- **Trả về:** 201 `[]` (hoặc `ok([], 201)`).

**7. `PUT room-types/{id}`**
- **Quyền:** admin. **Gửi lên:** như trên. **Kiểm tra:** như trên.
- **Không có loại phòng id này:** 404 `Không tìm thấy loại phòng`. Kiểm tra bằng `SELECT 1 ... WHERE id = ?`.
  Đừng dựa vào `rowCount()`, vì nếu dữ liệu không đổi thì `rowCount()` cũng ra 0.
- **Xử lý:** `UPDATE room_types SET name = ?, price = ?, capacity = ?, image = ?, amenities = ?, description = ? WHERE id = ?`
- **Trả về:** `[]`.

**8. `DELETE room-types/{id}`**
- **Quyền:** admin.
- **Kiểm tra:** còn phòng thuộc loại này (`SELECT COUNT(*) FROM rooms WHERE type_id = ?` > 0) →
  400 `Còn phòng thuộc loại này, hãy xóa hoặc chuyển phòng trước`.
- **Xử lý:** `DELETE FROM room_types WHERE id = ?`. Nếu loại phòng đã có đơn đặt, MySQL báo lỗi 1451; khung đã bắt lỗi này ở mục 3.3.
- **Trả về:** `[]`.

### C. Phòng

**9. `GET rooms`** 📄
- **Quyền:** lễ tân, admin.
- **Trả về:** `Room[]` xếp theo số phòng.

```php
    if ($method === 'GET' && $path === 'rooms') {
        requireRole('receptionist', 'admin');
        $rows = $pdo->query('SELECT r.*, t.name AS type_name FROM rooms r
                             JOIN room_types t ON t.id = r.type_id ORDER BY r.number')->fetchAll();
        ok(array_map('roomOut', $rows));
    }
```

**10. `POST rooms`**
- **Quyền:** admin.
- **Gửi lên:** `{number, typeId, status, id: ""}`. `status` là `available` hoặc `maintenance`.
- **Kiểm tra:**
  - `number` rỗng → `Vui lòng nhập số phòng`
  - `typeId` không có trong `room_types` → `Loại phòng không tồn tại`
  - `status` khác `available` / `maintenance` → coi là `available`
  - trùng số phòng → `Số phòng đã tồn tại`
- **Xử lý:** `INSERT INTO rooms (number, type_id, status) VALUES (?, ?, ?)`.
- **Trả về:** 201 `[]`.

**11. `PUT rooms/{id}`**
- **Quyền:** admin. **Gửi lên:** như trên. **Kiểm tra:** như trên; trùng số phòng thì **trừ chính nó** (`... AND id <> ?`).
- **Không có phòng:** 404 `Không tìm thấy phòng`.
- **Phòng đang có khách** (`status = 'occupied'`): **giữ nguyên `occupied`**, bỏ qua `status` gửi lên.
  Trạng thái `occupied` chỉ do nhận phòng / trả phòng đặt.
- **Không có `status` gửi lên:** giữ trạng thái cũ. Khi phòng đang có khách, frontend khóa ô trạng thái nên sẽ không gửi field này.
- **Xử lý:** `UPDATE rooms SET number = ?, type_id = ?, status = ? WHERE id = ?`.
- **Trả về:** `[]`.

**12. `DELETE rooms/{id}`**
- **Quyền:** admin.
- **Kiểm tra:** phòng đang `occupied` → `Phòng đang có khách, không thể xóa`.
- **Xử lý:** `DELETE FROM rooms WHERE id = ?`. Phòng đã từng gán cho đơn → lỗi 1451 (đã bắt ở mục 3.3).
- **Trả về:** `[]`.

### D. Đơn đặt phòng

**13. `POST bookings`** 📄: API quan trọng nhất
- **Quyền:** ai cũng được (khách không cần đăng nhập vẫn đặt được).
- **Gửi lên:** `{typeId, checkIn, checkOut, guests, name, phone, email, note, payment}`.
- **Kiểm tra:** theo đúng thứ tự trong code bên dưới.
- **Xử lý:**
  - tự tính `room_total = số đêm × giá phòng`;
  - đơn tạo ra luôn ở trạng thái `pending`;
  - nếu người đặt đang đăng nhập bằng tài khoản khách thì ghi `customer_id`, còn lại để `NULL`.
- **Trả về:** 201 `Booking`.
- **Chống đặt trùng:** khóa dòng loại phòng bằng `FOR UPDATE` trong transaction, để hai người đặt cùng lúc phòng cuối cùng thì chỉ một người được.

```php
    if ($method === 'POST' && $path === 'bookings') {
        $typeId = (int)($body['typeId'] ?? 0);
        $in = $body['checkIn'] ?? '';
        $out = $body['checkOut'] ?? '';
        $guests = (int)($body['guests'] ?? 0);
        $name = trim($body['name'] ?? '');
        $phone = trim($body['phone'] ?? '');
        $email = trim($body['email'] ?? '');
        $note = mb_substr(trim($body['note'] ?? ''), 0, 250);
        $payment = $body['payment'] ?? '';

        if (!validDate($in) || !validDate($out)) fail(400, 'Ngày không hợp lệ');
        if ($in < date('Y-m-d')) fail(400, 'Ngày nhận phòng không được ở quá khứ');
        if ($out <= $in) fail(400, 'Ngày trả phòng phải sau ngày nhận phòng');
        if (mb_strlen($name) < 2) fail(400, 'Vui lòng nhập họ tên');
        if (!preg_match('/^0\d{9,10}$/', $phone)) fail(400, 'Số điện thoại không hợp lệ');
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Email không hợp lệ');
        if (!in_array($payment, ['cash', 'transfer'], true)) fail(400, 'Phương thức thanh toán không hợp lệ');

        $pdo->beginTransaction();
        $s = $pdo->prepare('SELECT * FROM room_types WHERE id = ? FOR UPDATE');
        $s->execute([$typeId]);
        $t = $s->fetch();
        if (!$t) fail(400, 'Loại phòng không tồn tại');
        if ($guests < 1 || $guests > (int)$t['capacity']) fail(400, "Loại phòng này tối đa {$t['capacity']} người");

        $s = $pdo->prepare("SELECT
                (SELECT COUNT(*) FROM rooms WHERE type_id = ? AND status <> 'maintenance')
              - (SELECT COUNT(*) FROM bookings WHERE type_id = ?
                   AND status IN ('pending','confirmed','checked_in')
                   AND check_in < ? AND ? < check_out)");
        $s->execute([$typeId, $typeId, $out, $in]);
        if ((int)$s->fetchColumn() <= 0) fail(400, 'Đã hết phòng trong khoảng ngày bạn chọn');

        $nights = (new DateTime($in))->diff(new DateTime($out))->days;
        $u = me();
        $pdo->prepare("INSERT INTO bookings (customer_id, guest_name, guest_phone, guest_email, type_id,
                         check_in, check_out, guests, payment, note, status, room_total, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, CURDATE())")
            ->execute([($u['role'] ?? '') === 'customer' ? $u['id'] : null, $name, $phone, $email, $typeId,
                       $in, $out, $guests, $payment, $note, $nights * (int)$t['price']]);
        $id = (int)$pdo->lastInsertId();
        $pdo->commit();
        ok(bookingOut($pdo, findBooking($pdo, $id)), 201);
    }
```

> Đã chạy thử với database mẫu: đặt Suite hôm nay → `Đã hết phòng...`; ngày hôm qua → `...quá khứ`;
> Standard 3 khách → `...tối đa 2 người`; `payment: "gateway"` → `...không hợp lệ`; ngày `2027-02-31` → `Ngày không hợp lệ`;
> khách vãng lai đặt Deluxe → 201, `customerId: null`; khách đã đăng nhập đặt → 201, `customerId: 3`.

**14. `GET bookings`** ✅: lễ tân, admin. Trả `Booking[]`, mới nhất trước.

**15. `GET bookings/me`**
- **Quyền:** khách (`requireRole('customer')`).
- **Xử lý:** `BOOKING_SQL . ' WHERE b.customer_id = ? ORDER BY b.id DESC'` với id của `me()`.
- **Trả về:** `Booking[]`. Nhớ map qua `bookingOut` như API số 14.

**16. `PATCH bookings/{id}/confirm`** ✅: lễ tân, admin. Chỉ đơn `pending` → `confirmed`.
Sai trạng thái → `Chỉ duyệt được đơn đang chờ`.

**17. `PATCH bookings/{id}/cancel`**
- **Quyền:** lễ tân, admin, khách (`$u = requireRole('customer', 'receptionist', 'admin')`).
- **Kiểm tra:**
  - Lấy đơn bằng `findBooking` (không có → 404).
  - **Nếu là khách:**
    - đơn không phải của mình (`(int)$b['customer_id'] !== $u['id']`) → 403 `Bạn không có quyền làm việc này`;
    - đơn không ở `pending` → `Chỉ hủy được đơn đang chờ duyệt`.
  - **Nếu là lễ tân / admin:** đơn không ở `pending` hoặc `confirmed` → `Không thể hủy đơn này`.
- **Xử lý:** `UPDATE bookings SET status = 'cancelled' WHERE id = ?`.
- **Trả về:** `[]`.

**18. `POST bookings/{id}/check-in`**: nhận phòng, gán phòng thật cho khách
- **Quyền:** lễ tân, admin.
- **Gửi lên:** `{roomId}`.
- **Kiểm tra:**
  - đơn không ở `confirmed` → `Đơn chưa được xác nhận`;
  - lấy phòng `SELECT * FROM rooms WHERE id = ? FOR UPDATE` (trong transaction): không có, khác `type_id` của đơn,
    hoặc không ở `available` → `Phòng không hợp lệ hoặc không trống`.
- **Xử lý (một transaction):**
  - `UPDATE bookings SET room_id = ?, status = 'checked_in' WHERE id = ?`
  - `UPDATE rooms SET status = 'occupied' WHERE id = ?`
- **Trả về:** `[]`.

**19. `POST bookings/{id}/services`**: thêm dịch vụ phát sinh / bồi thường hư hại
- **Quyền:** lễ tân, admin.
- **Gửi lên:** `{name, price, qty}`. Dịch vụ có sẵn hay dịch vụ "Khác / bồi thường" đều gửi cùng dạng này.
- **Kiểm tra:**
  - đơn không ở `checked_in` → `Khách không còn ở trong phòng`;
  - `name` rỗng hoặc `price < 0` → `Nhập nội dung và đơn giá`;
  - `qty < 1` → coi là 1.
- **Xử lý:** `INSERT INTO booking_services (booking_id, name, price, qty) VALUES (?, ?, ?, ?)`.
- **Trả về:** `Booking` mới nhất: `ok(bookingOut($pdo, findBooking($pdo, $id)))`.

**20. `DELETE bookings/{id}/services/{serviceId}`**
- **Quyền:** lễ tân, admin.
- **Đọc id:** `serviceId` là `(int)$p[3]`, là `id` của dòng trong `booking_services` (frontend lấy từ `services[].id`).
- **Kiểm tra:**
  - đơn không ở `checked_in` → `Không thể sửa hóa đơn đã chốt`;
  - không xóa được dòng nào → 404 `Không tìm thấy dịch vụ`.
- **Xử lý:** `DELETE FROM booking_services WHERE id = ? AND booking_id = ?`. Điều kiện `booking_id` chặn việc xóa nhầm dịch vụ của đơn khác.
- **Trả về:** `Booking` mới nhất.

**21. `POST bookings/{id}/check-out`** 📄: trả phòng, chốt hóa đơn
- **Quyền:** lễ tân, admin.
- **Trả về:** `Booking` đã chốt (frontend dùng để in hóa đơn).

```php
    if ($method === 'POST' && $p[0] === 'bookings' && ($p[2] ?? '') === 'check-out') {
        requireRole('receptionist', 'admin');
        $b = findBooking($pdo, (int)$p[1]);
        if ($b['status'] !== 'checked_in') fail(400, 'Đơn không ở trạng thái đang ở');
        $pdo->beginTransaction();
        $pdo->prepare("UPDATE bookings SET status = 'checked_out', paid_at = CURDATE() WHERE id = ?")->execute([$b['id']]);
        $pdo->prepare("UPDATE rooms SET status = 'available' WHERE id = ?")->execute([$b['room_id']]);
        $pdo->commit();
        ok(bookingOut($pdo, findBooking($pdo, (int)$b['id'])));
    }
```

**22. `GET services`** 📄: danh mục dịch vụ cho ô chọn ở màn hình lễ tân.

```php
    if ($method === 'GET' && $path === 'services') {
        requireRole('receptionist', 'admin');
        $rows = $pdo->query('SELECT * FROM services ORDER BY id')->fetchAll();
        ok(array_map(fn($s) => ['id' => (int)$s['id'], 'name' => $s['name'], 'price' => (int)$s['price']], $rows));
    }
```

### E. Nhân sự / người dùng (admin)

**23. `GET users?role=`**
- **Quyền:** admin.
- **`role`:**
  - không gửi → trả **tất cả** (trang Nhân sự tự lọc bỏ khách);
  - `role=customer` → chỉ khách (trang Khách hàng gọi kiểu này);
  - giá trị lạ → coi như không gửi.
- **Xử lý:** `SELECT * FROM users [WHERE role = ?] ORDER BY id`, map qua `userOut`.
- **Trả về:** `User[]`.

**24. `POST users`**: tạo tài khoản nhân viên
- **Quyền:** admin.
- **Gửi lên:** `{name, email, phone, password, role, id: ""}`. `role` là `receptionist` hoặc `admin`.
- **Kiểm tra:**
  - `name` rỗng → `Vui lòng nhập họ tên`
  - email sai → `Email không hợp lệ`
  - `role` khác `receptionist` / `admin` → `Quyền không hợp lệ`
  - `password` rỗng → `Cần nhập mật khẩu cho tài khoản mới`
  - `password` ngắn hơn 6 ký tự → `Mật khẩu phải có ít nhất 6 ký tự`
  - email trùng → `Email đã được sử dụng`
- **Xử lý:** `INSERT` với `password_hash(...)`. Email lưu chữ thường (`strtolower`).
- **Trả về:** 201 `[]`.

**25. `PUT users/{id}`**
- **Quyền:** admin. **Kiểm tra:** như trên, trừ một điểm: `password` **rỗng = giữ mật khẩu cũ**.
- Email trùng thì **trừ chính nó**. Không có user → 404 `Không tìm thấy tài khoản`.
- Nếu admin đang sửa **chính mình** thì cập nhật luôn `$_SESSION['user']` (dùng `userOut`).
- **Trả về:** `[]`.

**26. `DELETE users/{id}`**
- **Quyền:** admin.
- **Kiểm tra:** xóa chính mình (`(int)$p[1] === me()['id']`) → `Không thể xóa tài khoản đang đăng nhập`.
- **Xử lý:** `DELETE FROM users WHERE id = ?`. Khách đã có đơn → lỗi 1451 (đã bắt ở mục 3.3).
- **Trả về:** `[]`.

### F. Thống kê (admin)

**27. `GET stats/revenue?period=day|month|year`** 📄
- **Doanh thu:** tổng tiền (tiền phòng + dịch vụ) của các đơn `checked_out`, nhóm theo ngày trả phòng (`paid_at`).
- **Trả về:** `[{label, total}]`, xếp tăng dần.
  `label` dạng `2026-10-24` (theo ngày), `2026-10` (theo tháng), `2026` (theo năm).

```php
    if ($method === 'GET' && $path === 'stats/revenue') {
        requireRole('admin');
        $formats = ['day' => '%Y-%m-%d', 'month' => '%Y-%m', 'year' => '%Y'];
        $fmt = $formats[$_GET['period'] ?? ''] ?? null;
        if (!$fmt) fail(400, 'Kỳ thống kê không hợp lệ');
        $s = $pdo->prepare("SELECT DATE_FORMAT(b.paid_at, ?) AS label,
                SUM(b.room_total + COALESCE((SELECT SUM(price * qty) FROM booking_services WHERE booking_id = b.id), 0)) AS total
            FROM bookings b WHERE b.status = 'checked_out'
            GROUP BY label ORDER BY label");
        $s->execute([$fmt]);
        ok(array_map(fn($r) => ['label' => $r['label'], 'total' => (int)$r['total']], $s->fetchAll()));
    }
```

**28. `GET stats/rooms`** 📄
- **Trả về:** `{total, available, occupied, maintenance}`.
- `SUM(...)` trong MySQL trả số thập phân dạng chuỗi, nên phải `intval`.

```php
    if ($method === 'GET' && $path === 'stats/rooms') {
        requireRole('admin');
        $r = $pdo->query("SELECT COUNT(*) AS total, SUM(status = 'available') AS available,
                SUM(status = 'occupied') AS occupied, SUM(status = 'maintenance') AS maintenance FROM rooms")->fetch();
        ok(array_map('intval', $r));
    }
```

---

## 8. Thứ tự làm và cách gửi lại cho frontend

### 8.1. Thứ tự làm

Làm theo từng đợt, xong đợt nào gửi đợt đó để frontend ghép và thử ngay:

| Đợt | API | Màn hình dùng tới |
|---|---|---|
| 1 | Mục 3 (sửa khung) + `rooms`, `services` | (chuẩn bị) |
| 2 | `POST bookings`, `GET bookings/me`, `PATCH .../cancel` | Đặt phòng, Đơn của tôi |
| 3 | `.../check-in`, `.../services` (thêm, xóa), `.../check-out` | Lễ tân: nhận phòng, khách đang ở, hóa đơn |
| 4 | `room-types` (thêm, sửa, xóa), `rooms` (thêm, sửa, xóa) | Admin: loại phòng, phòng |
| 5 | `users` (xem, thêm, sửa, xóa) | Admin: nhân sự, khách hàng |
| 6 | `stats/revenue`, `stats/rooms` | Admin: báo cáo |

Xong mỗi API thì thử ngay bằng Console (mục 5), kể cả **các trường hợp lỗi**: sai quyền, sai trạng thái, dữ liệu sai.

### 8.2. Gửi lại cho frontend

1. Tạo một thư mục mới, ví dụ `gui_frontend`. Copy vào đó **thư mục `api`** và **file `database.sql`**.
2. **Xóa `gui_frontend\api\config.php`.**
3. Chuột phải `gui_frontend` → **Send to → Compressed (zipped) folder** → đặt tên kèm ngày: `api_2026-10-26.zip`.
4. Gửi kèm tin nhắn:
   > Xong đợt 2: `POST bookings`, `GET bookings/me`, `PATCH bookings/{id}/cancel`. `database.sql`: **không đổi** / **có đổi** (ghi rõ đổi gì).

### 8.3. Khi nhận giao diện mới từ frontend

Frontend chỉ gửi `*.html`, `css/`, `js/`. Bạn chép đè **đúng những file đó**. **Không** để ai chép đè `api/` và `database.sql` của bạn.

### 8.4. Khi cần đổi API

Ví dụ muốn đổi tên field, đổi đường dẫn, trả thêm dữ liệu: **nhắn frontend trước**. Thống nhất xong thì sửa file
hướng dẫn này và gửi lại cho người kia. Không tự đổi rồi mới báo.

---

## 9. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách sửa |
|---|---|---|
| XAMPP báo `Port 3306 in use`, MySQL không chạy | Máy có MySQL khác (thường là dịch vụ `MySQL80`) | Tắt dịch vụ đó (`Win+R` → `services.msc` → MySQL80 → Stop), **hoặc** cho XAMPP chạy cổng khác: sửa 2 dòng `port=` trong `C:\xampp\mysql\bin\my.ini`, sửa cổng ở **Config → Service and Port Settings → MySQL**, rồi sửa `port` trong `api/config.php` cho khớp |
| `Chưa có api/config.php` | Chưa làm bước 4 mục 1 | Copy `config.example.php` thành `config.php` |
| `Không kết nối được database` | MySQL chưa bật, sai cổng/mật khẩu, hoặc chưa Import | Kiểm tra XAMPP, `config.php`, phpMyAdmin |
| `Không tìm thấy API` (404) | Sai method/đường dẫn, hoặc khối `if` đặt **dưới** dòng `fail(404...)` | Kiểm tra lại |
| `Lỗi máy chủ` (500) | Lỗi SQL hoặc PHP | Xem `C:\xampp\apache\logs\error.log` |
| Mọi dữ liệu gửi lên đều rỗng | Đọc `$_POST` thay vì `$body` | Dùng `$body['ten']` |
| Phòng hết vẫn hiện "còn", nút bấm không đúng | Trả số dạng chuỗi (`"0"`) | Đi qua các hàm `...Out` hoặc ép `(int)` |
| `Ngày nhận phòng không được ở quá khứ` khi đặt hôm nay lúc sáng sớm | Chưa đặt múi giờ | Làm mục 3.1 |
| Đăng nhập rồi vẫn báo `Vui lòng đăng nhập` | Gọi API từ domain/cổng khác nên không có cookie | Luôn thử trên `http://localhost/hotel/...` |
| `Dữ liệu này đang được dùng ở đơn đặt phòng...` | Xóa thứ đã có đơn tham chiếu | Đúng như thiết kế, không xóa được |

---

## 10. Phụ lục A: frontend ghép API vào `js/api.js`

*Phần này dành cho người làm frontend.*

Trong `js/api.js`, bên trong `const API = (() => { ... })()`:

1. Giữ hai hàm `isoDate`, `nights` ở đầu file, hằng `SESSION_KEY` và hàm `currentUser`.
2. Thêm hàm gọi API:

```js
const BASE = 'api';

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) localStorage.removeItem(SESSION_KEY);
  if (!res.ok) throw new Error(data?.message || 'Có lỗi xảy ra, vui lòng thử lại');
  return data;
}
```

3. Backend xong API nào thì đổi hàm tương ứng. Hàm nào backend chưa làm thì **cứ để chạy dữ liệu giả**.
   Khi xong hết, phần `return` sẽ như sau và có thể xóa toàn bộ dữ liệu giả (`seed`, `db`, `save`...):

```js
return {
  async login(email, password) {
    const { user } = await request('POST', '/auth/login', { email, password });
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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

  getRooms: () => request('GET', '/rooms'),
  saveRoom: r => r.id ? request('PUT', `/rooms/${r.id}`, r) : request('POST', '/rooms', r),
  deleteRoom: id => request('DELETE', `/rooms/${id}`),

  createBooking: d => request('POST', '/bookings', d),
  getBookings: () => request('GET', '/bookings'),
  myBookings: () => request('GET', '/bookings/me'),
  confirmBooking: id => request('PATCH', `/bookings/${id}/confirm`),
  cancelBooking: id => request('PATCH', `/bookings/${id}/cancel`),
  checkIn: (id, roomId) => request('POST', `/bookings/${id}/check-in`, { roomId }),
  addService: (id, s) => request('POST', `/bookings/${id}/services`, s),
  removeService: (id, sid) => request('DELETE', `/bookings/${id}/services/${sid}`),
  checkOut: id => request('POST', `/bookings/${id}/check-out`),
  getServices: () => request('GET', '/services'),

  getUsers: role => request('GET', '/users' + (role ? `?role=${role}` : '')),
  saveUser: u => u.id ? request('PUT', `/users/${u.id}`, u) : request('POST', '/users', u),
  deleteUser: id => request('DELETE', `/users/${id}`),

  revenue: period => request('GET', `/stats/revenue?period=${period}`),
  roomStats: () => request('GET', '/stats/rooms'),
};
```

Ghép xong mỗi đợt, chạy lại đúng các màn hình ở bảng 8.1 và xem tab **Network** (F12).

---

## 11. Phụ lục B: dạng dữ liệu trả về

Tên field phải **đúng y hệt** (chữ hoa/thường), số phải là **số** (không phải chuỗi), ngày dạng `"YYYY-MM-DD"`.

```js
RoomType = {
  id: 1, name: "Standard", price: 600000, capacity: 2,
  image: "public/images/room.webp",
  amenities: ["Wi-Fi", "Điều hòa"],
  description: "…",
  available: 3            // chỉ có ở API room-types/available
}

Room = { id: 1, number: "101", typeId: 1, typeName: "Standard",
         status: "available" | "occupied" | "maintenance" }

User = { id: 1, name: "…", email: "…", phone: "…",
         role: "customer" | "receptionist" | "admin" }      // KHÔNG có password

Booking = {
  id: 12, customerId: 3,                                   // customerId null = khách vãng lai
  guest: { name: "…", phone: "…", email: "…" },
  typeId: 2, typeName: "Deluxe",
  roomId: 5, roomNumber: "201",                            // null cho tới khi nhận phòng
  checkIn: "2026-10-24", checkOut: "2026-10-26", guests: 2,
  payment: "cash" | "transfer", note: "…",
  status: "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled",
  services: [{ id: 7, name: "Nước suối", price: 15000, qty: 2 }],
  roomTotal: 1900000,                                      // số đêm × giá phòng
  total: 1930000,                                          // roomTotal + tổng dịch vụ
  createdAt: "2026-10-24", paidAt: null                    // paidAt = ngày trả phòng
}
```

`bookingOut()` trong `db.php` đã trả đúng dạng `Booking` này. `id` của đơn là số, frontend hiển thị nguyên số đó làm mã đơn.
