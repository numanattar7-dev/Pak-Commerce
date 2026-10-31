'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Truck,
  ShieldCheck,
  CheckCircle,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  X,
  CreditCard,
  Banknote,
  Send
} from 'lucide-react';

interface Variant {
  id: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  inventoryQuantity: number;
}

interface Product {
  id: string;
  title: string;
  titleUrdu?: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  images: string[];
  variants: Variant[];
}

interface CartItem {
  product: Product;
  variant: Variant;
  quantity: number;
}

export default function StorefrontPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<any>(null);

  // Checkout Form State
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('Karachi');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'IBFT'>('COD');
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    type: string;
    discountAmount: number;
  } | null>(null);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);
  const [checkingDiscount, setCheckingDiscount] = useState(false);

  // 450+ standardized Pakistani cities snippet (most common)
  const pakistaniCities = [
    'Karachi',
    'Lahore',
    'Islamabad',
    'Rawalpindi',
    'Faisalabad',
    'Multan',
    'Peshawar',
    'Quetta',
    'Sialkot',
    'Gujranwala',
    'Hyderabad',
    'Bahawalpur',
    'Sargodha',
    'Sukkur',
    'Abbottabad',
    'Mardan',
  ];

  // Fetch live store products from Backend
  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await fetch('http://localhost:4000/products/store/khaadi');
        if (res.ok) {
          const json = await res.json();
          const mapped = (json.data || []).map((p: any) => {
            const firstVariant = p.variants?.[0];
            const parsedPrice = firstVariant?.price ? Number(firstVariant.price) : 4999;
            const parsedCompare = firstVariant?.compareAtPrice ? Number(firstVariant.compareAtPrice) : undefined;
            return {
              ...p,
              price: parsedPrice,
              compareAtPrice: parsedCompare,
              variants: (p.variants || []).map((v: any) => ({
                ...v,
                price: Number(v.price || parsedPrice),
                compareAtPrice: v.compareAtPrice ? Number(v.compareAtPrice) : undefined,
                inventoryQuantity: Number(v.inventoryQuantity || 10),
              })),
            };
          });
          setProducts(mapped);
        } else {
          // Fallback demo products if API offline
          setProducts([
            {
              id: '1',
              title: '3-Piece Embroidered Lawn Suit',
              titleUrdu: 'Embroidered Lawn Suit',
              slug: '3-piece-embroidered-lawn-suit',
              description: 'Exquisite summer lawn collection with digital printed chiffon dupatta and dyed cambric trouser.',
              price: 5490,
              compareAtPrice: 6990,
              category: 'Unstitched',
              images: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80'],
              variants: [{ id: 'v1', sku: 'KHD-LWN-01', title: 'Default', price: 5490, inventoryQuantity: 45 }],
            },
            {
              id: '2',
              title: '2-Piece Printed Cotton Jacquard',
              titleUrdu: 'Printed Cotton Jacquard',
              slug: '2-piece-printed-cotton-jacquard',
              description: 'Breathable luxury cotton jacquard fabric with delicate zari borders.',
              price: 3890,
              compareAtPrice: 4500,
              category: 'Unstitched',
              images: ['https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80'],
              variants: [{ id: 'v2', sku: 'KHD-JAC-02', title: 'Default', price: 3890, inventoryQuantity: 30 }],
            },
            {
              id: '3',
              title: 'Raw Silk Festive Kurta Fabric',
              titleUrdu: 'Raw Silk Festive Kurta',
              slug: 'raw-silk-festive-kurta',
              description: 'Pure 80-gram raw silk suitable for luxury festive occasion wear.',
              price: 4990,
              compareAtPrice: 5800,
              category: 'Festive',
              images: ['https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80'],
              variants: [{ id: 'v3', sku: 'KHD-SLK-03', title: 'Default', price: 4990, inventoryQuantity: 20 }],
            },
          ]);
        }
      } catch (e) {
        console.error('Error fetching products:', e);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const addToCart = (product: Product, variant?: Variant) => {
    const selectedVariant = variant || product.variants[0] || {
      id: `${product.id}-default`,
      sku: `SKU-${product.id}`,
      title: 'Standard',
      price: product.price,
      inventoryQuantity: 50,
    };

    setCart((prev) => {
      const existing = prev.find((item) => item.variant.id === selectedVariant.id);
      if (existing) {
        return prev.map((item) =>
          item.variant.id === selectedVariant.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, variant: selectedVariant, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((item) => item.variant.id !== variantId));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.variant.price * item.quantity, 0);
  const shippingFee = cartTotal > 4000 ? 0 : 250; // Free shipping over PKR 4,000

  // Validate a discount code live against the server (preview only; final)
  // totals are ALWAYS recomputed by the backend when the order is placed)
  const applyDiscount = async () => {
    const code = discountInput.trim();
    if (!code || cart.length === 0) return;
    setCheckingDiscount(true);
    setDiscountMsg(null);
    try {
      const res = await fetch('http://localhost:4000/discounts/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subdomain: 'khaadi',
          code,
          subtotal: cartTotal,
          shippingFee,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedDiscount({
          code: data.discount.code,
          type: data.discount.type,
          discountAmount: Number(data.discountAmount || 0),
        });
      } else {
        setAppliedDiscount(null);
        setDiscountMsg(data.reason || 'Discount code is invalid.');
      }
    } catch (e) {
      console.error('Discount validate error:', e);
      setDiscountMsg('Could not reach the server.');
    } finally {
      setCheckingDiscount(false);
    }
  };

  // Uniform money display (2 decimals, Shopify-style)
  const fmtMoney = (n: number) =>
    'Rs. ' + Number(n).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountInput('');
    setDiscountMsg(null);
  };

  // Handle Order Submit
  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;

    // Validate Pakistani 11-digit mobile number
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone.startsWith('03') || cleanPhone.length !== 11) {
      alert('Please enter a valid Pakistani mobile number (e.g., 03001234567)');
      return;
    }

    setSubmittingOrder(true);
    setOrderError(null);

    try {
      // Send real order request to Backend API
      const orderPayload = {
        subdomain: 'khaadi',
        customerName,
        customerPhone: cleanPhone,
        customerEmail: customerEmail || undefined,
        shippingAddress,
        shippingCity,
        paymentMethod,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        items: cart.map((item) => ({
          variantId: item.variant.id,
          title: item.product.title,
          quantity: item.quantity,
          price: item.variant.price,
        })),
      };

      const res = await fetch('http://localhost:4000/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (res.ok) {
        const orderData = await res.json();
        setOrderSuccess(orderData);
        setCart([]);
        setAppliedDiscount(null);
        setDiscountInput('');
        setDiscountMsg(null);
        setIsCheckoutOpen(false);
      } else {
        // Show the REAL error from the backend; never fake success
        let message = 'There was a problem placing your order. Please try again.';
        try {
          const errJson = await res.json();
          if (errJson?.message) {
            message = Array.isArray(errJson.message)
              ? errJson.message.join('. ')
              : String(errJson.message);
          }
        } catch (jsonErr) {
          // response was not JSON; keep default message
        }
        setOrderError(message);
      }
    } catch (err) {
      console.error('Order placement error:', err);
      // Network/server failure; show real error, keep cart intact
      setOrderError('Could not reach the server. Please check your internet connection and try again.');
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Top Banner - Free Shipping & COD Assurance */}
      <div className="bg-emerald-800 text-emerald-100 text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
        <span>Cash-on-Delivery available across Pakistan - Free shipping over PKR 4,000</span>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-emerald-700 text-white rounded-xl flex items-center justify-center font-black text-xl shadow-sm">
              K
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 block leading-tight">
                KHAADI
              </span>
              <span className="text-[10px] tracking-widest uppercase text-emerald-700 font-bold">
                Unstitched Apparel - Pakistan
              </span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-700">
            <a href="#unstitched" className="hover:text-emerald-700 transition">Unstitched Lawn</a>
            <a href="#festive" className="hover:text-emerald-700 transition">Festive Collection</a>
            <a href="#cotton" className="hover:text-emerald-700 transition">Cotton Jacquard</a>
            <span className="bg-emerald-50 text-emerald-700 text-xs px-2.5 py-1 rounded-full border border-emerald-200 font-bold">
              100% Halal Fabric
            </span>
          </div>

          {/* Cart Icon & Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-800 transition"
            >
              <ShoppingBag className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[11px] font-bold h-5 w-5 rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {cart.reduce((total, i) => total + i.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white py-16 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-full border border-emerald-500/30">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>New Summer Collection 2026</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              Authentic Pakistani Lawn Collection
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Shop authentic unstitched collections delivered right to your doorstep anywhere in Pakistan. Inspect before you pay with verified Cash-on-Delivery (COD).
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="#catalog"
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition"
              >
                <span>Shop Now</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <div className="flex items-center gap-3 text-xs text-slate-300 px-4 py-2 bg-slate-800/80 rounded-xl border border-slate-700">
                <Truck className="w-4 h-4 text-emerald-400" />
                <span>2-4 business days delivery</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/3] rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700/50">
              <img
                src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=80"
                alt="Pakistani Lawn"
                className="w-full h-full object-cover hover:scale-105 transition duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center p-3">
            <Truck className="w-6 h-6 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-900">Delivery Across Pakistan</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">TCS, PostEx, Trax & Leopards</p>
          </div>
          <div className="flex flex-col items-center p-3">
            <Banknote className="w-6 h-6 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-900">Cash on Delivery (COD)</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Pay in cash at doorstep</p>
          </div>
          <div className="flex flex-col items-center p-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-900">7-day exchange facility</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Easy returns across 450+ cities</p>
          </div>
          <div className="flex flex-col items-center p-3">
            <Phone className="w-6 h-6 text-emerald-600 mb-2" />
            <h4 className="text-xs font-bold text-slate-900">WhatsApp Support</h4>
            <p className="text-[11px] text-slate-500 mt-0.5">Direct merchant assistance</p>
          </div>
        </div>
      </section>

      {/* Product Catalog Section */}
      <main id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-slate-900">Product Catalog - Featured Collection</h2>
            <p className="text-xs text-slate-500 mt-1">Authentic unstitched fabrics with guaranteed quality</p>
          </div>
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
            {products.length} Products Available
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-slate-200 animate-pulse rounded-2xl h-80"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-[4/5] bg-slate-100 overflow-hidden">
                    <img
                      src={
                        product.images && product.images.length > 0 && product.images[0].startsWith('http')
                          ? product.images[0]
                          : 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80'
                      }
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                    />
                    {Boolean(product.compareAtPrice && product.price && product.compareAtPrice > product.price) && (
                      <span className="absolute top-3 left-3 bg-red-600 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow">
                        SAVE {Math.round(((product.compareAtPrice! - product.price) / product.compareAtPrice!) * 100)}%
                      </span>
                    )}
                    <span className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                      {product.category || 'Lawn'}
                    </span>
                  </div>

                  <div className="p-5">
                    {false && (
                      <p className="text-xs font-bold text-emerald-800 text-right font-serif mb-1">
                        {product.titleUrdu}
                      </p>
                    )}
                    <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition">
                      {product.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                      {product.description}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 flex items-center justify-between mt-4">
                  <div>
                    <span className="text-lg font-black text-slate-900">
                      Rs. {Number(product.price || 0).toLocaleString()}
                    </span>
                    {product.compareAtPrice && (
                      <span className="text-xs text-slate-400 line-through ml-2">
                        Rs. {Number(product.compareAtPrice).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => addToCart(product)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Cart Drawer Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900">Your Shopping Cart</h3>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-3">
                  <ShoppingBag className="w-12 h-12 mx-auto stroke-1" />
                  <p className="text-sm font-medium">Your cart is empty</p>
                  <p className="text-xs">Your shopping cart is currently empty.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.variant.id}
                    className="flex gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200/80 items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-bold text-slate-800">{item.product.title}</h4>
                      <p className="text-xs text-slate-500">
                        Qty: {item.quantity} Rs. {item.variant.price.toLocaleString()}
                      </p>
                      <p className="text-xs font-bold text-emerald-700">
                        Total: Rs. {(item.variant.price * item.quantity).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.variant.id)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold p-2"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-semibold">Rs. {cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Shipping</span>
                    <span className="font-semibold">
                      {shippingFee === 0 ? 'FREE Shipping' : `Rs. ${shippingFee}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span className="text-emerald-700">Rs. {(cartTotal + shippingFee).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setIsCheckoutOpen(true);
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow transition text-sm flex items-center justify-center gap-2"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Quick Checkout</h3>
                <p className="text-xs text-slate-300">Cash-on-Delivery and bank transfer across Pakistan</p>
              </div>
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Ahmed Raza"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@gmail.com"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery City *
                </label>
                <select
                  value={shippingCity}
                  onChange={(e) => setShippingCity(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {pakistaniCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Address *
                </label>
                <textarea
                  required
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="House number, street, area, city, landmark"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                ></textarea>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Payment Method *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition ${
                      paymentMethod === 'COD'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600" />
                    <div>
                      <p className="text-xs font-bold">Cash on Delivery (COD)</p>
                      <p className="text-[10px] text-slate-500">Pay when order arrives</p>
                    </div>
                  </div>

                  <div
                    onClick={() => setPaymentMethod('IBFT')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center gap-3 transition ${
                      paymentMethod === 'IBFT'
                        ? 'border-emerald-600 bg-emerald-50/50 text-emerald-900'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs font-bold">Bank Transfer (IBFT / Raast)</p>
                      <p className="text-[10px] text-slate-500">Direct account transfer</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discount code (live-validated against the server) */}
              <div>
                {appliedDiscount ? (
                  <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-xs">
                    <div>
                      <p className="font-bold text-emerald-800">Code {appliedDiscount.code} applied</p>
                      <p className="text-emerald-700 mt-0.5">
                        {appliedDiscount.type === 'FREE_SHIPPING'
                          ? 'Shipping is FREE!'
                          : `Discount: ${fmtMoney(appliedDiscount.discountAmount)}`}`
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={removeDiscount}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                        placeholder="Discount code (e.g., EID20)"
                        className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-emerald-600"
                      />
                      <button
                        type="button"
                        onClick={applyDiscount}
                        disabled={checkingDiscount || cart.length === 0}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {checkingDiscount ? '...' : 'Apply'}
                      </button>
                    </div>
                    {discountMsg && (
                      <p className="mt-1.5 text-[11px] text-red-600 font-semibold">Invalid discount: {discountMsg}</p>
                    )}
                  </>
                )}
              </div>

              {orderError && (
                <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-xs text-red-700 font-semibold">
                  {orderError}
                </div>
              )}

              {appliedDiscount && (
                <div className="p-3 rounded-xl border border-slate-200 text-xs flex justify-between font-semibold text-emerald-700">
                  <span>Discount ({appliedDiscount.code}):</span>
                  <span>Discount saved: {fmtMoney(appliedDiscount.discountAmount)}</span>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between font-bold">
                <span>Payable Amount:</span>
                <span className="text-emerald-700 text-sm">
                  {fmtMoney(cartTotal + shippingFee - (appliedDiscount?.discountAmount || 0))}
                </span>
              </div>

              <button
                type="submit"
                disabled={submittingOrder}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow transition text-sm flex items-center justify-center gap-2"
              >
                {submittingOrder ? (
                  <span>Processing your order...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm Order</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Order Success Confirmation Banner / Modal */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-slate-900">Order Placed Successfully!</h3>
            <p className="text-xs text-slate-500">
              Thank you, {orderSuccess.customerName}! Your order has been placed successfully.
            </p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Order #:</span>
                <span className="font-bold text-slate-900">{orderSuccess.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">City:</span>
                <span className="font-bold text-slate-900">{orderSuccess.shippingCity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-bold text-emerald-700">{orderSuccess.paymentMethod}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
                <span>Grand Total:</span>
                <span className="text-slate-900">Rs. {orderSuccess.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              You will receive the tracking updates via SMS or WhatsApp.
            </p>
            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl text-xs transition"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-2">
          <p>Copyright 2026 Khaadi Unstitched Store - Powered by <strong>Pak Commerce Operating System</strong></p>
          <p className="text-[11px] text-slate-500">
            Next-generation e-commerce infrastructure built specifically for Pakistan's digital economy.
          </p>
        </div>
      </footer>
    </div>
  );
}
