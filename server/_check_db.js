const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.connection.findMany()
    .then(r => console.log(JSON.stringify(r, null, 2)))
    .finally(() => p.$disconnect());
