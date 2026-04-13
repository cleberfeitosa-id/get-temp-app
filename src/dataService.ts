/**
 * DATA SERVICE — Get Temp ColdChain App
 * 
 * MQTT integration for real-time sensor data from ESP32 devices.
 * PostgreSQL database for persistence via Neon.
 */

import mqtt from 'mqtt';
import { sql } from './db.ts';
import { initDatabase, getUserChambers, createOrUpdateChamber } from './authService.ts';

export interface MqttReading {
  name: string;
  uid: string;
  did: string;
  dip: string;
  temp: number;
  spiffs: number;
  rssi: number;
  heap: number;
  up: number;
  date: string;
  time: string;
  conn: 'connected' | 'offline' | 'overheating' | 'spiffs_warning';
}

export interface SensorReading {
  name: string;
  unique_reading_id: string;
  device_id: string;
  device_ip: string;
  temp: number;
  spiffs_usage: number;
  wifi_rssi: number;
  free_heap: number;
  uptime: number;
  date: string;
  time: string;
  connection: 'Connected' | 'Disconnected' | 'Overheating' | 'SPIFFS_Warning';
  isOutlier?: boolean;
  outlierReason?: string;
  invalidJump?: boolean;
  jumpDelta?: number;
}

const MQTT_CONFIG = {
  brokerUrl: 'wss://r0112411.ala.us-east-1.emqxsl.com:8084/mqtt',
  topic: 'gettemp',
  username: 'gettemp',
  password: 'gettemp123',
};

function convertToSensorReading(mqtt: MqttReading): SensorReading {
  let connection: SensorReading['connection'] = 'Disconnected';
  if (mqtt.conn === 'connected') connection = 'Connected';
  else if (mqtt.conn === 'overheating') connection = 'Overheating';
  else if (mqtt.conn === 'spiffs_warning') connection = 'SPIFFS_Warning';
  
  return {
    name: mqtt.name,
    unique_reading_id: mqtt.uid,
    device_id: mqtt.did,
    device_ip: mqtt.dip,
    temp: mqtt.temp,
    spiffs_usage: mqtt.spiffs,
    wifi_rssi: mqtt.rssi,
    free_heap: mqtt.heap,
    uptime: mqtt.up,
    date: mqtt.date,
    time: mqtt.time,
    connection,
  };
}

let _mqttClient: mqtt.MqttClient | null = null;
let _readings: SensorReading[] = [];
let _listeners: ((readings: SensorReading[]) => void)[] = [];
let _mqttInitialized = false;
let _dbInitialized = false;
const LAST_COMM_KEY = 'gettemp_last_communication';
const OFFLINE_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_STORED_READINGS = 1000;
const STORAGE_KEY = 'gettemp_readings';

function getUserId(): string {
  return localStorage.getItem('gettemp_user_id') || 'anonymous';
}

export async function initDB(): Promise<void> {
  if (_dbInitialized) return;
  _dbInitialized = true;
  
  try {
    await initDatabase();
    console.log('[DataService] Database initialized');
  } catch (error) {
    console.error('[DataService] Failed to initialize database:', error);
  }
}

async function saveReadingToDB(reading: SensorReading): Promise<void> {
  try {
    const timestamp = new Date(`${reading.date}T${reading.time}`).toISOString();
    await sql`
      INSERT INTO readings (
        unique_reading_id, device_id, name, device_ip, temp,
        spiffs_usage, wifi_rssi, free_heap, uptime, date, time,
        connection, reading_timestamp
      ) VALUES (
        ${reading.unique_reading_id}, ${reading.device_id}, ${reading.name},
        ${reading.device_ip}, ${reading.temp}, ${reading.spiffs_usage},
        ${reading.wifi_rssi}, ${reading.free_heap}, ${reading.uptime},
        ${reading.date}, ${reading.time}, ${reading.connection}, ${timestamp}
      )
      ON CONFLICT (unique_reading_id) DO UPDATE SET
        temp = EXCLUDED.temp,
        spiffs_usage = EXCLUDED.spiffs_usage,
        wifi_rssi = EXCLUDED.wifi_rssi,
        free_heap = EXCLUDED.free_heap,
        connection = EXCLUDED.connection,
        reading_timestamp = EXCLUDED.reading_timestamp
    `;
    return;
  } catch (error: any) {
    console.warn('[DataService] DB save failed, using localStorage:', error?.message?.substring(0,50));
  }
  
  saveToStorageLocal(reading);
}

function saveToStorageLocal(reading: SensorReading): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    let readings: SensorReading[] = [];
    if (stored) {
      const parsed = JSON.parse(stored);
      readings = parsed.readings || [];
    }
    
    const existingIndex = readings.findIndex(r => r.unique_reading_id === reading.unique_reading_id);
    if (existingIndex >= 0) {
      readings[existingIndex] = reading;
    } else {
      readings.push(reading);
    }
    
    if (readings.length > MAX_STORED_READINGS) {
      readings = readings.slice(-MAX_STORED_READINGS);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ readings, timestamp: Date.now() }));
  } catch (e) {
    console.warn('[DataService] Could not save to localStorage:', e);
  }
}

async function loadFromDB(): Promise<SensorReading[]> {
  try {
    const userId = getUserId();
    const isValidUUID = userId && userId !== 'anonymous' && /^[0-9a-f-]{36}$/i.test(userId);
    
    console.log('[loadFromDB] userId:', userId, 'isValidUUID:', isValidUUID);
    
    let result;
    if (isValidUUID) {
      result = await sql`
        SELECT 
          r.unique_reading_id, r.device_id, r.name, r.device_ip,
          r.temp, r.spiffs_usage, r.wifi_rssi, r.free_heap, r.uptime,
          r.date, r.time, r.connection,
          r.reading_timestamp
        FROM readings r
        WHERE r.temp IS NOT NULL 
        AND r.temp::text != ''
        AND r.temp::numeric > -55 
        AND r.temp::numeric < 125
        AND r.temp::numeric != 85
        ORDER BY r.reading_timestamp DESC
        LIMIT 1000
      `;
    } else {
      result = await sql`
        SELECT 
          r.unique_reading_id, r.device_id, r.name, r.device_ip,
          r.temp, r.spiffs_usage, r.wifi_rssi, r.free_heap, r.uptime,
          r.date, r.time, r.connection,
          r.reading_timestamp
        FROM readings r
        WHERE r.temp IS NOT NULL 
        AND r.temp::text != ''
        AND r.temp::numeric > -55 
        AND r.temp::numeric < 125
        AND r.temp::numeric != 85
        ORDER BY r.reading_timestamp DESC
        LIMIT 1000
      `;
    }
    
    if (result && result.length > 0) {
      console.log('[DataService] Loaded', result.length, 'valid readings from database');
      return result.map((row: any) => ({
        name: row.name,
        unique_reading_id: row.unique_reading_id,
        device_id: row.device_id,
        device_ip: row.device_ip,
        temp: parseFloat(row.temp),
        spiffs_usage: parseFloat(row.spiffs_usage),
        wifi_rssi: row.wifi_rssi,
        free_heap: row.free_heap,
        uptime: row.uptime,
        date: row.date,
        time: row.time,
        connection: row.connection as SensorReading['connection'],
      }));
    }
  } catch (error: any) {
    console.warn('[DataService] Could not load from database:', error?.message || error);
  }
  
  console.log('[DataService] Falling back to localStorage');
  return loadFromStorageLocal();
}

function loadFromStorageLocal(): SensorReading[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.readings) {
        console.log('[DataService] Loaded', parsed.readings.length, 'readings from localStorage');
        const seen = new Set<string>();
        return parsed.readings.filter((r: SensorReading) => {
          if (r.temp === 85 || r.temp < -55 || r.temp > 125) return false;
          if (seen.has(r.unique_reading_id)) return false;
          seen.add(r.unique_reading_id);
          return true;
        });
      }
    }
  } catch (e) {
    console.warn('[DataService] Could not load from localStorage:', e);
  }
  console.log('[DataService] No stored data, returning empty array');
  return [];
}

export function updateLastCommunication(): void {
  localStorage.setItem(LAST_COMM_KEY, Date.now().toString());
}

export function getTimeSinceLastComm(): number {
  const lastComm = localStorage.getItem(LAST_COMM_KEY);
  if (!lastComm) return Infinity;
  return Date.now() - parseInt(lastComm);
}

export function isSystemOffline(): boolean {
  return getTimeSinceLastComm() > OFFLINE_TIMEOUT_MS;
}

export function getInternalReadings(): SensorReading[] {
  return _readings;
}

export async function clearAllReadings(): Promise<void> {
  _readings = [];
  try {
    await sql`DELETE FROM readings`;
    console.log('[DataService] All readings cleared from database');
  } catch (error) {
    console.warn('[DataService] Could not clear readings:', error);
  }
  notifyListeners();
}

export async function deleteReadingById(uniqueReadingId: string): Promise<boolean> {
  console.log('[DataService] Attempting to delete reading:', uniqueReadingId);
  console.log('[DataService] Current readings before delete:', _readings.length);
  
  const index = _readings.findIndex(r => r.unique_reading_id === uniqueReadingId);
  console.log('[DataService] Found at index:', index);
  
  if (index >= 0) {
    const removed = _readings.splice(index, 1);
    console.log('[DataService] Removed:', removed[0]);
    
    try {
      await sql`DELETE FROM readings WHERE unique_reading_id = ${uniqueReadingId}`;
    } catch (error) {
      console.warn('[DataService] Could not delete from DB:', error);
    }
    
    notifyListeners();
    console.log('[DataService] Readings after delete:', _readings.length);
    return true;
  }
  console.log('[DataService] Reading not found');
  return false;
}

function initMQTT() {
  if (_mqttInitialized) return;
  _mqttInitialized = true;
  
  console.log('[DataService] Initializing MQTT...');
  console.log('[DataService] Broker:', MQTT_CONFIG.brokerUrl);
  console.log('[DataService] Topic:', MQTT_CONFIG.topic);
  console.log('[DataService] Username:', MQTT_CONFIG.username);
  
  try {
    _mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, {
      username: MQTT_CONFIG.username,
      password: MQTT_CONFIG.password,
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      rejectUnauthorized: false, // For development - use proper certs in production
    });
  } catch (err) {
    console.error('[DataService] MQTT connection error:', err);
  }
  
  if (_mqttClient) {
  _mqttClient.on('connect', () => {
    console.log('[DataService] ✓ MQTT Connected to broker!');
    console.log('[DataService] Subscribing to:', MQTT_CONFIG.topic);
    _mqttClient?.subscribe(MQTT_CONFIG.topic);
    console.log('[DataService] Subscribed to topic');
  });
  
  _mqttClient.on('message', async (topic, payload) => {
    try {
      const mqttReading: MqttReading = JSON.parse(payload.toString());
      console.log('[DataService] Received MQTT message:', topic, mqttReading);
      
      if (mqttReading.temp === 85 || mqttReading.temp < -55 || mqttReading.temp > 125) {
        console.warn('[DataService] Invalid temperature reading filtered:', mqttReading.temp);
        return;
      }
      
      const reading = convertToSensorReading(mqttReading);
      console.log('[DataService] Converted reading:', reading);
      
      updateLastCommunication();
      
      const existingIndex = _readings.findIndex(r => r.unique_reading_id === reading.unique_reading_id);
      if (existingIndex >= 0) {
        console.log('[DataService] Reading already exists, updating...');
        _readings[existingIndex] = reading;
      } else {
        console.log('[DataService] Adding new reading:', reading.unique_reading_id);
        _readings.push(reading);
        
        await createOrUpdateChamber(
          reading.device_id,
          reading.name,
          getUserId()
        );
      }
      
      if (_readings.length > MAX_STORED_READINGS) {
        _readings = _readings.slice(-MAX_STORED_READINGS);
      }
      
      await saveReadingToDB(reading);
      
      notifyListeners();
    } catch (err) {
      console.error('[DataService] Error processing MQTT message:', err);
    }
  });
  
  _mqttClient.on('error', (err) => {
    console.error('[DataService] MQTT error:', err.message);
  });
  
  _mqttClient.on('offline', () => {
    console.log('[DataService] MQTT offline');
  });
  
  _mqttClient.on('reconnect', () => {
    console.log('[DataService] MQTT reconnecting...');
  });
  }
}

function notifyListeners() {
  _listeners.forEach(fn => fn([..._readings]));
}

export function onReadingsUpdate(callback: (readings: SensorReading[]) => void): () => void {
  _listeners.push(callback);
  
  if (_readings.length === 0) {
    loadFromDB().then(dbReadings => {
      if (dbReadings.length > 0) {
        _readings = dbReadings;
        console.log('[onReadingsUpdate] Loaded', _readings.length, 'readings from DB');
        callback([..._readings]);
      } else {
        console.log('[onReadingsUpdate] No readings available yet');
      }
    });
  }
  
  if (_readings.length > 0) {
    console.log('[onReadingsUpdate] Sending', _readings.length, 'readings to callback');
    callback([..._readings]);
  }
  
  return () => {
    _listeners = _listeners.filter(fn => fn !== callback);
  };
}

export async function getReadings(forceRefresh = false): Promise<SensorReading[]> {
  // Always load from database on page load to ensure fresh data
  _readings = await loadFromDB();
  console.log('[DataService] Loaded from DB, count:', _readings.length);
  
  // Initialize MQTT if not connected
  if (!_mqttClient) {
    console.log('[DataService] Initializing MQTT from getReadings...');
    initMQTT();
  }
  
  console.log('[DataService] Returning readings:', _readings.length);
  
  return _readings;
}

export function filterByChamber(data: SensorReading[], deviceId: string): SensorReading[] {
  if (deviceId === 'ALL') return data;
  return data.filter(d => d.device_id === deviceId);
}

export function filterByDays(data: SensorReading[], days: number): SensorReading[] {
  if (data.length === 0) return data;
  
  const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
  const latestTime = Math.max(...timestamps);
  const cutoff = latestTime - days * 24 * 60 * 60 * 1000;
  
  return data.filter(d => {
    const ts = new Date(`${d.date}T${d.time}`).getTime();
    return ts >= cutoff;
  });
}

export function getDateBounds(data: SensorReading[]): { min: Date; max: Date } | null {
  if (data.length === 0) return null;
  
  const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
  return { 
    min: new Date(Math.min(...timestamps)), 
    max: new Date(Math.max(...timestamps)) 
  };
}

export function getUniqueDevices(data: SensorReading[]): string[] {
  return [...new Set(data.map(d => d.device_id))];
}

export function calcStats(data: SensorReading[]): { max: number; min: number; avg: number } {
  const temps = data.map(d => d.temp).filter(t => !isNaN(t));
  if (temps.length === 0) {
    return { max: 0, min: 0, avg: 0 };
  }
  return {
    max: Math.max(...temps),
    min: Math.min(...temps),
    avg: temps.reduce((a, b) => a + b, 0) / temps.length
  };
}

export function getDeviceLimitsSync(deviceId: string): { min: number; max: number } {
  const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
  const camera = storedCameras[deviceId];
  
  if (camera) {
    return {
      min: parseFloat(camera.temp_min) || -25,
      max: parseFloat(camera.temp_max) || -15
    };
  }
  
  return { min: -25, max: -15 };
}

export async function getDeviceLimits(deviceId: string): Promise<{ min: number; max: number }> {
  try {
    const userId = getUserId();
    const result = await sql`
      SELECT temp_min, temp_max
      FROM chambers
      WHERE id = ${deviceId} AND (user_id = ${userId} OR user_id IS NULL)
    `;
    
    if (result.length > 0) {
      return {
        min: parseFloat(result[0].temp_min) || -25,
        max: parseFloat(result[0].temp_max) || -15
      };
    }
  } catch (error) {
    console.warn('[DataService] Could not get device limits from DB:', error);
  }
  
  return getDeviceLimitsSync(deviceId);
}

export async function saveDeviceLimits(deviceId: string, min: number, max: number): Promise<void> {
  try {
    const userId = getUserId();
    await sql`
      INSERT INTO chambers (id, name, user_id, temp_min, temp_max)
      VALUES (${deviceId}, ${deviceId}, ${userId}, ${min}, ${max})
      ON CONFLICT (id) DO UPDATE SET
        temp_min = EXCLUDED.temp_min,
        temp_max = EXCLUDED.temp_max
    `;
  } catch (error) {
    console.warn('[DataService] Could not save device limits:', error);
  }
}

export async function isWithinLimits(temp: number, deviceId: string): Promise<boolean> {
  const limits = await getDeviceLimits(deviceId);
  return temp >= limits.min && temp <= limits.max;
}

export function getLatestByDevice(data: SensorReading[]): Map<string, SensorReading> {
  const latest = new Map<string, SensorReading>();
  
  for (const reading of data) {
    const existing = latest.get(reading.device_id);
    if (!existing) {
      latest.set(reading.device_id, reading);
    } else {
      const existingTs = new Date(`${existing.date}T${existing.time}`).getTime();
      const readingTs = new Date(`${reading.date}T${reading.time}`).getTime();
      if (readingTs > existingTs) {
        latest.set(reading.device_id, reading);
      }
    }
  }
  
  return latest;
}

export async function saveLastReading(reading: SensorReading): Promise<void> {
  localStorage.setItem('gettemp_last_reading', JSON.stringify(reading));
}

export function loadLastReading(): SensorReading | null {
  try {
    const stored = localStorage.getItem('gettemp_last_reading');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('[DataService] Could not load last reading:', e);
  }
  return null;
}