// ============================================
// Custom POS - ERPNext Original Style UI
// All backend logic preserved, UI only changed
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

    // SVG icon helpers (inline so no external deps needed)
    const ICONS = {
        cart:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`,
        search:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
        trash:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
        check:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        user:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
        tag:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>`,
    };

    const APP_TEMPLATE = `
<div id="pos-root">

    <!-- ===== TOP TOOLBAR ===== -->
    <div class="pos-toolbar">
        <div class="pos-toolbar-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            نقطة البيع
        </div>
        <div class="pos-toolbar-divider"></div>
        <div class="pos-toolbar-meta">
            <span class="meta-chip seller-chip">
                👨‍💼 {{ sellerLabel }}
            </span>
            <span class="meta-chip">
                🏪 {{ branchLabel }}
            </span>
            <span class="meta-chip">
                💰 {{ selectedPriceList || 'قائمة الأسعار' }}
            </span>
        </div>
        <div class="pos-toolbar-spacer"></div>
    </div>

    <!-- ===== BODY (Left + Right panels) ===== -->
    <div class="pos-body">

        <!-- ========== LEFT PANEL: Items ========== -->
        <div class="pos-left-panel">

            <!-- Info Bar -->
            <div class="pos-infobar">
                <!-- Customer -->
                <div class="pos-field-group" style="flex:2; min-width:200px;">
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
                                placeholder="ابحث بالاسم أو التليفون..."
                                autocomplete="off"
                            >
                            <div class="pos-customer-dropdown" v-if="showCustomerDropdown && (customerResults.length > 0 || customerQuery.length >= 2)">
                                <div v-if="customerSearching" style="padding:10px 12px; color:var(--text-muted); font-size:12px;">⏳ جاري البحث...</div>
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

                <!-- Branch -->
                <div class="pos-field-group" style="min-width:140px;">
                    <label>🏪 الفرع</label>
                    <select class="pos-select" v-model="selectedBranch">
                        <option v-for="b in branches" :value="b.name">{{ b.cost_center_name || b.name }}</option>
                    </select>
                </div>

                <!-- Price List -->
                <div class="pos-field-group" style="min-width:150px;">
                    <label>💰 قائمة الأسعار</label>
                    <select class="pos-select" v-model="selectedPriceList" @change="onPriceListChange">
                        <option v-for="pl in allowedPriceLists" :value="pl">{{ pl }}</option>
                    </select>
                </div>

                <!-- Seller -->
                <div class="pos-field-group" style="min-width:140px;">
                    <label>👨‍💼 البائع</label>
                    <select class="pos-select" v-model="selectedSeller" @change="onSellerChange">
                        <option v-for="s in sellers" :value="s.name">{{ s.sales_person_name || s.name }}</option>
                    </select>
                </div>
            </div>

            <!-- Category Tabs -->
            <div class="pos-categories-wrap">
                <div class="pos-categories">
                    <div class="pos-cat-tab" :class="{ active: selectedCategory === 'all' }" @click="setCategory('all')">الكل</div>
                    <div
                        class="pos-cat-tab"
                        v-for="g in itemGroups"
                        :key="g.name"
                        :class="{ active: selectedCategory === g.name }"
                        @click="setCategory(g.name)"
                    >{{ g.item_group_name || g.name }}</div>
                </div>
            </div>

            <!-- Search Bar -->
            <div class="pos-search-wrap">
                <div class="pos-search-inner">
                    <span class="pos-search-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </span>
                    <input class="pos-input" v-model="searchQuery" @input="filterProducts" placeholder="ابحث بالصنف أو الكود...">
                </div>
            </div>

            <!-- Items Grid -->
            <div class="pos-items-area">
                <div v-if="loadingProducts" class="pos-loading-area">
                    <div class="pos-spinner"></div>
                    <span>جاري تحميل المنتجات...</span>
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
                        :class="{ 'stock-none-card': getTotalStock(product) <= 0 }"
                    >
                        <div class="product-img-wrap">
                            <img v-if="product.image && product.image.startsWith('/')" :src="product.image" :alt="product.item_name" @error="$event.target.style.display='none'">
                            <span v-else class="product-emoji">{{ product.image && !product.image.startsWith('/') ? product.image : '📦' }}</span>
                            <span class="product-stock-badge" :class="getStockClass(product)">{{ getStockText(product) }}</span>
                        </div>
                        <div class="product-info">
                            <div class="product-name">{{ product.item_name }}</div>
                            <div class="product-price">{{ (product.price || 0).toFixed(2) }} ج.م</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- ========== RIGHT PANEL: Cart ========== -->
        <div class="pos-right-panel">

            <!-- Order Header -->
            <div class="pos-order-header">
                <div class="pos-order-title">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;color:var(--blue);"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
                    الطلب
                    <span class="order-badge" v-if="cart.length">{{ cart.length }}</span>
                </div>
                <button v-if="cart.length > 0" class="pos-btn-icon" @click="clearCart" title="تفريغ الطلب">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    مسح
                </button>
            </div>

            <!-- Cart Items -->
            <div class="pos-cart-list">
                <div v-if="cart.length === 0" class="pos-empty">
                    <div class="icon">🛒</div>
                    <p>لا توجد أصناف في الطلب</p>
                    <p style="font-size:12px;margin-top:4px;">اضغط على صنف لإضافته</p>
                </div>
                <div
                    class="pos-cart-item"
                    v-for="(item, index) in cart"
                    :key="index"
                    :class="{ active: activeCartIndex === index }"
                    @click="selectCartItem(index)"
                >
                    <div class="cart-item-body">
                        <div class="cart-item-name">{{ item.item_name }}</div>
                        <div class="cart-item-wh">📦 {{ item.warehouse }}</div>
                        <div class="cart-item-nums">
                            <div class="cart-qty-ctrl">
                                <button class="cart-qty-btn" @click.stop="changeQty(index, -1)">−</button>
                                <span class="cart-qty-num">{{ item.qty }}</span>
                                <button class="cart-qty-btn" @click.stop="changeQty(index, 1)">+</button>
                            </div>
                            <span class="cart-item-rate">{{ item.rate.toFixed(2) }} ج.م</span>
                        </div>
                    </div>
                    <span class="cart-item-amount">{{ item.amount.toFixed(2) }}</span>
                    <button class="cart-item-delete" @click.stop="removeItem(index)" title="حذف">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                    </button>
                </div>
            </div>

            <!-- Numpad -->
            <div class="pos-numpad-wrap" v-if="cart.length > 0">
                <div class="numpad-mode-tabs">
                    <button class="numpad-mode-tab" :class="{ active: numpadMode === 'qty' }" @click="numpadMode = 'qty'; numpadInput = ''">الكمية</button>
                    <button class="numpad-mode-tab" :class="{ active: numpadMode === 'disc' }" @click="numpadMode = 'disc'; numpadInput = ''">الخصم</button>
                    <button class="numpad-mode-tab" :class="{ active: numpadMode === 'rate' }" @click="numpadMode = 'rate'; numpadInput = ''">السعر</button>
                </div>
                <div class="numpad-display">{{ numpadInput || (numpadMode === 'qty' ? (activeCartItem ? activeCartItem.qty : '—') : numpadMode === 'disc' ? discount : (activeCartItem ? activeCartItem.rate.toFixed(2) : '—')) }}</div>
                <div class="numpad-grid">
                    <button class="numpad-btn" v-for="n in ['7','8','9','4','5','6','1','2','3','.','0']" :key="n" @click="numpadPress(n)">{{ n }}</button>
                    <button class="numpad-btn danger" @click="numpadBackspace">⌫</button>
                    <button class="numpad-btn danger" style="grid-column:span 4;" @click="numpadClear">مسح</button>
                </div>
            </div>

            <!-- Totals -->
            <div class="pos-totals" v-if="cart.length > 0">
                <div class="pos-total-row">
                    <span class="label">المجموع الفرعي</span>
                    <span class="value">{{ totalAmount.toFixed(2) }} ج.م</span>
                </div>
                <div class="pos-total-row discount-row">
                    <span class="label">خصم (ج.م)</span>
                    <span class="value">
                        <input type="number" v-model.number="discount" min="0" placeholder="0">
                    </span>
                </div>
                <div class="pos-total-row" v-if="enableVat">
                    <span class="label">ضريبة {{ vatRate }}%</span>
                    <span class="value">{{ vatAmount.toFixed(2) }} ج.م</span>
                </div>
                <div class="pos-total-row grand-row">
                    <span class="label">الإجمالي</span>
                    <span class="value">{{ grandTotal.toFixed(2) }} ج.م</span>
                </div>
            </div>

            <!-- Checkout Button -->
            <div class="pos-checkout-wrap">
                <button
                    class="pos-btn-checkout"
                    @click="registerOrder"
                    :disabled="submitting || cart.length === 0"
                >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span v-if="submitting">⏳ جاري التسجيل...</span>
                    <span v-else>تسجيل الطلب — {{ grandTotal.toFixed(2) }} ج.م</span>
                </button>
            </div>
        </div>
    </div>

    <!-- ===== ADD TO CART MODAL ===== -->
    <div class="pos-modal-overlay" v-if="showModal" @click.self="showModal = false">
        <div class="pos-modal">
            <div class="pos-modal-header">
                <div class="pos-modal-title">إضافة صنف للطلب</div>
                <button class="pos-modal-close" @click="showModal = false">✕</button>
            </div>
            <div class="pos-modal-body">
                <!-- Item Detail -->
                <div class="pos-modal-item-detail">
                    <div class="pos-modal-item-img">
                        <img v-if="currentItem?.image && currentItem.image.startsWith('/')" :src="currentItem.image" :alt="currentItem?.item_name">
                        <span v-else>{{ currentItem?.image && !currentItem.image.startsWith('/') ? currentItem.image : '📦' }}</span>
                    </div>
                    <div class="pos-modal-item-info">
                        <div class="pos-modal-item-name">{{ currentItem?.item_name }}</div>
                        <div class="pos-modal-item-price">{{ currentItem?.price?.toFixed(2) }} ج.م</div>
                        <div class="pos-modal-item-cost" v-if="currentItem?.can_see_cost_price && currentItem?.cost_price">
                            💰 سعر الشراء: {{ currentItem.cost_price.toFixed(2) }} ج.م
                        </div>
                    </div>
                </div>

                <!-- All Prices -->
                <div class="pos-all-prices" v-if="currentItem?.all_prices && Object.keys(currentItem.all_prices).length > 0">
                    <div class="pos-all-prices-title">جميع الأسعار</div>
                    <div class="pos-price-row" v-for="(price, pl) in currentItem.all_prices" :key="pl">
                        <span class="pl-name">{{ pl }}</span>
                        <span class="pl-val">{{ price.toFixed(2) }} ج.م</span>
                    </div>
                </div>

                <!-- Warehouse Selection -->
                <div class="pos-section-label">اختر المخزن والكمية</div>
                <div class="pos-modal-wh-list">
                    <div
                        class="pos-modal-wh-row"
                        v-for="(wh, idx) in currentItem?.stock"
                        :key="idx"
                        :class="{ selected: selectedWh.includes(idx), disabled: wh.actual_qty <= 0 }"
                        @click="wh.actual_qty > 0 && toggleWh(idx)"
                    >
                        <input type="checkbox" :checked="selectedWh.includes(idx)" :disabled="wh.actual_qty <= 0" @click.stop style="accent-color:var(--blue);">
                        <span class="pos-modal-wh-name">{{ wh.warehouse_name || wh.warehouse }}</span>
                        <span class="pos-modal-wh-qty" :class="wh.actual_qty > 0 ? 'wh-qty-ok' : 'wh-qty-none'">
                            {{ wh.actual_qty > 0 ? 'متوفر: ' + wh.actual_qty : 'غير متوفر' }}
                        </span>
                        <input
                            v-if="selectedWh.includes(idx)"
                            v-model.number="whQty[idx]"
                            type="number" min="1" :max="wh.actual_qty"
                            class="pos-modal-wh-qty-input"
                            @click.stop
                        >
                    </div>
                </div>

                <!-- Summary -->
                <div class="pos-modal-summary">
                    الإجمالي:
                    <strong>{{ modalTotalQty }} × {{ currentItem?.price?.toFixed(2) }} ج.م = {{ modalTotal.toFixed(2) }} ج.م</strong>
                </div>
            </div>
            <div class="pos-modal-footer">
                <button class="pos-btn pos-btn-primary" style="flex:1;justify-content:center;" @click="addToCart">
                    ➕ أضف للطلب
                </button>
                <button class="pos-btn pos-btn-ghost" @click="showModal = false">إلغاء</button>
            </div>
        </div>
    </div>

    <!-- ===== CREATE CUSTOMER MODAL ===== -->
    <div class="pos-modal-overlay" v-if="showCreateCustomer" @click.self="showCreateCustomer = false">
        <div class="pos-modal">
            <div class="pos-modal-header">
                <div class="pos-modal-title">👤 إضافة عميل جديد</div>
                <button class="pos-modal-close" @click="showCreateCustomer = false">✕</button>
            </div>
            <div class="pos-modal-body">
                <div class="pos-field-group" style="margin-bottom:14px;">
                    <label>اسم العميل *</label>
                    <input class="pos-input" v-model="newCustomerName" placeholder="أدخل اسم العميل...">
                </div>
                <div class="pos-field-group" style="margin-bottom:14px;">
                    <label>رقم الهاتف</label>
                    <input class="pos-input" v-model="newCustomerPhone" type="tel" placeholder="01xxxxxxxxx">
                </div>
                <div class="pos-field-group">
                    <label>مجموعة العميل *</label>
                    <select class="pos-select" v-model="newCustomerGroup">
                        <option v-for="g in customerGroups" :value="g.name">{{ g.customer_group_name || g.name }}</option>
                    </select>
                </div>
            </div>
            <div class="pos-modal-footer">
                <button class="pos-btn pos-btn-primary" style="flex:1;justify-content:center;" @click="submitCreateCustomer" :disabled="!newCustomerName || creatingCustomer">
                    <span v-if="creatingCustomer">⏳ جاري الإنشاء...</span>
                    <span v-else>✅ إنشاء العميل</span>
                </button>
                <button class="pos-btn pos-btn-ghost" @click="showCreateCustomer = false">إلغاء</button>
            </div>
        </div>
    </div>

    <!-- ===== TOAST ===== -->
    <div class="pos-toast" :class="toast.type" v-if="toast.show">{{ toast.message }}</div>

    <!-- ===== LOADING OVERLAY ===== -->
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
            // =====================
            // STATE — unchanged
            // =====================
            const loadingProducts = ref(true);
            const submitting = ref(false);
            const products = ref([]);
            const filteredProducts = ref([]);
            const itemGroups = ref([]);
            const selectedCategory = ref('all');
            const searchQuery = ref('');
            const cart = ref([]);
            const discount = ref(0);
            const allowedPriceLists = ref([]);
            const enableVat = ref(true);
            const vatRate = ref(14);

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
            const newCustomerGroup = ref('');
            const customerGroups = ref([]);
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

            // Numpad state (UI-only, no backend changes)
            const numpadMode = ref('qty'); // 'qty' | 'disc' | 'rate'
            const numpadInput = ref('');
            const activeCartIndex = ref(-1);

            // =====================
            // COMPUTED — unchanged
            // =====================
            const totalAmount = computed(() => cart.value.reduce((s, i) => s + i.amount, 0));
            const vatAmount = computed(() => enableVat.value ? (totalAmount.value - (discount.value || 0)) * (vatRate.value / 100) : 0);
            const grandTotal = computed(() => Math.max(0, (totalAmount.value - (discount.value || 0)) + vatAmount.value));
            const modalTotalQty = computed(() => selectedWh.value.reduce((s, idx) => s + (whQty.value[idx] || 0), 0));
            const modalTotal = computed(() => modalTotalQty.value * (currentItem.value?.price || 0));
            const activeCartItem = computed(() => activeCartIndex.value >= 0 ? cart.value[activeCartIndex.value] : null);

            // =====================
            // MOUNT — unchanged
            // =====================
            onMounted(() => { loadInitialData(); });

            // =====================
            // DATA LOADING — unchanged (no backend changes)
            // =====================
            function loadInitialData() {
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

                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_customer_groups',
                    callback: (r) => {
                        if (r.message && r.message.length) {
                            customerGroups.value = r.message;
                            newCustomerGroup.value = r.message[0]?.name || '';
                        }
                    }
                });

                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_pos_settings',
                    callback: (r) => {
                        if (r.message) {
                            allowedPriceLists.value = r.message.allowed_price_lists;
                            enableVat.value = r.message.enable_vat;
                            vatRate.value = r.message.vat_rate;
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

            // =====================
            // FILTERS — unchanged
            // =====================
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

            // =====================
            // CUSTOMER — unchanged
            // =====================
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
                    args: { customer_name: newCustomerName.value, mobile_no: newCustomerPhone.value, customer_group: newCustomerGroup.value },
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

            // =====================
            // MODAL — unchanged
            // =====================
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
                showToast('✅ تمت الإضافة للطلب', 'success');
            }

            // =====================
            // CART — unchanged
            // =====================
            function selectCartItem(index) {
                activeCartIndex.value = index;
                numpadInput.value = '';
            }

            function changeQty(index, delta) {
                cart.value[index].qty += delta;
                if (cart.value[index].qty <= 0) {
                    cart.value.splice(index, 1);
                    if (activeCartIndex.value >= cart.value.length) activeCartIndex.value = cart.value.length - 1;
                } else {
                    cart.value[index].amount = cart.value[index].qty * cart.value[index].rate;
                }
            }

            function removeItem(index) {
                cart.value.splice(index, 1);
                if (activeCartIndex.value >= cart.value.length) activeCartIndex.value = cart.value.length - 1;
            }

            function clearCart() {
                if (!cart.value.length) return;
                if (!confirm('هل تريد إفراغ الطلب؟')) return;
                cart.value = [];
                discount.value = 0;
                activeCartIndex.value = -1;
                numpadInput.value = '';
                showToast('🗑️ تم إفراغ الطلب', 'success');
            }

            // =====================
            // NUMPAD (UI only — applies to cart item qty/rate or discount)
            // =====================
            function numpadPress(key) {
                if (numpadInput.value === '0' && key !== '.') numpadInput.value = key;
                else numpadInput.value += key;
                applyNumpad();
            }

            function numpadBackspace() {
                numpadInput.value = numpadInput.value.slice(0, -1);
                applyNumpad();
            }

            function numpadClear() {
                numpadInput.value = '';
            }

            function applyNumpad() {
                const val = parseFloat(numpadInput.value);
                if (isNaN(val) || val < 0) return;
                if (numpadMode.value === 'disc') {
                    discount.value = val;
                } else if (activeCartIndex.value >= 0 && cart.value[activeCartIndex.value]) {
                    const item = cart.value[activeCartIndex.value];
                    if (numpadMode.value === 'qty') {
                        if (val > 0) {
                            item.qty = val;
                            item.amount = item.qty * item.rate;
                        }
                    } else if (numpadMode.value === 'rate') {
                        if (val >= 0) {
                            item.rate = val;
                            item.amount = item.qty * item.rate;
                        }
                    }
                }
            }

            // =====================
            // REGISTER ORDER — unchanged
            // =====================
            function registerOrder() {
                if (!cart.value.length) { showToast('⚠️ الطلب فارغ!', 'warning'); return; }
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
                            activeCartIndex.value = -1;
                            numpadInput.value = '';
                            clearCustomer();
                        } else {
                            showToast('❌ خطأ في التسجيل', 'error');
                        }
                    },
                    error: () => {
                        submitting.value = false;
                        showToast('❌ خطأ في التسجيل', 'error');
                    }
                });
            }

            // =====================
            // HELPERS — unchanged
            // =====================
            function onPriceListChange() { loadProducts(); showToast('تم تغيير قائمة الأسعار', 'success'); }

            function onSellerChange() {
                const s = sellers.value.find(x => x.name === selectedSeller.value);
                sellerLabel.value = s?.sales_person_name || s?.name || 'البائع';
            }

            function getTotalStock(product) {
                return product.stock ? product.stock.reduce((s, w) => s + (w.actual_qty || 0), 0) : 0;
            }

            function getStockClass(product) {
                const total = getTotalStock(product);
                return total === 0 ? 'stock-none' : total < 10 ? 'stock-low' : 'stock-available';
            }

            function getStockText(product) {
                const total = getTotalStock(product);
                return total === 0 ? 'نفذ' : total < 10 ? `⚠ ${total}` : `${total}`;
            }

            function showToast(message, type = 'success') {
                toast.value = { show: true, message, type };
                setTimeout(() => toast.value.show = false, 3200);
            }

            return {
                loadingProducts, submitting, products, filteredProducts,
                itemGroups, selectedCategory, searchQuery,
                cart, discount, totalAmount, vatAmount, grandTotal, enableVat, vatRate,
                customerQuery, customerResults, customerSearching,
                showCustomerDropdown, selectedCustomer, selectedCustomerName,
                showCreateCustomer, newCustomerName, newCustomerPhone, newCustomerGroup, customerGroups, creatingCustomer,
                showModal, currentItem, selectedWh, whQty,
                modalTotalQty, modalTotal,
                branches, priceLists, sellers,
                selectedBranch, selectedPriceList, selectedSeller,
                sellerLabel, branchLabel, toast,
                allowedPriceLists,
                numpadMode, numpadInput, activeCartIndex, activeCartItem,
                setCategory, filterProducts,
                onCustomerInput, selectCustomer, clearCustomer, closeCustomerDropdown,
                openCreateCustomer, submitCreateCustomer,
                openModal, toggleWh, addToCart,
                selectCartItem, changeQty, removeItem, clearCart, registerOrder,
                onPriceListChange, onSellerChange,
                getTotalStock, getStockClass, getStockText,
                numpadPress, numpadBackspace, numpadClear,
            };
        }
    });

    app.mount('#pos-root');
}
