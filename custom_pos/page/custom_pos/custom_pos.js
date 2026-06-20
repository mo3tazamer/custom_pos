frappe.pages['custom-pos'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'POS تسجيل طلب',
        single_column: true
    });

    // Load assets dynamically and initialize POS app
    frappe.require([
        '/assets/custom_pos/css/vue3.pos.css',
        '/assets/custom_pos/js/vue3.pos.js'
    ], function() {
        if (window.initVuePOS) {
            window.initVuePOS(wrapper);
        }
    });
};

