import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Human-readable per-status templates (English, Pakistan-addressed)
export const ORDER_STATUS_MESSAGES: Record<string, (info: StatusInfo) => string> = {
  PENDING: (i) =>
    `Order ${i.orderNumber} received! Thank you for shopping with us. It is being prepared for confirmation and dispatch.`,
  VERIFIED: (i) =>
    `Order ${i.orderNumber} has been verified and confirmed. We are preparing your parcel.`,
  PROCESSING: (i) =>
    `Order ${i.orderNumber} is being packed. We will notify you as soon as it ships.`,
  DISPATCHED: (i) =>
    i.trackingNumber
      ? `Great news! Order ${i.orderNumber} has shipped via ${i.carrier || 'courier'}. Tracking number: ${i.trackingNumber}. Track it any time.`
      : `Great news! Order ${i.orderNumber} has shipped and is on its way to you.`,
  DELIVERED: (i) =>
    `Order ${i.orderNumber} has been delivered. We hope you love it! If anything is wrong, contact support for an exchange or refund.`,
  CANCELLED: (i) =>
    `Order ${i.orderNumber} has been cancelled${i.reason ? ` (${i.reason})` : ''}. If you paid online, the refund will reach you within 5-7 business days.`,
  RTO: (i) =>
    `Order ${i.orderNumber} could not be delivered and has been returned to the merchant (RTO). Please contact the store for a re-attempt.`,
};

export interface StatusInfo {
  orderNumber: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  reason?: string | null;
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
    this.twilioWhatsAppNumber =
      this.configService.get('TWILIO_WHATSAPP_NUMBER') || 'whatsapp:+14155238886';
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

  private isSimulation(): boolean {
    return !this.twilioAccountSid || !this.twilioAuthToken;
  }

  private async sendTwilioMessage(
    channel: 'sms' | 'whatsapp',
    phone: string,
    message: string,
  ): Promise<NotificationResult> {
    const formattedPhone = this.formatPakistaniPhone(phone);
    const to =
      channel === 'whatsapp' ? `whatsapp:${formattedPhone}` : formattedPhone;
    const from =
      channel === 'whatsapp' ? this.twilioWhatsAppNumber : this.twilioPhoneNumber;

    if (this.isSimulation()) {
      this.logger.log(
        `[${channel.toUpperCase()} SIMULATION] To: ${to} | Text: ${message}`,
      );
      return { success: true, messageId: `sim-${channel}-${Date.now()}` };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      const authHeader = `Basic ${Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64')}`;

      const params = new URLSearchParams();
      params.append('To', to);
      params.append('From', from);
      params.append('Body', message);

      const response = await firstValueFrom(
        this.httpService.post(url, params.toString(), {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      this.logger.log(`[${channel.toUpperCase()} SENT] delivered to ${to}`);
      return { success: true, messageId: (response.data as any)?.sid };
    } catch (error: any) {
      this.logger.error(
        `[${channel.toUpperCase()} FAILED] To: ${to} - ${error.message}`,
      );
      return { success: false, error: error.message };
    }
  }

  // ------------------------------------------------------
  // COD OTP (English)
  // ------------------------------------------------------

  async sendOtpSms(
    phone: string,
    otp: string,
    orderNumber: string,
  ): Promise<NotificationResult> {
    const message =
      `Pak Commerce: your COD verification code for order ${orderNumber} is ${otp}. ` +
      `It expires in 5 minutes. Do not share this code with anyone.`;
    return this.sendTwilioMessage('sms', phone, message);
  }

  async sendWhatsAppOtp(
    phone: string,
    otp: string,
    orderNumber: string,
  ): Promise<NotificationResult> {
    const message =
      `*Pak Commerce - Order Verification*\n\n` +
      `Your COD verification code for order *${orderNumber}*:\n\n` +
      `*${otp}*\n\n` +
      `This code expires in 5 minutes. Enter it on the website to confirm your order. Do not share it with anyone.`;
    return this.sendTwilioMessage('whatsapp', phone, message);
  }

  // ------------------------------------------------------
  // Order status updates (English, SMS + WhatsApp)
  // ------------------------------------------------------

  async sendOrderStatusSms(
    phone: string,
    info: StatusInfo,
    status: string,
  ): Promise<NotificationResult> {
    const builder = ORDER_STATUS_MESSAGES[status];
    const message = builder
      ? `Pak Commerce: ${builder(info)}`
      : `Pak Commerce: order ${info.orderNumber} status updated to ${status}.`;
    return this.sendTwilioMessage('sms', phone, message);
  }

  async sendOrderStatusWhatsApp(
    phone: string,
    info: StatusInfo,
    status: string,
  ): Promise<NotificationResult> {
    const builder = ORDER_STATUS_MESSAGES[status];
    const message = builder
      ? builder(info)
      : `Order *${info.orderNumber}* status updated to ${status}.`;
    return this.sendTwilioMessage('whatsapp', phone, message);
  }

  // Both channels at once, failures never propagate to domain flows
  async notifyStatusUpdate(
    phone: string,
    status: string,
    info: StatusInfo,
  ): Promise<void> {
    const results = await Promise.allSettled([
      this.sendOrderStatusSms(phone, info, status),
      this.sendOrderStatusWhatsApp(phone, info, status),
    ]);
    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.warn(`[Status notify] channel error: ${(r.reason as Error)?.message}`);
      }
    }
  }
}
