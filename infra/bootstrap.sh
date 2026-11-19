#!/usr/bin/env bash
# Bootstrap Ubuntu 24.04 cho Internship Tracker (trial A).
#
# Idempotent: chạy lại nhiều lần không lỗi, không đổi gì.
#
# CÁCH DÙNG (2 lần, cố ý tách ra cho an toàn):
#   1) bash bootstrap.sh                  # user, key, ufw, fail2ban, updates
#   2) mở TERMINAL MỚI, test: ssh deploy@<IP>
#   3) bash bootstrap.sh --harden         # chỉ khi (2) đã vào được
#
# TRƯỚC KHI CHẠY: mở console provider (đường recovery). Script reload sshd,
# không restart — session root hiện tại vẫn sống, nhưng đừng đóng nó.
#
# Biến môi trường:
#   DEPLOY_USER=deploy  PUBKEY_FILE=/root/id.pub  SSH_PORT=22
#
# Đã kiểm chứng thủ công trên VM 16/11 (hardening, ufw, key-only).
# Chạy end-to-end trên VPS trắng ở buổi drill 26/11.

set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
PUBKEY_FILE="${PUBKEY_FILE:-}"
HARDEN=0
[[ "${1:-}" == "--harden" ]] && HARDEN=1

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'CẢNH BÁO: %s\n' "$*" >&2; }
die()  { printf 'LỖI: %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "chạy bằng sudo"

# --- 1. Package -------------------------------------------------------------
log "Cập nhật và cài package"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ufw fail2ban unattended-upgrades ca-certificates curl git dnsutils

# --- 2. User deploy ---------------------------------------------------------
if id "$DEPLOY_USER" &>/dev/null; then
  log "User $DEPLOY_USER đã tồn tại"
else
  log "Tạo user $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
fi
usermod -aG sudo "$DEPLOY_USER"

# --disabled-password => sudo sẽ hỏi password không tồn tại => cần NOPASSWD.
SUDOERS=/etc/sudoers.d/90-$DEPLOY_USER
if [[ ! -f "$SUDOERS" ]]; then
  log "Cho $DEPLOY_USER sudo không mật khẩu (chuẩn cho user deploy key-only)"
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$DEPLOY_USER" > "$SUDOERS"
  chmod 0440 "$SUDOERS"
  visudo -cf "$SUDOERS" || die "sudoers sai"
fi

# --- 3. authorized_keys -----------------------------------------------------
# Mặc định: dùng lại key đang cho root đăng nhập (trường hợp phổ biến nhất).
if [[ -z "$PUBKEY_FILE" && -s /root/.ssh/authorized_keys ]]; then
  PUBKEY_FILE=/root/.ssh/authorized_keys
  log "Dùng lại key đang cho root đăng nhập: $PUBKEY_FILE"
fi

if [[ -n "$PUBKEY_FILE" ]]; then
  [[ -f "$PUBKEY_FILE" ]] || die "không thấy $PUBKEY_FILE"
  install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  touch "/home/$DEPLOY_USER/.ssh/authorized_keys"
  KEY="$(cat "$PUBKEY_FILE")"
  grep -qF "$KEY" "/home/$DEPLOY_USER/.ssh/authorized_keys" \
    || printf '%s\n' "$KEY" >> "/home/$DEPLOY_USER/.ssh/authorized_keys"
  chown -R "$DEPLOY_USER:$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
  chmod 600 "/home/$DEPLOY_USER/.ssh/authorized_keys"
  log "Đã cài public key cho $DEPLOY_USER"
fi

# --- 4. ufw (allow SSH TRƯỚC khi enable) ------------------------------------
log "Cấu hình ufw"
ufw --force default deny incoming
ufw --force default allow outgoing
ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose

# --- 5. fail2ban ------------------------------------------------------------
log "Cấu hình fail2ban cho sshd"
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled  = true
maxretry = 3
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban
systemctl reload-or-restart fail2ban

# --- 6. unattended-upgrades -------------------------------------------------
log "Bật unattended-upgrades"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades 2>/dev/null || warn "unattended-upgrades không bật được, kiểm tra tay"

# --- 7. Hardening SSH (chỉ khi --harden) ------------------------------------
if [[ $HARDEN -eq 0 ]]; then
  log "Bỏ qua hardening SSH (chưa có --harden)"
  cat <<EOF

Bước tiếp theo, làm theo đúng thứ tự:
  1. Mở terminal MỚI trên máy bạn:  ssh $DEPLOY_USER@<IP>
  2. Vào được rồi mới chạy:        sudo bash $0 --harden
  3. Đóng session root SAU CÙNG, không phải bây giờ.

EOF
  exit 0
fi

AK="/home/$DEPLOY_USER/.ssh/authorized_keys"
[[ -s "$AK" ]] || die "$AK rỗng — tắt password auth bây giờ là tự khoá mình"

log "Ghi cấu hình hardening SSH"
# Tên file PHẢI là 00-: sshd đọc sshd_config.d/*.conf theo thứ tự chữ cái
# và lấy giá trị ĐẦU TIÊN. Cloud image có 50-cloud-init.conf → 99- sẽ thua.
cat >/etc/ssh/sshd_config.d/00-hardening.conf <<EOF
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
EOF

sshd -t || die "sshd config không hợp lệ, KHÔNG reload"

log "Reload sshd (session hiện tại vẫn sống)"
systemctl reload ssh

# --- 8. Verify --------------------------------------------------------------
log "Kiểm tra lại"
printf '%-28s %s\n' "permitrootlogin"        "$(sshd -T | awk '/^permitrootlogin/{print $2}')"
printf '%-28s %s\n' "passwordauthentication" "$(sshd -T | awk '/^passwordauthentication/{print $2}')"
printf '%-28s %s\n' "kbdinteractiveauth"     "$(sshd -T | awk '/^kbdinteractiveauthentication/{print $2}')"
printf '%-28s %s\n' "ssh port"               "$(sshd -T | awk '/^port/{print $2}')"
echo
ufw status | sed -n '1,12p'

cat <<EOF

XONG. Bắt buộc làm ngay, theo thứ tự:
  1. Terminal MỚI:  ssh $DEPLOY_USER@<IP>      (phải vào được)
  2. Thử root:      ssh root@<IP>              (phải bị từ chối)
  3. Chỉ khi (1) OK mới đóng session root/console hiện tại.

Nếu (1) fail: vào console provider, sửa/xoá /etc/ssh/sshd_config.d/00-hardening.conf,
rồi systemctl reload ssh. Đừng hoảng — ufw đã mở 22 và session cũ vẫn còn.
EOF
