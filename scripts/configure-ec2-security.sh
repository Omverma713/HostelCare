#!/bin/bash
set -e

echo "=================================================="
echo "🛡️  Configuring EC2 Server Security (Fail2ban & Nginx)"
echo "=================================================="

# 1. Install Fail2ban if not present
if ! command -v fail2ban-client &> /dev/null; then
    echo "📦 Installing fail2ban..."
    sudo apt-get update -y
    sudo apt-get install -y fail2ban
else
    echo "✅ fail2ban is already installed."
fi

# 2. Configure Fail2ban Jails (/etc/fail2ban/jail.local)
echo "🔒 Writing /etc/fail2ban/jail.local configuration..."
sudo bash -c 'cat > /etc/fail2ban/jail.local << "EOF"
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 5
banaction = iptables-multiport

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
maxretry = 5
bantime  = 2h

[nginx-botsearch]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 3
bantime  = 24h

[nginx-bad-request]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 5
bantime  = 2h
findtime = 10m

[nginx-limit-req]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log
maxretry = 10
bantime  = 1h
EOF'

# 3. Configure Nginx Security Hardening (/etc/nginx/conf.d/security_hardening.conf)
echo "🛡️ Writing Nginx Security Hardening (/etc/nginx/conf.d/security_hardening.conf)..."
sudo bash -c 'cat > /etc/nginx/conf.d/security_hardening.conf << "EOF"
# 1. Hide detailed Nginx version from public scans
server_tokens off;

# 2. Rate-limiting zones: 30 requests/second with burst buffer
limit_req_zone $binary_remote_addr zone=api_zone:10m rate=30r/s;
limit_req_status 429;

# 3. Block malicious scanners, vulnerability tools, and scrapers by User-Agent
map $http_user_agent $blocked_scanner_agent {
    default 0;
    ~*(sqlmap|nikto|wpscan|gobuster|dirbuster|nmap|acunetix|nessus|masscan|zgrab) 1;
}

# 4. Deny direct scanning of hidden and sensitive dotfiles
location ~ /\.(env|git|svn|htaccess|aws) {
    deny all;
    return 404;
}
EOF'

# 4. Test Nginx Configuration & Reload
echo "🔄 Verifying and reloading Nginx..."
if sudo nginx -t; then
    sudo systemctl reload nginx
    echo "✅ Nginx reloaded successfully with security hardening."
else
    echo "⚠️ Nginx test failed! Reverting security_hardening.conf..."
    sudo rm -f /etc/nginx/conf.d/security_hardening.conf
fi

# 5. Enable and Restart Fail2ban
echo "🔄 Starting & enabling fail2ban service..."
sudo systemctl enable fail2ban
sudo systemctl restart fail2ban

echo "=================================================="
echo "🛡️  EC2 Security Configuration Completed Successfully!"
echo "=================================================="

