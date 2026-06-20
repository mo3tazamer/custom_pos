import frappe
from frappe import _
from frappe.utils import flt

@frappe.whitelist()
def get_all_items_with_prices(price_list=None, category=None):
    try:
        filters = {"disabled": 0, "is_sales_item": 1}
        if category and category != "all":
            filters["item_group"] = category
        items = frappe.get_all("Item", filters=filters, fields=["name", "item_name", "item_code", "item_group", "image"], limit=500)
        result = []
        for item in items:
            price = 0
            if price_list:
                price_data = frappe.get_all("Item Price", filters={"item_code": item.item_code, "price_list": price_list, "selling": 1}, fields=["price_list_rate"], limit=1)
                if price_data: price = price_data[0].price_list_rate
            stock = frappe.get_all("Bin", filters={"item_code": item.item_code}, fields=["warehouse", "actual_qty"])
            stock_with_names = []
            for s in stock:
                wh_name = frappe.get_value("Warehouse", s.warehouse, "warehouse_name") or s.warehouse
                stock_with_names.append({"warehouse": s.warehouse, "warehouse_name": wh_name, "actual_qty": s.actual_qty})
            result.append({"item_code": item.item_code, "item_name": item.item_name, "item_group": item.item_group, "image": item.image, "price": price, "stock": stock_with_names})
        return result
    except Exception as e:
        frappe.log_error(f"Error: {str(e)}")
        return []

@frappe.whitelist()
def get_customer_by_phone(phone):
    try:
        return frappe.get_all("Customer", filters={"mobile_no": ["like", f"%{phone}%"]}, fields=["name", "customer_name", "mobile_no"])
    except Exception as e:
        frappe.log_error(f"Error: {str(e)}")
        return []

@frappe.whitelist()
def register_pos_order(data):
    try:
        data = frappe.parse_json(data)
        
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

