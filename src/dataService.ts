/**
 * DATA SERVICE — Get Temp ColdChain App
 * 
 * MQTT integration for real-time sensor data from ESP32 devices.
 */

import mqtt from 'mqtt';

// Interface for MQTT data (short field names from ESP32)
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

// Interface expected by frontend (long field names)
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
  // Optional fields for outlier detection
  isOutlier?: boolean;
  outlierReason?: string;
  invalidJump?: boolean;
  jumpDelta?: number;
}

// --- MQTT Configuration ---
const MQTT_CONFIG = {
  brokerUrl: 'wss://r0112411.ala.us-east-1.emqxsl.com:8084/mqtt',
  topic: 'gettemp',
  username: 'gettemp',
  password: 'gettemp123',
};

// Test with wildcard - uncomment if needed:
// const MQTT_CONFIG = {
//   brokerUrl: 'wss://r0112411.ala.us-east-1.emqxsl.com:8084/mqtt',
//   topic: 'gettemp/#',
//   username: 'gettemp',
//   password: 'gettemp123',
// };

// --- Convert MQTT data to frontend format ---
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

// --- Internal state ---
let _mqttClient: mqtt.MqttClient | null = null;
let _readings: SensorReading[] = [];
let _listeners: ((readings: SensorReading[]) => void)[] = [];
let _mqttInitialized = false;
const LAST_COMM_KEY = 'gettemp_last_communication';
const OFFLINE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Update last communication timestamp
export function updateLastCommunication(): void {
  localStorage.setItem(LAST_COMM_KEY, Date.now().toString());
}

// Get time since last communication
export function getTimeSinceLastComm(): number {
  const lastComm = localStorage.getItem(LAST_COMM_KEY);
  if (!lastComm) return Infinity;
  return Date.now() - parseInt(lastComm);
}

// Check if system is offline based on timeout
export function isSystemOffline(): boolean {
  return getTimeSinceLastComm() > OFFLINE_TIMEOUT_MS;
}

// Export internal state for data management
export function getInternalReadings(): SensorReading[] {
  return _readings;
}

export function clearAllReadings(): void {
  _readings = [];
  localStorage.removeItem(STORAGE_KEY);
  notifyListeners();
}

export function deleteReadingById(uniqueReadingId: string): boolean {
  console.log('[DataService] Attempting to delete reading:', uniqueReadingId);
  console.log('[DataService] Current readings before delete:', _readings.length);
  
  const index = _readings.findIndex(r => r.unique_reading_id === uniqueReadingId);
  console.log('[DataService] Found at index:', index);
  
  if (index >= 0) {
    const removed = _readings.splice(index, 1);
    console.log('[DataService] Removed:', removed[0]);
    saveToStorage();
    notifyListeners();
    console.log('[DataService] Readings after delete:', _readings.length);
    return true;
  }
  console.log('[DataService] Reading not found');
  return false;
}

const STORAGE_KEY = 'gettemp_readings';
const MAX_STORED_READINGS = 1000;

function getUserId(): string {
  return localStorage.getItem('gettemp_user_id') || 'anonymous';
}

function saveToStorage() {
  try {
    const userId = getUserId();
    const dataToSave = {
      userId,
      readings: _readings,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('[DataService] Could not save to storage:', e);
  }
}

function loadFromStorage(): SensorReading[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const currentUserId = getUserId();
      
      if ((parsed.userId === currentUserId || !parsed.userId) && parsed.readings) {
        console.log('[DataService] Loaded', parsed.readings.length, 'readings from storage');
        
        // Remove duplicates based on unique_reading_id and invalid temps (85°C)
        const seen = new Set<string>();
        const uniqueReadings = parsed.readings.filter((r: SensorReading) => {
          // Filter out 85°C (DS18B20 error code)
          if (r.temp === 85 || r.temp < -55 || r.temp > 125) {
            console.log('[DataService] Removing invalid reading:', r.unique_reading_id, r.temp);
            return false;
          }
          if (seen.has(r.unique_reading_id)) {
            console.log('[DataService] Removing duplicate:', r.unique_reading_id);
            return false;
          }
          seen.add(r.unique_reading_id);
          return true;
        });
        
        console.log('[DataService] Unique readings after cleanup:', uniqueReadings.length);
        return uniqueReadings;
      }
    }
  } catch (e) {
    console.warn('[DataService] Could not load from storage:', e);
  }
  
  // No fallback to mock data - only real ESP32 data
  console.log('[DataService] No stored data, returning empty array');
  return [];
}

// --- Initialize MQTT ---
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
  
  _mqttClient.on('message', (topic, payload) => {
    try {
      const mqttReading: MqttReading = JSON.parse(payload.toString());
      console.log('[DataService] Received MQTT message:', topic, mqttReading);
      
      // Validate temperature - filter out invalid readings (85°C is a common error code from DS18B20)
      if (mqttReading.temp === 85 || mqttReading.temp < -55 || mqttReading.temp > 125) {
        console.warn('[DataService] Invalid temperature reading filtered:', mqttReading.temp);
        return;
      }
      
      // Convert to frontend format
      const reading = convertToSensorReading(mqttReading);
      console.log('[DataService] Converted reading:', reading);
      
      // Update last communication timestamp
      updateLastCommunication();
      
      // Check if reading already exists (avoid duplicates from ESP32 re-sending)
      const existingIndex = _readings.findIndex(r => r.unique_reading_id === reading.unique_reading_id);
      if (existingIndex >= 0) {
        console.log('[DataService] Reading already exists, updating...');
        _readings[existingIndex] = reading;
      } else {
        console.log('[DataService] Adding new reading:', reading.unique_reading_id);
        _readings.push(reading);
      }
      
      // Keep only last 1000 readings
      if (_readings.length > MAX_STORED_READINGS) {
        _readings = _readings.slice(-MAX_STORED_READINGS);
      }
      
      // Save to localStorage for persistence
      saveToStorage();
      
      // Notify listeners
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

// --- Notify all listeners ---
function notifyListeners() {
  _listeners.forEach(fn => fn([..._readings]));
}

// --- Public API ---

/**
 * Subscribe to sensor readings updates.
 */
export function onReadingsUpdate(callback: (readings: SensorReading[]) => void): () => void {
  _listeners.push(callback);
  
  // Immediately call with current data (load if needed)
  if (_readings.length === 0) {
    _readings = loadFromStorage();
  }
  
  if (_readings.length > 0) {
    console.log('[onReadingsUpdate] Sending', _readings.length, 'readings to callback');
    callback([..._readings]);
  } else {
    console.log('[onReadingsUpdate] No readings available yet');
  }
  
  // Return unsubscribe function
  return () => {
    _listeners = _listeners.filter(fn => fn !== callback);
  };
}

/**
 * Get all sensor readings.
 * Also initializes MQTT connection if not already done.
 */
export function getReadings(): Promise<SensorReading[]> {
  // Load from storage if empty
  if (_readings.length === 0) {
    _readings = loadFromStorage();
    console.log('[DataService] Loaded from storage, count:', _readings.length);
  } else {
    console.log('[DataService] Using existing in-memory readings, count:', _readings.length);
  }
  
  if (!_mqttClient) {
    console.log('[DataService] Initializing MQTT from getReadings...');
    initMQTT();
  }
  
  console.log('[DataService] Returning readings:', _readings.length);
  
  return Promise.resolve(_readings);
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
  
  const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
  const latestTime = Math.max(...timestamps);
  const cutoff = latestTime - days * 24 * 60 * 60 * 1000;
  
  return data.filter(d => {
    const ts = new Date(`${d.date}T${d.time}`).getTime();
    return ts >= cutoff;
  });
}

/**
 * Get the earliest and latest dates in a dataset.
 */
export function getDateBounds(data: SensorReading[]): { min: Date; max: Date } | null {
  if (data.length === 0) return null;
  
  const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
  return { 
    min: new Date(Math.min(...timestamps)), 
    max: new Date(Math.max(...timestamps)) 
  };
}

/**
 * Get unique device IDs from dataset.
 */
export function getUniqueDevices(data: SensorReading[]): string[] {
  return [...new Set(data.map(d => d.device_id))];
}

/**
 * Calculate temperature statistics for a reading set.
 */
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

/**
 * Get temperature limits for a specific device from localStorage.
 * Returns default values if not configured.
 */
export function getDeviceLimits(deviceId: string): { min: number; max: number } {
  const storedCameras = JSON.parse(localStorage.getItem('gettemp_cameras') || '{}');
  const camera = storedCameras[deviceId];
  
  if (camera) {
    return {
      min: parseFloat(camera.temp_min) || -25,
      max: parseFloat(camera.temp_max) || -15
    };
  }
  
  // Default limits if not configured
  return { min: -25, max: -15 };
}

/**
 * Check if a reading is within safe limits for a device.
 */
export function isWithinLimits(temp: number, deviceId: string): boolean {
  const limits = getDeviceLimits(deviceId);
  return temp >= limits.min && temp <= limits.max;
}

/**
 * Get the latest reading for each device.
 */
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

/**
 * Save last reading to localStorage for persistence across page loads.
 */
export function saveLastReading(reading: SensorReading) {
  try {
    localStorage.setItem('gettemp_last_reading', JSON.stringify(reading));
  } catch (e) {
    console.warn('[DataService] Could not save last reading:', e);
  }
}

/**
 * Load last reading from localStorage.
 */
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
