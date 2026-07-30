"use strict";

module.exports = function inlineWasmModuleLoader(source) {
  const base64 = Buffer.from(source).toString("base64");
  return `
const binary = atob(${JSON.stringify(base64)});
const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
export default new WebAssembly.Module(bytes);
`;
};

module.exports.raw = true;
