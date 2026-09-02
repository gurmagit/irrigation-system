import { Schedule } from './schedule.model';

export interface Device {
  name: string;
  status: string;
  schedules: Schedule[];
}