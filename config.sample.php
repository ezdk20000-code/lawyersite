<?php
/**
 * Скопируйте этот файл в config.php и заполните.
 * config.php не попадает в git (см. .gitignore).
 */
return [
    // Telegram: создайте бота у @BotFather и вставьте токен.
    // chat_id можно узнать, написав боту и открыв https://api.telegram.org/bot<TOKEN>/getUpdates
    'telegram_token'    => '',
    'telegram_chat_ids' => [/* '123456789' */],

    // Почта (используется функция mail() хостинга)
    'email_to'   => '',
    'email_from' => '',

    // Резервный журнал заявок. Храните вне публичной папки или закройте доступ (.htaccess уже это делает).
    'log_file' => __DIR__ . '/leads.log',
];
