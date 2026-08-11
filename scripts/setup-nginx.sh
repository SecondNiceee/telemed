#!/usr/bin/env bash
# ============================================================================
#  Установка и проверка nginx для telemed.smartcardio.ru (HTTP, порт 80)
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
  ok "создан webroot /var/www/certbot (для будущего certbot)"

  head_ "Проверка синтаксиса"
  nginx -t

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
get()  { curl -s --max-time 5 -H "Host: ${DOMAIN}" "http://127.0.0.1$1" 2>/dev/null || true; }
code() { curl -s --max-time 5 -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" "http://127.0.0.1$1" 2>/dev/null || true; }

c=$(code "/")
if [[ "$c" == 200 || "$c" == 3* ]]; then ok "сайт / -> $c"; else bad "сайт / -> $c"; fi

hs=$(get '/socket.io/?EIO=4&transport=polling' | head -c 1)
if [[ "$hs" == "0" ]]; then ok "/socket.io/ handshake отвечает"; else bad "/socket.io/ handshake не отвечает"; fi

hm=$(get '/mediasoup/?EIO=4&transport=polling' | head -c 1)
if [[ "$hm" == "0" ]]; then ok "/mediasoup/ handshake отвечает"; else bad "/mediasoup/ handshake не отвечает"; fi

if get /health/socket    | grep -q '"ok"'; then ok "health socket";    else bad "health socket";    fi
if get /health/mediasoup | grep -q '"ok"'; then ok "health mediasoup"; else bad "health mediasoup"; fi

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
echo "Готово. Помните: по HTTP браузер не даст доступ к камере и микрофону —"
echo "для видеозвонков нужен HTTPS (инструкция в конце nginx/${DOMAIN}.conf)."
