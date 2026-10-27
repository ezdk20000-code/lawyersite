<?php
/**
 * Обработчик заявок: отправляет заявку в Telegram и/или на почту.
 * Настройки — в config.php (скопируйте config.sample.php в config.php).
 */

header('Content-Type: application/json; charset=utf-8');

function respond(bool $ok, string $error = ''): void
{
    if (!$ok) {
        http_response_code(400);
    }
    echo json_encode($ok ? ['ok' => true] : ['ok' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(false, 'method');
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    respond(false, 'config.php not found');
}
$config = require $configFile;

// Защита от ботов: форму отправляет только наш JS
if (($_POST['js'] ?? '') !== '1') {
    respond(false, 'bot');
}

function field(string $key, int $max = 500): string
{
    $value = trim((string)($_POST[$key] ?? ''));
    $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value);
    return mb_substr($value, 0, $max);
}

$phone = field('phone', 30);
if (strlen(preg_replace('/\D/', '', $phone)) !== 11) {
    respond(false, 'phone');
}
if (field('consent') === '') {
    respond(false, 'consent');
}

// Простое ограничение частоты: не чаще одной заявки в 30 секунд с одного IP
$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$lock = sys_get_temp_dir() . '/lawyersite_' . md5($ip);
if (is_file($lock) && time() - filemtime($lock) < 30) {
    respond(false, 'too often');
}
@touch($lock);

$rows = [
    'Тема'        => field('topic', 200),
    'Имя'         => field('name', 100),
    'Телефон'     => $phone,
    'Сообщение'   => field('message', 2000),
    'Источник'    => field('utm_source', 100),
    'Канал'       => field('utm_medium', 100),
    'Кампания'    => field('utm_campaign', 200),
    'Объявление'  => field('utm_content', 200),
    'Ключ. фраза' => field('utm_term', 200),
    'Оффер'       => field('s', 50),
    'yclid'       => field('yclid', 100),
    'Вход'        => field('landing', 500),
    'Страница'    => field('page', 500),
];

$lines = ["Новая заявка с сайта"];
foreach ($rows as $label => $value) {
    if ($value !== '') {
        $lines[] = "$label: $value";
    }
}
$lines[] = 'Время: ' . date('d.m.Y H:i');
$text = implode("\n", $lines);

$sent = false;

// --- Telegram ---
if (!empty($config['telegram_token']) && !empty($config['telegram_chat_ids'])) {
    foreach ((array)$config['telegram_chat_ids'] as $chatId) {
        $ch = curl_init('https://api.telegram.org/bot' . $config['telegram_token'] . '/sendMessage');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => ['chat_id' => $chatId, 'text' => $text, 'disable_web_page_preview' => 'true'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
        ]);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res !== false && $code === 200) {
            $sent = true;
        }
    }
}

// --- Почта ---
if (!empty($config['email_to'])) {
    $subject = '=?UTF-8?B?' . base64_encode('Заявка с сайта: ' . ($rows['Тема'] ?: 'консультация')) . '?=';
    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=utf-8',
        'From: ' . ($config['email_from'] ?? 'noreply@' . ($_SERVER['HTTP_HOST'] ?? 'localhost')),
    ];
    if (@mail($config['email_to'], $subject, $text, implode("\r\n", $headers))) {
        $sent = true;
    }
}

// --- Резервная копия в файл (на случай сбоя Telegram/почты) ---
if (!empty($config['log_file'])) {
    @file_put_contents($config['log_file'], $text . "\n-----\n", FILE_APPEND | LOCK_EX);
    $sent = $sent || is_file($config['log_file']);
}

respond($sent, $sent ? '' : 'delivery failed');
