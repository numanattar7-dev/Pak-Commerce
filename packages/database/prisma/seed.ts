import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Pak Commerce database seeding...');

  // 1. Seed Pakistani Cities for Shipping Rules
  const pakistaniCities = [
    { name: 'Karachi', province: 'Sindh', tier: 1 },
    { name: 'Lahore', province: 'Punjab', tier: 1 },
    { name: 'Islamabad', province: 'Islamabad', tier: 1 },
    { name: 'Rawalpindi', province: 'Punjab', tier: 1 },
    { name: 'Faisalabad', province: 'Punjab', tier: 1 },
    { name: 'Multan', province: 'Punjab', tier: 1 },
    { name: 'Gujranwala', province: 'Punjab', tier: 2 },
    { name: 'Peshawar', province: 'KPK', tier: 1 },
    { name: 'Quetta', province: 'Balochistan', tier: 1 },
    { name: 'Sialkot', province: 'Punjab', tier: 2 },
    { name: 'Sargodha', province: 'Punjab', tier: 2 },
    { name: 'Bahawalpur', province: 'Punjab', tier: 2 },
    { name: 'Sukkur', province: 'Sindh', tier: 2 },
    { name: 'Larkana', province: 'Sindh', tier: 2 },
    { name: 'Sheikhupura', province: 'Punjab', tier: 2 },
    { name: 'Jhelum', province: 'Punjab', tier: 3 },
    { name: 'Mardan', province: 'KPK', tier: 2 },
    { name: 'Kasur', province: 'Punjab', tier: 3 },
    { name: 'Rahim Yar Khan', province: 'Punjab', tier: 2 },
    { name: 'Gujrat', province: 'Punjab', tier: 3 },
  ];

  // 2. Create demo tenant (Khaadi-style clothing brand)
  console.log('🏪 Creating demo clothing brand tenant...');
  const demoTenant = await prisma.tenant.create({
    data: {
      name: 'Khaadi Unstitched',
      subdomain: 'khaadi',
      currency: 'PKR',
      status: 'ACTIVE',
    },
  });

  // 3. Create admin user for demo tenant
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      tenantId: demoTenant.id,
      name: 'Admin User',
      email: 'admin@khaadi.com',
      phone: '03001234567',
      passwordHash: hashedPassword,
      role: 'MERCHANT_ADMIN',
    },
  });

  // 4. Create shipping rules for tiered pricing
  console.log('🚚 Creating tiered shipping rates...');
  for (const city of pakistaniCities) {
    const rate = city.tier === 1 ? 200 : city.tier === 2 ? 250 : 300;
    await prisma.shippingRule.create({
      data: {
        tenantId: demoTenant.id,
        city: city.name,
        rate,
        isFreeAbove: 5000, // Free shipping over PKR 5000
      },
    });
  }

  // 5. Create sample unstitched apparel products
  console.log('👕 Creating sample unstitched products...');
  const categories = ['Unstitched', 'Stitched', 'Kurtas', 'Sherwanis', 'Fabric'];

  for (let i = 1; i <= 8; i++) {
    const product = await prisma.product.create({
      data: {
        tenantId: demoTenant.id,
        title: `Premium Unstitched 3-Piece Suit ${i}`,
        titleUrdu: `پریمیم ان سٹچڈ 3-پیس سوٹ ${i}`,
        description: `High-quality embroidered fabric with matching dupatta and shalwar. Perfect for festive occasions.`,
        descriptionUr: `اعلیٰ معیار کا کڑھائی والا کپڑا، ملتا جلتا دوپٹہ اور شلوار۔ تقریبات کے لیے بہترین انتخاب۔`,
        category: categories[i % categories.length],
        tags: ['Embroidered', 'Premium', 'Festive', 'Unstitched'],
        isHalal: true,
        images: [`/products/unstitched-${i}.jpg`, `/products/detail-${i}.jpg`],
      },
    });

    // Create variants (sizes/colors)
    const variants = [
      { title: 'Large / Navy Blue', price: 5999, compareAtPrice: 7499, stockQuantity: 50 },
      { title: 'Medium / Maroon', price: 5499, compareAtPrice: 6999, stockQuantity: 35 },
      { title: 'Small / Emerald Green', price: 4999, compareAtPrice: 6499, stockQuantity: 20 },
    ];

    for (const variant of variants) {
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          title: variant.title,
          sku: `KHA-UNS-${i}-${variant.title.split(' / ')[0].substring(0, 1)}`,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stockQuantity: variant.stockQuantity,
          weightGrams: 800,
        },
      });
    }
  }

  // 6. Create sample orders (COD + IBFT)
  console.log('📦 Creating sample orders...');
  const orderData = [
    {
      customerName: 'Ahmed Raza',
      customerPhone: '03001234568',
      shippingCity: 'Karachi',
      paymentMethod: 'COD' as const,
    },
    {
      customerName: 'Sara Khan',
      customerPhone: '03211234567',
      shippingCity: 'Lahore',
      paymentMethod: 'IBFT' as const,
    },
  ];

  for (const order of orderData) {
    const orderNumber = `PK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5)}`;

    const createdOrder = await prisma.order.create({
      data: {
        tenantId: demoTenant.id,
        orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        shippingCity: order.shippingCity,
        shippingAddress: 'House 123, Street 45, Gulshan-e-Iqbal',
        paymentMethod: order.paymentMethod,
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        riskScore: 'LOW',
        subtotal: 5999,
        shippingFee: 200,
        totalAmount: 6199,
      },
    });

    // Add order items
    await prisma.orderItem.create({
      data: {
        orderId: createdOrder.id,
        variantId: (await prisma.productVariant.findFirst({ where: { product: { tenantId: demoTenant.id } } }))!.id,
        title: 'Large / Navy Blue - Premium Unstitched 3-Piece Suit 1',
        quantity: 1,
        price: 5999,
      },
    });

    // For COD orders, create OTP verification
    if (order.paymentMethod === 'COD') {
      await prisma.codVerification.create({
        data: {
          orderId: createdOrder.id,
          otpCode: '123456', // Static for demo
          isVerified: false,
        },
      });
    }
  }

  console.log('✅ Database seeding completed successfully!');
  console.log('📊 Summary:');
  console.log(`   - 1 Demo Tenant (ID: ${demoTenant.id})`);
  console.log(`   - 1 Admin User (admin@khaadi.com / admin123)`);
  console.log(`   - ${pakistaniCities.length} Pakistani Cities with shipping rules`);
  console.log(`   - 8 Sample Products with 24 Variants`);
  console.log(`   - 2 Sample Orders (COD + IBFT)`);
  console.log('');
  console.log('🔗 Login Credentials:');
  console.log('   Email: admin@khaadi.com');
  console.log('   Password: admin123');
  console.log('   Store Subdomain: khaadi');
  console.log('');
  console.log('🚀 Ready to start Pak Commerce!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
