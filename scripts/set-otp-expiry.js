// Utility: force a COD verification's expiresAt (offsetSeconds can be negative)
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/numan/pak-commerce/packages/database/.env', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=?(.*)$/);
  if (m && m[1] === 'DATABASE_URL') process.env.DATABASE_URL = m[2].replace(/^"|"$/g, '');
}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const [orderId, offsetSeconds] = process.argv.slice(2);
  const expiresAt = new Date(Date.now() + Number(offsetSeconds) * 1000);
  await prisma.codVerification.update({
    where: { orderId },
    data: { expiresAt },
  });
  console.log(`expiresAt set to ${expiresAt.toISOString()} (offset ${offsetSeconds}s)`);
  await prisma.$disconnect();
})();
