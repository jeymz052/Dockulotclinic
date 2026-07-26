"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { FaBoxesStacked, FaChartLine, FaPenToSquare, FaPlus, FaTriangleExclamation, FaTrashCan, FaUsers } from "react-icons/fa6";
import { useRole } from "@/src/components/layout/RoleProvider";

type Product = {
  id: string;
  sku: string;
  name?: string | null;
  brand_name?: string | null;
  generic_name?: string | null;
  dosage?: string | null;
  category: string;
  unit: string;
  description?: string | null;
  supplier_id?: string | null;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  reorder_level: number;
  expiry_date: string | null;
  is_active: boolean;
  suppliers?: { name?: string } | null;
};

type Supplier = {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type Movement = {
  id: string;
  product_id: string;
  movement_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  inventory_products?: { name?: string; brand_name?: string; generic_name?: string; dosage?: string; sku?: string } | null;
};

type ProductForm = {
  sku: string;
  brand_name: string;
  generic_name: string;
  dosage: string;
  category: string;
  unit: string;
  supplier_id: string;
  cost_price: string;
  selling_price: string;
  stock_qty: string;
  reorder_level: string;
  expiry_date: string;
  description: string;
};

const emptyProduct: ProductForm = {
  sku: "",
  brand_name: "",
  generic_name: "",
  dosage: "",
  category: "Medicine",
  unit: "pc",
  supplier_id: "",
  cost_price: "0",
  selling_price: "0",
  stock_qty: "0",
  reorder_level: "0",
  expiry_date: "",
  description: "",
};

type SupplierForm = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
};

const emptySupplier: SupplierForm = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
};

export default function InventoryPage() {
  const { accessToken } = useRole();
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [form, setForm] = useState(emptyProduct);
  const [movement, setMovement] = useState({ product_id: "", movement_type: "StockIn", quantity: "1", notes: "" });
  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Categories");
  const [alertsTab, setAlertsTab] = useState<"expiring" | "reorder">("expiring");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<Supplier | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "suppliers" | "reports">("inventory");

  const authHeaders = useMemo(() => ({
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }), [accessToken]);

  async function load() {
    if (!accessToken) return;
    const [productRes, movementRes, supplierRes] = await Promise.all([
      fetch("/api/v2/inventory/products?active=true", { headers: authHeaders, cache: "no-store" }),
      fetch("/api/v2/inventory/movements", { headers: authHeaders, cache: "no-store" }),
      fetch("/api/v2/inventory/suppliers", { headers: authHeaders, cache: "no-store" }),
    ]);
    if (productRes.ok) setProducts((await productRes.json()).products ?? []);
    if (movementRes.ok) setMovements((await movementRes.json()).movements ?? []);
    if (supplierRes.ok) setSuppliers((await supplierRes.json()).suppliers ?? []);
  }

  useEffect(() => {
    void load();
  }, [accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = useMemo(() => ["All Categories", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);

  const lowStock = products.filter((p) => Number(p.stock_qty) <= Number(p.reorder_level));
  const expiring = products.filter((p) => p.expiry_date && new Date(p.expiry_date).getTime() < Date.now() + 1000 * 60 * 60 * 24 * 45);
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [product.sku, product.brand_name ?? product.name ?? "", product.generic_name ?? "", product.dosage ?? "", product.category, product.suppliers?.name ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      const matchesCategory = categoryFilter === "All Categories" || product.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [categoryFilter, products, search]);
  const alertRows = alertsTab === "expiring" ? expiring : lowStock;
  const totalInventoryValue = products.reduce((sum, product) => sum + Number(product.stock_qty) * Number(product.selling_price), 0);
  const totalInventoryCost = products.reduce((sum, product) => sum + Number(product.stock_qty) * Number(product.cost_price), 0);
  const outOfStock = products.filter((product) => Number(product.stock_qty) <= 0);
  const movementBreakdown = useMemo(() => {
    return ["StockIn", "StockOut", "Sale", "Return", "Adjustment", "Expired"].map((type) => ({
      type,
      count: movements.filter((movementRow) => movementRow.movement_type === type).length,
      quantity: movements
        .filter((movementRow) => movementRow.movement_type === type)
        .reduce((sum, movementRow) => sum + Number(movementRow.quantity ?? 0), 0),
    }));
  }, [movements]);
  const totalStockUnits = products.reduce((sum, product) => sum + Number(product.stock_qty), 0);
  const activeSuppliers = suppliers.length;
  const lowStockCount = lowStock.length;
  const expiringCount = expiring.length;
  const recentMovementCount = movements.slice(0, 12).length;

  async function addProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    setFeedback("");
    const payload = {
      sku: form.sku,
      name: form.brand_name || form.generic_name || form.sku,
      brand_name: form.brand_name,
      generic_name: form.generic_name,
      dosage: form.dosage,
      category: form.category,
      description: form.description || null,
      supplier_id: form.supplier_id || null,
      unit: form.unit,
      cost_price: form.cost_price,
      selling_price: form.selling_price,
      stock_qty: form.stock_qty,
      reorder_level: form.reorder_level,
      expiry_date: form.expiry_date || null,
      is_active: true,
    };
    const res = await fetch(editingProduct ? `/api/v2/inventory/products/${editingProduct.id}` : "/api/v2/inventory/products", {
      method: editingProduct ? "PATCH" : "POST",
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to save product");
      return;
    }
    setForm(emptyProduct);
    setEditingProduct(null);
    setShowAddModal(false);
    setFeedback(editingProduct ? "Product updated." : "Product added.");
    await load();
  }

  async function removeProduct(product: Product) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/inventory/products/${product.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to remove product");
      return;
    }
    setDeleteTarget(null);
    setProducts((current) => current.filter((item) => item.id !== product.id));
    setFeedback("Product removed.");
    await load();
  }

  async function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const res = await fetch("/api/v2/inventory/movements", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify(movement),
    });
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to save movement");
      return;
    }
    setMovement({ product_id: "", movement_type: "StockIn", quantity: "1", notes: "" });
    setFeedback("Stock movement saved.");
    await load();
  }

  function openAddModal() {
    setEditingProduct(null);
    setForm(emptyProduct);
    setShowAddModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    setForm({
      sku: product.sku ?? "",
      brand_name: product.brand_name ?? product.name ?? "",
      generic_name: product.generic_name ?? "",
      dosage: product.dosage ?? "",
      category: product.category ?? "Medicine",
      unit: product.unit ?? "pc",
      supplier_id: product.supplier_id ?? "",
      cost_price: String(product.cost_price ?? 0),
      selling_price: String(product.selling_price ?? 0),
      stock_qty: String(product.stock_qty ?? 0),
      reorder_level: String(product.reorder_level ?? 0),
      expiry_date: product.expiry_date ?? "",
      description: product.description ?? "",
    });
    setShowAddModal(true);
  }

  function openMovementModal(productId = "") {
    setMovement((current) => ({ ...current, product_id: productId }));
    setShowMoveModal(true);
  }

  function openSupplierModal(supplier?: Supplier) {
    setEditingSupplier(supplier ?? null);
    setSupplierForm(
      supplier
        ? {
            name: supplier.name ?? "",
            contact_person: supplier.contact_person ?? "",
            phone: supplier.phone ?? "",
            email: supplier.email ?? "",
            address: supplier.address ?? "",
          }
        : emptySupplier,
    );
    setShowSupplierModal(true);
  }

  async function saveSupplier(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accessToken) return;
    const payload = {
      name: supplierForm.name,
      contact_person: supplierForm.contact_person || null,
      phone: supplierForm.phone || null,
      email: supplierForm.email || null,
      address: supplierForm.address || null,
    };
    const res = await fetch(
      editingSupplier ? `/api/v2/inventory/suppliers/${editingSupplier.id}` : "/api/v2/inventory/suppliers",
      {
        method: editingSupplier ? "PATCH" : "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to save supplier");
      return;
    }
    setSupplierForm(emptySupplier);
    setEditingSupplier(null);
    setShowSupplierModal(false);
    setFeedback(editingSupplier ? "Supplier updated." : "Supplier added.");
    await load();
  }

  async function removeSupplier(supplier: Supplier) {
    if (!accessToken) return;
    const res = await fetch(`/api/v2/inventory/suppliers/${supplier.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    if (!res.ok) {
      setFeedback((await res.json()).message ?? "Unable to remove supplier");
      return;
    }
    setDeleteSupplierTarget(null);
    setFeedback("Supplier removed.");
    await load();
  }

  function exportInventoryCsv() {
    const rows = [
      ["SKU", "Brand", "Generic", "Dosage", "Category", "Supplier", "Unit", "Stock", "Reorder Level", "Cost Price", "Selling Price", "Expiry Date"],
      ...filteredProducts.map((product) => [
        product.sku,
        product.brand_name ?? product.name ?? "",
        product.generic_name ?? "",
        product.dosage ?? "",
        product.category,
        product.suppliers?.name ?? "",
        product.unit,
        String(product.stock_qty),
        String(product.reorder_level),
        String(product.cost_price),
        String(product.selling_price),
        product.expiry_date ?? "",
      ]),
    ];
    downloadCsv("inventory-products-report.csv", rows);
  }

  function exportMovementsCsv() {
    const rows = [
      ["Date", "Type", "SKU", "Product", "Quantity", "Notes"],
      ...movements.map((movementRow) => [
        new Date(movementRow.created_at).toLocaleString("en-PH"),
        movementRow.movement_type,
        movementRow.inventory_products?.sku ?? "",
        movementRow.inventory_products?.brand_name ?? movementRow.inventory_products?.name ?? "Product",
        String(movementRow.quantity),
        movementRow.notes ?? "",
      ]),
    ];
    downloadCsv("inventory-movement-report.csv", rows);
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="overflow-hidden rounded-[2rem] border border-yellow-200/80 bg-white shadow-[0_24px_70px_rgba(14,116,144,0.10)]">
        <div className="grid gap-0 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="bg-[linear-gradient(135deg,#eff8ff_0%,#dff4ff_48%,#fffbeb_100%)] px-6 py-6 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-yellow-700">Inventory System</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-black sm:text-4xl">Inventory Management</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Manage medicines, stock movements, expiry monitoring, supplier records, and inventory reports from one calm, organized workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <HeroPill tone="sky" label={`${products.length} products`} />
              <HeroPill tone="cyan" label={`${totalStockUnits.toLocaleString()} units`} />
              <HeroPill tone="amber" label={`${lowStockCount} low stock`} />
              <HeroPill tone="rose" label={`${expiringCount} expiring soon`} />
            </div>
          </div>
          <div className="grid gap-3 bg-yellow-50/70 p-5 sm:grid-cols-2 xl:grid-cols-1">
            <HeroStat label="Inventory Value" value={formatMoney(totalInventoryValue)} />
            <HeroStat label="Active Suppliers" value={String(activeSuppliers)} />
            <HeroStat label="Recent Movements" value={String(recentMovementCount)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Inventory Value" value={formatMoney(totalInventoryValue)} icon={<FaBoxesStacked />} tone="sky" subtitle="Estimated current retail value" />
        <StatCard title="Low Stock Items" value={lowStockCount} icon={<FaTriangleExclamation />} tone="rose" subtitle="Products at or below reorder level" />
        <StatCard title="Expiring Soon" value={expiringCount} icon={<FaTriangleExclamation />} tone="amber" subtitle="Items expiring within 45 days" />
        <StatCard title="Recent Transactions" value={recentMovementCount} icon={<FaBoxesStacked />} tone="cyan" subtitle="Latest movement entries" />
      </div>

      <section className="rounded-[1.75rem] border border-yellow-200/70 bg-white p-3 shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <div className="grid gap-2 sm:grid-cols-3">
          <SectionTab
            active={activeTab === "inventory"}
            label="Inventory"
            icon={<FaBoxesStacked className="h-4 w-4" />}
            onClick={() => setActiveTab("inventory")}
          />
          <SectionTab
            active={activeTab === "suppliers"}
            label="Suppliers"
            icon={<FaUsers className="h-4 w-4" />}
            onClick={() => setActiveTab("suppliers")}
          />
          <SectionTab
            active={activeTab === "reports"}
            label="Reports"
            icon={<FaChartLine className="h-4 w-4" />}
            onClick={() => setActiveTab("reports")}
          />
        </div>
      </section>

      <section className={activeTab === "inventory" ? "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]" : "hidden"}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-black">Inventory Management</h2>
            <p className="mt-1 text-sm text-slate-600">Search medicines, filter by category, and manage products with compact icon actions.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openMovementModal()} className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-100">
              <FaBoxesStacked className="h-3.5 w-3.5" />
              Stock Movement
            </button>
            <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(120,53,15,0.22)] transition hover:bg-yellow-400">
              <FaPlus className="h-3.5 w-3.5" />
              Add New Drug
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#fefce8_100%)] p-3 shadow-[0_8px_22px_rgba(15,23,42,0.06)]">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
            <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-500">
              <span className="h-4 w-4 rounded-full border border-slate-300" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by Brand Name or Generic Name . . ."
                className="w-full border-0 p-0 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
              />
            </label>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {feedback ? <p className="rounded-xl bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-700">{feedback}</p> : null}

      <section className={activeTab === "inventory" ? "overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]" : "hidden"}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-black">Products</h2>
            <p className="mt-1 text-sm text-slate-500">Showing {filteredProducts.length} of {products.length} results</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left">
            <thead className="border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Brand Name</th>
                <th className="px-5 py-3">Generic Name</th>
                <th className="px-5 py-3">Dosage</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Supplier</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">Reorder</th>
                <th className="px-5 py-3">Price</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const stockLabel = `${Number(product.stock_qty).toLocaleString()} ${product.unit}`;
                return (
                    <tr key={product.id} className="border-b border-slate-100 text-sm text-slate-700 transition hover:bg-yellow-50/60">
                    <td className="px-5 py-3 font-semibold text-black">{product.brand_name ?? product.name ?? product.sku}</td>
                    <td className="px-5 py-3 text-slate-600">{product.generic_name ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-600">{product.dosage ?? "-"}</td>
                    <td className="px-5 py-3 text-slate-600">{product.category}</td>
                    <td className="px-5 py-3 text-slate-600">{product.suppliers?.name ?? "-"}</td>
                    <td className="px-5 py-3 font-medium text-black">{stockLabel}</td>
                    <td className="px-5 py-3 text-slate-600">{Number(product.reorder_level).toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-600">PHP {Number(product.selling_price).toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <IconButton
                          label={`Edit ${product.brand_name ?? product.name ?? product.sku}`}
                          tone="sky"
                          icon={<FaPenToSquare className="h-3.5 w-3.5" />}
                          onClick={() => openEditModal(product)}
                        />
                        <IconButton
                          label={`Delete ${product.brand_name ?? product.name ?? product.sku}`}
                          tone="rose"
                          icon={<FaTrashCan className="h-3.5 w-3.5" />}
                          onClick={() => setDeleteTarget(product)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-14 text-center text-sm text-slate-400">
                    No products match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {activeTab === "inventory" ? (
      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-black tracking-tight text-black">Alerts &amp; Suggestions</h2>
          <p className="mt-1 text-sm text-slate-500">{alertRows.length} items in the active view</p>
          <div className="mt-4 inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
            <TabButton active={alertsTab === "expiring"} onClick={() => setAlertsTab("expiring")}>Expiring Items</TabButton>
            <TabButton active={alertsTab === "reorder"} onClick={() => setAlertsTab("reorder")}>Reorder Suggestion</TabButton>
          </div>
        </div>
        <div className="overflow-x-auto">
          {alertsTab === "expiring" ? (
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Brand Name</th>
                  <th className="px-5 py-3">Batch Number</th>
                  <th className="px-5 py-3">Quantity</th>
                  <th className="px-5 py-3">Expiry Date</th>
                  <th className="px-5 py-3">Days Remaining</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {expiring.map((product) => {
                  const daysRemaining = product.expiry_date ? Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                  return (
                    <tr key={product.id} className="border-b border-slate-100 text-sm transition hover:bg-yellow-50/40">
                      <td className={`px-5 py-3 font-semibold ${daysRemaining != null && daysRemaining < 0 ? "text-yellow-600" : "text-black"}`}>{product.brand_name ?? product.name ?? product.sku}</td>
                      <td className={`px-5 py-3 font-mono text-sm ${daysRemaining != null && daysRemaining < 0 ? "text-yellow-600" : "text-slate-600"}`}>{product.sku}</td>
                      <td className={`px-5 py-3 ${daysRemaining != null && daysRemaining < 0 ? "text-yellow-600" : "text-slate-600"}`}>{Number(product.stock_qty).toLocaleString()} {product.unit}</td>
                      <td className={`px-5 py-3 font-medium ${daysRemaining != null && daysRemaining < 0 ? "text-yellow-600" : "text-amber-400"}`}>{product.expiry_date ?? "-"}</td>
                      <td className={`px-5 py-3 font-semibold ${daysRemaining != null && daysRemaining < 0 ? "text-yellow-600" : "text-amber-400"}`}>{daysRemaining != null ? (daysRemaining < 0 ? "Expired!" : daysRemaining) : "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => openEditModal(product)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-yellow-700 hover:bg-yellow-50">
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {expiring.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">
                      No expiring items found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-5 py-3">Brand Name</th>
                  <th className="px-5 py-3">Generic Name</th>
                  <th className="px-5 py-3">Suggested Quantity</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map((product) => {
                  const suggestedQuantity = Math.max(Number(product.reorder_level) - Number(product.stock_qty), Number(product.reorder_level) || 0);
                  return (
                    <tr key={product.id} className="border-b border-slate-100 text-sm transition hover:bg-yellow-50/40">
                      <td className="px-5 py-3 font-semibold text-black">{product.brand_name ?? product.name ?? product.sku}</td>
                      <td className="px-5 py-3 text-slate-600">{product.generic_name ?? "-"}</td>
                      <td className="px-5 py-3 font-medium text-black">{suggestedQuantity.toLocaleString()} units</td>
                      <td className="px-5 py-3 text-slate-600">Predicted demand based on stock threshold</td>
                      <td className="px-5 py-3 text-amber-400">Pending</td>
                      <td className="px-5 py-3 text-right">
                        <button type="button" onClick={() => openMovementModal(product.id)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-yellow-700 hover:bg-yellow-50">
                          Refill
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {lowStock.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">
                      No reorder suggestions available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
      ) : null}

      <section className={activeTab === "reports" ? "rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]" : "hidden"}>
        <h2 className="text-xl font-black tracking-tight text-black">Inventory Reports</h2>
        <p className="mt-1 text-sm text-slate-500">Product valuation, movement summary, and export-ready inventory reports.</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ReportMetric title="Inventory Cost" value={formatMoney(totalInventoryCost)} subtitle="Estimated based on current cost price" />
          <ReportMetric title="Retail Value" value={formatMoney(totalInventoryValue)} subtitle="Current stock x selling price" />
          <ReportMetric title="Out of Stock" value={outOfStock.length} subtitle="Products with zero stock remaining" />
          <ReportMetric title="Supplier Count" value={suppliers.length} subtitle="Active supplier records in the system" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={exportInventoryCsv} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Export Product Report
          </button>
          <button type="button" onClick={exportMovementsCsv} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Export Movement Report
          </button>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">Movement Breakdown</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {movementBreakdown.map((row) => (
                <div key={row.type} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">{row.type}</p>
                    <p className="text-xs text-slate-500">{row.count} transaction{row.count === 1 ? "" : "s"}</p>
                  </div>
                  <span className="font-mono text-slate-700">{row.quantity.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">Recent Movement Log</h3>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {movements.length > 0 ? (
                movements.slice(0, 12).map((movementRow) => (
                  <div key={movementRow.id} className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-slate-900">
                        {movementRow.inventory_products?.brand_name ?? movementRow.inventory_products?.name ?? "Product"}
                      </p>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        {movementRow.movement_type}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Qty {Number(movementRow.quantity).toLocaleString()} · {new Date(movementRow.created_at).toLocaleString("en-PH")}
                    </p>
                    {movementRow.notes ? <p className="mt-1 text-xs text-slate-500">{movementRow.notes}</p> : null}
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-sm text-slate-400">No recent transactions yet.</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={activeTab === "suppliers" ? "overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.06)]" : "hidden"}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-black">Suppliers</h2>
            <p className="mt-1 text-sm text-slate-500">Store supplier information for medicines and other inventory items.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
              {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
            </span>
            <button type="button" onClick={() => openSupplierModal()} className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2.5 text-sm font-semibold text-yellow-700 transition hover:border-yellow-300 hover:bg-yellow-100">
              <FaPlus className="h-3.5 w-3.5" />
              Add Supplier
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="border-b border-slate-200 bg-gradient-to-r from-amber-50 to-white text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Contact Person</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Address</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} className="border-b border-slate-100 text-sm text-slate-700 transition hover:bg-yellow-50/50">
                  <td className="px-5 py-3 font-semibold text-black">{supplier.name}</td>
                  <td className="px-5 py-3 text-slate-600">{supplier.contact_person ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{supplier.phone ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{supplier.email ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{supplier.address ?? "-"}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <IconButton label={`Edit ${supplier.name}`} tone="sky" icon={<FaPenToSquare className="h-3.5 w-3.5" />} onClick={() => openSupplierModal(supplier)} />
                      <IconButton label={`Delete ${supplier.name}`} tone="rose" icon={<FaTrashCan className="h-3.5 w-3.5" />} onClick={() => setDeleteSupplierTarget(supplier)} />
                    </div>
                  </td>
                </tr>
              ))}
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-400">
                    No suppliers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {showAddModal ? (
        <ProductModal
          title={editingProduct ? "Edit product" : "New product"}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSubmit={addProduct}
          submitLabel={editingProduct ? "Save changes" : "Save product"}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Input compact label="SKU" value={form.sku} onChange={(v) => setForm((s) => ({ ...s, sku: v }))} />
            <Input compact label="Brand name" value={form.brand_name} onChange={(v) => setForm((s) => ({ ...s, brand_name: v }))} />
            <Input compact label="Generic name" value={form.generic_name} onChange={(v) => setForm((s) => ({ ...s, generic_name: v }))} />
            <Input compact label="Dosage" value={form.dosage} onChange={(v) => setForm((s) => ({ ...s, dosage: v }))} />
            <Input compact label="Category" value={form.category} onChange={(v) => setForm((s) => ({ ...s, category: v }))} />
            <Input compact label="Unit" value={form.unit} onChange={(v) => setForm((s) => ({ ...s, unit: v }))} />
            <label className="grid gap-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:col-span-2 xl:col-span-3">
              Supplier
              <select
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                value={form.supplier_id}
                onChange={(event) => setForm((state) => ({ ...state, supplier_id: event.target.value }))}
              >
                <option value="">No supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <Input compact label="Cost price" type="number" value={form.cost_price} onChange={(v) => setForm((s) => ({ ...s, cost_price: v }))} />
            <Input compact label="Selling price" type="number" value={form.selling_price} onChange={(v) => setForm((s) => ({ ...s, selling_price: v }))} />
            <Input compact label="Initial stock" type="number" value={form.stock_qty} onChange={(v) => setForm((s) => ({ ...s, stock_qty: v }))} />
            <Input compact label="Reorder level" type="number" value={form.reorder_level} onChange={(v) => setForm((s) => ({ ...s, reorder_level: v }))} />
            <Input compact label="Expiry date" type="date" value={form.expiry_date} onChange={(v) => setForm((s) => ({ ...s, expiry_date: v }))} />
            <label className="grid gap-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:col-span-2 xl:col-span-3">
              Notes
              <textarea
                className="min-h-20 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                value={form.description}
                onChange={(event) => setForm((state) => ({ ...state, description: event.target.value }))}
              />
            </label>
          </div>
        </ProductModal>
      ) : null}

      {showMoveModal ? (
        <ProductModal
          title="Record stock movement"
          onClose={() => setShowMoveModal(false)}
          onSubmit={saveMovement}
          submitLabel="Save movement"
        >
          <label className="grid gap-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Product
            <select
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              value={movement.product_id}
              onChange={(e) => setMovement((s) => ({ ...s, product_id: e.target.value }))}
              required
            >
              <option value="">Select product</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.sku} - {p.brand_name ?? p.name ?? "Product"}</option>)}
            </select>
          </label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Movement Type
              <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" value={movement.movement_type} onChange={(e) => setMovement((s) => ({ ...s, movement_type: e.target.value }))}>
                {["StockIn", "StockOut", "Sale", "Return", "Adjustment", "Expired"].map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <Input compact label="Quantity" type="number" value={movement.quantity} onChange={(v) => setMovement((s) => ({ ...s, quantity: v }))} />
          </div>
          <label className="mt-3 grid gap-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Notes
            <textarea className="min-h-16 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" placeholder="Notes" value={movement.notes} onChange={(e) => setMovement((s) => ({ ...s, notes: e.target.value }))} />
          </label>
        </ProductModal>
      ) : null}

      {showSupplierModal ? (
        <ProductModal
          title={editingSupplier ? "Edit supplier" : "New supplier"}
          onClose={() => {
            setShowSupplierModal(false);
            setEditingSupplier(null);
          }}
          onSubmit={saveSupplier}
          submitLabel={editingSupplier ? "Save supplier" : "Add supplier"}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input compact label="Supplier name" value={supplierForm.name} onChange={(v) => setSupplierForm((state) => ({ ...state, name: v }))} />
            <Input compact label="Contact person" value={supplierForm.contact_person} onChange={(v) => setSupplierForm((state) => ({ ...state, contact_person: v }))} required={false} />
            <Input compact label="Phone" value={supplierForm.phone} onChange={(v) => setSupplierForm((state) => ({ ...state, phone: v }))} required={false} />
            <Input compact label="Email" value={supplierForm.email} onChange={(v) => setSupplierForm((state) => ({ ...state, email: v }))} type="email" required={false} />
            <label className="grid gap-0.5 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 sm:col-span-2">
              Address
              <textarea
                className="min-h-16 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                value={supplierForm.address}
                onChange={(event) => setSupplierForm((state) => ({ ...state, address: event.target.value }))}
              />
            </label>
          </div>
        </ProductModal>
      ) : null}

      {deleteTarget ? (
        <ConfirmationModal
          title="Delete product?"
          description={`This will deactivate ${deleteTarget.brand_name ?? deleteTarget.name ?? deleteTarget.sku}.`}
          confirmLabel="Delete"
          tone="rose"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => removeProduct(deleteTarget)}
        />
      ) : null}

      {deleteSupplierTarget ? (
        <ConfirmationModal
          title="Delete supplier?"
          description={`This will remove ${deleteSupplierTarget.name} from the supplier list and clear it from linked products.`}
          confirmLabel="Delete"
          tone="rose"
          onCancel={() => setDeleteSupplierTarget(null)}
          onConfirm={() => removeSupplier(deleteSupplierTarget)}
        />
      ) : null}
    </div>
  );
}

function StatCard({ title, value, icon, tone, subtitle }: { title: string; value: string | number; icon: ReactNode; tone: "sky" | "rose" | "amber" | "cyan"; subtitle?: string }) {
  const tones = {
    sky: "border-yellow-100 bg-yellow-50 text-amber-400",
    rose: "border-yellow-100 bg-yellow-50 text-yellow-600",
    amber: "border-yellow-100 bg-yellow-50 text-amber-400",
    cyan: "border-yellow-100 bg-yellow-50 text-amber-400",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_22px_rgba(15,23,42,0.08)]">
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl border ${tones[tone]}`}>{icon}</div>
      <p className="mt-3 text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-1 text-3xl font-black text-black">{value}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

function ReportMetric({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-black text-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${active ? "bg-white text-yellow-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
      {children}
    </button>
  );
}

function SectionTab({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-3 rounded-[1.1rem] px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-linear-to-r from-yellow-400 to-yellow-400 text-white shadow-[0_12px_28px_rgba(120,53,15,0.25)]"
          : "bg-slate-50 text-slate-700 hover:bg-yellow-50"
      }`}
    >
      <span className={`rounded-full p-2 ${active ? "bg-white/15" : "bg-yellow-100 text-yellow-700"}`}>{icon}</span>
      {label}
    </button>
  );
}

function IconButton({ label, tone, icon, onClick }: { label: string; tone: "sky" | "rose"; icon: ReactNode; onClick: () => void }) {
  const tones = {
    sky: "border-slate-200 bg-white text-slate-700 hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700",
    rose: "border-slate-200 bg-white text-slate-700 hover:border-yellow-300 hover:bg-yellow-50 hover:text-yellow-700",
  };

  return (
    <button type="button" onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${tones[tone]}`} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

function ProductModal({ title, submitLabel, onClose, onSubmit, children }: { title: string; submitLabel: string; onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-md">
      <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className="h-1.5 bg-linear-to-r from-yellow-300 via-amber-400 to-yellow-300" />
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-[linear-gradient(180deg,#fffbeb_0%,#ffffff_100%)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700 shadow-sm">
              <FaBoxesStacked className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-yellow-700">Inventory</p>
              <h3 className="mt-1 text-lg font-bold tracking-tight text-black">{title}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">Keep the form compact and clean so you can add inventory quickly without extra scrolling.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-yellow-200 hover:bg-yellow-50 hover:text-yellow-700">
            Close
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            await onSubmit(e);
          }}
          className="max-h-[calc(100vh-5rem)] overflow-y-auto px-5 py-4"
        >
          <div className="mb-3 rounded-2xl border border-yellow-100 bg-yellow-50/70 px-4 py-2.5 text-xs leading-5 text-slate-600">
            Keep SKU, brand, and supplier consistent for cleaner records.
          </div>
          {children}
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" className="rounded-full bg-yellow-400 px-4 py-2 text-sm font-bold text-white shadow-[0_12px_24px_rgba(120,53,15,0.22)] transition hover:bg-yellow-400">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmationModal({ title, description, confirmLabel, tone, onCancel, onConfirm }: { title: string; description: string; confirmLabel: string; tone: "rose" | "sky"; onCancel: () => void; onConfirm: () => void }) {
  const confirmTone = tone === "rose" ? "bg-yellow-600 hover:bg-yellow-700" : "bg-yellow-400 hover:bg-yellow-400";

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 backdrop-blur-md">
      <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
        <div className={`h-1.5 ${tone === "rose" ? "bg-linear-to-r from-yellow-500 to-yellow-300" : "bg-linear-to-r from-yellow-300 to-yellow-400"}`} />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === "rose" ? "bg-yellow-100 text-yellow-700" : "bg-yellow-100 text-yellow-700"}`}>
              <FaTriangleExclamation className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight text-black">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={`rounded-full px-5 py-2.5 text-sm font-bold text-white ${confirmTone}`}>
            {confirmLabel}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Input({ label, value, onChange, type = "text", required = true, compact = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; compact?: boolean }) {
  return (
    <label className={`grid ${compact ? "gap-0.5" : "gap-1"} text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500`}>
      {label}
      <input required={required} className={`rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-amber-400 focus:ring-4 focus:ring-amber-100 ${compact ? "py-2" : "py-2.5"}`} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function HeroPill({ label, tone }: { label: string; tone: "sky" | "cyan" | "amber" | "rose" }) {
  const tones = {
    sky: "border-yellow-200 bg-yellow-50 text-yellow-700",
    cyan: "border-yellow-200 bg-yellow-50 text-yellow-700",
    amber: "border-yellow-200 bg-yellow-50 text-yellow-700",
    rose: "border-yellow-200 bg-yellow-50 text-yellow-700",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold ${tones[tone]}`}>
      {label}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-yellow-100 bg-white/80 px-4 py-4 shadow-[0_10px_24px_rgba(14,116,144,0.08)] backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-black">{value}</p>
    </div>
  );
}
