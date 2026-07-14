# .mcft_cap05_s6_activation_docs.py
# Purpose: append S6 activation records and permanently wire the Activation Gate into standard acceptance.
# Boundary: repository documentation and governance-hook transformation only.

from pathlib import Path

BASELINE = "be8b5ecf061ba5e49c1ae33a7a9d4827aa6b0bbe"
ACTIVATION = "MCFT-CAP-05.S6.SSOT-ACTIVATION-V1"
S7 = "MCFT-CAP-05.MCFT-04-06-07-08-09-10.RECEIPT-CONSUMING-TICK-V1"


task_path = Path("docs/digital_twin/mcft/cap_05/GEOX-MCFT-CAP-05-TASK.md")
task = task_path.read_text(encoding="utf-8")
section = "## S6 SSOT Activation — S6 Effective / S7 Authorized"
if section not in task:
    task += f'''\n\n---\n\n{section}\n\n```text\nactivation_id:\n{ACTIVATION}\n\nbaseline_main_commit:\n{BASELINE}\n\nactivation PR:\n2463\n\nS6 Runtime PR:\n2456\n\nS6 exact head:\n1a4f09278ce8b5ee65af8688f0c4d992a5d10035\n\nS6 merge commit:\n{BASELINE}\n\nS6 candidate CI:\n29323156789 SUCCESS\n\nS6 exact-head CI:\n29325080521 SUCCESS\n\nS6 merged-main Gate:\n29325686434 SUCCESS\n\nS6 status:\nMERGED_EFFECTIVE\n\nS7 delivery slice:\n{S7}\n\nS7 status after activation:\nAUTHORIZED_NOT_STARTED\n\nS7 Runtime implementation started:\nfalse\n\ncanonical object delta:\n0\n\ntransaction family delta:\n0\n\nmigration delta:\n0\n\nCAP-06 authorized:\nfalse\n```\n'''
task_path.write_text(task, encoding="utf-8")


map_path = Path("docs/digital_twin/GEOX-DT-02-MCFT-IMPLEMENTATION-MAP.md")
implementation_map = map_path.read_text(encoding="utf-8")
section = "## MCFT-CAP-05 S6 Effective and S7 Explicitly Authorized"
if section not in implementation_map:
    implementation_map += f'''\n\n---\n\n{section}\n\n```text\ncapability_line_id: MCFT-CAP-05\nactivation_id: {ACTIVATION}\nbaseline_main_commit: {BASELINE}\nactivation_pr: 2463\nS6_status: MERGED_EFFECTIVE\nS6_exact_head: 1a4f09278ce8b5ee65af8688f0c4d992a5d10035\nS6_merge_commit: {BASELINE}\nS6_candidate_CI: 29323156789 SUCCESS\nS6_exact_head_CI: 29325080521 SUCCESS\nS6_merged_main_gate: 29325686434 SUCCESS\nS7_status: AUTHORIZED_NOT_STARTED\nS7_runtime_source_authorized: true\nS7_implementation_started: false\ncanonical_object_delta: 0\ntransaction_family_delta: 0\nmigration_delta: 0\nCAP_06_authorized: false\n```\n\nGovernance effect:\n\n- settle the seven-file S6 Runtime slice as merged-main effective;\n- preserve S5 remediation effectiveness and Receipt full-record hash integrity;\n- explicitly authorize, but do not implement, the S7 Receipt-consuming tick slice;\n- preserve all State/checkpoint, Forecast, Residual, Recommendation, AO-ACT, calibration, activation and CAP-06 nonclaims;\n- add no Runtime source, migration, route or web change.\n'''
map_path.write_text(implementation_map, encoding="utf-8")


wrapper_path = Path("scripts/dev/assert_local_pnpm_runtime.cjs")
wrapper = wrapper_path.read_text(encoding="utf-8")
marker = "MCFT_CAP_05_S6_ACTIVATION_GATE_V1"
if marker not in wrapper:
    if "const path = require('node:path');" not in wrapper:
        raise SystemExit("PATH_IMPORT_MISSING")
    wrapper = wrapper.replace(
        "const path = require('node:path');",
        "const path = require('node:path');\nconst fs = require('node:fs');",
        1,
    )
    old = "main();\n"
    new = '''main();\n\n// MCFT_CAP_05_S6_ACTIVATION_GATE_V1: enforce activated CAP-05 S6/S7 governance during standard acceptance.\nconst activationGatePath = path.join(process.cwd(), 'scripts/governance_acceptance/ACCEPTANCE_MCFT_CAP_05_S6_ACTIVATION.cjs');\nif (fs.existsSync(activationGatePath)) {\n  const gate = run(process.execPath, [activationGatePath, '--auto']);\n  if (gate.stdout) console.log(gate.stdout);\n  if (gate.status !== 0) {\n    if (gate.stderr) console.error(gate.stderr);\n    process.exit(gate.status || 1);\n  }\n}\n'''
    if old not in wrapper:
        raise SystemExit("MAIN_ANCHOR_MISSING")
    wrapper = wrapper.replace(old, new, 1)
wrapper_path.write_text(wrapper, encoding="utf-8")

print("S6 activation docs and standard Gate hook materialized")
