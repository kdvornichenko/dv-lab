import { reportFailure, run } from './ledger-settings/run.ts'

await run().catch(reportFailure)
