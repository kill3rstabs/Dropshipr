#!/bin/bash

# Dropshipr Deployment Script
# This script sets up the VPS environment and deploys the application

set -e  # Exit on any error

echo "🚀 Starting Dropshipr deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

# Update system packages
print_status "Updating system packages..."
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker if not installed
if ! command -v docker &> /dev/null; then
    print_status "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    print_warning "Docker installed. Please log out and back in for group changes to take effect."
fi

# Install Docker Compose if not installed
if ! command -v docker-compose &> /dev/null; then
    print_status "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Create project directory
PROJECT_DIR="/opt/dropshipr"
print_status "Setting up project directory at $PROJECT_DIR..."
sudo mkdir -p $PROJECT_DIR
sudo chown $USER:$USER $PROJECT_DIR

# Clone repository if not exists
if [ ! -d "$PROJECT_DIR/.git" ]; then
    print_status "Cloning repository..."
    git clone https://github.com/yourusername/Dropshipr.git $PROJECT_DIR
fi

cd $PROJECT_DIR

# Create SSL directory
sudo mkdir -p /opt/dropshipr/ssl
sudo chown $USER:$USER /opt/dropshipr/ssl

# Generate self-signed SSL certificate (for testing)
if [ ! -f "/opt/dropshipr/ssl/cert.pem" ]; then
    print_status "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /opt/dropshipr/ssl/key.pem \
        -out /opt/dropshipr/ssl/cert.pem \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_status "Creating .env file..."
    cat > .env << EOF
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com
DB_NAME=dropshipr_db
DB_USER=dropshipr_user
DB_PASSWORD=$(openssl rand -base64 32)
DB_HOST=db
DB_PORT=5432
EOF
    print_warning "Please update the .env file with your actual configuration!"
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true

# Build and start containers
print_status "Building and starting containers..."
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 30

# Run migrations
print_status "Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T webapp python manage.py migrate --noinput

# Collect static files
print_status "Collecting static files..."
docker-compose -f docker-compose.prod.yml exec -T webapp python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
print_status "Creating superuser..."
docker-compose -f docker-compose.prod.yml exec -T webapp python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin123')
    print('Superuser created: admin/admin123')
else:
    print('Superuser already exists')
"

# Check if services are running
print_status "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# Show logs
print_status "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

print_status "🎉 Deployment completed successfully!"
print_status "Your application should be available at:"
print_status "  - HTTP:  http://your-server-ip"
print_status "  - HTTPS: https://your-server-ip"
print_status "  - Admin: https://your-server-ip/admin (admin/admin123)"

print_warning "Remember to:"
print_warning "  1. Update your domain in .env file"
print_warning "  2. Replace self-signed SSL with Let's Encrypt certificate"
print_warning "  3. Change default admin password"
print_warning "  4. Configure firewall rules" 