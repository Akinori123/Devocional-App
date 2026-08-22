import { differenceInCalendarDays, startOfYear } from 'date-fns';

const now = new Date();
const start = startOfYear(now);
const dayOfYear = differenceInCalendarDays(now, start);
console.log(dayOfYear);
