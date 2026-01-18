/**
 * Notification Service
 * Provides email, SMS, and webhook notification capabilities
 */

import nodemailer, { Transporter } from 'nodemailer';
import axios from 'axios';
import { logger } from '../config/logger.js';
import { TIMEOUTS, HTTP_STATUS } from '../config/constants.js';
import type {
  NotificationService as INotificationService,
  EmailOptions,
  SmsOptions,
  WebhookOptions,
} from '../types/job.types.js';

export class NotificationService implements INotificationService {
  private emailTransporter: Transporter | null = null;
  private emailConfigured = false;

  constructor() {
    this.initializeEmailTransporter();
  }

  /**
   * Initialize email transporter if SMTP settings are configured
   */
  private initializeEmailTransporter(): void {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    // Note: SMTP_FROM is used directly via process.env.SMTP_FROM in the email method

    if (smtpHost && smtpPort && smtpUser && smtpPass) {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort, 10),
          secure: parseInt(smtpPort, 10) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        this.emailConfigured = true;
        logger.info('Email notifications configured', { host: smtpHost, port: smtpPort });
      } catch (error: any) {
        logger.error('Failed to initialize email transporter:', error);
        this.emailConfigured = false;
      }
    } else {
      logger.warn('Email notifications not configured - missing SMTP settings');
      this.emailConfigured = false;
    }
  }

  /**
   * Send email notification
   */
  async email(options: EmailOptions): Promise<void> {
    if (!this.emailConfigured || !this.emailTransporter) {
      throw new Error('Email notifications not configured. Please set SMTP environment variables.');
    }

    const { to, subject, body, html } = options;

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@nxforge.local',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        text: body,
        html: html || body,
      };

      const info = await this.emailTransporter.sendMail(mailOptions);

      logger.info('Email sent successfully', {
        to: mailOptions.to,
        subject,
        messageId: info.messageId,
      });
    } catch (error: any) {
      logger.error('Failed to send email:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send SMS notification
   * Note: This is a placeholder implementation. In production, integrate with
   * SMS providers like Twilio, AWS SNS, or similar services.
   */
  async sms(options: SmsOptions): Promise<void> {
    const { to, message } = options;

    // Check if SMS provider is configured
    const smsProvider = process.env.SMS_PROVIDER;
    const smsApiKey = process.env.SMS_API_KEY;

    if (!smsProvider || !smsApiKey) {
      throw new Error('SMS notifications not configured. Please set SMS_PROVIDER and SMS_API_KEY.');
    }

    try {
      // Placeholder for SMS provider integration
      // In production, implement actual SMS provider logic here
      logger.info('SMS notification would be sent', { to, message, provider: smsProvider });

      // Example Twilio-like implementation:
      // const response = await axios.post('https://api.twilio.com/2010-04-01/Accounts/.../Messages.json', {
      //   To: to,
      //   From: process.env.SMS_FROM,
      //   Body: message
      // }, {
      //   auth: {
      //     username: process.env.TWILIO_ACCOUNT_SID,
      //     password: process.env.TWILIO_AUTH_TOKEN
      //   }
      // });

      logger.warn('SMS sending is not fully implemented - add your SMS provider integration');
    } catch (error: any) {
      logger.error('Failed to send SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Send webhook notification
   */
  async webhook(options: WebhookOptions): Promise<void> {
    const { url, payload, method = 'POST', headers = {} } = options;

    try {
      const response = await axios({
        method,
        url,
        data: method !== 'GET' ? payload : undefined,
        params: method === 'GET' ? payload : undefined,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NxForge/1.0',
          ...headers,
        },
        timeout: TIMEOUTS.HTTP_REQUEST,
        validateStatus: (status) => status >= HTTP_STATUS.OK && status < HTTP_STATUS.BAD_REQUEST,
      });

      logger.info('Webhook sent successfully', {
        url,
        method,
        status: response.status,
      });
    } catch (error: any) {
      logger.error('Failed to send webhook:', error);

      const errorMessage = error.response
        ? `Webhook failed with status ${error.response.status}: ${error.response.statusText}`
        : `Webhook failed: ${error.message}`;

      throw new Error(errorMessage);
    }
  }

  /**
   * Send notification to multiple channels
   */
  async sendMulti(channels: {
    email?: EmailOptions;
    sms?: SmsOptions;
    webhook?: WebhookOptions;
  }): Promise<void> {
    const promises: Promise<void>[] = [];

    if (channels.email) {
      promises.push(this.email(channels.email));
    }

    if (channels.sms) {
      promises.push(this.sms(channels.sms));
    }

    if (channels.webhook) {
      promises.push(this.webhook(channels.webhook));
    }

    await Promise.all(promises);
  }

  /**
   * Check if email is configured
   */
  isEmailConfigured(): boolean {
    return this.emailConfigured;
  }

  /**
   * Verify email connection
   */
  async verifyEmailConnection(): Promise<boolean> {
    if (!this.emailTransporter) {
      return false;
    }

    try {
      await this.emailTransporter.verify();
      return true;
    } catch (error) {
      logger.error('Email verification failed:', error);
      return false;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      emailConfigured: this.emailConfigured,
      smsConfigured: !!(process.env.SMS_PROVIDER && process.env.SMS_API_KEY),
    };
  }
}

// Singleton instance
export const notificationService = new NotificationService();
