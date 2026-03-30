import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { ymdToDate } from '../../utils/date-ymd';

export type OverrideAuditInput = {
  overrideType: 'attendance' | 'projects';
  slackUserId: string;
  dateYmd: string;
  payloadJson: Record<string, unknown>;
  actorId: string;
};

export class OverrideAuditRepository {
  async insertAudit(input: OverrideAuditInput): Promise<void> {
    await prisma.manualOverrideAudit.create({
      data: {
        overrideType: input.overrideType,
        slackUserId: input.slackUserId,
        dateYmd: ymdToDate(input.dateYmd),
        payloadJson: input.payloadJson as Prisma.InputJsonValue,
        actorId: input.actorId
      }
    });
  }

  async countByDate(dateYmd: string): Promise<number> {
    return prisma.manualOverrideAudit.count({
      where: { dateYmd: ymdToDate(dateYmd) }
    });
  }
}
