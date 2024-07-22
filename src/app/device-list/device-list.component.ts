import { Component, OnInit } from '@angular/core';
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
export class DeviceListComponent implements OnInit {
  devices = new MatTableDataSource<Device>;
  displayedColumns = ['name', 'status', 'schedules', 'action'];
  private ws!: WebSocket;

  constructor(
    private deviceService: DeviceService,
    public dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDevices();
    this.ws = new WebSocket('ws://localhost:3001');
    this.ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      console.log('websocket message:', data);
      this.devices.data.forEach(device => {
        if (device.name == data.deviceName && device.status != data.status) {
          device.status = data.status;
        }
      })
    };
  }

  loadDevices(): void {
    this.deviceService.getDevices().subscribe(devices => {
      this.devices = new MatTableDataSource(devices);
    });
  }

  addDevice(): void {
    const dialogRef = this.dialog.open(AddDeviceComponent, {
      width: '400px',
      data: { device: null }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
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

  deleteDevice(name: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '250px',
      data: { message: `Are you sure you want to delete ${name}?` }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.deviceService.deleteDevice(name).subscribe(() => {
          this.loadDevices();
        });
      }
    });
  }

  toggleDeviceStatus(device: Device): void {
    const flag = device.status == 'open';
    console.log('status+flag:', device.status, flag);
    const action = flag ? 'close' : 'open';
    this.deviceService.operateDevice(device.name, action).subscribe(res => {
      console.log('response:', res);
      if (res.status == 'success') {
        const data = res.data;
        if (data.pin != flag && `valve${data.valve}` == device.name) {
          device.status = action;
          console.log('current status:', device.status);
        }
      }
    });
  }
}
