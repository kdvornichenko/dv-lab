# RUNBOOK: dv-lab на VPS

Шаги оператора (Server guy или владелец) от пустого VPS до `DEPLOY_OK` и `RESTORE_OK`. У агентов доступа к серверу, DNS и GitHub нет: все команды выполняет оператор.

## 0. Обозначения

- На сервере команды выполняются под `ubuntu` через `sudo`. Клон `/opt/dv-lab/repo` принадлежит root, поэтому `deploy.sh`, `backup.sh`, `restore-check.sh` и `git -C /opt/dv-lab/repo` запускаются только через `sudo` (без него git отвечает `dubious ownership`).
- Каждый блок — подоболочка `( set -Eeuo pipefail; … )`. Блок вставляется в bash целиком; на Mac сначала запустить `bash` (zsh понимает `set -E` иначе). Ошибка любой команды завершает блок с ненулевым кодом. Конструкций `… || echo`, `команда | grep -q` и `%{redirect_url}` в блоках нет.
- Значения, которые знает только оператор, задаются переменными в первых строках блока: `VPS_IPV4`, `VPS_IPV6`, `CLIENT_IPV6`, `SHA`, `DUMP`, `SERVICE`, `GHCR_USER`. Пустая переменная останавливает блок на проверке `${VAR:?}`. Реальные адреса, пароли и токены в этот файл не записываются.
- `curl` в блоках печатает только `http_code` или тело `/healthz`.
- `SHA` — полный sha коммита, 40 hex без префикса `sha-`: для работающего релиза — из строки `DEPLOY_OK <прошлый> -> sha-<SHA>` или из поля `to=sha-<SHA>` последней строки `OK` в `/opt/dv-lab/state/deploy-journal.log`; для раздела 5a и первой выкатки — merge-коммит в `master` (`sudo git -C /opt/dv-lab/repo rev-parse origin/master` после `fetch`).
- Одна форма ручного вызова docker compose (разделы 5, 5a, 6, 9): в начале блока задаётся `SHA`, затем `APP_TAG="sha-${SHA:?}"`, и compose вызывается как `sudo env APP_TAG="$APP_TAG" docker compose -f /opt/dv-lab/repo/deploy/compose.yaml --env-file /opt/dv-lab/env/db.env <команда>` (в блоках — функция `dc` с этой строкой). Compose интерполирует весь файл, и без `APP_TAG` падают даже `logs` и `up -d db`. `sudo` сбрасывает окружение, поэтому `APP_TAG` передаётся через `env`. Файл состояния выкатки в каталоге `state` ручные блоки не читают: при первой выкатке и на пересобранном VPS его нет. Пароли compose берёт из `db.env`. `exec` вызывается с `-T`.
- Переменные для `deploy.sh` передаются так же: `sudo env FORCE=1 /opt/dv-lab/repo/deploy/deploy.sh`.
- Отступы в блоках — пробелы: табуляция при вставке в bash без bracketed paste запускает автодополнение.
- Назад присылаются коды и строки-маркеры (`DEPLOY_OK`, `BACKUP_OK`, `RESTORE_OK`, `DNS_OK`, коды HTTP), без адресов и паролей.

Порядок первого релиза: 1 и 2 (проверка) → 3.1 (TTL) → 4 → 5a → 3.3–3.4 (переключение DNS) → 5 → 6 → 7. Раздел 8 — каждая следующая выкатка, раздел 9 — авария.

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

Образы `ghcr.io/kdvornichenko/dv-lab-api` и `ghcr.io/kdvornichenko/dv-lab-web` публикует CI после push в `master`, тег `sha-<полный sha>`. Пакет создаётся приватным. Два варианта; `docker manifest inspect` и `docker pull` в `deploy.sh` работают в обоих без изменений.

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

Токен GitHub (classic) только с `read:packages`. Вход под root, токен вводится без отображения:

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

## 6. Проверка снаружи

Блоки 6.1–6.4 — с Mac или другого хоста с IPv4 и IPv6, блоки 6.5–6.6 — на сервере.

### 6.1. HTTPS по IPv4 и IPv6

```bash
(
  set -Eeuo pipefail
  for v in -4 -6; do
    for p in /healthz /; do
      CODE=$(curl "$v" -s -o /dev/null -w '%{http_code}' --max-time 10 "https://dv-lab.dev$p")
      echo "$v $p $CODE"
      [ "$CODE" = 200 ]
    done
  done
  curl -4 -s --max-time 10 https://dv-lab.dev/healthz
  echo
)
```

Ожидаемо четыре строки с `200` и тело `/healthz` с `sha` текущего релиза и `"db":"ok"`.

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

Если вместо адреса клиента в `remote_ip` адрес шлюза Docker, это записывается владельцу как вопрос до фазы 18 (ограничение попыток входа по IP).

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

Ожидаемо не больше 20 с и код выхода контейнера `0`; api снова `healthy`. Страница-заглушка `https://dv-lab.dev` открывается в браузере.

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

### 8.1. Выкатка `origin/master`

```bash
(
  set -Eeuo pipefail
  sudo /opt/dv-lab/repo/deploy/deploy.sh
)
```

### 8.2. Выкатка конкретного коммита или откат

Откат — выкатка прошлого sha (из строки `OK` журнала). Откатывается только образ, схема базы не откатывается: миграции одного релиза только добавляют.

```bash
(
  set -Eeuo pipefail
  SHA=
  case "${SHA:?}" in *[^0-9a-f]*) echo "SHA: 40 hex без sha-" >&2; exit 1 ;; esac
  [ "${#SHA}" -eq 40 ]
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
