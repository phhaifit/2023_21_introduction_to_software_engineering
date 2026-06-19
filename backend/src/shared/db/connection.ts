export type QueryParameters = readonly unknown[];

export type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
  rowCount: number;
};

export type DatabaseConnection = {
  query<Row = Record<string, unknown>>(
    sql: string,
    parameters?: QueryParameters
  ): Promise<QueryResult<Row>>;
  transaction<T>(operation: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
};

export type Migration = {
  id: string;
  description: string;
  up: string;
  down?: string;
};

export type MigrationRunner = {
  listPending(): Promise<Migration[]>;
  apply(migrationId: string): Promise<void>;
  rollback?(migrationId: string): Promise<void>;
};

export type DatabaseContext = {
  connection: DatabaseConnection;
  migrations: MigrationRunner;
};

export function createDatabaseContext(
  connection: DatabaseConnection,
  migrations: MigrationRunner
): DatabaseContext {
  return {
    connection,
    migrations
  };
}
