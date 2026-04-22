import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

type SampleUser = {
  slackUserId: string;
  displayName: string;
  email: string;
};

type AttendanceStatus = 'WFO' | 'WFH' | '-1' | '-0.5';

const sampleUsers: SampleUser[] = [
  { slackUserId: 'U_SAMPLE_RAHUL', displayName: 'Rahul Singh', email: 'rahul.singh@example.com' },
  { slackUserId: 'U_SAMPLE_AAYUSH', displayName: 'Aayush Bajaj', email: 'aayush.bajaj@example.com' },
  { slackUserId: 'U_SAMPLE_ABDUS', displayName: 'Abdus Samad', email: 'abdus.samad@example.com' },
  { slackUserId: 'U_SAMPLE_AKSHIL', displayName: 'Akhil D', email: 'akhil.d@example.com' },
  { slackUserId: 'U_SAMPLE_AMAN', displayName: 'Aman Singh', email: 'aman.singh@example.com' }
];

const sampleProjects = ['Aerchain', 'Cashflo', 'Haptik JioPOD', 'Roambee', 'Flipspaces', 'FastBar'];

function toDate(dateYmd: string): Date {
  return new Date(`${dateYmd}T00:00:00.000Z`);
}

function buildDates(month: string): string[] {
  const [year, monthNum] = month.split('-').map(Number);
  const end = new Date(year, monthNum || 1, 0);
  const dates: string[] = [];
  for (let day = 1; day <= end.getDate(); day += 1) {
    const current = new Date(year, (monthNum || 1) - 1, day);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
  }
  return dates;
}

function isWeekend(dateYmd: string): boolean {
  const date = new Date(`${dateYmd}T00:00:00`);
  const day = date.getDay();
  return day === 0 || day === 6;
}

function statusFor(userIndex: number, dateYmd: string): AttendanceStatus | null {
  const day = Number(dateYmd.slice(8));
  if (isWeekend(dateYmd)) {
    return null;
  }

  if (day === 3) {
    return '-1';
  }

  if ((day + userIndex) % 11 === 0) {
    return '-0.5';
  }

  return (day + userIndex) % 2 === 0 ? 'WFO' : 'WFH';
}

function projectsFor(status: AttendanceStatus, day: number, userIndex: number): string[] {
  if (status === '-1') {
    return [];
  }
  if (status === '-0.5') {
    return [sampleProjects[(day + userIndex) % sampleProjects.length]];
  }
  const first = sampleProjects[(day + userIndex) % sampleProjects.length];
  const second = sampleProjects[(day + userIndex + 2) % sampleProjects.length];
  if (first === second) {
    return [first];
  }
  return [first, second];
}

async function ensureUsers(): Promise<Array<{ id: bigint; slackUserId: string; displayName: string | null }>> {
  for (const user of sampleUsers) {
    await prisma.user.upsert({
      where: { slackUserId: user.slackUserId },
      update: {
        displayName: user.displayName,
        email: user.email,
        isMessageEnabled: true,
        active: true
      },
      create: {
        slackUserId: user.slackUserId,
        displayName: user.displayName,
        email: user.email,
        isMessageEnabled: true,
        active: true
      }
    });
  }

  return prisma.user.findMany({
    where: { slackUserId: { in: sampleUsers.map((user) => user.slackUserId) } },
    select: { id: true, slackUserId: true, displayName: true }
  });
}

async function ensureProjects(): Promise<void> {
  for (const projectName of sampleProjects) {
    await prisma.project.upsert({
      where: { name: projectName },
      update: { active: true },
      create: { name: projectName, active: true }
    });
  }
}

async function seedSampleMonth(month: string): Promise<void> {
  const [users] = await Promise.all([ensureUsers(), ensureProjects()]);
  const dates = buildDates(month);
  let attendanceCount = 0;
  let projectCount = 0;

  for (const [userIndex, user] of users.entries()) {
    for (const dateYmd of dates) {
      const status = statusFor(userIndex, dateYmd);
      const date = toDate(dateYmd);

      if (!status) {
        continue;
      }

      await prisma.attendanceEntry.upsert({
        where: {
          userId_dateYmd: {
            userId: user.id,
            dateYmd: date
          }
        },
        update: { status, updatedAt: new Date() },
        create: {
          userId: user.id,
          dateYmd: date,
          status
        }
      });
      attendanceCount += 1;

      const day = Number(dateYmd.slice(8));
      const projects = projectsFor(status, day, userIndex);
      await prisma.projectEntry.deleteMany({
        where: { userId: user.id, dateYmd: date }
      });
      if (projects.length) {
        await prisma.projectEntry.createMany({
          data: projects.map((projectName, index) => ({
            userId: user.id,
            dateYmd: date,
            slotIndex: index + 1,
            projectName
          }))
        });
        projectCount += projects.length;
      }
    }
  }

  logger.info({ month, users: users.length, attendanceCount, projectCount }, 'Seeded sample analytics data');
}

void seedSampleMonth('2026-04')
  .catch((error: Error) => {
    logger.error({ error: error.message }, 'Failed to seed sample analytics data');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
