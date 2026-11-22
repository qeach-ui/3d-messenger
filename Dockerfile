FROM php:8.5-cli

# Системные зависимости, расширения PHP и Node.js 20
RUN apt-get update && apt-get install -y \
    git \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo pdo_mysql zip bcmath sockets pcntl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Копируем файлы зависимостей и ставим пакеты прямо при сборке образа
COPY composer.json composer.lock ./
RUN composer install --no-interaction --prefer-dist --no-scripts

COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Запуск Laravel и Vite внутри одного контейнера
CMD ["sh", "-c", "php artisan serve --host=0.0.0.0 --port=8000 & npm run dev -- --host=0.0.0.0 --port=5173 & wait"]