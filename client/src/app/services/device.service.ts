import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device } from '../models/device.model';

// Belt-and-suspenders alongside the server's Cache-Control: no-store — makes sure the
// browser itself never serves a cached copy of live, mutable state (e.g. the master switch).
const noCache = { headers: new HttpHeaders({ 'Cache-Control': 'no-cache' }) };

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private url = '/api/devices';

  constructor(private http: HttpClient) { }

  getDevices(): Observable<Device[]> {
    return this.http.get<Device[]>(this.url);
  }

  getDevice(name: string): Observable<Device> {
    return this.http.get<Device>(`${this.url}/${name}`);
  }

  addDevice(device: Device): Observable<Device> {
    return this.http.post<Device>(this.url, device);
  }

  updateDeviceName(previousName: string, name: string): Observable<Device> {
    return this.http.put<Device>(`${this.url}/updateName/${previousName}`, { name });
  }

  updateDeviceSchedule(device: Device): Observable<Device> {
    return this.http.put<Device>(`${this.url}/updateSchedule/${device.name}`, { schedules: device.schedules });
  }

  deleteDevice(name: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${name}`);
  }

  operateDevice(name: string, action: string): Observable<any> {
    return this.http.get<any>(`${this.url}/action/${name}/${action}`);
  }

  resetAllStatuses(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/resetStatuses`, {});
  }

  getLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/logs`);
  }

  getAllLogs(): Observable<any[]> {
    return this.http.get<any[]>(`${this.url}/logs/all`);
  }

  deleteSchedules(name: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${name}/schedules`);
  }

  runDevice(name: string, minutes: number): Observable<any> {
    return this.http.post<any>(`${this.url}/run`, { name, minutes });
  }

  sleepEsp(minutes: number): Observable<any> {
    return this.http.post<any>(`${this.url}/sleep`, { minutes });
  }

  getEspStatus(): Observable<{ online: boolean }> {
    return this.http.get<{ online: boolean }>(`${this.url}/esp-status`);
  }

  getSensors(): Observable<any> {
    return this.http.get<any>(`${this.url}/sensors`);
  }

  refreshSensors(): Observable<any> {
    return this.http.post<any>(`${this.url}/sensors/refresh`, {});
  }

  getNightMode(): Observable<any> {
    return this.http.get<any>(`${this.url}/night-mode`);
  }

  setNightMode(settings: { enabled: boolean; start: string; end: string }): Observable<any> {
    return this.http.post<any>(`${this.url}/night-mode`, settings);
  }

  getPulseMs(): Observable<{ pulse_ms: number }> {
    return this.http.get<{ pulse_ms: number }>(`${this.url}/pulse-ms`);
  }

  setPulseMs(pulse_ms: number): Observable<any> {
    return this.http.post<any>(`${this.url}/pulse-ms`, { pulse_ms });
  }

  getSystemEnabled(): Observable<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>(`${this.url}/system-enabled`, noCache);
  }

  setSystemEnabled(enabled: boolean): Observable<{ enabled: boolean }> {
    return this.http.post<{ enabled: boolean }>(`${this.url}/system-enabled`, { enabled });
  }
}
