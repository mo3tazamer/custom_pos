frappe.pages['custom-pos'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Custom POS',
        single_column: true
    });

    frappe.require([
        '/assets/custom_pos/css/vue3.pos.css',
        '/assets/custom_pos/js/vue3.pos.js'
    ], function() {
        if (window.initVuePOS) {
            window.initVuePOS(wrapper);
        }
    });
};

// Strip ERPNext chrome every time the page is shown (full-screen single-page POS)
frappe.pages['custom-pos'].on_page_show = function(wrapper) {
    _pos_enter_fullscreen(wrapper);
};

frappe.pages['custom-pos'].on_page_hide = function(wrapper) {
    _pos_exit_fullscreen();
};

function _pos_enter_fullscreen(wrapper) {
    // Hide ERPNext page title bar
    $(wrapper).find('.page-head').hide();

    // Remove all padding/margin from layout containers
    $(wrapper).find('.layout-main').css({ padding: '0', margin: '0' });
    $(wrapper).find('.layout-main-section').css({ padding: '0', margin: '0', 'min-height': '0' });
    $(wrapper).find('.layout-main-section-wrapper').css({ padding: '0', margin: '0' });

    // Prevent body from scrolling (POS handles its own internal scroll)
    $('body').addClass('pos-fullscreen-mode');
    $('.page-container').addClass('pos-page-container');
}

function _pos_exit_fullscreen() {
    // Restore body scroll when leaving POS
    $('body').removeClass('pos-fullscreen-mode');
    $('.page-container').removeClass('pos-page-container');
}


