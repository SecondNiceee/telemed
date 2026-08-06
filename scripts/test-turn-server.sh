#!/bin/bash
# Тест TURN/STUN серверов без специальных утилит

echo "=== Тест подключения к TURN/STUN серверам ==="
echo ""

TURN_HOST="nice-sites.online"

# 1. Проверка DNS
echo "1. Проверка DNS для $TURN_HOST..."
if nslookup $TURN_HOST > /dev/null 2>&1 || host $TURN_HOST > /dev/null 2>&1; then
    echo "   DNS OK"
    host $TURN_HOST 2>/dev/null || nslookup $TURN_HOST 2>/dev/null
else
    echo "   DNS FAILED - домен не резолвится"
fi
echo ""

# 2. Проверка портов
echo "2. Проверка портов..."

# STUN/TURN UDP порт 3478
echo -n "   3478/UDP (STUN/TURN): "
if timeout 3 bash -c "echo > /dev/udp/$TURN_HOST/3478" 2>/dev/null; then
    echo "OK (UDP открыт)"
else
    echo "FAILED или UDP заблокирован"
fi

# STUN/TURN TCP порт 3478
echo -n "   3478/TCP (TURN TCP):  "
if timeout 3 bash -c "cat < /dev/tcp/$TURN_HOST/3478" 2>/dev/null || nc -z -w3 $TURN_HOST 3478 2>/dev/null; then
    echo "OK"
else
    echo "FAILED"
fi

# TURNS порт 5349
echo -n "   5349/TCP (TURNS TLS): "
if timeout 3 bash -c "cat < /dev/tcp/$TURN_HOST/5349" 2>/dev/null || nc -z -w3 $TURN_HOST 5349 2>/dev/null; then
    echo "OK"
else
    echo "FAILED"
fi
echo ""

# 3. Проверка TLS сертификата для TURNS
echo "3. Проверка TLS сертификата для TURNS..."
if command -v openssl &> /dev/null; then
    echo | timeout 5 openssl s_client -connect $TURN_HOST:5349 2>/dev/null | openssl x509 -noout -dates 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "   TLS сертификат OK"
    else
        echo "   TLS сертификат FAILED или самоподписанный"
    fi
else
    echo "   openssl не установлен, пропускаем"
fi
echo ""

# 4. Google STUN серверы
echo "4. Проверка Google STUN серверов..."
for stun in stun.l.google.com stun1.l.google.com stun2.l.google.com; do
    echo -n "   $stun:19302 - "
    if timeout 3 bash -c "echo > /dev/udp/$stun/19302" 2>/dev/null; then
        echo "OK"
    else
        echo "FAILED"
    fi
done
echo ""

echo "=== Альтернативный тест через curl ==="
echo ""

# 5. Если есть curl - проверка HTTP на тех же IP
echo "5. Проверка что сервер отвечает..."
if command -v curl &> /dev/null; then
    IP=$(host $TURN_HOST 2>/dev/null | grep "has address" | head -1 | awk '{print $4}')
    if [ -n "$IP" ]; then
        echo "   IP сервера: $IP"
        echo -n "   Ping: "
        if ping -c 1 -W 3 $IP > /dev/null 2>&1; then
            echo "OK"
        else
            echo "FAILED (ICMP заблокирован или хост недоступен)"
        fi
    fi
fi

echo ""
echo "=== Рекомендации ==="
echo ""
echo "Для полного теста TURN с авторизацией используй браузер:"
echo "1. Открой консоль разработчика (F12)"
echo "2. Выполни этот код:"
echo ""
cat << 'EOF'
// Тест TURN сервера
const pc = new RTCPeerConnection({ 
  iceServers: [{ 
    urls: 'turn:nice-sites.online:3478', 
    username: 'testuser', 
    credential: 'TestPass123' 
  }],
  iceTransportPolicy: 'relay' // только TURN
});
pc.createDataChannel('test');
pc.createOffer().then(o => pc.setLocalDescription(o));
pc.onicecandidate = e => { 
  if(e.candidate) {
    if(e.candidate.candidate.includes('relay')) {
      console.log('TURN РАБОТАЕТ!', e.candidate.candidate);
    }
  } else {
    console.log('ICE gathering завершен');
  }
};
setTimeout(() => {
  if(!pc.localDescription?.sdp?.includes('relay')) {
    console.log('TURN НЕ РАБОТАЕТ - нет relay кандидатов');
  }
  pc.close();
}, 10000);
EOF
echo ""
