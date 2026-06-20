// Vue 3 POS for ERPNext v16 - No build needed!
// Uses Vue 3 CDN + Frappe API

frappe.provide("custom_pos");

$(document).on('page-change', function() {
    if (frappe.get_route && frappe.get_route()[0] === "custom-pos") {
        setTimeout(initVuePOS, 500);
    }
});

function initVuePOS() {
    var main = $(".layout-main-section");
    if (!main.length || main.find("#vue-pos-app").length) return;

    // Load Vue 3 from CDN if not loaded
    if (!window.Vue) {
        var script = document.createElement('script');
        script.src = 'https://unpkg.com/vue@3/dist/vue.global.js';
        script.onload = createVueApp;
        document.head.appendChild(script);
    } else {
        createVueApp();
    }
}

function createVueApp() {
    var main = $(".layout-main-section");

    main.html(`
        <div id="vue-pos-app" style="padding: 20px; font-family: 'Segoe UI', sans-serif;">
            <div v-if="loading" style="text-align: center; padding: 50px;">
                <div style="width: 50px; height: 50px; border: 4px solid #ddd; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                <div style="margin-top: 15px;">جاري التحميل...</div>
            </div>

            <div v-else>
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                    <h2 style="margin: 0;">🛍️ POS تسجيل طلب</h2>
                    <div style="display: flex; gap: 20px; margin-top: 10px;">
                        <span>👨‍💼 {{ sellerName }}</span>
                        <span>🏪 {{ branchName }}</span>
                    </div>
                </div>

                <!-- Info Bar -->
                <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">📱 تليفون العميل</label>
                        <div style="display: flex; gap: 5px;">
                            <input v-model="customerPhone" type="tel" placeholder="01xxxxxxxxx" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 150px;">
                            <button @click="searchCustomer" style="padding: 10px 15px; background: #667eea; color: white; border: none; border-radius: 6px; cursor: pointer;">🔍</button>
                        </div>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">👤 العميل</label>
                        <select v-model="selectedCustomer" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 180px;">
                            <option value="">-- اختر --</option>
                            <option v-for="c in customers" :value="c.name">{{ c.customer_name || c.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">🏪 الفرع</label>
                        <select v-model="selectedBranch" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 180px;">
                            <option v-for="b in branches" :value="b.name">{{ b.cost_center_name || b.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">💰 قائمة الأسعار</label>
                        <select v-model="selectedPriceList" @change="onPriceListChange" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 180px;">
                            <option v-for="p in priceLists" :value="p.name">{{ p.name }}</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #555;">👨‍💼 البائع</label>
                        <select v-model="selectedSeller" style="padding: 10px; border: 1px solid #ddd; border-radius: 6px; width: 180px;">
                            <option v-for="s in sellers" :value="s.name">{{ s.sales_person_name || s.name }}</option>
                        </select>
                    </div>
                </div>

                <!-- Search -->
                <div style="margin-bottom: 20px;">
                    <input v-model="searchQuery" @keyup="searchItems" type="text" placeholder="🔍 بحث بالصنف..." style="padding: 12px; width: 100%; max-width: 500px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px;">
                </div>

                <!-- Main Content -->
                <div style="display: flex; gap: 20px;">
                    <!-- Products -->
                    <div style="flex: 2;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px;">
                            <div v-for="product in filteredProducts" :key="product.item_code" @click="openModal(product)" style="background: white; padding: 15px; border-radius: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; text-align: center;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                <div style="font-size: 45px; margin-bottom: 8px;">{{ product.image || '📦' }}</div>
                                <div style="font-weight: bold; color: #333; margin-bottom: 5px; font-size: 14px;">{{ product.item_name }}</div>
                                <div style="color: #667eea; font-weight: bold; font-size: 18px; margin-bottom: 5px;">{{ product.price?.toFixed(2) }} ج.م</div>
                                <div style="font-size: 12px;" :style="getStockStyle(product)">{{ getStockText(product) }}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Cart -->
                    <div style="flex: 1; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); min-height: 400px;">
                        <h3 style="margin-top: 0; color: #333; border-bottom: 2px solid #667eea; padding-bottom: 10px;">🛒 السلة ({{ cart.length }})</h3>
                        <div v-if="cart.length === 0" style="text-align: center; color: #999; padding: 40px;">
                            <div style="font-size: 40px;">🛒</div>
                            <div>السلة فارغة</div>
                        </div>
                        <div v-else>
                            <div v-for="(item, index) in cart" :key="index" style="padding: 12px; border-bottom: 1px solid #eee; margin-bottom: 8px;">
                                <div style="display: flex; justify-content: space-between;">
                                    <span style="font-weight: bold;">{{ item.emoji }} {{ item.item_name }}</span>
                                    <span style="color: #666; font-size: 12px;">📦 {{ item.warehouse }}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                                    <span>
                                        <button @click="changeQty(index, -1)" style="padding: 4px 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">−</button>
                                        <span style="margin: 0 10px; font-weight: bold;">{{ item.qty }}</span>
                                        <button @click="changeQty(index, 1)" style="padding: 4px 10px; background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; cursor: pointer;">+</button>
                                    </span>
                                    <span style="color: #667eea; font-weight: bold;">{{ item.amount.toFixed(2) }} ج.م</span>
                                    <button @click="removeItem(index)" style="background: none; border: none; cursor: pointer; font-size: 18px; color: #f44336;">🗑️</button>
                                </div>
                            </div>
                            <div style="margin-top: 20px; padding-top: 15px; border-top: 2px solid #eee;">
                                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                    <span>الكمية:</span>
                                    <span style="font-weight: bold;">{{ totalQty }}</span>
                                </div>
                                <div style="display: flex; justify-content: space-between; margin: 8px 0;">
                                    <span>المجموع:</span>
                                    <span style="font-weight: bold;">{{ totalAmount.toFixed(2) }}</span> ج.م
                                </div>
                                <div style="display: flex; justify-content: space-between; margin: 8px 0; align-items: center;">
                                    <span>الخصم:</span>
                                    <input v-model.number="discount" type="number" min="0" style="width: 80px; padding: 5px; border: 1px solid #ddd; border-radius: 4px;">
                                </div>
                                <div style="display: flex; justify-content: space-between; margin: 15px 0; padding: 10px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 18px; font-weight: bold;">
                                    <span>الإجمالي:</span>
                                    <span>{{ grandTotal.toFixed(2) }}</span> ج.م
                                </div>
                            </div>
                            <button @click="registerOrder" style="width: 100%; padding: 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; margin-bottom: 10px;">💾 تسجيل الطلب</button>
                            <button @click="clearCart" style="width: 100%; padding: 12px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer;">❌ إفراغ السلة</button>
                        </div>
                    </div>
                </div>

                <!-- Modal -->
                <div v-if="showModal" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 9999; align-items: center; justify-content: center;">
                    <div style="background: white; padding: 25px; border-radius: 15px; width: 450px; max-width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="margin: 0; color: #333;">➕ إضافة صنف</h3>
                            <button @click="showModal = false" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">✕</button>
                        </div>
                        <div style="text-align: center; margin-bottom: 15px;">
                            <div style="font-size: 50px;">{{ currentItem?.image || '📦' }}</div>
                            <div style="font-size: 18px; font-weight: bold; color: #333;">{{ currentItem?.item_name }}</div>
                            <div style="color: #667eea; font-size: 22px; font-weight: bold;">{{ currentItem?.price?.toFixed(2) }} ج.م</div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <div style="font-weight: bold; margin-bottom: 10px; color: #555;">📦 اختر المخازن:</div>
                            <div v-for="(wh, idx) in currentItem?.stock" :key="idx" @click="toggleWh(idx)" :style="{ opacity: wh.actual_qty <= 0 ? 0.5 : 1, background: selectedWh.includes(idx) ? '#e8f5e9' : 'white' }" style="padding: 10px; border: 1px solid #ddd; margin: 8px 0; border-radius: 8px; cursor: pointer;">
                                <input type="checkbox" :checked="selectedWh.includes(idx)" :disabled="wh.actual_qty <= 0" style="margin-left: 10px;" @click.stop>
                                <label style="margin-left: 8px; font-weight: bold;">{{ wh.warehouse_name || wh.warehouse }}</label>
                                <span style="margin-left: 10px; color: #4caf50; font-size: 12px;">{{ wh.actual_qty <= 0 ? '❌ غير متوفر' : '✅ متوفر: ' + wh.actual_qty }}</span>
                                <input v-if="selectedWh.includes(idx)" v-model.number="whQty[idx]" type="number" min="1" :max="wh.actual_qty" style="width: 60px; margin-right: 10px;" @click.stop>
                            </div>
                        </div>
                        <div style="text-align: center; padding: 12px; background: #e8f5e9; border-radius: 8px; margin: 15px 0; font-weight: bold; color: #2e7d32;">
                            الإجمالي: {{ modalTotalQty }} × {{ currentItem?.price?.toFixed(2) }} = {{ modalTotal.toFixed(2) }} ج.م
                        </div>
                        <div style="text-align: center;">
                            <button @click="addToCart" style="padding: 12px 25px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">➕ أضف للسلة</button>
                            <button @click="showModal = false" style="padding: 12px 25px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; margin-left: 10px;">❌ إلغاء</button>
                        </div>
                    </div>
                </div>

                <!-- Toast -->
                <div v-if="toast.show" :style="{ background: toast.type === 'error' ? '#f44336' : toast.type === 'warning' ? '#ff9800' : '#4caf50' }" style="display: block; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); color: white; padding: 14px 28px; border-radius: 8px; z-index: 10000; font-weight: bold; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    {{ toast.message }}
                </div>

                <!-- Loading -->
                <div v-if="loading" style="display: flex; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,255,255,0.9); z-index: 10001; align-items: center; justify-content: center; flex-direction: column;">
                    <div style="width: 50px; height: 50px; border: 4px solid #ddd; border-top-color: #667eea; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <div style="margin-top: 15px; color: #667eea; font-weight: bold;">جاري التسجيل...</div>
                </div>
            </div>
        </div>
    `);

    // Create Vue 3 app
    const { createApp, ref, computed, onMounted } = Vue;

    const app = createApp({
        setup() {
            const loading = ref(true);
            const products = ref([]);
            const filteredProducts = ref([]);
            const cart = ref([]);
            const currentItem = ref(null);
            const showModal = ref(false);
            const selectedWh = ref([]);
            const whQty = ref({});
            const discount = ref(0);
            const searchQuery = ref('');
            const customerPhone = ref('');
            const selectedCustomer = ref('');
            const selectedBranch = ref('');
            const selectedPriceList = ref('');
            const selectedSeller = ref('');
            const customers = ref([]);
            const branches = ref([]);
            const priceLists = ref([]);
            const sellers = ref([]);
            const sellerName = ref('البائع');
            const branchName = ref('الفرع');
            const toast = ref({ show: false, message: '', type: 'success' });

            const totalQty = computed(() => cart.value.reduce((s, i) => s + i.qty, 0));
            const totalAmount = computed(() => cart.value.reduce((s, i) => s + i.amount, 0));
            const grandTotal = computed(() => totalAmount.value - discount.value);

            const modalTotalQty = computed(() => {
                return selectedWh.value.reduce((sum, idx) => sum + (whQty.value[idx] || 0), 0);
            });
            const modalTotal = computed(() => modalTotalQty.value * (currentItem.value?.price || 0));

            onMounted(() => {
                loadInitialData();
            });

            function loadInitialData() {
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Sales Person', fields: ['name', 'sales_person_name'], filters: { enabled: 1 } },
                    callback: (r) => {
                        if (r.message) {
                            sellers.value = r.message;
                            selectedSeller.value = r.message[0]?.name || '';
                            sellerName.value = r.message[0]?.sales_person_name || r.message[0]?.name || 'البائع';
                        }
                    }
                });

                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Cost Center', fields: ['name', 'cost_center_name'] },
                    callback: (r) => {
                        if (r.message) {
                            branches.value = r.message;
                            selectedBranch.value = r.message[0]?.name || '';
                            branchName.value = r.message[0]?.cost_center_name || r.message[0]?.name || 'الفرع';
                        }
                    }
                });

                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Price List', fields: ['name'], filters: { selling: 1, enabled: 1 } },
                    callback: (r) => {
                        if (r.message) {
                            priceLists.value = r.message;
                            selectedPriceList.value = r.message[0]?.name || '';
                            loadProducts();
                        }
                    }
                });

                frappe.call({
                    method: 'frappe.client.get_list',
                    args: { doctype: 'Customer', fields: ['name', 'customer_name'], limit: 100 },
                    callback: (r) => {
                        if (r.message) customers.value = r.message;
                    }
                });
            }

            function loadProducts() {
                if (!selectedPriceList.value) return;
                loading.value = true;
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_all_items_with_prices',
                    args: { price_list: selectedPriceList.value },
                    callback: (r) => {
                        products.value = r.message || [];
                        filteredProducts.value = products.value;
                        loading.value = false;
                    },
                    error: () => {
                        loading.value = false;
                        showToast('❌ خطأ في تحميل المنتجات', 'error');
                    }
                });
            }

            function onPriceListChange() {
                loadProducts();
                showToast('تم تغيير قائمة الأسعار', 'success');
            }

            function searchItems() {
                if (!searchQuery.value) {
                    filteredProducts.value = products.value;
                    return;
                }
                filteredProducts.value = products.value.filter(p => 
                    p.item_name.includes(searchQuery.value) || p.item_code.includes(searchQuery.value)
                );
            }

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
                }
            }

            function addToCart() {
                if (!selectedWh.value.length) {
                    showToast('⚠️ اختر مخزن على الأقل', 'warning');
                    return;
                }
                selectedWh.value.forEach(idx => {
                    const wh = currentItem.value.stock[idx];
                    const qty = whQty.value[idx] || 1;
                    cart.value.push({
                        item_code: currentItem.value.item_code,
                        item_name: currentItem.value.item_name,
                        emoji: currentItem.value.image || '📦',
                        qty: qty,
                        rate: currentItem.value.price,
                        warehouse: wh.warehouse_name || wh.warehouse,
                        amount: qty * currentItem.value.price
                    });
                });
                showModal.value = false;
                showToast('✅ تمت الإضافة للسلة', 'success');
            }

            function changeQty(index, delta) {
                cart.value[index].qty += delta;
                if (cart.value[index].qty <= 0) {
                    cart.value.splice(index, 1);
                } else {
                    cart.value[index].amount = cart.value[index].qty * cart.value[index].rate;
                }
            }

            function removeItem(index) {
                cart.value.splice(index, 1);
            }

            function clearCart() {
                if (!cart.value.length) return;
                if (!confirm('هل تريد إفراغ السلة؟')) return;
                cart.value = [];
                showToast('🗑️ تم إفراغ السلة', 'success');
            }

            function registerOrder() {
                if (!cart.value.length) {
                    showToast('⚠️ السلة فارغة!', 'warning');
                    return;
                }
                if (!selectedCustomer.value) {
                    showToast('⚠️ اختر العميل!', 'warning');
                    return;
                }
                if (!customerPhone.value) {
                    showToast('⚠️ أدخل رقم التليفون!', 'warning');
                    return;
                }
                loading.value = true;
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.register_pos_order',
                    args: {
                        data: {
                            seller: selectedSeller.value,
                            customer: selectedCustomer.value,
                            customer_phone: customerPhone.value,
                            price_list: selectedPriceList.value,
                            branch: selectedBranch.value,
                            discount_amount: discount.value,
                            items: cart.value.map(i => ({
                                item_code: i.item_code,
                                qty: i.qty,
                                rate: i.rate,
                                warehouse: i.warehouse
                            }))
                        }
                    },
                    callback: (r) => {
                        loading.value = false;
                        if (r.message) {
                            showToast('✅ تم التسجيل: ' + r.message.name, 'success');
                            cart.value = [];
                            discount.value = 0;
                            customerPhone.value = '';
                            selectedCustomer.value = '';
                        } else {
                            showToast('❌ خطأ في التسجيل', 'error');
                        }
                    },
                    error: () => {
                        loading.value = false;
                        showToast('❌ خطأ في التسجيل', 'error');
                    }
                });
            }

            function searchCustomer() {
                if (!customerPhone.value) {
                    showToast('⚠️ أدخل رقم التليفون', 'warning');
                    return;
                }
                frappe.call({
                    method: 'custom_pos.custom_pos.api.api.get_customer_by_phone',
                    args: { phone: customerPhone.value },
                    callback: (r) => {
                        const customers_list = r.message || [];
                        if (customers_list.length) {
                            customers.value = customers_list;
                            selectedCustomer.value = customers_list[0].name;
                            showToast('✅ تم العثور على العميل', 'success');
                        } else {
                            showToast('❌ لا يوجد عميل بهذا الرقم', 'warning');
                        }
                    }
                });
            }

            function getStockStyle(product) {
                const totalStock = product.stock ? product.stock.reduce((sum, s) => sum + (s.actual_qty || 0), 0) : 0;
                return totalStock === 0 ? 'color: #f44336;' : totalStock < 10 ? 'color: #ff9800;' : 'color: #4caf50;';
            }

            function getStockText(product) {
                const totalStock = product.stock ? product.stock.reduce((sum, s) => sum + (s.actual_qty || 0), 0) : 0;
                return totalStock === 0 ? 'غير متوفر' : `متوفر: ${totalStock}`;
            }

            function showToast(message, type = 'success') {
                toast.value = { show: true, message, type };
                setTimeout(() => toast.value.show = false, 3000);
            }

            return {
                loading, products, filteredProducts, cart, currentItem, showModal,
                selectedWh, whQty, discount, searchQuery, customerPhone,
                selectedCustomer, selectedBranch, selectedPriceList, selectedSeller,
                customers, branches, priceLists, sellers, sellerName, branchName,
                toast, totalQty, totalAmount, grandTotal, modalTotalQty, modalTotal,
                loadProducts, onPriceListChange, searchItems, openModal, toggleWh,
                addToCart, changeQty, removeItem, clearCart, registerOrder,
                searchCustomer, getStockStyle, getStockText
            };
        }
    });

    app.mount('#vue-pos-app');
}
