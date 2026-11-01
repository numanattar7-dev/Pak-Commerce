// Accelerate retry worker cycles: pull each delivery's nextRetryAt to "now"
// so the 10s worker retries immediately, until attempts exhaust -> status FAILED.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/numan/pak-commerce/packages/database/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=?(.*)$/);
  if (m && m[1] === 'DATABASE_URL') process.env.DATABASE_URL = m[2].replace(/^"|"$/g, '');
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const hooks = await prisma.webhook.findMany({ where: { url: 'http://localhost:4005/fail' } });
  for (const h of hooks) {
    for (let i = 0; i < 15; i++) {
      await prisma.webhookDelivery.updateMany({
        where: { webhookId: h.id, status: 'PENDING' },
        data: { nextRetryAt: new Date() },
      });
      await new Promise((r) => setTimeout(r, 5000));
    }
    const d = await prisma.webhookDelivery.findMany({ where: { webhookId: h.id } });
    console.log(JSON.stringify(d.map((x) => ({ event: x.event, attempts: x.attempts, status: x.status, error: x.error, nextRetryAt: x.nextRetryAt })), null, 2));
  }
  await prisma.$disconnect();
})();
