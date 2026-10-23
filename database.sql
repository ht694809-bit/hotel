-- Database cho hệ thống quản lý khách sạn SOLENA.
-- CHẠY LẠI FILE NÀY SẼ XÓA SẠCH DỮ LIỆU CŨ của database `hotel` rồi tạo lại từ đầu.
-- Ai sửa cấu trúc bảng thì sửa file này, commit, và báo người kia chạy lại.
--
-- Tài khoản mẫu (mật khẩu đã mã hóa bằng password_hash):
--   admin@solena.vn / admin123      (quản trị)
--   letan@solena.vn / 123456        (lễ tân)
--   khach@gmail.com / 123456        (khách)
--   hoa@gmail.com   / 123456        (khách)

DROP DATABASE IF EXISTS hotel;
CREATE DATABASE hotel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hotel;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password VARCHAR(255) NOT NULL,
  role ENUM('customer','receptionist','admin') NOT NULL DEFAULT 'customer'
);

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  price INT NOT NULL,
  capacity INT NOT NULL,
  image VARCHAR(255),
  amenities TEXT,                       -- JSON: ["Wi-Fi","Điều hòa"]
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
  customer_id INT NULL,                 -- NULL = khách vãng lai không đăng nhập
  guest_name VARCHAR(100) NOT NULL,
  guest_phone VARCHAR(20) NOT NULL,
  guest_email VARCHAR(150),
  type_id INT NOT NULL,
  room_id INT NULL,                     -- gán khi check-in
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INT NOT NULL,
  payment ENUM('cash','transfer') NOT NULL,
  note VARCHAR(250),
  status ENUM('pending','confirmed','checked_in','checked_out','cancelled') NOT NULL DEFAULT 'pending',
  room_total INT NOT NULL,
  created_at DATE NOT NULL,
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

-- ===== Dữ liệu mẫu (giống dữ liệu giả trong js/api.js) =====

INSERT INTO users (id, name, email, phone, password, role) VALUES
(1, 'Quản trị viên', 'admin@solena.vn', '0900000001', '$2y$10$6y8RE7wUeaR0YAcYr6K1Bu//537N5cDOfDjO5EznM5di8FbJqg4TG', 'admin'),
(2, 'Nguyễn Lễ Tân', 'letan@solena.vn', '0900000002', '$2y$10$fHpiAjKxjCBJeFMfslbs/OU/HkCw1ykpREMrYV1gNUkOG5YDD5daa', 'receptionist'),
(3, 'Trần Văn Khách', 'khach@gmail.com', '0912345678', '$2y$10$fHpiAjKxjCBJeFMfslbs/OU/HkCw1ykpREMrYV1gNUkOG5YDD5daa', 'customer'),
(4, 'Lê Thị Hoa', 'hoa@gmail.com', '0987654321', '$2y$10$fHpiAjKxjCBJeFMfslbs/OU/HkCw1ykpREMrYV1gNUkOG5YDD5daa', 'customer');

INSERT INTO room_types (id, name, price, capacity, image, amenities, description) VALUES
(1, 'Standard', 600000, 2, 'public/images/room.webp', '["Wi-Fi","Điều hòa","TV","Nước nóng"]',
 'Phòng tiêu chuẩn 22m², giường đôi, cửa sổ hướng phố. Phù hợp cho cặp đôi hoặc khách công tác.'),
(2, 'Deluxe', 950000, 3, 'public/images/family-room.png', '["Wi-Fi","Điều hòa","Smart TV","Minibar","Bồn tắm"]',
 'Phòng 30m² với ban công riêng, 1 giường đôi + 1 giường đơn, nội thất gỗ ấm cúng.'),
(3, 'VIP', 1600000, 4, 'public/images/ocean-suite.png', '["Wi-Fi","Điều hòa","Smart TV","Minibar","Bồn tắm","View biển","Ăn sáng"]',
 'Phòng 42m² view biển toàn cảnh, 2 giường đôi lớn, bao gồm bữa sáng buffet.'),
(4, 'Suite', 2800000, 4, 'public/images/sky-suite.png', '["Wi-Fi","Phòng khách riêng","Bếp nhỏ","Bồn sục","View biển","Ăn sáng","Đưa đón sân bay"]',
 'Căn suite 65m² gồm phòng ngủ và phòng khách riêng biệt, dịch vụ quản gia 24/7.');

INSERT INTO rooms (id, number, type_id, status) VALUES
(1, '101', 1, 'available'), (2, '102', 1, 'available'), (3, '103', 1, 'available'), (4, '104', 1, 'available'),
(5, '201', 2, 'occupied'),  (6, '202', 2, 'available'), (7, '203', 2, 'available'),
(8, '301', 3, 'available'), (9, '302', 3, 'maintenance'),
(10, '401', 4, 'available');

INSERT INTO services (name, price) VALUES
('Nước suối', 15000), ('Bia', 30000), ('Nước ngọt', 25000),
('Giặt ủi', 50000), ('Ăn sáng', 120000), ('Minibar', 80000);

-- Ngày tính theo ngày chạy file, để lúc nào import cũng có đơn hôm nay / sắp tới / đã qua
INSERT INTO bookings (id, customer_id, guest_name, guest_phone, guest_email, type_id, room_id, check_in, check_out, guests, payment, status, room_total, created_at, paid_at) VALUES
(1, 3, 'Trần Văn Khách', '0912345678', 'khach@gmail.com', 1, 1, CURDATE() - INTERVAL 400 DAY, CURDATE() - INTERVAL 398 DAY, 2, 'cash', 'checked_out', 1200000, CURDATE() - INTERVAL 403 DAY, CURDATE() - INTERVAL 398 DAY),
(2, 4, 'Lê Thị Hoa', '0987654321', 'hoa@gmail.com', 3, 8, CURDATE() - INTERVAL 45 DAY, CURDATE() - INTERVAL 43 DAY, 2, 'transfer', 'checked_out', 3200000, CURDATE() - INTERVAL 48 DAY, CURDATE() - INTERVAL 43 DAY),
(3, 3, 'Trần Văn Khách', '0912345678', 'khach@gmail.com', 1, 2, CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 18 DAY, 2, 'cash', 'checked_out', 1200000, CURDATE() - INTERVAL 23 DAY, CURDATE() - INTERVAL 18 DAY),
(4, NULL, 'Phạm Minh Tuấn', '0933111222', '', 2, 6, CURDATE() - INTERVAL 5 DAY, CURDATE() - INTERVAL 3 DAY, 2, 'cash', 'checked_out', 1900000, CURDATE() - INTERVAL 8 DAY, CURDATE() - INTERVAL 3 DAY),
(5, 3, 'Trần Văn Khách', '0912345678', 'khach@gmail.com', 2, 5, CURDATE() - INTERVAL 1 DAY, CURDATE() + INTERVAL 2 DAY, 2, 'cash', 'checked_in', 2850000, CURDATE() - INTERVAL 4 DAY, NULL),
(6, NULL, 'Đỗ Thu Trang', '0977000111', 'trang@gmail.com', 4, NULL, CURDATE(), CURDATE() + INTERVAL 2 DAY, 2, 'transfer', 'confirmed', 5600000, CURDATE() - INTERVAL 3 DAY, NULL),
(7, 4, 'Lê Thị Hoa', '0987654321', 'hoa@gmail.com', 1, NULL, CURDATE() + INTERVAL 3 DAY, CURDATE() + INTERVAL 5 DAY, 2, 'cash', 'pending', 1200000, CURDATE(), NULL);

INSERT INTO booking_services (booking_id, name, price, qty) VALUES
(2, 'Ăn sáng', 120000, 4),
(3, 'Nước suối', 15000, 2),
(5, 'Giặt ủi', 50000, 1);
