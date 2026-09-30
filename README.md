# DEEPFORGE — UI/UX 16.1

Обновление интерфейса поверх **Stage 16 (Rift Expedition)**. Это проход по удобству и адаптиву, а не Stage 17 Reactor Grid. Исходная база — Stage 16 из выданного архива; публикация выполняется пользователем.

## Установка

Скопируйте **содержимое этой папки** поверх существующей рабочей папки DEEPFORGE с заменой файлов. Не создавайте новую `.git`, не удаляйте текущую историю. Архив не содержит `.git`, `node_modules`, `dist`, `.env` и `package-lock.json`; существующий lockfile остаётся на месте.

```bat
publish.bat "fix: mobile portrait UI UX 16.1"
```

Исправленный `publish.bat` и workflow Pages сохранены. Версии зависимостей не изменены. После успешного deployment перезапустите страницу/PWA; **не очищайте данные сайта** — там находятся локальные сохранения.

## Изменения

Единая система размеров, цветов и кнопок; сворачиваемая панель подробностей; пять разделов нижней навигации; доступные нативные диалоги; один открытый экран; вкладки с клавиатурной навигацией; форма друзей с проверкой и честным Clipboard-статусом; обновление Canvas при изменении размера контейнера; корректная высота при изменении visualViewport без запрета zoom. Основные сохранения schema v12 и правила экономики не менялись.

Для последующих этапов добавлены `.agents/skills/deepforge-ui/SKILL.md` и `.cursor/rules/deepforge-ui.mdc`. Они содержат проектные правила по изученным рекомендациям Emil Kowalski; пакет skills через npx не устанавливался.

Описание и аудит: **`docs/UI_UX_16_1.md`**. Проверки и ограничения: **`docs/UI_UX_QA_16_1.md`**.

## Проверки

```sh
npm run typecheck
npm test
npm run build
```

В `npm test` добавлена строгая компиляция и 10 проверок UI-policy без новых зависимостей:

```sh
npm run test:ui-policy
```

В данной рабочей среде полный install/typecheck/build не выполнен: DNS npm registry вернул `EAI_AGAIN`. Отдельно прошли 19 тестов Rift-ядра, 10 UI-policy проверок, 12 браузерных проверок platform-helpers и 384 проверки статических JSX/CSS-фикстур. Это не заменяет полный запуск React/Phaser или проверку физического iPhone.

## Необязательная проверка макетов для разработчика

После установки dev-зависимостей:

```sh
npm run qa:ui-fixtures
python -m pip install playwright
python -m playwright install chromium
python qa/uiux/matrix.py
python qa/uiux/platform.py
```

Генератор создаёт `.ui-fixtures`: использует исходный JSX с фиксированными view-данными. Effects/React-runtime/Canvas/сеть там не запускаются; это **layout fixtures**, не альтернативная игра. Отчёты пишутся туда же и исключены из Git. Для собственного Chromium можно задать `DF_CHROMIUM`.

Backend Stage 16 и локальный `dev_rift_memory.bat` не изменены. Статический Pages не заменяет VPS для сетевых режимов.
