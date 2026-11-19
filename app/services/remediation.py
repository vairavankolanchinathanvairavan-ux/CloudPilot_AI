def execute_remediation(alerts):
    actions = []

    for alert in alerts:
        if "CPU" in alert:
            actions.append("Recommend CPU scaling")

        elif "memory" in alert.lower():
            actions.append("Recommend memory investigation")

        elif "disk" in alert.lower():
            actions.append("Recommend disk cleanup review")

    if not actions:
        actions.append("No remediation required")

    return {
        "approved": True,
        "mode": "DRY_RUN",
        "actions": actions,
        "executed": False
    }
