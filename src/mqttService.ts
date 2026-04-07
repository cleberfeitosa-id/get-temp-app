/**
 * MQTT SERVICE — Get Temp ColdChain App
 * 
 * Handles real-time MQTT connection to ESP32 devices.
 * Receives temperature readings and pushes them to all subscribed screens.
 */

import type { SensorReading } from './dataService.ts';

// MQTT Configuration - EMQX Cloud
export const MQTT_CONFIG = {
  // EMQX Cloud with TLS WebSocket: wss://r0112411.ala.us-east-1.emqxsl.com:8884/mqtt
  brokerUrl: '',
  topic: 'gettemp',  // Topic to subscribe (ESP32 publishes here)
  username: 'gettemp',
  password: 'gettemp123',
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
        username: MQTT_CONFIG.username || 'gettemp',
        password: MQTT_CONFIG.password || 'gettemp123',
        reconnectPeriod: MQTT_CONFIG.reconnectPeriod,
        clientId: `gettemp_web_${Math.random().toString(16).slice(2, 10)}`,
        // EMQX Cloud requires TLS
        rejectUnauthorized: false, // For development/testing - in production use proper certificates
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
          console.log(`[MQTT] Message received on ${topic}`);
          
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
   * Handles both app format (device_id) and ESP32 format (did, uid, dip, rssi, spiffs, heap, up, conn)
   */
  private parseReading(message: string, topic: string): SensorReading | null {
    try {
      const data = JSON.parse(message);
      
      // Validate required fields (either temp or temperature)
      if (typeof data.temp !== 'number' && typeof data.temperature !== 'number') {
        console.warn('[MQTT] Invalid reading: missing temperature');
        return null;
      }

      const now = new Date();
      const reading: SensorReading = {
        // Handle both formats: app uses device_id, ESP32 uses did
        device_id: data.device_id || data.did || this.extractDeviceId(topic),
        // Handle both formats: app uses unique_reading_id, ESP32 uses uid
        unique_reading_id: data.unique_reading_id || data.uid || `${Date.now()}_${Math.random()}`,
        // Handle both formats: app uses device_ip, ESP32 uses dip
        device_ip: data.device_ip || data.dip || '',
        name: data.name || data.device_name || `Device ${this.extractDeviceId(topic)}`,
        temp: data.temp ?? data.temperature,
        // Handle both formats: app uses wifi_rssi, ESP32 uses rssi
        wifi_rssi: data.wifi_rssi ?? data.rssi ?? -50,
        // Handle both formats: app uses spiffs_usage, ESP32 uses spiffs
        spiffs_usage: data.spiffs_usage ?? data.spiffs ?? 0,
        // Handle both formats: app uses free_heap, ESP32 uses heap
        free_heap: data.free_heap ?? data.heap ?? 0,
        // Handle both formats: app uses uptime, ESP32 uses up
        uptime: data.uptime ?? data.up ?? 0,
        date: data.date || now.toISOString().split('T')[0],
        time: data.time || now.toTimeString().split(' ')[0],
        // Handle both formats: app uses connection, ESP32 uses conn
        connection: this.determineConnection(data),
      };

      console.log(`[MQTT] Parsed reading: ${reading.device_id} - ${reading.temp}°C`);
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
   * Handles both formats: app uses 'connection', ESP32 uses 'conn'
   */
  private determineConnection(data: any): 'Connected' | 'Disconnected' {
    // Check ESP32 format (conn)
    if (data.conn === 'offline' || data.conn === 'disconnected' || data.conn === 'overheating' || data.conn === 'spiffs_warning') {
      return 'Disconnected';
    }
    // Check app format (connection)
    if (data.connection === 'Disconnected' || data.connection === 'offline') {
      return 'Disconnected';
    }
    // Consider readings with old timestamps as disconnected (5 min timeout)
    if (data.timestamp || data.date || data.time) {
      const readingTime = new Date(`${data.date || ''}T${data.time || ''}`).getTime();
      if (readingTime && Date.now() - readingTime > 5 * 60 * 1000) {
        return 'Disconnected';
      }
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
