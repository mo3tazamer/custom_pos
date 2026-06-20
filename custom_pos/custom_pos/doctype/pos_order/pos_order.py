import frappe
from frappe.model.document import Document

class POSOrder(Document):
    def validate(self):
        self.calculate_totals()
    
    def calculate_totals(self):
        total = sum(item.amount for item in self.items)
        self.total_amount = total
        self.grand_total = total - (self.discount_amount or 0)
    
    def on_submit(self):
        if self.sales_invoice:
            si = frappe.get_doc("Sales Invoice", self.sales_invoice)
            if si.docstatus == 0:
                si.submit()

def on_submit(doc, method):
    pass

def on_cancel(doc, method):
    if doc.sales_invoice:
        si = frappe.get_doc("Sales Invoice", doc.sales_invoice)
        if si.docstatus == 1:
            si.cancel()
