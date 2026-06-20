from frappe import _


def get_data():
    return [
        {
            "module_name": "custom_pos",
            "color": "#7c3aed",
            "icon": "octicon octicon-device-mobile",
            "label": _("Custom POS"),
            "type": "module",
            "items": [
                {
                    "type": "page",
                    "name": "custom-pos",
                    "label": _("نقطة البيع"),
                    "icon": "octicon octicon-device-mobile"
                },
                {
                    "type": "doctype",
                    "name": "POS Order",
                    "label": _("طلبات POS"),
                    "icon": "octicon octicon-list-ordered"
                },
                {
                    "type": "doctype",
                    "name": "POS Settings",
                    "label": _("إعدادات POS"),
                    "icon": "octicon octicon-settings"
                }
            ]
        }
    ]
