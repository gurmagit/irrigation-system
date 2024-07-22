import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Device } from '../models/device.model';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  private url = 'http://localhost:3001/api/devices';

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
    return this.http.put<Device>(`${this.url}/updateName/${previousName}`, {name});
  }

  updateDeviceSchedule(device: Device): Observable<Device> {
    return this.http.put<Device>(`${this.url}/updateSchedule/${device.name}`, {schedules: device.schedules});
  }

  deleteDevice(name: string): Observable<void> {
    return this.http.delete<void>(`${this.url}/${name}`);
  }

  operateDevice(name: string, action: string): Observable<any> {
    return this.http.get<any>(`${this.url}/action/${name}/${action}`);
  }
}
