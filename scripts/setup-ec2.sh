#!/usr/bin/env bash
set -e

echo "=========================================================="
echo " Starting HostelCare Backend Setup on AWS EC2 Ubuntu"
echo "=========================================================="

# 1. Update package list
echo ">>> Updating system packages..."
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release git ufw

# 2. Add Swap Space (Crucial for t2.micro with 1GB RAM to prevent Docker OOM)
if [ ! -f /swapfile ]; then
    echo ">>> Creating 2GB Swap space to prevent Out-Of-Memory during builds..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo ">>> Swap created successfully."
else
    echo ">>> Swap already exists."
fi

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    echo ">>> Installing Docker..."
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add current user to docker group
    sudo usermod -aG docker "$USER"
    echo ">>> Docker installed successfully."
else
    echo ">>> Docker is already installed."
fi

# 4. Clone or pull repository
APP_DIR="/home/$USER/hostelcare"
if [ ! -d "$APP_DIR" ]; then
    echo ">>> Cloning HostelCare repository to $APP_DIR..."
    git clone https://github.com/Omverma713/HostelCare.git "$APP_DIR"
else
    echo ">>> Repository exists at $APP_DIR. Fetching latest changes..."
    cd "$APP_DIR"
    git fetch origin
    git checkout main
    git pull origin main
fi

cd "$APP_DIR"

# 5. Check for .env file
if [ ! -f "$APP_DIR/.env" ]; then
    echo ">>> Creating placeholder .env file. Please edit it with your production secrets:"
    cat << 'EOF' > "$APP_DIR/.env"
PORT=3000
MONGODB_URI=your_mongodb_uri_here
JWT_SECRET=your_jwt_secret_here
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=omverma.dev@gmail.com
ADMIN_EMAIL=omverma.dev@gmail.com
EOF
    echo ">>> Placeholder .env created at $APP_DIR/.env"
fi

echo "=========================================================="
echo " Setup complete!"
echo " Next steps:"
echo " 1. Log out and log back in (or run 'newgrp docker') so group changes apply."
echo " 2. cd /home/$USER/hostelcare"
echo " 3. Verify / edit .env if needed: nano .env"
echo " 4. Start the app: docker compose up -d --build"
echo " 5. Test health check: curl http://localhost:3000/health"
echo "=========================================================="
