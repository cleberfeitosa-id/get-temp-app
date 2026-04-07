/**
 * DATA SERVICE — Get Temp ColdChain App
 *
 * This module provides a unified abstraction for fetching sensor data.
 * Supports both mock data and real-time MQTT data from ESP32 devices.
 *
 * MQTT INTEGRATION:
 * 1. Configure MQTT broker URL in mqttService.ts or via mqttService.connect()
 * 2. ESP32 should publish to topic: gettemp/<device_id>
 * 3. Message format: {"device_id":"CAM01","name":"Câmara 1","temp":-18.5,...}
 *
 * The data service merges mock data with real-time MQTT data,
 * prioritizing the most recent readings.
 */

import { mqttService, MQTT_CONFIG } from './mqttService.ts';

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
  connection: 'Connected' | 'Disconnected';
}

// --- Data Source Configuration ---
const MOCK_URL = '/mock/esp32_mock.json';

// --- Internal caches ---
let _mockCache: SensorReading[] | null = null;
let _realtimeReadings: Map<string, SensorReading> = new Map();
let _allReadings: SensorReading[] = [];

// --- Event listeners for real-time updates ---
type RealtimeListener = (readings: SensorReading[]) => void;
const _realtimeListeners: Set<RealtimeListener> = new Set();

/**
 * Subscribe to real-time reading updates
 */
export function onRealtimeUpdate(callback: RealtimeListener): () => void {
  _realtimeListeners.add(callback);
  // Immediately call with current data
  callback(getAllReadings());
  // Return unsubscribe function
  return () => _realtimeListeners.delete(callback);
}

/**
 * Notify all listeners of data update
 */
function notifyRealtimeUpdate(): void {
  const readings = getAllReadings();
  _realtimeListeners.forEach(cb => cb(readings));
}

/**
 * Initialize MQTT connection
 */
export function initMQTT(config?: { brokerUrl?: string; topic?: string; username?: string; password?: string }): void {
  if (config?.brokerUrl) {
    MQTT_CONFIG.brokerUrl = config.brokerUrl;
    MQTT_CONFIG.topic = config.topic || MQTT_CONFIG.topic;
    MQTT_CONFIG.username = config.username || MQTT_CONFIG.username;
    MQTT_CONFIG.password = config.password || MQTT_CONFIG.password;
  }

  mqttService.onData((reading: SensorReading) => {
    console.log('[DataService] New MQTT reading:', reading.device_id, reading.temp + '°C');
    
    // Store the real-time reading
    _realtimeReadings.set(reading.device_id, reading);
    
    // Merge with existing readings (replace older readings from same device)
    const existingIndex = _allReadings.findIndex(r => 
      r.unique_reading_id === reading.unique_reading_id || 
      (r.device_id === reading.device_id && r.date === reading.date && r.time === reading.time)
    );
    
    if (existingIndex >= 0) {
      _allReadings[existingIndex] = reading;
    } else {
      _allReadings.push(reading);
    }
    
    // Notify all listeners
    notifyRealtimeUpdate();
  });

  mqttService.onConnectionChange((connected: boolean) => {
    console.log('[DataService] MQTT connection status:', connected ? 'Connected' : 'Disconnected');
  });

  mqttService.connect();
}

/**
 * Primary data access method.
 * Returns all sensor readings from the active data source.
 * When MQTT is connected, returns merged mock + real-time data.
 */
export async function getReadings(): Promise<SensorReading[]> {
  // If we have MQTT data, use it
  if (mqttService.isConnected() || _realtimeReadings.size > 0) {
    return getAllReadings();
  }

  // Load from mock
  if (_mockCache) return _mockCache;

  try {
    const res = await fetch(MOCK_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching mock data`);
    _mockCache = await res.json();
    return _mockCache!;
  } catch (err) {
    console.error('[DataService] Failed to load data:', err);
    return [];
  }
}

/**
 * Get all readings merged from mock and real-time sources
 */
export function getAllReadings(): SensorReading[] {
  const readings: SensorReading[] = [];
  
  // Add mock readings
  if (_mockCache) {
    readings.push(..._mockCache);
  }
  
  // Add real-time readings (override mock data for same device)
  const seen = new Set<string>();
  
  // Sort by timestamp, most recent first
  readings.sort((a, b) => {
    const timeA = new Date(`${a.date}T${a.time}`).getTime();
    const timeB = new Date(`${b.date}T${b.time}`).getTime();
    return timeB - timeA;
  });
  
  // Mark seen readings (avoid duplicates)
  readings.forEach(r => seen.add(`${r.device_id}_${r.date}_${r.time}`));
  
  // Add/update with real-time readings (they are more recent)
  _realtimeReadings.forEach((reading, deviceId) => {
    const key = `${deviceId}_${reading.date}_${reading.time}`;
    const existingIndex = readings.findIndex(r => 
      `${r.device_id}_${r.date}_${r.time}` === key
    );
    
    if (existingIndex >= 0) {
      readings[existingIndex] = reading;
    } else {
      readings.unshift(reading);
    }
  });
  
  return readings;
}

/**
 * Get latest reading for a specific device (prioritizes real-time)
 */
export function getLatestReading(deviceId: string): SensorReading | undefined {
  // Check real-time first
  const realtime = _realtimeReadings.get(deviceId);
  if (realtime) return realtime;
  
  // Fall back to mock data
  if (_mockCache) {
    const readings = filterByChamber(_mockCache, deviceId);
    return readings[readings.length - 1];
  }
  
  return undefined;
}

/**
 * Filter readings by device ID.
 */
export function filterByChamber(data: SensorReading[], deviceId: string): SensorReading[] {
  if (deviceId === 'ALL') return data;
  return data.filter(d => d.device_id === deviceId);
}

/**
 * Filter readings to the last N days relative to the most recent reading.
 */
export function filterByDays(data: SensorReading[], days: number): SensorReading[] {
  if (data.length === 0) return data;
  
  // Find the most recent timestamp from real-time readings first
  let latestTime = 0;
  _realtimeReadings.forEach(r => {
    const time = new Date(`${r.date}T${r.time}`).getTime();
    if (time > latestTime) latestTime = time;
  });
  
  // If no real-time, use mock data
  if (latestTime === 0) {
    const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
    latestTime = Math.max(...timestamps);
  }
  
  const cutoff = latestTime - days * 24 * 60 * 60 * 1000;
  return data.filter(d => new Date(`${d.date}T${d.time}`).getTime() >= cutoff);
}

/**
 * Get the earliest and latest dates in a dataset.
 */
export function getDateBounds(data: SensorReading[]): { min: Date; max: Date } | null {
  if (data.length === 0) return null;
  
  // Check real-time readings first
  let latestTime = 0;
  let earliestTime = Infinity;
  
  _realtimeReadings.forEach(r => {
    const time = new Date(`${r.date}T${r.time}`).getTime();
    if (time > latestTime) latestTime = time;
    if (time < earliestTime) earliestTime = time;
  });
  
  // Merge with mock data
  data.forEach(d => {
    const time = new Date(`${d.date}T${d.time}`).getTime();
    if (time > latestTime) latestTime = time;
    if (time < earliestTime) earliestTime = time;
  });
  
  return { 
    min: new Date(earliestTime === Infinity ? Date.now() - 7*24*60*60*1000 : earliestTime), 
    max: new Date(latestTime || Date.now()) 
  };
}

/**
 * Get unique device IDs from dataset (includes both mock and real-time).
 */
export function getUniqueDevices(data: SensorReading[]): string[] {
  const devices = new Set<string>();
  
  // From data
  data.forEach(d => devices.add(d.device_id));
  
  // From real-time readings
  _realtimeReadings.forEach((_, deviceId) => devices.add(deviceId));
  
  return [...devices];
}

/**
 * Calculate temperature statistics for a reading set.
 */
export function calcStats(data: SensorReading[]): { max: number; min: number; avg: number } {
  if (data.length === 0) return { max: 0, min: 0, avg: 0 };
  
  const temps = data.map(d => d.temp);
  return {
    max: Math.max(...temps),
    min: Math.min(...temps),
    avg: temps.reduce((a, b) => a + b, 0) / temps.length,
  };
}

/**
 * Check if MQTT is connected
 */
export function isMQTTConnected(): boolean {
  return mqttService.isConnected();
}

/**
 * Get connection status info
 */
export function getConnectionStatus(): { mqtt: boolean; mock: boolean } {
  return {
    mqtt: mqttService.isConnected(),
    mock: _mockCache !== null,
  };
}
