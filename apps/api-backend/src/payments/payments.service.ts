import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PaymentMethod, PaymentTxStatus, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import {
  InitiatePaymentDto,
  ListPaymentsQueryDto,
  SimulatePaymentDto,
  SubmitBankProofDto,
} from './dto';

/** Storefront route prefix that marks a simulated (sandbox) hosted checkout. */
const SIM_ROUTE = '/payment/';

type IntegrationCfg = { config: Record<string, string>; sandbox: boolean };

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private httpService: HttpService,
    private webhooksService: WebhooksService,
  ) {}

  // ------------------------------------------------------------
  // Public flows (storefront)
  // ------------------------------------------------------------

  /**
   * Start (or resume) a payment for an existing order.
   * Wallet methods (JAZZCASH/EASYPAISA) → hosted checkout redirect, or the
   * storefront SIMULATION page when no real credentials are configured.
   * Manual methods (IBFT/RAAST) → AWAITING_PROOF + instructions.
   */
  async initiatePublic(dto: InitiatePaymentDto) {
    const tenant = await this.tenantBySubdomain(dto.subdomain);
    const order = await this.findPublicOrder(tenant.id, dto.orderNumber, dto.phone);

    if (order.paymentMethod === 'COD') {
      throw new BadRequestException('Cash on delivery orders do not need online payment');
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('This order is already paid');
    }
    if (['CANCELLED', 'RTO'].includes(order.orderStatus)) {
      throw new BadRequestException('This order can no longer be paid');
    }

    const method = order.paymentMethod;
    const isWallet = method === 'JAZZCASH' || method === 'EASYPAISA';
    const integration = await this.getIntegration(tenant.id, method);
    const simulateWallet = !integration || integration.sandbox !== false;

    // Resume the most recent open attempt for this order+method
    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId: order.id,
        method,
        status: { in: ['INITIATED', 'AWAITING_PROOF'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (isWallet) {
      if (existing) {
        const wasSimulated = (existing.redirectUrl || '').includes(SIM_ROUTE);
        if (simulateWallet === wasSimulated) {
          let redirectUrl = existing.redirectUrl;
          if (simulateWallet) {
            // Rebuild the sandbox checkout URL so a changed STOREFRONT_URL
            // self-heals stale attempts (e.g. created before env vars were set)
            const fresh = `${this.storefrontUrl()}/payment/${existing.gatewayTxRef}?order=${encodeURIComponent(
              order.orderNumber,
            )}&phone=${encodeURIComponent(order.customerPhone)}`;
            if (fresh !== redirectUrl) {
              await this.prisma.payment.update({
                where: { id: existing.id },
                data: { redirectUrl: fresh },
              });
              redirectUrl = fresh;
            }
          }
          return {
            paymentId: existing.id,
            gatewayTxRef: existing.gatewayTxRef,
            method: existing.method,
            status: existing.status,
            amount: existing.amount,
            redirectUrl,
            instructions: null,
            simulation: simulateWallet,
          };
        }
        // Simulation mode changed since the last attempt — supersede it
        await this.prisma.payment.update({
          where: { id: existing.id },
          data: { status: 'FAILED', errorMessage: 'Superseded by a new payment attempt' },
        });
      }

      const gatewayTxRef = this.newGatewayTxRef(order.orderNumber, method);

      if (simulateWallet) {
        const redirectUrl = `${this.storefrontUrl()}/payment/${gatewayTxRef}?order=${encodeURIComponent(
          order.orderNumber,
        )}&phone=${encodeURIComponent(order.customerPhone)}`;
        const payment = await this.prisma.payment.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            method,
            status: 'INITIATED',
            amount: order.totalAmount,
            gatewayTxRef,
            redirectUrl,
          },
        });
        console.log(`[Payments] SIM ${method} checkout ready — order ${order.orderNumber} ref ${gatewayTxRef}`);
        return {
          paymentId: payment.id,
          gatewayTxRef,
          method,
          status: payment.status,
          amount: payment.amount,
          redirectUrl,
          instructions: null as string | null,
          simulation: true,
        };
      }

      // Real credentials are configured — drive the live gateway
      try {
        const init =
          method === 'JAZZCASH'
            ? this.requestJazzCash(order, integration!, gatewayTxRef)
            : await this.requestEasypaisa(order, integration!, gatewayTxRef);
        const payment = await this.prisma.payment.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            method,
            status: 'INITIATED',
            amount: order.totalAmount,
            gatewayTxRef,
            providerRef: init.providerRef,
            redirectUrl: init.redirectUrl,
          },
        });
        console.log(`[Payments] ${method} hosted checkout — order ${order.orderNumber} ref ${gatewayTxRef}`);
        return {
          paymentId: payment.id,
          gatewayTxRef,
          method,
          status: 'INITIATED' as PaymentTxStatus,
          amount: payment.amount,
          redirectUrl: init.redirectUrl,
          instructions: null as string | null,
          simulation: false,
        };
      } catch (err: any) {
        const message = `Could not start ${method} payment: ${err?.message || 'gateway error'}`;
        const payment = await this.prisma.payment.create({
          data: {
            tenantId: tenant.id,
            orderId: order.id,
            method,
            status: 'FAILED',
            amount: order.totalAmount,
            gatewayTxRef,
            errorMessage: message,
          },
        });
        void this.webhooksService.dispatchEvent(tenant.id, 'payment.failed', {
          orderNumber: order.orderNumber,
          gatewayTxRef: payment.gatewayTxRef,
          method,
          amount: order.totalAmount,
          error: message,
        });
        throw new BadRequestException(message);
      }
    }

    // Manual methods — IBFT / RAAST: instructions (from integration settings or demo) + proof
    const instructions = this.instructionsFor(
      method as 'IBFT' | 'RAAST',
      integration ? integration.config : null,
      order.totalAmount,
    );

    if (existing && existing.status === 'AWAITING_PROOF') {
      const refreshed = await this.prisma.payment.update({
        where: { id: existing.id },
        data: { instructions },
      });
      return {
        paymentId: refreshed.id,
        gatewayTxRef: refreshed.gatewayTxRef,
        method: refreshed.method,
        status: refreshed.status,
        amount: refreshed.amount,
        redirectUrl: refreshed.redirectUrl,
        instructions,
        simulation: false,
      };
    }

    const payment = await this.prisma.payment.create({
      data: {
        tenantId: tenant.id,
        orderId: order.id,
        method,
        status: 'AWAITING_PROOF',
        amount: order.totalAmount,
        gatewayTxRef: this.newGatewayTxRef(order.orderNumber, method),
        instructions,
      },
    });
    console.log(`[Payments] ${method} instructions issued — order ${order.orderNumber} ref ${payment.gatewayTxRef}`);
    return {
      paymentId: payment.id,
      gatewayTxRef: payment.gatewayTxRef,
      method: payment.method,
      status: payment.status,
      amount: payment.amount,
      redirectUrl: null as string | null,
      instructions,
      simulation: false,
    };
  }

  /**
   * Sandbox simulation of the hosted checkout — ONLY available while the tenant
   * has no live merchant credentials for the gateway. Plugging real credentials
   * into Integrations settings automatically disables this endpoint.
   */
  async simulatePublic(gatewayTxRef: string, dto: SimulatePaymentDto) {
    const tenant = await this.tenantBySubdomain(dto.subdomain);
    const order = await this.findPublicOrder(tenant.id, dto.orderNumber, dto.phone);

    const payment = await this.prisma.payment.findUnique({
      where: { gatewayTxRef: gatewayTxRef.trim() },
      include: { order: true },
    });
    if (!payment || payment.orderId !== order.id || payment.tenantId !== tenant.id) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.method !== 'JAZZCASH' && payment.method !== 'EASYPAISA') {
      throw new BadRequestException('Only wallet payments support simulation');
    }
    if (['SUCCEEDED', 'FAILED'].includes(payment.status)) {
      throw new BadRequestException(`This payment is already ${payment.status.toLowerCase()}`);
    }

    const integration = await this.getIntegration(tenant.id, payment.method);
    if (integration && integration.sandbox === false) {
      throw new ForbiddenException(
        'Simulation is disabled — live gateway credentials are configured for this store',
      );
    }

    const outcome = dto.outcome ?? 'SUCCESS';
    if (outcome === 'FAILED') {
      console.log(`[Payments] SIM ${payment.method} failure — order ${payment.order.orderNumber} ref ${payment.gatewayTxRef}`);
      const updated = await this.finalizeFailed(payment.id, 'Simulated gateway failure (sandbox)');
      return { gatewayTxRef: updated.gatewayTxRef, method: updated.method, status: updated.status, amount: updated.amount };
    }

    console.log(`[Payments] SIM ${payment.method} success — order ${payment.order.orderNumber} ref ${payment.gatewayTxRef}`);
    const updated = await this.finalizeSucceeded(
      payment.id,
      `SIM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      'sim',
    );
    return { gatewayTxRef: updated!.gatewayTxRef, method: updated!.method, status: updated!.status, amount: updated!.amount };
  }

  /**
   * Customer submits bank-transfer proof for an IBFT/RAAST payment.
   * One proof per order (upsert); merchant approval finalizes the payment.
   */
  async submitBankProofPublic(dto: SubmitBankProofDto) {
    const tenant = await this.tenantBySubdomain(dto.subdomain);
    const order = await this.findPublicOrder(tenant.id, dto.orderNumber, dto.phone);

    const payment = await this.prisma.payment.findUnique({
      where: { gatewayTxRef: dto.gatewayTxRef.trim() },
    });
    if (!payment || payment.orderId !== order.id || payment.tenantId !== tenant.id) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.method !== 'IBFT' && payment.method !== 'RAAST') {
      throw new BadRequestException('Bank-transfer proof applies only to IBFT / RAAST payments');
    }
    if (payment.status === 'SUCCEEDED') {
      throw new BadRequestException('This payment is already completed');
    }
    if (payment.status === 'FAILED') {
      throw new BadRequestException('This payment attempt failed — open the order page to start again');
    }

    const proof = await this.prisma.bankTransferProof.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        bankName: dto.bankName.trim(),
        transactionRef: dto.transactionRef.trim(),
        receiptImageUrl: dto.receiptImageUrl?.trim() || '',
        isApproved: false,
      },
      update: {
        bankName: dto.bankName.trim(),
        transactionRef: dto.transactionRef.trim(),
        receiptImageUrl: dto.receiptImageUrl?.trim() || '',
        isApproved: false,
      },
    });

    if (payment.status === 'INITIATED') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'AWAITING_PROOF' },
      });
    }

    console.log(
      `[Payments] ${payment.method} proof submitted — order ${order.orderNumber} ref ${payment.gatewayTxRef} (bank ${proof.bankName})`,
    );
    return {
      ok: true,
      gatewayTxRef: payment.gatewayTxRef,
      status: 'AWAITING_PROOF',
      message: 'Proof submitted. Verification is usually quick — your order status updates automatically once approved.',
    };
  }

  // ------------------------------------------------------------
  // Gateway callbacks (server-to-server)
  // ------------------------------------------------------------

  /** Finalize a gateway transaction from its provider callback, looked up by exact gatewayTxRef. */
  async gatewayCallback(gateway: string, body: any) {
    const gw = String(gateway || '').toLowerCase();
    const ref = String(
      body?.pp_TxnRefNo ||
        body?.pp_BillReference ||
        body?.cartid ||
        body?.orderId ||
        body?.transactionId ||
        body?.ref ||
        '',
    ).trim();
    if (!ref) throw new BadRequestException('Missing transaction reference in callback');

    let payment = await this.prisma.payment.findUnique({
      where: { gatewayTxRef: ref },
      include: { order: true },
    });
    if (!payment) {
      payment = await this.prisma.payment.findFirst({
        where: { OR: [{ providerRef: ref }, { gatewayTxRef: { contains: ref } }] },
        include: { order: true },
      });
    }
    if (!payment) throw new NotFoundException('Payment not found for callback reference');

    const verified = await this.verifyCallbackHash(payment.tenantId, payment.method, body);
    if (!verified) {
      console.warn(`[Payments] ${gw} callback signature mismatch for ref ${ref} — ignored`);
      return { received: true, verified: false };
    }

    const successCode = ['000', '00'].includes(String(body?.pp_ResponseCode || body?.responseCode));
    const isSuccess =
      gw.startsWith('easypaisa')
        ? String(body?.status || '').toLowerCase() === 'success' || successCode
        : successCode;

    if (isSuccess) {
      await this.finalizeSucceeded(
        payment.id,
        String(body?.pp_AuthCode || body?.transactionId || body?.transactionRefNo || ref),
        'gateway',
      );
    } else {
      await this.finalizeFailed(
        payment.id,
        `Gateway reported failure: ${String(
          body?.pp_ResponseMessage || body?.responseMessage || body?.pp_ResponseCode || body?.responseCode || 'unknown',
        )}`,
      );
    }
    return { received: true, verified: true };
  }

  // ------------------------------------------------------------
  // Admin
  // ------------------------------------------------------------

  async adminList(tenantId: string, query: ListPaymentsQueryDto) {
    return this.prisma.payment.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status as PaymentTxStatus } : {}),
        ...(query.method ? { method: query.method as PaymentMethod } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            paymentMethod: true,
            paymentStatus: true,
            orderStatus: true,
            totalAmount: true,
            bankProof: {
              select: { bankName: true, transactionRef: true, receiptImageUrl: true, isApproved: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async adminGet(tenantId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: { order: { include: { bankProof: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  /** Merchant confirms funds are received (IBFT/RAAST approval or manual reconciliation). */
  async adminApprove(tenantId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCEEDED') {
      // Idempotent — already done
      return this.adminGet(tenantId, id);
    }
    if (payment.status === 'FAILED') {
      throw new BadRequestException('Failed payments cannot be approved — the customer can start a new attempt');
    }
    if (['CANCELLED', 'RTO'].includes(payment.order.orderStatus)) {
      throw new BadRequestException('This order is cancelled — payment cannot be approved');
    }
    await this.finalizeSucceeded(payment.id, 'MERCHANT-APPROVED', 'admin', true);
    return this.adminGet(tenantId, id);
  }

  async adminReject(tenantId: string, id: string, reason?: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, tenantId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCEEDED') {
      throw new BadRequestException('This payment is already completed');
    }
    await this.finalizeFailed(payment.id, reason?.trim() || 'Rejected by merchant');
    return this.adminGet(tenantId, id);
  }

  // ------------------------------------------------------------
  // Shared internals
  // ------------------------------------------------------------

  private async tenantBySubdomain(subdomain: string) {
    const key = subdomain.trim().toLowerCase();
    const tenant = await this.prisma.tenant.findFirst({
      where: { OR: [{ subdomain: key }, { customDomain: subdomain.trim() }] },
    });
    if (!tenant) throw new NotFoundException('Store not found');
    return tenant;
  }

  private async findPublicOrder(tenantId: string, orderNumber: string, phone: string) {
    const order = await this.prisma.order.findFirst({
      where: {
        tenantId,
        orderNumber: orderNumber.trim().toUpperCase(),
        customerPhone: phone.trim(),
      },
    });
    if (!order) throw new NotFoundException('Order not found for these details');
    return order;
  }

  private async getIntegration(tenantId: string, provider: string): Promise<IntegrationCfg | null> {
    const setting = await this.prisma.integrationSetting.findUnique({
      where: { tenantId_provider: { tenantId, provider } },
    });
    if (!setting) return null;
    let config: Record<string, string> = {};
    try {
      const parsed = JSON.parse(setting.configJson);
      if (parsed && typeof parsed === 'object') config = parsed;
    } catch {
      config = {};
    }
    const hasKeys = Object.keys(config).filter((k) => String(config[k] || '').trim().length > 0);
    if (!hasKeys.length) return null;
    return { config, sandbox: setting.sandbox };
  }

  private storefrontUrl() {
    return (this.configService.get<string>('STOREFRONT_URL') || 'http://localhost:3001').replace(/\/+$/, '');
  }

  private newGatewayTxRef(orderNumber: string, method: string) {
    const ref = orderNumber.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return `${method.slice(0, 3)}-${ref}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  private instructionsFor(
    method: 'IBFT' | 'RAAST',
    cfg: Record<string, string> | null,
    amount: number,
  ): string {
    const amountLine = `Amount to transfer: Rs ${Number(amount).toLocaleString('en-PK')}`;
    if (cfg) {
      const lines = [amountLine];
      if (cfg.bankName) lines.push(`Bank: ${cfg.bankName}`);
      if (cfg.accountTitle) lines.push(`Account title: ${cfg.accountTitle}`);
      if (cfg.accountNumber) {
        lines.push(method === 'RAAST' ? `Raast (bank account): ${cfg.accountNumber}` : `Account number: ${cfg.accountNumber}`);
      }
      if (cfg.iban) lines.push(`IBAN: ${cfg.iban}`);
      if (cfg.extra) lines.push(cfg.extra);
      lines.push(
        '',
        `After transferring, submit the ${method === 'RAAST' ? 'Raast transaction ID' : 'transaction reference'} below.`,
      );
      return lines.join('\n');
    }
    if (method === 'RAAST') {
      return [
        amountLine,
        'Open your bank app → Raast → Pay to bank account:',
        'Bank: Meezan Bank (demo)',
        'Account title: Khaadi Store',
        'Bank account: 0123-0102527841',
        '',
        'After paying, submit the Raast transaction ID below. (Demo details — configure the real account in Admin → Integrations.)',
      ].join('\n');
    }
    return [
      amountLine,
      'Transfer via online banking / ATM / any branch:',
      'Bank: Meezan Bank (demo)',
      'Account title: Khaadi Store',
      'Account number: 0123-0102527841',
      '',
      'After transferring, submit the transaction reference below. (Demo details — configure the real account in Admin → Integrations.)',
    ].join('\n');
  }

  private async finalizeSucceeded(
    paymentId: string,
    providerRef: string | undefined,
    via: 'sim' | 'gateway' | 'admin',
    approveProof = false,
  ) {
    const before = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: true },
    });
    if (!before) throw new NotFoundException('Payment not found');
    if (before.status === 'SUCCEEDED') {
      return this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: { select: { orderNumber: true } } },
      });
    }
    if (before.status === 'FAILED') {
      throw new BadRequestException('This payment was already marked failed');
    }

    const markedPaidAt = new Date();
    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'SUCCEEDED', providerRef, markedPaidAt, errorMessage: null },
      }),
      this.prisma.order.update({
        where: { id: before.orderId },
        data: {
          paymentStatus: 'PAID',
          ...(before.order.orderStatus === 'PENDING' ? { orderStatus: 'VERIFIED' } : {}),
        },
      }),
    ];
    if (approveProof) {
      ops.push(
        this.prisma.bankTransferProof.updateMany({
          where: { orderId: before.orderId },
          data: { isApproved: true, approvedAt: markedPaidAt },
        }),
      );
    }
    await this.prisma.$transaction(ops);

    void this.webhooksService.dispatchEvent(before.tenantId, 'payment.succeeded', {
      orderNumber: before.order.orderNumber,
      gatewayTxRef: before.gatewayTxRef,
      method: before.method,
      amount: before.amount,
      providerRef: providerRef ?? null,
      markedPaidAt: markedPaidAt.toISOString(),
      approvedBy: via,
    });
    console.log(`[Payments] ${before.gatewayTxRef} SUCCEEDED (${via}) — order ${before.order.orderNumber} now PAID`);

    return this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { orderNumber: true } } },
    });
  }

  private async finalizeFailed(paymentId: string, errorMessage: string) {
    const before = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { orderNumber: true } } },
    });
    if (!before) throw new NotFoundException('Payment not found');
    if (before.status === 'FAILED') {
      return before;
    }
    if (before.status === 'SUCCEEDED') {
      throw new BadRequestException('This payment was already completed');
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', errorMessage },
    });
    void this.webhooksService.dispatchEvent(before.tenantId, 'payment.failed', {
      orderNumber: before.order.orderNumber,
      gatewayTxRef: before.gatewayTxRef,
      method: before.method,
      amount: before.amount,
      error: errorMessage,
    });
    console.log(`[Payments] ${before.gatewayTxRef} FAILED — ${errorMessage}`);
    return updated;
  }

  // ------------------------------------------------------------
  // Real gateway adapters (used only when tenants configure live credentials)
  // ------------------------------------------------------------

  private requestJazzCash(order: any, integration: IntegrationCfg, gatewayTxRef: string) {
    const cfg = integration.config;
    const amountInPaisa = Math.round(Number(order.totalAmount) * 100);
    const txnDateTime = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const salt = cfg.integritySalt || '';
    const returnUrl =
      cfg.returnUrl || `${this.storefrontUrl()}/order/${order.orderNumber}?phone=${order.customerPhone}`;

    const postData: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: cfg.merchantId || '',
      pp_SubMerchantID: '',
      pp_Password: cfg.password || '',
      pp_BankID: cfg.bankId || 'TBANK',
      pp_ProductID: cfg.productId || 'RETL',
      pp_TxnRefNo: gatewayTxRef,
      pp_Amount: amountInPaisa.toString(),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: txnDateTime,
      pp_BillReference: order.orderNumber,
      pp_Description: `Order ${order.orderNumber} - ${order.customerName}`,
      pp_TxnExpiryDateTime: '',
      pp_ReturnURL: returnUrl,
      pp_SecureHash: '',
      ppmpf_1: order.customerPhone,
      ppmpf_2: order.customerEmail || '',
      ppmpf_3: order.shippingCity,
      ppmpf_4: '',
      ppmpf_5: '',
    };

    const sortedKeys = Object.keys(postData).sort();
    let hashString = `${salt}&`;
    for (const key of sortedKeys) {
      if (postData[key]) hashString += `${postData[key]}&`;
    }
    hashString = hashString.slice(0, -1);
    postData.pp_SecureHash = crypto.createHmac('sha256', salt).update(hashString).digest('hex');

    const base = integration.sandbox
      ? 'https://sandbox.jazzcash.com.pk/Application/Api/Payment/DoTransaction'
      : 'https://payments.jazzcash.com.pk/Application/Api/Payment/DoTransaction';

    return {
      redirectUrl: `${base}?${new URLSearchParams(postData).toString()}`,
      providerRef: gatewayTxRef,
    };
  }

  private async requestEasypaisa(order: any, integration: IntegrationCfg, gatewayTxRef: string) {
    const cfg = integration.config;
    const amountInPaisa = Math.round(Number(order.totalAmount) * 100);
    const postBackURL =
      cfg.postBackURL || `${this.storefrontUrl()}/order/${order.orderNumber}?phone=${order.customerPhone}`;

    const postData: Record<string, string> = {
      storeId: cfg.storeId || cfg.merchantId || '',
      orderId: gatewayTxRef,
      amount: amountInPaisa.toString(),
      currency: 'PKR',
      postBackURL,
      callbackURL: postBackURL,
      redirectURL: postBackURL,
      customerMobile: order.customerPhone,
      customerEmail: order.customerEmail || '',
      customerName: order.customerName,
      description: `Order ${order.orderNumber}`,
      merchantHashedReq: '',
    };
    const hashString = `${postData.storeId}${postData.orderId}${postData.amount}${postData.currency}${postData.postBackURL}${cfg.password || ''}`;
    postData.merchantHashedReq = crypto.createHash('sha256').update(hashString).digest('hex');

    const base = integration.sandbox
      ? 'https://sandbox.easypaisa.com.pk/epay/api/v1/payment/initiate'
      : 'https://easypaisa.com.pk/epay/api/v1/payment/initiate';

    try {
      const response = await firstValueFrom(
        this.httpService.post<{ redirectUrl?: string }>(base, postData, { timeout: 8000 }),
      );
      if (response.data?.redirectUrl) {
        return { redirectUrl: response.data.redirectUrl, providerRef: gatewayTxRef };
      }
    } catch {
      console.warn('[Payments] EASYPAISA direct initiate unavailable — using hosted-redirect fallback');
    }
    return {
      redirectUrl: `${base}?${new URLSearchParams(postData).toString()}`,
      providerRef: gatewayTxRef,
    };
  }

  /** Best-effort callback signature check against the tenant's stored credentials. */
  private async verifyCallbackHash(tenantId: string, method: PaymentMethod, body: any): Promise<boolean> {
    try {
      const integration = await this.getIntegration(tenantId, method);
      if (!integration) return true; // nothing configured — nothing to verify against

      if (method === 'JAZZCASH') {
        if (!body?.pp_SecureHash) return true;
        const salt = integration.config.integritySalt || '';
        const sortedKeys = Object.keys(body)
          .filter((k) => k !== 'pp_SecureHash')
          .sort();
        let hashString = `${salt}&`;
        for (const key of sortedKeys) {
          if (body[key]) hashString += `${body[key]}&`;
        }
        hashString = hashString.slice(0, -1);
        const expected = crypto.createHmac('sha256', salt).update(hashString).digest('hex');
        return expected === body.pp_SecureHash;
      }

      if (method === 'EASYPAISA') {
        if (!body?.merchantHashedResp) return true;
        const hashString = `${integration.config.storeId || ''}...${integration.config.password || ''}`;
        const expected = crypto.createHash('sha256').update(hashString).digest('hex');
        return expected === body.merchantHashedResp;
      }
      return true;
    } catch {
      return true;
    }
  }
}
