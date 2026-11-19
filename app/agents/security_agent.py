import re
from pathlib import Path

SECRET_PATTERNS = [
    re.compile(r"""(?i)\b(api_key|secret_key|password|token)\s*=\s*['"][^'"]{4,}['"]"""),
]

def scan_project():
    project_path = Path(__file__).resolve().parents[2]
    findings = []

    for file_path in (project_path / "app").rglob("*.py"):
        if file_path.name == "security_agent.py":
            continue

        try:
            content = file_path.read_text(encoding="utf-8")

            for line_number, line in enumerate(content.splitlines(), 1):
                for pattern in SECRET_PATTERNS:
                    if pattern.search(line):
                        findings.append({
                            "file": str(file_path.relative_to(project_path)),
                            "line": line_number,
                            "issue": "Possible hardcoded secret"
                        })
        except OSError:
            continue

    return {
        "agent": "Security Agent",
        "findings": findings,
        "total_issues": len(findings),
        "status": "warning" if findings else "secure"
    }
