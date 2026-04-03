import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage } from './entities/chat.entity';
import { User } from '../auth/entities/auth.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async sendMessage(senderId: string, receiverId: string, message: string) {
    try {
      // Validate both IDs exist and are valid
      console.log('💬 Chat Service - sendMessage:', { senderId, receiverId, message });
      
      if (!senderId || !receiverId || senderId === receiverId) {
        throw new Error('Invalid sender or receiver ID');
      }

      if (!message || message.trim().length === 0) {
        throw new Error('Message cannot be empty');
      }

      // Verify both users exist in database
      const sender = await this.userRepository.findOne({ where: { id: senderId } });
      if (!sender) {
        throw new Error(`Sender user not found: ${senderId}`);
      }

      const receiver = await this.userRepository.findOne({ where: { id: receiverId } });
      if (!receiver) {
        throw new Error(`Receiver user not found: ${receiverId}`);
      }

      const chatMessage = this.chatRepository.create({
        senderId,
        receiverId,
        message: message.trim(),
        isRead: false,
      });
      
      console.log('💬 Chat Service - Creating message:', chatMessage);
      const saved = await this.chatRepository.save(chatMessage);
      console.log('💬 Chat Service - Message saved:', saved);
      return { success: true, data: saved };
    } catch (error) {
      console.error('💬 Chat Service Error:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  async getConversation(userId: string, otherUserId: string, limit: number = 50) {
    try {
      const messages = await this.chatRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('(msg.senderId = :userId AND msg.receiverId = :otherUserId) OR (msg.senderId = :otherUserId AND msg.receiverId = :userId)', 
          { userId, otherUserId })
        .orderBy('msg.createdAt', 'ASC')
        .take(limit)
        .getMany();
      return messages;
    } catch (error) {
      throw new Error(`Failed to get conversation: ${error.message}`);
    }
  }

  async getContacts(userId: string) {
    try {
      console.log('💬 Chat Service - getContacts for user:', userId);
      
      // Verify user exists
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        console.warn('💬 User not found:', userId);
        return [];
      }

      const messages = await this.chatRepository
        .createQueryBuilder('msg')
        .leftJoinAndSelect('msg.sender', 'sender')
        .leftJoinAndSelect('msg.receiver', 'receiver')
        .where('msg.senderId = :userId OR msg.receiverId = :userId', { userId })
        .orderBy('msg.createdAt', 'DESC')
        .getMany();

      const contactMap = new Map();
      messages.forEach((msg) => {
        const contactId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        if (!contactMap.has(contactId)) {
          contactMap.set(contactId, msg);
        }
      });

      console.log('💬 Found contacts:', contactMap.size);
      return Array.from(contactMap.values());
    } catch (error) {
      console.error('💬 Error in getContacts:', error);
      throw new Error(`Failed to get contacts: ${error.message}`);
    }
  }

  async markAsRead(messageId: string) {
    try {
      await this.chatRepository.update(messageId, { isRead: true });
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to mark as read: ${error.message}`);
    }
  }

  async getUnreadCount(userId: string) {
    try {
      const count = await this.chatRepository.count({
        where: { receiverId: userId, isRead: false },
      });
      return count;
    } catch (error) {
      throw new Error(`Failed to get unread count: ${error.message}`);
    }
  }
}
