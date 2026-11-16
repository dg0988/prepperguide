import esbuild from "esbuild";
import { builtinModules } from "node:module";
const builtins = [...builtinModules, ...builtinModules.map((m) => `node:${m}`)];
const prod = process.argv[2] === "production";
const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  minify: prod,
  outfile: "main.js",
});
if (prod) { await ctx.rebuild(); process.exit(0); } else { await ctx.watch(); }
