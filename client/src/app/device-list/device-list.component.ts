import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DeviceService } from '../services/device.service';
import { Device } from '../models/device.model';
import { AddDeviceComponent } from '../add-device/add-device.component';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-device-list',
  templateUrl: './device-list.component.html',
  styleUrls: ['./device-list.component.css']
})
export class DeviceListComponent implements OnInit, OnDestroy {
  devices = new MatTableDataSource<Device>;
  displayedColumns = ['name', 'status', 'schedules', 'action', 'run'];
  logs: any[] = [];
  logColumns = ['deviceName', 'startTime', 'endTime', 'duration', 'consumption'];
  showAllLogs = false;
  runMinutesMap: {[name: string]: number} = {};
  espOnline: boolean | null = null;
  sensorData: any = null;
  refreshingSensors = false;
  countdowns: { [name: string]: string } = {};
  private countdownEndTimes: { [name: string]: number } = {};
  private countdownInterval: any = null;
  private ws!: WebSocket;
  private wsReconnectTimer: any;

  constructor(
    private deviceService: DeviceService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private zone: NgZone
  ) { }

  ngOnInit(): void {
    this.loadDevices();
    this.loadLogs();
    this.connectWebSocket();
    this.deviceService.getEspStatus().subscribe(({ online }) => this.espOnline = online);
    this.deviceService.getSensors().subscribe(data => { if (data && Object.keys(data).length) this.sensorData = data; });
  }

  loadDevices(): void {
    this.deviceService.getDevices().subscribe(devices => {
      this.devices = new MatTableDataSource(devices);
      devices.forEach(d => {
        if (!this.runMinutesMap[d.name]) this.runMinutesMap[d.name] = 5;
      });
    });
  }

  loadLogs(): void {
    this.deviceService.getLogs().subscribe(logs => this.logs = logs);
  }

  toggleShowAllLogs(): void {
    this.showAllLogs = !this.showAllLogs;
    if (this.showAllLogs) {
      this.deviceService.getAllLogs().subscribe(logs => this.logs = logs);
    } else {
      this.loadLogs();
    }
  }

  private readonly dayOrder = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  sortDays(days: string[]): string[] {
    return [...days].sort((a, b) => this.dayOrder.indexOf(a) - this.dayOrder.indexOf(b));
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatDuration(seconds: number | null): string {
    if (seconds == null) return 'ongoing...';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  runDevice(name: string): void {
    const minutes = this.runMinutesMap[name] || 5;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: { message: `Run ${name} for ${minutes} minutes?` }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.deviceService.runDevice(name, minutes).subscribe({
        next: () => this.snackBar.open(`${name} started for ${minutes} minutes`, 'OK', { duration: 3000 }),
        error: (err) => {
        if (err.status === 503) this.espOnline = false;
        this.snackBar.open(err.error?.message || 'Run failed', 'Close', { duration: 5000 });
      }
      });
    });
  }

  addDevice(): void {
    const dialogRef = this.dialog.open(AddDeviceComponent, {
      width: '400px',
      data: { device: null }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        console.log('result.device:', result.device);
        this.deviceService.addDevice(result.device).subscribe({
          next: () => this.loadDevices(),
          error: (err) => {
            this.snackBar.open('Failed to add device', 'Close', { duration: 3000 });
            console.error('Add device error:', err);
          }
        });
      }
    });
  }

  editDevice(device: Device): void {
    console.log('device:', device);
    const dialogRef = this.dialog.open(AddDeviceComponent, {
      width: '400px',
      data: { device }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const updatedDevice = result.device;
        const previousName = result.previousName;
        if (previousName != updatedDevice.name) {
          this.deviceService.updateDeviceName(previousName, updatedDevice.name).subscribe({
            next: () => {
              this.deviceService.updateDeviceSchedule(updatedDevice).subscribe(() => {
                this.loadDevices();
              });
            },
            error: (err) => {
              this.snackBar.open('Failed to update device', 'Close', { duration: 3000 });
              console.error('Add device error:', err);
            }
          });
        } else {
          this.deviceService.updateDeviceSchedule(updatedDevice).subscribe(() => {
            this.loadDevices();
          });
        }
      }
    });
  }

  deleteSchedules(device: Device): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: { message: `Delete all schedules for ${device.name}?` }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deviceService.deleteSchedules(device.name).subscribe(() => {
          this.loadDevices();
        });
      }
    });
  }

  toggleDeviceStatus(device: Device): void {
    const flag = device.status == 'open';
    console.log('status+flag:', device.status, flag);
    const action = flag ? 'close' : 'open';
    this.deviceService.operateDevice(device.name, action).subscribe({
      next: () => {
        device.status = action;
        this.loadLogs();
      },
      error: (err) => {
        if (err.status === 503) this.espOnline = false;
        this.snackBar.open(err.error?.message || 'ESP is offline', 'Close', { duration: 5000 });
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.wsReconnectTimer);
    clearInterval(this.countdownInterval);
    this.ws?.close();
  }

  get netBatteryI(): number {
    return (this.sensorData?.load?.i ?? 0) - (this.sensorData?.panel?.i ?? 0);
  }

  refreshSensors(): void {
    this.refreshingSensors = true;
    this.deviceService.refreshSensors().subscribe({
      error: () => this.refreshingSensors = false
    });
    setTimeout(() => this.refreshingSensors = false, 5000);
  }

  private startCountdownInterval(): void {
    if (this.countdownInterval) return;
    this.countdownInterval = setInterval(() => {
      const now = Date.now();
      Object.keys(this.countdownEndTimes).forEach(name => {
        const remaining = Math.max(0, Math.floor((this.countdownEndTimes[name] - now) / 1000));
        if (remaining === 0) {
          delete this.countdownEndTimes[name];
          delete this.countdowns[name];
        } else {
          const m = Math.floor(remaining / 60);
          const s = remaining % 60;
          this.countdowns[name] = `${m}:${s.toString().padStart(2, '0')}`;
        }
      });
      if (Object.keys(this.countdownEndTimes).length === 0) {
        clearInterval(this.countdownInterval);
        this.countdownInterval = null;
      }
    }, 1000);
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws`);
    this.ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      this.zone.run(() => this.handleWebsocketMessage(data));
    };
    this.ws.onclose = () => {
      this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
    };
  }

  private handleWebsocketMessage(data: any): void {
    if (!data) return;
    if (data.type === 'espStatus') {
      this.espOnline = data.online;
      if (!data.online) this.sensorData = null;
      this.loadLogs();
      return;
    }
    if (data.type === 'sensorData') {
      this.sensorData = data;
      this.refreshingSensors = false;
      return;
    }
    if (data.type === 'timedRun') {
      this.countdownEndTimes[data.deviceName] = new Date(data.endTime).getTime();
      this.startCountdownInterval();
      return;
    }
    if (data.type === 'bulkDeviceStatus' && Array.isArray(data.devices)) {
      this.applyBulkStatusUpdate(data.devices);
      return;
    }
    if (data.deviceName && data.status) {
      if (data.status === 'close') {
        delete this.countdownEndTimes[data.deviceName];
        delete this.countdowns[data.deviceName];
      }
      this.devices.data = this.devices.data.map(device =>
        device.name === data.deviceName ? { ...device, status: data.status } : device
      );
      this.loadLogs();
    }
  }

  private applyBulkStatusUpdate(updates: { name: string; status: string }[]): void {
    if (!this.devices?.data?.length) {
      return;
    }
    const statusMap = updates.reduce((map, update) => {
      map.set(update.name, update.status);
      return map;
    }, new Map<string, string>());
    const refreshed = this.devices.data.map(device => {
      const newStatus = statusMap.get(device.name);
      return newStatus ? { ...device, status: newStatus } : device;
    });
    this.devices.data = refreshed;
    if (typeof this.devices._updateChangeSubscription === 'function') {
      this.devices._updateChangeSubscription();
    }
  }
}
