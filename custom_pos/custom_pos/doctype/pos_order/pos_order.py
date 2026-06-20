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
        self.grand_total = flt(self.total_amount) - flt(self.discount_amount)
        if self.grand_total < 0:
            self.grand_total = 0

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
        si.selling_price_list = self.price_list
        si.cost_center = self.branch
        si.discount_amount = self.discount_amount
        si.company = company
        si.is_pos = 1
        si.posting_date = self.posting_date
        si.due_date = self.posting_date

        for item in self.items:
            si.append("items", {
                "item_code": item.item_code,
                "qty": item.qty,
                "rate": item.rate,
                "warehouse": item.warehouse,
                "amount": item.amount
            })

        si.set_missing_values()
        si.insert()
        si.submit()

        # Link Sales Invoice to POS Order
        self.sales_invoice = si.name
        self.save()
