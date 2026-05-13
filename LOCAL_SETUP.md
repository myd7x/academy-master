# Local Database Setup Guide

## Option 1: PostgreSQL (Recommended)

### 1. Install PostgreSQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS with Homebrew
brew install postgresql
brew services start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

### 2. Create Database and User
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE academy_crm;
CREATE USER academy_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE academy_crm TO academy_user;
\q
```

### 3. Configure Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://academy_user:your_password@localhost:5432/academy_crm
NODE_ENV=development
PORT=5000
```

## Option 2: MySQL

### 1. Install MySQL
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install mysql-server

# macOS with Homebrew
brew install mysql
brew services start mysql

# Windows
# Download from https://dev.mysql.com/downloads/mysql/
```

### 2. Create Database and User
```bash
# Connect to MySQL
mysql -u root -p

# Create database and user
CREATE DATABASE academy_crm;
CREATE USER 'academy_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON academy_crm.* TO 'academy_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Update Database Configuration
You'll need to modify the database configuration for MySQL:

#### Update `server/db.ts`:
```typescript
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from "@shared/schema";

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'academy_user',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'academy_crm',
});

export const db = drizzle(pool, { schema, mode: 'default' });
```

### 4. Configure Environment Variables for MySQL
```env
DATABASE_URL=mysql://academy_user:your_password@localhost:3306/academy_crm
# Or use individual variables:
DB_HOST=localhost
DB_PORT=3306
DB_USER=academy_user
DB_PASSWORD=your_password
DB_NAME=academy_crm
NODE_ENV=development
PORT=5000
```

## Running the Application Locally

### 1. Install Dependencies
```bash
npm install
```

**Important:** If you get "'drizzle-kit' is not recognized" error, you need to install drizzle-kit globally or use npx:

```bash
# Option 1: Install globally
npm install -g drizzle-kit

# Option 2: Use npx (recommended)
npx drizzle-kit push
```

### 2. Push Database Schema
```bash
# If drizzle-kit is installed globally:
npm run db:push

# If using npx:
npx drizzle-kit push
```

### 3. Start the Application
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## Troubleshooting

### Common Issues:

1. **'drizzle-kit' is not recognized**: Use `npx drizzle-kit push` instead of `npm run db:push`
2. **Connection refused**: Ensure your database server is running
3. **Authentication failed**: Check username/password in your .env file
4. **Database doesn't exist**: Create the database manually first
5. **Port conflicts**: Change the PORT in your .env file

### Check Database Connection:
```bash
# PostgreSQL
psql -h localhost -U academy_user -d academy_crm

# MySQL
mysql -h localhost -u academy_user -p academy_crm
```

## Database Schema
The application will automatically create all necessary tables when you run `npx drizzle-kit push` or `npm run db:push`:
- players (main player information)
- player_documents (file uploads)
- payments (payment records)
- payment_history (archived payments)
- sessions (attendance tracking)