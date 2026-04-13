import { sql } from './db.ts';
import bcrypt from 'bcryptjs';

export interface User {
  id: string;
  email: string;
  name: string | null;
  created_at: Date;
}

const SALT_ROUNDS = 10;

export async function initDatabase(): Promise<void> {
  try {
    await sql`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    console.log('[initDB] users table created/verified');
  } catch (e: any) { 
    console.log('[initDB] users ready:', e?.message?.substring(0,50)); 
  }
  
  try {
    await sql`CREATE TABLE IF NOT EXISTS chambers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      user_id UUID REFERENCES users(id),
      temp_min NUMERIC(5,2) DEFAULT -25,
      temp_max NUMERIC(5,2) DEFAULT -15,
      alert_enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    console.log('[initDB] chambers table created/verified');
  } catch (e: any) { 
    console.log('[initDB] chambers ready:', e?.message?.substring(0,50)); 
  }
  
  try {
    await sql`CREATE TABLE IF NOT EXISTS readings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      unique_reading_id TEXT UNIQUE NOT NULL,
      device_id TEXT REFERENCES chambers(id),
      name TEXT,
      device_ip TEXT,
      temp NUMERIC(5,2),
      spiffs_usage NUMERIC(5,2),
      wifi_rssi INTEGER,
      free_heap INTEGER,
      uptime BIGINT,
      date TEXT,
      time TEXT,
      connection TEXT,
      reading_timestamp TIMESTAMPTZ DEFAULT NOW()
    )`;
    console.log('[initDB] readings table created/verified');
  } catch (e: any) { 
    console.log('[initDB] readings ready:', e?.message?.substring(0,50)); 
  }
  
  try { 
    await sql`CREATE INDEX IF NOT EXISTS idx_readings_device ON readings(device_id)`; 
  } catch (e) {}
  try { 
    await sql`CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(reading_timestamp)`; 
  } catch (e) {}
  try { 
    await sql`CREATE INDEX IF NOT EXISTS idx_readings_unique_id ON readings(unique_reading_id)`; 
  } catch (e) {}
}

export async function registerUser(email: string, password: string, name?: string): Promise<User | null> {
  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    const result = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name || null})
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, name, created_at
    `;
    
    if (result.length === 0) {
      return null;
    }
    
    return result[0] as User;
  } catch (error) {
    console.error('[AuthService] Error registering user:', error);
    return null;
  }
}

export async function loginUser(email: string, password: string): Promise<User | null> {
  try {
    const result = await sql`
      SELECT id, email, name, password_hash, created_at
      FROM users
      WHERE email = ${email}
    `;
    
    if (result.length === 0) {
      return null;
    }
    
    const user = result[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return null;
    }
    
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  } catch (error) {
    console.error('[AuthService] Error logging in user:', error);
    return null;
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await sql`
      SELECT id, email, name, created_at
      FROM users
      WHERE id = ${userId}
    `;
    
    return result.length > 0 ? result[0] as User : null;
  } catch (error) {
    console.error('[AuthService] Error getting user:', error);
    return null;
  }
}

export async function getUserChambers(userId: string): Promise<any[]> {
  try {
    return await sql`
      SELECT id, name, temp_min, temp_max, alert_enabled
      FROM chambers
      WHERE user_id = ${userId}
    `;
  } catch (error) {
    console.error('[AuthService] Error getting chambers:', error);
    return [];
  }
}

export async function createOrUpdateChamber(
  deviceId: string,
  name: string,
  userId: string,
  tempMin?: number,
  tempMax?: number
): Promise<boolean> {
  const safeUserId = (userId && userId !== 'anonymous') ? userId : null;
  try {
    await sql`
      INSERT INTO chambers (id, name, user_id, temp_min, temp_max)
      VALUES (${deviceId}, ${name}, ${safeUserId}, ${tempMin ?? -25}, ${tempMax ?? -15})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        temp_min = COALESCE(EXCLUDED.temp_min, chambers.temp_min),
        temp_max = COALESCE(EXCLUDED.temp_max, chambers.temp_max)
    `;
    return true;
  } catch (error) {
    console.error('[AuthService] Error creating/updating chamber:', error);
    return false;
  }
}

export async function seedAdminUser(): Promise<void> {
  const adminEmail = 'admin@gettemp.io';
  const adminPassword = 'gettemp123';
  
  const existingAdmin = await sql`
    SELECT id FROM users WHERE email = ${adminEmail}
  `;
  
  if (existingAdmin.length === 0) {
    const passwordHash = await bcrypt.hash(adminPassword, SALT_ROUNDS);
    await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${adminEmail}, ${passwordHash}, 'Administrator')
    `;
    console.log('[AuthService] Admin user created: admin@gettemp.io');
  }
}