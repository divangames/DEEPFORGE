# DEEPFORGE: разрешение workflow и повтор отклонённого push

## Для какой ошибки

`refusing to allow an OAuth App to create or update workflow ... without workflow scope`

Сборка и локальный коммит уже состоялись. GitHub отклонил обновление main из-за
нехватки права изменения `.github/workflows/pages.yml` у HTTPS-авторизации.
Этот инструмент не исправляет TypeScript и не заменяет Stage 15.

## Запуск

1. Положите `authorize_workflow_and_push.bat` в существующую папку проекта,
   рядом с `package.json`, `client`, `server` и `.git`.
2. Запустите обычным двойным щелчком, не от имени другого пользователя Windows.
3. При отсутствии GitHub CLI подтвердите установку через WinGet. Установщик
   может отдельно запросить права Windows. Если WinGet отсутствует, батник
   покажет официальный адрес установщика GitHub CLI; сторонние загрузки не нужны.
4. Пройдите вход в браузере именно под `divangames`. Проверьте запрос прав
   GitHub CLI, включая `workflow`. При device-flow вводите только код, который
   только что показал этот запуск. Никому не отправляйте токены и коды.
5. Подтвердите настройку Git на GitHub CLI для `github.com`.
6. После принятого push откроется Actions. Дождитесь успешного задания Deploy.

Текущий `publish.bat` заменять не требуется. На следующих этапах используется он.

## Что меняется

GitHub CLI проходит браузерную OAuth-авторизацию с дополнительным `workflow`.
При первом входе CLI также запрашивает свои стандартные разрешения, а не только
`workflow`: внимательно прочитайте экран GitHub. CLI использует системное хранилище
учётных данных; при его недоступности возможен fallback, описанный в документации
GitHub CLI. Этот BAT сам не запрашивает токены, не встраивает их в remote и не пишет
их в исходники.

`gh auth setup-git --hostname github.com` настраивает GitHub CLI как Git credential
helper для github.com у текущего пользователя Windows. Это пользовательская
настройка Git, не только DEEPFORGE; другие сервисы, например GitLab, не меняются.
В ходе push дополнительно принудительно выбирается CLI на уровне одной команды,
чтобы старый helper не подставил прежнюю OAuth-авторизацию.

Скрипт не удаляет сохранённые credentials других инструментов. Он не исправляет
права GitHub-интеграции внутри ChatGPT: это отдельное подключение.

## Что не меняется

Нет `git add`, `commit`, `commit --amend`, `reset`, `rebase`, `pull`, удаления `.git`,
удаления workflow или force-push. Перед отправкой выполняется fetch и проверка
fast-forward. Отправляется именно commit, который был HEAD при запуске, а не
незакоммиченные изменения. Если remote main успела измениться, инструмент
останавливается и просит обычную синхронизацию через publish.bat.

Доступ к папке проверяется, но новые safe.directory-исключения не добавляются.
Предыдущая точечная настройка доверенной папки сохраняется.

Файл ASCII без BOM, окончания строк CRLF, delayed expansion выключен для путей
с восклицательными знаками. Скрипт не открывает игру как доказательство успешной
публикации: после push открывает Actions, где отдельно виден результат deployment.

## Вручную, когда GitHub CLI установлен

В терминале из папки проекта:

```bat
gh auth login --hostname github.com --git-protocol https --web --scopes workflow
gh auth setup-git --hostname github.com
git push -u origin main
```

Для уже авторизованного правильного аккаунта вместо нового login можно расширить
права: `gh auth refresh --hostname github.com --scopes workflow`.

## Ограничения проверки

Структура файла, ASCII/CRLF и Git-защита fast-forward проверены в Linux.
Браузерная OAuth-авторизация, WinGet и исполнение cmd.exe на Windows здесь
не выполнялись. Пользователь подтверждает права непосредственно на GitHub.

## Официальные источники

- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- https://cli.github.com/manual/gh_auth_login
- https://cli.github.com/manual/gh_auth_refresh
- https://cli.github.com/manual/gh_auth_setup-git
- https://github.com/cli/cli/blob/trunk/docs/install_windows.md
- https://git-scm.com/docs/gitcredentials
