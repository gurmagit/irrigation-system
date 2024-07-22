import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  username: string = '';
  password: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  login(): void {
    this.authService.login(this.username, this.password).subscribe({
      next: (res) => {
        localStorage.setItem('auth_token', res.token);
        this.router.navigate(['devices']);
      },
      error: (err) => {
        console.error('Login error:', err);
        this.snackBar.open(err.error.message || 'Invalid username or password', 'Close', { duration: 3000 });
      }
    });
  }
}
