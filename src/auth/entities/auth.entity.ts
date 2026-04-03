
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad
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

  @Column({ type: 'enum', enum: ['active', 'inactive'], default: 'inactive' })
  status: 'active' | 'inactive';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Track original password to detect changes
  private originalPassword: string;

  @AfterLoad()
  trackOriginalPassword() {
    this.originalPassword = this.password;
  }

  @BeforeInsert()
  async hashPasswordOnInsert() {
    if (this.password && !this.isPasswordHashed(this.password)) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  @BeforeUpdate()
  async hashPasswordOnUpdate() {
    // Only hash if password was actually changed (and not already hashed)
    if (this.password && this.password !== this.originalPassword && !this.isPasswordHashed(this.password)) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  private isPasswordHashed(password: string): boolean {
    // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2x$)
    return /^\$2[aby]\$\d{2}\$./.test(password);
  }
}