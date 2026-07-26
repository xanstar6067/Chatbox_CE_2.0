# Сборка Chatbox CE для Android на Windows

## Что открывать в Android Studio

Открывайте каталог `android` внутри репозитория, а не корень `chatbox-main`.

После изменения переменных окружения перезапустите Android Studio и открытые терминалы.

## Собрать debug APK

Запустите из корня `chatbox-main` в PowerShell:

```powershell
pnpm.cmd run mobile:build:android
```

Команда собирает web-интерфейс для мобильной платформы, копирует его в
Capacitor-проект и выполняет Gradle-задачу `assembleDebug`.

Готовый APK находится здесь:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## Запустить из Android Studio

1. Откройте каталог `android` как проект.
2. Дождитесь окончания Gradle Sync.
3. Выберите эмулятор `Pixel_9_Pro` или подключённый телефон.
4. Нажмите **Run** для конфигурации `app`.

Если изменялся только TypeScript/React-код, сначала синхронизируйте web-сборку:

```powershell
pnpm.cmd run mobile:sync:android
```

Затем снова нажмите **Run** в Android Studio.

## Зависимости на чистой копии

Для Android-only окружения используйте:

```powershell
pnpm.cmd install --ignore-scripts
```

Обычный `pnpm install` также пытается собрать старый нативный Electron-модуль
`zipfile`. Он не нужен Android-приложению и требует совместимую с `node-gyp`
установку Visual Studio C++ Build Tools.

## Настроенное окружение

- Node.js 22.23.1
- pnpm 10.33.0
- JDK 21 из Android Studio
- Android SDK / target SDK 35
- Gradle 8.11.1 / Android Gradle Plugin 8.7.2
- application ID: `xyz.chatboxapp.ce`

В PowerShell используйте именно `pnpm.cmd`: это работает без изменения
системной политики выполнения PowerShell-скриптов.
