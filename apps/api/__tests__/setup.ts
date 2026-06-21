// Runs before all test files via --import flag in test scripts
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = ":memory:";
process.env.PORT = "0";
