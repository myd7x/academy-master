# Academy CRM - Local Setup Guide

This guide will help you set up the Academy CRM application on your local machine with your own database.

## Quick Setup Commands

```bash
# 1. Install dependencies
npm install

# 2. Set up environment configuration
node scripts/setup-local-db.js

# 3. Configure your database connection in .env
# Edit the DATABASE_URL with your credentials

# 4. Push database schema
# If you get 'drizzle-kit' not recognized error, use:
npx drizzle-kit push
# Otherwise use:
npm run db:push

# 5. Start the application
npm run dev
```

## Database Options

### Option 1: PostgreSQL (Recommended)

**DATABASE_URL format:**
```
postgresql://username:password@localhost:5432/academy_crm
```

**Example .env:**
```env
DATABASE_URL=postgresql://academy_user:mypassword@localhost:5432/academy_crm
NODE_ENV=development
PORT=5000
```

### Option 2: MySQL

**DATABASE_URL format:**
```
mysql://username:password@localhost:3306/academy_crm
```

**Example .env:**
```env
DATABASE_URL=mysql://academy_user:mypassword@localhost:3306/academy_crm
NODE_ENV=development
PORT=5000
```

## Database Setup Steps

### PostgreSQL Setup:
1. Install PostgreSQL on your system
2. Create database: `createdb academy_crm`
3. Create user: `createuser academy_user`
4. Grant permissions: `psql -c "GRANT ALL ON DATABASE academy_crm TO academy_user;"`

### MySQL Setup:
1. Install MySQL on your system
2. Create database: `CREATE DATABASE academy_crm;`
3. Create user: `CREATE USER 'academy_user'@'localhost' IDENTIFIED BY 'password';`
4. Grant permissions: `GRANT ALL ON academy_crm.* TO 'academy_user'@'localhost';`

## Features

The application includes:
- Player management system
- Payment tracking and receipts
- Session attendance tracking
- Subscription management
- Dashboard with analytics
- File upload for player documents

## Troubleshooting

**Connection Issues:**
- Ensure your database server is running
- Check credentials in your .env file
- Verify database exists

**Port Conflicts:**
- Change PORT in .env file if 5000 is taken

**Schema Issues:**
- Run `npm run db:push` to create/update tables

For detailed instructions, see LOCAL_SETUP.md