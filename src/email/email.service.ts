import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger('EmailService');
  private emailUser: string;
  private emailPassword: string;

  constructor() {
    this.emailUser = process.env.EMAIL_USER || '';
    this.emailPassword = process.env.EMAIL_PASSWORD || '';

    // Initialize email transporter with Gmail
    if (this.emailUser && this.emailPassword) {
      try {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: this.emailUser,
            pass: this.emailPassword, // Use app-specific password for Gmail
          },
        });

        // Verify connection
        this.transporter.verify((error, success) => {
          if (error) {
            this.logger.error('Email service connection failed - falling back to development mode');
            this.logger.warn('Please check your Gmail app password at: https://myaccount.google.com/apppasswords');
            this.transporter = null; // Disable email on auth failure
          } else {
            this.logger.log('✓ Email service connected successfully');
          }
        });
      } catch (error) {
        this.logger.error('Error initializing email service:', error instanceof Error ? error.message : 'Unknown error');
        this.transporter = null;
      }
    } else {
      this.logger.warn('⚠️  Email credentials not configured. Running in development mode (codes logged to console)');
    }
  }

  async sendPasswordResetCode(toEmail: string, code: string): Promise<boolean> {
    try {
      // If email transporter is not configured, log to console in development
      if (!this.transporter) {
        // In development mode without email config, just log the code
        this.logger.log(`========================================`);
        this.logger.log(`📧 PASSWORD RESET CODE (Dev Mode)`);
        this.logger.log(`To: ${toEmail}`);
        this.logger.log(`Code: ${code}`);
        this.logger.log(`Expires: 10 minutes`);
        this.logger.log(`========================================`);
        return true;
      }

      const mailOptions = {
        from: `"BluePOS" <${this.emailUser}>`,
        to: toEmail,
        subject: 'Password Reset Verification Code',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2563eb; margin: 0;">BluePOS - Password Reset</h2>
            </div>
            <div style="background: #f8fafd; padding: 25px; border-radius: 12px; border-left: 4px solid #2563eb;">
              <p style="color: #0f172a; font-size: 16px; margin-top: 0;">Hello,</p>
              <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                You requested a password reset for your BluePOS account. Use the verification code below to proceed:
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <div style="background: white; border: 2px solid #2563eb; border-radius: 8px; padding: 20px; display: inline-block;">
                  <code style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px;">${code}</code>
                </div>
              </div>
              <p style="color: #ef4444; font-size: 13px; margin-bottom: 15px;">
                ⏰ This code expires in 10 minutes
              </p>
              <p style="color: #475569; font-size: 13px; line-height: 1.6;">
                If you didn't request this reset, please ignore this email. Your account is safe.
              </p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2024 BluePOS. All rights reserved.
              </p>
            </div>
          </div>
        `,
        text: `Your password reset code is: ${code}. This code expires in 10 minutes.`,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to ${toEmail}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${toEmail}:`, errorMessage);

      // Check if email doesn't exist or is invalid
      if (errorMessage.includes('Invalid email') || errorMessage.includes('550')) {
        throw new BadRequestException(
          `This email is not already registered. Please check your email address.`,
        );
      }

      throw new BadRequestException(
        'Failed to send verification code. Please try again later.',
      );
    }
  }

  async sendWelcomeEmail(toEmail: string, name: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email service not configured. Skipping welcome email.');
      return false;
    }

    try {
      const mailOptions = {
        from: `"BluePOS" <${this.emailUser}>`,
        to: toEmail,
        subject: 'Welcome to BluePOS!',
        html: `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #2563eb; margin: 0;">Welcome to BluePOS</h2>
            </div>
            <div style="background: #f8fafd; padding: 25px; border-radius: 12px;">
              <p style="color: #0f172a; font-size: 16px; margin-top: 0;">Hello ${name},</p>
              <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                Your BluePOS account has been successfully created. You can now login and start managing your sales.
              </p>
              <p style="color: #475569; font-size: 14px; line-height: 1.6;">
                If you have any questions, feel free to contact our support team.
              </p>
            </div>
          </div>
        `,
        text: `Welcome to BluePOS, ${name}! Your account is ready to use.`,
      };

      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Welcome email sent to ${toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${toEmail}:`, error.message);
      return false;
    }
  }
}
