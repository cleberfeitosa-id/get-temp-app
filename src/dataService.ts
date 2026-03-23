/**
 * DATA SERVICE — Get Temp ColdChain App
 *
 * This module provides a unified abstraction for fetching sensor data.
 * Currently uses the static mock JSON, but is designed to be swapped
 * for a live MQTT or REST API connection by replacing `fetchData()`.
 *
 * MQTT INTEGRATION GUIDE (future):
 * ----------------------------------
 * 1. Install: `npm install mqtt`
 * 2. Replace `fetchData()` with an MQTT subscriber using the pattern below:
 *
 *    import mqtt from 'mqtt';
 *    const client = mqtt.connect('wss://YOUR_BROKER_HOST:8083/mqtt', {
 *      username: 'YOUR_USER',
 *      password: 'YOUR_PASS',
 *    });
 *    client.subscribe('coldchain/readings/#');
 *    client.on('message', (topic, payload) => {
 *      const reading: SensorReading = JSON.parse(payload.toString());
 *      onNewReading(reading); // push into your reactive store
 *    });
 *
 * 3. Replace calls to `getReadings()` with reactive store subscriptions.
 */

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
// Set USE_MOCK to false and populate MQTT_CONFIG when integrating live data.
const USE_MOCK = true;
const MOCK_URL = '/mock/esp32_mock.json';

// Future: MQTT broker config
// const MQTT_CONFIG = {
//   brokerUrl: 'wss://your-broker-host:8083/mqtt',
//   topic: 'coldchain/readings/#',
//   username: '',
//   password: '',
// };

// --- Internal cache ---
let _cache: SensorReading[] | null = null;

/**
 * Primary data access method.
 * Returns all sensor readings from the active data source.
 * In mock mode, fetches and caches the JSON file once.
 */
export async function getReadings(): Promise<SensorReading[]> {
  if (!USE_MOCK) {
    // TODO: Replace with MQTT real-time store retrieval
    console.warn('[DataService] Live MQTT integration not yet configured. Falling back to mock.');
  }

  if (_cache) return _cache;

  try {
    const res = await fetch(MOCK_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching mock data`);
    _cache = await res.json();
    return _cache!;
  } catch (err) {
    console.error('[DataService] Failed to load data:', err);
    return [];
  }
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
  return data.filter(d => new Date(`${d.date}T${d.time}`).getTime() >= cutoff);
}

/**
 * Get the earliest and latest dates in a dataset.
 */
export function getDateBounds(data: SensorReading[]): { min: Date; max: Date } | null {
  if (data.length === 0) return null;
  const timestamps = data.map(d => new Date(`${d.date}T${d.time}`).getTime());
  return { min: new Date(Math.min(...timestamps)), max: new Date(Math.max(...timestamps)) };
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
  const temps = data.map(d => d.temp);
  return {
    max: Math.max(...temps),
    min: Math.min(...temps),
    avg: temps.reduce((a, b) => a + b, 0) / temps.length,
  };
}
