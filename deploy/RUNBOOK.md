# RUNBOOK: dv-lab на VPS

Шаги оператора от пустого VPS до `DEPLOY_OK` и `RESTORE_OK`. Оператор — Server guy (вход на VPS по ключу, DNS через личный Vercel CLI владельца) или владелец. Шаги, которые печатают пароль или требуют ввода токена (10.3, 10.5, 4.2), выполняет владелец.

## 0. Обозначения

- На сервере команды выполняются под `ubuntu` через `sudo`. Клон `/opt/dv-lab/repo` принадлежит root, поэтому `deploy.sh`, `backup.sh`, `restore-check.sh` и `git -C /opt/dv-lab/repo` запускаются только через `sudo` (без него git отвечает `dubious ownership`).
- Каждый блок — подоболочка `( set -Eeuo pipefail; … )`. Блок вставляется в bash целиком; на Mac сначала запустить `bash` (zsh понимает `set -E` иначе). Ошибка любой команды завершает блок с ненулевым кодом. Конструкций `… || echo`, `команда | grep -q` и `%{redirect_url}` в блоках нет.
- Значения, которые знает только оператор, задаются переменными в первых строках блока: `VPS_IPV4`, `VPS_IPV6`, `CLIENT_IPV4`, `CLIENT_IPV6`, `SHA`, `DUMP`, `SERVICE`, `GHCR_USER`, `TEACHER_EMAIL`, `TEACHER_NAME`, `PACKET`, `PACKET_SHA`. Пустая переменная останавливает блок на проверке `${VAR:?}`. Реальные адреса, пароли и токены в этот файл не записываются.
- `curl` в блоках печатает только `http_code` или тело `/healthz`.
- `SHA` — полный sha коммита, 40 hex без префикса `sha-`: для работающего релиза — из строки `DEPLOY_OK <прошлый> -> sha-<SHA>` или из поля `to=sha-<SHA>` последней строки `OK` в `/opt/dv-lab/state/deploy-journal.log`; для раздела 5a и первой выкатки — merge-коммит в `master` (`sudo git -C /opt/dv-lab/repo rev-parse origin/master` после `fetch`).
- Одна форма ручного вызова docker compose (разделы 5, 5a, 6, 9, 10, 11): в начале блока задаётся `SHA`, затем `APP_TAG="sha-${SHA:?}"`, и compose вызывается как `sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env <команда>` (в блоках — функция `dc` с этой строкой). Compose интерполирует весь файл, и без `APP_TAG` падают даже `logs` и `up -d db`. `sudo` сбрасывает окружение, поэтому `APP_TAG` передаётся через `env`. Файл состояния выкатки в каталоге `state` ручные блоки не читают: при первой выкатке и на пересобранном VPS его нет. Пароли compose берёт из `db.env`. `exec` вызывается с `-T`.
- Переменные для `deploy.sh` передаются так же: `sudo env FORCE=1 /opt/dv-lab/repo/deploy/deploy.sh`.
- Отступы в блоках — пробелы: табуляция при вставке в bash без bracketed paste запускает автодополнение.
- Назад присылаются коды и строки-маркеры (`DEPLOY_OK`, `BACKUP_OK`, `RESTORE_OK`, `DNS_OK`, коды HTTP), без адресов и паролей.

Порядок первого релиза: 1 и 2 (проверка) → 3.1 (TTL) → 4 → 5a → 3.3–3.4 (переключение DNS) → 5 → 6 → 7. Раздел 8 — каждая следующая выкатка, раздел 9 — авария. Релиз фазы 18 — разделы 10.1, 10.2, 10.3 вместо обычного 8.1. Релиз фазы 19 — раздел 11.

## 1. Подготовка VPS

Блоки раздела идемпотентны: на подготовленном VPS они ничего не меняют и печатают текущее состояние; на новом VPS (раздел 9) выполняют подготовку.

### 1.1. Пакеты

```bash
(
  set -Eeuo pipefail
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get -y upgrade
  sudo apt-get install -y ca-certificates curl git
)
```

### 1.2. Docker Engine и compose plugin из официального репозитория Docker

```bash
(
  set -Eeuo pipefail
  if command -v docker > /dev/null; then
    sudo docker version --format '{{.Server.Version}}'
    sudo docker compose version --short
    exit 0
  fi
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  CODENAME=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
  printf 'Types: deb\nURIs: https://download.docker.com/linux/ubuntu\nSuites: %s\nComponents: stable\nSigned-By: /etc/apt/keyrings/docker.asc\n' "$CODENAME" | sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo systemctl enable --now docker
  sudo docker version --format '{{.Server.Version}}'
  sudo docker compose version --short
)
```

Если `apt-get update` сообщает, что в репозитории Docker нет выпуска для кодового имени Ubuntu, файл `/etc/apt/sources.list.d/docker.sources` удаляется, ставятся пакеты Ubuntu `docker.io` и `docker-compose-v2`, версия записывается в отчёт.

### 1.3. ufw

Наружу открыты только OpenSSH, `80/tcp` и `443/tcp` (IPv4 и IPv6). `443/udp` не открывается: HTTP/3 выключен. Docker публикует порты в обход ufw, поэтому порты публикует только `caddy` в `deploy/compose.yaml`; проверка снаружи — раздел 6.

```bash
(
  set -Eeuo pipefail
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow OpenSSH
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
  sudo ufw status verbose
)
```

### 1.4. SSH только по ключу

Сначала проверяется вход по ключу во второй сессии с Mac, первая сессия остаётся открытой:

```bash
(
  set -Eeuo pipefail
  VPS_IPV4=
  ssh -o BatchMode=yes -o PasswordAuthentication=no "ubuntu@${VPS_IPV4:?}" true
  echo KEY_LOGIN_OK
)
```

Только после `KEY_LOGIN_OK` на сервере создаётся `/etc/ssh/sshd_config.d/00-dv-lab.conf`. В Ubuntu 26.04 sshd запускается через `ssh.socket`, а в `sshd_config.d` действует первое значение параметра, поэтому файл называется с префиксом `00-`.

```bash
(
  set -Eeuo pipefail
  printf 'PasswordAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/00-dv-lab.conf > /dev/null
  sudo chmod 644 /etc/ssh/sshd_config.d/00-dv-lab.conf
  sudo sshd -t
  sudo systemctl daemon-reload
  sudo systemctl restart ssh.socket
  sudo systemctl restart ssh
  sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin) '
)
```

Ожидаемо `passwordauthentication no` и `permitrootlogin no`. Затем блок проверки входа по ключу с Mac повторяется в новой сессии, и только после `KEY_LOGIN_OK` закрывается первая.

### 1.5. Время

```bash
(
  set -Eeuo pipefail
  timedatectl show -p Timezone -p NTPSynchronized
)
```

Ожидаемо часовой пояс UTC (`Etc/UTC` или `UTC`) и `NTPSynchronized=yes`. Таймер бэкапа срабатывает в 03:30 по времени сервера.

### 1.6. Автобэкап OVH

В панели OVHcloud: VPS → Backups. Автоматический бэкап Standard включён. Это единственная копия вне диска с дампами (D-04).

## 2. Каталоги и секреты

### 2.1. Каталоги

```bash
(
  set -Eeuo pipefail
  sudo mkdir -p -m 755 /opt/dv-lab /opt/dv-lab/repo /opt/dv-lab/state /opt/dv-lab/data /opt/dv-lab/data/pg /opt/dv-lab/data/caddy /opt/dv-lab/data/caddy/data /opt/dv-lab/data/caddy/config
  sudo mkdir -p -m 700 /opt/dv-lab/env /opt/dv-lab/backups /opt/dv-lab/backups/db
  sudo chmod 700 /opt/dv-lab/env /opt/dv-lab/backups/db
)
```

`mkdir -p` не меняет права существующих каталогов, поэтому каталог данных Postgres после инициализации не затрагивается.

### 2.2. Пароли базы

Имена — из `deploy/env.example`. Пароли — `openssl rand -hex 24`, пишутся прямо в файл с правами 600 под `umask 077` и на экран не выводятся. Существующий файл не перезаписывается.

```bash
(
  set -Eeuo pipefail
  if sudo test -e /opt/dv-lab/env/db.env; then
    echo "db.env уже есть, пароли не меняются"
  else
    sudo install -m 600 /dev/null /opt/dv-lab/env/db.env
    sudo sh -c 'set -eu; umask 077; a=$(openssl rand -hex 24); b=$(openssl rand -hex 24); c=$(openssl rand -hex 24); printf "POSTGRES_PASSWORD=%s\nMIGRATOR_PASSWORD=%s\nAPP_PASSWORD=%s\n" "$a" "$b" "$c" > /opt/dv-lab/env/db.env'
  fi
  sudo chmod 600 /opt/dv-lab/env/db.env
  sudo grep -c -E '^(POSTGRES|MIGRATOR|APP)_PASSWORD=[0-9a-f]+$' /opt/dv-lab/env/db.env
)
```

Ожидаемо `3`: три строки с hex-паролями (compose подставляет пароли в URL базы, поэтому только hex).

### 2.3. Клон репозитория

Репозиторий публичный, токен не нужен.

```bash
(
  set -Eeuo pipefail
  if sudo test -d /opt/dv-lab/repo/.git; then
    sudo git -C /opt/dv-lab/repo fetch -q origin
  else
    sudo git clone -q https://github.com/kdvornichenko/dv-lab.git /opt/dv-lab/repo
  fi
  sudo git -C /opt/dv-lab/repo rev-parse HEAD
)
```

### 2.4. Проверка подготовки

```bash
(
  set -Eeuo pipefail
  sudo docker version --format '{{.Server.Version}}'
  sudo docker compose version --short
  sudo ufw status verbose
  sudo stat -c '%a %U:%G %n' /opt/dv-lab/env /opt/dv-lab/env/db.env /opt/dv-lab/backups/db
  sudo sshd -T | grep -E '^(passwordauthentication|permitrootlogin) '
  timedatectl show -p Timezone -p NTPSynchronized
)
```

Ожидаемо: версии Docker и compose; `Status: active`, входящие разрешены только OpenSSH, `80/tcp`, `443/tcp` (каждое для IPv4 и `(v6)`); `700 root:root /opt/dv-lab/env`, `600 root:root /opt/dv-lab/env/db.env`, `700 root:root /opt/dv-lab/backups/db`; `passwordauthentication no`, `permitrootlogin no`; UTC и `NTPSynchronized=yes`. Пароли не присылаются.

## 3. DNS (D-16)

Домен и зона `dv-lab.dev` остаются в Vercel. Меняются только записи корня `@`: ручные записи A, которые указывают на Vercel, заменяются на `A @ VPS_IPV4`, добавляется `AAAA @ VPS_IPV6`. Не трогать: системный ALIAS `*`, `www`, `*.home`, TXT, CAA, `ielts.dv-lab.dev`, `vault.dv-lab.dev`. Корень не должен быть доменом какого-либо проекта Vercel (Project → Settings → Domains); `ielts.dv-lab.dev` и `vault.dv-lab.dev` остаются у своих проектов.

### 3.1. TTL записей корня

С Mac, запрос к авторитетному серверу зоны:

```bash
(
  set -Eeuo pipefail
  NS=$(dig +short NS dv-lab.dev)
  NS=${NS%%$'\n'*}
  [ -n "$NS" ]
  dig +noall +answer dv-lab.dev A @"$NS"
  dig +noall +answer dv-lab.dev AAAA @"$NS"
)
```

TTL — второе поле строки. Если он больше 60 с, TTL понижается до 60 с в Vercel (Domains → dv-lab.dev → DNS Records) и переключение ждёт истечения старого TTL.

### 3.2. Когда переключать

Только после раздела 5a (образы проверены) и прямо перед разделом 5: Caddy получает сертификат Let's Encrypt, только когда A и AAAA корня указывают на VPS, а проверка `deploy.sh` идёт по HTTPS.

### 3.3. Переключение

Старые записи A корня удаляются по id из `vercel dns ls dv-lab.dev` (`vercel dns rm <id>`) или в панели, затем добавляются новые:

```bash
(
  set -Eeuo pipefail
  VPS_IPV4=
  VPS_IPV6=
  vercel dns add dv-lab.dev '@' A "${VPS_IPV4:?}"
  vercel dns add dv-lab.dev '@' AAAA "${VPS_IPV6:?}"
)
```

### 3.4. Проверка DNS

С Mac. `VPS_IPV6` записывается в сжатой форме, как его печатает `dig`.

```bash
(
  set -Eeuo pipefail
  VPS_IPV4=
  VPS_IPV6=
  : "${VPS_IPV4:?}" "${VPS_IPV6:?}"
  NS=$(dig +short NS dv-lab.dev)
  NS=${NS%%$'\n'*}
  A=$(dig +short A dv-lab.dev @"$NS")
  AAAA=$(dig +short AAAA dv-lab.dev @"$NS")
  IELTS=$(dig +short ielts.dv-lab.dev)
  [ "$A" = "$VPS_IPV4" ]
  [ "$AAAA" = "$VPS_IPV6" ]
  case "$IELTS" in *"$VPS_IPV4"*) echo "ielts.dv-lab.dev указывает на VPS" >&2; exit 1 ;; esac
  echo DNS_OK
)
```

### 3.5. После работающего HTTPS

- TTL записей корня возвращается к 300–3600 с после успешного раздела 6.
- Каталог `/opt/dv-lab/data/caddy/data` (сертификаты) не удаляется и не пересоздаётся: у Let's Encrypt лимиты на выдачу.
- `.dev` в HSTS preload: сайт открывается только по HTTPS.

## 4. GHCR

Образы `ghcr.io/kdvornichenko/dv-lab-api` и `ghcr.io/kdvornichenko/dv-lab-web` публикует CI после push в `master`: сначала с временным тегом `ci-<полный sha>`, а тег `sha-<полный sha>`, который ждёт `deploy.sh`, ставит job `Publish` только после зелёных проверок. Пакет создаётся приватным. Два варианта; `docker manifest inspect` и `docker pull` в `deploy.sh` работают в обоих без изменений.

### 4.1. Вариант A: публичные пакеты

Владелец в веб-интерфейсе GitHub после первого push в `master`: Packages → `dv-lab-api` → Package settings → Danger Zone → Change visibility → Public; то же для `dv-lab-web`. Сделать пакет обратно приватным нельзя. Проверка анонимного доступа (пустой каталог настроек Docker вместо входа root):

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  D=$(mktemp -d)
  sudo env DOCKER_CONFIG="$D" docker pull -q "ghcr.io/kdvornichenko/dv-lab-api:sha-$SHA"
  sudo env DOCKER_CONFIG="$D" docker pull -q "ghcr.io/kdvornichenko/dv-lab-web:sha-$SHA"
  rm -rf "$D"
)
```

### 4.2. Вариант B: приватные пакеты и вход на сервере

Блок входа выполняет владелец в своём терминале. Токен GitHub (classic) только с `read:packages`. Вход под root, токен вводится без отображения:

```bash
(
  set -Eeuo pipefail
  GHCR_USER=
  : "${GHCR_USER:?}"
  read -r -s -p 'read:packages token: ' TOKEN
  echo
  printf '%s' "$TOKEN" | sudo docker login ghcr.io -u "$GHCR_USER" --password-stdin
)
```

Проверка:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  sudo docker manifest inspect "ghcr.io/kdvornichenko/dv-lab-api:sha-$SHA" > /dev/null
  sudo docker manifest inspect "ghcr.io/kdvornichenko/dv-lab-web:sha-$SHA" > /dev/null
  sudo docker pull -q "ghcr.io/kdvornichenko/dv-lab-api:sha-$SHA"
  sudo docker pull -q "ghcr.io/kdvornichenko/dv-lab-web:sha-$SHA"
)
```

## 5a. Проверка образов до переключения DNS

Выполняется после раздела 4 и до переключения записей корня (3.3). Корень `dv-lab.dev` сейчас не используется, поэтому сбой здесь стоит одного цикла PR и простоя не даёт. Caddy не запускается. Клон переводится на merge-коммит, чтобы `compose.yaml` и `deploy/postgres` совпадали с образами. Миграции идут до api и web, потому что `/healthz` api обращается к базе.

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach "$SHA"
  dc pull api web
  dc up -d --wait db
  dc --profile tools run --rm -T migrate
  dc up -d --wait --wait-timeout 120 api web
  dc ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'
)
```

Ожидаемо: в выводе `migrate` строка `migrations applied`; `ps` показывает `db`, `api`, `web` в состоянии `running` и `(healthy)` (healthcheck compose проверяет api и web). Стек можно оставить для первой выкатки или остановить той же формой (данные в `/opt/dv-lab/data/pg` сохраняются):

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc down
)
```

## 5. Первая выкатка

После merge, раздела 5a и переключения DNS (3.3, `DNS_OK` в 3.4). Файла состояния выкатки ещё нет, откатываться не на что. `deploy.sh` без аргумента выкатывает `origin/master`: ждёт оба образа в GHCR, поднимает базу, повторяет `ensure-db`, снимает дамп перед выкаткой, прогоняет миграции на временной копии `dvlab_migcheck_<epoch>`, применяет их к `dvlab`, поднимает api и web, запускает caddy (`up -d --no-deps caddy`) и перечитывает его конфиг (`caddy reload`), затем проверяет `https://dv-lab.dev/healthz` (sha и `db: ok`) и код `/` через Caddy на этом сервере (`curl --resolve dv-lab.dev:443:127.0.0.1`). Поэтому сертификат должен выдаться до проверки, а значит DNS переключается раньше.

```bash
(
  set -Eeuo pipefail
  sudo /opt/dv-lab/repo/deploy/deploy.sh
  sudo tail -n 3 /opt/dv-lab/state/deploy-journal.log
)
```

Ожидаемо: последняя строка вывода `DEPLOY_OK none -> sha-<SHA>`, в журнале `/opt/dv-lab/state/deploy-journal.log` строка `OK from=none to=sha-<SHA>`.

### 5.1. Если `DEPLOY_FAILED stage=…`

Этап → где смотреть:

| Этап                             | Где смотреть                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `lock`                           | идёт другая выкатка (код 75)                                                                              |
| `fetch`                          | вывод `deploy.sh`: `git fetch` и `rev-parse`                                                              |
| `images`                         | раздел 4: пакеты не опубликованы или недоступны                                                           |
| `db-up`, `ensure-db`, `pre-dump` | `SERVICE=db`                                                                                              |
| `dry-run`, `migrate`             | вывод `migrate` в выводе `deploy.sh` (контейнер `run --rm` удаляется, `logs` по нему пуст) и `SERVICE=db` |
| `switch`                         | `SERVICE=api`, `SERVICE=web`, `SERVICE=caddy`                                                             |
| `smoke`                          | `SERVICE=caddy` (сертификат, DNS), `SERVICE=api`                                                          |

`SHA` — выкатываемый коммит, `SERVICE` — `db`, `api`, `web` или `caddy`:

```bash
(
  set -Eeuo pipefail
  SHA=
  SERVICE=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  : "${SERVICE:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  sudo tail -n 5 /opt/dv-lab/state/deploy-journal.log
  dc ps -a --format 'table {{.Service}}\t{{.State}}\t{{.Status}}'
  dc logs --no-color --tail 200 "$SERVICE"
)
```

Повтор после исправления — по разделу 8 с `FORCE=1`.

Логи контейнеров идут в journald (`deploy/compose.yaml`, `x-logging`) и переживают пересоздание контейнера при выкатке. Хранение задаёт journald на сервере (`SystemMaxUse`, `MaxRetentionSec`). Логи прошлых контейнеров сервиса: `sudo journalctl CONTAINER_NAME=dv-lab-<сервис>-1 --since '2 days ago' -o cat`.

## 6. Проверка снаружи

Блоки 6.1–6.4 — с Mac или другого хоста с IPv4 и IPv6, блоки 6.5–6.6 — на сервере.

### 6.1. HTTPS по IPv4 и IPv6

```bash
(
  set -Eeuo pipefail
  for v in -4 -6; do
    for p in /healthz /login; do
      CODE=$(curl "$v" -s -o /dev/null -w '%{http_code}' --max-time 10 "https://dv-lab.dev$p")
      echo "$v $p $CODE"
      [ "$CODE" = 200 ]
    done
    CODE=$(curl "$v" -s -o /dev/null -w '%{http_code}' --max-time 10 https://dv-lab.dev/api/auth/me)
    echo "$v /api/auth/me $CODE"
    [ "$CODE" = 401 ]
  done
  curl -4 -s --max-time 10 https://dv-lab.dev/healthz
  echo
)
```

Ожидаемо по IPv4 и IPv6 строки `/healthz 200`, `/login 200` и `/api/auth/me 401` (маршрут входа api за префиксом `/api` отвечает без сессии), затем тело `/healthz` с `sha` текущего релиза и `"db":"ok"`. Корень `/` без сессии отвечает 307 на `/login`, поэтому в цикле его нет.

### 6.2. Нет alt-svc и HTTP/3

```bash
(
  set -Eeuo pipefail
  for v in -4 -6; do
    H=$(curl "$v" -sI --max-time 10 https://dv-lab.dev/)
    if grep -i alt-svc <<< "$H"; then
      exit 1
    fi
  done
  if curl --http3-only -sI --max-time 10 -o /dev/null https://dv-lab.dev/; then
    echo "HTTP/3 отвечает" >&2
    exit 1
  fi
  echo NO_ALT_SVC_NO_H3
)
```

Поиск `alt-svc` ничего не печатает. `curl` без поддержки HTTP/3 (нет `HTTP3` в `curl -V`) на `--http3-only` отвечает ошибкой; тогда достаточно отсутствия `alt-svc` и закрытого `443/udp` (раздел 1.3).

### 6.3. Закрытые порты по IPv4 и IPv6

```bash
(
  set -Eeuo pipefail
  VPS_IPV4=
  VPS_IPV6=
  : "${VPS_IPV4:?}" "${VPS_IPV6:?}"
  OPEN=0
  for fam in 4 6; do
    if [ "$fam" = 4 ]; then ip=$VPS_IPV4; else ip=$VPS_IPV6; fi
    for port in 5432 3000 4000 2019; do
      if nc -z -G 5 -w 5 "$ip" "$port" > /dev/null 2>&1; then
        echo "OPEN v$fam $port"
        OPEN=1
      fi
    done
  done
  [ "$OPEN" = 0 ]
  echo PORTS_CLOSED
)
```

### 6.4. ielts.dv-lab.dev остаётся на Vercel

```bash
(
  set -Eeuo pipefail
  VPS_IPV4=
  : "${VPS_IPV4:?}"
  IELTS=$(dig +short ielts.dv-lab.dev)
  case "$IELTS" in *"$VPS_IPV4"*) echo "ielts.dv-lab.dev указывает на VPS" >&2; exit 1 ;; esac
  curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 https://ielts.dv-lab.dev/
)
```

Страница `https://ielts.dv-lab.dev` открывается в браузере.

### 6.5. Адрес клиента IPv6 в журнале Caddy

`CLIENT_IPV6` — внешний IPv6 того хоста, с которого шёл `curl -6` в 6.1 (например, `curl -6 -s https://ifconfig.co`). `SHA` — текущий релиз. На сервере:

```bash
(
  set -Eeuo pipefail
  SHA=
  CLIENT_IPV6=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  : "${CLIENT_IPV6:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  L=$(dc logs --no-color --no-log-prefix --tail 500 caddy)
  if grep -F -c "\"remote_ip\":\"$CLIENT_IPV6\"" <<< "$L"; then
    echo CLIENT_IPV6_SEEN
  else
    echo "CLIENT_IPV6 не найден в журнале Caddy" >&2
    exit 1
  fi
)
```

Адрес шлюза Docker в `remote_ip` вместо адреса клиента означает сеть compose без IPv6 — раздел 10.1.

### 6.6. Остановка api

`SHA` обязан быть текущим релизом, иначе `up -d api` поднимет api с другим образом. На сервере:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  ID=$(dc ps -q api)
  [ -n "$ID" ]
  START=$(date +%s)
  time dc stop api
  END=$(date +%s)
  CODE=$(sudo docker inspect -f '{{.State.ExitCode}}' "$ID")
  echo "stop api: $((END - START)) s, exit code $CODE"
  dc up -d --wait api
  [ $((END - START)) -le 20 ]
  [ "$CODE" = 0 ]
)
```

Ожидаемо не больше 20 с и код выхода контейнера `0`; api снова `healthy`. `https://dv-lab.dev` открывается в браузере (без сессии — страница входа).

## 7. Бэкапы

Только после первого `DEPLOY_OK`: `backup.sh` и `restore-check.sh` берут тег образов из файла состояния выкатки, который создаёт `deploy.sh`; без него первый ночной запуск упадёт. После выкатки, которая меняет `deploy/systemd/`, блок 7.1 выполняется заново.

### 7.1. Юниты systemd

```bash
(
  set -Eeuo pipefail
  sudo cp /opt/dv-lab/repo/deploy/systemd/dv-lab-backup.service /opt/dv-lab/repo/deploy/systemd/dv-lab-backup.timer /etc/systemd/system/
  sudo systemd-analyze verify /etc/systemd/system/dv-lab-backup.service /etc/systemd/system/dv-lab-backup.timer
  sudo systemctl daemon-reload
  sudo systemctl enable --now dv-lab-backup.timer
  systemctl list-timers --no-pager dv-lab-backup.timer
)
```

### 7.2. Разовый запуск бэкапа

```bash
(
  set -Eeuo pipefail
  SINCE=$(date '+%Y-%m-%d %H:%M:%S')
  RC=0
  sudo systemctl start dv-lab-backup.service || RC=$?
  systemctl show -p Result dv-lab-backup.service
  J=$(sudo journalctl -u dv-lab-backup.service --since "$SINCE" --no-pager -o cat)
  echo "$J"
  [ "$RC" = 0 ]
  case "$J" in *BACKUP_OK*) ;; *) exit 1 ;; esac
)
```

Ожидаемо `Result=success` и строка `BACKUP_OK /opt/dv-lab/backups/db/dvlab-daily-<штамп>.dump`. Хранятся 14 daily и 8 weekly.

### 7.3. Проверка восстановления

```bash
(
  set -Eeuo pipefail
  sudo /opt/dv-lab/repo/deploy/backup/restore-check.sh
)
```

Ожидаемо `migrations live=<n> restored=<n>`, `tables=<n>` и `RESTORE_OK`. Временная база `dvlab_restorecheck` удаляется скриптом.

## 8. Обычная выкатка и откат

Успех — только `DEPLOY_OK`. `DEPLOY_SKIPPED` (код 0) — не успех: выкатка не выполнялась, потому что тег цели совпадает с записанным в файле состояния выкатки. После `DEPLOY_FAILED` первой выкатки там уже записан новый тег, поэтому повтор без `FORCE=1` печатает `DEPLOY_SKIPPED` и ничего не чинит. Код 75 и `DEPLOY_STOPPED` — идёт другая выкатка, повторить позже. При `DEPLOY_FAILED stage=…` скрипт печатает итог отката (`rolled back to sha-…`, `repo returned to sha-…`, `nothing to roll back to` или `ROLLBACK FAILED`); где смотреть — таблица 5.1.

Блоки 8.1–8.3 сначала переключают клон на цель: `deploy.sh` запускается из клона, и выполняться должен скрипт выкатываемого релиза, а не прошлого (проверки после выкатки меняются вместе с приложением).

### 8.1. Выкатка `origin/master`

```bash
(
  set -Eeuo pipefail
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach origin/master
  sudo /opt/dv-lab/repo/deploy/deploy.sh
)
```

### 8.2. Выкатка конкретного коммита или откат

Откат — выкатка прошлого sha (из строки `OK` журнала). Образы api и web возвращаются вместе на один sha. Схема базы не откатывается: добавленные таблицы и колонки остаются. Для учёта уроков последствия описаны в разделе 12.3.

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach "$SHA"
  sudo /opt/dv-lab/repo/deploy/deploy.sh "$SHA"
)
```

### 8.3. Повтор того же sha

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach "$SHA"
  sudo env FORCE=1 /opt/dv-lab/repo/deploy/deploy.sh "$SHA"
)
```

### 8.4. Журнал выкаток

```bash
(
  set -Eeuo pipefail
  sudo tail -n 10 /opt/dv-lab/state/deploy-journal.log
)
```

## 9. Восстановление после аварии

Только на новом VPS до первой выкатки.

1. Новый VPS готовится по разделам 1–2; при варианте B раздела 4 выполняется вход в GHCR.
2. Дамп (`dvlab-daily-*.dump` или `predeploy-*.dump`) с диска старого VPS или из автобэкапа OVH копируется на новый VPS (`scp` в домашний каталог `ubuntu`) и кладётся в `/opt/dv-lab/backups/db` командой `sudo install -m 600 <файл> /opt/dv-lab/backups/db/`.
3. Записи корня переключаются на адреса нового VPS по разделам 3.3–3.4: `deploy.sh` в конце блока проверяет HTTPS, а сертификат выдаётся только когда DNS указывает на сервер.
4. Блок ниже. `SHA` — последний рабочий релиз, `DUMP` — полный путь к дампу.

`up -d --wait db` на пустом каталоге данных запускает init: `ensure-db.sh` создаёт роли и базу `dvlab`, и в ней уже есть схема `extensions`, поэтому `pg_restore --exit-on-error` прямо в неё падает на `schema "extensions" already exists`. Поэтому база удаляется и создаётся заново двумя отдельными `-c`: в одном `-c` оба оператора ушли бы одной транзакцией, а `DROP DATABASE` в транзакции не выполняется. api и web на новом VPS ещё не запущены, сессий к `dvlab` нет. Дамп читается через `sudo cat`: каталог `backups/db` — 700 под root, перенаправление оболочки `ubuntu` его не прочитает. `deploy.sh` с `FORCE=1` своим этапом `ensure-db` возвращает `REVOKE` и `GRANT` на уровне базы, которых нет в `pg_dump -Fc`.

```bash
(
  set -Eeuo pipefail
  SHA=
  DUMP=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  sudo test -s "${DUMP:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach "$SHA"
  dc up -d --wait db
  dc exec -T db psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 -c 'DROP DATABASE dvlab;' -c 'CREATE DATABASE dvlab OWNER dvlab_migrator;'
  sudo cat "$DUMP" | dc exec -T db pg_restore -U postgres -d dvlab --exit-on-error
  sudo env FORCE=1 /opt/dv-lab/repo/deploy/deploy.sh "$SHA"
)
```

Ожидаемо `DEPLOY_OK none -> sha-<SHA>`. Затем разделы 6 и 7 (включая `RESTORE_OK`).

## 10. Релиз со входом (фаза 18) и учётные записи

Порядок: 10.1 → 10.2 → 10.3. Разделы 10.4 и 10.5 — по необходимости после 10.3. `SHA` во всех блоках раздела — merge-коммит релиза фазы 18 в `master` (после выкатки — текущий релиз).

### 10.1. Выкатка релиза фазы 18 (один раз)

Клон на сервере держит релиз фазы 17 (`17868c4`). Его `deploy.sh` принимает на `/` только код 200, а после фазы 18 корень без сессии отвечает 307 на `/login`: запуск старого скрипта без переключения клона даёт `DEPLOY_FAILED stage=smoke` и откат. Поэтому блок сначала переключает клон на целевой sha, и запускается `deploy.sh` релиза фазы 18.

Сеть compose с IPv6 (D-26) появляется только после пересоздания существующей сети `dv-lab_default`, а `deploy.sh` сети не пересоздаёт. Блок проверяет сеть: если у неё нет IPv6, выполняется `dc down` (без `-v`: тома и данные остаются; сайт не отвечает до конца выкатки, это короткий простой). Если сеть уже с IPv6 (её пересоздали раньше), `dc down` не выполняется и выкатка идёт без простоя. Перед блоком образы `sha-<SHA>` проверяются блоком 4.2: иначе простой после `dc down` растягивается на ожидание образов в `deploy.sh`.

Образы приватные: сервер уже вошёл в GHCR (4.2), анонимного доступа блок не предполагает.

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  sudo git -C /opt/dv-lab/repo fetch -q origin
  sudo git -C /opt/dv-lab/repo checkout -q --detach "$SHA"
  if sudo docker network inspect dv-lab_default > /dev/null 2>&1; then
    V6=$(sudo docker network inspect -f '{{.EnableIPv6}}' dv-lab_default)
    echo "dv-lab_default EnableIPv6=$V6"
    if [ "$V6" != true ]; then
      dc down
    fi
  fi
  sudo /opt/dv-lab/repo/deploy/deploy.sh "$SHA"
)
```

Ожидаемо: строка `dv-lab_default EnableIPv6=…` и последняя строка `DEPLOY_OK sha-<прошлый> -> sha-<SHA>`; в строке `smoke:` коды `web=200` или `web=307`, `login=200`, `me=401`. Назад присылается строка `DEPLOY_OK` и значение `EnableIPv6` до выкатки.

Если `DEPLOY_FAILED` и итог отката пишет ошибку сети compose (`ROLLBACK FAILED` или сообщение о сети `dv-lab_default`): `dc down` той же формой в клоне на прошлом sha (`sudo git -C /opt/dv-lab/repo checkout -q --detach <прошлый sha>`, `SHA` в блоке — прошлый), затем раздел 8.2 с прошлым sha, затем сообщить владельцу. Прошлый sha — из поля `to=` последней строки `OK` журнала выкаток (8.4).

### 10.2. Проверки после выкатки и адрес клиента (жёсткое условие D-26)

После `DEPLOY_OK` из 10.1 и до 10.3: разделы 6.1–6.4, затем блоки ниже. Ограничение попыток входа считает неудачи по паре «логин + IP клиента», поэтому api должен видеть настоящий адрес клиента и по IPv4, и по IPv6, а подделанный заголовок `X-Forwarded-For` не должен на него влиять.

С Mac или другого хоста с IPv4 и IPv6: по одной попытке входа с вымышленным логином, неверным паролем и подделанным `X-Forwarded-For: 192.0.2.1` по каждому протоколу.

```bash
(
  set -Eeuo pipefail
  for v in -4 -6; do
    PROBE="probe-$RANDOM$RANDOM@invalid"
    CODE=$(curl "$v" -s -o /dev/null -w '%{http_code}' --max-time 10 -X POST https://dv-lab.dev/api/auth/sign-in -H 'Origin: https://dv-lab.dev' -H 'content-type: application/json' -H 'X-Forwarded-For: 192.0.2.1' --data "{\"login\":\"$PROBE\",\"password\":\"wrong-probe-password\"}")
    echo "$v sign-in $CODE"
    [ "$CODE" = 401 ]
  done
)
```

Ожидаемо две строки с `401`. `CLIENT_IPV4` и `CLIENT_IPV6` — внешние адреса этого хоста (например, `curl -4 -s https://ifconfig.co` и `curl -6 -s https://ifconfig.co`), IPv6 в сжатой форме. На сервере, в течение нескольких минут после попыток (блок читает последние 500 строк журналов):

```bash
(
  set -Eeuo pipefail
  SHA=
  CLIENT_IPV4=
  CLIENT_IPV6=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  : "${CLIENT_IPV4:?}" "${CLIENT_IPV6:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  C=$(dc logs --no-color --no-log-prefix --tail 500 caddy)
  A=$(dc logs --no-color --no-log-prefix --tail 500 api)
  if ! R=$(grep -F '"msg":"sign-in refused"' <<< "$A"); then
    echo "в журнале api нет строк sign-in refused" >&2
    exit 1
  fi
  for ip in "$CLIENT_IPV4" "$CLIENT_IPV6"; do
    if ! grep -F -q "\"remote_ip\":\"$ip\"" <<< "$C"; then
      echo "адреса клиента нет в журнале Caddy" >&2
      exit 1
    fi
    if ! grep -F -q "\"clientIp\":\"$ip\"" <<< "$R"; then
      echo "адреса клиента нет в строках sign-in refused api" >&2
      exit 1
    fi
  done
  if grep -F -q '"clientIp":"192.0.2.1"' <<< "$R"; then
    echo "api взял адрес из подделанного X-Forwarded-For" >&2
    exit 1
  fi
  echo CLIENT_IP_OK
)
```

Ожидаемо `CLIENT_IP_OK`. Назад присылается только этот маркер или текст ошибки, без адресов. Если `CLIENT_IPV6` не найден (вместо него адрес шлюза Docker или подделанный адрес) или найден `192.0.2.1`: остановиться, учителя не создавать и сообщить владельцу — правило «логин + IP» пересматривается до выдачи входа (D-26). Строки ограничения попыток для вымышленных логинов удаляет фоновая очистка api через 15 минут.

### 10.3. Первый учитель и вход владельца

Раздел выполняет владелец в своём терминале. Только после того, как 10.2 напечатал `CLIENT_IP_OK`. `TEACHER_EMAIL` — e-mail владельца для входа, `TEACHER_NAME` — его имя, как оно показывается в оболочке. Скрипт печатает пароль один раз; контейнер `run --rm` удаляется вместе с журналом (драйвер `local`), блок проверяет, что контейнера `bootstrap` не осталось.

```bash
(
  set -Eeuo pipefail
  SHA=
  TEACHER_EMAIL=
  TEACHER_NAME=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  : "${TEACHER_EMAIL:?}" "${TEACHER_NAME:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc --profile tools run --rm bootstrap --email "$TEACHER_EMAIL" --name "$TEACHER_NAME"
  LEFT=$(sudo docker ps -a -q --filter label=com.docker.compose.project=dv-lab --filter label=com.docker.compose.service=bootstrap)
  [ -z "$LEFT" ]
  echo NO_BOOTSTRAP_CONTAINER
)
```

Ожидаемо строки `Teacher created. Login: …`, `Password (shown once): …` и `NO_BOOTSTRAP_CONTAINER`. Владелец сохраняет пароль у себя и назад не присылает; назад присылаются только маркеры `Teacher created` и `NO_BOOTSTRAP_CONTAINER`, без логина и пароля. Код 3 и `An active teacher already exists` — учитель уже есть, повторять не нужно (забытый пароль — раздел 10.5). Код 2 и строка `Usage:` — пустое или неверное значение `TEACHER_EMAIL` или `TEACHER_NAME`. Код 1 и `Bootstrap failed` — ошибка базы, смотреть `SERVICE=db` (5.1).

Последний шаг выполняет владелец: входит на `https://dv-lab.dev/login` этим e-mail и паролем, видит оболочку Today со своим именем и меняет пароль через меню аккаунта. Это закрывает критерий 1 ROADMAP фазы 18.

### 10.4. Снятие блокировки входа

Пять неверных паролей с одного адреса закрывают вход этого логина с этого адреса на 15 минут (форма входа и диалог смены пароля считаются вместе), двадцать — вход логина с любого адреса. Учитель видит `Too many attempts, try again in 15 minutes`. Если ждать нельзя, блок удаляет все счётчики попыток под ролью миграций (владелец таблицы); аккаунты и сессии не затрагиваются.

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc exec -T db psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c 'delete from sign_in_throttles'
)
```

Ожидаемо строка `DELETE <n>`. Локальный вход в контейнере `db` идёт через сокет без пароля; если `psql` отвечает ошибкой аутентификации для `dvlab_migrator`, та же команда выполняется с `-U postgres`, и это записывается в отчёт.

### 10.5. Восстановление пароля учителя

Раздел выполняет владелец в своём терминале: скрипт печатает новый пароль. `TEACHER_EMAIL` — e-mail активного учителя. Скрипт ставит новый пароль, закрывает все сессии учителя; id аккаунта и данные не меняются.

```bash
(
  set -Eeuo pipefail
  SHA=
  TEACHER_EMAIL=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  : "${TEACHER_EMAIL:?}"
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc --profile tools run --rm bootstrap --reset-password --email "$TEACHER_EMAIL"
  LEFT=$(sudo docker ps -a -q --filter label=com.docker.compose.project=dv-lab --filter label=com.docker.compose.service=bootstrap)
  [ -z "$LEFT" ]
  echo NO_BOOTSTRAP_CONTAINER
)
```

Ожидаемо строки `Password reset. Login: …`, `Password (shown once): …` и `NO_BOOTSTRAP_CONTAINER`. Владелец сохраняет пароль у себя, назад присылаются только маркеры `Password reset` и `NO_BOOTSTRAP_CONTAINER`. Код 3 и `No active teacher with this email` — активного учителя с таким e-mail нет. Если вход закрыт ограничением попыток, после восстановления пароля нужен ещё раздел 10.4.

## 11. Карточки учеников и импорт vault (фаза 19)

Порядок: 11.1 → 11.2 → 11.3. `SHA` во всех блоках раздела — merge-коммит релиза фазы 19 в `master` (после выкатки — текущий релиз).

### 11.1. Выкатка релиза фазы 19

Обычная выкатка: раздел 8.1 или 8.2 с merge-коммитом фазы. Миграция `20261009194959_student_cards` (таблицы карточек, секций, словаря и оплат) применяется этапом `migrate` в `deploy.sh`. Ожидаемо последняя строка `DEPLOY_OK sha-<прошлый> -> sha-<SHA>`. Назад присылается строка `DEPLOY_OK`.

### 11.2. Импорт пакета vault (один раз)

Выполняется один раз, сразу после 11.1 и до того, как учитель начал работать с карточками, и только после приёмки владельцем импорта на `dvlab_dev`.

Пакет делает владелец у себя: `node apps/api/dist/import-vault.mjs parse <каталог students> > <файл вне клона>`. Файл — stdout `parse` как есть, без правки и переформатирования: sha256 файла (с завершающим переводом строки) равен sha256, записанному при приёмке на `dvlab_dev`. Если vault менялся после приёмки, хеш другой, и приёмка нового пакета на `dvlab_dev` повторяется. Владелец передаёт оператору файл пакета вне репозитория и отдельно его sha256 (64 hex). Оператор копирует пакет на сервер в домашний каталог `ubuntu` (`scp`), не в `/opt/dv-lab` и не в клон.

`PACKET` — полный путь к пакету на сервере, `PACKET_SHA` — sha256 от владельца. Блок сверяет sha256 пакета, проверяет, что в базе нет карточек, заведённых вручную до импорта (импорт сопоставляет карточки только по ключу импорта: карточку-дубль по имени нельзя ни удалить, ни слить), запускает импорт под ролью приложения, удаляет пакет `shred -u` и проверяет, что контейнера `import` не осталось.

```bash
(
  set -Eeuo pipefail
  SHA=
  PACKET=
  PACKET_SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  case "${PACKET_SHA:?}" in *[^0-9a-f]*) echo "PACKET_SHA: 64 hex" >&2; exit 1 ;; esac
  [ "${#PACKET_SHA}" -eq 64 ]
  [ -f "${PACKET:?}" ]
  echo "$PACKET_SHA  $PACKET" | sha256sum -c -
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  MANUAL=$(dc exec -T db psql -X -U postgres -d dvlab -v ON_ERROR_STOP=1 -tAc 'select count(*) from students where import_key is null')
  if [ "$MANUAL" != 0 ]; then
    echo "в базе есть карточки без ключа импорта: $MANUAL" >&2
    exit 1
  fi
  dc --profile tools run --rm -T import < "$PACKET"
  sudo shred -u "$PACKET"
  LEFT=$(sudo docker ps -a -q --filter label=com.docker.compose.project=dv-lab --filter label=com.docker.compose.service=import)
  [ -z "$LEFT" ]
  echo NO_IMPORT_CONTAINER
)
```

Ожидаемо строка `<PACKET>: OK`, затем четыре строки `students inserted=N skipped=M`, `sections inserted=N skipped=M`, `terms inserted=N skipped=M`, `payments inserted=N skipped=M` и `NO_IMPORT_CONTAINER`. Первый запуск даёт `skipped=0` во всех строках и те же `inserted=`, что приёмка на `dvlab_dev`: 25 карточек, 66 секций, 762 термина, 29 оплат (вместе с несопоставленным переводом). Оператор сверяет `inserted=` со счётчиками, которые прислал владелец. Назад присылаются только эти строки.

Остановки:

- `sha256sum` пишет `FAILED`: файл не тот или повреждён при передаче, импорт не запускался.
- `в базе есть карточки без ключа импорта`: импорт не запускался, сообщить владельцу.
- Код 2 и `Invalid packet`: файл не пакет импорта или повреждён, в базу ничего не записано.
- Код 1 и `Import failed (CODE)` или `Import failed`: ошибка базы, транзакция откатилась, в базу ничего не записано. Логи `db` назад не присылаются (в журнал Postgres может попасть строка с данными ученика), присылаются только код выхода и строка `Import failed`.

При любой остановке блок до `shred` не доходит, и оператор сразу удаляет пакет вручную: `sudo shred -u <путь пакета>`. Новый пакет владелец передаёт после разбора причины. После `NO_IMPORT_CONTAINER` владелец и оператор удаляют свои копии пакета.

### 11.3. Повторный запуск и после импорта

Импорт выполняется один раз. Повторный запуск тем же блоком 11.2 с тем же пакетом ожидаемо печатает `inserted=0` по всем четырём таблицам и id карточек не меняет. Но оплаты, термины и секции, которые учитель удалил после импорта, повторный запуск вернёт: оплата vault, которую учитель удалил и ввёл заново исправленной, появится второй раз в исходном виде (дубль). Поэтому после первого `NO_IMPORT_CONTAINER` импорт не повторяется; если повтор всё же нужен, решение принимает владелец.

После импорта учитель задаёт открывающий остаток на каждой карточке в интерфейсе: импорт его не заполняет.

## 12. Учёт уроков и Today

### 12.1. Выкатка и миграции

Серверные шаги ведёт Server guy: раздел 8.1 или 8.2 с merge-коммитом релиза в `master`. Образы api и web должны иметь один тег `sha-<полный sha>`: контракт расписания отдаёт `outcome`, `actions`, `ledger` и `mark`; у блока нет полей `status` и `changeable`. После `DEPLOY_OK` владелец перезагружает все открытые вкладки приложения. Старый JavaScript несовместим с этим ответом недели.

Этап `migrate` в `deploy.sh` применяет две миграции из образа api под `dvlab_migrator`:

- `20261010145713_lesson_marks` — таблицы `lesson_marks` и `teacher_settings`, колонка `students.no_show_deducts` с `DEFAULT true`.
- `20261010145724_lesson_marks_revoke_delete` — отзыв `DELETE, TRUNCATE` на `lesson_marks` у `dvlab_app`.

`deploy.sh` снимает и проверяет дамп перед миграциями, затем проверяет их на временной копии базы. Отдельные команды с паролем или токеном этому релизу не нужны. Даты оплат и открывающего остатка принимаются не позже сегодняшней даты в `Asia/Ho_Chi_Minh`.

### 12.2. Проверки после выкатки

Server guy ведёт проверку авторизованных запросов под сессией учителя после перезагрузки вкладок:

| Запрос              | Ожидаемо                                                                            |
| ------------------- | ----------------------------------------------------------------------------------- |
| `GET /api/today`    | `200`; JSON с `date`, `lessons`, `earlier`, `series`, `paysSoon`, `paysSoonLessons` |
| `GET /api/settings` | `200`; `{ settings: { paysSoonLessons } }`; без строки настроек значение `2`        |

Server guy проверяет права через `has_table_privilege('dvlab_app', 'public.<таблица>', '<право>')`:

| Таблица            | Право      | Ожидаемо |
| ------------------ | ---------- | -------- |
| `lesson_marks`     | `DELETE`   | `false`  |
| `lesson_marks`     | `TRUNCATE` | `false`  |
| `teacher_settings` | `SELECT`   | `true`   |
| `teacher_settings` | `INSERT`   | `true`   |
| `teacher_settings` | `UPDATE`   | `true`   |

Upsert порога требует этих трёх прав на `teacher_settings`. Миграция отзывает `DELETE, TRUNCATE` только у `lesson_marks`. Владелец проверяет Today и задаёт начальные балансы карточек. Назад передаются только коды HTTP, результаты проверки структуры и прав. Тела ответов с данными карточек не пересылаются.

### 12.3. Откат

Откат выполняет Server guy через раздел 8.2: оба образа api и web возвращаются на один прежний sha. Владелец после отката перезагружает все открытые вкладки.

Добавленные таблицы и колонка остаются в базе. Старый код вставляет карточки с `no_show_deducts = true` по умолчанию и считает остатки без отметок уроков. Поэтому остатки на старых экранах увеличатся на сумму действующих вычетов за отметки. Отметки не исчезают при откате кода. После повторной выкатки кода учёта уроков вычеты учитываются снова.

Восстановление дампа, снятого до выкатки, теряет все изменения после создания дампа, включая отметки уроков и порог Pays soon. Решение о таком восстановлении принимает владелец.

## 13. Google Calendar

### 13.1. Stuck calendar requests

Запрос календаря — строка `google_commands`. Незавершённый запрос — строка в любом состоянии, кроме `applied` и `failed`. Пока у аккаунта есть хотя бы один незавершённый запрос, новые изменения календаря отклоняются кодом `command_pending`.

Серверные команды выполняет Server guy или владелец. Блок только читает и печатает число незавершённых запросов по состояниям, без содержимого строк:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc exec -T db psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c "select state, count(*) from google_commands where state not in ('applied', 'failed') group by state order by state"
)
```

Ожидаемо таблица `state | count`; пустой результат означает, что незавершённых запросов нет. Ошибка аутентификации `dvlab_migrator` обрабатывается как в разделе 10.4.

| Состояние                                                         | Что происходит                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `pending`, `dispatching`, `outcome_unknown`, `projection_pending` | запрос ведёт фоновый обработчик api: доводит до `applied` или `failed` либо переводит в `recovery_required` |
| `recovery_required`, `partial_recovery`                           | учитель продолжает запрос в Settings > Google Calendar > Sync кнопкой `Resume recovery`                     |

Строки `google_commands` и `google_command_stages` руками не удаляются и не правятся. Назад присылается только таблица счётчиков.

### 13.2. Условие выпуска синхронизации 25.1

Первый полный проход на проде сверяет каждый привязанный урок с Google, поэтому выпуск ждёт живую сессию владельца на тестовом аккаунте Google (локальный стек и локальный OAuth-клиент, `scripts/dev-checks/README.md`, раздел «Живая сессия владельца»). Режима «только отчёт» нет. Выпуск разрешён, когда владелец подтвердил:

- допущения провайдера A2, A3 и A6 из `25.1-RESEARCH`: копия маркера при разделении серии в Google, `originalStartTime` после правки «все события», Assign на событиях, организованных другими;
- сценарии D-21: повтор, заведённый в Google вручную для ученика, у которого уже есть серия приложения, даёт предложение Assign и никогда не сливается с серией; две серии Google одного ученика привязываются двумя отдельными Assign; перенос мастера из Google с областями «этот и следующие» и «все» оставляет прошлые уроки и их отметки; перенос и растяжение члена серии из приложения с областями «этот», «этот и следующие», «все» оставляют прошлые отмеченные уроки и остаток на месте; то же для ученика с одной серией приложения и одним повтором Google.

Назад владелец присылает только «подтверждено» по каждому пункту, без названий календарей и содержимого событий. Остальные допущения (A1, A4, A5, A7) владелец записывает по тому же списку.

Серверные команды выполняет Server guy или владелец (D-12).

### 13.3. Выкатка 25.1 и наблюдение

Выкатка идёт по разделу 8.1 или 8.2. Этап `migrate` применяет миграции фазы: `20261012164953_google_calendar_sync` (таблицы `google_calendar_events`, `google_event_ignores`, `google_sync_state`), `20261012164959_google_calendar_sync_revoke_delete` (отзыв `DELETE, TRUNCATE` у `dvlab_app` на двух из них; на `google_calendar_events` `DELETE` остаётся) и `20261012234051_google_event_commands` (расширенный `google_commands_operation_ck`). Миграции только добавляют. `deploy.sh` перезагружает Caddy: две новые строки фильтра убирают `X-Goog-Channel-Token` и `X-Goog-Resource-Uri` из обоих журналов. Новых переменных и областей Google нет.

После старта api по каждому текущему подключению идёт один полный проход. В журнале api он выглядит одной строкой `Calendar sync pass` с полями `pass` (`full`), `upserted`, `removed`, `skipped`, `truncated`, `masters`, `unseen`, `durationMs`; следом строка `Calendar inbound apply` со счётчиками `applied`, `unchanged`, `skipped_marked`, `skipped_past`, `skipped_pending`, `skipped_locked`, `failed`, если среди них есть значимые. Сбои — строки `Calendar sync pass failed` и `Calendar inbound apply failed` с `failed: 1`. В строках только счётчики.

Push работает по HTTPS-пути `/api/google/notifications`, который Caddy уже проксирует; каналы регистрируются только при HTTPS в `APP_ORIGIN`, продлеваются за сутки до срока. Ночной полный проход идёт в 03:00 по зоне учителя.

Наблюдение, только счётчики:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc exec -T db psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c "select count(*) as sync_rows, count(*) filter (where sync_token is not null) as with_token, count(*) filter (where last_full_at is not null) as with_full_pass, count(*) filter (where issue is not null) as with_issue, count(*) filter (where watch_issue is not null) as with_watch_issue, count(*) filter (where channel_id is not null) as with_channel, coalesce(max(failure_count), 0) as max_failures from google_sync_state"
  dc exec -T db psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c "select count(*) as projection_rows from google_calendar_events"
  dc logs --no-color --no-log-prefix --since 15m api | grep -E 'Calendar (sync pass|inbound apply)' || true
)
```

Ожидаемо: `sync_rows` равно числу текущих подключений, у каждого `with_full_pass` после первого прохода, `with_issue` и `with_watch_issue` равны нулю, `max_failures` равен нулю. Ненулевые `with_issue` и `max_failures` значат, что проход не завершается: Server guy присылает строки журнала со счётчиками и код `issue`, без данных событий.

### 13.4. Откат

`deploy.sh` откатывает образы и Caddy, миграции не откатывает. Три миграции фазы только добавляют (три таблицы, отзыв прав на двух из них и расширенный `google_commands_operation_ck`), поэтому прежний образ api работает на новой схеме, пока в `google_commands` нет строки с новой операцией (`event_create`, `event_update`, `event_delete`, `assign`): прежний код такую строку разобрать не может. Сначала счётчик:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  APP_TAG="sha-${SHA:?}"
  dc() { sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env "$@"; }
  dc exec -T db psql -X -U dvlab_migrator -d dvlab -v ON_ERROR_STOP=1 -c "select count(*) as new_operations from google_commands where operation in ('event_create', 'event_update', 'event_delete', 'assign')"
)
```

- `new_operations = 0`: откат образа api по разделу 8.2, затем Caddy, если нужно. Образы api и web возвращаются вместе на один прежний sha.
- `new_operations > 0`: образ api не откатывается, проблема чинится новой выкаткой. Миграции руками не откатываются.

### 13.5. Старые таблицы снимков

Таблицы `google_read_windows`, `google_read_events` и `google_next_lessons` в этом релизе не очищаются и не удаляются: прежний образ после отката читает их. Их удаляет более поздний релиз, когда образ, который их читает, вернуться уже не может.

## 14. Чат (фаза 22)

### 14.1. Переменные

`ANTHROPIC_API_KEY` лежит в `/opt/dv-lab/env/api.env`, файл ставит Server guy; `env_file` сервиса `api` в `deploy/compose.yaml` его подхватывает, правка compose не нужна. Переменную читает только `loadConfig`. Без переменной чат работает без модели: записи по быстрым формам, ответы `/today`, `/tomorrow`, `/payments` и факты карточек идут, свободный вопрос отвечает `model_unavailable`. Пустое значение даёт ошибку запуска `Invalid ANTHROPIC_API_KEY`.

Модели, их порядок, уровни, тарифы, лимиты запроса и месячный предел расхода — настройки учителя в Settings → Assistant (`teacher_settings`). На сервере они не меняются.

### 14.2. Выкатка и миграции

Выкатка идёт по разделу 8.1 или 8.2, образы api и web на одном теге `sha-<полный sha>`. Этап `migrate` применяет миграции фазы под `dvlab_migrator`:

- `20261013113547_lesson_mark_revision` — колонка `lesson_marks.revision` (`DEFAULT 1`).
- `20261013123301_chat_conversations` и `20261013123305_chat_conversations_revoke_delete` — таблица `chat_conversations`, отзыв `DELETE, TRUNCATE` у `dvlab_app`.
- `20261013124933_chat_entries` и `20261013124936_chat_entries_revoke_delete` — таблицы `student_notes` и `lesson_comments`, отзыв `DELETE, TRUNCATE`.
- `20261013130032_chat_settings` — колонки ассистента в `teacher_settings`.
- `20261013135713_chat_messages_actions` и `20261013135720_chat_messages_actions_revoke_delete` — таблицы `chat_messages` и `chat_actions`, отзыв `DELETE, TRUNCATE`.
- `20261013161230_chat_budget` и `20261013161237_chat_budget_revoke_delete` — таблицы `chat_budget_periods` и `chat_usage_attempts`, колонки переопределения модели в `chat_conversations`, отзыв `DELETE, TRUNCATE`.
- `20261013163655_chat_turns` и `20261013163659_chat_turns_revoke_delete` — таблица `chat_turns`, колонка `chat_usage_attempts.turn_id`, отзыв `DELETE, TRUNCATE`.
- `20261013181712_chat_messages_redacted_body` — ограничение `chat_messages_body_ck` допускает пустой текст стёртого сообщения.
- `20261013195421_student_gender` — колонка `students.gender` (`female`, `male` или пусто).

Миграции добавляют таблицы, колонки и ограничения; прежний образ api работает на новой схеме. Удаление разговора в приложении — пометка и стирание содержимого, строки не удаляются.

При старте api переводит незавершённые ходы модели в `interrupted` и освобождает их резервы бюджета: строка журнала `chat turns interrupted at start` со счётчиками `turns` и `attempts`. В журнале чата только id, счётчики и коды, без текста сообщений и имён.

### 14.3. Caddy и поток ответа

Поток хода `/api/chat/turns/:id/stream` — `text/event-stream` через `handle_path /api/*` с `flush_interval -1`. Сжатие `encode` стоит за matcher `@compressible`, который исключает этот путь (`path_regexp ^/api/chat/turns/[^/]+/stream$`, путь до срезания `/api`); остальные ответы сжимаются. `deploy.sh` перезагружает Caddy на этапе выкатки.

После выкатки Server guy проверяет под сессией учителя: ответ потока без `Content-Encoding`, события приходят по мере ответа, без задержки до конца хода; соседний путь `/api/*` отдаётся со сжатием. Назад передаются только заголовки и тайминги, без текста ответа.

### 14.4. Проверки после выкатки

Права через `has_table_privilege('dvlab_app', 'public.<таблица>', '<право>')`: `DELETE` и `TRUNCATE` дают `false` для `chat_conversations`, `chat_messages`, `chat_actions`, `chat_turns`, `chat_budget_periods`, `chat_usage_attempts`, `student_notes`, `lesson_comments`.

Владелец открывает Chat и Settings → Assistant после перезагрузки вкладок. Живой вопрос модели и расход по `usage` владелец проверяет сам с ключом.

### 14.5. Откат

Откат образов api и web на один прежний sha по разделу 8.2, миграции не откатываются. Прежний образ не читает таблицы чата; разговоры, заметки и комментарии остаются в базе и возвращаются после повторной выкатки.

## 15. Подтверждаемые изменения из чата и точки входа (фаза 23)

### 15.1. Выкатка и миграции

Выкатка идёт по разделу 8.1 или 8.2, образы api и web на одном теге `sha-<полный sha>`. Этап `migrate` применяет миграции фазы под `dvlab_migrator`:

- `20261014040312_chat_changes` — ограничение `chat_actions_kind_ck` допускает kind `change` (предложения изменений из чата).
- `20261014044620_card_payment_revision` — колонки `students.revision` и `payments.revision` (`DEFAULT 1`, CHECK `revision >= 1`).

Миграции только расширяют ограничение и добавляют колонки; прежний образ api работает на новой схеме. Новых переменных окружения нет, `deploy/compose.yaml`, поток ответа чата и Caddy не меняются.

### 15.2. Проверки после выкатки

Колонки на месте: `select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'revision' and table_name in ('students', 'payments')` даёт 2. Права `dvlab_app` на таблицы чата прежние (раздел 14.4).

Живые сценарии после выкатки проверяет владелец (`.planning/phases/23-confirmed-chat-changes-and-entry-points/23-PLAN-INDEX.md`, раздел «Живые проверки владельца»): предложения настоящей модели, запись в Google на тестовом аккаунте, экранная клавиатура телефона. Назад передаются только «подтверждено» и счётчики.

### 15.3. Откат

Откат образов api и web на один прежний sha по разделу 8.2, миграции не откатываются. Колонки `revision` остаются со своими значениями. Образ с чатом, но без фазы 23, разбирает блоки сообщений строгой схемой и не знает блоков `change_proposal` и `essay`: разговоры с такими блоками в нём не открываются, пока не вернётся образ фазы 23; строки не теряются. Образ без чата таблицы чата не читает (раздел 14.5).

## 16. Заметки блоками, ревизия, тексты команд и push (фаза 25.2)

### 16.1. Переменные push

Три переменные в `/opt/dv-lab/env/api.env`, файл ставит Server guy: `PUSH_VAPID_PUBLIC_KEY`, `PUSH_VAPID_PRIVATE_KEY`, `PUSH_VAPID_SUBJECT`. Читает их только `loadConfig`. Правило «все три или ни одной»: без всех трёх push выключен (настройки уведомлений показывают «Not set up on the server»); одна или две переменные, пустое значение (`PUSH_VAPID_SUBJECT=`) или subject не `https://` — api не стартует с ошибкой `Invalid push configuration`. Пустые строки шаблона `deploy/env.example` в `api.env` не копируются. `PUSH_VAPID_SUBJECT` — `https://`-адрес приложения, не почта.

Пара ключей генерируется на сервере из образа api выкатываемого релиза (пакет `web-push` в образе); вывод — две строки `PUSH_VAPID_PUBLIC_KEY=…` и `PUSH_VAPID_PRIVATE_KEY=…`, они дописываются в `api.env` и назад не присылаются:

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
  sudo docker run --rm --entrypoint node "ghcr.io/kdvornichenko/dv-lab-api:sha-$SHA" -e "const k = require('web-push').generateVAPIDKeys(); console.log('PUSH_VAPID_PUBLIC_KEY=' + k.publicKey); console.log('PUSH_VAPID_PRIVATE_KEY=' + k.privateKey)"
)
```

Смена пары ключей отзывает все подписки устройств: push на них больше не доходит, учитель заново включает уведомления на каждом устройстве (Settings → General → Notifications on this device). Ключи без нужды не меняются.

Исходящий HTTPS api к push-сервисам (FCM, Mozilla, Apple) должен быть открыт.

### 16.2. Выкатка и миграции

Порядок: сначала три `PUSH_VAPID_*` в `api.env` (16.1), затем выкатка по разделу 8.1 или 8.2; в `deploy.sh` этап `migrate` идёт до старта api. Без VAPID выкатка тоже проходит, push просто выключен. Миграции фазы под `dvlab_migrator`:

- `20261014181157_note_blocks` — колонки блоков в `student_sections` (`id`, `name`, `position`, `revision`, `deleted_at`) и колонки словаря (`added_by`, `removed_at`, `removed_by`).
- `20261014181205_note_blocks_kind_check` — снимает `student_sections_kind_ck` (единственное снятие ограничения, решение D-02): ключи своих блоков `b_…` ему не соответствуют, ограничение не возвращается.
- `20261014181210_note_blocks_backfill` — custom-миграция: каждой карточке шесть стандартных блоков с именами и позициями, сохранённый текст блока не меняется; повтор ничего не добавляет.
- `20261014181255_review_prompts_settings` — таблицы `note_reviews` и `chat_command_prompts`, колонки уведомлений `teacher_settings` (`notify_lesson_soon`, `notify_lesson_minutes`, `notify_pays_soon`).
- `20261014181316_push_notifications` — таблицы `push_subscriptions`, `push_deliveries`, `push_payment_alerts`.
- `20261014181321_notes_push_revoke_delete` — отзыв `DELETE, TRUNCATE` у `dvlab_app` на `note_reviews`, `chat_command_prompts`, `push_subscriptions`, `push_deliveries`, `push_payment_alerts`.

При старте api с VAPID запускается планировщик уведомлений (раз в минуту): «скоро урок» за выбранное учителем число минут и «скоро платить» при достижении порога Pays soon.

### 16.3. Проверки после выкатки

- Права: `has_table_privilege('dvlab_app', 'public.<таблица>', 'DELETE')` и `'TRUNCATE'` дают `false` для пяти таблиц из 16.2; ограничения `student_sections_kind_ck` нет (`select count(*) from pg_constraint where conname = 'student_sections_kind_ck'` даёт 0).
- Без cookie через Caddy: `curl -sI https://dv-lab.dev/sw.js` — код 200, `Cache-Control: no-cache, no-store, must-revalidate`, тип `application/javascript`; `curl -sI https://dv-lab.dev/manifest.webmanifest` — код 200, без редиректа на `/login`.
- `GET /api/push/config` под сессией учителя отвечает `enabled: true` после установки VAPID.
- Владелец на iPhone (iOS 16.4 и новее, только приложение, добавленное на Домашний экран): включает уведомления в Settings → General, получает push урока и переходит по тапу на урок. Назад передаются только «подтверждено» и коды, без адресов подписок и ключей.

### 16.4. Откат

Откат образов api и web на один прежний sha по разделу 8.2, миграции не откатываются, `student_sections_kind_ck` не возвращается. Образ до фазы не знает `deleted_at` и своих блоков `b_…`: мягко удалённые стандартные блоки он показывает как обычные, свои блоки учителя ему неизвестны. Старые api и web не разбирают новые блоки чата (`note_change`, `review_offer`, `review_result`) в сохранённых сообщениях: разговоры с ними не открываются, пока не вернётся образ фазы; строки не теряются. Таблицы `push_*`, `note_reviews`, `chat_command_prompts` и колонки уведомлений остаются и старым образом не читаются; push после отката не отправляется, подписки устройств остаются в базе.

## 17. Конструктор команд чата, панель и push ассистента (фаза 25.3)

### 17.1. Выкатка и миграции

Порядок: выкатка по разделу 8.1 или 8.2, этап `migrate` идёт до старта api. Миграции только добавляют:

- таблица `chat_commands` (команды конструктора) и отзыв `DELETE, TRUNCATE` у `dvlab_app` на ней;
- колонка `notify_assistant` в `teacher_settings` (по умолчанию выключена).

Новая необязательная переменная `CHAT_CACHE_DIAGNOSTICS` (`1` включает запись причины промаха кэша в журнал попыток; по умолчанию выключена).

### 17.2. Замена Fable на Opus в данных (разовая, вне выкатки)

Fable 5.1 убрана из списка моделей по умолчанию. Если в настройках или разговорах осталось её имя, разговор с ней отвечает «модель недоступна». Server guy делает один раз, под ролью миграций, в транзакции, после выкатки; значения аккаунтов не печатаются, только счётчики:

1. До правки: число строк `teacher_settings`, где `chat_models` содержит `claude-fable-5-1`; число строк, где `chat_model = 'claude-fable-5-1'`; число `chat_conversations`, где `model_override = 'claude-fable-5-1'`.
2. Правка: `chat_model` и `model_override` со значением `claude-fable-5-1` меняются на `claude-opus-5-5`; в `chat_models` (если не null) запись `claude-fable-5-1` убирается, а если `claude-opus-5-5` в списке нет, на её место ставится запись Opus из `CHAT_SETTINGS_DEFAULT`.
3. После правки те же три счётчика равны нулю.

Шаг не входит в миграции релиза и не откатывается кодом; откат — восстановление из резервной копии по разделу бэкапов.

### 17.3. Проверки после выкатки

- `has_table_privilege('dvlab_app', 'public.chat_commands', 'DELETE')` и `'TRUNCATE'` дают `false`.
- В журнале api нет `400` с `Schema is too complex` на ходе команды; любое такое `400` — дефект.
- Владелец создаёт вымышленную команду в Settings и получает блоки с Copy (после выгрузки дизайна конструктора).

### 17.4. Откат

Откат образов api и web на один прежний sha по разделу 8.2; миграции не откатываются, новые таблица и колонка не мешают прежнему образу.
