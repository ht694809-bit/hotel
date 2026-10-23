# SOLENA – Web quản lý khách sạn

Frontend HTML/CSS/JS thuần + backend PHP thuần, chạy trên XAMPP (Apache + MySQL/MariaDB).

## Chạy trên máy

1. Đặt thư mục này tại `C:\xampp\htdocs\hotel\`. Bật **Apache** và **MySQL** trong XAMPP.
2. Tạo database: phpMyAdmin → tab **Import** → chọn `database.sql` → Go.
   (Chạy lại file này sẽ **xóa và tạo lại** database `hotel` với dữ liệu mẫu.)
3. Chép `api/config.example.php` thành `api/config.php`, sửa cho đúng MySQL trên máy bạn.
   Nếu MySQL của XAMPP chạy port khác 3306 (xem `C:\xampp\mysql\bin\my.ini`), sửa `port`.
4. Mở `http://localhost/hotel/`.

Tài khoản mẫu: `admin@solena.vn / admin123`, `letan@solena.vn / 123456`, `khach@gmail.com / 123456`.

## Chia việc

| Phần | Ai làm | File |
|---|---|---|
| Frontend | Frontend | `*.html`, `css/`, `js/` |
| Backend | Backend | `api/`, `database.sql` |
| Hợp đồng API | Cả hai | `HUONG-DAN-BACKEND.md` |

`js/api.js` đang chạy bằng dữ liệu giả. Backend làm xong endpoint nào thì đổi hàm tương ứng trong
`js/api.js` sang gọi `api/` (xem `HUONG-DAN-BACKEND.md`, mục 10 – Phụ lục A).

**Endpoint backend đã có:** `auth/login`, `auth/register`, `auth/logout`, `room-types`, `room-types/available`,
`bookings` (GET), `bookings/{id}/confirm`. Các endpoint còn lại xem mục 6 và 7 trong `HUONG-DAN-BACKEND.md`.

## Quy trình làm chung

- Mỗi tính năng một branch (`feature/dat-phong`, `feature/check-in`...), xong thì tạo Pull Request cho người kia xem.
- Đổi API (URL, field gửi/nhận) thì **sửa `HUONG-DAN-BACKEND.md` trong cùng commit** và báo người kia.
- Đổi cấu trúc bảng thì sửa `database.sql`, người kia Import lại.
- Không commit `api/config.php`.
