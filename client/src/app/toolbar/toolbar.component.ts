import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { DeviceService } from '../services/device.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { UserManagementComponent } from '../user-management/user-management.component';

@Component({
  selector: 'app-toolbar',
  templateUrl: './toolbar.component.html',
  styleUrls: ['./toolbar.component.css']
})
export class ToolbarComponent implements OnInit {
  nightMode = { enabled: false, start: '00:00', end: '05:00' };
  pulseMs = 50;

  constructor(
    public authService: AuthService,
    private deviceService: DeviceService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.deviceService.getNightMode().subscribe(nm => this.nightMode = nm);
    this.deviceService.getPulseMs().subscribe(({ pulse_ms }) => this.pulseMs = pulse_ms);
  }

  onPulseMsChange(): void {
    if (this.pulseMs < 20 || this.pulseMs > 2000) return;
    this.deviceService.setPulseMs(this.pulseMs).subscribe({
      error: () => this.snackBar.open('Failed to save pulse duration', 'Close', { duration: 3000 })
    });
  }

  onNightModeChange(): void {
    this.deviceService.setNightMode(this.nightMode).subscribe({
      error: () => this.snackBar.open('Failed to save night mode', 'Close', { duration: 3000 })
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  resetStatuses(): void {
    this.deviceService.resetAllStatuses().subscribe();
  }

  manageUsers(): void {
    this.dialog.open(UserManagementComponent, { width: '400px' });
  }
}
