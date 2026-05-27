const fs = require("fs");

const file = "apps/server/src/routes/v1/ao_act.ts";
const src = fs.readFileSync(file, "utf8");

const forbidden = [
  "interceptVariablePrescriptionTaskV1",
  'app.addHook("preHandler"',
  "reply.send(",
  "writeVariableTaskCandidateV1",
];

for (const token of forbidden) {
  if (src.includes(token)) {
    console.error(`[no-variable-task-prehandler] forbidden token in ${file}: ${token}`);
    process.exit(1);
  }
}

console.log("[no-variable-task-prehandler] ok");
