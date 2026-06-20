import frappe
from frappe import _
from frappe.utils import flt


@frappe.whitelist()
def get_pos_settings():
    check_pos_permission()
    pos_settings = frappe.get_single("POS Settings")
    
    # Return all enabled selling price lists
    all_price_lists = frappe.get_all("Price List", 
        filters={"selling": 1, "enabled": 1}, 
        fields=["name"])
    allowed_price_lists = [pl.name for pl in all_price_lists]
    
    return {
        "show_only_in_stock": pos_settings.show_only_in_stock or 0,
        "items_per_page": pos_settings.items_per_page or 500,
        "default_price_list": pos_settings.default_price_list,
        "allowed_price_lists": allowed_price_lists,
        "can_see_cost_price": check_cost_price_permission()
    }

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

def check_cost_price_permission():
    # Check if user has permission to view cost price (e.g., has "Accounts Manager" role or "System Manager" role)
    user_roles = frappe.get_roles()
    allowed_roles = ["System Manager", "Accounts Manager"]  # Customize these roles as needed
    return any(role in user_roles for role in allowed_roles)

@frappe.whitelist()
def get_all_items_with_prices(price_list=None, category=None):
    try:
        # Check permissions first
        check_pos_permission()
        can_see_cost_price = check_cost_price_permission()
        
        # Get POS Settings
        pos_settings = frappe.get_single("POS Settings")
        show_only_in_stock = pos_settings.show_only_in_stock or 0
        items_per_page = pos_settings.items_per_page or 500
        
        filters = {"disabled": 0, "is_sales_item": 1}
        if category and category != "all":
            filters["item_group"] = category
        
        items = frappe.get_all("Item", filters=filters, fields=["name", "item_name", "item_code", "item_group", "image", "valuation_rate"], limit=items_per_page)
        
        if not items:
            return []
        
        item_codes = [item.item_code for item in items]
        
        # Bulk fetch ALL prices (all price lists)
        all_prices = frappe.get_all(
            "Item Price",
            filters={"item_code": ["in", item_codes], "selling": 1},
            fields=["item_code", "price_list", "price_list_rate"]
        )
        
        # Build a map for prices: item_code -> { price_list: rate }
        item_prices_map = {}
        for p in all_prices:
            if p.item_code not in item_prices_map:
                item_prices_map[p.item_code] = {}
            item_prices_map[p.item_code][p.price_list] = p.price_list_rate
        
        # Also build the single price map for backward compatibility
        price_map = {}
        if price_list:
            for p in all_prices:
                if p.price_list == price_list:
                    price_map[p.item_code] = p.price_list_rate
        
        # Bulk fetch all stock
        stock_list = frappe.get_all(
            "Bin",
            filters={"item_code": ["in", item_codes]},
            fields=["item_code", "warehouse", "actual_qty"]
        )
        
        # Bulk fetch warehouse names
        warehouse_map = {}
        if stock_list:
            warehouse_codes = list(set([s.warehouse for s in stock_list]))
            warehouses = frappe.get_all(
                "Warehouse",
                filters={"name": ["in", warehouse_codes]},
                fields=["name", "warehouse_name"]
            )
            warehouse_map = {w.name: w.warehouse_name or w.name for w in warehouses}
        
        # Build stock map
        stock_map = {}
        total_stock_map = {}
        for s in stock_list:
            if s.item_code not in stock_map:
                stock_map[s.item_code] = []
                total_stock_map[s.item_code] = 0
            wh_name = warehouse_map.get(s.warehouse, s.warehouse)
            stock_map[s.item_code].append({
                "warehouse": s.warehouse,
                "warehouse_name": wh_name,
                "actual_qty": s.actual_qty
            })
            total_stock_map[s.item_code] += s.actual_qty
        
        # Build result
        result = []
        for item in items:
            price = price_map.get(item.item_code, 0)
            all_prices_for_item = item_prices_map.get(item.item_code, {})
            stock = stock_map.get(item.item_code, [])
            total_stock = total_stock_map.get(item.item_code, 0)
            
            # Skip if show_only_in_stock is enabled and total_stock <= 0
            if show_only_in_stock and total_stock <= 0:
                continue
                
            result.append({
                "item_code": item.item_code,
                "item_name": item.item_name,
                "item_group": item.item_group,
                "image": item.image,
                "price": price,
                "all_prices": all_prices_for_item,
                "cost_price": item.valuation_rate if can_see_cost_price else None,
                "can_see_cost_price": can_see_cost_price,
                "stock": stock
            })
        
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
            SELECT name, customer_name, mobile_no, customer_group
            FROM `tabCustomer`
            WHERE disabled = 0 AND (
                customer_name LIKE %(q)s OR
                mobile_no LIKE %(q)s OR
                name LIKE %(q)s OR
                party_cd LIKE %(q)s
            )
            LIMIT 20
        """, {"q": f"%{query}%"}, as_dict=True)
        return results
    except Exception as e:
        frappe.log_error(f"Error in search_customer: {str(e)}")
        return []

@frappe.whitelist()
def get_customer_groups():
    try:
        check_pos_permission()
        groups = frappe.get_all("Customer Group", filters={"is_group": 0}, fields=["name", "customer_group_name"])
        return groups
    except Exception as e:
        frappe.log_error(f"Error in get_customer_groups: {str(e)}")
        return []

@frappe.whitelist()
def create_customer(customer_name, mobile_no=None, customer_group=None):
    try:
        check_pos_permission()
        # Get default values
        if not customer_group:
            customer_group = frappe.db.get_single_value("Selling Settings", "customer_group") or "All Customer Groups"
        default_territory = frappe.db.get_single_value("Selling Settings", "territory") or "All Territories"

        customer = frappe.get_doc({
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": "Individual",
            "customer_group": customer_group,
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
        
        # Parse data if it's a string
        if isinstance(data, str):
            data = frappe.parse_json(data)
        
        # First validate stock for all items
        items = data.get("items", [])
        for item in items:
            item_code = item["item_code"]
            warehouse = item["warehouse"]
            qty = flt(item["qty"])
            
            # Get stock in selected warehouse
            bin = frappe.db.get_value(
                "Bin",
                {"item_code": item_code, "warehouse": warehouse},
                "actual_qty"
            )
            
            actual_qty = flt(bin) if bin else 0
            
            if actual_qty < qty:
                frappe.throw(_("المنتج {0} غير متوفّر في المخزن {1} بالكمية المطلوبة (المتوفّر: {2}, المطلوب: {3})").format(
                    item_code, warehouse, actual_qty, qty
                ))
        
        # Get company from cost center or defaults
        company = None
        if data.get("branch"):
            company = frappe.get_value("Cost Center", data.get("branch"), "company")
        if not company:
            company = frappe.db.get_single_value('Global Defaults', 'default_company')

        # 1. Create Sales Order
        sales_order = frappe.new_doc("Sales Order")
        sales_order.customer = data.get("customer")
        sales_order.company = company
        sales_order.selling_price_list = data.get("price_list")
        sales_order.cost_center = data.get("branch")
        sales_order.posting_date = frappe.utils.today()
        sales_order.delivery_date = frappe.utils.today()
        sales_order.discount_amount = flt(data.get("discount_amount", 0))
        sales_order.sales_person = data.get("seller")  # Set sales person here!

        for item in items:
            sales_order.append("items", {
                "item_code": item["item_code"],
                "qty": item["qty"],
                "rate": item["rate"],
                "warehouse": item["warehouse"]
            })

        # Set missing values and insert
        sales_order.set_missing_values()
        sales_order.insert()
        sales_order.submit()  # This will reserve stock if ERPNext is configured for it

        return {"name": sales_order.name}
    except Exception as e:
        frappe.log_error(f"Error in register_pos_order: {str(e)}")
        frappe.throw(_("Error: {0}").format(str(e)))
