import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "./src/index.ts",
		schema: "./src/schema/schema.ts",
		"run-migrate": "./src/run-migrate.ts",
	},
	format: "esm",
	outDir: "./dist",
	clean: true,
	dts: true,
});
