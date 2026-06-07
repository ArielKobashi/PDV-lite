const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Constantes de validação
const VALIDATION = {
  minPrice: 0.01,
  maxDiscount: 100,
  barcodeLength: { min: 6, max: 14 },
  stockAlertThreshold: 12
};

const defaultProducts = [
  { id: crypto.randomUUID(), name: "Arroz Branco 5kg", barcode: "7891000100011", category: "Mercearia", price: 27.9, stock: 36, sku: "ARZ001" },
  { id: crypto.randomUUID(), name: "Feijão Carioca 1kg", barcode: "7891000100028", category: "Mercearia", price: 8.49, stock: 42, sku: "FEJ001" },
  { id: crypto.randomUUID(), name: "Óleo de Soja 900ml", barcode: "7891000100035", category: "Mercearia", price: 6.99, stock: 28, sku: "OLE001" },
  { id: crypto.randomUUID(), name: "Açúcar Refinado 1kg", barcode: "7891000100042", category: "Mercearia", price: 4.89, stock: 31, sku: "ACU001" },
  { id: crypto.randomUUID(), name: "Café Tradicional 500g", barcode: "7891000100059", category: "Bebidas", price: 18.9, stock: 18, sku: "CAF001" },
  { id: crypto.randomUUID(), name: "Leite Integral 1L", barcode: "7891000100066", category: "Laticínios", price: 5.79, stock: 54, sku: "LEI001" },
  { id: crypto.randomUUID(), name: "Queijo Mussarela 500g", barcode: "7891000100073", category: "Laticínios", price: 24.5, stock: 10, sku: "QUE001" },
  { id: crypto.randomUUID(), name: "Pão Francês kg", barcode: "7891000100080", category: "Padaria", price: 15.99, stock: 22, sku: "PAO001" },
  { id: crypto.randomUUID(), name: "Banana Nanica kg", barcode: "7891000100097", category: "Hortifruti", price: 6.49, stock: 16, sku: "BAN001" },
  { id: crypto.randomUUID(), name: "Detergente Neutro 500ml", barcode: "7891000100103", category: "Limpeza", price: 2.79, stock: 46, sku: "DET001" }
];

const state = {
  products: load("pdv_products", defaultProducts),
  sales: load("pdv_sales", []),
  settings: load("pdv_settings", { storeName: "Mercado Fácil", operator: "Caixa 01", document: "00.000.000/0001-00", takeoutTax: 0 }),
  cart: [],
  category: "Todos",
  sessionStart: load("pdv_sessionStart", new Date().toISOString()),
  filterType: "all"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function toast(message, type = "info") {
  const box = $("#toast");
  box.textContent = message;
  box.className = `toast show toast-${type}`;
  setTimeout(() => box.classList.remove("show"), 2200);
}

function notify(title, message, type = "info") {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body: message, icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='45' fill='%230e7a6f'/><text x='50' y='65' font-size='50' font-weight='bold' fill='white' text-anchor='middle'>MF</text></svg>" });
  }
}

function validateProduct(product) {
  const errors = [];
  if (!product.name?.trim()) errors.push("Nome do produto é obrigatório");
  if (!product.barcode?.trim()) errors.push("Código de barras é obrigatório");
  if (product.barcode && (product.barcode.length < VALIDATION.barcodeLength.min || product.barcode.length > VALIDATION.barcodeLength.max)) {
    errors.push(`Código deve ter entre ${VALIDATION.barcodeLength.min} e ${VALIDATION.barcodeLength.max} dígitos`);
  }
  if (!product.category?.trim()) errors.push("Categoria é obrigatória");
  if (product.price < VALIDATION.minPrice) errors.push("Preço deve ser maior que R$ 0,00");
  if (product.stock < 0) errors.push("Estoque não pode ser negativo");
  if (!/^\d+$/.test(product.barcode)) errors.push("Código deve conter apenas números");
  return errors;
}

function searchProductByBarcode(barcode) {
  return state.products.find(p => p.barcode === barcode.trim());
}

function cartSubtotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function currentTotal() {
  const discount = Number($("#discountInput").value || 0);
  const surcharge = Number($("#surchargeInput").value || 0);
  return Math.max(0, cartSubtotal() - discount + surcharge);
}

function applyDiscountPercentage(percentage) {
  const percent = Number(percentage || 0);
  if (percent < 0 || percent > 100) return toast("Percentual deve estar entre 0 e 100", "warning");
  const discount = (cartSubtotal() * percent) / 100;
  $("#discountInput").value = discount.toFixed(2);
  renderCart();
}

function renderAll() {
  $("#currentDate").textContent = new Date().toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
  $("#operatorName").textContent = state.settings.operator;
  $("#storeNameInput").value = state.settings.storeName;
  $("#operatorInput").value = state.settings.operator;
  $("#documentInput").value = state.settings.document;
  $("#takeoutTaxInput").value = state.settings.takeoutTax || 0;
  renderCategories();
  renderProducts();
  renderCart();
  renderProductTable();
  renderSales();
  renderReports();
}

function renderCategories() {
  const categories = ["Todos", ...new Set(state.products.map((product) => product.category))];
  $("#quickCategories").innerHTML = categories.map((category) => (
    `<button type="button" class="${category === state.category ? "selected" : ""}" data-category="${category}">${category}</button>`
  )).join("");
}

function renderProducts() {
  const query = $("#productSearch").value.trim().toLowerCase();
  const list = state.products.filter((product) => {
    const matchesQuery = [product.name, product.barcode, product.category, product.sku || ""].join(" ").toLowerCase().includes(query);
    const matchesCategory = state.category === "Todos" || product.category === state.category;
    const matchesFilter = filterProductsByType(product);
    return matchesQuery && matchesCategory && matchesFilter;
  });

  $("#productList").innerHTML = list.map((product) => `
    <article class="product-item ${product.stock <= 0 ? "out-of-stock" : ""} ${product.stock <= VALIDATION.stockAlertThreshold ? "low-stock" : ""}">
      <div>
        <div class="item-title">${product.name}</div>
        <div class="item-meta">${product.barcode} • ${product.category} • estoque ${product.stock}</div>
        ${product.sku ? `<div class="item-sku">SKU: ${product.sku}</div>` : ""}
      </div>
      <button type="button" data-add="${product.id}" ${product.stock <= 0 ? "disabled" : ""}>${money.format(product.price)}</button>
    </article>
  `).join("") || `<div class="stock-item">Nenhum produto encontrado.</div>`;
}

function filterProductsByType(product) {
  if (state.filterType === "all") return true;
  if (state.filterType === "low") return product.stock > 0 && product.stock <= VALIDATION.stockAlertThreshold;
  if (state.filterType === "out") return product.stock <= 0;
  return true;
}

function renderCart() {
  $("#cartList").innerHTML = state.cart.map((item) => `
    <article class="cart-item">
      <div>
        <div class="item-title">${item.name}</div>
        <div class="item-meta">${money.format(item.price)} cada • ${money.format(item.price * item.qty)}</div>
      </div>
      <div class="qty-control">
        <button type="button" data-dec="${item.id}" title="Diminuir quantidade">−</button>
        <input type="number" class="qty-input" data-qty="${item.id}" value="${item.qty}" min="1">
        <button type="button" data-inc="${item.id}" title="Aumentar quantidade">+</button>
        <button type="button" data-remove="${item.id}" title="Remover do carrinho">×</button>
      </div>
    </article>
  `).join("") || `<div class="stock-item">Carrinho vazio.</div>`;

  const subtotal = cartSubtotal();
  const discount = Number($("#discountInput").value || 0);
  const surcharge = Number($("#surchargeInput").value || 0);
  const total = currentTotal();

  $("#subtotalValue").textContent = money.format(subtotal);
  $("#discountValue").textContent = money.format(discount);
  $("#surchargeValue").textContent = money.format(surcharge);
  $("#totalValue").textContent = money.format(total);
  $("#checkoutBtn").disabled = state.cart.length === 0;

  // Atualizar inputs de quantidade
  $$(".qty-input").forEach(input => {
    input.addEventListener("change", (e) => {
      const itemId = e.target.dataset.qty;
      const newQty = parseInt(e.target.value, 10);
      if (newQty > 0) changeQty(itemId, newQty - (state.cart.find(i => i.id === itemId)?.qty || 0));
    });
  });
}

function renderProductTable() {
  const sortBy = $("#productSortSelect").value || "name";
  const sorted = [...state.products].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "stock") return a.stock - b.stock;
    if (sortBy === "category") return a.category.localeCompare(b.category);
    return 0;
  });

  $("#productsTable").innerHTML = sorted.map((product) => `
    <tr class="${product.stock <= 0 ? "out-of-stock-row" : ""}">
      <td><strong>${product.name}</strong>${product.sku ? `<br><small>SKU: ${product.sku}</small>` : ""}</td>
      <td>${product.barcode}</td>
      <td>${product.category}</td>
      <td>${money.format(product.price)}</td>
      <td class="${product.stock <= VALIDATION.stockAlertThreshold ? "critical-stock" : ""}">${product.stock}</td>
      <td class="table-actions">
        <button class="ghost-btn small" type="button" data-edit="${product.id}">Editar</button>
        <button class="danger-btn small" type="button" data-delete="${product.id}">Excluir</button>
      </td>
    </tr>
  `).join("");
}

function renderSales() {
  const filterDate = $("#salesDateFilter").value;
  let filtered = state.sales;

  if (filterDate === "today") {
    const today = new Date().toISOString().slice(0, 10);
    filtered = state.sales.filter(s => s.date.slice(0, 10) === today);
  } else if (filterDate === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    filtered = state.sales.filter(s => s.date.slice(0, 10) >= weekAgo);
  } else if (filterDate === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    filtered = state.sales.filter(s => s.date.slice(0, 10) >= monthAgo);
  }

  $("#salesTable").innerHTML = filtered.map((sale) => `
    <tr>
      <td><strong>#${sale.number}</strong></td>
      <td>${new Date(sale.date).toLocaleString("pt-BR")}</td>
      <td>${sale.items.reduce((sum, item) => sum + item.qty, 0)}</td>
      <td>${sale.paymentsLabel}</td>
      <td><strong>${money.format(sale.total)}</strong></td>
      <td class="table-actions"><button class="ghost-btn small" type="button" data-receipt="${sale.id}">Recibo</button></td>
    </tr>
  `).join("") || `<tr><td colspan="6">Nenhuma venda registrada.</td></tr>`;
}

function renderReports() {
  const today = new Date().toISOString().slice(0, 10);
  const sales = state.sales.filter((sale) => sale.date.slice(0, 10) === today);
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
  const items = sales.flatMap((sale) => sale.items).reduce((sum, item) => sum + item.qty, 0);
  
  const allRevenue = state.sales.reduce((sum, sale) => sum + sale.total, 0);
  const allItems = state.sales.flatMap((sale) => sale.items).reduce((sum, item) => sum + item.qty, 0);
  
  const sessionDuration = new Date() - new Date(state.sessionStart);
  const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
  const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

  $("#todaySales").textContent = sales.length;
  $("#todayRevenue").textContent = money.format(revenue);
  $("#avgTicket").textContent = money.format(sales.length ? revenue / sales.length : 0);
  $("#itemsSold").textContent = items;
  $("#totalRevenue").textContent = money.format(allRevenue);
  $("#totalItems").textContent = allItems;
  $("#sessionDuration").textContent = `${hours}h ${minutes}m`;

  $("#stockAlerts").innerHTML = state.products
    .filter((product) => product.stock <= VALIDATION.stockAlertThreshold)
    .sort((a, b) => a.stock - b.stock)
    .map((product) => `
      <div class="stock-item ${product.stock <= 0 ? "critical" : ""}">
        <strong>${product.name}</strong>
        <span>${product.stock} ${product.stock === 1 ? "unidade" : "unidades"}</span>
      </div>
    `)
    .join("") || `<div class="stock-item">Nenhum alerta de estoque.</div>`;
}

function addToCart(id) {
  const product = state.products.find((item) => item.id === id);
  const current = state.cart.find((item) => item.id === id);
  const qtyInCart = current?.qty ?? 0;
  if (!product || qtyInCart >= product.stock) {
    toast("Estoque indisponível para este item.", "warning");
    return;
  }
  if (current) current.qty += 1;
  else state.cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
  toast(`${product.name} adicionado ao carrinho`, "success");
  renderCart();
}

function changeQty(id, delta) {
  const item = state.cart.find((cartItem) => cartItem.id === id);
  const product = state.products.find((productItem) => productItem.id === id);
  if (!item || !product) return;
  item.qty += delta;
  if (item.qty > product.stock) item.qty = product.stock;
  if (item.qty <= 0) state.cart = state.cart.filter((cartItem) => cartItem.id !== id);
  renderCart();
}

function openPayment() {
  if (!state.cart.length) return toast("Adicione itens antes de receber.", "warning");
  $("#paymentTotal").textContent = money.format(currentTotal());
  ["#cashInput", "#pixInput", "#cardInput"].forEach((selector) => $(selector).value = 0);
  renderPaymentTotals();
  $("#paymentDialog").showModal();
  $("#cashInput").focus();
}

function renderPaymentTotals() {
  const paid = ["#cashInput", "#pixInput", "#cardInput"].reduce((sum, selector) => sum + Number($(selector).value || 0), 0);
  const change = Math.max(0, paid - currentTotal());
  $("#paidValue").textContent = money.format(paid);
  $("#changeValue").textContent = money.format(change);
}

function finishSale() {
  const total = currentTotal();
  const cash = Number($("#cashInput").value || 0);
  const pix = Number($("#pixInput").value || 0);
  const card = Number($("#cardInput").value || 0);
  const paid = cash + pix + card;
  if (paid < total) return toast("Valor recebido ainda é menor que o total.", "warning");

  const payments = [
    ["Dinheiro", cash],
    ["Pix", pix],
    ["Cartão", card]
  ].filter(([, value]) => value > 0);

  const sale = {
    id: crypto.randomUUID(),
    number: String(state.sales.length + 1).padStart(6, "0"),
    date: new Date().toISOString(),
    operator: state.settings.operator,
    items: structuredClone(state.cart),
    subtotal: cartSubtotal(),
    discount: Number($("#discountInput").value || 0),
    surcharge: Number($("#surchargeInput").value || 0),
    total,
    paid,
    change: Math.max(0, paid - total),
    payments,
    paymentsLabel: payments.map(([name, value]) => `${name} ${money.format(value)}`).join(" + ")
  };

  sale.items.forEach((item) => {
    const product = state.products.find((productItem) => productItem.id === item.id);
    if (product) product.stock -= item.qty;
  });

  state.sales.unshift(sale);
  save("pdv_products", state.products);
  save("pdv_sales", state.sales);
  state.cart = [];
  $("#discountInput").value = 0;
  $("#surchargeInput").value = 0;
  $("#paymentDialog").close();
  renderAll();
  showReceipt(sale);
  notify("Venda Concluída", `Venda #${sale.number} finalizada com sucesso!`, "success");
}

function showReceipt(sale) {
  $("#receiptText").textContent = buildReceipt(sale);
  $("#receiptDialog").showModal();
}

function buildReceipt(sale) {
  const lines = [
    "=".repeat(40),
    state.settings.storeName.padEnd(40),
    `CNPJ: ${state.settings.document}`.padEnd(40),
    "=".repeat(40),
    `VENDA #${sale.number}`,
    `Data: ${new Date(sale.date).toLocaleString("pt-BR")}`,
    `Operador: ${sale.operator}`,
    "-".repeat(40),
    "DESCRIÇÃO              QTD    PREÇO    TOTAL",
    "-".repeat(40),
    ...sale.items.map((item) => {
      const qty = String(item.qty).padStart(3);
      const price = money.format(item.price).padStart(9);
      const total = money.format(item.price * item.qty).padStart(10);
      return `${item.name.substring(0, 18).padEnd(18)} ${qty}  ${price} ${total}`;
    }),
    "-".repeat(40),
    `SUBTOTAL: ${money.format(sale.subtotal).padStart(32)}`,
    sale.discount > 0 ? `DESCONTO: ${money.format(sale.discount).padStart(33)}` : "",
    sale.surcharge > 0 ? `ACRÉSCIMO: ${money.format(sale.surcharge).padStart(31)}` : "",
    "=".repeat(40),
    `TOTAL: ${money.format(sale.total).padStart(35)}`,
    `PAGO: ${money.format(sale.paid).padStart(35)}`,
    `TROCO: ${money.format(sale.change).padStart(34)}`,
    "-".repeat(40),
    "FORMAS DE PAGAMENTO:",
    ...sale.payments.map(([name, value]) => `  ${name}: ${money.format(value)}`),
    "=".repeat(40),
    "Obrigado pela preferência!".padStart(33),
    new Date(sale.date).toLocaleString("pt-BR").padStart(40),
    "=".repeat(40)
  ].filter(line => line !== "");
  return lines.join("\n");
}

function saveProduct(event) {
  event.preventDefault();
  const id = $("#productId").value || crypto.randomUUID();
  const product = {
    id,
    name: $("#nameInput").value.trim(),
    barcode: $("#barcodeInput").value.trim(),
    category: $("#categoryInput").value.trim(),
    price: Number($("#priceInput").value || 0),
    stock: Number($("#stockInput").value || 0),
    sku: $("#skuInput").value.trim() || ""
  };

  const errors = validateProduct(product);
  if (errors.length > 0) {
    toast(errors.join("\n"), "error");
    return;
  }

  const index = state.products.findIndex((item) => item.id === id);
  if (index >= 0) {
    state.products[index] = product;
    toast("Produto atualizado com sucesso.", "success");
  } else {
    state.products.push(product);
    toast("Produto criado com sucesso.", "success");
  }
  save("pdv_products", state.products);
  $("#productForm").reset();
  $("#productId").value = "";
  renderAll();
}

function editProduct(id) {
  const product = state.products.find((item) => item.id === id);
  if (!product) return;
  $("#productId").value = product.id;
  $("#nameInput").value = product.name;
  $("#barcodeInput").value = product.barcode;
  $("#categoryInput").value = product.category;
  $("#priceInput").value = product.price;
  $("#stockInput").value = product.stock;
  $("#skuInput").value = product.sku || "";
  switchView("products");
  $("#nameInput").focus();
}

function deleteProduct(id) {
  if (!confirm("Tem certeza que deseja excluir este produto?")) return;
  if (state.cart.some((item) => item.id === id)) return toast("Remova o produto do carrinho antes.", "warning");
  const product = state.products.find(p => p.id === id);
  state.products = state.products.filter((p) => p.id !== id);
  save("pdv_products", state.products);
  toast(`Produto "${product.name}" excluído.`, "success");
  renderAll();
}

function duplicateProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  const newProduct = { ...product, id: crypto.randomUUID(), name: `${product.name} (cópia)` };
  state.products.push(newProduct);
  save("pdv_products", state.products);
  toast("Produto duplicado com sucesso.", "success");
  renderAll();
}

function switchView(view) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  $$(".view").forEach((panel) => panel.classList.remove("active"));
  $(`#${view}View`).classList.add("active");
  $("#viewTitle").textContent = { cashier: "Caixa", products: "Produtos", sales: "Vendas", reports: "Resumo", settings: "Configurações" }[view];
  
  if (view === "products") $("#nameInput").focus();
}

function exportSales() {
  const header = "numero,data,itens,pagamento,total\n";
  const rows = state.sales.map((sale) => [
    sale.number,
    new Date(sale.date).toLocaleString("pt-BR"),
    sale.items.reduce((sum, item) => sum + item.qty, 0),
    sale.paymentsLabel,
    sale.total.toFixed(2)
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `vendas-pdv-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Vendas exportadas com sucesso.", "success");
}

function exportProducts() {
  const header = "nome,codigo,categoria,preco,estoque,sku\n";
  const rows = state.products.map((product) => [
    product.name,
    product.barcode,
    product.category,
    product.price.toFixed(2),
    product.stock,
    product.sku || ""
  ].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","));
  const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `produtos-pdv-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Produtos exportados com sucesso.", "success");
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// Event Listeners
document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.matches(".nav-item")) switchView(target.dataset.view);
  if (target.dataset.add) addToCart(target.dataset.add);
  if (target.dataset.inc) changeQty(target.dataset.inc, 1);
  if (target.dataset.dec) changeQty(target.dataset.dec, -1);
  if (target.dataset.remove) {
    state.cart = state.cart.filter((item) => item.id !== target.dataset.remove);
    renderCart();
  }
  if (target.dataset.category) {
    state.category = target.dataset.category;
    renderCategories();
    renderProducts();
  }
  if (target.dataset.edit) editProduct(target.dataset.edit);
  if (target.dataset.delete) deleteProduct(target.dataset.delete);
  if (target.dataset.duplicate) duplicateProduct(target.dataset.duplicate);
  if (target.dataset.receipt) {
    const sale = state.sales.find((item) => item.id === target.dataset.receipt);
    if (sale) showReceipt(sale);
  }
});

$("#productSearch").addEventListener("input", renderProducts);
$("#focusSearchBtn").addEventListener("click", () => $("#productSearch").focus());
$("#productSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const product = searchProductByBarcode($("#productSearch").value);
    if (product && product.stock > 0) {
      addToCart(product.id);
      $("#productSearch").value = "";
      renderProducts();
    }
  }
});

$("#clearCartBtn").addEventListener("click", () => { 
  if (confirm("Deseja limpar o carrinho?")) {
    state.cart = []; 
    renderCart(); 
  }
});

$("#newSaleBtn").addEventListener("click", () => { 
  state.cart = []; 
  $("#discountInput").value = 0; 
  $("#surchargeInput").value = 0; 
  renderCart(); 
  toast("Nova venda iniciada.", "success");
});

$("#checkoutBtn").addEventListener("click", openPayment);
$("#finishSaleBtn").addEventListener("click", finishSale);
$("#productForm").addEventListener("submit", saveProduct);
$("#exportSalesBtn").addEventListener("click", exportSales);
$("#exportProductsBtn").addEventListener("click", exportProducts);
$("#productSortSelect").addEventListener("change", renderProductTable);
$("#salesDateFilter").addEventListener("change", renderSales);
$("#productFilterBtn").addEventListener("click", () => {
  state.filterType = state.filterType === "all" ? "low" : state.filterType === "low" ? "out" : "all";
  renderProducts();
});

$("#saveSettingsBtn").addEventListener("click", () => {
  state.settings = {
    storeName: $("#storeNameInput").value.trim() || "Mercado Fácil",
    operator: $("#operatorInput").value.trim() || "Caixa 01",
    document: $("#documentInput").value.trim() || "00.000.000/0001-00",
    takeoutTax: Number($("#takeoutTaxInput").value || 0)
  };
  save("pdv_settings", state.settings);
  toast("Configurações salvas com sucesso.", "success");
  renderAll();
});

$("#closeReceiptBtn").addEventListener("click", () => $("#receiptDialog").close());
$("#copyReceiptBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#receiptText").textContent);
  toast("Recibo copiado para a área de transferência.", "success");
});
$("#printReceiptBtn").addEventListener("click", () => window.print());

["#discountInput", "#surchargeInput"].forEach((selector) => $(selector).addEventListener("input", renderCart));
["#cashInput", "#pixInput", "#cardInput"].forEach((selector) => $(selector).addEventListener("input", renderPaymentTotals));

// Atalhos de teclado
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey) {
    if (event.key === "1") { event.preventDefault(); switchView("cashier"); }
    if (event.key === "2") { event.preventDefault(); switchView("products"); }
    if (event.key === "3") { event.preventDefault(); switchView("sales"); }
    if (event.key === "4") { event.preventDefault(); switchView("reports"); }
    if (event.key === "5") { event.preventDefault(); switchView("settings"); }
  }
  
  if (event.key === "F2") {
    event.preventDefault();
    $("#productSearch").focus();
  }
  if (event.key === "F4") {
    event.preventDefault();
    openPayment();
  }
  if (event.key === "Escape") {
    if ($("#paymentDialog").open) $("#paymentDialog").close();
    if ($("#receiptDialog").open) $("#receiptDialog").close();
  }
});

// Solicitar permissão de notificação
requestNotificationPermission();

// Inicialização
renderAll();
