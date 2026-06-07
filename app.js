const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

// Constantes
const VALIDATION = {
  minPrice: 0.01,
  barcodeLength: { min: 6, max: 14 },
  stockAlertThreshold: 12
};

// Produtos padrão
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

// Estado da aplicação
const state = {
  products: load("pdv_products", defaultProducts),
  sales: load("pdv_sales", []),
  settings: load("pdv_settings", { storeName: "MERCADO FÁCIL", operator: "CAIXA 01", document: "00.000.000/0001-00", takeoutTax: 0 }),
  cart: [],
  sessionStart: load("pdv_sessionStart", new Date().toISOString()),
  currentSale: null
};

// Utilidades
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
  box.className = `toast show ${type}`;
  setTimeout(() => box.classList.remove("show"), 2000);
}

function showScreen(screenName) {
  $$(".pdv-screen").forEach(s => s.classList.remove("active"));
  $(`#${screenName}`).classList.add("active");
}

// Validação
function validateProduct(product) {
  const errors = [];
  if (!product.name?.trim()) errors.push("Nome obrigatório");
  if (!product.barcode?.trim()) errors.push("Código obrigatório");
  if (product.barcode && (product.barcode.length < VALIDATION.barcodeLength.min || product.barcode.length > VALIDATION.barcodeLength.max)) {
    errors.push(`Código: ${VALIDATION.barcodeLength.min}-${VALIDATION.barcodeLength.max} dígitos`);
  }
  if (!product.category?.trim()) errors.push("Categoria obrigatória");
  if (product.price < VALIDATION.minPrice) errors.push("Preço inválido");
  if (product.stock < 0) errors.push("Estoque negativo");
  if (!/^\d+$/.test(product.barcode)) errors.push("Código: apenas números");
  return errors;
}

// Busca
function searchProductByBarcode(barcode) {
  return state.products.find(p => p.barcode === barcode.trim()) ||
    state.products.find(p => p.sku === barcode.trim());
}

// Carrinho
function cartSubtotal() {
  return state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function currentTotal() {
  const discount = Number($("#discountDisplayInput")?.value || 0);
  const surcharge = Number($("#surchargeDisplayInput")?.value || 0);
  return Math.max(0, cartSubtotal() - discount + surcharge);
}

function addToCart(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return toast("Produto não encontrado", "error");
  
  const current = state.cart.find(p => p.id === id);
  const qtyInCart = current?.qty ?? 0;
  
  if (qtyInCart >= product.stock) {
    toast("Sem estoque", "warning");
    return;
  }
  
  if (current) {
    current.qty += 1;
  } else {
    state.cart.push({ id: product.id, name: product.name, price: product.price, qty: 1, sku: product.sku });
  }
  
  renderCart();
  toast(`${product.name} adicionado`, "success");
}

function removeFromCart(id) {
  state.cart = state.cart.filter(item => item.id !== id);
  renderCart();
}

function changeQty(id, delta) {
  const item = state.cart.find(p => p.id === id);
  const product = state.products.find(p => p.id === id);
  if (!item || !product) return;
  
  item.qty += delta;
  if (item.qty > product.stock) item.qty = product.stock;
  if (item.qty <= 0) removeFromCart(id);
  renderCart();
}

// Renderização
function renderCart() {
  const cartDisplay = $("#cartItemsDisplay");
  if (state.cart.length === 0) {
    cartDisplay.innerHTML = '<div style="padding: 10px; text-align: center; color: #999;">CARRINHO VAZIO</div>';
  } else {
    cartDisplay.innerHTML = state.cart.map((item, idx) => `
      <div class="cart-item">
        <div>${item.name}</div>
        <div style="text-align: center;">${item.qty}</div>
        <div style="text-align: right;">${money.format(item.price)}</div>
        <div style="text-align: right;">${money.format(item.price * item.qty)}</div>
        <button type="button" class="cart-item-delete" data-remove="${item.id}">DEL</button>
      </div>
    `).join("");
  }

  const subtotal = cartSubtotal();
  const discount = Number($("#discountDisplayInput")?.value || 0);
  const surcharge = Number($("#surchargeDisplayInput")?.value || 0);
  const total = currentTotal();

  $("#cartCount").textContent = state.cart.length;
  $("#cartSubtotal").textContent = money.format(subtotal);
  $("#displaySubtotal").textContent = money.format(subtotal);
  $("#displayDiscount").textContent = money.format(discount);
  $("#displaySurcharge").textContent = money.format(surcharge);
  $("#displayTotal").textContent = money.format(total);
}

function renderProducts() {
  const sortBy = $("#productSortSelect")?.value || "name";
  const searchTerm = ($("#productSearchInput")?.value || "").toLowerCase();
  
  let filtered = state.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm) ||
    p.category.toLowerCase().includes(searchTerm)
  );

  const sorted = filtered.sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "price") return a.price - b.price;
    if (sortBy === "stock") return a.stock - b.stock;
    if (sortBy === "category") return a.category.localeCompare(b.category);
    return 0;
  });

  const tbody = $("#productsTable");
  tbody.innerHTML = sorted.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.barcode}</td>
      <td>${p.sku}</td>
      <td>${money.format(p.price)}</td>
      <td>${p.stock}</td>
      <td>
        <button type="button" class="btn-secondary" data-edit="${p.id}">EDITAR</button>
        <button type="button" class="btn-secondary" data-delete="${p.id}" style="margin-left: 4px;">DEL</button>
      </td>
    </tr>
  `).join("");
}

function renderSales() {
  const filterType = $("#salesFilterSelect")?.value || "all";
  const searchTerm = ($("#salesSearchInput")?.value || "").toLowerCase();
  
  let filtered = state.sales;
  
  if (filterType === "today") {
    const today = new Date().toISOString().slice(0, 10);
    filtered = filtered.filter(s => s.date.slice(0, 10) === today);
  } else if (filterType === "week") {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    filtered = filtered.filter(s => s.date.slice(0, 10) >= weekAgo);
  } else if (filterType === "month") {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    filtered = filtered.filter(s => s.date.slice(0, 10) >= monthAgo);
  }

  if (searchTerm) {
    filtered = filtered.filter(s => s.number.includes(searchTerm));
  }

  const tbody = $("#salesTable");
  tbody.innerHTML = filtered.map(s => `
    <tr>
      <td>#${s.number}</td>
      <td>${new Date(s.date).toLocaleString("pt-BR")}</td>
      <td>${s.items.reduce((sum, item) => sum + item.qty, 0)}</td>
      <td>${s.paymentsLabel}</td>
      <td>${money.format(s.total)}</td>
      <td><button type="button" class="btn-secondary" data-receipt="${s.id}">RECIBO</button></td>
    </tr>
  `).join("");
}

function renderReports() {
  const today = new Date().toISOString().slice(0, 10);
  const salesToday = state.sales.filter(s => s.date.slice(0, 10) === today);
  const revenueToday = salesToday.reduce((sum, s) => sum + s.total, 0);
  const itemsToday = salesToday.flatMap(s => s.items).reduce((sum, i) => sum + i.qty, 0);
  
  const allRevenue = state.sales.reduce((sum, s) => sum + s.total, 0);
  const allItems = state.sales.flatMap(s => s.items).reduce((sum, i) => sum + i.qty, 0);
  
  const sessionDuration = new Date() - new Date(state.sessionStart);
  const hours = Math.floor(sessionDuration / (1000 * 60 * 60));
  const minutes = Math.floor((sessionDuration % (1000 * 60 * 60)) / (1000 * 60));

  $("#reportTodaySales").textContent = salesToday.length;
  $("#reportTodayRevenue").textContent = money.format(revenueToday);
  $("#reportAvgTicket").textContent = money.format(salesToday.length ? revenueToday / salesToday.length : 0);
  $("#reportItemsToday").textContent = itemsToday;
  $("#reportTotalRevenue").textContent = money.format(allRevenue);
  $("#reportTotalItems").textContent = allItems;
  $("#reportSessionDuration").textContent = `${hours}h ${minutes}m`;
  $("#reportTotalProducts").textContent = state.products.length;

  const alerts = state.products
    .filter(p => p.stock <= VALIDATION.stockAlertThreshold)
    .sort((a, b) => a.stock - b.stock);

  const alertsList = $("#stockAlertsList");
  alertsList.innerHTML = alerts.map(p => `
    <div class="alert-item">
      ${p.name} - ${p.stock} unidades
    </div>
  `).join("") || '<div class="alert-item">Sem alertas</div>';
}

function updateClock() {
  const now = new Date();
  $("#timeDisplay").textContent = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  $("#dateDisplay").textContent = now.toLocaleDateString("pt-BR");
}

function updateHeader() {
  $("#storeName").textContent = state.settings.storeName;
  $("#operatorDisplay").textContent = state.settings.operator;
}

// Produtos
function saveProduct(event) {
  event.preventDefault();
  const id = $("#productId").value || crypto.randomUUID();
  const product = {
    id,
    name: $("#nameInput").value.trim(),
    barcode: $("#barcodeInputForm").value.trim(),
    category: $("#categoryInputForm").value.trim(),
    price: Number($("#priceInputForm").value || 0),
    stock: Number($("#stockInputForm").value || 0),
    sku: $("#skuInputForm").value.trim() || ""
  };

  const errors = validateProduct(product);
  if (errors.length) {
    toast(errors[0], "error");
    return;
  }

  const index = state.products.findIndex(p => p.id === id);
  if (index >= 0) {
    state.products[index] = product;
    toast("Produto atualizado", "success");
  } else {
    state.products.push(product);
    toast("Produto criado", "success");
  }

  save("pdv_products", state.products);
  $("#productForm").reset();
  $("#productId").value = "";
  renderProducts();
}

function editProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  
  $("#productId").value = product.id;
  $("#nameInput").value = product.name;
  $("#barcodeInputForm").value = product.barcode;
  $("#categoryInputForm").value = product.category;
  $("#priceInputForm").value = product.price;
  $("#stockInputForm").value = product.stock;
  $("#skuInputForm").value = product.sku || "";
  showScreen("productsScreen");
}

function deleteProduct(id) {
  if (!confirm("Excluir este produto?")) return;
  state.products = state.products.filter(p => p.id !== id);
  save("pdv_products", state.products);
  toast("Produto excluído", "success");
  renderProducts();
}

// Pagamento
function openPayment() {
  if (!state.cart.length) {
    toast("Carrinho vazio", "warning");
    return;
  }

  const subtotal = cartSubtotal();
  const discount = Number($("#discountDisplayInput").value || 0);
  const surcharge = Number($("#surchargeDisplayInput").value || 0);
  const total = currentTotal();

  $("#paymentSubtotal").textContent = money.format(subtotal);
  $("#paymentDiscount").textContent = money.format(discount);
  $("#paymentSurcharge").textContent = money.format(surcharge);
  $("#paymentTotal").textContent = money.format(total);
  
  $("#cashPaymentInput").value = 0;
  $("#pixPaymentInput").value = 0;
  $("#cardPaymentInput").value = 0;
  
  updatePaymentTotals();
  showScreen("paymentScreen");
  $("#cashPaymentInput").focus();
}

function updatePaymentTotals() {
  const cash = Number($("#cashPaymentInput").value || 0);
  const pix = Number($("#pixPaymentInput").value || 0);
  const card = Number($("#cardPaymentInput").value || 0);
  const total = currentTotal();
  const paid = cash + pix + card;
  const change = Math.max(0, paid - total);

  $("#paymentReceived").textContent = money.format(paid);
  $("#paymentChange").textContent = money.format(change);
}

function finishSale() {
  const total = currentTotal();
  const cash = Number($("#cashPaymentInput").value || 0);
  const pix = Number($("#pixPaymentInput").value || 0);
  const card = Number($("#cardPaymentInput").value || 0);
  const paid = cash + pix + card;

  if (paid < total) {
    toast("Valor insuficiente", "warning");
    return;
  }

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
    discount: Number($("#discountDisplayInput").value || 0),
    surcharge: Number($("#surchargeDisplayInput").value || 0),
    total,
    paid,
    change: Math.max(0, paid - total),
    payments,
    paymentsLabel: payments.map(([name, value]) => `${name} ${money.format(value)}`).join(" + ")
  };

  sale.items.forEach(item => {
    const product = state.products.find(p => p.id === item.id);
    if (product) product.stock -= item.qty;
  });

  state.sales.unshift(sale);
  save("pdv_products", state.products);
  save("pdv_sales", state.sales);

  state.cart = [];
  $("#discountDisplayInput").value = 0;
  $("#surchargeDisplayInput").value = 0;
  
  renderCart();
  showReceipt(sale);
}

function showReceipt(sale) {
  const receipt = buildReceipt(sale);
  $("#receiptContent").textContent = receipt;
  showScreen("receiptScreen");
  toast("Venda finalizada", "success");
}

function buildReceipt(sale) {
  const lines = [
    "=".repeat(40),
    state.settings.storeName.padEnd(40),
    `CNPJ: ${state.settings.document}`.padEnd(40),
    "=".repeat(40),
    `VENDA #${sale.number}`,
    `DATA: ${new Date(sale.date).toLocaleString("pt-BR")}`,
    `OPERADOR: ${sale.operator}`,
    "-".repeat(40),
    "DESCRIÇÃO              QTD    PREÇO    TOTAL",
    "-".repeat(40),
    ...sale.items.map(item => {
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
    "OBRIGADO PELA COMPRA!".padStart(33),
    new Date(sale.date).toLocaleString("pt-BR").padStart(40),
    "=".repeat(40)
  ].filter(line => line !== "");
  return lines.join("\n");
}

// Exportação
function exportProducts() {
  const header = "nome,codigo,categoria,preco,estoque,sku\n";
  const rows = state.products.map(p => [
    p.name,
    p.barcode,
    p.category,
    p.price.toFixed(2),
    p.stock,
    p.sku || ""
  ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","));

  const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `produtos-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Produtos exportados", "success");
}

function exportSales() {
  const header = "numero,data,itens,pagamento,total\n";
  const rows = state.sales.map(s => [
    s.number,
    new Date(s.date).toLocaleString("pt-BR"),
    s.items.reduce((sum, item) => sum + item.qty, 0),
    s.paymentsLabel,
    s.total.toFixed(2)
  ].map(v => `"${String(v).replaceAll('"', '""')}"`).join(","));

  const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `vendas-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Vendas exportadas", "success");
}

// Event Listeners - Tela Principal
$("#barcodeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const product = searchProductByBarcode($("#barcodeInput").value);
    if (product && product.stock > 0) {
      addToCart(product.id);
      $("#barcodeInput").value = "";
      renderCart();
    } else {
      toast("Produto não encontrado ou sem estoque", "warning");
    }
  }
});

$("#searchBtn").addEventListener("click", () => {
  const product = searchProductByBarcode($("#barcodeInput").value);
  if (product && product.stock > 0) {
    addToCart(product.id);
    $("#barcodeInput").value = "";
  }
});

$("#clearSearchBtn").addEventListener("click", () => {
  $("#barcodeInput").value = "";
  $("#barcodeInput").focus();
});

document.addEventListener("click", (e) => {
  if (e.target.dataset.remove) {
    removeFromCart(e.target.dataset.remove);
  }
  if (e.target.dataset.edit) {
    editProduct(e.target.dataset.edit);
  }
  if (e.target.dataset.delete) {
    deleteProduct(e.target.dataset.delete);
  }
  if (e.target.dataset.receipt) {
    const sale = state.sales.find(s => s.id === e.target.dataset.receipt);
    if (sale) showReceipt(sale);
  }
});

// Botões Tela Principal
$("#newSaleDisplayBtn").addEventListener("click", () => {
  state.cart = [];
  $("#discountDisplayInput").value = 0;
  $("#surchargeDisplayInput").value = 0;
  renderCart();
  $("#barcodeInput").focus();
  toast("Nova venda iniciada", "success");
});

$("#removeLastBtn").addEventListener("click", () => {
  if (state.cart.length > 0) {
    state.cart.pop();
    renderCart();
  }
});

$("#configDisplayBtn").addEventListener("click", () => {
  showScreen("settingsScreen");
});

$("#checkoutDisplayBtn").addEventListener("click", openPayment);

// Botões Telas
$("#closeProductsScreen").addEventListener("click", () => showScreen("salesScreen"));
$("#closeSalesScreen").addEventListener("click", () => showScreen("salesScreen"));
$("#closeReportsScreen").addEventListener("click", () => showScreen("salesScreen"));
$("#closeSettingsScreen").addEventListener("click", () => showScreen("salesScreen"));
$("#closePaymentScreen").addEventListener("click", () => showScreen("salesScreen"));
$("#closeReceiptScreen").addEventListener("click", () => {
  showScreen("salesScreen");
  state.cart = [];
  renderCart();
});

// Produtos
$("#productForm").addEventListener("submit", saveProduct);
$("#clearFormBtn").addEventListener("click", () => {
  $("#productForm").reset();
  $("#productId").value = "";
});

$("#productSearchInput").addEventListener("input", renderProducts);
$("#productSortSelect").addEventListener("change", renderProducts);
$("#exportProductsBtn").addEventListener("click", exportProducts);

// Vendas
$("#salesFilterSelect").addEventListener("change", renderSales);
$("#salesSearchInput").addEventListener("input", renderSales);
$("#exportSalesBtn").addEventListener("click", exportSales);

// Pagamento
["#cashPaymentInput", "#pixPaymentInput", "#cardPaymentInput"].forEach(sel => {
  $(sel).addEventListener("input", updatePaymentTotals);
});

$("#confirmPaymentBtn").addEventListener("click", finishSale);
$("#cancelPaymentBtn").addEventListener("click", () => showScreen("salesScreen"));

// Recibo
$("#copyReceiptBtn").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("#receiptContent").textContent);
  toast("Recibo copiado", "success");
});

$("#printReceiptBtn").addEventListener("click", () => window.print());

$("#newSaleFromReceiptBtn").addEventListener("click", () => {
  showScreen("salesScreen");
  state.cart = [];
  renderCart();
  $("#barcodeInput").focus();
});

// Configurações
$("#settingsForm").addEventListener("submit", (e) => {
  e.preventDefault();
  state.settings = {
    storeName: $("#storeNameInput").value.trim() || "MERCADO FÁCIL",
    operator: $("#operatorInput").value.trim() || "CAIXA 01",
    document: $("#documentInput").value.trim() || "00.000.000/0001-00",
    takeoutTax: Number($("#takeoutTaxInput").value || 0)
  };
  save("pdv_settings", state.settings);
  updateHeader();
  showScreen("salesScreen");
  toast("Configurações salvas", "success");
});

// Totais
["#discountDisplayInput", "#surchargeDisplayInput"].forEach(sel => {
  $(sel).addEventListener("input", renderCart);
});

// Menu Tela Principal - Navegação
const navMenu = document.createElement("div");
navMenu.style.cssText = "position: fixed; bottom: 20px; left: 10px; display: flex; gap: 4px; flex-direction: column; z-index: 100;";
navMenu.innerHTML = `
  <button type="button" class="btn-secondary" id="navProducts" style="width: 100px;">PRODUTOS</button>
  <button type="button" class="btn-secondary" id="navSales" style="width: 100px;">VENDAS</button>
  <button type="button" class="btn-secondary" id="navReports" style="width: 100px;">RELATÓRIOS</button>
`;
document.body.appendChild(navMenu);

$("#navProducts").addEventListener("click", () => {
  renderProducts();
  showScreen("productsScreen");
});

$("#navSales").addEventListener("click", () => {
  renderSales();
  showScreen("salesHistoryScreen");
});

$("#navReports").addEventListener("click", () => {
  renderReports();
  showScreen("reportsScreen");
});

// Atalhos
document.addEventListener("keydown", (e) => {
  if (e.key === "F1") { e.preventDefault(); $("#newSaleDisplayBtn").click(); }
  if (e.key === "F2") { e.preventDefault(); $("#removeLastBtn").click(); }
  if (e.key === "F3") { e.preventDefault(); $("#configDisplayBtn").click(); }
  if (e.key === "F4") { e.preventDefault(); $("#checkoutDisplayBtn").click(); }
  if (e.ctrlKey && e.key === "p") { e.preventDefault(); $("#navProducts").click(); }
  if (e.ctrlKey && e.key === "v") { e.preventDefault(); $("#navSales").click(); }
  if (e.ctrlKey && e.key === "r") { e.preventDefault(); $("#navReports").click(); }
  if (e.ctrlKey && e.key === "z") { e.preventDefault(); showScreen("salesScreen"); }
});

// Inicialização
updateHeader();
updateClock();
setInterval(updateClock, 1000);
renderCart();
