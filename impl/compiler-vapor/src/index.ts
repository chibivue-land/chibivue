export { compile, transform, type VaporCompilerOptions } from "./compile";
export {
  generateVapor,
  generateVaporFromIR,
  type VaporCodegenResult,
  type VaporCodegenOptions,
} from "./codegen";
export * from "./runtimeHelpers";

// IR types and helpers
export {
  IRNodeTypes,
  DynamicFlag,
  createBlock,
  createRootIR,
  type RootIRNode,
  type BlockIRNode,
  type IREffect,
  type IRDynamicInfo,
  type OperationNode,
  type SetTextIRNode,
  type SetEventIRNode,
  type SetPropIRNode,
  type InsertNodeIRNode,
  type IfIRNode,
  type ForIRNode,
} from "./ir";

// Transform types
export { type TransformContext } from "./transform";
