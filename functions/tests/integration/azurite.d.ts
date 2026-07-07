// azurite ships no type declarations for its internal, non-public embedding API
// (dist/src/table/TableServer, dist/src/table/TableConfiguration) used only by
// tableStorageTestHelper.ts to run an in-memory Table Storage emulator in tests.
declare module "azurite/dist/src/table/TableServer" {
  export default class TableServer {
    constructor(configuration?: unknown);
    start(): Promise<void>;
    close(): Promise<void>;
    getHttpServerAddress(): string;
  }
}

declare module "azurite/dist/src/table/TableConfiguration" {
  export default class TableConfiguration {
    constructor(...args: unknown[]);
  }
}
