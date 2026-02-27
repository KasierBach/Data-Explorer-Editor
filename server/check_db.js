const fs = require('fs');
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const connections = await prisma.connection.findMany();
    fs.writeFileSync('out.json', JSON.stringify(connections, null, 2), 'utf-8');
}

main().finally(() => prisma.$disconnect());
