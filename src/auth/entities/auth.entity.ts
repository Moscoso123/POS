
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import * as bcrypt from 'bcrypt';

export enum UserType {
  ADMIN = 'admin',
  STAFF = 'staff'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 20 })
  phoneNumber: string;

  @Column({ length: 255 })
  password: string;

  @Column({ length: 255 })
  businessName: string;

  @Column({ length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: UserType
  })
  userType: UserType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profilePic: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.password) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }
}