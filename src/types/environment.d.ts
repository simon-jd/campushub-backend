export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly PORT?: string;
      readonly MONGODB_URI?: string;
      readonly MONGODB_DB_NAME?: string;
    }
  }
}
