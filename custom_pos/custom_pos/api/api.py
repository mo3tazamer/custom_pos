import frappe
from frappe import _
from frappe.utils import flt

def check_pos_permission():
    """Check if current user has permission to access POS"""
    if frappe.session.user == "Administrator":
        return True
    
    pos_settings = frappe.get_single("POS Settings")
    user_roles = frappe.get_roles()
    
    # Check if any allowed role is present
    if pos_settings.allowed_roles:
        allowed = False
        for role in pos_settings.allowed_roles:
            if role.role in user_roles:
                allowed = True
                break
        if not allowed:
            frappe.throw(_("You do not have permission to access POS"), frappe.PermissionError)
    return True

@frappe.whitelist()
def get_all_items_with_prices(price_list=None, category=None):
    try:
        # Check permissions first
        check_pos_permission()
        
        # Get POS Settings
        pos_settings = frappe.get_single("POS Settings")
        show_only_in_stock = pos_settings.show_only_in_stock or 0
        items_per_page = pos_settings.items_per_page or 500
        
        filters = {"disabled": 0, "is_sales_item": 1}
        if category and category != "all":
            filters["item_group"] = category
        
        items = frappe.get_all("Item", filters=filters, fields=["name", "item_name", "item_code", "item_group", "image"], limit=items_per_page)
        result = []
        
        for item in items:
            price = 0
            if price_list:
                price_data = frappe.get_all("Item Price", filters={"item_code": item.item_code, "price_list": price_list, "selling": 1}, fields=["price_list_rate"], limit=1)
                if price_data: 
                    price = price_data[0].price_list_rate
            
            stock = frappe.get_all("Bin", filters={"item_code": item.item_code}, fields=["warehouse", "actual_qty"])
            stock_with_names = []
            total_stock = 0
            
            for s in stock:
                wh_name = frappe.get_value("Warehouse", s.warehouse, "warehouse_name") or s.warehouse
                stock_with_names.append({"warehouse": s.warehouse, "warehouse_name": wh_name, "actual_qty": s.actual_qty})
                total_stock += s.actual_qty
            
            # Skip if show_only_in_stock is enabled and total_stock <= 0
            if show_only_in_stock and total_stock <= 0:
                continue
                
            result.append({"item_code": item.item_code, "item_name": item.item_name, "item_group": item.item_group, "image": item.image, "price": price, "stock": stock_with_names})
        
        return result
    except Exception as e:
        frappe.log_error(f"Error: {str(e)}")
        return []

@frappe.whitelist()
def get_item_groups():
    try:
        check_pos_permission()
        # Get item groups that actually have active sales items
        groups = frappe.db.sql("""
            SELECT DISTINCT ig.name, ig.item_group_name
            FROM `tabItem Group` ig
            INNER JOIN `tabItem` i ON i.item_group = ig.name
            WHERE i.disabled = 0 AND i.is_sales_item = 1
            ORDER BY ig.name
        """, as_dict=True)
        return groups
    except Exception as e:
        frappe.log_error(f"Error in get_item_groups: {str(e)}")
        return []

@frappe.whitelist()
def get_customer_by_phone(phone):
    try:
        check_pos_permission()
        return frappe.get_all("Customer", filters={"mobile_no": ["like", f"%{phone}%"]}, fields=["name", "customer_name", "mobile_no"])
    except Exception as e:
        frappe.log_error(f"Error: {str(e)}")
        return []

@frappe.whitelist()
def search_customer(query):
    try:
        check_pos_permission()
        if not query or len(query) < 2:
            return []
        results = frappe.db.sql("""
            SELECT name, customer_name, mobile_no
            FROM `tabCustomer`
            WHERE disabled = 0 AND (
                customer_name LIKE %(q)s OR
                mobile_no LIKE %(q)s OR
                name LIKE %(q)s
            )
            LIMIT 20
        """, {"q": f"%{query}%"}, as_dict=True)
        return results
    except Exception as e:
        frappe.log_error(f"Error in search_customer: {str(e)}")
        return []

@frappe.whitelist()
def create_customer(customer_name, mobile_no=None):
    try:
        check_pos_permission()
        # Get default values
        default_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        default_territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"

        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": "Individual",
            "customer_group": default_group,
            "territory": default_territory,
            "mobile_no": mobile_no or ""
        })
        customer.insert(ignore_permissions=True)
        return {"name": customer.name, "customer_name": customer.customer_name, "mobile_no": customer.mobile_no}
    except Exception as e:
        frappe.log_error(f"Error in create_customer: {str(e)}")
        frappe.throw(_("Error creating customer: {0}").format(str(e)))

@frappe.whitelist()
def register_pos_order(data):
    try:
        check_pos_permission()
        
        # 1. Create and insert POS Order
        pos_order = frappe.get_doc({
            "doctype": "POS Order",
            "seller": data.get("seller"),
            "customer": data.get("customer"),
            "customer_phone": data.get("customer_phone"),
            "price_list": data.get("price_list"),
            "branch": data.get("branch"),
            "discount_amount": data.get("discount_amount", 0),
            "status": "Draft",
            "items": []
        })
        for item in data.get("items", []):
            pos_order.append("items", {
                "item_code": item["item_code"],
                "qty": item["qty"],
                "rate": item["rate"],
                "warehouse": item["warehouse"],
                "amount": flt(item["qty"]) * flt(item["rate"])
            })
        pos_order.insert()

        # 2. Get company from cost center or defaults
        company = None
        if data.get("branch"):
            company = frappe.get_value("Cost Center", data.get("branch"), "company")
        if not company:
            company = frappe.db.get_single_value('Global Defaults', 'default_company')

        # 3. Create and insert Sales Invoice
        si = frappe.new_doc("Sales Invoice")
        si.customer = data.get("customer")
        si.selling_price_list = data.get("price_list")
        si.cost_center = data.get("branch")
        si.discount_amount = flt(data.get("discount_amount", 0))
        si.company = company
        si.is_pos = 0
        si.posting_date = frappe.utils.today()
        si.due_date = frappe.utils.today()

        for item in data.get("items", []):
            si.append("items", {
                "item_code": item["item_code"],
                "qty": item["qty"],
                "rate": item["rate"],
                "warehouse": item["warehouse"],
                "amount": flt(item["qty"]) * flt(item["rate"])
            })

        si.set_missing_values()
        si.insert()

        # 4. Link Sales Invoice to POS Order and save
        pos_order.sales_invoice = si.name
        pos_order.save()

        return {"name": pos_order.name, "sales_invoice": si.name}
    except Exception as e:
        frappe.log_error(f"Error in register_pos_order: {str(e)}")
        frappe.throw(_("Error: {0}").format(str(e)))
