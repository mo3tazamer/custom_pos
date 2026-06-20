__version__ = "1.0.0"

# Auto-register app in apps.txt to prevent "App custom_pos not in apps.txt" errors
import os
try:
    current_dir = os.path.dirname(os.path.abspath(__file__))
    temp_dir = current_dir
    for _ in range(5):
        sites_dir = os.path.join(temp_dir, "sites")
        if os.path.isdir(sites_dir):
            apps_txt_path = os.path.join(sites_dir, "apps.txt")
            if os.path.exists(apps_txt_path):
                with open(apps_txt_path, "r") as f:
                    apps = f.read().splitlines()
                apps = [a.strip() for a in apps if a.strip()]
                if "custom_pos" not in apps:
                    with open(apps_txt_path, "r") as f:
                        content = f.read()
                    
                    # Append custom_pos safely with proper newline prefix if needed
                    prefix = ""
                    if content and not content.endswith("\n"):
                        prefix = "\n"
                    
                    with open(apps_txt_path, "a") as f:
                        f.write(f"{prefix}custom_pos\n")
            break
        temp_dir = os.path.dirname(temp_dir)
except Exception:
    pass
