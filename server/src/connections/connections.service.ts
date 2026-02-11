import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateConnectionDto } from './dto/create-connection.dto';
import { UpdateConnectionDto } from './dto/update-connection.dto';
import { Connection } from './entities/connection.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ConnectionsService {
  private connections: Connection[] = [];

  create(createConnectionDto: CreateConnectionDto): Connection {
    const newConnection: Connection = {
      id: uuidv4(),
      ...createConnectionDto,
      createdAt: new Date(),
    };
    this.connections.push(newConnection);
    return newConnection;
  }

  findAll(): Connection[] {
    return this.connections;
  }

  findOne(id: string): Connection {
    const connection = this.connections.find(c => c.id === id);
    if (!connection) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }
    return connection;
  }

  update(id: string, updateConnectionDto: UpdateConnectionDto): Connection {
    const index = this.connections.findIndex(c => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }

    const updatedConnection = {
      ...this.connections[index],
      ...updateConnectionDto,
    };

    this.connections[index] = updatedConnection;
    return updatedConnection;
  }

  remove(id: string): void {
    const index = this.connections.findIndex(c => c.id === id);
    if (index === -1) {
      throw new NotFoundException(`Connection with ID ${id} not found`);
    }
    this.connections.splice(index, 1);
  }
}
