#!/usr/bin/env bash
# Instala/atualiza os Treinamentos UPDOWN neste servidor (Ubuntu/Debian, Node >= 18).
#   sudo bash deploy/instalar.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=/opt/treinamentos-updown
DATA=/var/lib/treinamentos-updown
command -v node >/dev/null || { echo "Instale o Node.js 18+ antes."; exit 1; }
id treinamentos >/dev/null 2>&1 || useradd --system --home "$DATA" --shell /usr/sbin/nologin treinamentos
mkdir -p "$DEST" "$DATA"
rsync -a --delete --exclude .git --exclude data ./ "$DEST/"
chown -R root:treinamentos "$DEST"
find "$DEST" -type d -exec chmod 750 {} +
find "$DEST" -type f -exec chmod 640 {} +
chmod 750 "$DEST/deploy/instalar.sh"
chown -R treinamentos:treinamentos "$DATA"; chmod 750 "$DATA"
[ -f /etc/treinamentos-updown.env ] || { cp .env.example /etc/treinamentos-updown.env; echo "Revise /etc/treinamentos-updown.env"; }
chown root:treinamentos /etc/treinamentos-updown.env; chmod 640 /etc/treinamentos-updown.env
cp deploy/treinamentos-updown.service /etc/systemd/system/treinamentos-updown.service
systemctl daemon-reload
systemctl enable --now treinamentos-updown
systemctl restart treinamentos-updown
PORTA=$(grep -E '^PORT=' /etc/treinamentos-updown.env | cut -d= -f2); PORTA=${PORTA:-8791}
for _ in 1 2 3 4 5; do curl -fsS "http://127.0.0.1:$PORTA/healthz" >/dev/null 2>&1 && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$PORTA/healthz" >/dev/null 2>&1; then
  echo "ok — treinamentos rodando em 127.0.0.1:$PORTA"
else
  echo "Não subiu. Veja: journalctl -u treinamentos-updown -n 30 --no-pager" >&2
  exit 1
fi
