// ============================================
// Custom POS v2 - Modern Glassmorphic Design
// ============================================

frappe.provide("custom_pos");

window.initVuePOS = function(wrapper) {
    var main = $(wrapper).find(".layout-main-section");
    if (!main.length || main.find("#pos-root").length) return;

    if (!window.Vue) {
        var script = document.createElement('script');
        script.src = 'https://unpkg.com/vue@3/dist/vue.global.js';
        script.onload = function() { createVuePOSApp(main); };
        document.head.appendChild(script);
    } else {
        createVuePOSApp(main);
    }
};

function createVuePOSApp(main) {
    main.html('<div id="pos-root"></div>');

    const { createApp, ref, computed, onMounted, watch, nextTick } = Vue;

    const APP_TEMPLATE = `
<div id="pos-root" :class="{ 'theme-light': isLightTheme }">
    <!-- Header -->
    <div class="pos-header">
        <h1>🛍️ نقطة البيع</h1>
        <div class="pos-header-right">
            <div class="meta">
                <span>👨‍💼 {{ sellerLabel }}</span>
                <span>🏪 {{ branchLabel }}</span>
            </div>
            <button class="theme-toggle-btn" @click="toggleTheme">
                {{ isLightTheme ? '🌙 داكن' : '☀️ فاتح' }}
            </button>
        </div>
    </div>

    <!-- Info Bar -->
    <div class="pos-card pos-infobar">
        <div class="pos-field-group" style="flex:1; min-width:200px;">
            <label>👤 العميل</label>
            <div class="pos-customer-box" v-click-outside="closeCustomerDropdown">
                <div v-if="selectedCustomer" class="pos-customer-selected" @click="clearCustomer">
                    <span class="pos-customer-tag">👤 {{ selectedCustomerName }}</span>
                    <span class="pos-customer-clear">✕</span>
                </div>
                <div v-else style="position:relative;">
                    <input
                        class="pos-input"
                        v-model="customerQuery"
                        @input="onCustomerInput"
                        @focus="showCustomerDropdown = true"
                        placeholder="🔍 ابحث بالاسم أو التليفون..."
                        autocomplete="off"
                    >
                    <div class="pos-customer-dropdown" v-if="showCustomerDropdown && (customerResults.length > 0 || customerQuery.length >= 2)">
                        <div v-if="customerSearching" style="padding:12px 14px; color:var(--text-muted); font-size:0.84rem;">⏳ جاري البحث...</div>
                        <template v-else>
                            <div
                                class="pos-customer-option"
                                v-for="c in customerResults"
                                :key="c.name"
                                @click="selectCustomer(c)"
                            >
                                <div class="cname">{{ c.customer_name }}</div>
                                <div class="cphone" v-if="c.mobile_no">📱 {{ c.mobile_no }}</div>
                            </div>
                            <div v-if="!customerResults.length && customerQuery.length >= 2" class="pos-customer-create-btn" @click="openCreateCustomer">
                                ➕ إنشاء عميل جديد "{{ customerQuery }}"
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>

        <div class="pos-field-group">
            <label>🏪 الفرع</label>
            <select class="pos-select" v-model="selectedBranch" style="min-width:140px;">
                <option v-for="b in branches" :value="b.name">{{ b.cost_center_name || b.name }}</option>
            </select>
        </div>

        <div class="pos-field-group">
            <label>💰 قائمة الأسعار</label>
            <select class="pos-select" v-model="selectedPriceList" @change="onPriceListChange" style="min-width:160px;">
                <option v-for="pl in allowedPriceLists" :value="pl">{{ pl }}</option>
            </select>
        </div>

        <div class="pos-field-group">
            <label>👨‍💼 البائع</label>
            <select class="pos-select" v-model="selectedSeller" @change="onSellerChange" style="min-width:140px;">
                <option v-for="s in sellers" :value="s.name">{{ s.sales_person_name || s.name }}</option>
            </select>
        </div>
    </div>

    <!-- Main Layout -->
    <div class="pos-main-layout">
        <!-- Products Column -->
        <div class="pos-products-col">
            <!-- Category Tabs -->
            <div class="pos-categories">
                <div class="pos-cat-tab" :class="{ active: selectedCategory === 'all' }" @click="setCategory('all')">🏷️ الكل</div>
                <div
                    class="pos-cat-tab"
                    v-for="g in itemGroups"
                    :key="g.name"
                    :class="{ active: selectedCategory === g.name }"
                    @click="setCategory(g.name)"
                >{{ g.item_group_name || g.name }}</div>
            </div>

            <!-- Search -->
            <div class="pos-search-wrap">
                <span class="search-icon">🔍</span>
                <input class="pos-input" v-model="searchQuery" @input="filterProducts" placeholder="ابحث بالصنف أو الكود...">
            </div>

            <!-- Products Grid -->
            <div v-if="loadingProducts" style="text-align:center; padding:50px; color:var(--text-muted);">
                <div class="pos-spinner" style="margin:0 auto 16px;"></div>
                <p>جاري تحميل المنتجات...</p>
            </div>
            <div v-else-if="filteredProducts.length === 0" class="pos-empty">
                <div class="icon">📦</div>
                <p>لا توجد منتجات في هذه الفئة</p>
            </div>
            <div v-else class="pos-product-grid">
                <div
                    class="pos-product-card"
                    v-for="product in filteredProducts"
                    :key="product.item_code"
                    @click="openModal(product)"
                >
                    <span class="product-emoji">{{ product.image && !product.image.startsWith('/') ? product.image : '📦' }}</span>
                    <div class="product-name">{{ product.item_name }}</div>
                    <div class="product-price">{{ (product.price || 0).toFixed(2) }} ج.م</div>
                    <span class="product-stock-badge" :class="getStockClass(product)">{{ getStockText(product) }}</span>
                </div>
            </div>
        </div>

        <!-- Cart Column -->
        <div class="pos-cart-col pos-card">
            <div class="pos-cart-header">
                <div class="pos-section-title">🛒 السلة ({{ cart.length }})</div>
                <button v-if="cart.length > 0" class="pos-btn-icon" @click="clearCart" title="تفريغ السلة">🗑️</button>
            </div>
            
            <div v-if="cart.length === 0" class="pos-empty">
                <div class="icon">🛒</div>
                <p>السلة فارغة</p>
            </div>

            <div class="pos-cart" v-else>
                <div class="pos-cart-item" v-for="(item, index) in cart" :key="index">
                    <div class="cart-item-top">
                        <div class="cart-item-info">
                            <div class="cart-item-name">{{ item.item_name }}</div>
                            <div class="cart-item-wh">📦 {{ item.warehouse }}</div>
                        </div>
                        <button class="pos-btn-icon" @click="removeItem(index)">🗑️</button>
                    </div>
                    <div class="cart-item-bottom">
                        <div class="cart-qty-ctrl">
                            <button class="cart-qty-btn" @click="changeQty(index, -1)">−</button>
                            <span class="cart-qty-num">{{ item.qty }}</span>
                            <button class="cart-qty-btn" @click="changeQty(index, 1)">+</button>
                        </div>
                        <span class="cart-item-amount">{{ item.amount.toFixed(2) }} ج.م</span>
                    </div>
                </div>
            </div>

            <!-- Cart Totals (Sticky) -->
            <div class="pos-cart-totals" v-if="cart.length > 0">
                <div class="pos-total-row">
                    <span>المجموع:</span>
                    <span>{{ totalAmount.toFixed(2) }} ج.م</span>
                </div>
                <div class="pos-total-row" style="align-items:center;">
                    <span>الخصم (ج.م):</span>
                    <input class="pos-input" v-model.number="discount" type="number" min="0" style="width:80px; text-align:center; padding:5px 8px;">
                </div>
                <div class="pos-total-row grand">
                    <span>الإجمالي:</span>
                    <span>{{ grandTotal.toFixed(2) }} ج.م</span>
                </div>
                <button class="pos-btn pos-btn-success" @click="registerOrder" :disabled="submitting" style="margin-top:12px;">
                    <span v-if="submitting">⏳ جاري التسجيل...</span>
                    <span v-else>💾 تسجيل الطلب</span>
                </button>
            </div>
        </div>
    </div>

    <!-- Add to Cart Modal -->
    <div class="pos-modal-overlay" v-if="showModal" @click.self="showModal = false">
        <div class="pos-modal">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div class="pos-modal-title">➕ إضافة صنف</div>
                <button class="pos-btn pos-btn-ghost" @click="showModal = false" style="padding:6px 12px;">✕</button>
            </div>
            <div style="text-align:center; margin-bottom:18px;">
                <div style="font-size:3rem;">{{ currentItem?.image && !currentItem.image.startsWith('/') ? currentItem.image : '📦' }}</div>
                <div style="font-size:1rem; font-weight:800; color:var(--text-primary); margin-top:8px;">{{ currentItem?.item_name }}</div>
                <div style="font-size:1.3rem; font-weight:900; background:var(--accent-grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">{{ currentItem?.price?.toFixed(2) }} ج.م</div>
                
                <div style="margin-top:16px; text-align:right;">
                    <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">💵 جميع الأسعار:</div>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div v-for="(price, pl) in currentItem?.all_prices" :key="pl" style="font-size:0.82rem; padding:4px 8px; background:var(--bg-glass); border-radius:4px;">
                            <span style="color:var(--text-muted);">{{ pl }}:</span>
                            <span style="font-weight:700; margin-right:8px;">{{ price.toFixed(2) }} ج.م</span>
                        </div>
                    </div>
                </div>
                
                <div v-if="currentItem?.can_see_cost_price && currentItem?.cost_price" style="margin-top:12px; padding:8px; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); border-radius:8px; color:var(--danger);">
                    <div style="font-size:0.8rem; font-weight:700;">💰 سعر الشراء:</div>
                    <div style="font-size:1.1rem; font-weight:900;">{{ currentItem.cost_price.toFixed(2) }} ج.م</div>
                </div>
            </div>

            <div class="pos-section-title">اختر المخزن والكمية:</div>
            <div class="pos-modal-wh-list">
                <div
                    class="pos-modal-wh-row"
                    v-for="(wh, idx) in currentItem?.stock"
                    :key="idx"
                    :class="{ selected: selectedWh.includes(idx), disabled: wh.actual_qty <= 0 }"
                    @click="wh.actual_qty > 0 && toggleWh(idx)"
                >
                    <input type="checkbox" :checked="selectedWh.includes(idx)" :disabled="wh.actual_qty <= 0" @click.stop style="accent-color:var(--accent-1);">
                    <span class="pos-modal-wh-name">{{ wh.warehouse_name || wh.warehouse }}</span>
                    <span class="pos-modal-wh-qty" :class="wh.actual_qty > 0 ? 'wh-qty-ok' : 'wh-qty-none'">
                        {{ wh.actual_qty > 0 ? 'متوفر: ' + wh.actual_qty : 'غير متوفر' }}
                    </span>
                    <input
                        v-if="selectedWh.includes(idx)"
                        v-model.number="whQty[idx]"
                        type="number" min="1" :max="wh.actual_qty"
                        style="width:60px; background:var(--bg-glass); border:1px solid var(--border-glass); border-radius:6px; padding:4px 8px; color:var(--text-primary); text-align:center;"
                        @click.stop
                    >
                </div>
            </div>

            <div style="text-align:center; margin:16px 0; background:var(--bg-glass); border-radius:var(--radius-sm); padding:10px; font-size:0.9rem; color:var(--text-muted);">
                الإجمالي: <strong style="color:var(--text-primary);">{{ modalTotalQty }} × {{ currentItem?.price?.toFixed(2) }} = </strong>
                <strong style="background:var(--accent-grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;">{{ modalTotal.toFixed(2) }} ج.م</strong>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="pos-btn pos-btn-primary" style="flex:1; justify-content:center;" @click="addToCart">➕ أضف للسلة</button>
                <button class="pos-btn pos-btn-danger" style="flex:1; justify-content:center;" @click="showModal = false">إلغاء</button>
            </div>
        </div>
    </div>

    <!-- Create Customer Modal -->
    <div class="pos-modal-overlay" v-if="showCreateCustomer" @click.self="showCreateCustomer = false">
        <div class="pos-modal">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <div class="pos-modal-title">👤 إضافة عميل جديد</div>
                <button class="pos-btn pos-btn-ghost" @click="showCreateCustomer = false" style="padding:6px 12px;">✕</button>
            </div>
            <div class="pos-field-group" style="margin-bottom:14px;">
                <label>اسم العميل *</label>
                <input class="pos-input" v-model="newCustomerName" placeholder="أدخل اسم العميل...">
            </div>
            <div class="pos-field-group" style="margin-bottom:22px;">
                <label>رقم الهاتف</label>
                <input class="pos-input" v-model="newCustomerPhone" type="tel" placeholder="01xxxxxxxxx">
            </div>
            <div style="display:flex; gap:10px;">
                <button class="pos-btn pos-btn-primary" style="flex:1; justify-content:center;" @click="submitCreateCustomer" :disabled="!newCustomerName || creatingCustomer">
                    <span v-if="creatingCustomer">⏳ جاري الإنشاء...</span>
                    <span v-else>✅ إنشاء العميل</span>
                </button>
                <button class="pos-btn pos-btn-ghost" style="flex:1; justify-content:center;" @click="showCreateCustomer = false">إلغاء</button>
            </div>
        </div>
    </div>

    <!-- Toast -->
    <div class="pos-toast" :class="toast.type" v-if="toast.show">{{ toast.message }}</div>

    <!-- Loading Overlay -->
    <div class="pos-loading-overlay" v-if="submitting">
        <div class="pos-spinner"></div>
        <div class="pos-loading-text">جاري تسجيل الطلب...</div>
    </div>
</div>
    `;

    const app = createApp({
        template: APP_TEMPLATE,
        directives: {
            'click-outside': {
                mounted(el, binding) {
                    el._clickOutside = (e) => { if (!el.contains(e.target)) binding.value(e); };
                    document.addEventListener('click', el._clickOutside, true);
                },
                unmounted(el) { document.removeEventListener('click', el._clickOutside, true); }
            }
        },
        setup() {
            // State
            const loadingProducts = ref(true);
            const submitting = ref(false);
            const products = ref([]);
            const filteredProducts = ref([]);
            const itemGroups = ref([]);
            const selectedCategory = ref('all');
            const searchQuery = ref('');
            const cart = ref([]);
            const discount = ref(0);
            const isLightTheme = ref(localStorage.getItem('posTheme') === 'light');
            const allowedPriceLists = ref([]);
            
            // Customer search
            const customerQuery = ref('');
            const customerResults = ref([]);
            const customerSearching = ref(false);
            const showCustomerDropdown = ref(false);
            const selectedCustomer = ref('');
            const selectedCustomerName = ref('');
            let customerSearchTimer = null;

            // Create customer modal
            const showCreateCustomer = ref(false);
            const newCustomerName = ref('');
            const newCustomerPhone = ref('');
            const creatingCustomer = ref(false);

            // Modal state
            const showModal = ref(false);
            const currentItem = ref(null);
            const selectedWh = ref([]);
            const whQty = ref({});

            // Lists
            const branches = ref([]);
            const priceLists = ref([]);
            const sellers = ref([]);
            const selectedBranch = ref('');
            const selectedPriceList = ref('');
            const selectedSeller = ref('');
            const sellerLabel = ref('البائع');
            const branchLabel = ref('الفرع');

            const toast = ref({ show: false, message: '', type: 'success' });

            // Computed
            const totalAmount = computed(() => cart.value.reduce((s, i) => s + i.amount, 0));
            const grandTotal = computed(() => Math.max(0, totalAmount.value - (discount.value || 0)));
            const modalTotalQty = computed(() => selectedWh.value.reduce((s, idx) => s + (whQty.value[idx] || 0), 0));
            const modalTotal = computed(() => modalTotalQty.value * (currentItem.value?.price || 0));

            // Mount
            onMounted(() => { loadInitialData(); });

            // Data Loading
            function loadInitialData() {
                // Sellers
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Sales Person', fields: ['name', 'sales_person_name'], filters: { is_group: 0 } },
                    callback: (r) => {
                        if (r.message && r.message.length) {
                            sellers.value = r.message;
                            selectedSeller.value = r.message[0]?.name || '';
                            sellerLabel.value = r.message[0]?.sales_person_name || r.message[0]?.name || 'البائع';
                        }
                    }
                });

                // Branches (Cost Centers)
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Cost Center', fields: ['name', 'cost_center_name'], filters: { is_group: 0 } },
                    callback: (r) => {
                        if (r.message && r.message.length) {
                            branches.value = r.message;
                            selectedBranch.value = r.message[0]?.name || '';
                            branchLabel.value = r.message[0]?.cost_center_name || r.message[0]?.name || 'الفرع';
                        }
                    }
                });

                // Load POS Settings and Price Lists
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_pos_settings',
                    callback: (r) => {
                        if (r.message) {
                            allowedPriceLists.value = r.message.allowed_price_lists;
                            if (r.message.default_price_list && allowedPriceLists.value.includes(r.message.default_price_list)) {
                                selectedPriceList.value = r.message.default_price_list;
                            } else if (allowedPriceLists.value.length > 0) {
                                selectedPriceList.value = allowedPriceLists.value[0];
                            }
                            loadItemGroups();
                            loadProducts();
                        }
                    }
                });
            }

            function loadItemGroups() {
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_item_groups',
                    callback: (r) => {
                        if (r.message) itemGroups.value = r.message;
                    }
                });
            }

            function loadProducts() {
                if (!selectedPriceList.value) return;
                loadingProducts.value = true;
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_all_items_with_prices',
                    args: { price_list: selectedPriceList.value },
                    callback: (r) => {
                        products.value = r.message || [];
                        applyFilters();
                        loadingProducts.value = false;
                    },
                    error: () => {
                        loadingProducts.value = false;
                        showToast('❌ خطأ في تحميل المنتجات', 'error');
                    }
                });
            }

            // Filters
            function setCategory(cat) {
                selectedCategory.value = cat;
                applyFilters();
            }

            function filterProducts() { applyFilters(); }

            function applyFilters() {
                let list = products.value;
                if (selectedCategory.value !== 'all') {
                    list = list.filter(p => p.item_group === selectedCategory.value);
                }
                if (searchQuery.value.trim()) {
                    const q = searchQuery.value.trim().toLowerCase();
                    list = list.filter(p =>
                        (p.item_name || '').toLowerCase().includes(q) ||
                        (p.item_code || '').toLowerCase().includes(q)
                    );
                }
                filteredProducts.value = list;
            }

            // Customer Combobox
            function onCustomerInput() {
                clearTimeout(customerSearchTimer);
                if (customerQuery.value.length < 2) {
                    customerResults.value = [];
                    return;
                }
                customerSearching.value = true;
                customerSearchTimer = setTimeout(() => {
                    frappe.call({
                        method: 'custom_pos.custom_pos.api.api.search_customer',
                        args: { query: customerQuery.value },
                        callback: (r) => {
                            customerResults.value = r.message || [];
                            customerSearching.value = false;
                        },
                        error: () => { customerSearching.value = false; }
                    });
                }, 350);
            }

            function selectCustomer(c) {
                selectedCustomer.value = c.name;
                selectedCustomerName.value = c.customer_name;
                showCustomerDropdown.value = false;
                customerQuery.value = '';
                customerResults.value = [];
            }

            function clearCustomer() {
                selectedCustomer.value = '';
                selectedCustomerName.value = '';
                customerQuery.value = '';
            }

            function closeCustomerDropdown() {
                showCustomerDropdown.value = false;
            }

            function openCreateCustomer() {
                newCustomerName.value = customerQuery.value;
                newCustomerPhone.value = '';
                showCreateCustomer.value = true;
                showCustomerDropdown.value = false;
            }

            function submitCreateCustomer() {
                if (!newCustomerName.value) return;
                creatingCustomer.value = true;
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.create_customer',
                    args: { customer_name: newCustomerName.value, mobile_no: newCustomerPhone.value },
                    callback: (r) => {
                        creatingCustomer.value = false;
                        if (r.message) {
                            selectCustomer(r.message);
                            showCreateCustomer.value = false;
                            showToast('✅ تم إنشاء العميل: ' + r.message.customer_name, 'success');
                        }
                    },
                    error: () => {
                        creatingCustomer.value = false;
                        showToast('❌ خطأ في إنشاء العميل', 'error');
                    }
                });
            }

            // Modal (Warehouse Selection)
            function openModal(product) {
                currentItem.value = product;
                selectedWh.value = [];
                whQty.value = {};
                showModal.value = true;
            }

            function toggleWh(idx) {
                const i = selectedWh.value.indexOf(idx);
                if (i === -1) {
                    selectedWh.value.push(idx);
                    whQty.value[idx] = 1;
                } else {
                    selectedWh.value.splice(i, 1);
                    delete whQty.value[idx];
                }
            }

            function addToCart() {
                if (!selectedWh.value.length) {
                    showToast('⚠️ اختر مخزن واحد على الأقل', 'warning');
                    return;
                }
                selectedWh.value.forEach(idx => {
                    const wh = currentItem.value.stock[idx];
                    const qty = whQty.value[idx] || 1;
                    const existing = cart.value.find(c => c.item_code === currentItem.value.item_code && c.warehouse === (wh.warehouse_name || wh.warehouse));
                    if (existing) {
                        existing.qty += qty;
                        existing.amount = existing.qty * existing.rate;
                    } else {
                        cart.value.push({
                            item_code: currentItem.value.item_code,
                            item_name: currentItem.value.item_name,
                            qty,
                            rate: currentItem.value.price,
                            warehouse: wh.warehouse_name || wh.warehouse,
                            warehouse_id: wh.warehouse,
                            amount: qty * currentItem.value.price
                        });
                    }
                });
                showModal.value = false;
                showToast('✅ تمت الإضافة للسلة', 'success');
            }

            // Cart
            function changeQty(index, delta) {
                cart.value[index].qty += delta;
                if (cart.value[index].qty <= 0) {
                    cart.value.splice(index, 1);
                } else {
                    cart.value[index].amount = cart.value[index].qty * cart.value[index].rate;
                }
            }

            function removeItem(index) { cart.value.splice(index, 1); }

            function clearCart() {
                if (!cart.value.length) return;
                if (!confirm('هل تريد إفراغ السلة؟')) return;
                cart.value = [];
                discount.value = 0;
                showToast('🗑️ تم إفراغ السلة', 'success');
            }

            // Register Order
            function registerOrder() {
                if (!cart.value.length) { showToast('⚠️ السلة فارغة!', 'warning'); return; }
                if (!selectedCustomer.value) { showToast('⚠️ اختر العميل أولاً!', 'warning'); return; }
                submitting.value = true;
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.register_pos_order',
                    args: {
                        data: {
                            seller: selectedSeller.value,
                            customer: selectedCustomer.value,
                            customer_phone: '',
                            price_list: selectedPriceList.value,
                            branch: selectedBranch.value,
                            discount_amount: discount.value,
                            items: cart.value.map(i => ({
                                item_code: i.item_code,
                                qty: i.qty,
                                rate: i.rate,
                                warehouse: i.warehouse_id || i.warehouse
                            }))
                        }
                    },
                    callback: (r) => {
                        submitting.value = false;
                        if (r.message) {
                            showToast('✅ تم التسجيل: ' + r.message.name, 'success');
                            cart.value = [];
                            discount.value = 0;
                            clearCustomer();
                        } else {
                            showToast('❌ خطأ في التسجيل', 'error');
                        }
                    },
                    error: (err) => {
                        submitting.value = false;
                        showToast('❌ خطأ في التسجيل', 'error');
                    }
                });
            }

            // Helpers
            function toggleTheme() {
                isLightTheme.value = !isLightTheme.value;
                localStorage.setItem('posTheme', isLightTheme.value ? 'light' : 'dark');
                showToast(`تم التغيير إلى الوضع ${isLightTheme.value ? 'الفاتح' : 'الداكن'}`, 'success');
            }
            function onPriceListChange() { loadProducts(); showToast('تم تغيير قائمة الأسعار', 'success'); }
            function onSellerChange() {
                const s = sellers.value.find(x => x.name === selectedSeller.value);
                sellerLabel.value = s?.sales_person_name || s?.name || 'البائع';
            }

            function getStockClass(product) {
                const total = product.stock ? product.stock.reduce((s, w) => s + (w.actual_qty || 0), 0) : 0;
                return total === 0 ? 'stock-none' : total < 10 ? 'stock-low' : 'stock-available';
            }

            function getStockText(product) {
                const total = product.stock ? product.stock.reduce((s, w) => s + (w.actual_qty || 0), 0) : 0;
                return total === 0 ? '❌ نفذ' : total < 10 ? `⚠️ ${total}` : `✅ ${total}`;
            }

            function showToast(message, type = 'success') {
                toast.value = { show: true, message, type };
                setTimeout(() => toast.value.show = false, 3200);
            }

            return {
                loadingProducts, submitting, products, filteredProducts,
                itemGroups, selectedCategory, searchQuery,
                cart, discount, totalAmount, grandTotal,
                customerQuery, customerResults, customerSearching,
                showCustomerDropdown, selectedCustomer, selectedCustomerName,
                showCreateCustomer, newCustomerName, newCustomerPhone, creatingCustomer,
                showModal, currentItem, selectedWh, whQty,
                modalTotalQty, modalTotal,
                branches, priceLists, sellers,
                selectedBranch, selectedPriceList, selectedSeller,
                sellerLabel, branchLabel, toast,
                isLightTheme, toggleTheme,
                allowedPriceLists,
                setCategory, filterProducts,
                onCustomerInput, selectCustomer, clearCustomer, closeCustomerDropdown,
                openCreateCustomer, submitCreateCustomer,
                openModal, toggleWh, addToCart,
                changeQty, removeItem, clearCart, registerOrder,
                onPriceListChange, onSellerChange,
                getStockClass, getStockText
            };
        }
    });

    app.mount('#pos-root');
}
