import { db } from './db';

export async function logAudit(
  userId: string,
  action: string,
  entity: string,
  entityId?: string,
  changes?: Record<string, any>,
  details?: string,
  txClient?: any // عميل معاملة اختياري — لتسجيل التدقيق داخل نفس معاملة العملية (اتصال واحد)
): Promise<void> {
  try {
    await (txClient || db).auditLog.create({
      data: {
        userId,
        action,
        entity,
        entityId: entityId || null,
        changes: changes ? JSON.stringify(changes) : null,
        details: details || null,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
