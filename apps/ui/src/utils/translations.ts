export type Language = 'en' | 'ru' | 'uz';

export const translations = {
  en: {
    // UI JSON Screen
    'ui.json.instruction_placeholder': 'Describe what JSON you want…',
    'ui.json.schema_placeholder': '(Optional) Paste JSON Schema…',
    'ui.json.validate_schema': 'Validate schema',
    'ui.json.generate': 'Generate',
    'ui.json.tree_view': 'Tree',
    'ui.json.raw_view': 'Raw',
    'ui.json.invalid_json': 'Invalid JSON',
    'ui.json.repair': 'Repair JSON',
    'ui.json.download': 'Download .json',

    // UI Errors (Unified)
    'ui.err.title': 'Error',
    'ui.err.TIMEOUT': 'Provider timeout',
    'ui.err.PROVIDER_FAIL': 'Provider failed',
    'ui.err.INVALID_TAG': 'Missing required tag',
    'ui.err.CONTRACT_FAIL': 'Contract returned fail',
    'ui.err.OFFLINE': 'Runtime unavailable',
    'ui.err.INVALID_JSON': 'Invalid JSON',
    'ui.err.NO_CREDITS': 'Limit reached',
    'ui.err.details': 'Show details',
    'ui.err.copy_details': 'Copy details',

    // UI Maker Debug Labels
    'ui.debug.title': 'Debug',
    'ui.debug.provider': 'Provider',
    'ui.debug.model': 'Model',
    'ui.debug.latency': 'Latency (ms)',
    'ui.debug.tokens_in': 'Tokens in',
    'ui.debug.tokens_out': 'Tokens out',
    'ui.debug.warnings': 'Warnings',
    'ui.debug.raw': 'Raw output',
    'ui.debug.trace_id': 'Trace ID',
    'ui.debug.contract_status': 'Contract status',
    // UI Strings Pack v1.0
    'ui.app.name': 'Tele•GPT',
    'ui.btn.open_chat': 'Open chat',
    'ui.btn.retry': 'Retry',
    'ui.btn.copy': 'Copy',
    'ui.btn.select': 'Select',
    'ui.btn.expand': 'Expand',
    'ui.btn.collapse': 'Collapse',
    'ui.btn.clear': 'Clear',
    'ui.btn.stop': 'Stop',
    'ui.btn.send': 'Send',
    'ui.btn.close': 'Close',
    'ui.btn.done': 'Done',
    'ui.tab.chat': 'Chat',
    'ui.tab.translate': 'Translate',
    'ui.tab.json': 'JSON',
    'ui.mode.public': 'Public',
    'ui.mode.maker': 'Maker',
    'ui.status.ready': 'Ready',
    'ui.status.loading': 'Loading…',
    'ui.status.streaming': 'Streaming…',
    'ui.status.offline': 'Offline',
    'ui.status.degraded': 'Degraded',
    'ui.boot.title': 'Tele•GPT',
    'ui.boot.subtitle': 'AI Runtime is preparing the interface…',
    'ui.boot.runtime_status': 'Runtime status: {status}',
    'ui.boot.open_chat': 'Open chat',
    'ui.boot.retry': 'Retry check',
    'ui.header.about': 'About Tele•GPT',
    'ui.header.model': 'Model',
    'ui.header.mode': 'Mode',
    'ui.header.session': 'Session',
    'ui.menu.clear_chat': 'Clear chat',
    'ui.menu.export_session': 'Export session',
    'ui.menu.diagnostics': 'Diagnostics',
    'ui.menu.about': 'About',
    'ui.chat.placeholder': 'Type a message…',
    'ui.chat.offline_hint': 'Runtime offline — sending disabled',
    'ui.chat.jump_latest': 'Jump to latest',
    'ui.chat.stopped': 'Generation stopped',
    'ui.chat.invalid_format': 'Invalid response format (missing required tag)',
    'ui.chat.typing': 'Typing…',
    'ui.translate.input_placeholder': 'Paste or type text to translate…',
    'ui.translate.swap': 'Swap',
    'ui.translate.translate': 'Translate',
    'ui.translate.send_to_chat': 'Send to chat',
    'ui.translate.replace_input': 'Replace input',
    'ui.translate.source_auto': 'Auto',
    'ui.translate.target_required': 'Choose target language',
    'ui.translate.too_long': 'Text is too long',

    // 1.2 Generic Buttons
    'btn.send': 'Send',
    'btn.stop': 'Stop',
    'btn.clear': 'Clear',
    'btn.retry': 'Retry',
    'btn.copy': 'Copy',
    'btn.select': 'Select',
    'btn.expand': 'Expand',
    'btn.close': 'Close',
    'btn.confirm': 'Confirm',
    'btn.cancel': 'Cancel',

    // 2.1 Tabs
    'tab.chat': 'Chat',
    'tab.translate': 'Translate',
    'tab.json': 'JSON',

    // 2.2 Runtime Status
    'status.ready': 'Ready',
    'status.loading': 'Loading…',
    'status.streaming': 'Streaming…',
    'status.offline': 'Offline',
    'status.degraded': 'Degraded',
    'status.error': 'Error',

    // 2.3 Mode Toggle
    'mode.public': 'Public',
    'mode.maker': 'Maker',

    // 3.1 Input
    'chat.placeholder': 'Type a message…',
    'chat.disabled.offline': 'Runtime offline',

    // 3.2 System Messages
    'sys.invalid_format': 'Invalid response format',
    'sys.generation_stopped': 'Generation stopped',
    'sys.timeout': 'Request timeout',
    'sys.provider_fail': 'Provider error',
    'sys.contract_fail': 'Request failed',

    // 4.1 Debug Labels
    'dbg.provider': 'Provider',
    'dbg.model': 'Model',
    'dbg.latency': 'Latency (ms)',
    'dbg.tokens_in': 'Tokens In',
    'dbg.tokens_out': 'Tokens Out',
    'dbg.warnings': 'Warnings',
    'dbg.raw': 'Raw Output',
    'dbg.contract': 'Contract Status',
    'dbg.trace_id': 'Trace ID',

    // 5.1 Translate Inputs
    'tr.placeholder': 'Paste or type text to translate…',
    'tr.auto': 'Auto',

    // 5.2 Translate Actions
    'tr.swap': 'Swap languages',
    'tr.send_chat': 'Send to Chat',
    'tr.replace': 'Replace input',

    // 6.1 JSON Inputs
    'json.instruction': 'Describe what JSON you want…',
    'json.schema': 'JSON Schema (optional)',
    'json.instruction_label': 'Instruction',
    'json.view_tree': 'Tree',
    'json.view_raw': 'Raw',
    'json.generating': 'Generating JSON...',
    'json.output_placeholder': 'JSON output will appear here',
    'json.invalid_schema': 'Invalid JSON Schema',
    'json.download': 'Download',

    // 6.2 JSON States
    'json.invalid': 'Invalid JSON',
    'json.repair': 'Repair JSON',
    'json.validate': 'Validate schema',

    // 7 Voice Mode
    'voice.listen': 'Listening…',
    'voice.speak': 'Speaking…',
    'voice.mic_error': 'Microphone access denied',

    // Composer Additional
    'composer.voice_soon': 'Voice Mode (Coming Soon)',
    'composer.clear_tooltip': 'Clear input (Cmd+L)',
    'composer.stop_recording': 'Tap to stop recording',
    'composer.generating': 'Generating response...',
    'composer.disclaimer': 'Tele•GPT can make mistakes. Check important info.',
    'composer.processing': 'Processing audio...',

    // Modals
    'modal.clear.title': 'Clear Input',
    'modal.clear.description': 'Are you sure you want to clear your message draft?',
    'modal.clear.confirm': 'Clear Text',

    // Start Screen
    'start.open_chat': 'Open Chat',
    'start.last_activity': 'Last activity:',
    'start.build': 'Build:',
    'app.subtitle': 'AI Runtime Layer',

    // Translate Additional
    'tr.detect': 'Detect Language',
    'tr.output_placeholder': 'Translation will appear here',
    'btn.translate': 'Translate',
    'btn.generate': 'Generate JSON',

    // Chat Screen
    'chat.start.title': 'Start a conversation with Tele•GPT',
    'chat.start.icon': '💬',
    'chat.user': 'You',
    'chat.assistant': 'Tele•GPT',
    'chat.debug': 'Debug',
    'chat.error.parse': '[Parse Error] Missing <{tag}> tag',
    'chat.error.protocol': 'The model response did not match the expected protocol.',
  },
  ru: {
    // UI JSON Screen
    'ui.json.instruction_placeholder': 'Опишите, какой JSON нужен…',
    'ui.json.schema_placeholder': '(Опционально) Вставьте JSON Schema…',
    'ui.json.validate_schema': 'Проверить схему',
    'ui.json.generate': 'Сгенерировать',
    'ui.json.tree_view': 'Дерево',
    'ui.json.raw_view': 'Текст',
    'ui.json.invalid_json': 'Невалидный JSON',
    'ui.json.repair': 'Починить JSON',
    'ui.json.download': 'Скачать .json',

    // UI Errors (Unified)
    'ui.err.title': 'Ошибка',
    'ui.err.TIMEOUT': 'Таймаут провайдера',
    'ui.err.PROVIDER_FAIL': 'Ошибка провайдера',
    'ui.err.INVALID_TAG': 'Нет нужного тега в ответе',
    'ui.err.CONTRACT_FAIL': 'Контракт вернул fail',
    'ui.err.OFFLINE': 'Runtime недоступен',
    'ui.err.INVALID_JSON': 'Невалидный JSON',
    'ui.err.NO_CREDITS': 'Лимит исчерпан',
    'ui.err.details': 'Показать детали',
    'ui.err.copy_details': 'Копировать детали',

    // UI Maker Debug Labels
    'ui.debug.title': 'Debug',
    'ui.debug.provider': 'Провайдер',
    'ui.debug.model': 'Модель',
    'ui.debug.latency': 'Задержка (ms)',
    'ui.debug.tokens_in': 'Токены вход',
    'ui.debug.tokens_out': 'Токены выход',
    'ui.debug.warnings': 'Предупреждения',
    'ui.debug.raw': 'Raw вывод',
    'ui.debug.trace_id': 'Trace ID',
    'ui.debug.contract_status': 'Статус контракта',
    // UI Strings Pack v1.0
    'ui.app.name': 'Tele•GPT',
    'ui.btn.open_chat': 'Открыть чат',
    'ui.btn.retry': 'Повторить',
    'ui.btn.copy': 'Копировать',
    'ui.btn.select': 'Выделить',
    'ui.btn.expand': 'Развернуть',
    'ui.btn.collapse': 'Свернуть',
    'ui.btn.clear': 'Очистить',
    'ui.btn.stop': 'Стоп',
    'ui.btn.send': 'Отправить',
    'ui.btn.close': 'Закрыть',
    'ui.btn.done': 'Готово',
    'ui.tab.chat': 'Чат',
    'ui.tab.translate': 'Перевод',
    'ui.tab.json': 'JSON',
    'ui.mode.public': 'Public',
    'ui.mode.maker': 'Maker',
    'ui.status.ready': 'Готово',
    'ui.status.loading': 'Загрузка…',
    'ui.status.streaming': 'Генерация…',
    'ui.status.offline': 'Оффлайн',
    'ui.status.degraded': 'Частично доступно',
    'ui.boot.title': 'Tele•GPT',
    'ui.boot.subtitle': 'AI Runtime готовит интерфейс…',
    'ui.boot.runtime_status': 'Статус Runtime: {status}',
    'ui.boot.open_chat': 'Открыть чат',
    'ui.boot.retry': 'Повторить проверку',
    'ui.header.about': 'О Tele•GPT',
    'ui.header.model': 'Модель',
    'ui.header.mode': 'Режим',
    'ui.header.session': 'Сессия',
    'ui.menu.clear_chat': 'Очистить чат',
    'ui.menu.export_session': 'Экспорт сессии',
    'ui.menu.diagnostics': 'Диагностика',
    'ui.menu.about': 'О продукте',
    'ui.chat.placeholder': 'Напишите сообщение…',
    'ui.chat.offline_hint': 'Runtime оффлайн — отправка недоступна',
    'ui.chat.jump_latest': 'К последним',
    'ui.chat.stopped': 'Генерация остановлена',
    'ui.chat.invalid_format': 'Неверный формат ответа (нет нужного тега)',
    'ui.chat.typing': 'Печатает…',
    'ui.translate.input_placeholder': 'Вставьте или введите текст для перевода…',
    'ui.translate.swap': 'Поменять местами',
    'ui.translate.translate': 'Перевести',
    'ui.translate.send_to_chat': 'Отправить в чат',
    'ui.translate.replace_input': 'Заменить текст',
    'ui.translate.source_auto': 'Авто',
    'ui.translate.target_required': 'Выберите язык перевода',
    'ui.translate.too_long': 'Текст слишком длинный',

    // 1.2 Generic Buttons
    'btn.send': 'Отправить',
    'btn.stop': 'Остановить',
    'btn.clear': 'Очистить',
    'btn.retry': 'Повторить',
    'btn.copy': 'Копировать',
    'btn.select': 'Выделить',
    'btn.expand': 'Развернуть',
    'btn.close': 'Закрыть',
    'btn.confirm': 'Подтвердить',
    'btn.cancel': 'Отмена',

    // 2.1 Tabs
    'tab.chat': 'Чат',
    'tab.translate': 'Перевод',
    'tab.json': 'JSON',

    // 2.2 Runtime Status
    'status.ready': 'Готов',
    'status.loading': 'Загрузка…',
    'status.streaming': 'Генерация…',
    'status.offline': 'Недоступен',
    'status.degraded': 'Ограничен',
    'status.error': 'Ошибка',

    // 2.3 Mode Toggle
    'mode.public': 'Публичный',
    'mode.maker': 'Maker',

    // 3.1 Input
    'chat.placeholder': 'Введите сообщение…',
    'chat.disabled.offline': 'Сервис недоступен',

    // 3.2 System Messages
    'sys.invalid_format': 'Неверный формат ответа',
    'sys.generation_stopped': 'Генерация остановлена',
    'sys.timeout': 'Таймаут запроса',
    'sys.provider_fail': 'Ошибка провайдера',
    'sys.contract_fail': 'Ошибка запроса',

    // 4.1 Debug Labels
    'dbg.provider': 'Провайдер',
    'dbg.model': 'Модель',
    'dbg.latency': 'Задержка (мс)',
    'dbg.tokens_in': 'Входные токены',
    'dbg.tokens_out': 'Выходные токены',
    'dbg.warnings': 'Предупреждения',
    'dbg.raw': 'Сырой вывод',
    'dbg.contract': 'Статус контракта',
    'dbg.trace_id': 'Идентификатор трассировки',

    // 5.1 Translate Inputs
    'tr.placeholder': 'Вставьте или введите текст…',
    'tr.auto': 'Авто',

    // 5.2 Translate Actions
    'tr.swap': 'Поменять языки',
    'tr.send_chat': 'Отправить в чат',
    'tr.replace': 'Заменить текст',

    // 6.1 JSON Inputs
    'json.instruction': 'Опишите JSON…',
    'json.schema': 'JSON-схема (необязательно)',
    'json.instruction_label': 'Инструкция',
    'json.view_tree': 'Дерево',
    'json.view_raw': 'Код',
    'json.generating': 'Генерация JSON...',
    'json.output_placeholder': 'Здесь появится JSON',
    'json.invalid_schema': 'Невалидная схема',
    'json.download': 'Скачать',

    // 6.2 JSON States
    'json.invalid': 'Невалидный JSON',
    'json.repair': 'Починить JSON',
    'json.validate': 'Проверить схему',

    // 7 Voice Mode
    'voice.listen': 'Слушаю…',
    'voice.speak': 'Говорю…',
    'voice.mic_error': 'Нет доступа к микрофону',

    // Composer Additional
    'composer.voice_soon': 'Голосовой режим (Скоро)',
    'composer.clear_tooltip': 'Очистить ввод (Cmd+L)',
    'composer.stop_recording': 'Нажмите, чтобы остановить запись',
    'composer.generating': 'Генерация ответа...',
    'composer.disclaimer': 'Tele•GPT может ошибаться. Проверяйте информацию.',
    'composer.processing': 'Обработка аудио...',

    // Modals
    'modal.clear.title': 'Очистить ввод',
    'modal.clear.description': 'Вы уверены, что хотите удалить черновик сообщения?',
    'modal.clear.confirm': 'Очистить текст',

    // Start Screen
    'start.open_chat': 'Открыть чат',
    'start.last_activity': 'Последняя активность:',
    'start.build': 'Сборка:',
    'app.subtitle': 'Слой AI Runtime',

    // Translate Additional
    'tr.detect': 'Определить язык',
    'tr.output_placeholder': 'Здесь появится перевод',
    'btn.translate': 'Перевести',
    'btn.generate': 'Сгенерировать JSON',

    // Chat Screen
    'chat.start.title': 'Начните разговор с Tele•GPT',
    'chat.start.icon': '💬',
    'chat.user': 'Вы',
    'chat.assistant': 'Tele•GPT',
    'chat.debug': 'Отладка',
    'chat.error.parse': '[Ошибка парсинга] Отсутствует тег <{tag}>',
    'chat.error.protocol': 'Ответ модели не соответствует ожидаемому протоколу.',
  },
  uz: {
    // UI JSON Screen
    'ui.json.instruction_placeholder': 'Qanday JSON kerakligini yozing…',
    'ui.json.schema_placeholder': '(Ixtiyoriy) JSON Schema joylang…',
    'ui.json.validate_schema': 'Sxemani tekshirish',
    'ui.json.generate': 'Yaratish',
    'ui.json.tree_view': 'Daraxt',
    'ui.json.raw_view': 'Matn',
    'ui.json.invalid_json': 'JSON noto‘g‘ri',
    'ui.json.repair': 'JSONni tuzatish',
    'ui.json.download': '.json yuklab olish',

    // UI Errors (Unified)
    'ui.err.title': 'Xatolik',
    'ui.err.TIMEOUT': 'Provayder vaqti tugadi',
    'ui.err.PROVIDER_FAIL': 'Provayder xatosi',
    'ui.err.INVALID_TAG': 'Javobda kerakli teg yo‘q',
    'ui.err.CONTRACT_FAIL': 'Kontrakt fail qaytardi',
    'ui.err.OFFLINE': 'Runtime mavjud emas',
    'ui.err.INVALID_JSON': 'JSON noto‘g‘ri',
    'ui.err.NO_CREDITS': 'Limit tugadi',
    'ui.err.details': 'Tafsilotlarni ko‘rsatish',
    'ui.err.copy_details': 'Tafsilotlarni nusxa olish',

    // UI Maker Debug Labels
    'ui.debug.title': 'Debug',
    'ui.debug.provider': 'Provayder',
    'ui.debug.model': 'Model',
    'ui.debug.latency': 'Kechikish (ms)',
    'ui.debug.tokens_in': 'Token kirish',
    'ui.debug.tokens_out': 'Token chiqish',
    'ui.debug.warnings': 'Ogohlantirishlar',
    'ui.debug.raw': 'Raw chiqish',
    'ui.debug.trace_id': 'Trace ID',
    'ui.debug.contract_status': 'Kontrakt holati',
    // UI Strings Pack v1.0
    'ui.app.name': 'Tele•GPT',
    'ui.btn.open_chat': 'Chatni ochish',
    'ui.btn.retry': 'Qayta urinish',
    'ui.btn.copy': 'Nusxa olish',
    'ui.btn.select': 'Tanlash',
    'ui.btn.expand': 'Kengaytirish',
    'ui.btn.collapse': 'Yig‘ish',
    'ui.btn.clear': 'Tozalash',
    'ui.btn.stop': 'To‘xtatish',
    'ui.btn.send': 'Yuborish',
    'ui.btn.close': 'Yopish',
    'ui.btn.done': 'Tayyor',
    'ui.tab.chat': 'Chat',
    'ui.tab.translate': 'Tarjima',
    'ui.tab.json': 'JSON',
    'ui.mode.public': 'Public',
    'ui.mode.maker': 'Maker',
    'ui.status.ready': 'Tayyor',
    'ui.status.loading': 'Yuklanmoqda…',
    'ui.status.streaming': 'Yaratilmoqda…',
    'ui.status.offline': 'Offline',
    'ui.status.degraded': 'Qisman ishlayapti',
    'ui.boot.title': 'Tele•GPT',
    'ui.boot.subtitle': 'AI Runtime interfeysni tayyorlamoqda…',
    'ui.boot.runtime_status': 'Runtime holati: {status}',
    'ui.boot.open_chat': 'Chatni ochish',
    'ui.boot.retry': 'Tekshiruvni qayta urinish',
    'ui.header.about': 'Tele•GPT haqida',
    'ui.header.model': 'Model',
    'ui.header.mode': 'Rejim',
    'ui.header.session': 'Sessiya',
    'ui.menu.clear_chat': 'Chatni tozalash',
    'ui.menu.export_session': 'Sessiyani eksport qilish',
    'ui.menu.diagnostics': 'Diagnostika',
    'ui.menu.about': 'Mahsulot haqida',
    'ui.chat.placeholder': 'Xabar yozing…',
    'ui.chat.offline_hint': 'Runtime offline — yuborib bo‘lmaydi',
    'ui.chat.jump_latest': 'Oxirgilariga',
    'ui.chat.stopped': 'Yaratish to‘xtatildi',
    'ui.chat.invalid_format': 'Javob formati noto‘g‘ri (kerakli teg yo‘q)',
    'ui.chat.typing': 'Yozmoqda…',
    'ui.translate.input_placeholder': 'Tarjima uchun matn kiriting yoki qo‘ying…',
    'ui.translate.swap': 'Joyini almashtirish',
    'ui.translate.translate': 'Tarjima qilish',
    'ui.translate.send_to_chat': 'Chatga yuborish',
    'ui.translate.replace_input': 'Matnni almashtirish',
    'ui.translate.source_auto': 'Avto',
    'ui.translate.target_required': 'Tarjima tilini tanlang',
    'ui.translate.too_long': 'Matn juda uzun',

    // 1.2 Generic Buttons
    'btn.send': 'Yuborish',
    'btn.stop': 'To‘xtatish',
    'btn.clear': 'Tozalash',
    'btn.retry': 'Qayta urinish',
    'btn.copy': 'Nusxalash',
    'btn.select': 'Tanlash',
    'btn.expand': 'Kengaytirish',
    'btn.close': 'Yopish',
    'btn.confirm': 'Tasdiqlash',
    'btn.cancel': 'Bekor qilish',

    // 2.1 Tabs
    'tab.chat': 'Chat',
    'tab.translate': 'Tarjima',
    'tab.json': 'JSON',

    // 2.2 Runtime Status
    'status.ready': 'Tayyor',
    'status.loading': 'Yuklanmoqda…',
    'status.streaming': 'Yaratilmoqda…',
    'status.offline': 'O‘chiq',
    'status.degraded': 'Cheklangan',
    'status.error': 'Xato',

    // 2.3 Mode Toggle
    'mode.public': 'Ommaviy',
    'mode.maker': 'Maker',

    // 3.1 Input
    'chat.placeholder': 'Xabar yozing…',
    'chat.disabled.offline': 'Xizmat o‘chiq',

    // 3.2 System Messages
    'sys.invalid_format': 'Noto‘g‘ri javob formati',
    'sys.generation_stopped': 'Yaratish to‘xtatildi',
    'sys.timeout': 'So‘rov vaqti tugadi',
    'sys.provider_fail': 'Provayder xatosi',
    'sys.contract_fail': 'So‘rov muvaffaqiyatsiz',

    // 4.1 Debug Labels
    'dbg.provider': 'Provayder',
    'dbg.model': 'Model',
    'dbg.latency': 'Kechikish (ms)',
    'dbg.tokens_in': 'Kirish tokenlari',
    'dbg.tokens_out': 'Chiqish tokenlari',
    'dbg.warnings': 'Ogohlantirishlar',
    'dbg.raw': 'Xom natija',
    'dbg.contract': 'Shartnoma holati',
    'dbg.trace_id': 'Izlanish IDsi',

    // 5.1 Translate Inputs
    'tr.placeholder': 'Matnni kiriting…',
    'tr.auto': 'Avto',

    // 5.2 Translate Actions
    'tr.swap': 'Tillarni almashtirish',
    'tr.send_chat': 'Chatga yuborish',
    'tr.replace': 'Matnni almashtirish',

    // 6.1 JSON Inputs
    'json.instruction': 'JSONni tasvirlang…',
    'json.schema': 'JSON sxema (ixtiyoriy)',
    'json.instruction_label': 'Ko‘rsatma',
    'json.view_tree': 'Daraxt',
    'json.view_raw': 'Kod',
    'json.generating': 'JSON yaratilmoqda...',
    'json.output_placeholder': 'JSON shu yerda paydo bo‘ladi',
    'json.invalid_schema': 'Noto‘g‘ri sxema',
    'json.download': 'Yuklab olish',

    // 6.2 JSON States
    'json.invalid': 'Noto‘g‘ri JSON',
    'json.repair': 'JSONni tuzatish',
    'json.validate': 'Sxemani tekshirish',

    // 7 Voice Mode
    'voice.listen': 'Tinglayapman…',
    'voice.speak': 'Gapiryapman…',
    'voice.mic_error': 'Mikrofon ruxsati yo‘q',

    // Composer Additional
    'composer.voice_soon': 'Ovozli rejim (Tez orada)',
    'composer.clear_tooltip': 'Kiritishni tozalash (Cmd+L)',
    'composer.stop_recording': 'Yozishni to‘xtatish uchun bosing',
    'composer.generating': 'Javob yaratilmoqda...',
    'composer.disclaimer': 'Tele•GPT xato qilishi mumkin. Muhim maʼlumotlarni tekshiring.',
    'composer.processing': 'Audio qayta ishlanmoqda...',

    // Modals
    'modal.clear.title': 'Kiritishni tozalash',
    'modal.clear.description': 'Xabar qoralamasini o‘chirib tashlashga ishonchingiz komilmi?',
    'modal.clear.confirm': 'Matnni tozalash',

    // Start Screen
    'start.open_chat': 'Chatni ochish',
    'start.last_activity': 'Oxirgi faoliyat:',
    'start.build': 'Versiya:',
    'app.subtitle': 'AI Runtime Qatlami',

    // Translate Additional
    'tr.detect': 'Tilni aniqlash',
    'tr.output_placeholder': 'Tarjima shu yerda paydo bo‘ladi',
    'btn.translate': 'Tarjima qilish',
    'btn.generate': 'JSON yaratish',

    // Chat Screen
    'chat.start.title': 'Tele•GPT bilan suhbatni boshlang',
    'chat.start.icon': '💬',
    'chat.user': 'Siz',
    'chat.assistant': 'Tele•GPT',
    'chat.debug': 'Nosozliklarni tuzatish',
    'chat.error.parse': '[Tahlil xatosi] <{tag}> tegi yo‘q',
    'chat.error.protocol': 'Model javobi kutilgan protokolga mos kelmadi.',
  }
};
