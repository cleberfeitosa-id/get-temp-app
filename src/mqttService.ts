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

// Temperature jump validation limits
// Quedas de ate 30°C sao permitidas (porta aberta pode resfriar rapido)
// Subidas de ate 5°C sao permitidas (qualquer subida maior e impossivel fisicamente)
const MAX_TEMP_RISE = 5;    // Maximum allowed temperature increase in °C
const MAX_TEMP_DROP = -30;  // Maximum allowed temperature decrease in °C

export type DataCallback = (reading: SensorReading) => void;
export type ConnectionCallback = (connected: boolean) => void;

class MQTTSensorService {
  private client: any = null;
  private connected: boolean = false;
  private dataCallbacks: DataCallback[] = [];
  private connectionCallbacks: ConnectionCallback[] = [];
  private latestReadings: Map<string, SensorReading> = new Map();
  private useMQTT: boolean = false;
  private messageQueue: SensorReading[] = [];
  private processingQueue: boolean = false;
  private readonly MAX_QUEUE_SIZE = 500;
  private readonly QUEUE_STORAGE_KEY = 'gettemp_mqtt_queue';

  /**
   * Initialize MQTT connection
   */
  async connect(config?: Partial<typeof MQTT_CONFIG>): Promise<void> {
    if (config) {
      Object.assign(MQTT_CONFIG, config);
    }

    // Load any queued messages from localStorage
    this.loadQueueFromStorage();

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
        
        // Process any queued messages from offline period
        this.processQueue();
        
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

      // Validate temperature for outliers (typical cold chain: -40°C to +30°C)
      const MIN_TEMP = -40;
      const MAX_TEMP = 30;
      if (reading.temp < MIN_TEMP || reading.temp > MAX_TEMP) {
        console.warn(`[MQTT] Outlier detected: ${reading.temp}°C (outside ${MIN_TEMP} to ${MAX_TEMP}°C range) - marking as potential error`);
        reading.temp = reading.temp; // Keep the value but log warning
        // Optionally flag as outlier
        (reading as any).isOutlier = true;
        (reading as any).outlierReason = `Temperature ${reading.temp}°C is outside valid range (${MIN_TEMP} to ${MAX_TEMP}°C)`;
      }
      
      // Validate temperature jump from last reading
      const jumpResult = this.validateTemperatureJump(reading);
      if (jumpResult.isInvalid) {
        console.warn(`[MQTT] Invalid temperature jump detected: ${reading.temp}°C (delta: ${jumpResult.delta}°C) - ${jumpResult.reason}`);
        (reading as any).isOutlier = true;
        (reading as any).outlierReason = jumpResult.reason;
        (reading as any).invalidJump = true;
        (reading as any).jumpDelta = jumpResult.delta;
      }
      
      // Update stored last valid reading if not outlier
      if (!(reading as any).isOutlier) {
        this.setLastValidReading(reading.device_id, reading.temp);
      }

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
   * Validate temperature jump from last reading
   * Returns validation result with delta and reason
   */
  private validateTemperatureJump(reading: SensorReading): { isInvalid: boolean; delta: number; reason: string } {
    const lastTemp = this.getLastValidReading(reading.device_id);
    
    // No previous reading - accept the first one
    if (lastTemp === null) {
      return { isInvalid: false, delta: 0, reason: 'first reading' };
    }
    
    const delta = reading.temp - lastTemp;
    
    // Check if jump is invalid
    if (delta > MAX_TEMP_RISE) {
      return {
        isInvalid: true,
        delta: delta,
        reason: `Temperature rose ${delta.toFixed(1)}°C (max allowed rise: ${MAX_TEMP_RISE}°C) - physically impossible jump`
      };
    }
    
    if (delta < MAX_TEMP_DROP) {
      return {
        isInvalid: true,
        delta: delta,
        reason: `Temperature dropped ${Math.abs(delta).toFixed(1)}°C (max allowed drop: ${Math.abs(MAX_TEMP_DROP)}°C) - excessive drop`
      };
    }
    
    return { isInvalid: false, delta: delta, reason: 'valid jump' };
  }

  /**
   * Get last valid temperature reading for a device from localStorage
   */
  private getLastValidReading(deviceId: string): number | null {
    try {
      const stored = localStorage.getItem('gettemp_last_valid_temp');
      if (stored) {
        const data = JSON.parse(stored);
        if (data[deviceId]) {
          return data[deviceId].temp;
        }
      }
    } catch (e) {
      console.warn('[MQTT] Could not load last valid reading:', e);
    }
    return null;
  }

  /**
   * Save last valid temperature reading for a device to localStorage
   */
  private setLastValidReading(deviceId: string, temp: number): void {
    try {
      const stored = localStorage.getItem('gettemp_last_valid_temp');
      const data = stored ? JSON.parse(stored) : {};
      data[deviceId] = { temp: temp, updatedAt: Date.now() };
      localStorage.setItem('gettemp_last_valid_temp', JSON.stringify(data));
    } catch (e) {
      console.warn('[MQTT] Could not save last valid reading:', e);
    }
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

  // --- Message Queue Management for Offline Support ---
  
  /**
   * Add reading to queue (for offline support)
   */
  queueReading(reading: SensorReading): void {
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest when queue is full
      this.messageQueue.shift();
    }
    this.messageQueue.push(reading);
    this.saveQueueToStorage();
    console.log(`[MQTT] Queued reading. Queue size: ${this.messageQueue.length}`);
  }

  /**
   * Process queued messages (call when connection is restored)
   */
  async processQueue(): Promise<void> {
    if (this.processingQueue || !this.isConnected() || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;
    console.log(`[MQTT] Processing queue of ${this.messageQueue.length} messages...`);

    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];
    this.saveQueueToStorage();

    for (const reading of queueCopy) {
      // Re-validate before processing
      if (this.isValidReading(reading)) {
        this.latestReadings.set(reading.device_id, reading);
        this.notifyDataReceived(reading);
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between messages
      } else {
        console.warn(`[MQTT] Skipping invalid queued reading: ${reading.unique_reading_id}`);
      }
    }

    this.processingQueue = false;
    console.log('[MQTT] Queue processing complete');
  }

  /**
   * Validate a reading before processing
   */
  private isValidReading(reading: SensorReading): boolean {
    if (!reading || typeof reading.temp !== 'number') return false;
    
    // Temperature range validation
    const MIN_TEMP = -40;
    const MAX_TEMP = 30;
    if (reading.temp < MIN_TEMP || reading.temp > MAX_TEMP) {
      console.warn(`[MQTT] Invalid temperature in queued reading: ${reading.temp}°C`);
      return false;
    }
    
    // Must have device_id
    if (!reading.device_id) return false;
    
    return true;
  }

  /**
   * Save queue to localStorage for persistence
   */
  private saveQueueToStorage(): void {
    try {
      localStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.messageQueue));
    } catch (e) {
      console.warn('[MQTT] Could not save queue to storage:', e);
    }
  }

  /**
   * Load queue from localStorage on initialization
   */
  loadQueueFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.QUEUE_STORAGE_KEY);
      if (stored) {
        this.messageQueue = JSON.parse(stored);
        console.log(`[MQTT] Loaded ${this.messageQueue.length} queued messages from storage`);
      }
    } catch (e) {
      console.warn('[MQTT] Could not load queue from storage:', e);
      this.messageQueue = [];
    }
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.messageQueue = [];
    this.saveQueueToStorage();
    console.log('[MQTT] Queue cleared');
  }
}

// Singleton instance
export const mqttService = new MQTTSensorService();
