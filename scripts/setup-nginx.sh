#!/usr/bin/env bash
# ============================================================================
#  Установка и проверка nginx для telemed.smartcardio.ru (HTTPS :443 + Certbot,
#  :80 только редиректит на https)
#  Запуск на сервере из корня проекта:
#      sudo bash scripts/setup-nginx.sh
#  Только проверка, без изменений:
#      sudo bash scripts/setup-nginx.sh --check
# ============================================================================
set -euo pipefail

DOMAIN="telemed.smartcardio.ru"
CONF_SRC="$(cd "$(dirname "$0")/.." && pwd)/nginx/${DOMAIN}.conf"
CONF_DST="/etc/nginx/sites-available/${DOMAIN}"
LINK_DST="/etc/nginx/sites-enabled/${DOMAIN}"
CHECK_ONLY="${1:-}"

ok()   { echo "  [ OK ] $*"; }
bad()  { echo "  [FAIL] $*"; }
head_() { echo; echo "== $*"; }

if [[ "$CHECK_ONLY" != "--check" ]]; then
  head_ "Установка конфига"
  [[ -f "$CONF_SRC" ]] || { bad "нет файла $CONF_SRC"; exit 1; }

  # Частая поломка: конфиг вставили из терминала вместе с шапкой редактора
  # ("GNU nano 8.7.1  /etc/nginx/..."). nginx падает на unknown directive.
  if head -3 "$CONF_SRC" | grep -qE 'GNU nano|^\s*File:\s'; then
    bad "в начале $CONF_SRC остался вывод редактора (GNU nano ...) — уберите эту строку"
    exit 1
  fi

  # Бэкап действующего конфига, чтобы откатиться, если новый не проходит nginx -t.
  BACKUP=""
  if [[ -f "$CONF_DST" ]]; then
    BACKUP="${CONF_DST}.bak.$(date +%Y%m%d-%H%M%S)"
    cp -a "$CONF_DST" "$BACKUP"
    ok "бэкап прежнего конфига: $BACKUP"
  fi

  install -m 644 "$CONF_SRC" "$CONF_DST"
  ok "скопирован в $CONF_DST"

  # default_server из дистрибутива перехватывает запросы без Host — убираем.
  if [[ -L /etc/nginx/sites-enabled/default ]]; then
    rm -f /etc/nginx/sites-enabled/default
    ok "отключён сайт default"
  fi

  ln -sfn "$CONF_DST" "$LINK_DST"
  ok "включён симлинк $LINK_DST"

  mkdir -p /var/www/certbot
  ok "создан webroot /var/www/certbot (для certbot --webroot)"

  head_ "Проверка синтаксиса"
  # set -e оборвал бы скрипт с уже установленным битым конфигом,
  # поэтому проверяем вручную и откатываемся.
  if ! nginx -t; then
    bad "конфиг не прошёл nginx -t"
    if [[ -n "$BACKUP" ]]; then
      cp -a "$BACKUP" "$CONF_DST"
      bad "откатились на прежний конфиг ($BACKUP) — nginx не перезагружался"
    else
      rm -f "$LINK_DST"
      bad "сайт отключён (симлинк удалён), чтобы nginx остался работоспособным"
    fi
    exit 1
  fi
  ok "синтаксис корректен"

  head_ "Перезагрузка"
  systemctl reload nginx || systemctl restart nginx
  ok "nginx перезагружен"
fi

head_ "Локальные бэкенды"
for pair in "3000:Next.js/Payload" "3001:Socket.IO" "3002:MediaSoup"; do
  port="${pair%%:*}"; name="${pair#*:}"
  if (echo >"/dev/tcp/127.0.0.1/${port}") 2>/dev/null; then
    ok "${name} слушает 127.0.0.1:${port}"
  else
    bad "${name} НЕ слушает 127.0.0.1:${port} — запустите pnpm start / pnpm socket / pnpm mediasoup"
  fi
done

head_ "Проверка через nginx (Host: ${DOMAIN})"
# Конфиг с Certbot: :80 отдаёт только 301, весь сайт живёт на :443.
# Поэтому проверяем именно HTTPS, иначе socket.io/health ложно "падают".
# --resolve подставляет localhost, сохраняя SNI и валидируя реальный серт.
CURL_BASE=(curl -s --max-time 5 --resolve "${DOMAIN}:443:127.0.0.1")
get()  { "${CURL_BASE[@]}" "https://${DOMAIN}$1" 2>/dev/null || true; }
code() { "${CURL_BASE[@]}" -o /dev/null -w '%{http_code}' "https://${DOMAIN}$1" 2>/dev/null || true; }

c=$(code "/")
if [[ "$c" == 200 || "$c" == 3* ]]; then ok "сайт / -> $c"; else bad "сайт / -> $c"; fi

# Редирект с :80 на https — отдельная проверка.
r=$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1/" 2>/dev/null || true)
if [[ "$r" == 301 || "$r" == 302 ]]; then ok "редирект :80 -> https ($r)"; else bad "редирект :80 -> https дал $r"; fi

# Загрузка медиа в Payload: POST на /api/media без завершающего слеша.
# Без токена ждём 401/403 — это значит, что запрос ДОШЁЛ до Payload.
# 404 говорит, что правило location его не поймало, 413 — лимит тела.
mc=$(printf 'x' > /tmp/_nginx_probe.png; "${CURL_BASE[@]}" -o /dev/null -w '%{http_code}' \
      -X POST -F 'file=@/tmp/_nginx_probe.png;type=image/png' -F 'alt=probe' \
      "https://${DOMAIN}/api/media" 2>/dev/null || true; rm -f /tmp/_nginx_probe.png)
case "$mc" in
  401|403|400) ok "POST /api/media дошёл до Payload -> $mc (ожидаемо без авторизации)" ;;
  200|201)     ok "POST /api/media -> $mc" ;;
  000)         bad "POST /api/media: соединение оборвано — это и есть 'Failed to fetch'" ;;
  *)           bad "POST /api/media -> $mc (404 = location не сработал, 413 = лимит тела)" ;;
esac

hs=$(get '/socket.io/?EIO=4&transport=polling' | head -c 1)
if [[ "$hs" == "0" ]]; then ok "/socket.io/ handshake отвечает"; else bad "/socket.io/ handshake не отвечает"; fi

hm=$(get '/mediasoup/?EIO=4&transport=polling' | head -c 1)
if [[ "$hm" == "0" ]]; then ok "/mediasoup/ handshake отвечает"; else bad "/mediasoup/ handshake не отвечает"; fi

if get /health/socket    | grep -q '"ok"'; then ok "health socket";    else bad "health socket";    fi
if get /health/mediasoup | grep -q '"ok"'; then ok "health mediasoup"; else bad "health mediasoup"; fi

head_ "Папка загрузок Payload (media)"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# MEDIA_DIR из .env, иначе <корень проекта>/media (см. src/lib/media-dir.ts).
MEDIA_DIR="$(grep -E '^MEDIA_DIR=.+' "${PROJECT_DIR}/.env" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"'"'"'' || true)"
[[ -n "${MEDIA_DIR}" ]] || MEDIA_DIR="${PROJECT_DIR}/media"

if [[ -d "$MEDIA_DIR" ]]; then
  ok "папка существует: $MEDIA_DIR"
else
  bad "папки нет: $MEDIA_DIR — создайте: mkdir -p '$MEDIA_DIR'"
fi

# Права нужны пользователю, под которым запущен Next.js, а не root.
NEXT_USER="$(ps -o user= -C node --sort=start_time 2>/dev/null | head -1 | tr -d ' ' || true)"
if [[ -n "$NEXT_USER" && -d "$MEDIA_DIR" ]]; then
  if sudo -u "$NEXT_USER" test -w "$MEDIA_DIR" 2>/dev/null; then
    ok "пользователь '$NEXT_USER' может писать в $MEDIA_DIR"
  else
    bad "у '$NEXT_USER' НЕТ прав на запись: sudo chown -R $NEXT_USER '$MEDIA_DIR'"
  fi
fi

head_ "WebRTC-медиа (не через nginx)"
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 13478; then
  ok "порт 13478 открыт в ufw"
else
  bad "откройте медиа-порт: sudo ufw allow 13478/udp && sudo ufw allow 13478/tcp"
fi
if grep -q '^MEDIASOUP_ANNOUNCED_IP=[0-9]' .env 2>/dev/null; then
  ok "MEDIASOUP_ANNOUNCED_IP задан"
else
  bad "укажите публичный IP сервера в MEDIASOUP_ANNOUNCED_IP (.env)"
fi

echo
echo "Готово. Сайт обслуживается по HTTPS (сертификат Certbot), :80 редиректит."
echo "Если правили конфиг — сертификат обновляется отдельно: sudo certbot renew --dry-run"
