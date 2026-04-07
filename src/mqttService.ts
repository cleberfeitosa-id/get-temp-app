/**
 * MQTT SERVICE — Get Temp ColdChain App
 * 
 * Handles real-time MQTT connection to ESP32 devices.
 * Receives temperature readings and pushes them to all subscribed screens.
 */

import type { SensorReading } from './dataService.ts';

// MQTT Configuration - Update these values for your broker
export const MQTT_CONFIG = {
  // Example: 'wss://broker.hivemq.com:8884/mqtt' (public test broker)
  // Or your own broker: 'wss://your-broker.com:8084/mqtt'
  brokerUrl: '',
  topic: 'gettemp/#',  // Topic pattern to subscribe
  username: '',
  password: '',
  reconnectPeriod: 5000,
};

export type DataCallback = (reading: SensorReading) => void;
export type ConnectionCallback = (connected: boolean) => void;

class MQTTSensorService {
  private client: any = null;
  private connected: boolean = false;
  private dataCallbacks: DataCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private latestReadings: Map<string, SensorReading> = new Map();
  private useMQTT: boolean = false;

  /**
   * Initialize MQTT connection
   */
  async connect(config?: Partial<typeof MQTT_CONFIG>): Promise<void> {
    if (config) {
      Object.assign(MQTT_CONFIG, config);
    }

    // If no broker URL configured, skip MQTT
    if (!MQTT_CONFIG.brokerUrl) {
      console.log('[MQTT] No broker URL configured. Using mock data only.');
      return;
    }

    try {
      // Dynamic import for MQTT (only load when needed)
      const mqtt = await import('mqtt');
      
      console.log(`[MQTT] Connecting to ${MQTT_CONFIG.brokerUrl}...`);
      
      this.client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
        username: MQTT_CONFIG.username || undefined,
        password: MQTT_CONFIG.password || undefined,
        reconnectPeriod: MQTT_CONFIG.reconnectPeriod,
        clientId: `gettemp_web_${Math.random().toString(16).slice(2, 10)}`,
      });

      this.client.on('connect', () => {
        console.log('[MQTT] Connected successfully!');
        this.connected = true;
        this.useMQTT = true;
        this.notifyConnectionChange(true);
        
        // Subscribe to temperature topic
        this.client.subscribe(MQTT_CONFIG.topic, { qos: 0 }, (err: any) => {
          if (err) {
            console.error('[MQTT] Subscribe error:', err);
          } else {
            console.log(`[MQTT] Subscribed to: ${MQTT_CONFIG.topic}`);
          }
        });
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        try {
          const message = payload.toString();
          console.log(`[MQTT] Message on ${topic}:`, message);
          
          const reading = this.parseReading(message, topic);
          if (reading) {
            this.latestReadings.set(reading.device_id, reading);
            this.notifyDataReceived(reading);
          }
        } catch (err) {
          console.error('[MQTT] Error parsing message:', err);
        }
      });

      this.client.on('error', (err: any) => {
        console.error('[MQTT] Connection error:', err);
      });

      this.client.on('close', () => {
        console.log('[MQTT] Connection closed');
        this.connected = false;
        this.useMQTT = false;
        this.notifyConnectionChange(false);
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] Reconnecting...');
      });

    } catch (err) {
      console.error('[MQTT] Failed to connect:', err);
      this.connected = false;
      this.useMQTT = false;
    }
  }

  /**
   * Parse MQTT message into SensorReading format
   */
  private parseReading(message: string, topic: string): SensorReading | null {
    try {
      const data = JSON.parse(message);
      
      // Validate required fields
      if (typeof data.temp !== 'number' && typeof data.temperature !== 'number') {
        console.warn('[MQTT] Invalid reading: missing temperature');
        return null;
      }

      const now = new Date();
      const reading: SensorReading = {
        device_id: data.device_id || data.deviceId || this.extractDeviceId(topic),
        name: data.name || data.device_name || `Device ${this.extractDeviceId(topic)}`,
        temp: data.temp ?? data.temperature,
        wifi_rssi: data.wifi_rssi ?? data.rssi ?? -50,
        spiffs_usage: data.spiffs_usage ?? 0,
        free_heap: data.free_heap ?? 0,
        uptime: data.uptime ?? 0,
        device_ip: data.device_ip || data.ip || '',
        unique_reading_id: data.unique_reading_id || `${Date.now()}_${Math.random()}`,
        date: data.date || now.toISOString().split('T')[0],
        time: data.time || now.toTimeString().split(' ')[0],
        connection: this.determineConnection(data),
      };

      return reading;
    } catch (err) {
      console.error('[MQTT] Failed to parse reading:', err);
      return null;
    }
  }

  /**
   * Extract device ID from MQTT topic
   */
  private extractDeviceId(topic: string): string {
    const parts = topic.split('/');
    return parts[parts.length - 1] || 'UNKNOWN';
  }

  /**
   * Determine connection status from reading data
   */
  private determineConnection(data: any): 'Connected' | 'Disconnected' {
    if (data.connection === 'Disconnected') return 'Disconnected';
    if (data.status === 'offline' || data.status === 'disconnected') return 'Disconnected';
    // Consider readings older than 5 minutes as disconnected
    if (data.timestamp) {
      const readingTime = new Date(data.timestamp).getTime();
      const now = Date.now();
      if (now - readingTime > 5 * 60 * 1000) return 'Disconnected';
    }
    return 'Connected';
  }

  /**
   * Subscribe to real-time data updates
   */
  onData(callback: DataCallback): void {
    this.dataCallbacks.push(callback);
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionChange(callback: ConnectionCallback): void {
    this.connectionCallbacks.push(callback);
  }

  /**
   * Get latest reading for a specific device
   */
  getLatestReading(deviceId: string): SensorReading | undefined {
    return this.latestReadings.get(deviceId);
  }

  /**
   * Get all latest readings
   */
  getAllLatestReadings(): SensorReading[] {
    return Array.from(this.latestReadings.values());
  }

  /**
   * Check if MQTT is connected
   */
  isConnected(): boolean {
    return this.connected && this.useMQTT;
  }

  /**
   * Disconnect from MQTT broker
   */
  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      this.useMQTT = false;
      console.log('[MQTT] Disconnected');
    }
  }

  private notifyDataReceived(reading: SensorReading): void {
    this.dataCallbacks.forEach(cb => cb(reading));
  }

  private notifyConnectionChange(connected: boolean): void {
    this.connectionCallbacks.forEach(cb => cb(connected));
  }
}

// Singleton instance
export const mqttService = new MQTTSensorService();
