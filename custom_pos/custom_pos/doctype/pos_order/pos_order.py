# Copyright (c) 2026, Custom POS and Contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class POSOrder(Document):
    def validate(self):
        self.calculate_totals()

    def calculate_totals(self):
        self.total_amount = 0
        for item in self.items:
            item.amount = flt(item.qty) * flt(item.rate)
            self.total_amount += item.amount
        
        pos_settings = frappe.get_single("POS Settings")
        enable_vat = pos_settings.get("enable_vat", 1)
        vat_rate = flt(pos_settings.get("vat_rate", 14))
        
        discount_amount = flt(self.discount_amount)
        net_amount = flt(self.total_amount) - discount_amount
        if net_amount < 0:
            net_amount = 0
            
        if enable_vat:
            vat_amount = net_amount * (vat_rate / 100.0)
            self.grand_total = net_amount + vat_amount
        else:
            self.grand_total = net_amount

    def on_submit(self):
        self.status = "Submitted"
        # If there's no sales invoice yet, create one
        if not self.sales_invoice:
            self.create_sales_invoice()

    def on_cancel(self):
        self.status = "Cancelled"
        # Cancel the linked sales invoice too
        if self.sales_invoice:
            si = frappe.get_doc("Sales Invoice", self.sales_invoice)
            if si.docstatus == 1:  # If it's submitted
                si.cancel()

    def create_sales_invoice(self):
        # Get company from cost center or defaults
        company = None
        if self.branch:
            company = frappe.get_value("Cost Center", self.branch, "company")
        if not company:
            company = frappe.db.get_single_value('Global Defaults', 'default_company')

        # Create and insert Sales Invoice
        si = frappe.new_doc("Sales Invoice")
        si.customer = self.customer
        si.selling_price_list = self.price_list or frappe.db.get_single_value("POS Settings", "default_price_list") or "Standard Selling"
        si.cost_center = self.branch
        si.discount_amount = self.discount_amount
        si.company = company
        si.update_stock = 1
        
        # Check if POS Profile exists, set is_pos and pos_profile
        pos_profile = None
        if self.branch:
            pos_profile = frappe.db.get_value("POS Profile", {"company": company, "cost_center": self.branch}, "name")
        if not pos_profile:
            pos_profile = frappe.db.get_value("POS Profile", {"company": company}, "name")
            
        if pos_profile:
            si.pos_profile = pos_profile
            si.is_pos = 1
        else:
            si.is_pos = 0
            
        si.posting_date = self.posting_date
        si.due_date = self.posting_date

        # Set Sales Team
        if self.seller:
            si.append("sales_team", {
                "sales_person": self.seller,
                "allocated_percentage": 100
            })

        for item in self.items:
            si.append("items", {
                "item_code": item.item_code,
                "qty": item.qty,
                "rate": item.rate,
                "warehouse": item.warehouse,
                "amount": item.amount,
                "cost_center": self.branch
            })

        # Apply VAT taxes if enabled
        pos_settings = frappe.get_single("POS Settings")
        enable_vat = pos_settings.get("enable_vat", 1)
        vat_rate = flt(pos_settings.get("vat_rate", 14))
        
        if enable_vat:
            tax_account = frappe.db.get_value("Account", {"company": company, "account_name": ["like", "%VAT%"], "is_group": 0}, "name") or \
                          frappe.db.get_value("Account", {"company": company, "account_name": ["like", "%ضريبة%"], "is_group": 0}, "name") or \
                          frappe.db.get_value("Account", {"company": company, "account_type": "Tax", "is_group": 0}, "name")
            if tax_account:
                si.append("taxes", {
                    "charge_type": "On Net Total",
                    "account_head": tax_account,
                    "description": f"VAT @ {vat_rate}%",
                    "rate": vat_rate,
                    "cost_center": si.cost_center
                })

        si.set_missing_values()
        
        # If is_pos is set, allocate payments to avoid validation error
        if si.is_pos:
            if not si.payments:
                mode_of_payment = frappe.db.get_value("Mode of Payment", {"type": "Cash"}, "name") or "Cash"
                si.append("payments", {
                    "mode_of_payment": mode_of_payment,
                    "amount": si.grand_total
                })
            else:
                si.payments[0].amount = si.grand_total

        si.insert()
        si.submit()

        # Link Sales Invoice to POS Order
        self.db_set("sales_invoice", si.name)
