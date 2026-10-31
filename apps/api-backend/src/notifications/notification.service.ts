import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioPhoneNumber: string;
  private twilioWhatsAppNumber: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.twilioAccountSid = this.configService.get('TWILIO_ACCOUNT_SID') || '';
    this.twilioAuthToken = this.configService.get('TWILIO_AUTH_TOKEN') || '';
    this.twilioPhoneNumber = this.configService.get('TWILIO_PHONE_NUMBER') || '';
    this.twilioWhatsAppNumber = this.configService.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';
  }

  /**
   * Format a standard Pakistani phone number (e.g. 03001234567 -> +923001234567)
   */
  private formatPakistaniPhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('03') && cleaned.length === 11) {
      return `+92${cleaned.substring(1)}`;
    }
    if (cleaned.startsWith('92') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    return phone;
  }

  /**
   * Send COD verification OTP via SMS
   */
  async sendOtpSms(phone: string, otp: string, orderNumber: string): Promise<NotificationResult> {
    const formattedPhone = this.formatPakistaniPhone(phone);
    const message = `آپ کا پاک کامرس آرڈر ${orderNumber} کی تصدیق کے لیے OTP کوڈ ہے: ${otp}۔ برائے مہربانی یہ کوڈ کسی سے شیئر نہ کریں۔ (Pak Commerce)`;

    // Check if live SMS credentials configured
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      this.logger.log(`[SMS SIMULATION] To: ${formattedPhone} | Code: ${otp} | Text: ${message}`);
      return { success: true, messageId: `sim-sms-${Date.now()}` };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`;

      const params = new URLSearchParams();
      params.append('To', formattedPhone);
      params.append('From', this.twilioPhoneNumber);
      params.append('Body', message);

      const response = await firstValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      this.logger.log(`[SMS SENT] Successfully delivered to ${formattedPhone}`);
      return { success: true, messageId: (response.data as any)?.sid };
    } catch (error: any) {
      this.logger.error(`[SMS FAILED] To: ${formattedPhone} - ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send COD verification OTP & status update via WhatsApp
   */
  async sendWhatsAppOtp(phone: string, otp: string, orderNumber: string): Promise<NotificationResult> {
    const formattedPhone = this.formatPakistaniPhone(phone);
    const whatsappRecipient = `whatsapp:${formattedPhone}`;
    const message = `🇵🇰 *پاک کامرس - آرڈر تصدیق*\n\nمحترم کسٹمر، آپ کے آرڈر *${orderNumber}* کی تصدیق کے لیے OTP:\n\n🔑 *${otp}*\n\nبرائے مہربانی یہ کوڈ ویب سائٹ پر درج کر کے اپنا آرڈر کنفرم کریں۔ شکریہ!`;

    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      this.logger.log(`[WHATSAPP SIMULATION] To: ${whatsappRecipient} | Code: ${otp}`);
      return { success: true, messageId: `sim-wa-${Date.now()}` };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`;

      const params = new URLSearchParams();
      params.append('To', whatsappRecipient);
      params.append('From', this.twilioWhatsAppNumber);
      params.append('Body', message);

      const response = await firstValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      this.logger.log(`[WHATSAPP SENT] Successfully sent to ${whatsappRecipient}`);
      return { success: true, messageId: (response.data as any)?.sid };
    } catch (error: any) {
      this.logger.error(`[WHATSAPP FAILED] To: ${whatsappRecipient} - ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
