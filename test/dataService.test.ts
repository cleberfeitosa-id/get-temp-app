import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockMqttClient = {
  on: vi.fn(),
  subscribe: vi.fn(),
  publish: vi.fn(),
  end: vi.fn(),
};

vi.mock('mqtt', () => ({
  default: {
    connect: vi.fn(() => mockMqttClient),
  },
}));

import { filterByChamber, filterByDays, getDateBounds, getUniqueDevices, calcStats, getLatestByDevice, type SensorReading } from '../src/dataService.ts';

describe('dataService', () => {
  const mockData: SensorReading[] = [
    { name: 'Câmara 1', unique_reading_id: '1', device_id: 'cam01', device_ip: '192.168.1.10', temp: -18, spiffs_usage: 45, wifi_rssi: -65, free_heap: 20000, uptime: 3600, date: '2024-01-15', time: '10:00:00', connection: 'Connected' },
    { name: 'Câmara 1', unique_reading_id: '2', device_id: 'cam01', device_ip: '192.168.1.10', temp: -17, spiffs_usage: 46, wifi_rssi: -66, free_heap: 19000, uptime: 7200, date: '2024-01-15', time: '11:00:00', connection: 'Connected' },
    { name: 'Câmara 2', unique_reading_id: '3', device_id: 'cam02', device_ip: '192.168.1.11', temp: -20, spiffs_usage: 50, wifi_rssi: -70, free_heap: 18000, uptime: 10800, date: '2024-01-15', time: '12:00:00', connection: 'Connected' },
    { name: 'Câmara 1', unique_reading_id: '4', device_id: 'cam01', device_ip: '192.168.1.10', temp: -19, spiffs_usage: 47, wifi_rssi: -68, free_heap: 17000, uptime: 14400, date: '2024-01-16', time: '10:00:00', connection: 'Connected' },
    { name: 'Câmara 2', unique_reading_id: '5', device_id: 'cam02', device_ip: '192.168.1.11', temp: -22, spiffs_usage: 51, wifi_rssi: -72, free_heap: 16000, uptime: 18000, date: '2024-01-16', time: '11:00:00', connection: 'Disconnected' },
  ];

  describe('filterByChamber', () => {
    it('should return all data when deviceId is ALL', () => {
      const result = filterByChamber(mockData, 'ALL');
      expect(result).toHaveLength(5);
    });

    it('should filter by specific device ID', () => {
      const result = filterByChamber(mockData, 'cam01');
      expect(result).toHaveLength(3);
      expect(result.every(r => r.device_id === 'cam01')).toBe(true);
    });

    it('should return empty array for unknown device', () => {
      const result = filterByChamber(mockData, 'unknown');
      expect(result).toHaveLength(0);
    });
  });

  describe('filterByDays', () => {
    it('should filter data within specified days', () => {
      const result = filterByDays(mockData, 1);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return all data when days is large enough', () => {
      const result = filterByDays(mockData, 365);
      expect(result).toHaveLength(5);
    });

    it('should return empty array for empty data', () => {
      const result = filterByDays([], 1);
      expect(result).toHaveLength(0);
    });
  });

  describe('getDateBounds', () => {
    it('should return min and max dates', () => {
      const result = getDateBounds(mockData);
      expect(result).not.toBeNull();
      if (result) {
        expect(result.min).toBeInstanceOf(Date);
        expect(result.max).toBeInstanceOf(Date);
      }
    });

    it('should return null for empty data', () => {
      const result = getDateBounds([]);
      expect(result).toBeNull();
    });
  });

  describe('getUniqueDevices', () => {
    it('should return unique device IDs', () => {
      const result = getUniqueDevices(mockData);
      expect(result).toContain('cam01');
      expect(result).toContain('cam02');
      expect(result).toHaveLength(2);
    });
  });

  describe('calcStats', () => {
    it('should calculate max, min, and average temperature', () => {
      const result = calcStats(mockData);
      expect(result.max).toBe(-17);
      expect(result.min).toBe(-22);
      expect(result.avg).toBeCloseTo(-19.2, 1);
    });

    it('should return zeros for empty data', () => {
      const result = calcStats([]);
      expect(result.max).toBe(0);
      expect(result.min).toBe(0);
      expect(result.avg).toBe(0);
    });
  });

  describe('getLatestByDevice', () => {
    it('should return latest reading for each device', () => {
      const result = getLatestByDevice(mockData);
      expect(result.size).toBe(2);
      
      const cam01Latest = result.get('cam01');
      expect(cam01Latest?.unique_reading_id).toBe('4');
      
      const cam02Latest = result.get('cam02');
      expect(cam02Latest?.unique_reading_id).toBe('5');
    });
  });
});
