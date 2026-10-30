# Security policy

Madison Building Inspection Document Writer is an offline Windows browser application with a loopback Python helper. It handles case records for a municipal inspection office.

## Reporting a vulnerability

Do not open a public issue or pull request for a suspected vulnerability or for anything involving real case data. Use GitHub's private vulnerability reporting (Security tab, "Report a vulnerability") on this repository, or contact the repository owner directly.

Include the release shown in `version.json`, the steps to reproduce, and a synthetic example. Never attach real case files, credentials or personal data.

## Scope

In scope: the helper's request guards (token, Host, Origin, Fetch-Site, size caps), case-file and shared-folder handling, release packaging and the runtime manifest, and anything that could alter an issued document.

City and native-environment acceptance are tracked in `docs/developer/` and are not a security assurance by themselves.
