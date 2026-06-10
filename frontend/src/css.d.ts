// Ambient declarations for global (non-module) CSS side-effect imports, e.g.
// `import "@/styles/globals.css"`. Next.js ships declarations for CSS Modules
// (`*.module.css`) via `next/types/global.d.ts`, but not for global stylesheets.
// TypeScript 6 reports `TS2882` for side-effect imports of modules with no
// declaration, so we declare them here.
declare module "*.css"
