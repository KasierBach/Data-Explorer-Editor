import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ConnectionsService } from '../connections/connections.service';
import { DatabaseStrategyFactory } from '../database-strategies';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SearchService.name);
    private redis: Redis;

    constructor(
        private readonly configService: ConfigService,
        private readonly connectionsService: ConnectionsService,
        private readonly strategyFactory: DatabaseStrategyFactory,
        private readonly notificationsService: NotificationsService,
    ) { }

    onModuleInit() {
        const redisUrl = this.configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        this.redis = new Redis(redisUrl);
    }

    onModuleDestroy() {
        this.redis.quit();
    }

    private getIndexKey(userId: string) {
        return `search_index:${userId}`;
    }

    async syncIndex(userId: string) {
        const connections = await this.connectionsService.findAll(userId);
        const indexKey = this.getIndexKey(userId);

        // Clear existing index for this user
        await this.redis.del(indexKey);

        for (const conn of connections) {
            try {
                this.logger.log(`Indexing connection: ${conn.name} (${conn.id})`);
                const strategy = this.strategyFactory.getStrategy(conn.type);
                const pool = await this.connectionsService.getPool(conn.id, undefined, userId);
                
                // Get all schemas
                const schemas = await strategy.getSchemas(pool);
                
                for (const schema of schemas) {
                    const schemaParts = schema.id.split('.schema:');
                    const schemaName = schemaParts[schemaParts.length - 1];
                    const dbName = schema.id.split('.schema:')[0].replace('db:', '');

                    const tables = await strategy.getTables(pool, schemaName, dbName);
                    const views = await strategy.getViews(pool, schemaName, dbName);
                    
                    const items = [...tables, ...views].map(node => ({
                        id: node.id,
                        name: node.name,
                        type: node.type,
                        connectionId: conn.id,
                        connectionName: conn.name,
                        database: dbName,
                        schema: schemaName
                    }));

                    if (items.length > 0) {
                        await this.redis.sadd(indexKey, ...items.map(i => JSON.stringify(i)));
                    }
                }
            } catch (err) {
                this.logger.error(`Failed to index connection ${conn.id}: ${err.message}`);
            }
        }

        await this.notificationsService.emit(
            userId,
            'success',
            `Global search index synced for ${connections.length} connections.`
        );

        return { success: true, message: 'Sync completed' };
    }

    async search(userId: string, query: string) {
        const indexKey = this.getIndexKey(userId);
        const allItems = await this.redis.smembers(indexKey);
        
        const q = query.toLowerCase();
        return allItems
            .map(item => JSON.parse(item))
            .filter(item => item.name.toLowerCase().includes(q) || (item.schema && item.schema.toLowerCase().includes(q)))
            .slice(0, 50); // Limit to 50 results
    }
}
