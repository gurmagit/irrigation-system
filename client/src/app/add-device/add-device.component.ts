import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Device } from '../models/device.model';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-add-device',
  templateUrl: './add-device.component.html',
  styleUrls: ['./add-device.component.css']
})
export class AddDeviceComponent {
  form!: FormGroup;
  newDevice: any = { name: '', schedules: [] };
  previousName: string | null = null;
  newSchedule: any = { startHour: '00', startMinute: 0, endHour: '00', endMinute: 0, days: [] };
  hours: string[] = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  days: string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    public dialogRef: MatDialogRef<AddDeviceComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {device: Device},
    public dialog: MatDialog,
    private fb: FormBuilder
  ) {
    this.previousName = data.device ? data.device.name : '';
    this.form = this.fb.group({
      name: [this.previousName],
      schedules: [data.device ? data.device.schedules : []]
    })
    this.newDevice = { ...this.form.value };
  }

  addSchedule(): void {
    const schedule = {
      startTime: this.newSchedule.startHour.padStart(2,'0') + ':' +
        String(this.newSchedule.startMinute).padStart(2,'0'),
      endTime: this.newSchedule.endHour.padStart(2,'0') + ':' +
        String(this.newSchedule.endMinute).padStart(2,'0'),
      days: [...this.newSchedule.days]
    };
    this.newDevice.schedules.push(schedule);
    this.newSchedule = { startHour: '00', startMinute: 0, endHour: '00', endMinute: 0, days: [] };
  }

  editSchedule(schedule: any, index: number): void {
    console.log('newDevice:', this.newDevice);
    this.newSchedule.startHour = schedule.startTime.split(':')[0];
    this.newSchedule.startMinute = parseInt(schedule.startTime.split(':')[1]);
    this.newSchedule.endHour = schedule.endTime.split(':')[0];
    this.newSchedule.endMinute = parseInt(schedule.endTime.split(':')[1]);
    this.newSchedule.days = schedule.days;
    this.newDevice.schedules.splice(index, 1);
  }

  removeSchedule(index: number): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: { message: 'Are you sure you want to delete this schedule?' }
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.newDevice.schedules.splice(index, 1);
      }
    });
  }

  isScheduleValid(): boolean {
    const startTotalMinute = +this.newSchedule.startHour * 60 + +this.newSchedule.startMinute;
    const endTotalMinute = +this.newSchedule.endHour * 60 + +this.newSchedule.endMinute;
    const sm = +this.newSchedule.startMinute;
    const em = +this.newSchedule.endMinute;
    return (
      this.newSchedule.startHour !== null &&
      this.newSchedule.endHour !== null &&
      sm >= 0 && sm <= 59 &&
      em >= 0 && em <= 59 &&
      this.newSchedule.days.length > 0 &&
      endTotalMinute > startTotalMinute
    );
  }

  isDeviceValid(): boolean {
    return this.newDevice.name.trim() !== '';
  }

  onSave(): void {
    if (this.isScheduleValid()) {
      this.addSchedule();
    }
    this.dialogRef.close({ device: this.newDevice, previousName: this.previousName });
  }

  onNoClick(): void {
    this.dialogRef.close();
  }
}
