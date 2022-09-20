import ts from "typescript";
import { toCamelCase, toKebabCase, toPascalCase } from "./helpers";

export interface IProperty {
  name: string;
  type: string;
  description?: string;
  optional?: true;
}
export type property = Omit<IProperty, "name">;
export type properties = Record<string, property | string>;
export interface ISchema<T = Record<string, IProperty>> {
  name: string;
  description?: string;
  properties: T;
}
export type schema = Omit<ISchema<properties>, "name">;
export type schemas = Record<string, schema>;

export enum InterfaceToSchemaError {
  FILE_NOT_FOUND = "file_not_found",
  SYNTAX_LIST_NOT_FOUND = "syntax_list_not_found",
  INTERFACE_NAME_COULD_NOT_BE_DETERMINED = "interface_name_could_not_be_determined",
  INTERFACE_NOT_FOUND = "interface_not_found",
  TYPE_NOT_FOUND = "type_not_found",
}

export const filesToSchemas = (root: string, schemaNames: string[]): schemas => {
  const schemasAndPaths = schemaNames.map(schemaName => ({
    schema: schemaName,
    path: `${root}/${schemaNameToFileName(schemaName)}`
  }));

  const paths = schemasAndPaths.map(schemaAndPath => schemaAndPath.path);
  const program = createProgram(paths);

  return schemasAndPaths.reduce((previousValue: schemas, schemaAndPath: { schema: string, path: string}) => {
    const schema = fileToSchema(schemaAndPath.path, schemaNameToInterfaceName(schemaAndPath.schema), program);
    return {
      ...previousValue,
      [schema.name]: {
        ...(schema.description !== undefined ? { description: schema.description } : undefined),
        properties: schema.properties,
      }
    };
  }, {});
};

export const fileToSchema = (path: string, interfaceName: string, program?: ts.Program): ISchema<properties>  => {
  program = program !== undefined ? program : createProgram([path]);

  const file = program.getSourceFile(path);

  if (file === undefined) {
    throw InterfaceToSchemaError.FILE_NOT_FOUND;
  }

  const fileInterface = interfaceFromFile(file, interfaceName);
  const interfaceDescription = getCommentBeforeNode(file, fileInterface);
  return {
    name: interfaceNameToSchemaName(interfaceName),
    ...(interfaceDescription !== undefined ? { description: interfaceDescription } : undefined),
    properties: ((program: ts.Program) => fileInterface.members.reduce((previousValue: properties, element: ts.TypeElement) => {
      const property = elementToProperty(program, file, element);
      const isSimpleProperty = property.description === undefined && property.optional === undefined;
      return {
        ...previousValue,
        [property.name]: isSimpleProperty ? property.type : {
          type: property.type,
          ...(property.description !== undefined ? { description: property.description } : undefined),
          ...(property.optional !== undefined ? { optional: property.optional } : undefined),
        }
      };
    }, { }))(program),
  };
};

const elementToProperty = (program: ts.Program, file: ts.SourceFile, element: ts.TypeElement): IProperty => {
  const typeChecker = program.getTypeChecker();


  if(element.name === undefined || (element.name !== undefined && !("escapedText" in element.name))) {
    throw 1;
  }
  const name = element.name.escapedText.toString();
  const description = getCommentRightOfElement(file, element);
  const type = typeChecker.getTypeAtLocation(element);
  const isOptional: boolean = element.questionToken !== undefined;

  return {
    name,
    ...(description !== undefined ? { description } : undefined),
    type: typeToString(typeChecker, type, isOptional ? true : undefined),
    ...(isOptional === true ? { optional: true } : undefined)
  };
};

const typeToString = (typeChecker: ts.TypeChecker, type: ts.Type, typeIsOptional?: true): string => {
  if(type.isUnion()) {
    const types = typeIsOptional ? type.types.filter(type => /^undefined/.test(typeChecker.typeToString(type)) === false) : type.types;
    return types.map((type: ts.Type) => typeToString(typeChecker, type, typeIsOptional)).join(" | ");
  }

  const isArray: boolean = (typeChecker as any).isArrayType(type);

  const getResolvedType = (type: ts.Type): ts.Type => {
    if((type as any).resolvedTypeArguments !== undefined && (type as any).resolvedTypeArguments instanceof Array && (type as any).resolvedTypeArguments[0] !== undefined) {
      return (type as any).resolvedTypeArguments[0] as ts.Type;
    }

    throw InterfaceToSchemaError.TYPE_NOT_FOUND;
  };

  if(isArray) {
    type = getResolvedType(type);
  }

  if(type.isNumberLiteral() || isSimpleType(typeChecker.typeToString(type)) === true) {
    return `${typeChecker.typeToString(type)}${isArray ? "[]" : ""}`;
  }

  if(type.isStringLiteral()) {
    return `'${type.value}'${isArray ? "[]" : ""}`;
  }

  return `${interfaceNameToSchemaName(typeChecker.typeToString(type))}${isArray ? "[]" : ""}`;
};

const interfaceFromFile = (file: ts.SourceFile, name: string) => {
  const syntaxList = file.getChildAt(0);
  if(syntaxList === undefined) {
    throw InterfaceToSchemaError.SYNTAX_LIST_NOT_FOUND;
  }

  for(const child of syntaxList.getChildren()) {
    if(isNodeInterface(child) && nodeName(child) === name) {
      return child as ts.InterfaceDeclaration;
    }
  }

  throw InterfaceToSchemaError.INTERFACE_NOT_FOUND;
};

const isNodeInterface = (node: ts.Node): boolean => node.kind === ts.SyntaxKind.InterfaceDeclaration;

const nodeName = (node: ts.Node): string => {
  if((node as any).name !== undefined && ("escapedText" in (node as any).name)) {
    return (node as any).name.escapedText as string;
  }

  throw InterfaceToSchemaError.INTERFACE_NAME_COULD_NOT_BE_DETERMINED;
};

const getCommentBeforeNode = (file: ts.SourceFile, node: ts.Node): string | undefined => {
  // Match either //comment or /*comment*/
  const match = file.text.substring(node.pos, node.end).match(/^\s*(?:\/\/([^\n]*)|\/\*((?:(?!\*\/).)*))/s);
  if (match !== null) {
    if (match[1] !== undefined) {
      return match[1].trim();
    }
    else {
      return match[2].trim();
    }
  }
};

const getCommentRightOfElement = (file: ts.SourceFile, element: ts.TypeElement): string | undefined => {
  const match = file.text.substring(element.pos, element.end).match(/(?:\/\/([^\n]*)|\/\*((?:(?!\*\/).)*))/s);
  if (match !== null) {
    if (match[1] !== undefined) {
      return match[1].trim();
    }
    else {
      return match[2].trim();
    }
  }
};

const createProgram = (paths: string[]) => ts.createProgram(paths, { strict: true });
const isSimpleType = (type: string): boolean => ["string", "number", "boolean", "null", "undefined", "true", "false"].includes(type);
const interfaceNameToSchemaName = (interfaceName: string): string => toCamelCase(interfaceName.substring(1, interfaceName.length - 3));
const schemaNameToInterfaceName = (schemaName: string): string => `I${toPascalCase(schemaName)}DTO`;
const schemaNameToFileName = (schemaName: string): string => `${toKebabCase(schemaName)}.dto.ts`;
