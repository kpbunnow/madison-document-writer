"""Run a suite with its descendants inside the same timeout boundary."""

import os
import signal
import subprocess


def run_suite_process(command, *, cwd, env, timeout):
    options = {"start_new_session": True} if os.name != "nt" else {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    process = subprocess.Popen(
        command, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", errors="replace", **options
    )
    try:
        stdout, stderr = process.communicate(timeout=timeout)
    except BaseException:
        # Killing just the feature-suite parent leaves spawnSync's scenario alive, often still holding these pipes.
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, encoding="utf-8", errors="replace", check=False)
            process.kill()
        else:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
        process.communicate()
        raise
    return subprocess.CompletedProcess(command, process.returncode, stdout, stderr)
