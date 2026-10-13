# Phase 22 — подготовка сервера (для плана 22-17)

Проверено сессией Server guy 2026-10-13 на `caddy validate` (caddy:2.11.7) и на стенде с тем же `encode`, matcher и `handle_path /api/*` с `flush_interval -1`.

## Caddyfile

Поток хода без сжатия: путь `/api/chat/turns/<id>/stream`, регулярка привязана к пути до срезания префикса `/api`. Другой путь потока в 22-13 требует той же правки регулярки.

```
--- a/deploy/caddy/Caddyfile
+++ b/deploy/caddy/Caddyfile
@@ -33,7 +33,8 @@
 		}
 	}
 
-	encode zstd gzip
+	@compressible not path_regexp chat_stream ^/api/chat/turns/[^/]+/stream$
+	encode @compressible zstd gzip
 
 	header {
 		-Server
```

Результат на стенде: поток без `Content-Encoding`, события приходят по одному в секунду; соседний путь отдаётся с gzip.

## Остальное

- `ANTHROPIC_API_KEY` лежит в файле окружения api на сервере; `env_file` сервиса api в `deploy/compose.yaml` уже подхватывает его, правка compose не нужна.
- Миграции фазы идут штатным сервисом `migrate` с дампом перед выкатом.
- Бэкап и проверка восстановления выполнены, места и памяти достаточно.
- После готовности фазы прислать Server guy SHA для выката.
