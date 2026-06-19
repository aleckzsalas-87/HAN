# Guía de Despliegue - ConstruCRM en Ubuntu Server

Esta guía explica cómo desplegar la aplicación CRM en tu propio servidor Ubuntu (20.04 / 22.04 / 24.04).

---

## 1. Requisitos del Servidor

- Ubuntu 20.04+ con acceso `sudo`
- 2 GB RAM mínimo (4 GB recomendado)
- 20 GB de disco
- Dominio apuntando a la IP del servidor (opcional, para HTTPS)
- Puertos abiertos: 80, 443 (y 22 para SSH)

```bash
sudo apt update && sudo apt upgrade -y
```

---

## 2. Instalar Docker y Docker Compose (recomendado)

```bash
# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose
sudo apt install -y docker-compose-plugin
```

Sal y vuelve a entrar para que aplique el grupo `docker`.

---

## 3. Clonar el código

```bash
sudo mkdir -p /opt/construcrm && sudo chown $USER:$USER /opt/construcrm
cd /opt/construcrm
# Copia el contenido del proyecto aquí (backend/, frontend/, etc.)
```

---

## 4. Variables de entorno

### Backend (`/opt/construcrm/backend/.env`)
```
MONGO_URL="mongodb://mongo:27017"
DB_NAME="construccion_crm"
CORS_ORIGINS="https://tu-dominio.com"
JWT_SECRET="<genera-con-openssl-rand-hex-32>"
ADMIN_EMAIL="admin@tuempresa.com"
ADMIN_PASSWORD="<contraseña-segura>"
FRONTEND_URL="https://tu-dominio.com"
```

Genera JWT_SECRET:
```bash
openssl rand -hex 32
```

### Frontend (`/opt/construcrm/frontend/.env`)
```
REACT_APP_BACKEND_URL=https://tu-dominio.com
```

---

## 5. Docker Compose

Crea `/opt/construcrm/docker-compose.yml`:

```yaml
version: "3.9"

services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    networks: [crm]

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    expose: ["8001"]
    depends_on: [mongo]
    networks: [crm]

  frontend:
    build: ./frontend
    restart: unless-stopped
    expose: ["80"]
    networks: [crm]

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on: [backend, frontend]
    networks: [crm]

volumes:
  mongo_data:

networks:
  crm:
```

### Dockerfile backend (`/opt/construcrm/backend/Dockerfile`)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

### Dockerfile frontend (`/opt/construcrm/frontend/Dockerfile`)
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx-app.conf /etc/nginx/conf.d/default.conf
```

### `/opt/construcrm/frontend/nginx-app.conf`
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;
  location / { try_files $uri /index.html; }
}
```

---

## 6. Nginx (Reverse Proxy)

Crea `/opt/construcrm/nginx.conf`:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;

    # API → backend
    location /api/ {
        proxy_pass http://backend:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Frontend (SPA)
    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
    }
}
```

---

## 7. HTTPS con Let's Encrypt

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d tu-dominio.com
```

Renovación automática:
```bash
sudo crontab -e
# añade:
0 3 * * * certbot renew --quiet && docker compose -f /opt/construcrm/docker-compose.yml restart nginx
```

---

## 8. Levantar el sistema

```bash
cd /opt/construcrm
docker compose up -d --build
docker compose logs -f backend
```

Verifica:
```bash
curl https://tu-dominio.com/api/auth/me
```

Accede a `https://tu-dominio.com/login` con:
- email: `admin@tuempresa.com`
- password: el que definiste en `ADMIN_PASSWORD`

**IMPORTANTE**: cambia la contraseña del admin después del primer login (desde Gestión de Usuarios).

---

## 9. Backups de MongoDB

```bash
# Backup
docker exec construcrm_mongo_1 mongodump --db construccion_crm --archive=/data/db/backup-$(date +%F).gz --gzip

# Restore
docker exec -i construcrm_mongo_1 mongorestore --archive --gzip < backup.gz
```

Cron diario:
```bash
0 2 * * * docker exec construcrm-mongo-1 mongodump --db construccion_crm --archive=/backups/$(date +\%F).gz --gzip
```

---

## 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 11. Actualizaciones

```bash
cd /opt/construcrm
git pull   # o copia el nuevo código
docker compose up -d --build
```

---

## Recomendaciones de Servidor Ubuntu

Para una empresa constructora pequeña/mediana:
- **DigitalOcean / Vultr / Linode**: droplet de 2 vCPU / 4 GB RAM / 80 GB SSD (~$20-24/mes)
- **Hetzner Cloud**: CX22 (2 vCPU, 4 GB RAM, 40 GB) ~€5/mes — excelente relación calidad/precio
- **AWS Lightsail**: instancia de $20/mes
- **Servidor propio (on-premise)**: Ubuntu 22.04 LTS Server, 8 GB RAM, SSD 256 GB

Sistema operativo recomendado: **Ubuntu Server 22.04 LTS** (soporte hasta abril 2027).
