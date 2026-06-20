import { defineConfig } from "tsdown";

export default defineConfig({
	entry: "./src/index.ts",
	format: "esm",
	outDir: "./dist",
	clean: true,
	shims: true,
	noExternal: [/@ledger\/.*/],
	external: ["snappy", "@napi-rs/snappy-linux-x64-musl"],
});
