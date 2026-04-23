// Runtime shim: wraps @actual-app/api so the tsconfig `paths` redirect works at
// runtime with tsx. Types are provided by the declare module in actual-api.d.ts.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const actual = require('@actual-app/api')
export default actual
