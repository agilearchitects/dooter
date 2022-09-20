import { toCamelCase } from "./helpers";
import { schemas, schema, property, ISchema, IProperty, properties } from "./interface-to-schema";

export enum parseError {
  SCHEMA_NOT_FOUND = "schema_not_found",
  PROPERTY_VALUE_NOT_FOUND = "property_value_not_found",
  PROPERTY_NOT_EXISTS_IN_SCHEMA = "property_not_exists_in_schema",
  WRONG_TYPE = "wrong_type",
  UNEXPECTED_ERROR = "unexpected_error",
}

export class ParseError extends Error {
  private _schema?: ISchema<properties>;
  public get schema(): ISchema<properties> | undefined { return this._schema; }
  private _property?: IProperty;
  public get property(): IProperty | undefined { return this._property; }
  
  public constructor(
    public readonly code: parseError,
    options: { schema?: ISchema<properties>, property?: IProperty },
    message?: string,
  ) {
    super(message);
    const { schema, property } = options;
    if(schema !== undefined) { this._schema = schema; }
    if(property !== undefined) { this._property = property; }
  }
}

type simpleType = string | number | boolean | null;
type jsonDict = { [key: string]: jsonType };
type jsonType = simpleType | jsonDict | jsonType[];


export const parseObject = (object: jsonType, type: string, schemas: schemas = {}): jsonType => {
// Expect multi type
  if(isMultiType(type)) {
  // parse each type (return first that's successful)
    for(const singleType of splitTypes(type)) {
      try {
        return parseObject(object, singleType, schemas);
      } catch { /** */ }
    }

    // Throw if all type casting fails
    throw new ParseError(parseError.WRONG_TYPE, {}, `Expected ${type}, got ${typeof object}`);
  }

  // Expect array
  if(isArrayType(type)) {
    if(!(object instanceof Array)) {
      throw new ParseError(parseError.WRONG_TYPE, {}, `Expected object to be instance of array byt got ${typeof object}`);
    }
    // Parse each separate object with parseType
    return object.map(object => parseObject(object, arrayTypeAsType(type), schemas));
  }
  
  // Expect simple type
  if(isSimpleType(type)) {
    if(isObjectSimpleType(object) === false) {
      throw new ParseError(parseError.WRONG_TYPE, {}, `Expected object to be simple object "${type}" but got complex`);
    }
    if(simpleObjectMatchesSimpleType(object as simpleType, type) === false) {
      throw new ParseError(parseError.WRONG_TYPE, {}, `Expected object to be "${type}", got "${typeof object}"`);
    }
    return object;
  }
  
  if(isStringLiteralType(type) || isNumberLiteralType(type)) {
    if((isStringLiteralType(type) && type.replace(/^'(.+)'$/, "$1") !== object) || (isNumberLiteralType(type) && parseInt(type) !== object)) {
      if(isObjectSimpleType(object)) {
        throw new ParseError(parseError.WRONG_TYPE, {}, `Expected value to be string literal ${type} but got ${object}`);
      }
      throw new ParseError(parseError.WRONG_TYPE, {}, `Expected value to be string literal ${type} but got object`);
    }
    return object;
  }
  
  // Expect shcema type
  if(isSchemaType(type)) {
    const schemaName = toCamelCase(type);
  
    if(isObjectDict(object) === false) {
      throw new ParseError(parseError.WRONG_TYPE, {}, `Expected object to be "${schemaName}", got "${typeof object}"`);
    }
    if(schemaExists(schemaName, schemas) === false) {
      throw new ParseError(parseError.SCHEMA_NOT_FOUND, {}, `Schema with name ${schemaName} could not be found`);
    }
    return parseSchema(object as jsonDict, schemas[schemaName], schemas, schemaName);
  }
  
  throw new ParseError(parseError.UNEXPECTED_ERROR, {});
};

const parseSchema = (object: jsonDict, schema: schema, schemas: schemas, schemaName: string): jsonDict => {
  const { properties } = schema;
  
  // Validate that all props in object exist as definitions in schema
  for(const key of Object.keys(object)) {
    if(keyExistsInSchema(key, schema) === false) {
      throw new ParseError(parseError.PROPERTY_NOT_EXISTS_IN_SCHEMA, { schema: { name: schemaName, ...schema } }, `Property ${key} in object is missing in schema`);
    }
  }

  // Parse each property
  return Object.keys(properties).reduce((previousValue: jsonDict, propertyName: string) => {
    const property: property | string = properties[propertyName];
    const value: jsonType = object[propertyName];
    
    if((typeof property === "string" || isPropertyRequired(property) === true) && propertyExistsInObject(object, propertyName) === false) {
      throw new ParseError(parseError.PROPERTY_VALUE_NOT_FOUND, { property: { name: propertyName, ...(typeof property === "string" ? { type: property } : property ) }, schema: { name: schemaName, ...schema } }, `Property ${propertyName} not found`);
    }

    return {
      ...previousValue,
      ...(value !== undefined ? { [propertyName]: parseObject(value, typeof property === "string" ? property : property.type, schemas) } : undefined)
    };
  }, {});
};

const isSimpleType = (type: string): boolean => ["string", "number", "boolean", "null", "undefined", "true", "false"].includes(type);
const isMultiType = (type: string): boolean => /\|/.test(type);
const splitTypes = (type: string): string[] => type.split("|").map((type: string) => type.trim());
const isArrayType = (type: string): boolean => (/.*\[\]$/).test(type);
const arrayTypeAsType = (type: string): string => type.replace(/\[\]$/, "");
const isStringLiteralType = (type: string): boolean => /^("|').+("|')$/.test(type);
const isNumberLiteralType = (type: string): boolean => /^[0-9]+$/.test(type);
const isObjectSimpleType = (object: jsonType): boolean => typeof object === "string" || typeof object === "number" || typeof object === "boolean" || object === null;
const simpleObjectMatchesSimpleType = (object: simpleType, type: string) => {
  return (type === "true" && object === true) ||
  (type === "false" && object === false) ||
  (type === "null" && object === null) ||
  typeof object === type;
};
const isSchemaType = (type: string): boolean => isSimpleType(type) === false;
const isObjectDict = (object: jsonType): boolean => typeof object !== "string" && typeof object !== "number" && typeof object !== "boolean" && object !== null && !(object instanceof Array);
const schemaExists = (schemaName: string, schemas: schemas): boolean => schemas[schemaName] !== undefined;
const keyExistsInSchema = (key: string, schema: schema): boolean => schema.properties[key] !== undefined;
const isPropertyRequired = (property: property): boolean => property.optional === undefined;
const propertyExistsInObject = (object: Record<string, unknown>, key: string): boolean => key in object;