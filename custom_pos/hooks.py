app_name = "custom_pos"
app_title = "Custom POS"
app_publisher = "Your Company"
app_description = "Custom POS for ERPNext v16 - Vue 3"
app_email = "your@email.com"
app_license = "MIT"

app_include_js = [
    "/assets/custom_pos/js/vue3.pos.js"
]

app_include_css = [
    "/assets/custom_pos/css/vue3.pos.css"
]

doc_events = {
    "POS Order": {
        "on_submit": "custom_pos.custom_pos.doctype.pos_order.pos_order.on_submit",
        "on_cancel": "custom_pos.custom_pos.doctype.pos_order.pos_order.on_cancel",
    }
}
