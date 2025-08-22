# Dropshipr Deployment Guide

This guide explains how to set up automated deployment of Dropshipr to your VPS using GitHub Actions.

## Prerequisites

- A VPS with Ubuntu 20.04+ 
- A domain name (optional but recommended)
- GitHub repository with your code
- SSH access to your VPS

## 1. VPS Setup

### Initial Server Setup

1. **Connect to your VPS:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Create a non-root user:**
   ```bash
   adduser deploy
   usermod -aG sudo deploy
   ```

3. **Set up SSH key authentication:**
   ```bash
   su - deploy
   mkdir ~/.ssh
   chmod 700 ~/.ssh
   nano ~/.ssh/authorized_keys
   # Add your public SSH key here
   chmod 600 ~/.ssh/authorized_keys
   ```

4. **Disable root SSH login:**
   ```bash
   sudo nano /etc/ssh/sshd_config
   # Set PermitRootLogin to no
   sudo systemctl restart sshd
   ```

### Install Required Software

Run the deployment script on your VPS:

```bash
# Clone the repository
git clone https://github.com/yourusername/Dropshipr.git /opt/dropshipr
cd /opt/dropshipr

# Make the deployment script executable
chmod +x deploy.sh

# Run the deployment script
./deploy.sh
```

The script will:
- Install Docker and Docker Compose
- Set up the project directory
- Generate SSL certificates
- Create initial configuration

## 2. GitHub Repository Setup

### Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add the following secrets:

1. **VPS_HOST**: Your VPS IP address or domain
2. **VPS_USERNAME**: Your VPS username (e.g., `deploy`)
3. **VPS_SSH_KEY**: Your private SSH key (the entire key content)
4. **VPS_PORT**: SSH port (usually `22`)
5. **DJANGO_SECRET_KEY**: A secure Django secret key
6. **ALLOWED_HOSTS**: Your domain(s) separated by commas
7. **DB_NAME**: Database name (e.g., `dropshipr_db`)
8. **DB_USER**: Database user (e.g., `dropshipr_user`)
9. **DB_PASSWORD**: Secure database password

### Generate Django Secret Key

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### Generate SSH Key Pair

```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
# Save as ~/.ssh/id_rsa_github
# Copy the public key to your VPS authorized_keys
# Use the private key content as VPS_SSH_KEY secret
```

## 3. Domain and SSL Setup

### Configure Domain

1. **Point your domain to your VPS IP**
2. **Update .env file on VPS:**
   ```bash
   nano /opt/dropshipr/.env
   # Update ALLOWED_HOSTS with your domain
   ```

### SSL Certificate (Let's Encrypt)

Replace the self-signed certificate with Let's Encrypt:

```bash
# Install Certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/dropshipr/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/dropshipr/ssl/key.pem
sudo chown deploy:deploy /opt/dropshipr/ssl/*.pem

# Set up auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/dropshipr/ssl/cert.pem && cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/dropshipr/ssl/key.pem && docker-compose -f /opt/dropshipr/docker-compose.prod.yml restart nginx
```

## 4. Firewall Configuration

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 5. Automated Deployment

### How It Works

1. **Push to main branch** triggers GitHub Actions
2. **GitHub Actions** builds the Docker image
3. **SSH to VPS** and pulls latest code
4. **Rebuilds and restarts** containers
5. **Runs migrations** and collects static files

### Manual Deployment

If you need to deploy manually:

```bash
cd /opt/dropshipr
git pull origin main
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml exec webapp python manage.py migrate
docker-compose -f docker-compose.prod.yml exec webapp python manage.py collectstatic --noinput
```

## 6. Monitoring and Maintenance

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f webapp
```

### Backup Database

```bash
# Create backup
docker-compose -f docker-compose.prod.yml exec db pg_dump -U dropshipr_user dropshipr_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker-compose -f docker-compose.prod.yml exec -T db psql -U dropshipr_user dropshipr_db < backup_file.sql
```

### Update Application

```bash
# Pull latest changes
cd /opt/dropshipr
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

## 7. Troubleshooting

### Common Issues

1. **Port already in use:**
   ```bash
   sudo netstat -tulpn | grep :80
   sudo systemctl stop apache2  # if Apache is running
   ```

2. **Permission denied:**
   ```bash
   sudo chown -R deploy:deploy /opt/dropshipr
   ```

3. **Database connection failed:**
   ```bash
   docker-compose -f docker-compose.prod.yml logs db
   ```

4. **SSL certificate issues:**
   ```bash
   sudo certbot renew --dry-run
   ```

### Health Checks

```bash
# Check if services are running
docker-compose -f docker-compose.prod.yml ps

# Test application
curl -k https://your-domain.com/health/

# Check database
docker-compose -f docker-compose.prod.yml exec db pg_isready -U dropshipr_user
```

## 8. Security Considerations

1. **Change default admin password**
2. **Use strong database passwords**
3. **Keep system updated**
4. **Monitor logs regularly**
5. **Set up fail2ban for SSH protection**
6. **Regular backups**
7. **Use environment variables for secrets**

## 9. Performance Optimization

1. **Enable gzip compression** (already configured in nginx.conf)
2. **Use CDN for static files**
3. **Database optimization**
4. **Caching strategies**
5. **Load balancing for high traffic**

## Support

For issues or questions:
1. Check the logs: `docker-compose -f docker-compose.prod.yml logs`
2. Verify configuration files
3. Test connectivity and permissions
4. Review GitHub Actions logs for deployment issues 