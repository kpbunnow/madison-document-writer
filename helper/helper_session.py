"""Per-user browser bootstrap; session tokens never appear on public pages."""

import json
import os
from pathlib import Path
import secrets
import stat
import subprocess
import tempfile

NAME = ".helper-session.json"


def profile_folder():
    return Path(os.environ["LOCALAPPDATA"]) / "MadisonDocWriter" if os.environ.get("LOCALAPPDATA") else Path.home() / ".local/state/MadisonDocWriter"


def windows_privacy(path, create=False):
    """Known Windows PowerShell validates or sets an explicit current-user DACL."""
    exe = Path(os.environ.get("SystemRoot", r"C:\Windows")) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    command = (
        "$ErrorActionPreference='Stop';$p=$env:DW_SESSION_FILE;$sid=[System.S"
        "ecurity.Principal.WindowsIdentity]::GetCurrent().User;\nif($env:DW_S"
        "ESSION_CREATE -eq '1'){$acl=New-Object System.Security.AccessControl"
        ".FileSecurity;$acl.SetAccessRuleProtection($true,$false);foreach($id"
        " in @($sid.Value,'S-1-5-18')){$rule=New-Object System.Security.Acces"
        "sControl.FileSystemAccessRule((New-Object System.Security.Principal."
        "SecurityIdentifier($id)),'FullControl','Allow');$acl.AddAccessRule($"
        "rule)};Set-Acl -LiteralPath $p -AclObject $acl}else{$acl=Get-Acl -Li"
        "teralPath $p;if(!$acl.AreAccessRulesProtected){throw 'Session ACL is"
        " inherited'};foreach($rule in $acl.Access){$id=$rule.IdentityReferen"
        "ce.Translate([System.Security.Principal.SecurityIdentifier]).Value;i"
        "f($rule.AccessControlType -eq 'Allow' -and $id -notin @($sid.Value,'"
        "S-1-5-18')){throw 'Session ACL permits another account'}}}"
    )
    subprocess.run(
        [str(exe), "-NoProfile", "-NonInteractive", "-Command", command],
        env={**os.environ, "DW_SESSION_FILE": str(path), "DW_SESSION_CREATE": "1" if create else "0"},
        capture_output=True,
        check=True,
        timeout=15,
    )


def check_private(path):
    if path.is_symlink() or not path.is_file():
        raise ValueError("The helper session file is unsafe. Start from the trusted installed shortcut.")
    if os.name == "nt":
        windows_privacy(path)
    else:
        info = path.stat()
        if info.st_uid != os.getuid() or stat.S_IMODE(info.st_mode) & 0o077:
            raise ValueError("The helper session file must be readable only by this user.")


def prepare(token, folder=None):
    folder = Path(folder) if folder else profile_folder()
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / NAME
    if path.exists():
        check_private(path)
        value = json.loads(path.read_text(encoding="utf-8"))
        master = value["bootstrap"]
        if not isinstance(master, str) or len(master) != 43:
            raise ValueError("The helper browser session file is invalid; preserve drafts and contact the administrator.")
    else:
        master = secrets.token_urlsafe(32)
    fd, temp = tempfile.mkstemp(prefix=".session-", dir=folder)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            os.chmod(temp, 0o600)
            if os.name == "nt":
                windows_privacy(Path(temp), create=True)
            json.dump({"token": token, "bootstrap": master}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)
    return master


def launch_token():
    path = profile_folder() / NAME
    check_private(path)
    value = json.loads(path.read_text(encoding="utf-8"))
    token = value.get("token")
    if not isinstance(token, str) or len(token) != 43:
        raise ValueError("No current helper session is available. Restart from the trusted installed shortcut.")
    return token


# Browser storage is scoped to the loopback origin including the port. Avoid
# cookies: cookies are shared across ports and could leak to another local app.
BOOTSTRAP_SCRIPT = Path(__file__).with_name("session-bootstrap.js").read_text(encoding="utf-8")
