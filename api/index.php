<?php
/* Mọi request /api/... đều vào đây (xem .htaccess). Danh sách endpoint: HUONG-DAN-BACKEND.md, Bước 6. */
ini_set('display_errors', '0'); // cảnh báo PHP lẫn vào sẽ làm hỏng JSON; lỗi ghi vào xampp/apache/logs/error.log
session_start();
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = trim($_GET['path'] ?? '', '/');            // vd: bookings/12/confirm
$p = explode('/', $path);                          // ['bookings', '12', 'confirm']
$body = json_decode(file_get_contents('php://input'), true) ?? []; // JSON body ($_POST sẽ rỗng)

try {
    /* ===== Tài khoản ===== */
    if ($method === 'POST' && $path === 'auth/login') {
        $s = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $s->execute([strtolower(trim($body['email'] ?? ''))]);
        $u = $s->fetch();
        if (!$u || !password_verify($body['password'] ?? '', $u['password'])) fail(400, 'Email hoặc mật khẩu không đúng');
        session_regenerate_id(true);
        $_SESSION['user'] = userOut($u);
        ok(['user' => $_SESSION['user']]);
    }

    if ($method === 'POST' && $path === 'auth/register') {
        $name = trim($body['name'] ?? '');
        $email = strtolower(trim($body['email'] ?? ''));
        $phone = trim($body['phone'] ?? '');
        $password = $body['password'] ?? '';
        if (strlen($name) < 2) fail(400, 'Vui lòng nhập họ tên');
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail(400, 'Email không hợp lệ');
        if (!preg_match('/^0\d{9,10}$/', $phone)) fail(400, 'Số điện thoại không hợp lệ');
        if (strlen($password) < 6) fail(400, 'Mật khẩu phải có ít nhất 6 ký tự');
        $s = $pdo->prepare('SELECT 1 FROM users WHERE email = ?');
        $s->execute([$email]);
        if ($s->fetch()) fail(400, 'Email đã được sử dụng');
        $pdo->prepare("INSERT INTO users (name, email, phone, password, role) VALUES (?, ?, ?, ?, 'customer')")
            ->execute([$name, $email, $phone, password_hash($password, PASSWORD_DEFAULT)]);
        session_regenerate_id(true);
        $_SESSION['user'] = ['id' => (int)$pdo->lastInsertId(), 'name' => $name, 'email' => $email, 'phone' => $phone, 'role' => 'customer'];
        ok(['user' => $_SESSION['user']], 201);
    }

    if ($method === 'POST' && $path === 'auth/logout') {
        session_destroy();
        ok();
    }

    /* ===== Loại phòng ===== */
    if ($method === 'GET' && $path === 'room-types') {
        ok(array_map('typeOut', $pdo->query('SELECT * FROM room_types ORDER BY price')->fetchAll()));
    }

    if ($method === 'GET' && $path === 'room-types/available') {
        $in = $_GET['checkIn'] ?? '';
        $out = $_GET['checkOut'] ?? '';
        if (!($out > $in)) fail(400, 'Ngày trả phòng phải sau ngày nhận phòng');
        // còn trống = phòng không bảo trì − đơn còn hiệu lực bị trùng ngày
        $s = $pdo->prepare("SELECT t.*, GREATEST(0,
                (SELECT COUNT(*) FROM rooms r WHERE r.type_id = t.id AND r.status <> 'maintenance')
              - (SELECT COUNT(*) FROM bookings b WHERE b.type_id = t.id
                   AND b.status IN ('pending','confirmed','checked_in')
                   AND b.check_in < ? AND ? < b.check_out)) AS available
            FROM room_types t WHERE t.capacity >= ? ORDER BY t.price");
        $s->execute([$out, $in, (int)($_GET['guests'] ?? 1)]);
        ok(array_map('typeOut', $s->fetchAll()));
    }

    /* ===== Đơn đặt phòng ===== */
    if ($method === 'GET' && $path === 'bookings') {
        requireRole('receptionist', 'admin');
        $rows = $pdo->query(BOOKING_SQL . ' ORDER BY b.id DESC')->fetchAll();
        ok(array_map(fn($b) => bookingOut($pdo, $b), $rows));
    }

    if ($method === 'PATCH' && $p[0] === 'bookings' && ($p[2] ?? '') === 'confirm') {
        requireRole('receptionist', 'admin');
        $s = $pdo->prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ? AND status = 'pending'");
        $s->execute([(int)$p[1]]);
        if (!$s->rowCount()) fail(400, 'Chỉ duyệt được đơn đang chờ');
        ok();
    }

    // TODO: các endpoint còn lại theo HUONG-DAN-BACKEND.md, Bước 6

    fail(404, 'Không tìm thấy API');
} catch (PDOException $e) {
    error_log($e->getMessage());
    if (($e->errorInfo[1] ?? 0) === 1062) fail(400, 'Dữ liệu bị trùng (email hoặc số phòng đã tồn tại)');
    fail(500, 'Lỗi máy chủ');
}
