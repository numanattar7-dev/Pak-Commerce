import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Prisma } from '@prisma/client';

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  returnUrl: string;
  callbackUrl: string;
  isSandbox: boolean;
}

export interface EasypaisaConfig {
  merchantId: string;
  password: string;
  storeId: string;
  returnUrl: string;
  callbackUrl: string;
  isSandbox: boolean;
}

export interface PaymentInitResponse {
  redirectUrl: string;
  transactionId: string;
  orderId: string;
}

@Injectable()
export class PaymentsService {
  private jazzCashConfig: JazzCashConfig;
  private easypaisaConfig: EasypaisaConfig;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.jazzCashConfig = {
      merchantId: this.configService.get('JAZZCASH_MERCHANT_ID') || 'MC12345',
      password: this.configService.get('JAZZCASH_PASSWORD') || 'password',
      integritySalt: this.configService.get('JAZZCASH_INTEGRITY_SALT') || 'salt',
      returnUrl: this.configService.get('JAZZCASH_RETURN_URL') || 'http://localhost:3001/payment/callback',
      callbackUrl: this.configService.get('JAZZCASH_CALLBACK_URL') || 'http://localhost:4000/payments/jazzcash/callback',
      isSandbox: this.configService.get('JAZZCASH_SANDBOX') === 'true' || true,
    };

    this.easypaisaConfig = {
      merchantId: this.configService.get('EASYPAISA_MERCHANT_ID') || 'EASY12345',
      password: this.configService.get('EASYPAISA_PASSWORD') || 'password',
      storeId: this.configService.get('EASYPAISA_STORE_ID') || 'STORE123',
      returnUrl: this.configService.get('EASYPAISA_RETURN_URL') || 'http://localhost:3001/payment/callback',
      callbackUrl: this.configService.get('EASYPAISA_CALLBACK_URL') || 'http://localhost:4000/payments/easypaisa/callback',
      isSandbox: this.configService.get('EASYPAISA_SANDBOX') === 'true' || true,
    };
  }

  // JazzCash Payment Integration
  async initializeJazzCashPayment(orderId: string): Promise<PaymentInitResponse> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const amountInPaisa = Math.round(Number(order.totalAmount) * 100);
    const ppTxnRefNo = `T${Date.now()}`;
    const ppTxnDateTime = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

    const postData = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: this.jazzCashConfig.merchantId,
      pp_SubMerchantID: '',
      pp_Password: this.jazzCashConfig.password,
      pp_BankID: 'TBANK',
      pp_ProductID: 'RETL',
      pp_TxnRefNo: ppTxnRefNo,
      pp_Amount: amountInPaisa.toString(),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: ppTxnDateTime,
      pp_BillReference: order.orderNumber,
      pp_Description: `Order ${order.orderNumber} - ${order.customerName}`,
      pp_TxnExpiryDateTime: '',
      pp_ReturnURL: this.jazzCashConfig.returnUrl,
      pp_CallbackURL: this.jazzCashConfig.callbackUrl,
      pp_SecureHash: '',
      ppmpf_1: order.customerPhone,
      ppmpf_2: order.customerEmail || '',
      ppmpf_3: order.shippingCity,
      ppmpf_4: '',
      ppmpf_5: '',
    };

    // Generate secure hash
    const sortedKeys = Object.keys(postData).sort();
    let hashString = this.jazzCashConfig.integritySalt + '&';
    for (const key of sortedKeys) {
      if (postData[key as keyof typeof postData]) {
        hashString += postData[key as keyof typeof postData] + '&';
      }
    }
    hashString = hashString.slice(0, -1);

    const crypto = require('crypto');
    const secureHash = crypto.createHmac('sha256', this.jazzCashConfig.integritySalt)
      .update(hashString)
      .digest('hex');

    postData.pp_SecureHash = secureHash;

    const baseUrl = this.jazzCashConfig.isSandbox
      ? 'https://sandbox.jazzcash.com.pk/Application/Api/Payment/DoTransaction'
      : 'https://payments.jazzcash.com.pk/Application/Api/Payment/DoTransaction';

    return {
      redirectUrl: `${baseUrl}?${new URLSearchParams(postData as any).toString()}`,
      transactionId: ppTxnRefNo,
      orderId: order.id,
    };
  }

  // Easypaisa Payment Integration
  async initializeEasypaisaPayment(orderId: string): Promise<PaymentInitResponse> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const amountInPaisa = Math.round(Number(order.totalAmount) * 100);
    const orderRefNum = `E${Date.now()}`;

    const postData = {
      storeId: this.easypaisaConfig.storeId,
      orderId: orderRefNum,
      amount: amountInPaisa.toString(),
      currency: 'PKR',
      postBackURL: this.easypaisaConfig.callbackUrl,
      callbackURL: this.easypaisaConfig.callbackUrl,
      redirectURL: this.easypaisaConfig.returnUrl,
      customerMobile: order.customerPhone,
      customerEmail: order.customerEmail || '',
      customerName: order.customerName,
      description: `Order ${order.orderNumber}`,
      merchantHashedReq: '',
    };

    // Generate hash for Easypaisa
    const hashString = `${postData.storeId}${postData.orderId}${postData.amount}${postData.currency}${postData.postBackURL}${this.easypaisaConfig.password}`;
    const crypto = require('crypto');
    const merchantHashedReq = crypto.createHash('sha256').update(hashString).digest('hex');
    postData.merchantHashedReq = merchantHashedReq;

    const baseUrl = this.easypaisaConfig.isSandbox
      ? 'https://sandbox.easypaisa.com.pk/epay/api/v1/payment/initiate'
      : 'https://easypaisa.com.pk/epay/api/v1/payment/initiate';

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ redirectUrl?: string }>(baseUrl, postData, {
          headers: { 'Content-Type': 'application/json' },
        })
      );

      if (response.data && response.data.redirectUrl) {
        return {
          redirectUrl: response.data.redirectUrl,
          transactionId: orderRefNum,
          orderId: order.id,
        };
      }
    } catch (error) {
      console.error('Easypaisa initialization error:', error);
    }

    // Fallback for sandbox/testing
    return {
      redirectUrl: `${baseUrl}?${new URLSearchParams(postData as any).toString()}`,
      transactionId: orderRefNum,
      orderId: order.id,
    };
  }

  // Process JazzCash callback
  async processJazzCashCallback(callbackData: any) {
    const { pp_TxnRefNo, pp_ResponseCode, pp_ResponseMessage, pp_AuthCode, pp_SecureHash } = callbackData;

    // Verify hash
    const sortedKeys = Object.keys(callbackData).sort();
    let hashString = this.jazzCashConfig.integritySalt + '&';
    for (const key of sortedKeys) {
      if (key !== 'pp_SecureHash' && callbackData[key]) {
        hashString += callbackData[key] + '&';
      }
    }
    hashString = hashString.slice(0, -1);

    const crypto = require('crypto');
    const expectedHash = crypto.createHmac('sha256', this.jazzCashConfig.integritySalt)
      .update(hashString)
      .digest('hex');

    if (expectedHash !== pp_SecureHash) {
      throw new BadRequestException('Invalid hash verification');
    }

    // Find order by transaction reference
    const order = await this.prisma.order.findFirst({
      where: { orderNumber: { contains: pp_TxnRefNo.replace('T', 'PK-') } },
    });

    if (!order) {
      throw new NotFoundException('Order not found for transaction');
    }

    const isSuccess = pp_ResponseCode === '000' || pp_ResponseCode === '00';

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isSuccess ? 'PAID' : 'FAILED',
        orderStatus: isSuccess ? 'VERIFIED' : 'PENDING',
      },
    });

    // If payment successful and was COD, update to paid
    if (isSuccess && order.paymentMethod === 'JAZZCASH') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { paymentStatus: 'PAID', orderStatus: 'VERIFIED' },
      });
    }

    return { success: isSuccess, orderId: order.id, message: pp_ResponseMessage };
  }

  // Process Easypaisa callback
  async processEasypaisaCallback(callbackData: any) {
    const { orderId, transactionId, status, responseCode, responseMessage, merchantHashedResp } = callbackData;

    // Verify hash
    const hashString = `${this.easypaisaConfig.storeId}${orderId}${transactionId}${status}${responseCode}${this.easypaisaConfig.password}`;
    const crypto = require('crypto');
    const expectedHash = crypto.createHash('sha256').update(hashString).digest('hex');

    if (expectedHash !== merchantHashedResp) {
      throw new BadRequestException('Invalid hash verification');
    }

    const order = await this.prisma.order.findFirst({
      where: { orderNumber: { contains: orderId.replace('E', 'PK-') } },
    });

    if (!order) {
      throw new NotFoundException('Order not found for transaction');
    }

    const isSuccess = status === 'success' && responseCode === '000';

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isSuccess ? 'PAID' : 'FAILED',
        orderStatus: isSuccess ? 'VERIFIED' : 'PENDING',
      },
    });

    return { success: isSuccess, orderId: order.id, message: responseMessage };
  }

  // Get payment method config for frontend
  getPaymentConfigs() {
    return {
      jazzcash: {
        merchantId: this.jazzCashConfig.merchantId,
        isSandbox: this.jazzCashConfig.isSandbox,
      },
      easypaisa: {
        merchantId: this.easypaisaConfig.merchantId,
        storeId: this.easypaisaConfig.storeId,
        isSandbox: this.easypaisaConfig.isSandbox,
      },
    };
  }
}