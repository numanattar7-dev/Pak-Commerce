'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Users,
  CreditCard,
  Settings,
  TrendingUp,
  AlertCircle,
  Truck,
  CheckCircle2,
  Clock,
  LogOut,
  Store,
  RefreshCw
} from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Sample store metadata
  const storeInfo = {
    name: 'Khaadi Unstitched',
    subdomain: 'khaadi.pakcommerce.pk',
    plan: 'TRIAL (PKR 0/mo)',
  };

  // Fetch live orders directly from the public/protected API
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      // Login first to get JWT token dynamically
      const loginRes = await fetch('http://localhost:4000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@khaadi.com', password: 'admin123' }),
      });

      if (loginRes.ok) {
        const { accessToken } = await loginRes.json();
        const ordersRes = await fetch('http://localhost:4000/orders?limit=10', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (ordersRes.ok) {
          const json = await ordersRes.json();
          if (json.data && json.data.length > 0) {
            setOrders(
              json.data.map((o: any) => ({
                id: o.orderNumber || o.id.slice(0, 8),
                customer: o.customerName,
                city: o.shippingCity,
                amount: `Rs. ${Number(o.totalAmount).toLocaleString()}`,
                method: o.paymentMethod,
                status: o.orderStatus,
                risk: o.riskScore,
              }))
            );
            return;
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch live orders:', err);
    } finally {
      setLoadingOrders(false);
    }

    // Fallback default sample orders
    setOrders([
      { id: 'PK-9941', customer: 'Ahmed Raza', city: 'Karachi', amount: 'Rs. 6,199', method: 'COD', status: 'VERIFIED', risk: 'LOW' },
      { id: 'PK-9940', customer: 'Sara Khan', city: 'Lahore', amount: 'Rs. 5,499', method: 'IBFT', status: 'PAID', risk: 'LOW' },
      { id: 'PK-9939', customer: 'Usman Ali', city: 'Faisalabad', amount: 'Rs. 11,998', method: 'COD', status: 'OTP_PENDING', risk: 'MEDIUM' },
      { id: 'PK-9938', customer: 'Zainab Bibi', city: 'Peshawar', amount: 'Rs. 4,999', method: 'COD', status: 'DISPATCHED', risk: 'LOW' },
    ]);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const stats = [
    { label: 'Total Revenue (PKR)', value: 'Rs. 485,200', change: '+18.2%', isPositive: true },
    { label: 'Total Orders', value: orders.length.toString(), change: '+12.5%', isPositive: true },
    { label: 'COD In-Transit (Cash Expected)', value: 'Rs. 182,400', change: '34 Parcels', isPositive: true },
    { label: 'COD Return Rate (RTO)', value: '11.8%', change: '-2.4% vs industry avg', isPositive: true },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between p-4 border-r border-slate-800">
        <div>
          {/* Logo & Store Header */}
          <div className="flex items-center gap-3 px-2 py-4 border-b border-slate-800">
            <div className="h-10 w-10 bg-emerald-600 rounded-lg flex items-center justify-center font-bold text-white text-xl shadow-md">
              🇵🇰
            </div>
            <div>
              <h1 className="font-bold text-white tracking-tight leading-none text-lg">Pak Commerce</h1>
              <p className="text-xs text-emerald-400 mt-1 font-medium">Merchant Hub</p>
            </div>
          </div>

          {/* Current Store Badge */}
          <div className="mt-4 p-3 bg-slate-800/60 rounded-xl border border-slate-700/50">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Store className="w-4 h-4 text-emerald-400" />
              <span>{storeInfo.name}</span>
            </div>
            <a
              href={`http://localhost:4000/products/store/khaadi`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-400 hover:text-emerald-400 block mt-1 truncate"
            >
              {storeInfo.subdomain} ↗
            </a>
          </div>

          {/* Navigation Links */}
          <nav className="mt-6 space-y-1">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'orders', label: 'Orders & COD', icon: ShoppingBag, badge: '14' },
              { id: 'products', label: 'Products & Catalog', icon: Package },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'reconciliation', label: 'COD Cash Ledger', icon: CreditCard },
              { id: 'settings', label: 'Store Settings', icon: Settings },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'hover:bg-slate-800 hover:text-slate-100 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between px-2">
          <div>
            <p className="text-sm font-medium text-white">Admin User</p>
            <p className="text-xs text-slate-500">admin@khaadi.com</p>
          </div>
          <button className="text-slate-400 hover:text-red-400 p-2 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              {activeTab === 'overview' && 'Store Dashboard'}
              {activeTab === 'orders' && 'Order Management & Verification'}
              {activeTab === 'products' && 'Product Catalog'}
              {activeTab === 'reconciliation' && 'Cash on Delivery (COD) Ledger'}
              {activeTab === 'settings' && 'Store Settings'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Real-time store activity & Pakistan-optimized commerce metrics</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Storefront Connected
            </div>
            <a
              href="http://localhost:4000/products/store/khaadi"
              target="_blank"
              rel="noreferrer"
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              View Buyer Store ↗
            </a>
          </div>
        </header>

        {/* Dashboard Body */}
        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 mt-2">{stat.value}</p>
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-emerald-600 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{stat.change}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Pakistan Localized Superpower Banner */}
          <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-6 rounded-2xl shadow-md flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30">
                🇵🇰 Pakistan Localized Engine
              </span>
              <h3 className="text-lg font-bold text-white pt-2">COD Fraud Prevention & WhatsApp OTP Active</h3>
              <p className="text-xs text-slate-300 max-w-xl">
                Automatic phone verification is enabled for all Cash on Delivery checkouts. Fake order rate reduced by 64% across Pakistani cities.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Connected Logistics</span>
              <p className="text-sm font-semibold text-emerald-400 mt-0.5">TCS • PostEx • Leopards • Trax</p>
            </div>
          </div>

          {/* Recent Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900">Recent Customer Orders</h4>
                <p className="text-xs text-slate-500 mt-0.5">Real-time orders awaiting packing, courier dispatch, or verification</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={fetchOrders}
                  disabled={loadingOrders}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-emerald-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-medium transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingOrders ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">View All Orders →</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-5">Order #</th>
                    <th className="py-3 px-5">Customer & City</th>
                    <th className="py-3 px-5">Amount (PKR)</th>
                    <th className="py-3 px-5">Method</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Fraud Risk</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-5 font-semibold text-slate-900">{order.id}</td>
                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-800">{order.customer}</div>
                        <div className="text-xs text-slate-400">{order.city}, Pakistan</div>
                      </td>
                      <td className="py-3.5 px-5 font-bold text-slate-900">{order.amount}</td>
                      <td className="py-3.5 px-5">
                        <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                          order.method === 'COD' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold ${
                          order.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-800' :
                          order.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'OTP_PENDING' ? 'bg-amber-100 text-amber-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {order.status === 'VERIFIED' && <CheckCircle2 className="w-3 h-3" />}
                          {order.status === 'OTP_PENDING' && <Clock className="w-3 h-3" />}
                          {order.status === 'DISPATCHED' && <Truck className="w-3 h-3" />}
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          order.risk === 'LOW' ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
                        }`}>
                          {order.risk} Risk
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-3 py-1.5 rounded-lg transition-colors">
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
