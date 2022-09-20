import { describe, it } from "@jest/globals";
import { fileToSchema, filesToSchemas, property } from "./interface-to-schema";

describe("DTOFileToSchemaParserModule", () => {
  it("should parse file", () => {
    const schema = fileToSchema("./test/dto/author.dto.ts", "IAuthorDTO");
    expect(Object.keys(schema.properties)).toHaveLength(2);
    expect((schema.properties.lastname as property).optional).toBeUndefined();
    expect((schema.properties.firstname as property).optional).toEqual(true);
    expect((schema.properties.firstname as property).description).toEqual("Authors firstname (if exists)");
  });
  it("should parse schemas", () => {
    const schemas = filesToSchemas("./test/dto", ["book", "author"]);
    expect(schemas.book).toBeDefined();
    expect((schemas.book.properties.author as any).type).toEqual("author[]");
    expect(schemas.author).toBeDefined();
    expect((schemas.author.properties.lastname as any).type).toEqual("string");
    expect((schemas.book.properties.binding as any).type).toEqual("'hardcover' | 'spiral'");
  });
});