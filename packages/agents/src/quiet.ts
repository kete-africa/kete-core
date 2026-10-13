// The runtime's vendor collects usage telemetry unless told otherwise. A Kete deployment tells
// nobody what it runs: the switch is set before the runtime loads, and a deployment that wants it
// on says so itself (`MASTRA_TELEMETRY_DISABLED=0`).
process.env.MASTRA_TELEMETRY_DISABLED ??= '1';
