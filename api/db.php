<?php
/* Kết nối database + các hàm dùng chung cho mọi route. */

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

if (!is_file(__DIR__ . '/config.php')) fail(500, 'Chưa có api/config.php. Hãy chép config.example.php thành config.php');
$cfg = require __DIR__ . '/config.php';
try {
    $pdo = new PDO("mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset=utf8mb4", $cfg['user'], $cfg['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    error_log($e->getMessage());
    fail(500, 'Không kết nối được database. Kiểm tra MySQL đã bật và api/config.php đúng chưa');
}

/* ----- Chuyển dữ liệu MySQL sang đúng dạng frontend đọc -----
 * PHP 8.0 trả cột số dưới dạng chuỗi ("0"), nên luôn ép (int). Chuỗi "0" trong JS bị coi là true. */

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
