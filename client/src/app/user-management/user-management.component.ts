import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit {
  users: { username: string; role: string }[] = [];
  newUsername = '';
  newPassword = '';
  private url = '/api/auth';

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<{ username: string; role: string }[]>(`${this.url}/users`).subscribe(u => this.users = u);
  }

  addUser(): void {
    this.http.post(`${this.url}/users`, { username: this.newUsername, password: this.newPassword }).subscribe({
      next: () => {
        this.snackBar.open('User added', 'OK', { duration: 3000 });
        this.newUsername = '';
        this.newPassword = '';
        this.loadUsers();
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed', 'Close', { duration: 3000 })
    });
  }

  deleteUser(username: string): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '300px',
      data: { message: `Delete user "${username}"?` }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.http.delete(`${this.url}/users/${username}`).subscribe({
        next: () => {
          this.snackBar.open('User deleted', 'OK', { duration: 3000 });
          this.loadUsers();
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Failed', 'Close', { duration: 3000 })
      });
    });
  }

  isValid(): boolean {
    return this.newUsername.trim() !== '' && this.newPassword.trim() !== '';
  }
}
