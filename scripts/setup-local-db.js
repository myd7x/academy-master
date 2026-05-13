#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Academy CRM - Local Database Setup\n');

// Check if .env file exists
const envPath = path.join(process.cwd(), '.env');
const envExamplePath = path.join(process.cwd(), '.env.example');

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Creating .env file from .env.example...');
    fs.copyFileSync(envExamplePath, envPath);
    console.log('✅ .env file created successfully!\n');
  } else {
    console.log('⚠️  No .env.example found. Creating basic .env file...');
    const basicEnv = `# Database Configuration
DATABASE_URL=postgresql://academy_user:password@localhost:5432/academy_crm

# Application Configuration
NODE_ENV=development
PORT=5000
`;
    fs.writeFileSync(envPath, basicEnv);
    console.log('✅ Basic .env file created!\n');
  }
}

console.log('📖 Next steps:');
console.log('1. Edit the .env file with your database credentials');
console.log('2. Make sure your database server is running');
console.log('3. Run: npx drizzle-kit push (or npm run db:push if drizzle-kit is installed globally)');
console.log('4. Run: npm run dev\n');

console.log('📚 For detailed setup instructions, check LOCAL_SETUP.md');

// Display current .env content (masked passwords)
try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n📄 Current .env configuration:');
  console.log('─'.repeat(50));
  envContent.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
      // Mask password in DATABASE_URL
      if (line.includes('DATABASE_URL=')) {
        const maskedLine = line.replace(/:([^:@]+)@/, ':***@');
        console.log(maskedLine);
      } else {
        console.log(line);
      }
    } else if (line.trim()) {
      console.log(line);
    }
  });
  console.log('─'.repeat(50));
} catch (err) {
  console.log('⚠️  Could not read .env file');
}